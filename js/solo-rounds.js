import { db, collection, addDoc, getDocs, query, orderBy } from './firebase-config.js';
import { onReady, state, toast } from './app.js';

const PLAYER_COLORS = ['#0C2340', '#B22234', '#C9A227', '#4C5A6B'];
let map, tempMarker, pinLatLng = null;
let markerCluster = [];
let colorForUid = {};

onReady(async (s) => {
  if (!s.user) return;
  initMap();
  await renderExisting();
});

function initMap() {
  if (map) return;
  map = L.map('solo-map').setView([39.5, -98.35], 4); // USA-wide default view
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 18
  }).addTo(map);

  map.on('click', (e) => {
    setPin(e.latlng.lat, e.latlng.lng);
  });

  document.getElementById('s-search-btn').addEventListener('click', geocodeSearch);
  document.getElementById('s-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); geocodeSearch(); }
  });
  document.getElementById('s-save-btn').addEventListener('click', saveSoloRound);
}

function setPin(lat, lng) {
  pinLatLng = { lat, lng };
  if (tempMarker) map.removeLayer(tempMarker);
  tempMarker = L.marker([lat, lng], { draggable: true }).addTo(map);
  tempMarker.on('dragend', () => {
    const p = tempMarker.getLatLng();
    pinLatLng = { lat: p.lat, lng: p.lng };
  });
  document.getElementById('s-pin-status').textContent = `Pinned at ${lat.toFixed(4)}, ${lng.toFixed(4)} — drag the marker to fine-tune.`;
}

async function geocodeSearch() {
  const q = document.getElementById('s-search').value.trim();
  if (!q) return;
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`);
    const results = await res.json();
    if (!results.length) { toast('No location found — try a different search'); return; }
    const { lat, lon } = results[0];
    map.setView([lat, lon], 14);
    setPin(Number(lat), Number(lon));
    if (!document.getElementById('s-course').value) document.getElementById('s-course').value = q;
  } catch (e) {
    toast('Search failed — you can still click the map to drop a pin');
  }
}

async function saveSoloRound() {
  const date = document.getElementById('s-date').value;
  const courseName = document.getElementById('s-course').value.trim();
  const score = Number(document.getElementById('s-score').value) || null;
  const notes = document.getElementById('s-notes').value.trim();

  if (!date) { toast('Pick a date'); return; }
  if (!courseName) { toast('Add a course name'); return; }
  if (!pinLatLng) { toast('Drop a pin on the map for the location'); return; }

  await addDoc(collection(db, 'soloRounds'), {
    uid: state.user.uid,
    playerName: state.profile.name,
    date, courseName, score, notes,
    lat: pinLatLng.lat, lng: pinLatLng.lng,
    createdAt: Date.now()
  });

  toast('Solo round saved');
  document.getElementById('s-course').value = '';
  document.getElementById('s-score').value = '';
  document.getElementById('s-notes').value = '';
  document.getElementById('s-pin-status').textContent = 'No location pinned yet — click the map above to drop a pin.';
  if (tempMarker) { map.removeLayer(tempMarker); tempMarker = null; }
  pinLatLng = null;

  await renderExisting();
}

async function renderExisting() {
  const historySlot = document.getElementById('solo-history-slot');
  const snap = await getDocs(query(collection(db, 'soloRounds'), orderBy('date', 'desc')));

  markerCluster.forEach(m => map.removeLayer(m));
  markerCluster = [];

  if (snap.empty) {
    historySlot.innerHTML = `<div class="empty-state"><div class="glyph">🗺️</div><p>No solo rounds logged yet.</p></div>`;
    return;
  }

  const rows = [];
  const bounds = [];
  let colorIdx = 0;

  snap.docs.forEach(d => {
    const r = d.data();
    if (!(r.uid in colorForUid)) colorForUid[r.uid] = PLAYER_COLORS[colorIdx++ % PLAYER_COLORS.length];
    const color = colorForUid[r.uid];

    if (r.lat != null && r.lng != null) {
      const marker = L.circleMarker([r.lat, r.lng], {
        radius: 8, color, fillColor: color, fillOpacity: 0.85, weight: 2
      }).addTo(map);
      marker.bindPopup(`<strong>${esc(r.courseName)}</strong><br>${esc(r.playerName)} · ${esc(r.date)}${r.score ? ' · Score ' + r.score : ''}${r.notes ? '<br><em>' + esc(r.notes) + '</em>' : ''}`);
      markerCluster.push(marker);
      bounds.push([r.lat, r.lng]);
    }

    rows.push(`<div class="round-list-item">
      <div><div class="rli-course">${esc(r.courseName)}</div>
      <div class="rli-date">${esc(r.date)}${r.score ? ' · Score ' + r.score : ''}</div></div>
      <div class="rli-tags"><span class="pill" style="background:${color}22;color:${color};">${esc(r.playerName)}</span></div>
    </div>`);
  });

  historySlot.innerHTML = rows.join('');
  if (bounds.length) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
}

function esc(str) { return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
