import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot,
  getDocFromServer,
  writeBatch,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import { Trade, Settings } from '../types/trade';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with specific database ID as required
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth(app);
export const storage = getStorage(app);

// Google Auth Provider configured for popup authentication
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connectivity test as required by skill guidelines
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client appears offline.');
    }
    return false;
  }
}

// Authentication Helpers
export async function signInWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error('Error in signInWithPopup:', error);
    // Ignore user closed popup errors gracefully
    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      return null;
    }
    throw error;
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// Real-time Firestore Subscriptions
export function subscribeToTrades(
  userId: string,
  onUpdate: (trades: Trade[]) => void,
  onError?: (error: Error) => void
) {
  const tradesCollectionPath = `users/${userId}/trades`;
  const tradesRef = collection(db, 'users', userId, 'trades');

  return onSnapshot(
    tradesRef,
    (snapshot) => {
      const items: Trade[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Trade;
        items.push({
          ...data,
          id: docSnap.id,
        });
      });
      // Sort newest date and time first
      items.sort((a, b) => {
        const dateCompare = (b.date || '').localeCompare(a.date || '');
        if (dateCompare !== 0) return dateCompare;
        return (b.time || '').localeCompare(a.time || '');
      });
      onUpdate(items);
    },
    (error) => {
      console.error('Snapshot listener error on trades:', error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, tradesCollectionPath);
    }
  );
}

// Single Trade Save/Update
export async function saveTradeToFirestore(userId: string, trade: Trade): Promise<void> {
  const path = `users/${userId}/trades/${trade.id}`;
  try {
    const tradeRef = doc(db, 'users', userId, 'trades', trade.id);
    const payload: Trade = {
      ...trade,
      userId,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(tradeRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Delete Trade
export async function deleteTradeFromFirestore(userId: string, tradeId: string): Promise<void> {
  const path = `users/${userId}/trades/${tradeId}`;
  try {
    const tradeRef = doc(db, 'users', userId, 'trades', tradeId);
    await deleteDoc(tradeRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Safe Migration: Synchronize local trades into Firestore without duplication
export async function syncLocalTradesToFirestore(
  userId: string,
  localTrades: Trade[]
): Promise<{ syncedCount: number }> {
  if (!localTrades.length) return { syncedCount: 0 };

  const batch = writeBatch(db);
  let count = 0;

  for (const trade of localTrades) {
    // Only migrate if it has an id
    if (!trade.id) continue;
    const docRef = doc(db, 'users', userId, 'trades', trade.id);
    batch.set(
      docRef,
      {
        ...trade,
        userId,
        updatedAt: trade.updatedAt || new Date().toISOString(),
      },
      { merge: true }
    );
    count++;
  }

  const path = `users/${userId}/trades`;
  try {
    await batch.commit();
    return { syncedCount: count };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Settings Synchronization
export async function saveSettingsToFirestore(userId: string, settings: Settings): Promise<void> {
  const path = `users/${userId}/settings/preferences`;
  try {
    const settingsRef = doc(db, 'users', userId, 'settings', 'preferences');
    await setDoc(
      settingsRef,
      {
        ...settings,
        userId,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchSettingsFromFirestore(userId: string): Promise<Settings | null> {
  const path = `users/${userId}/settings/preferences`;
  try {
    const settingsRef = doc(db, 'users', userId, 'settings', 'preferences');
    const snap = await getDoc(settingsRef);
    if (snap.exists()) {
      return snap.data() as Settings;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}
