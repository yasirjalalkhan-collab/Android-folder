// ── ChequeManager — Standalone Component ────────────────────
// HTML میں standalone component تھا — یہاں بھی الگ رکھا گیا
import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Modal, ScrollView,
} from 'react-native';
import AppButton from '../ui/AppButton';
import AppInput  from '../ui/AppInput';
import { COLORS, SPACING, RADIUS, FONT, SHADOW } from '../../utils/theme';
import { formatMoney, formatDate, generateId, todayISO } from '../../utils/helpers';
import { safeParseAmount } from '../../utils/ledger';

export default function ChequeManager({
  customer, cheques, setCheques, settings, showAlert, showConfirm, showPrompt,
}) {
  const dark  = settings?.mode === 'dark';
  const card  = dark ? COLORS.surfaceDark : COLORS.white;
  const text  = dark ? COLORS.textDark   : COLORS.textLight;
  const sub   = dark ? COLORS.slate400   : COLORS.slate500;
  const border= dark ? COLORS.borderDark : COLORS.borderLight;

  const [adding, setAdding] = useState(false);
  const [form,   setForm]   = useState({ bank:'', number:'', amount:'', date: todayISO() });

  const safeCheques  = (cheques || []).filter(c => String(c.customerId) === String(customer?.id));

  // ── Update Status (HTML updateStatus exact port) ──────────
  const updateStatus = async (chequeId, newStatus) => {
    const targetCheque = safeCheques.find(c => String(c.id) === String(chequeId));
    if (!targetCheque) return;

    const oldStatus = targetCheque.status;
    const chequeAmt = safeParseAmount(targetCheque.amount);
    const ts        = String(Date.now());
    const today     = new Date().toISOString().split('T')[0];

    // ── Ledger entries based on status transition ─────────
    let ledgerEntry = null;

    if (oldStatus === 'pending' && newStatus === 'returned') {
      // Cheque returned → add Debit reversal
      ledgerEntry = {
        id: 'chq-return-' + chequeId + '-' + ts,
        createdAt: ts, date: today,
        desc: `⚠️ Cheque Returned: ${targetCheque.bank} #${targetCheque.number}`,
        amount: chequeAmt, type: 'Debit', method: 'Cheque', chequeId,
      };
    } else if (oldStatus === 'returned' && newStatus === 'cleared') {
      // Re-cleared → add Credit
      ledgerEntry = {
        id: 'chq-clear-' + chequeId + '-' + ts,
        createdAt: ts, date: today,
        desc: `✅ Cheque Re-Cleared: ${targetCheque.bank} #${targetCheque.number}`,
        amount: chequeAmt, type: 'Credit', method: 'Cheque', chequeStatus: 'cleared', chequeId,
      };
    } else if (oldStatus === 'cleared' && newStatus === 'returned') {
      // Reverse cleared → add Debit
      ledgerEntry = {
        id: 'chq-reverse-' + chequeId + '-' + ts,
        createdAt: ts, date: today,
        desc: `⚠️ Cheque Reversed: ${targetCheque.bank} #${targetCheque.number}`,
        amount: chequeAmt, type: 'Debit', method: 'Cheque', chequeId,
      };
    }

    // Update cheque status + optional ledger
    setCheques({ ...targetCheque, status: newStatus }, ledgerEntry);
  };

  // ── Edit cheque ───────────────────────────────────────────
  const handleEdit = async (c) => {
    const newBank = await showPrompt('Bank name:', c.bank, 'Edit Cheque');
    if (newBank === null) return;
    const newNum  = await showPrompt('Cheque number:', c.number, 'Edit Cheque');
    if (newNum  === null) return;
    const newDate = await showPrompt('تاریخ (YYYY-MM-DD):', c.date, 'ترمیم');
    if (newDate === null) return;
    setCheques({ ...c, bank: newBank, number: newNum, date: newDate });
  };

  // ── Delete cheque ─────────────────────────────────────────
  const handleDelete = async (id) => {
    const ok = await showConfirm('اس چیک کو ڈیلیٹ کریں؟', 'تصدیق');
    if (!ok) return;
    setCheques(null, null, id); // delete signal
  };

  // ── Add new standalone cheque ─────────────────────────────
  const handleAdd = async () => {
    if (!form.bank || !form.amount) {
      await showAlert('بینک اور رقم ضروری ہے', 'ضروری'); return;
    }
    const newChq = {
      id: generateId('chq'), date: form.date, amount: safeParseAmount(form.amount),
      bank: form.bank, number: form.number, status: 'pending',
      customerId: customer.id, customerName: customer.name,
    };
    setCheques(newChq, null); // add signal
    setAdding(false);
    setForm({ bank:'', number:'', amount:'', date: todayISO() });
  };

  const statusColors = {
    pending:  { bg: dark?'#78350f':'#FFF7ED', text: COLORS.warning,  border: '#FED7AA' },
    cleared:  { bg: dark?'#14532d':'#F0FDF4', text: COLORS.success,  border: '#86EFAC' },
    returned: { bg: dark?'#7f1d1d':'#FEF2F2', text: COLORS.danger,   border: '#FCA5A5' },
  };

  const renderCheque = ({ item: c }) => {
    const sc = statusColors[c.status] || statusColors.pending;
    return (
      <View style={[styles.card, { backgroundColor:sc.bg, borderLeftColor:sc.text }]}>
        <View style={styles.cardTop}>
          <View style={{ flex:1 }}>
            <Text style={[styles.bank, { color:text }]}>{c.bank}</Text>
            <Text style={[styles.cardSub, { color:sub }]}>#{c.number}</Text>
            <Text style={[styles.cardSub, { color:sub }]}>{formatDate(c.date)}</Text>
          </View>
          <View style={{ alignItems:'flex-end' }}>
            <Text style={[styles.amt, { color:text }]}>{formatMoney(c.amount, settings.currency)}</Text>
            <View style={[styles.badge, { backgroundColor:sc.bg, borderColor:sc.border }]}>
              <Text style={[styles.badgeText, { color:sc.text }]}>{c.status}</Text>
            </View>
          </View>
        </View>

        {/* Status action buttons */}
        <View style={styles.btnRow}>
          {c.status !== 'cleared' && (
            <TouchableOpacity style={[styles.actBtn, { backgroundColor:COLORS.green50, borderColor:'#86efac' }]}
              onPress={async () => {
                const ok = await showConfirm(`چیک کلیئر کریں؟\n${c.bank} #${c.number}\n${formatMoney(c.amount, settings.currency)}`);
                if (ok) updateStatus(c.id, 'cleared');
              }}>
              <Text style={{ color:COLORS.success, fontWeight:'700', fontSize:FONT.xs }}>✓ Clear</Text>
            </TouchableOpacity>
          )}
          {c.status !== 'returned' && (
            <TouchableOpacity style={[styles.actBtn, { backgroundColor:COLORS.red50, borderColor:'#fca5a5' }]}
              onPress={async () => {
                const ok = await showConfirm(`چیک واپس مارک کریں؟\n${c.bank} #${c.number}`);
                if (ok) updateStatus(c.id, 'returned');
              }}>
              <Text style={{ color:COLORS.danger, fontWeight:'700', fontSize:FONT.xs }}>✗ Return</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.actBtn, { backgroundColor:dark?COLORS.slate700:COLORS.slate100, borderColor:border }]}
            onPress={() => handleEdit(c)}>
            <Text style={{ color:sub, fontSize:FONT.xs }}>✏️ Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actBtn, { backgroundColor:COLORS.red50, borderColor:'#fca5a5' }]}
            onPress={() => handleDelete(c.id)}>
            <Text style={{ color:COLORS.danger, fontSize:FONT.xs }}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex:1 }}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor:card, borderBottomColor:border }]}>
        <Text style={[styles.title, { color:text }]}>💳 Cheques</Text>
        <AppButton onPress={() => setAdding(true)} style={styles.addBtn}>+ New Cheque</AppButton>
      </View>

      {/* Summary */}
      {safeCheques.length > 0 && (
        <View style={[styles.summary, { backgroundColor:card, borderColor:border }]}>
          {['pending','cleared','returned'].map(status => {
            const count = safeCheques.filter(c=>c.status===status).length;
            const amt   = safeCheques.filter(c=>c.status===status).reduce((a,c)=>a+safeParseAmount(c.amount),0);
            const sc    = statusColors[status];
            return count > 0 ? (
              <View key={status} style={[styles.summaryCard, { backgroundColor:sc.bg, borderColor:sc.border }]}>
                <Text style={[styles.summaryCount, { color:sc.text }]}>{count}</Text>
                <Text style={[{ fontSize:FONT.xs, fontWeight:'700', color:sc.text }]}>{status}</Text>
                <Text style={[{ fontSize:FONT.xs, color:sc.text }]}>{formatMoney(amt, settings.currency)}</Text>
              </View>
            ) : null;
          })}
        </View>
      )}

      {/* List */}
      <FlatList
        data={safeCheques}
        keyExtractor={c => String(c.id)}
        renderItem={renderCheque}
        contentContainerStyle={{ padding:SPACING.md, paddingBottom:80 }}
        ListEmptyComponent={
          <Text style={[styles.empty, { color:sub }]}>No cheques yet</Text>
        }
      />

      {/* Add Modal */}
      <Modal visible={adding} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.modalBox, { backgroundColor:card }]}>
            <Text style={[styles.title, { color:text, marginBottom:SPACING.lg }]}>Add New Cheque</Text>
            <AppInput label="Bank Name"  value={form.bank}   onChangeText={v=>setForm(p=>({...p,bank:v}))}   dark={dark} />
            <AppInput label="Cheque No" value={form.number} onChangeText={v=>setForm(p=>({...p,number:v}))} dark={dark} />
            <AppInput label="Amount"       value={form.amount} onChangeText={v=>setForm(p=>({...p,amount:v}))} keyboardType="numeric" dark={dark} />
            <AppInput label="Date"     value={form.date}   onChangeText={v=>setForm(p=>({...p,date:v}))}   dark={dark} />
            <View style={{ flexDirection:'row', gap:SPACING.md, marginTop:SPACING.md }}>
              <AppButton variant="secondary" onPress={() => setAdding(false)} style={{flex:1}}>Cancel</AppButton>
              <AppButton onPress={handleAdd} style={{flex:1}}>Add</AppButton>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header:      { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:SPACING.lg, borderBottomWidth:1 },
  title:       { fontSize:FONT.xl, fontWeight:'700' },
  addBtn:      { paddingVertical:SPACING.sm, paddingHorizontal:SPACING.md },
  summary:     { flexDirection:'row', gap:SPACING.sm, padding:SPACING.md, borderBottomWidth:1 },
  summaryCard: { flex:1, padding:SPACING.sm, borderRadius:RADIUS.md, borderWidth:1, alignItems:'center' },
  summaryCount:{ fontSize:FONT.xxl, fontWeight:'900' },
  card:        { borderRadius:RADIUS.lg, padding:SPACING.md, marginBottom:SPACING.sm, borderLeftWidth:4, ...SHADOW.sm },
  cardTop:     { flexDirection:'row', marginBottom:SPACING.sm },
  bank:        { fontWeight:'700', fontSize:FONT.base },
  cardSub:     { fontSize:FONT.xs, marginTop:2 },
  amt:         { fontSize:FONT.lg, fontWeight:'800' },
  badge:       { paddingHorizontal:SPACING.sm, paddingVertical:3, borderRadius:RADIUS.sm, borderWidth:1, marginTop:4 },
  badgeText:   { fontSize:FONT.xs, fontWeight:'700' },
  btnRow:      { flexDirection:'row', gap:SPACING.sm, flexWrap:'wrap' },
  actBtn:      { paddingHorizontal:SPACING.md, paddingVertical:6, borderRadius:RADIUS.md, borderWidth:1 },
  empty:       { textAlign:'center', marginTop:60, lineHeight:24 },
  overlay:     { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end' },
  modalBox:    { borderTopLeftRadius:RADIUS.xxl, borderTopRightRadius:RADIUS.xxl, padding:SPACING.xl, paddingBottom:40 },
});
