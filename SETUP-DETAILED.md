# Two Off the Tee — complete step-by-step setup

This walks through everything from zero: getting the files onto GitHub, creating the
Firebase project it talks to, and the first time you and Spencer sign in. No prior
experience with either GitHub or Firebase assumed. Follow it top to bottom — don't skip
around, later steps depend on earlier ones.

**Total time:** about 20–30 minutes the first time.

**What you need before starting:**
- A Google account (Gmail is fine) — you'll use this for Firebase and to sign into the app itself.
- A GitHub account — free, sign up at https://github.com/join if you don't have one.
- The `golf-tracker` folder (unzipped) sitting somewhere on your computer.

---

## Part 1 — Put the files on GitHub

You can do this two ways. **Method A** needs no software installed and is easiest if
you've never used git. **Method B** is faster if you're comfortable with a terminal.

### Method A — upload through the GitHub website (no git required)

1. Go to https://github.com and make sure you're signed in.
2. Click the **+** icon in the top-right corner → **New repository**.
3. Under **Repository name**, type `two-off-the-tee` (or any name you like — it becomes part of your URL later).
4. Leave it set to **Public**.
5. Leave the "Add a README file" and other checkboxes **unchecked** — you're uploading your own files.
6. Click the green **Create repository** button.
7. You'll land on an empty repo page. Click **uploading an existing file** (a link in the middle of the page), or the **Add file** dropdown → **Upload files**.
8. Open the `golf-tracker` folder on your computer. Select **everything inside it** — `index.html`, `round-entry.html`, `solo-rounds.html`, `SETUP.md`, the `css` folder, and the `js` folder — and drag them all into the browser upload area at once.
   - Important: drag the *contents* of the folder in, not the `golf-tracker` folder itself. The `index.html` file needs to end up sitting directly in the root of the repo, not inside a subfolder.
9. Scroll down, leave the commit message as the default (or type "Initial upload"), and click **Commit changes**.
10. Refresh the page — you should see `index.html`, `round-entry.html`, `solo-rounds.html`, a `css` folder, and a `js` folder all listed.

Skip ahead to **Part 2**.

### Method B — using git from a terminal

1. Install git if you don't have it: https://git-scm.com/downloads
2. On GitHub, click **+** → **New repository**, name it `two-off-the-tee`, leave it **Public**, leave all checkboxes unchecked, click **Create repository**. Don't close the page that appears next — you'll need the URL it shows you.
3. Open a terminal, navigate to the folder that *contains* `golf-tracker`, then run:
   ```bash
   cd golf-tracker
   git init
   git add .
   git commit -m "Initial upload"
   git branch -M main
   git remote add origin https://github.com/YOURUSERNAME/two-off-the-tee.git
   git push -u origin main
   ```
   Replace `YOURUSERNAME` with your actual GitHub username, and the repo name if you chose something else. GitHub will prompt you to sign in the first time.

---

## Part 2 — Create the Firebase project

1. Go to https://console.firebase.google.com and sign in with your Google account.
2. Click **Add project** (or **Create a project**).
3. Type a project name, e.g. `two-off-the-tee`. Click **Continue**.
4. If asked about Google Analytics, you can turn it **off** — you don't need it. Click **Continue** / **Create project**.
5. Wait for the progress bar to finish, then click **Continue** to land in your new project's dashboard.

---

## Part 3 — Turn on Google sign-in

