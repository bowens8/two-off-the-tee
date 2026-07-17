import {
  auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged,
  doc, getDoc, setDoc, collection, getDocs
} from './firebase-config.js';

// ---------- toast ----------
export function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2600);
}

// ---------- current user state (shared across pages) ----------
export const state = {
  user: null,       // firebase auth user
  profile: null,     // { name } from Firestore users/{uid}
  allPlayers: []      // [{uid, name}] every player who has ever signed in (should end up = 2)
};

const readyCallbacks = [];
export function onReady(cb) { readyCallbacks.push(cb); }

async function ensureProfile(user) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return snap.data();
  }
  // First sign-in: ask for a display name
  let name = window.prompt("Welcome! What's your name? (shows on the leaderboard)", user.displayName || '');
  if (!name || !name.trim()) name = user.displayName || 'Player';
  const profile = { name: name.trim(), email: user.email || '', handicapIndex: null, createdAt: Date.now() };
  await setDoc(ref, profile);
  return profile;
}

export async function updateHandicapIndex(newIndex) {
  if (!state.user) return;
  const ref = doc(db, 'users', state.user.uid);
  await setDoc(ref, { handicapIndex: newIndex }, { merge: true });
  state.profile.handicapIndex = newIndex;
  const me = state.allPlayers.find(p => p.uid === state.user.uid);
  if (me) me.handicapIndex = newIndex;
  renderHeader();
}

async function loadAllPlayers() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

function renderHeader() {
  const authArea = document.getElementById('auth-area');
  if (!authArea) return;
  authArea.innerHTML = '';

  if (state.user && state.profile) {
    const badge = document.createElement('div');
    badge.className = 'tee-badge';
    badge.title = state.profile.name;
    badge.textContent = state.profile.name.slice(0, 2).toUpperCase();

    const hcpChip = document.createElement('button');
    hcpChip.className = 'btn btn-ghost btn-sm hcp-chip';
    hcpChip.title = 'Click to update your handicap index';
    hcpChip.textContent = state.profile.handicapIndex != null ? `HCP ${state.profile.handicapIndex}` : 'Set HCP';
    hcpChip.onclick = async () => {
      const input = window.prompt('Your current Handicap Index (e.g. 14.2):', state.profile.handicapIndex ?? '');
      if (input === null) return;
      const val = parseFloat(input);
      if (Number.isNaN(val)) { toast('Enter a number, e.g. 14.2'); return; }
      await updateHandicapIndex(val);
      toast('Handicap index updated');
    };

    const btn = document.createElement('button');
    btn.className = 'btn btn-ghost btn-sm';
    btn.textContent = 'Sign out';
    btn.onclick = () => signOut(auth);

    authArea.appendChild(badge);
    authArea.appendChild(hcpChip);
    authArea.appendChild(btn);
  } else {
    const btn = document.createElement('button');
    btn.className = 'btn btn-flag btn-sm';
    btn.textContent = 'Sign in with Google';
    btn.onclick = () => signInWithPopup(auth, googleProvider).catch(e => toast(e.message));
    authArea.appendChild(btn);
  }
}

function toggleGates() {
  document.querySelectorAll('[data-requires-auth]').forEach(el => {
    el.style.display = state.user ? '' : 'none';
  });
  document.querySelectorAll('[data-requires-signed-out]').forEach(el => {
    el.style.display = state.user ? 'none' : '';
  });
}

export function initAuthUI() {
  // highlight active nav link
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('nav.site-nav a').forEach(a => {
    if (a.getAttribute('href') === path) a.classList.add('active');
  });

  onAuthStateChanged(auth, async (user) => {
    state.user = user;
    if (user) {
      state.profile = await ensureProfile(user);
      state.allPlayers = await loadAllPlayers();
    } else {
      state.profile = null;
      state.allPlayers = [];
    }
    renderHeader();
    toggleGates();
    readyCallbacks.forEach(cb => cb(state));
  });
}

// Auto-start on every page that imports this module.
initAuthUI();
