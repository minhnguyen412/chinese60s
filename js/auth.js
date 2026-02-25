// auth.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 🔥 1. Firebase config (đổi thành của mày)
const firebaseConfig = { 
  apiKey: "AIzaSyAm-qQrpXKNdqFLITRAGCug7rkskGzyAkg", 
  authDomain: "chinese60s.firebaseapp.com", 
  projectId: "chinese60s", 
  storageBucket: "chinese60s.firebasestorage.app", 
  messagingSenderId: "835657861121", 
  appId: "1:835657861121:web:f31727eb7ea3b876a5d800", 
  measurementId: "G-70NQ4PFTSN" 
};

// 🔥 2. Init
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const provider = new GoogleAuthProvider();


// =========================
// 🔵 LOGIN
// =========================
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // 🔥 Kiểm tra user đã tồn tại chưa
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      // Nếu chưa có thì tạo mới
      await setDoc(userRef, {
        name: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        createdAt: serverTimestamp(),
        totalScore: 0,
        totalQuizzes: 0,
        totalWriting: 0,
        totalSpeaking: 0,
        totalStudyTime: 0
      });
    }

    return user;

  } catch (error) {
    console.error("Login error:", error);
  }
}


// =========================
// 🔴 LOGOUT
// =========================
export async function logoutUser() {
  await signOut(auth);
}


// =========================
// 🟢 LISTEN LOGIN STATE
// =========================
export function listenAuthState(callback) {
  onAuthStateChanged(auth, (user) => {
    callback(user);
  });
}
