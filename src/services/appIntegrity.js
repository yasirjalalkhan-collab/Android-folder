// ── App Integrity Check ──────────────────────────────────────
// مقصد: اگر کوئی APK decompile کر کے اپنا Firebase لگائے
// تو وہ ہمارے Firebase سے license verify نہیں کر سکے گا
// اور ہمارے users کو ہمارے Firebase کی طرف point کرتی رہے گی

import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

// ── Expected project ID — runtime check ──────────────────────
// یہ hard-coded ہے — decompile کرنے والا اپنا projectId لگائے گا
// لیکن وہ ہمارے Firestore میں license document نہیں بنا سکتا
const EXPECTED_PROJECT = ['timber', '-360'].join('');

export const checkAppIntegrity = async () => {
  try {
    // ہمارے Firestore میں license document check کریں
    // Firebase Console → Firestore → appConfig/license بنائیں:
    // { valid: true, version: "1.0", projectId: "timber-360" }
    const snap = await getDoc(doc(db, 'appConfig', 'license'));

    if (!snap.exists()) {
      // Document نہیں — غلط Firebase یا rules نہیں لگائیں
      return { ok: false, reason: 'license_missing' };
    }

    const data = snap.data();

    // Project ID match check
    if (data.projectId !== EXPECTED_PROJECT) {
      return { ok: false, reason: 'project_mismatch' };
    }

    // Valid flag
    if (data.valid !== true) {
      return { ok: false, reason: 'not_valid' };
    }

    return { ok: true };
  } catch (err) {
    // Network error → allow (offline mode)
    if (err.code === 'unavailable' || err.code === 'failed-precondition') {
      return { ok: true }; // offline — allow
    }
    // Permission denied → غلط Firebase project
    if (err.code === 'permission-denied') {
      return { ok: false, reason: 'wrong_project' };
    }
    return { ok: true }; // other errors — don't block
  }
};
