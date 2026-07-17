import {
  db, collection, doc, addDoc, getDoc, getDocs, updateDoc, onSnapshot,
  query, orderBy, limit as fbLimit, serverTimestamp
} from './firebase-config.js';
import { onReady, state, toast } from './app.js';
import { computeRoundResults, courseHandicap, allocateStrokes } from './games.js';

const FORMAT_LABELS = { matchplay: 'Match Play', nassau: 'Nassau', skins: 'Skins', stableford: 'Stableford' };

let coursesCache = [];
let currentRoundId = null;
let currentRoundRef = null;
let tableBuilt = false;
let writeTimers = {};
let unsubscribeRound = null;

onReady(async (s) => {
  if (!s.user) return;
  await loadCourses();
  await loadRecentRounds();

  const params = new URLSearchParams(location.search);
  const roundId = params.get('round');
  if (roundId) {
    openScorecard(roundId);
  }
});

// ---------------- Course loading / new course UI ----------------

async function loadCourses() {
  const snap = await getDocs(collection(db, 'courses'));
  coursesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const sel = document.getElementById('f-course-select');
  sel.innerHTML = `<option value="">— select an existing course —</option>` +
    coursesCache.map(c => `<option value="${c.id}">${escAttr(c.name)}</option>`).join('');
  sel.onchange = () => {
    document.getElementById('f-course-new').value = '';
    document.getElementById('par-inputs-slot').innerHTML = '';
  };
  document.getElementById('f-course-new').oninput = (e) => {
    if (e.target.value.trim()) {
      document.getElementById('f-course-select').value = '';
      renderParInputs();
    } else {
      document.getElementById('par-inputs-slot').innerHTML = '';
    }
  };
}

function renderParInputs() {
  const slot = document.getElementById('par-inputs-slot');
  const defaultPars = [4,4,3,5,4,4,3,5,4, 4,4,3,5,4,4,3,5,4];
  const totalPar = defaultPars.reduce((a,b)=>a+b,0);
  slot.innerHTML = `
    <div class="field-row">
      <div>
        <label for="new-rating-input">Course rating</label>
        <input type="number" id="new-rating-input" step="0.1" value="${totalPar}">
      </div>
      <div>
        <label for="new-slope-input">Slope rating</label>
        <input type="number" id="new-slope-input" value="113" min="55" max="155">
      </div>
    </div>
    <label>Par per hole</label>
    <div style="display:grid;grid-template-columns:repeat(9,1fr);gap:6px;margin-bottom:14px;">
      ${defaultPars.map((p,i) => `<input type="number" min="3" max="6" value="${p}" class="new-par-input" data-hole="${i+1}" style="text-align:center;padding:6px;">`).join('')}
    </div>
    <label>Handicap allocation (1 = hardest hole, 18 = easiest — from the course scorecard)</label>
    <div style="display:grid;grid-template-columns:repeat(9,1fr);gap:6px;margin-bottom:14px;">
      ${Array.from({length:18},(_,i)=>i+1).map(si => `<input type="number" min="1" max="18" value="${si}" class="new-si-input" data-hole="${si}" style="text-align:center;padding:6px;">`).join('')}
    </div>`;
}

// ---------------- Recent rounds list ----------------

async function loadRecentRounds() {
  const slot = document.getElementById('recent-rounds-slot');
  const snap = await getDocs(query(collection(db, 'rounds'), orderBy('date', 'desc'), fbLimit(10)));
  if (snap.empty) {
    slot.innerHTML = `<div class="empty-state"><div class="glyph">🏌️</div><p>No rounds yet — set one up above.</p></div>`;
    return;
  }
  slot.innerHTML = snap.docs.map(d => {
    const r = d.data();
    const tags = (r.formats || []).map(f => `<span class="pill">${FORMAT_LABELS[f] || f}</span>`).join('');
    return `<a class="round-list-item" href="round-entry.html?round=${d.id}">
      <div><div class="rli-course">${esc(r.courseName || 'Unnamed course')}</div>
      <div class="rli-date">${esc(r.date||'')}${r.time ? ' · '+esc(r.time) : ''}</div></div>
      <div class="rli-tags">${tags}</div></a>`;
  }).join('');
}

