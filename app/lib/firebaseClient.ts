// lib/firebaseClient.ts
import { initializeApp, getApps, getApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: "AIzaSyCMbC5f6vAFufLN-_F72iXvVhEugalzDfo",
  authDomain: "procom-fea80.firebaseapp.com",
  projectId: "procom-fea80",
  storageBucket: "procom-fea80.firebasestorage.app",
  messagingSenderId: "615102362600",
  appId: "1:615102362600:web:f3bd9a2b0dd687053c2a5d",
  measurementId: "G-8J2XCMF9D1"
};

export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
