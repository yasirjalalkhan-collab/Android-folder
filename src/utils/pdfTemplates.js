// ── PDF HTML Templates — expo-print کے لیے ─────────────────
import { calculateLedgerBalance, safeParseAmount } from './ledger';
import { formatMoney, formatDate } from './helpers';

// ── Invoice PDF HTML ────────────────────────────────────────
export const buildInvoiceHTML = (invoice, profile, settings, customers) => {
  const items    = invoice.items || [];
  const customer = invoice.customer || {};

  // ── Groups: Custom بھی اب شامل ───────────────────────────
  const groups = {
    DOOR:   items.filter(i => i.unit === 'Sq.Ft'),
    WOOD:   items.filter(i => i.unit === 'Cu.Ft'),
    PLY:    items.filter(i => i.unit !== 'Cu.Ft' && i.unit !== 'Sq.Ft' && i.type !== 'custom'),
    CUSTOM: items.filter(i => i.type === 'custom'),
  };

  const currentCust = (customers || []).find(c => String(c.id) === String(customer.id)) || customer;
  const { previousBalance } = calculateLedgerBalance(
    currentCust.ledger,
    { upToBillId: 'bill-' + invoice.id, useEffective: true }
  );

  const cashPaid   = safeParseAmount(invoice.cashPaid);
  const chequeList = invoice.cheques || [];
  const chqAmt     = chequeList.filter(c => c.status === 'cleared')
                       .reduce((a, c) => a + safeParseAmount(c.amount), 0);
  const netPayable = previousBalance + safeParseAmount(invoice.total) - cashPaid - chqAmt;
  const invoiceNum = profile.invoicePrefix
    ? `${profile.invoicePrefix}-${invoice.id}`
    : invoice.id;

  // ── Standard group (Door/Wood/Ply) ───────────────────────
  const groupHTML = (title, unit, data) => {
    if (!data.length) return '';
    const rows = data.map(item => {
      const meas = ((item.qtyUnit || 0) * (item.qty || 0)).toFixed(2);
      const amt  = (item.amount || 0) * (item.qty || 0);
      return `
        <tr>
          <td><strong>${item.name}</strong></td>
          <td style="text-align:center;color:#94a3b8;font-size:10px">${item.displaySize || ''}</td>
          <td style="text-align:center;font-weight:700">${item.qty}</td>
          <td style="text-align:center">${meas} ${item.unit}</td>
          <td style="text-align:right">${item.rate || 0}</td>
          <td style="text-align:right"><strong>${formatMoney(amt, settings.currency)}</strong></td>
        </tr>`;
    }).join('');
    const totQty  = data.reduce((a, i) => a + (i.qty || 0), 0);
    const totMeas = data.reduce((a, i) => a + (i.qtyUnit || 0) * (i.qty || 0), 0);
    const totAmt  = data.reduce((a, i) => a + (i.amount || 0) * (i.qty || 0), 0);
    return `
      <tr><td colspan="6" style="background:#f1f5f9;padding:6px 10px;font-weight:800;color:#1e293b;font-size:13px">${title}</td></tr>
      ${rows}
      <tr style="background:#f8fafc">
        <td><strong>Total ${title}</strong></td>
        <td></td>
        <td style="text-align:center"><strong>${totQty}</strong></td>
        <td style="text-align:center"><strong>${totMeas.toFixed(2)} ${unit}</strong></td>
        <td></td>
        <td style="text-align:right"><strong>${formatMoney(totAmt, settings.currency)}</strong></td>
      </tr>`;
  };

  // ── Custom group: تعداد × ریٹ = رقم ─────────────────────
  const customGroupHTML = (data) => {
    if (!data.length) return '';
    const rows = data.map(item => {
      const amt = (item.amount || item.rate || 0) * (item.qty || 0);
      return `
        <tr>
          <td><strong>${item.name}</strong></td>
          <td style="text-align:center">${item.qty} ${item.customUnit || 'pcs'}</td>
          <td style="text-align:center">—</td>
          <td style="text-align:right">${formatMoney(item.rate || item.amount || 0, settings.currency)}</td>
          <td style="text-align:right"><strong>${formatMoney(amt, settings.currency)}</strong></td>
        </tr>`;
    }).join('');
    const totQty = data.reduce((a, i) => a + (i.qty || 0), 0);
    const totAmt = data.reduce((a, i) => a + (i.amount || i.rate || 0) * (i.qty || 0), 0);
    return `
      <tr>
        <td colspan="6" style="background:#4f46e5;padding:6px 10px;font-weight:800;color:#fff;font-size:13px">
          ✏️ Custom Items
        </td>
      </tr>
      ${rows}
      <tr style="background:#eef2ff">
        <td colspan="2"><strong>Total Custom</strong></td>
        <td style="text-align:center;color:#4f46e5"><strong>${totQty} pcs</strong></td>
        <td></td>
        <td></td>
        <td style="text-align:right;color:#4f46e5"><strong>${formatMoney(totAmt, settings.currency)}</strong></td>
      </tr>`;
  };

  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Arial,sans-serif; font-size:12px; color:#1e293b; padding:20px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; padding-bottom:12px; border-bottom:2px solid #e2e8f0; }
  .biz-name { font-size:22px; font-weight:900; color:#1B6B3A; }
  .biz-info  { font-size:11px; color:#64748b; margin-top:2px; }
  .inv-label { font-size:20px; font-weight:900; color:#e2e8f0; text-align:right; }
  .inv-id    { font-size:14px; font-weight:800; text-align:right; }
  .inv-date  { font-size:11px; color:#64748b; text-align:right; }
  .cust-box  { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:16px; }
  .cust-label{ font-size:9px; text-transform:uppercase; color:#94a3b8; font-weight:800; margin-bottom:4px; }
  .cust-name { font-size:16px; font-weight:800; }
  table { width:100%; border-collapse:collapse; margin-bottom:16px; }
  th { background:#1e293b; color:#fff; padding:7px 10px; font-size:11px; }
  td { padding:6px 10px; border-bottom:1px solid #f1f5f9; font-size:11px; }
  .pay-box   { float:right; width:240px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px; }
  .pay-row   { display:flex; justify-content:space-between; margin-bottom:6px; font-size:12px; }
  .net-row   { display:flex; justify-content:space-between; padding-top:10px; border-top:2px solid #1e293b; font-size:15px; font-weight:900; }
  .footer    { margin-top:40px; text-align:center; font-size:10px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:10px; }
  .sig-line  { margin-top:30px; }
  .sig-rule  { border-top:1px solid #94a3b8; width:160px; margin-top:30px; }
  .sig-label { font-size:10px; color:#94a3b8; margin-top:4px; }
</style>
</head><body>
<div class="header">
  <div style="display:flex;align-items:flex-start;gap:12px">
    ${profile.logo ? `<img src="${profile.logo}" style="width:64px;height:64px;object-fit:contain;border-radius:8px" alt="logo"/>` : ''}
    <div>
      <div class="biz-name">${profile.name || 'Timber 360'}</div>
      <div class="biz-info">${profile.ownerName || ''}</div>
      <div class="biz-info">${profile.address || ''}</div>
      <div class="biz-info" style="color:#f97316;font-weight:700">${profile.phone || ''}</div>
    </div>
  </div>
  <div>
    <div class="inv-label">INVOICE</div>
    <div class="inv-id">#${invoiceNum}</div>
    <div class="inv-date">${formatDate(invoice.date)}</div>
  </div>
</div>

<div class="cust-box">
  <div class="cust-label">Bill To</div>
  <div class="cust-name">${customer.name || ''}</div>
  <div style="font-size:11px;color:#64748b;margin-top:2px">${customer.mobile || ''}</div>
  <div style="font-size:11px;color:#64748b">${customer.address || ''}</div>
</div>

<table>
  <thead><tr>
    <th style="text-align:left">Item</th>
    <th style="text-align:center">Size</th>
    <th style="text-align:center">Qty</th>
    <th style="text-align:center">Measurement</th>
    <th style="text-align:right">Rate</th>
    <th style="text-align:right">Amount</th>
  </tr></thead>
  <tbody>
    ${groupHTML('Door & Skin', 'Sq.Ft', groups.DOOR)}
    ${groupHTML('Wood / Timber', 'Cu.Ft', groups.WOOD)}
    ${groupHTML('Plywood', 'Sheet', groups.PLY)}
    ${customGroupHTML(groups.CUSTOM)}
  </tbody>
</table>

<div style="overflow:hidden">
  <div class="pay-box">
    ${previousBalance > 0 ? `<div class="pay-row"><span>Previous Balance</span><span style="color:#d97706;font-weight:700">${formatMoney(previousBalance, settings.currency)}</span></div>` : ''}
    <div class="pay-row"><strong>Total</strong><strong style="color:#16a34a">${formatMoney(invoice.total, settings.currency)}</strong></div>
    ${cashPaid > 0 ? `<div class="pay-row"><span>Cash Paid</span><span style="color:#16a34a">-${formatMoney(cashPaid, settings.currency)}</span></div>` : ''}
    ${chequeList.map(c => `<div class="pay-row" style="font-size:10px"><span>Cheque: ${c.bank} #${c.number} (${c.status})</span><span style="color:${c.status === 'cleared' ? '#16a34a' : '#d97706'}">-${formatMoney(c.amount, settings.currency)}</span></div>`).join('')}
    <div class="net-row"><span style="color:#dc2626">Net Payable</span><span style="color:#dc2626">${formatMoney(netPayable, settings.currency)}</span></div>
  </div>
  <div class="sig-line">
    <div style="font-size:11px;font-weight:700;color:#64748b">Authorized Signature:</div>
    <div style="font-size:12px;margin-top:4px">${profile.ownerName || ''}</div>
    <div class="sig-rule"></div>
    <div class="sig-label">Signature</div>
  </div>
</div>

<div class="footer">${profile.footer || 'Thank you for your business!'}</div>
</body></html>`;
};

// ── Ledger PDF HTML ────────────────────────────────────────
export const buildLedgerHTML = (customer, filteredLedger, allLedger, startDate, endDate, settings, profile) => {
  const totalDebits  = allLedger.reduce((a, t) => a + (t.type === 'Debit'  ? safeParseAmount(t.amount) : 0), 0);
  const totalCredits = allLedger.reduce((a, t) => a + (t.type === 'Credit' && !t._skipped ? safeParseAmount(t.amount) : 0), 0);
  const closingBal   = totalDebits - totalCredits;

  // Opening balance: filter سے پہلے کا بقایا
  let openingBalance = 0;
  if (startDate && filteredLedger.length > 0) {
    // اگر filteredLedger میں _isOpening row ہے تو اس سے لیں
    const openRow = filteredLedger.find(t => t._isOpening);
    if (openRow) {
      openingBalance = openRow.currentBal || 0;
    } else {
      const firstIdx = allLedger.findIndex(t => t.id === filteredLedger[0]?.id);
      if (firstIdx > 0) openingBalance = allLedger[firstIdx - 1].currentBal || 0;
    }
  }

  // _isOpening row کو rows سے نکالیں — وہ الگ دکھائیں
  const ledgerToShow = (filteredLedger.length > 0 ? filteredLedger : allLedger)
    .filter(tx => !tx._isOpening);

  const rows = ledgerToShow.map((tx, i) => `
    <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}">
      <td>${formatDate(tx.date)}</td>
      <td>${(tx.desc || '').substring(0, 35)}</td>
      <td style="text-align:right;color:${tx.type==='Debit'?'#dc2626':'#94a3b8'}">${tx.type === 'Debit' ? formatMoney(tx.amount, '') : '-'}</td>
      <td style="text-align:right;color:${tx.type==='Credit'&&!tx._skipped?'#16a34a':'#94a3b8'}">${tx.type === 'Credit' && !tx._skipped ? formatMoney(tx.amount, '') : tx._skipped ? '⏳' : '-'}</td>
      <td style="text-align:right;font-weight:700;color:${(tx.currentBal||0)>0?'#d97706':(tx.currentBal||0)<0?'#dc2626':'#16a34a'}">${formatMoney(tx.currentBal || 0, settings.currency)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Arial,sans-serif; font-size:12px; color:#1e293b; padding:20px; }
  .header { text-align:center; margin-bottom:16px; padding-bottom:12px; border-bottom:2px solid #e2e8f0; }
  .biz-name { font-size:20px; font-weight:900; color:#1B6B3A; }
  .title { font-size:16px; font-weight:800; color:#4f46e5; margin:8px 0; }
  .cust-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:16px; display:flex; justify-content:space-between; }
  .bal-box  { display:flex; gap:16px; margin-bottom:16px; }
  .bal-card { flex:1; padding:10px 14px; border-radius:8px; }
  table { width:100%; border-collapse:collapse; }
  th { background:#1e293b; color:#fff; padding:6px 8px; font-size:11px; }
  td { padding:5px 8px; border-bottom:1px solid #f1f5f9; font-size:11px; }
  .summary { margin-top:16px; text-align:right; }
  .footer { margin-top:20px; text-align:center; font-size:10px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:8px; }
</style>
</head><body>
<div class="header">
  <div class="biz-name">${profile.name || 'Timber 360'}</div>
  <div style="font-size:11px;color:#64748b">${profile.address || ''} ${profile.phone ? '| '+profile.phone : ''}</div>
  <div class="title">CUSTOMER LEDGER</div>
  ${startDate && endDate ? `<div style="font-size:11px;color:#64748b">Period: ${formatDate(startDate)} to ${formatDate(endDate)}</div>` : ''}
</div>

<div class="cust-box">
  <div>
    <div style="font-size:15px;font-weight:800">${customer.name || ''}</div>
    <div style="font-size:11px;color:#64748b;margin-top:2px">${customer.mobile || ''}</div>
    <div style="font-size:11px;color:#64748b">${customer.address || ''}</div>
  </div>
</div>

<div class="bal-box">
  <div class="bal-card" style="background:#dcfce7;border:1px solid #86efac">
    <div style="font-size:10px;font-weight:700;color:#166534">Opening Balance</div>
    <div style="font-size:16px;font-weight:900;color:#166534">${formatMoney(openingBalance, settings.currency)}</div>
  </div>
  <div class="bal-card" style="background:${closingBal>0?'#fee2e2':'#dcfce7'};border:1px solid ${closingBal>0?'#fca5a5':'#86efac'}">
    <div style="font-size:10px;font-weight:700;color:${closingBal>0?'#991b1b':'#166534'}">Closing Balance</div>
    <div style="font-size:16px;font-weight:900;color:${closingBal>0?'#dc2626':'#16a34a'}">${formatMoney(closingBal, settings.currency)}</div>
  </div>
</div>

<table>
  <thead><tr>
    <th style="text-align:left">Date</th>
    <th style="text-align:left">Description</th>
    <th style="text-align:right">Debit</th>
    <th style="text-align:right">Credit</th>
    <th style="text-align:right">Balance</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>

<div class="summary">
  <div style="color:#dc2626;font-size:12px">Total Debit: <strong>${formatMoney(totalDebits, settings.currency)}</strong></div>
  <div style="color:#16a34a;font-size:12px">Total Credit: <strong>${formatMoney(totalCredits, settings.currency)}</strong></div>
  <div style="font-size:15px;font-weight:800;margin-top:6px">Net Balance: ${formatMoney(closingBal, settings.currency)}</div>
</div>

<div class="footer">${profile.footer || `Generated: ${formatDate(new Date().toISOString())}`}</div>
</body></html>`;
};