// ---------------- Start a new round ----------------

document.getElementById('start-round-btn').addEventListener('click', async () => {
  const date = document.getElementById('f-date').value;
  const time = document.getElementById('f-time').value;
  const courseSelect = document.getElementById('f-course-select');
  const newCourseName = document.getElementById('f-course-new').value.trim();
  const formats = Array.from(document.querySelectorAll('.fmt-check:checked')).map(c => c.value);

  if (!date) { toast('Pick a date first'); return; }
  if (!courseSelect.value && !newCourseName) { toast('Pick or add a course'); return; }
  if (formats.length === 0) { toast('Pick at least one format'); return; }

  let courseId = courseSelect.value;
  let courseName, pars, rating, slope, strokeIndex;

  if (courseId) {
    const c = coursesCache.find(c => c.id === courseId);
    courseName = c.name;
    pars = c.pars;
    rating = c.rating ?? pars.reduce((a,b)=>a+b,0);
    slope = c.slope ?? 113;
    strokeIndex = c.strokeIndex ?? Array.from({length:18},(_,i)=>i+1);
  } else {
    courseName = newCourseName;
    pars = Array.from(document.querySelectorAll('.new-par-input')).map(i => Number(i.value) || 4);
    rating = Number(document.getElementById('new-rating-input')?.value) || pars.reduce((a,b)=>a+b,0);
    slope = Number(document.getElementById('new-slope-input')?.value) || 113;
    strokeIndex = Array.from(document.querySelectorAll('.new-si-input')).map(i => Number(i.value) || 1);
    const courseRef = await addDoc(collection(db, 'courses'), { name: courseName, pars, rating, slope, strokeIndex, createdAt: Date.now() });
    courseId = courseRef.id;
  }

  const playerNames = {};
  state.allPlayers.forEach(p => playerNames[p.uid] = p.name);
  const players = state.allPlayers.map(p => p.uid);
  if (!players.includes(state.user.uid)) players.push(state.user.uid);

  // Auto-allocate handicap strokes from each player's Handicap Index + this course's rating/slope
  const totalPar = pars.reduce((a,b)=>a+b,0);
  const courseHandicaps = {};
  let strokesInit = {};
  if (players.length === 2) {
    const [uidA, uidB] = players;
    const idxA = state.allPlayers.find(p => p.uid === uidA)?.handicapIndex;
    const idxB = state.allPlayers.find(p => p.uid === uidB)?.handicapIndex;
    if (idxA != null && idxB != null) {
      const chA = courseHandicap(idxA, slope, rating, totalPar);
      const chB = courseHandicap(idxB, slope, rating, totalPar);
      courseHandicaps[uidA] = chA;
      courseHandicaps[uidB] = chB;
      const { strokesA, strokesB } = allocateStrokes(chA, chB, strokeIndex);
      strokesInit = {
        [uidA]: Object.fromEntries(Object.entries(strokesA).map(([h,v]) => [String(h), v])),
        [uidB]: Object.fromEntries(Object.entries(strokesB).map(([h,v]) => [String(h), v]))
      };
    } else {
      toast('Set both handicap indexes (top right) to auto-allocate strokes — you can still enter them by hand on the scorecard.');
    }
  }

  const roundRef = await addDoc(collection(db, 'rounds'), {
    date, time, courseId, courseName, pars, rating, slope, strokeIndex, formats,
    players, playerNames, courseHandicaps,
    scores: {}, strokes: strokesInit,
    createdBy: state.user.uid,
    createdAt: Date.now()
  });

  history.replaceState(null, '', `round-entry.html?round=${roundRef.id}`);
  openScorecard(roundRef.id);
});

// ---------------- Scorecard (live) ----------------

document.getElementById('back-to-list-btn').addEventListener('click', () => {
  if (unsubscribeRound) { unsubscribeRound(); unsubscribeRound = null; }
  history.replaceState(null, '', 'round-entry.html');
  document.getElementById('scorecard-view').style.display = 'none';
  document.getElementById('round-picker').style.display = '';
  loadRecentRounds();
});

