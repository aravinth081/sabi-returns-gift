// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // Ithu database-kaga add pandrom

// Unga Database Secret Keys
const firebaseConfig = {
  apiKey: "AIzaSyA2zPg2iKK5oTYqctmqQt3N5wUNOoZ8Kp8",
  authDomain: "sabireturngifts-4d5ae.firebaseapp.com",
  projectId: "sabireturngifts-4d5ae",
  storageBucket: "sabireturngifts-4d5ae.firebasestorage.app",
  messagingSenderId: "414247562076",
  appId: "1:414247562076:web:cca1d1ce00849d851cef99"
};

// Firebase-a start pandrom
const app = initializeApp(firebaseConfig);

// Database-a export pandrom (Itha vachi thaan namma data save pannuvom)
export const db = getFirestore(app);