# Two Off the Tee — setup guide

A head-to-head golf tracker for you and Spencer: log rounds together with live hole-by-hole
scoring (Match Play, Nassau, Skins, Stableford), a season leaderboard, and a map of solo
rounds you each play elsewhere.

Stack: plain HTML/CSS/JS + Firebase (Auth + Firestore), hosted free on GitHub Pages. No
build step — you can open `index.html` locally or push straight to GitHub.

## 1. Create the Firebase project

1. Go to https://console.firebase.google.com → **Add project** → name it (e.g. `two-off-the-tee`) → finish the wizard.
2. In the left sidebar: **Build → Authentication → Get started**. Under **Sign-in method**, enable **Google**.
3. **Build → Firestore Database → Create database**. Start in **production mode**, pick a region close to you.
4. **Project settings** (gear icon) → scroll to **Your apps** → click the **</>** (web) icon → register an app (nickname anything) → **do not** check "set up hosting," you don't need it. Copy the `firebaseConfig` object it gives you.

## 2. Drop in your config

Open `js/firebase-config.js` and replace the placeholder object with the real values from step 1:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

## 3. Lock down Firestore (recommended)

Since this is just for the two of you, restrict reads/writes to signed-in users only, and
optionally to just your two email addresses. In Firestore → **Rules**, use:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAllowed() {
      return request.auth != null &&
        request.auth.token.email in ['you@gmail.com', 'spencer@gmail.com'];
    }
    match /{document=**} {
      allow read, write: if isAllowed();
    }
  }
}
```

Swap in your real Gmail addresses (the ones you'll use for Google sign-in) and hit **Publish**.
Without this, any signed-in Google user could technically read/write your data once they knew
the project's public config — this rule closes that.

## 4. Authorize your GitHub Pages domain

Firebase Auth only allows sign-in from domains you've approved. In **Authentication → Settings
→ Authorized domains**, add your GitHub Pages domain, e.g. `yourusername.github.io`.

## 5. Deploy to GitHub Pages

```bash
cd golf-tracker
git init
git add .
git commit -m "Two off the tee"
git branch -M main
git remote add origin https://github.com/YOURUSERNAME/two-off-the-tee.git
git push -u origin main
```

Then in the repo on GitHub: **Settings → Pages → Source: Deploy from a branch → main / (root)**.
Your app will be live at `https://YOURUSERNAME.github.io/two-off-the-tee/` within a minute or two.

## First run

1. Open the site, click **Sign in with Google** — you'll each be asked for a display name the
   first time (this is what shows on the leaderboard).
2. Go to **Log a Round**, set the date/course/formats, click **Start round** — the URL now has
   `?round=...` in it. Send that link to Spencer (or he can just open **Log a Round** and see it
   under "Rounds in progress"), and you can both enter hole scores live from your own phones.
3. **Solo Rounds** works the same way independently — click the map or search a course name to
   drop a pin, log your score, and it stacks up on the shared map over the season.

## Notes / easy tweaks

- Handicap strokes are now calculated automatically. Each of you sets your **Handicap Index**
  once via the "HCP" chip next to your name (top right of the header) — it's saved to your
  profile and reused for every round. Each course stores a **Course Rating**, **Slope Rating**,
  and a **Handicap Allocation** (the 1–18 "hardest to easiest hole" row from the real scorecard).
  When you start a round, the app computes each player's Course Handicap
  (`Index × Slope/113 + (Rating − Par)`, standard WHS formula) and gives the higher-handicap
  player strokes on that many of the hardest holes — same idea real clubs use for match-play
  net scoring. The small red number under each score box is the computed stroke count; edit it
  directly on any hole if you want to override (concessions, a different tee box that day, etc.).
  If either player hasn't set an Index yet, strokes default to 0 and you can still enter them
  by hand.
- Stableford scoring uses standard net points (bogey=1, par=2, birdie=3, eagle=4, albatross+=5,
  double-bogey-or-worse=0) — tweak the table in `js/games.js` if you play a house variant.
- Want more formats (Wolf, Vegas, Bingo Bango Bongo)? `js/games.js` is where each format's
  scoring logic lives — easy to add another function and wire it into the checkboxes.
