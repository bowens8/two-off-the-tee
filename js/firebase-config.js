// ============================================================
// FIREBASE CONFIG — replace with your own project's values.
// Firebase Console → Project settings → General → Your apps → SDK setup
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, getDocs, addDoc, updateDoc,
  onSnapshot, query, where, orderBy, limit, serverTimestamp, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDrGZfoEk3EWc3hnF935zRE5b76F_SBcJ4",
  authDomain: "two-off-the-tee.firebaseapp.com",
  projectId: "two-off-the-tee",
  storageBucket: "two-off-the-tee.firebasestorage.app",
  messagingSenderId: "7261963719",
  appId: "1:7261963719:web:26bc5fd0cf7fc3138905e2",
  measurementId: "G-XVD0BZQC9N"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export {
  app, auth, db, googleProvider,
  signInWithPopup, signOut, onAuthStateChanged,
  collection, doc, setDoc, getDoc, getDocs, addDoc, updateDoc,
  onSnapshot, query, where, orderBy, limit, serverTimestamp, deleteDoc
};
