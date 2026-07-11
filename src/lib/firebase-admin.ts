import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const config = firebaseConfig as any;

if (!getApps().length) {
  const projectId = config?.projectId || process.env.GOOGLE_CLOUD_PROJECT || 'aura-dating-app';
  initializeApp({
    projectId,
  });
}

export const adminAuth = getAuth();
