// ============================================================
// Game format calculations.
// All functions take per-hole maps keyed "1".."18" (strings),
// only holes present for BOTH players are considered "played".
// strokes = { "3": 1, "11": 2 } -> number of handicap strokes that player gets off gross on that hole.
// ============================================================

export function playedHoles(scoresA, scoresB) {
  const holes = [];
  for (let h = 1; h <= 18; h++) {
    const k = String(h);
    if (scoresA?.[k] != null && scoresB?.[k] != null) holes.push(h);
  }
  return holes;
}

export function net(scores, strokes, hole) {
  const k = String(hole);
  const gross = scores?.[k];
  if (gross == null) return null;
  const stroke = Number(strokes?.[k]) || 0;
  return gross - stroke;
}

// ---------- WHS-style Course Handicap ----------
// Course Handicap = round( Index * (Slope / 113) + (Rating - Par) )
export function courseHandicap(handicapIndex, slope, rating, totalPar) {
  if (handicapIndex == null || slope == null || rating == null || totalPar == null) return null;
  return Math.round(Number(handicapIndex) * (Number(slope) / 113) + (Number(rating) - Number(totalPar)));
}

// ---------- Allocate strokes between two players based on their Course Handicaps ----------
// The player with the higher Course Handicap receives strokes equal to the difference,
// applied to the hardest holes first (lowest strokeIndex), wrapping around past 18 if diff > 18.
// strokeIndexes: array of 18 values (hole difficulty rank, 1 = hardest) in hole-number order.
export function allocateStrokes(chA, chB, strokeIndexes) {
  const strokesA = {}, strokesB = {};
  if (chA == null || chB == null) return { strokesA, strokesB };
  const diff = chA - chB;
  if (diff === 0) return { strokesA, strokesB };
  const receiver = diff > 0 ? strokesA : strokesB;
  const amount = Math.abs(diff);

  const order = (strokeIndexes && strokeIndexes.length === 18 ? strokeIndexes : Array.from({length:18},(_,i)=>i+1))
    .map((si, idx) => ({ hole: idx + 1, si }))
    .sort((x, y) => x.si - y.si);

  for (let i = 0; i < amount; i++) {
    const hole = order[i % 18].hole;
    receiver[hole] = (receiver[hole] || 0) + 1;
  }
  return { strokesA, strokesB };
}

// ---------- Match Play (net), holes-won style ----------
export function matchPlay(scoresA, scoresB, strokesA, strokesB) {
  const holes = playedHoles(scoresA, scoresB);
  let a = 0, b = 0, halved = 0;
  for (const h of holes) {
    const na = net(scoresA, strokesA, h);
    const nb = net(scoresB, strokesB, h);
    if (na < nb) a++;
    else if (nb < na) b++;
    else halved++;
  }
  let result = 'in progress';
  const remaining = 18 - holes.length;
  const diff = Math.abs(a - b);
  if (holes.length === 18) {
    if (a === b) result = 'halved';
    else result = `${a > b ? 'A' : 'B'} wins ${diff}${diff > remaining ? ' & ' + (remaining) : ''}`;
  } else if (diff > remaining) {
    result = `${a > b ? 'A' : 'B'} wins ${diff} & ${remaining}`;
  }
  return { holesA: a, holesB: b, halved, holesPlayed: holes.length, result };
}

// ---------- Nassau: front9 / back9 / overall, each scored match-play style ----------
export function nassau(scoresA, scoresB, strokesA, strokesB) {
  const seg = (from, to) => {
    let a = 0, b = 0;
    for (let h = from; h <= to; h++) {
      const na = net(scoresA, strokesA, h);
      const nb = net(scoresB, strokesB, h);
      if (na == null || nb == null) continue;
      if (na < nb) a++;
      else if (nb < na) b++;
    }
    return { a, b, winner: a === b ? 'push' : (a > b ? 'A' : 'B') };
  };
  return { front: seg(1, 9), back: seg(10, 18), overall: seg(1, 18) };
}

// ---------- Skins: lowest net wins the hole outright, ties carry the pot ----------
export function skins(scoresA, scoresB, strokesA, strokesB) {
  const holes = playedHoles(scoresA, scoresB);
  let pot = 0, skinsA = 0, skinsB = 0;
  const log = [];
  for (const h of holes) {
    pot += 1;
    const na = net(scoresA, strokesA, h);
    const nb = net(scoresB, strokesB, h);
    if (na < nb) { skinsA += pot; log.push({ hole: h, winner: 'A', value: pot }); pot = 0; }
    else if (nb < na) { skinsB += pot; log.push({ hole: h, winner: 'B', value: pot }); pot = 0; }
    else { log.push({ hole: h, winner: 'carry', value: pot }); }
  }
  return { skinsA, skinsB, carryOver: pot, log };
}

// ---------- Stableford (net points) ----------
// double bogey+ = 0, bogey = 1, par = 2, birdie = 3, eagle = 4, albatross+ = 5
export function stableford(pars, scores, strokes) {
  const holes = Object.keys(scores || {}).map(Number);
  let total = 0;
  const perHole = {};
  for (const h of holes) {
    const par = pars?.[h - 1];
    const n = net(scores, strokes, h);
    if (par == null || n == null) continue;
    const diff = n - par; // negative = under par
    let pts;
    if (diff <= -3) pts = 5;
    else if (diff === -2) pts = 4;
    else if (diff === -1) pts = 3;
    else if (diff === 0) pts = 2;
    else if (diff === 1) pts = 1;
    else pts = 0;
    perHole[h] = pts;
    total += pts;
  }
  return { total, perHole };
}

export function grossTotal(scores) {
  return Object.values(scores || {}).reduce((s, v) => s + (v || 0), 0);
}

export function netTotal(scores, strokes) {
  let total = 0;
  for (const k of Object.keys(scores || {})) {
    total += (scores[k] || 0) - (Number(strokes?.[k]) || 0);
  }
  return total;
}

// Compute the full results bundle for a round given selected formats
export function computeRoundResults(round, playerUids) {
  const [uidA, uidB] = playerUids;
  const scoresA = round.scores?.[uidA] || {};
  const scoresB = round.scores?.[uidB] || {};
  const strokesA = round.strokes?.[uidA] || {};
  const strokesB = round.strokes?.[uidB] || {};
  const pars = round.pars || [];

  const results = {};
  const formats = round.formats || [];
  if (formats.includes('matchplay')) results.matchplay = matchPlay(scoresA, scoresB, strokesA, strokesB);
  if (formats.includes('nassau')) results.nassau = nassau(scoresA, scoresB, strokesA, strokesB);
  if (formats.includes('skins')) results.skins = skins(scoresA, scoresB, strokesA, strokesB);
  if (formats.includes('stableford')) {
    results.stableford = {
      A: stableford(pars, scoresA, strokesA),
      B: stableford(pars, scoresB, strokesB)
    };
  }
  results.grossA = grossTotal(scoresA);
  results.grossB = grossTotal(scoresB);
  results.netA = netTotal(scoresA, strokesA);
  results.netB = netTotal(scoresB, strokesB);
  results.holesPlayed = playedHoles(scoresA, scoresB).length;
  return results;
}
