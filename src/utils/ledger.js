// ── CENTRAL LEDGER BALANCE ENGINE v2 — exact port from HTML ─
//
// TRANSACTION RULES:
//   Debit  → always increases balance
//   Credit → valid if:
//     method = 'Cash'    → always valid
//     method = 'Cheque'  → valid if chequeStatus !== 'returned'
//                          (pending = مائنس ہوگا، returned = واپس آئے گا)
//     method = undefined → always valid (manual cash-in)

export const safeParseAmount = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  const cleaned = String(val).replace(/,/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) || !isFinite(n) ? 0 : Math.abs(n) === 0 ? 0 : n;
};

export const LEDGER_SORT = (a, b) => {
  const dA = new Date(a.date), dB = new Date(b.date);
  if (dA - dB !== 0) return dA - dB;
  if (a.createdAt && b.createdAt) {
    const cA = Number(a.createdAt), cB = Number(b.createdAt);
    if (cA !== cB) return cA - cB;
  }
  if (a.type === 'Debit'  && b.type === 'Credit') return -1;
  if (a.type === 'Credit' && b.type === 'Debit')  return  1;
  return String(a.id || '').localeCompare(String(b.id || ''));
};

export const isCreditEffective = (tx) => {
  if (tx.type !== 'Credit') return false;
  const method = (tx.method || '').toLowerCase();
  if (method === 'cheque') {
    // returned چیک کی Credit غیر مؤثر ہے (واپس آ گیا)
    // pending اور cleared دونوں balance کم کرتے ہیں
    return tx.chequeStatus !== 'returned';
  }
  // Cash, manual, undefined → always effective
  return true;
};

export const dedupLedger = (ledger) => {
  const seen = new Set();
  return (ledger || []).filter(tx => {
    const key = String(tx.id || '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// options: { upToBillId, useEffective }
export const calculateLedgerBalance = (ledger, options = {}) => {
  const { upToBillId = null, useEffective = false } = options;

  const safe = dedupLedger(ledger).filter(tx =>
    tx && tx.date && tx.type &&
    (tx.type === 'Debit' || tx.type === 'Credit') &&
    safeParseAmount(tx.amount) >= 0
  );
  const sorted = [...safe].sort(LEDGER_SORT);

  let previousBalance = 0;
  if (upToBillId !== null) {
    const billIndex = sorted.findIndex(tx => String(tx.id) === String(upToBillId));
    const calcUpTo  = billIndex >= 0 ? billIndex : 0;
    for (let i = 0; i < calcUpTo; i++) {
      const tx  = sorted[i];
      const amt = safeParseAmount(tx.amount);
      const skip = useEffective && tx.type === 'Credit' && !isCreditEffective(tx);
      if (!skip) previousBalance += tx.type === 'Debit' ? amt : -amt;
    }
  }

  let running = 0;
  const withBal = sorted.map(tx => {
    const amt  = safeParseAmount(tx.amount);
    const skip = useEffective && tx.type === 'Credit' && !isCreditEffective(tx);
    if (!skip) running += tx.type === 'Debit' ? amt : -amt;
    return { ...tx, currentBal: running, _skipped: skip };
  });

  return { sortedLedger: withBal, previousBalance, finalBalance: running };
};