function openScorecard(roundId) {
  if (unsubscribeRound) { unsubscribeRound(); unsubscribeRound = null; }
  currentRoundId = roundId;
  currentRoundRef = doc(db, 'rounds', roundId);
  tableBuilt = false;
  document.getElementById('round-picker').style.display = 'none';
  document.getElementById('scorecard-view').style.display = '';

  unsubscribeRound = onSnapshot(currentRoundRef, async (snap) => {
    if (!snap.exists()) return;
    const round = { id: snap.id, ...snap.data() };

    // make sure current user is registered as a player on this round
    if (!round.players.includes(state.user.uid)) {
      await updateDoc(currentRoundRef, {
        players: [...round.players, state.user.uid],
        [`playerNames.${state.user.uid}`]: state.profile.name
      });
      return; // will re-trigger snapshot
    }

    document.getElementById('sv-eyebrow').textContent = round.formats.map(f => FORMAT_LABELS[f]).join(' · ');
    document.getElementById('sv-title').textContent = round.courseName;
    const [subUidA, subUidB] = round.players;
    const chText = round.courseHandicaps && round.courseHandicaps[subUidA] != null
      ? ` · Course HCP: ${round.playerNames[subUidA]} ${round.courseHandicaps[subUidA]}${subUidB ? `, ${round.playerNames[subUidB]} ${round.courseHandicaps[subUidB]}` : ''}`
      : '';
    document.getElementById('sv-sub').textContent = `${round.date}${round.time ? ' · ' + round.time : ''} · ${round.players.length < 2 ? 'Waiting for the other player to join…' : 'Both players connected'}${chText}`;

    if (!tableBuilt) {
      buildTable(round);
      tableBuilt = true;
    }
    updateValues(round);
    updateResults(round);
  });
}

function buildTable(round) {
  const table = document.getElementById('scorecard-table');
  const [uidA, uidB] = round.players;
  const nameA = round.playerNames[uidA] || 'Player A';
  const nameB = uidB ? (round.playerNames[uidB] || 'Player B') : 'Waiting…';

  const holeHeaders = Array.from({length:18}, (_,i) => `<th>${i+1}</th>`).join('');
  const parCells = round.pars.map(p => `<td>${p}</td>`).join('');

  const scoreRow = (uid, label) => {
    if (!uid) return `<tr><td class="hole-label">${esc(label)}</td>${Array.from({length:18},()=> `<td>—</td>`).join('')}<td class="total-col">—</td><td class="total-col">—</td><td class="total-col">—</td></tr>`;
    const cells = Array.from({length:18}, (_,i) => {
      const h = i+1;
      return `<td>
        <input type="number" min="1" max="15" class="score-input" data-uid="${uid}" data-hole="${h}">
        <input type="number" min="0" max="3" placeholder="0" class="stroke-input" data-uid="${uid}" data-hole="${h}"
          title="Handicap strokes on this hole" style="margin-top:2px;font-size:10px;padding:2px 0;color:var(--flag);">
      </td>`;
    }).join('');
    return `<tr>
      <td class="hole-label">${esc(label)}</td>${cells}
      <td class="total-col out-total" data-uid="${uid}">–</td>
      <td class="total-col in-total" data-uid="${uid}">–</td>
      <td class="total-col tot-total" data-uid="${uid}">–</td>
    </tr>`;
  };

  table.innerHTML = `
    <thead><tr><th class="hole-label">Hole</th>${holeHeaders}<th class="total-col">OUT</th><th class="total-col">IN</th><th class="total-col">TOT</th></tr></thead>
    <tbody>
      <tr><td class="hole-label">Par</td>${parCells}<td class="total-col">${sum(round.pars.slice(0,9))}</td><td class="total-col">${sum(round.pars.slice(9,18))}</td><td class="total-col">${sum(round.pars)}</td></tr>
      ${scoreRow(uidA, nameA)}
      ${scoreRow(uidB, nameB)}
    </tbody>`;

  table.querySelectorAll('.score-input').forEach(input => {
    input.addEventListener('input', () => {
      const uid = input.dataset.uid, hole = input.dataset.hole;
      clearTimeout(writeTimers[`${uid}-${hole}`]);
      writeTimers[`${uid}-${hole}`] = setTimeout(() => {
        const val = input.value === '' ? null : Number(input.value);
        if (val === null) return;
        updateDoc(currentRoundRef, { [`scores.${uid}.${hole}`]: val }).catch(e => toast(e.message));
      }, 400);
    });
  });
  table.querySelectorAll('.stroke-input').forEach(input => {
    input.addEventListener('input', () => {
      const uid = input.dataset.uid, hole = input.dataset.hole;
      clearTimeout(writeTimers[`s-${uid}-${hole}`]);
      writeTimers[`s-${uid}-${hole}`] = setTimeout(() => {
        const val = input.value === '' ? 0 : Number(input.value);
        updateDoc(currentRoundRef, { [`strokes.${uid}.${hole}`]: val }).catch(e => toast(e.message));
      }, 400);
    });
  });
}

