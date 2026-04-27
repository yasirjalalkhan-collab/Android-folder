// ── Timber 360 Helper Functions — exact port from HTML ──────

export const generateId = (prefix = '') =>
  `${prefix}${Math.random().toString(36).substr(2, 9)}`;

export const normalizePhone = (phone) => {
  if (!phone) return '';
  let p = phone.toString().replace(/\D/g, '');
  if (p.startsWith('92')) p = p.substring(2);
  if (p.startsWith('0'))  p = p.substring(1);
  return p;
};

export const formatMoney = (amount, currencyCode = 'PKR') => {
  const val = parseFloat(amount) || 0;
  const sym = currencyCode === 'USD' ? '$' : currencyCode === 'EUR' ? '€' : 'Rs.';
  return `${sym} ${val.toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

// ── Compact format — ledger narrow columns کے لیے ────────────
// 100,000    → 1.0L
// 10,000,000 → 1.0Cr
// 1,000,000,000 → 100Cr
export const formatMoneyCompact = (amount, currencyCode = 'PKR') => {
  const val = parseFloat(amount) || 0;
  const sym = currencyCode === 'USD' ? '$' : currencyCode === 'EUR' ? '€' : 'Rs.';
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 10_000_000) {
    const cr = abs / 10_000_000;
    return `${sign}${sym}${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(1)}Cr`;
  }
  if (abs >= 100_000) {
    const lac = abs / 100_000;
    return `${sign}${sym}${lac % 1 === 0 ? lac.toFixed(0) : lac.toFixed(1)}L`;
  }
  return `${sign}${sym} ${abs.toLocaleString('en', { maximumFractionDigits: 0 })}`;
};

export const formatDate = (dateString) => {
  if (!dateString) return '-';
  const d = new Date(dateString);
  return isNaN(d.getTime()) ? '-'
    : d.toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const formatInchesToFt = (inches) => {
  const val = parseFloat(inches) || 0;
  const ft  = Math.floor(val / 12);
  const rem = val % 12;
  return ft > 0 ? `${ft}' ${rem > 0 ? rem + '"' : ''}` : `${val}"`;
};

export const getNextInvoiceId = (invoices) => {
  if (!invoices || invoices.length === 0) return '1000';
  const maxId = invoices.reduce((max, inv) => {
    const num = parseInt(String(inv.id).replace(/\D/g, ''));
    return !isNaN(num) && num > max ? num : max;
  }, 0);
  return maxId > 0 ? String(maxId + 1) : '1000';
};

export const getWaLink = (mobile, customerName = '', balance = 0, currency = 'PKR') => {
  if (!mobile) return '';
  let m = mobile.toString().replace(/[^0-9+]/g, '');
  if (m.startsWith('0')) m = '92' + m.substring(1);
  let message = '';
  if (customerName && balance > 0) {
    message = `?text=Dear ${customerName},%0A%0A`
      + `This is a gentle reminder regarding your account balance:%0A`
      + `Outstanding: ${formatMoney(balance, currency)}%0A%0A`
      + `Thank you for your business!`;
  }
  return `https://wa.me/${m.replace('+', '')}${message}`;
};

export const todayISO = () => new Date().toISOString().split('T')[0];
