// ── Storage — Guest + Approved User (AsyncStorage) ──────────
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Guest keys ────────────────────────────────────────────────
const GUEST_KEYS = {
  invoices:  'guest_invoices',
  customers: 'guest_customers',
  stock:     'guest_stock',
  cheques:   'guest_cheques',
  expenses:  'guest_expenses',
  settings:  'guest_settings',
  profile:   'guest_profile',
};

// ── Guest functions (موجودہ) ──────────────────────────────────
export const loadGuest = async (col) => {
  try { const r = await AsyncStorage.getItem(GUEST_KEYS[col]); return r ? JSON.parse(r) : []; }
  catch { return []; }
};
export const saveGuest = async (col, data) => {
  try { await AsyncStorage.setItem(GUEST_KEYS[col], JSON.stringify(data)); }
  catch (e) { console.error('saveGuest:', e); }
};
export const updateGuestItem = async (col, id, item) => {
  const list = await loadGuest(col);
  const idx  = list.findIndex(x => String(x.id) === String(id));
  const updated = idx > -1
    ? [...list.slice(0,idx), item, ...list.slice(idx+1)]
    : [item, ...list];
  await saveGuest(col, updated);
  return updated;
};
export const deleteGuestItem = async (col, id) => {
  const list    = await loadGuest(col);
  const updated = list.filter(x => String(x.id) !== String(id));
  await saveGuest(col, updated);
  return updated;
};
export const clearAllGuest = async () => {
  await AsyncStorage.multiRemove(Object.values(GUEST_KEYS));
};
export const loadGuestObject = async (col) => {
  try { const r = await AsyncStorage.getItem(GUEST_KEYS[col]); return r ? JSON.parse(r) : null; }
  catch { return null; }
};
export const saveGuestObject = async (col, data) => {
  try { await AsyncStorage.setItem(GUEST_KEYS[col], JSON.stringify(data)); }
  catch (e) { console.error('saveGuestObject:', e); }
};

// ── Approved User — uid-prefixed keys ─────────────────────────
// uid ہر user کا الگ ہے — data mix نہیں ہوگا
const uKey = (uid, col) => `u_${uid}_${col}`;

export const loadUserLocal = async (uid, col) => {
  try { const r = await AsyncStorage.getItem(uKey(uid, col)); return r ? JSON.parse(r) : []; }
  catch { return []; }
};
export const saveUserLocal = async (uid, col, data) => {
  try { await AsyncStorage.setItem(uKey(uid, col), JSON.stringify(data)); }
  catch (e) { console.error('saveUserLocal:', e); }
};
export const updateUserLocalItem = async (uid, col, id, item) => {
  const list = await loadUserLocal(uid, col);
  const idx  = list.findIndex(x => String(x.id) === String(id));
  const updated = idx > -1
    ? [...list.slice(0,idx), item, ...list.slice(idx+1)]
    : [item, ...list];
  await saveUserLocal(uid, col, updated);
  return updated;
};
export const deleteUserLocalItem = async (uid, col, id) => {
  const list    = await loadUserLocal(uid, col);
  const updated = list.filter(x => String(x.id) !== String(id));
  await saveUserLocal(uid, col, updated);
  return updated;
};
export const loadUserLocalObject = async (uid, col) => {
  try { const r = await AsyncStorage.getItem(uKey(uid, col)); return r ? JSON.parse(r) : null; }
  catch { return null; }
};
export const saveUserLocalObject = async (uid, col, data) => {
  try { await AsyncStorage.setItem(uKey(uid, col), JSON.stringify(data)); }
  catch (e) { console.error('saveUserLocalObject:', e); }
};
