// ── Offline Sync Queue ────────────────────────────────────────
// Internet بند ہو تو operations queue میں save ہوتی ہیں
// Internet واپس آنے پر خودبخود sync ہوتی ہیں

import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'timber360_sync_queue';

// ── Queue میں operation add کریں ─────────────────────────────
export const enqueueOp = async (op) => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    // Duplicate check: ایک ہی id کی پرانی entry ہٹائیں
    const filtered = queue.filter(
      item => !(item.col === op.col && item.id === op.id && item.type === op.type)
    );
    filtered.push({ ...op, queuedAt: Date.now() });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.log('enqueueOp:', e.message);
  }
};

// ── Queue پڑھیں ───────────────────────────────────────────────
export const getQueue = async () => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

// ── Queue صاف کریں ───────────────────────────────────────────
export const clearQueue = async () => {
  try {
    await AsyncStorage.removeItem(QUEUE_KEY);
  } catch { /* silent */ }
};

// ── ایک operation queue سے ہٹائیں ────────────────────────────
export const removeFromQueue = async (col, id, type) => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    const updated = queue.filter(
      item => !(item.col === col && item.id === id && item.type === type)
    );
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
  } catch { /* silent */ }
};

// ── Queue کا size ─────────────────────────────────────────────
export const getQueueSize = async () => {
  const q = await getQueue();
  return q.length;
};
