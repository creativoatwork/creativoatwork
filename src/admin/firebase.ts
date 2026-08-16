import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  type Auth,
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

const app: FirebaseApp = initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);

// Stated rather than inherited. The SDK default is already local persistence, but leaving that
// implicit means a future SDK version could silently change how long a session survives.
export const persistenceReady = setPersistence(auth, browserLocalPersistence);

// Development writes go to the emulator, never to the live database. Auth deliberately stays
// against the real project so the actual sign-in path is exercised in dev.
if (import.meta.env.DEV) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
