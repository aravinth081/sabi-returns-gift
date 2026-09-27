// src/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyA2zPg2iKK5oTYqctmqQt3N5wUNOoZ8Kp8",
  authDomain: "sabireturngifts-4d5ae.firebaseapp.com",
  projectId: "sabireturngifts-4d5ae",
  storageBucket: "sabireturngifts-4d5ae.firebasestorage.app",
  messagingSenderId: "414247562076",
  appId: "1:414247562076:web:cca1d1ce00849d851cef99"
};

// Singleton App Instance to prevent duplicate WebSocket connections and memory leaks
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Singleton Firestore instance
export const db = getFirestore(app);