import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import InlineItemEntry from '../components/invoice/InlineItemEntry';
import { useApp } from '../context/AppContext';
import AppButton from '../components/ui/AppButton';
import AppInput  from '../components/ui/AppInput';
import { safeParseAmount } from '../utils/ledger';
import {
  generateId, getNextInvoiceId, todayISO, formatMoney, normalizePhone,
} from '../utils/helpers';
import { COLORS, SPACING, RADIUS, FONT, SHADOW } from '../utils/theme';

export default function InvoiceEditorScreen() {
  const navigation = useNavigation();
  const { params }  = useRoute();
  const {
    invoices, customers, stock, settings, profile,
    saveData, showAlert, showConfirm, createTracking,
  } = useApp();

  const dark = settings.mode === 'dark';
  const bg   = dark ? COLORS.bgDark     : COLORS.bgLight;
  const card = dark ? COLORS.surfaceDark : COLORS.white;
  const text = dark ? COLORS.textDark   : COLORS.textLight;
  const sub  = dark ? COLORS.slate400   : COLORS.slate500;
  const brd  = dark ? COLORS.borderDark : COLORS.borderLight;

  const existingInv = params?.invoiceId
    ? invoices.find(i => String(i.id) === String(params.invoiceId))
    : null;
  const prefill = params?.prefillCustomer || null;

  const initInv = existingInv || {
    id: getNextInvoiceId(invoices), date: todayISO(),
    customer: prefill
      ? { id:prefill.id, name:prefill.name, mobile:prefill.mobile||'', address:prefill.address||'' }
      : { id:'', name:'', mobile:'', address:'' },
    items:[], subtotal:0, total:0, discount:0,
    paid:0, cashPaid:0, balance:0, cheques:[],
  };

  const [inv,          setInv]       = useState(initInv);

  // ── Enter key chain refs ───────────────────────────────────
  const refMobile    = useRef(null);
  const refAddress   = useRef(null);
  const refDiscount  = useRef(null);
  const [cashPaid,     setCashPaid]  = useState(String(initInv.cashPaid || ''));
  const [editIndex,    setEditIdx]   = useState(null);
  const [chequesList,  setCheques]   = useState(existingInv?.cheques || []);
  const [newCheque,    setNewChq]    = useState({ bank:'', number:'', amount:'', date:todayISO() });
  const [showCustSugg, setShowCustSugg] = useState(false);

  // ── Customer autocomplete ─────────────────────────────────
  const custSuggestions = useMemo(() => {
    const q = (inv.customer.name || '').toLowerCase();
    const m = normalizePhone(inv.customer.mobile || '');
    if (!q && !m) return [];
    return customers.filter(c =>
      (q.length > 0 && (c.name || '').toLowerCase().includes(q)) ||
      (m.length > 0 && normalizePhone(c.mobile || '') === m)
    ).slice(0, 5);
  }, [inv.customer.name, inv.customer.mobile, customers]);

  const selectCustomer = (c) => {
    setInv(p => ({ ...p, customer:{ id:c.id, name:c.name, mobile:c.mobile||'', address:c.address||'' } }));
    setShowCustSugg(false);
  };

  // ── Recalculate totals ────────────────────────────────────
  useEffect(() => {
    const s_   = inv.items.reduce((a, i) => a + (i.amount * i.qty), 0);
    const disc = Math.min(Math.max(inv.discount || 0, 0), s_);
    const tot  = s_ - disc;
    const chqA = chequesList
      .filter(c => c.status === 'cleared')
      .reduce((a, c) => a + safeParseAmount(c.amount), 0);
    const paid = safeParseAmount(cashPaid) + chqA;
    setInv(p => ({
      ...p, subtotal:s_, total:tot, discount:disc,
      paid, cashPaid:safeParseAmount(cashPaid),
      cheques:chequesList, balance:tot - paid,
    }));
  }, [inv.items, inv.discount, cashPaid, chequesList]);

  const handleItemAction = (item) => {
    const newItems = [...inv.items];
    if (editIndex !== null) { newItems[editIndex] = item; setEditIdx(null); }
    else newItems.unshift(item);
    setInv(p => ({ ...p, items: newItems }));
  };

  // ── Stock deduction ───────────────────────────────────────
  const deductStock = async (items) => {
    await Promise.all(items.map(item => {
      const match = stock.find(s =>
        (s.name || '').toLowerCase() === (item.name || '').toLowerCase() &&
        s.displaySize === item.displaySize && s.type === item.type
      );
      if (!match) return Promise.resolve();
      const newQty = Math.max((parseFloat(match.qty) || 0) - (parseFloat(item.qty) || 0), 0);
      return saveData('stock', match.id, { ...match, qty: newQty });
    }));
  };

  // ── Stock restore (edit کے وقت پرانا stock واپس) ───────────
  const restoreStock = async (items) => {
    await Promise.all(items.map(item => {
      const match = stock.find(s =>
        (s.name || '').toLowerCase() === (item.name || '').toLowerCase() &&
        s.displaySize === item.displaySize && s.type === item.type
      );
      if (!match) return Promise.resolve();
      const restoredQty = (parseFloat(match.qty) || 0) + (parseFloat(item.qty) || 0);
      return saveData('stock', match.id, { ...match, qty: restoredQty });
    }));
  };

  // ── MAIN SAVE ─────────────────────────────────────────────
  const handleSave = async () => {
    // 1. Validation
    if (!inv.customer.name || !inv.customer.name.trim()) {
      await showAlert('Customer name is required', 'Required');
      return;
    }
    if (inv.items.length === 0) {
      await showAlert('Add at least one item', 'Required');
      return;
    }

    const invMode    = settings.invMode || 'live';
    let   currentInv = { ...inv };

    // 2. Stock mode check
    if (invMode !== 'live') {
      const errors = [], warnings = [];
      for (const item of currentInv.items) {
        const match     = stock.find(s =>
          (s.name || '').toLowerCase() === (item.name || '').toLowerCase() &&
          s.displaySize === item.displaySize && s.type === item.type
        );
        const available = parseFloat(match?.qty) || 0;
        const needed    = parseFloat(item.qty)   || 0;
        if (needed > available) {
          const msg = `${item.name}: Available ${available}, Needed ${needed}`;
          invMode === 'stock' ? errors.push(msg) : warnings.push(msg);
        }
      }
      if (errors.length > 0) {
        await showAlert('Insufficient Stock:\n\n' + errors.join('\n'), 'Stock Error');
        return;
      }
      if (warnings.length > 0) {
        const ok = await showConfirm('Low Stock:\n\n' + warnings.join('\n') + '\n\nProceed anyway?', 'Warning');
        if (!ok) return;
      }
    }

    // 3. Customer match (normalizePhone)
    let custId = currentInv.customer.id;
    if (!custId && currentInv.customer.mobile) {
      const normNew = normalizePhone(currentInv.customer.mobile);
      if (normNew) {
        const found = customers.find(c => normalizePhone(c.mobile || '') === normNew);
        if (found) custId = found.id;
      }
    }
    if (!custId) custId = generateId();

    let custData = customers.find(c => String(c.id) === String(custId)) || {
      id: custId,
      name:    currentInv.customer.name,
      mobile:  currentInv.customer.mobile || '',
      address: currentInv.customer.address || '',
      ledger:  [],
    };

    // 4. Name mismatch
    if (
      custData.name &&
      currentInv.customer.name.trim() !== '' &&
      custData.name.trim().toLowerCase() !== currentInv.customer.name.trim().toLowerCase()
    ) {
      const ok = await showConfirm(
        `Mobile: ${currentInv.customer.mobile}\nRegistered: "${custData.name}"\nYou entered: "${currentInv.customer.name}"\n\nOK = use "${custData.name}"\nCancel = re-check`,
        'Name Mismatch'
      );
      if (!ok) return;
      currentInv = { ...currentInv, customer: { ...currentInv.customer, name: custData.name } };
    }

    // 5. Build ledger entries
    let newLedger = [...(custData.ledger || [])].filter(tx =>
      String(tx.id) !== 'bill-' + currentInv.id &&
      String(tx.id) !== 'pay-'  + currentInv.id &&
      String(tx.id) !== 'cash-' + currentInv.id &&
      !(tx.invoiceId &&
        String(tx.invoiceId) === String(currentInv.id) &&
        String(tx.id || '').startsWith('chq-inv-'))
    );

    newLedger.unshift({
      id: 'bill-' + currentInv.id,
      createdAt: String(currentInv.id),
      date: currentInv.date,
      desc: `Bill #${currentInv.id}`,
      amount: safeParseAmount(currentInv.total),
      type: 'Debit',
      invoiceId: String(currentInv.id),
    });

    const cp = safeParseAmount(cashPaid);
    if (cp > 0) {
      newLedger.unshift({
        id: 'cash-' + currentInv.id,
        createdAt: String(currentInv.id) + '1',
        date: currentInv.date,
        desc: `Cash for Bill #${currentInv.id}`,
        amount: cp,
        type: 'Credit',
        method: 'Cash',
        invoiceId: String(currentInv.id),
      });
    }

    // ── Cheques — undefined field نہیں ────────────────────
    chequesList.forEach(c => {
      if (c.status === 'returned') return;
      const ts = String(Date.now()) + String(Math.random()).slice(2, 6);
      const entry = {
        id: 'chq-inv-' + c.id,
        createdAt: ts,
        date: c.date || currentInv.date,
        desc: `Cheque: ${c.bank} #${c.number} - Bill #${currentInv.id}`,
        amount: safeParseAmount(c.amount),
        type: 'Credit',
        method: 'Cheque',
        chequeStatus: c.status || 'pending',
        chequeId: String(c.id),
        invoiceId: String(currentInv.id),
      };
      newLedger.unshift(entry);
    });

    const finalCust = {
      ...custData,
      ledger: newLedger,
      mobile: currentInv.customer.mobile || '',
    };
    const finalInv = {
      ...currentInv,
      customer:   finalCust,
      customerId: String(custId),
    };

    // 6. پہلے save، پھر navigate
    await saveData('invoices',  currentInv.id, finalInv);
    await saveData('customers', custId,         finalCust);

    // Order Tracking — نئی invoice پر بناؤ، edit پر نہیں
    if (!existingInv) {
      createTracking(finalInv, profile);
    }

    navigation.goBack();

    chequesList.forEach(c =>
      saveData('cheques', c.id, {
        id: c.id, date: c.date || currentInv.date,
        bank: c.bank || '', number: c.number || '',
        amount: safeParseAmount(c.amount),
        status: c.status || 'pending',
        customerId: String(custId),
        customerName: finalCust.name,
        invoiceId: String(currentInv.id),
      })
    );

    if (invMode !== 'live') {
      if (existingInv) {
        // Edit: پہلے پرانا stock واپس کریں، پھر نیا کاٹیں
        restoreStock(existingInv.items).then(() => {
          deductStock(currentInv.items);
        });
      } else {
        deductStock(currentInv.items);
      }
    }
  };

  const addCheque = async () => {
    if (!newCheque.amount || !newCheque.bank) {
      await showAlert('Bank and Amount required', 'Required');
      return;
    }
    const c = { id: generateId('chq'), ...newCheque, status: 'pending' };
    setCheques(p => [...p, c]);
    setNewChq({ bank:'', number:'', amount:'', date:todayISO() });
  };

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: card, borderBottomColor: brd }]}>
        <Text style={[styles.headerTitle, { color: text }]}>
          {existingInv ? `Edit Invoice #${inv.id}` : `New Invoice #${inv.id}`}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        {/* Customer */}
        <View style={[styles.custCard, { backgroundColor: card }]}>
          <View style={{ marginBottom: SPACING.sm }}>
            <Text style={{ color:sub, fontSize:FONT.xs, fontWeight:'700', marginBottom:4, textTransform:'uppercase' }}>
              Customer Name
            </Text>
            <TextInput
              value={inv.customer.name}
              onChangeText={v => {
                setInv(p => ({ ...p, customer:{ ...p.customer, name:v, id: v !== p.customer.name ? '' : p.customer.id } }));
                setShowCustSugg(true);
              }}
              onFocus={() => inv.customer.name && setShowCustSugg(true)}
              onBlur={() => setTimeout(() => setShowCustSugg(false), 200)}
              placeholder="Customer Name"
              placeholderTextColor={COLORS.slate400}
              style={[styles.textInp, { color:text, borderColor:brd, backgroundColor:bg }]}
            />
            {showCustSugg && custSuggestions.length > 0 && (
              <View style={[styles.suggBox, { backgroundColor:card, borderColor:COLORS.primary }]}>
                {custSuggestions.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.suggRow, { borderBottomColor:brd }]}
                    onPress={() => selectCustomer(c)}
                  >
                    <Text style={{ color:text, fontWeight:'600', fontSize:FONT.sm }}>{c.name}</Text>
                    <Text style={{ color:sub, fontSize:FONT.xs }}>{c.mobile}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={{ flexDirection:'row', gap:SPACING.sm }}>
            <AppInput
              label="Mobile"
              ref={refMobile}
              value={inv.customer.mobile}
              onChangeText={v => {
                setInv(p => ({ ...p, customer:{ ...p.customer, mobile:v } }));
                setShowCustSugg(true);
              }}
              keyboardType="phone-pad"
              dark={dark}
              style={{ flex:1 }}
              returnKeyType="next"
              onSubmitEditing={()=>refAddress.current?.focus()}
            />
            <AppInput
              label="Address"
              ref={refAddress}
              value={inv.customer.address}
              onChangeText={v => setInv(p => ({ ...p, customer:{ ...p.customer, address:v } }))}
              dark={dark}
              style={{ flex:1 }}
            />
          </View>

          {inv.customer.id ? (
            <View style={{ marginTop:SPACING.sm, backgroundColor:COLORS.green50, padding:SPACING.sm, borderRadius:RADIUS.md }}>
              <Text style={{ color:COLORS.success, fontSize:FONT.xs, fontWeight:'700' }}>
                ✓ Linked: {inv.customer.name}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Item entry */}
        <InlineItemEntry
          onAdd={handleItemAction}
          settings={settings}
          stock={stock}
          initialData={editIndex !== null ? inv.items[editIndex] : null}
          clearAfterAdd={editIndex === null}
        />

        {/* Items list */}
        <View style={[styles.itemsList, { borderColor:brd }]}>
          {inv.items.length === 0 ? (
            <Text style={{ color:COLORS.slate400, textAlign:'center', padding:SPACING.xl }}>
              No items added yet
            </Text>
          ) : inv.items.map((item, idx) => (
            <View key={idx} style={[styles.itemRow, {
              backgroundColor: editIndex===idx ? (dark ? COLORS.blue600+'40' : COLORS.blue50) : card,
              borderBottomColor: brd,
            }]}>
              <View style={{ flex:1 }}>
                <Text style={{ color:text, fontWeight:'700' }}>{item.name}</Text>
                <Text style={{ color:COLORS.slate400, fontSize:FONT.xs }}>{item.displaySize}</Text>
                <Text style={{ color:COLORS.slate500, fontSize:FONT.xs }}>
                  Qty: {item.qty} | Rate: {item.rate}
                </Text>
              </View>
              <View style={{ alignItems:'flex-end' }}>
                <Text style={{ color:text, fontWeight:'700' }}>
                  {formatMoney(item.amount * item.qty, settings.currency)}
                </Text>
                <View style={{ flexDirection:'row', gap:SPACING.xs, marginTop:4 }}>
                  <TouchableOpacity style={styles.itemActBtn} onPress={() => setEditIdx(idx)}>
                    <Text style={{ color:COLORS.info, fontSize:FONT.xs }}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.itemActBtn}
                    onPress={() => {
                      const it = [...inv.items];
                      it.splice(idx, 1);
                      setInv(p => ({ ...p, items:it }));
                    }}
                  >
                    <Text style={{ color:COLORS.danger, fontSize:FONT.xs }}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Payment */}
        <View style={[styles.paySection, { backgroundColor:card, borderColor:brd }]}>
          <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:SPACING.md }}>
            <Text style={{ color:COLORS.success, fontWeight:'800', fontSize:FONT.lg }}>Total:</Text>
            <Text style={{ color:COLORS.success, fontWeight:'800', fontSize:FONT.lg }}>
              {formatMoney(inv.total, settings.currency)}
            </Text>
          </View>

          <AppInput label="Cash Received" value={cashPaid} onChangeText={setCashPaid} keyboardType="numeric" dark={dark} returnKeyType="next" onSubmitEditing={()=>refDiscount.current?.focus()} />
          <AppInput
            label="Discount"
            ref={refDiscount}
            value={String(inv.discount || '')}
            onChangeText={v => setInv(p => ({ ...p, discount:parseFloat(v)||0 }))}
            keyboardType="numeric"
            dark={dark}
            returnKeyType="done"
          />

          {chequesList.map((c, i) => (
            <View key={i} style={[styles.chequeItem, { borderColor:brd }]}>
              <View style={{ flex:1 }}>
                <Text style={{ color:text, fontWeight:'700' }}>{c.bank} #{c.number}</Text>
                <Text style={{ color:COLORS.slate400, fontSize:FONT.xs }}>
                  {formatMoney(c.amount, settings.currency)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setCheques(p => p.filter((_, idx) => idx !== i))}>
                <Text style={{ color:COLORS.danger, fontSize:FONT.lg }}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          <View style={[styles.addChequeRow, { borderTopColor:brd }]}>
            <TextInput placeholder="Bank"   value={newCheque.bank}   onChangeText={v=>setNewChq(p=>({...p,bank:v}))}   style={[styles.chqInput,{color:text,borderColor:brd,backgroundColor:bg}]} placeholderTextColor={COLORS.slate400} />
            <TextInput placeholder="No."    value={newCheque.number} onChangeText={v=>setNewChq(p=>({...p,number:v}))} style={[styles.chqInput,{color:text,borderColor:brd,backgroundColor:bg}]} placeholderTextColor={COLORS.slate400} />
            <TextInput placeholder="Amount" value={newCheque.amount} onChangeText={v=>setNewChq(p=>({...p,amount:v}))} keyboardType="numeric" style={[styles.chqInput,{color:text,borderColor:brd,backgroundColor:bg}]} placeholderTextColor={COLORS.slate400} />
            <TouchableOpacity style={styles.addChqBtn} onPress={addCheque}>
              <Text style={{ color:COLORS.white, fontWeight:'700', fontSize:FONT.lg }}>+</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.summary, { borderTopColor:brd }]}>
            <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
              <Text style={{ color:COLORS.warning, fontWeight:'700' }}>Balance:</Text>
              <Text style={{ color:COLORS.warning, fontWeight:'800', fontSize:FONT.lg }}>
                {formatMoney(inv.balance, settings.currency)}
              </Text>
            </View>
          </View>

          <AppButton onPress={handleSave} style={{ marginTop:SPACING.md }}>
            💾 Save Invoice
          </AppButton>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex:1 },
  header:        { flexDirection:'row', alignItems:'center', gap:SPACING.md, padding:SPACING.lg, borderBottomWidth:1 },
  headerTitle:   { fontSize:FONT.md, fontWeight:'700' },
  scrollContent: { padding:SPACING.md, paddingBottom:120 },
  custCard:      { padding:SPACING.md, borderRadius:RADIUS.xl, marginBottom:SPACING.md, ...SHADOW.sm },
  textInp:       { borderWidth:1.5, borderRadius:RADIUS.md, padding:SPACING.md, fontSize:FONT.base },
  suggBox:       { borderWidth:1.5, borderRadius:RADIUS.md, overflow:'hidden', marginTop:2, zIndex:100 },
  suggRow:       { padding:SPACING.md, borderBottomWidth:1, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  itemsList:     { borderWidth:1, borderRadius:RADIUS.xl, overflow:'hidden', marginBottom:SPACING.md },
  itemRow:       { flexDirection:'row', padding:SPACING.md, borderBottomWidth:1 },
  itemActBtn:    { padding:4, backgroundColor:COLORS.slate100, borderRadius:RADIUS.sm },
  paySection:    { padding:SPACING.md, borderRadius:RADIUS.xl, borderWidth:1, ...SHADOW.sm },
  chequeItem:    { flexDirection:'row', alignItems:'center', padding:SPACING.sm, borderWidth:1, borderRadius:RADIUS.md, marginBottom:SPACING.sm },
  addChequeRow:  { flexDirection:'row', gap:SPACING.xs, paddingTop:SPACING.md, marginTop:SPACING.md, borderTopWidth:1 },
  chqInput:      { flex:1, borderWidth:1, borderRadius:RADIUS.sm, padding:SPACING.xs, fontSize:FONT.xs },
  addChqBtn:     { backgroundColor:COLORS.indigo600, width:36, height:36, borderRadius:RADIUS.md, justifyContent:'center', alignItems:'center' },
  summary:       { paddingTop:SPACING.md, marginTop:SPACING.md, borderTopWidth:1 },
});