function updateValues(round) {
  const [uidA, uidB] = round.players;
  [uidA, uidB].filter(Boolean).forEach(uid => {
    const scores = round.scores?.[uid] || {};
    const strokes = round.strokes?.[uid] || {};
    let out = 0, inn = 0, tot = 0;
    for (let h = 1; h <= 18; h++) {
      const input = document.querySelector(`.score-input[data-uid="${uid}"][data-hole="${h}"]`);
      const strokeInput = document.querySelector(`.stroke-input[data-uid="${uid}"][data-hole="${h}"]`);
      const val = scores[String(h)];
      if (input && document.activeElement !== input) input.value = val ?? '';
      if (strokeInput && document.activeElement !== strokeInput) {
        const sVal = strokes[String(h)];
        strokeInput.value = sVal ? sVal : '';
      }
      if (val != null) { tot += val; if (h <= 9) out += val; else inn += val; }
    }
    const setTxt = (cls, txt) => { const el = document.querySelector(`.${cls}[data-uid="${uid}"]`); if (el) el.textContent = txt; };
    setTxt('out-total', out || '–');
    setTxt('in-total', inn || '–');
    setTxt('tot-total', tot || '–');
  });
}

function updateResults(round) {
  const slot = document.getElementById('live-results-slot');
  const [uidA, uidB] = round.players;
  if (!uidA || !uidB) { slot.innerHTML = ''; return; }
  const res = computeRoundResults(round, [uidA, uidB]);
  const nameA = round.playerNames[uidA], nameB = round.playerNames[uidB];
  const cards = [];
  if (res.matchplay) cards.push(card('Match Play', res.matchplay.result, `${res.matchplay.holesA} won · ${res.matchplay.halved} halved · ${res.matchplay.holesB} won`));
  if (res.nassau) cards.push(card('Nassau', `F9 ${label(res.nassau.front.winner)} · B9 ${label(res.nassau.back.winner)} · 18 ${label(res.nassau.overall.winner)}`, ''));
  if (res.skins) cards.push(card('Skins', `${nameA} ${res.skins.skinsA} — ${res.skins.skinsB} ${nameB}`, res.skins.carryOver ? `${res.skins.carryOver} carrying over` : 'no carryover'));
  if (res.stableford) cards.push(card('Stableford', `${nameA} ${res.stableford.A.total} — ${res.stableford.B.total} ${nameB}`, ''));
  slot.innerHTML = cards.join('');
}

function label(w) { return w === 'A' ? 'A' : w === 'B' ? 'B' : 'push'; }
function card(name, main, sub) {
  return `<div class="format-card"><div class="fmt-name">${esc(name)}</div><div style="font-family:var(--font-mono);font-weight:600;">${esc(main)}</div>${sub ? `<div class="loading-line" style="margin-top:4px;">${esc(sub)}</div>` : ''}</div>`;
}
function sum(arr) { return arr.reduce((a,b) => a + (b||0), 0); }
function esc(str) { return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escAttr(str) { return esc(str); }
