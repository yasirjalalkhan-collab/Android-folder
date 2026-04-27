// ── Firebase v10 — Timber 360 ────────────────────────────────
import { initializeApp, getApps } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence,
  getAuth,
} from 'firebase/auth';
import { getFirestore, enableNetwork, disableNetwork } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey:            'AIzaSyCGpLxD7RUOOtkW_aB9NniIZQAsOFIJAxk',
  authDomain:        'timber-360.firebaseapp.com',
  projectId:         'timber-360',
  storageBucket:     'timber-360.firebasestorage.app',
  messagingSenderId: '264126565972',
  appId:             '1:264126565972:web:d974b78ed8a5f2114427c1',
};

let app, auth, db;

if (!getApps().length) {
  app  = initializeApp(firebaseConfig);
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
  db   = getFirestore(app);
  // React Native میں Firestore offline persistence automatically کام کرتی ہے
  // AsyncStorage-backed auth کی وجہ سے offline میں cached data ملتا ہے
} else {
  app  = getApps()[0];
  auth = getAuth(app);
  db   = getFirestore(app);
}

export { app, auth, db, enableNetwork, disableNetwork };
