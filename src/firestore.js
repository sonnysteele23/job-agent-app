import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

/* ─── User Resume ─── */
export async function saveUserResume(uid, data) {
  await setDoc(doc(db, 'users', uid, 'data', 'resume'), {
    parsed: data.parsed || null,
    assessment: data.assessment || null,
    rawText: data.rawText || '',
    fileName: data.fileName || '',
    rewrite: data.rewrite || null,
    updatedAt: new Date().toISOString(),
  });
}

export async function loadUserResume(uid) {
  const snap = await getDoc(doc(db, 'users', uid, 'data', 'resume'));
  return snap.exists() ? snap.data() : null;
}

/* ─── Application State (statuses, cover letters) ─── */
export async function saveUserJobs(uid, jobStates) {
  await setDoc(doc(db, 'users', uid, 'data', 'jobs'), {
    states: jobStates,
    updatedAt: new Date().toISOString(),
  });
}

export async function loadUserJobs(uid) {
  const snap = await getDoc(doc(db, 'users', uid, 'data', 'jobs'));
  return snap.exists() ? snap.data().states || {} : {};
}
