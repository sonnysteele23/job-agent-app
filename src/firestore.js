import { db } from './firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';

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

/* ─── Shared Job Listings (from Firestore) ─── */
export async function loadJobsFromFirestore() {
  try {
    // Load metadata
    const metaSnap = await getDoc(doc(db, 'jobs', 'meta'));
    if (!metaSnap.exists()) return null;
    const meta = metaSnap.data();

    // Load chunk count
    const chunksSnap = await getDoc(doc(db, 'jobs', 'chunks'));
    if (!chunksSnap.exists()) return null;
    const chunkCount = chunksSnap.data().count;

    // Load all job chunks
    const allJobs = [];
    for (let i = 0; i < chunkCount; i++) {
      const chunkSnap = await getDoc(doc(db, 'jobs', `chunk_${i}`));
      if (chunkSnap.exists()) {
        allJobs.push(...(chunkSnap.data().jobs || []));
      }
    }

    return { ...meta, jobs: allJobs };
  } catch (e) {
    console.error('Failed to load jobs from Firestore:', e);
    return null;
  }
}