1. In the left-hand sidebar of the Firebase console, look for a section called **Security** (or **Build**, depending on when you're reading this — Firebase reorganizes its menu occasionally) and click **Authentication** underneath it.
   - If you don't see it in the sidebar, use the search bar at the top of the Firebase console and type "Authentication."
2. Click **Get started** (only appears the first time).
3. Click the **Sign-in method** tab near the top.
4. Click **Add new provider** (or click directly on **Google** if it's listed).
5. Toggle **Enable**.
6. It'll ask for a "Project support email" — pick your own email from the dropdown.
7. Click **Save**.

You should now see "Google" listed as an enabled sign-in provider.

---

## Part 4 — Create the Firestore database

Firestore is the database that stores your rounds, scores, and courses.

1. In the left sidebar, look under **Databases & Storage** (or **Build**) and click **Firestore Database** (sometimes just labeled **Firestore**).
2. Click **Create database**.
3. Choose **Production mode** (not "test mode" — production mode requires the security rules we'll set up in Part 7, which is what we want).
4. Pick a location close to you — this can't be changed later, but it doesn't meaningfully affect a two-person app, so any nearby region is fine.
5. Click **Create** (or **Enable**).
6. Wait for it to finish provisioning — you'll land on an empty Firestore data browser. You don't need to add anything here manually; the app creates its own data as you use it.

---

## Part 5 — Register a web app and get your config

This is the step that connects your specific Firebase project to the HTML files.

1. Click the **gear icon** ⚙️ next to "Project Overview" at the top of the left sidebar → **Project settings**.
2. Scroll down to the **Your apps** card.
3. Click the **</>** icon (it means "web app").
4. Give it a nickname — anything, e.g. `golf-tracker-web`. It doesn't need to match your GitHub repo name.
5. Leave "Also set up Firebase Hosting" **unchecked** — you're using GitHub Pages instead.
6. Click **Register app**.
7. Firebase will show you a code block that looks like this:
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "two-off-the-tee-xxxxx.firebaseapp.com",
     projectId: "two-off-the-tee-xxxxx",
     storageBucket: "two-off-the-tee-xxxxx.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef123456"
   };
   ```
   **Copy this whole block** — you'll paste it in the next step. (You can always come back to find it again later under Project settings → Your apps → the web app you just registered.)
8. Click **Continue to console**.

---

## Part 6 — Put your config into the app

Now you'll edit one file to connect the app to the Firebase project you just made.

1. On GitHub, open your repo and click into the `js` folder, then click on `firebase-config.js`.
2. Click the **pencil icon** (Edit this file) in the top-right of the file view.
3. You'll see a placeholder block near the top:
   ```js
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_PROJECT_ID.appspot.com",
     messagingSenderId: "YOUR_SENDER_ID",
     appId: "YOUR_APP_ID"
   };
   ```
4. Select that whole block and replace it with the real `firebaseConfig` block you copied in Part 5, step 7.
5. Scroll down, click **Commit changes...**, then **Commit changes** again in the popup.

*(If you'd rather edit locally: open `js/firebase-config.js` in any text editor, paste in the real values, save, then `git add . && git commit -m "Add firebase config" && git push` from Method B's terminal.)*

---

## Part 7 — Lock down the database with security rules

Right now, in production mode, Firestore blocks *everyone* — including you — until you
explicitly allow access. This step opens it up to just the two of you.

1. Back in the Firebase console, go to **Firestore Database** → the **Rules** tab (near the top, next to "Data").
2. You'll see a text editor with some default rules. Select all the text in it and replace it with:
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
3. Replace `you@gmail.com` and `spencer@gmail.com` with the actual Google account emails you and Spencer will each sign in with.
4. Click **Publish**.

---

## Part 8 — Authorize your GitHub Pages domain

Firebase Auth refuses to let anyone sign in from a web address it doesn't recognize —
by default it only trusts `localhost` and Firebase's own domains. You need to add yours.

1. In the Firebase console, go to **Authentication** → **Settings** tab → **Authorized domains**.
2. Click **Add domain**.
3. Type `YOURUSERNAME.github.io` (your actual GitHub username, not the literal word "YOURUSERNAME").
4. Click **Add**.

---

## Part 9 — Turn on GitHub Pages

1. On GitHub, go to your repository's main page.
2. Click **Settings** (top row of tabs — if you don't see it, click the **...** dropdown to find it).
3. In the left sidebar of the Settings page, click **Pages** (under "Code and automation").
4. Under **Build and deployment** → **Source**, choose **Deploy from a branch**.
5. Under **Branch**, choose `main` and leave the folder as `/ (root)`.
6. Click **Save**.
7. Wait 1–2 minutes. Refresh the Pages settings page — a banner should appear near the top saying your site is live, with a link like:
   ```
   https://YOURUSERNAME.github.io/two-off-the-tee/
   ```

---

## Part 10 — First run

1. Open that URL in your browser.
2. Click **Sign in with Google**, choose your account.
3. The first time, you'll get a browser prompt asking for your display name — this is what shows up on the leaderboard. Type your name.
4. In the top-right of the header, click the **HCP** chip and enter your current Handicap Index (e.g. `14.2`).
5. Send the same URL to Spencer. He signs in with his own Google account, sets his name and handicap the same way.
6. Go to **Log a Round**, fill in the date, course, and formats, click **Start round** — you're off. Both of you can enter hole scores at the same time from your own phones without overwriting each other.
7. **Solo Rounds** works independently any time — click the map or search a course name to drop a pin.

---

## Troubleshooting

**"Sign in with Google" does nothing, or shows a popup error about unauthorized domain**
→ You skipped or mistyped Part 8. Double-check `YOURUSERNAME.github.io` is listed exactly under Authentication → Settings → Authorized domains.

**Signed in, but nothing loads / errors in the browser console about "permission-denied"**
→ Almost always Part 7 — either the rules weren't published, or the email in the rules doesn't exactly match the Google account you signed in with (check for typos).

**The page is just blank / white**
→ Open your browser's developer console (right-click → Inspect → Console tab) and look for a red error. If it mentions `firebaseConfig` or `auth/invalid-api-key`, you likely still have the placeholder values from Part 6 in `js/firebase-config.js` — double check you pasted your real config and committed the change.

**GitHub Pages shows a 404**
→ Give it a couple more minutes after enabling Pages, then hard-refresh (Ctrl/Cmd+Shift+R). Also confirm `index.html` is sitting in the root of the repo and not nested inside an extra `golf-tracker/golf-tracker/` folder from the upload.

**You want to check your Firebase config again later**
→ Firebase console → gear icon → Project settings → scroll to "Your apps" → click your web app.
