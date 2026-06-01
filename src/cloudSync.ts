import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Firestore, doc, getFirestore, onSnapshot, setDoc } from 'firebase/firestore';
import { FirebasePublicConfig } from './types';
import { applyLocalStateSnapshot, getLocalStateSnapshot, LocalStateSnapshot } from './persistence';

const APP_PREFIX = 'roster-sync';
const COLLECTION_NAME = 'rosterSync';
const DOCUMENT_ID = 'main';

function isConfigComplete(config: FirebasePublicConfig | null): config is FirebasePublicConfig {
  return !!config && !!config.apiKey && !!config.authDomain && !!config.projectId && !!config.appId;
}

function getFirebaseApp(config: FirebasePublicConfig): FirebaseApp {
  const appName = `${APP_PREFIX}-${config.projectId}`;
  const existing = getApps().find((app) => app.name === appName);
  if (existing) return existing;
  return initializeApp(config, appName);
}

function getDatabase(config: FirebasePublicConfig): Firestore {
  return getFirestore(getFirebaseApp(config));
}

export function canUseCloudSync(config: FirebasePublicConfig | null, cloudEnabled: boolean) {
  return cloudEnabled && isConfigComplete(config);
}

export async function pushLocalStateToCloud(config: FirebasePublicConfig | null, cloudEnabled: boolean) {
  if (!canUseCloudSync(config, cloudEnabled) || !config) return;

  const db = getDatabase(config);
  const snapshot = getLocalStateSnapshot();
  await setDoc(doc(db, COLLECTION_NAME, DOCUMENT_ID), {
    ...snapshot,
    updatedAt: Date.now(),
  });
}

export function subscribeToCloudState(
  config: FirebasePublicConfig | null,
  cloudEnabled: boolean,
  onStatus?: (status: 'local' | 'connected' | 'error') => void,
) {
  if (!canUseCloudSync(config, cloudEnabled) || !config) {
    onStatus?.('local');
    return () => undefined;
  }

  try {
    const db = getDatabase(config);
    const unsubscribe = onSnapshot(
      doc(db, COLLECTION_NAME, DOCUMENT_ID),
      (snapshot) => {
        if (snapshot.exists()) {
          applyLocalStateSnapshot(snapshot.data() as Partial<LocalStateSnapshot>);
        }
        onStatus?.('connected');
      },
      () => {
        onStatus?.('error');
      },
    );

    return unsubscribe;
  } catch {
    onStatus?.('error');
    return () => undefined;
  }
}
