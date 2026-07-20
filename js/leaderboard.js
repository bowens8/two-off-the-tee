import { db, collection, getDocs, query, orderBy } from './firebase-config.js';
import { onReady, state } from './app.js';
import { computeRoundResults } from './games.js';

const FORMAT_LABELS = {
  matchplay: 'Match Play',
  nassau: 'Nassau',
  skins: 'Skins',
  stableford: 'Stableford'
};

onReady(async (s) => {
  if (!s.user) return;
  await render();
});

async function render() {
  const bannerSlot = document.getElementById('h2h-banner-slot');
  const gridSlot = document.getElementById('format-grid-slot');
  const historySlot = document.getElementById('round-history-slot');

  let roundsSnap;
  try {
    roundsSnap = await getDocs(query(collection(db, 'rounds'), orderBy('date', 'desc')));
  } catch (e) {
    historySlot.innerHTML = `<p class="loading-line">Couldn't load rounds: ${e.message}</p>`;
    return;
  }

  const rounds = roundsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (rounds.length === 0) {
    bannerSlot.innerHTML = '';
    gridSlot.innerHTML = '';
    historySlot.innerHTML = `<div class="empty-state"><div class="glyph">🏌️</div>
      <p>No rounds logged yet. Head to <a href="round-entry.html">Log a Round</a> to start the season.</p></div>`;
    return;
  }

  // Figure out the two players from the union of players arrays + known profiles
  const uidToName = {};
  state.allPlayers.forEach(p => uidToName[p.uid] = p.name);
  const uidSet = new Set();
  rounds.forEach(r => (r.players || []).forEach(u => uidSet.add(u)));
  const uids = Array.from(uidSet);
  if (uids.length < 2) {
    historySlot.innerHTML = `<div class="empty-state"><p>Waiting on both players to log at least one round together.</p></div>`;
    return;
  }
  const [uidA, uidB] = uids;
  const nameA = uidToName[uidA] || 'Player A';
  const nameB = uidToName[uidB] || 'Player B';

  // Season aggregates
  let overallWinsA = 0, overallWinsB = 0, overallTies = 0;
  let matchplayWinsA = 0, matchplayWinsB = 0;
  let nassauBetsA = 0, nassauBetsB = 0;
  let skinsTotalA = 0, skinsTotalB = 0;
  let stablefordPtsA = 0, stablefordPtsB = 0;

  const historyRows = [];

  for (const r of rounds) {
    if (!r.players || r.players.length < 2) continue;
    const res = computeRoundResults(r, [uidA, uidB]);

    if (res.netA < res.netB) overallWinsA++;
    else if (res.netB < res.netA) overallWinsB++;
    else overallTies++;

    if (res.matchplay) {
      if (res.matchplay.holesA > res.matchplay.holesB) matchplayWinsA++;
      else if (res.matchplay.holesB > res.matchplay.holesA) matchplayWinsB++;
    }
    if (res.nassau) {
      [res.nassau.front, res.nassau.back, res.nassau.overall].forEach(seg => {
        if (seg.winner === 'A') nassauBetsA++;
        else if (seg.winner === 'B') nassauBetsB++;
      });
    }
    if (res.skins) {
      skinsTotalA += res.skins.skinsA;
      skinsTotalB += res.skins.skinsB;
    }
    if (res.stableford) {
      stablefordPtsA += res.stableford.A.total;
      stablefordPtsB += res.stableford.B.total;
    }

    historyRows.push({ round: r, res });
  }

  // ---- H2H banner ----
  bannerSlot.innerHTML = `
    <div class="h2h-banner">
      <div class="h2h-player">
        <div class="name">${esc(nameA)}</div>
        <div class="score">${overallWinsA}</div>
        <div class="label">Rounds won</div>
      </div>
      <div class="h2h-vs">vs</div>
      <div class="h2h-player">
        <div class="name">${esc(nameB)}</div>
        <div class="score">${overallWinsB}</div>
        <div class="label">Rounds won</div>
      </div>
    </div>
    ${overallTies ? `<p class="page-sub" style="margin-top:-14px;">${overallTies} round${overallTies===1?'':'s'} tied on net score.</p>` : ''}
  `;

  // ---- format grid ----
  const cards = [];
  cards.push(fmtCard('Match Play', `${matchplayWinsA} — ${matchplayWinsB}`, nameA, nameB, matchplayWinsA, matchplayWinsB));
  cards.push(fmtCard('Nassau bets', `${nassauBetsA} — ${nassauBetsB}`, nameA, nameB, nassauBetsA, nassauBetsB));
  cards.push(fmtCard('Skins won', `${skinsTotalA} — ${skinsTotalB}`, nameA, nameB, skinsTotalA, skinsTotalB));
  cards.push(fmtCard('Stableford pts', `${stablefordPtsA} — ${stablefordPtsB}`, nameA, nameB, stablefordPtsA, stablefordPtsB));
  gridSlot.innerHTML = `<div class="format-grid">${cards.join('')}</div>`;

  // ---- history ----
  historySlot.innerHTML = historyRows.map(({ round, res }) => {
    const tags = (round.formats || []).map(f => `<span class="pill">${FORMAT_LABELS[f] || f}</span>`).join('');
    const marginTag = res.netA < res.netB
      ? `<span class="pill flag">${esc(nameA)} +${res.netB - res.netA}</span>`
      : res.netB < res.netA
        ? `<span class="pill flag">${esc(nameB)} +${res.netA - res.netB}</span>`
        : `<span class="pill sand">Tied</span>`;
    return `
      <a class="round-list-item" href="round-entry.html?round=${round.id}">
        <div>
          <div class="rli-course">${esc(round.courseName || 'Unnamed course')}</div>
          <div class="rli-date">${esc(round.date || '')}${round.time ? ' · ' + esc(round.time) : ''} · ${res.holesPlayed}/18 holes</div>
        </div>
        <div class="rli-tags">${tags}${marginTag}</div>
      </a>`;
  }).join('');
}

function fmtCard(label, scoreText, nameA, nameB, a, b) {
  const leadA = a > b, leadB = b > a;
  return `
    <div class="format-card">
      <div class="fmt-name">${esc(label)}</div>
      <div class="fmt-score">
        <span class="num ${leadA ? 'leading' : ''}">${a}</span>
        <span class="mono" style="font-size:11px;color:var(--ink-soft);">${esc(nameA.split(' ')[0])} · ${esc(nameB.split(' ')[0])}</span>
        <span class="num ${leadB ? 'leading' : ''}">${b}</span>
      </div>
    </div>`;
}

function esc(str) {
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
