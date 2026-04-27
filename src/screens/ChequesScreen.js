// ── ChequesScreen — HTML ChequeManager (isDashboard=true) exact port ──
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import AppInput from '../components/ui/AppInput';
import { FadeSlideIn, ScalePress } from '../components/ui/Animated';
import { calculateLedgerBalance, safeParseAmount } from '../utils/ledger';
import { formatMoney, formatDate, todayISO } from '../utils/helpers';
import { COLORS, SPACING, RADIUS, FONT, SHADOW } from '../utils/theme';

export default function ChequesScreen() {
  const navigation = useNavigation();
  const {
    cheques, customers, invoices,
    saveData, deleteData,
    settings, showAlert, showConfirm, showPrompt,
  } = useApp();
  const dark = settings.mode === 'dark';
  const bg   = dark ? COLORS.bgDark     : COLORS.bgLight;
  const card = dark ? COLORS.surfaceDark : COLORS.white;
  const text = dark ? COLORS.textDark   : COLORS.textLight;
  const sub  = dark ? COLORS.slate400   : COLORS.slate500;
  const brd  = dark ? COLORS.borderDark : COLORS.borderLight;

  const [filter, setFilter] = useState('all'); // 'all'|'pending'|'cleared'|'returned'

  const filtered = filter === 'all' ? cheques : cheques.filter(c => c.status === filter);

  const totalAmt    = filtered.reduce((s,c)=>s+safeParseAmount(c.amount),0);
  const pendingAmt  = cheques.filter(c=>c.status==='pending').reduce((s,c)=>s+safeParseAmount(c.amount),0);
  const clearedCount= cheques.filter(c=>c.status==='cleared').length;

  // ── updateStatus — ledger engine کے مطابق (CustomerDetailScreen سے unified) ──
  // فلو: pending Credit → balance فوری کم
  //       returned      → Credit skip ہو → balance بڑھے
  //       cleared       → Credit مؤثر → balance کم
  const updateStatus = async (chequeId, newStatus) => {
    const targetCheque = cheques.find(c => String(c.id) === String(chequeId));
    if (!targetCheque) return;

    const ts = String(Date.now());

    // ── Invoice-linked cheque: invoice record sync ───────────
    if (targetCheque.invoiceId) {
      const inv = invoices.find(i => String(i.id) === String(targetCheque.invoiceId));
      if (inv) {
        const updatedInvCheques = (inv.cheques||[]).map(c =>
          String(c.id)===String(chequeId) ? {...c, status:newStatus} : c
        );
        // paid صرف cleared cheques پر مشتمل
        const newChqTotal = updatedInvCheques
          .filter(c=>c.status==='cleared')
          .reduce((s,c)=>s+safeParseAmount(c.amount),0);
        const freshPaid = safeParseAmount(inv.cashPaid) + newChqTotal;
        await saveData('invoices', inv.id, {
          ...inv,
          cheques: updatedInvCheques,
          paid: freshPaid,
          balance: safeParseAmount(inv.total) - freshPaid,
        });
      }
    }

    // ── Customer ledger sync ─────────────────────────────────
    // Ledger engine ہی balance حساب کرتا ہے — صرف chequeStatus sync کریں
    // returned → Credit غیر مؤثر (balance بڑھے) ✅
    // cleared/pending → Credit مؤثر (balance کم) ✅
    if (targetCheque.customerId) {
      const cust = customers.find(c => String(c.id) === String(targetCheque.customerId));
      if (cust) {
        const newLedger = (cust.ledger||[]).map(tx => {
          const isLinked =
            (tx.chequeId && String(tx.chequeId) === String(chequeId)) ||
            String(tx.id||'') === 'chq-inv-' + String(chequeId);
          return isLinked ? {...tx, chequeStatus: newStatus} : tx;
        });
        await saveData('customers', cust.id, {...cust, ledger: newLedger});
      }
    }

    // Cheque record update
    await saveData('cheques', chequeId, {...targetCheque, status: newStatus});
  };

  // ── Edit ──────────────────────────────────────────────────
  const handleEdit = async (c) => {
    const newBank = await showPrompt('Bank Name:', c.bank, 'Edit');
    if (newBank===null) return;
    const newNum  = await showPrompt('Cheque Number:', c.number, 'Edit');
    if (newNum===null) return;
    const newDate = await showPrompt('Date (YYYY-MM-DD):', c.date, 'Edit');
    if (newDate===null) return;
    await saveData('cheques', c.id, {...c, bank:newBank, number:newNum, date:newDate});
  };

  // ── Delete ─────────────────────────────────────────────────
  const handleDelete = async (chequeId) => {
    const ok = await showConfirm('Delete this cheque permanently?', 'Confirm');
    if (!ok) return;
    const targetCheque = cheques.find(c=>String(c.id)===String(chequeId));
    // If invoice-linked, update invoice too
    if (targetCheque?.invoiceId) {
      const inv = invoices.find(i=>String(i.id)===String(targetCheque.invoiceId));
      if (inv) {
        const updInvCheques = (inv.cheques||[]).filter(c=>String(c.id)!==String(chequeId));
        const newChqTotal = updInvCheques.filter(c=>c.status==='cleared').reduce((s,c)=>s+safeParseAmount(c.amount),0);
        const freshPaid   = safeParseAmount(inv.cashPaid)+newChqTotal;
        await saveData('invoices', inv.id, {...inv, cheques:updInvCheques, paid:freshPaid, balance:safeParseAmount(inv.total)-freshPaid});
      }
    }
    await deleteData('cheques', chequeId);
  };

  // ── Clear history ──────────────────────────────────────────
  const handleClearHistory = async () => {
    const ok = await showConfirm(`Remove ${clearedCount} CLEARED cheques from list?`, 'Clear History');
    if (!ok) return;
    const toDelete = cheques.filter(c=>c.status==='cleared');
    for (const c of toDelete) await deleteData('cheques', c.id);
    await showAlert('History cleared!', 'Done');
  };

  const FILTERS = ['all','pending','cleared','returned'];

  return (
    <View style={[styles.root,{backgroundColor:bg}]}>
      {/* Header */}
      <View style={[styles.header,{backgroundColor:COLORS.slate800}]}>
        <View>
          <Text style={{color:COLORS.white,fontWeight:'700',fontSize:FONT.lg}}>🧾 All Cheques</Text>
          <Text style={{color:COLORS.slate300,fontSize:FONT.xs}}>
            Total: {formatMoney(totalAmt,settings.currency)}
          </Text>
        </View>
        <View style={{flexDirection:'row',gap:SPACING.sm,alignItems:'center'}}>
          {clearedCount>0 && (
            <TouchableOpacity
              style={{backgroundColor:COLORS.danger,paddingHorizontal:SPACING.md,paddingVertical:SPACING.sm,borderRadius:RADIUS.md}}
              onPress={handleClearHistory}
            >
              <Text style={{color:COLORS.white,fontWeight:'700',fontSize:FONT.xs}}>🗑 Clear ({clearedCount})</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={()=>navigation.goBack()}>
            <Text style={{color:COLORS.slate300,fontSize:22}}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary chips */}
      <View style={[styles.summaryRow,{backgroundColor:card,borderBottomColor:brd}]}>
        {[
          {label:'Pending', count:cheques.filter(c=>c.status==='pending').length, color:COLORS.warning, bg:'#FFF7ED'},
          {label:'Cleared', count:cheques.filter(c=>c.status==='cleared').length, color:COLORS.success, bg:'#F0FDF4'},
          {label:'Returned',count:cheques.filter(c=>c.status==='returned').length,color:COLORS.danger,  bg:'#FEF2F2'},
        ].map(s=>(
          <View key={s.label} style={[styles.summaryChip,{backgroundColor:s.bg}]}>
            <Text style={{color:s.color,fontWeight:'800',fontSize:FONT.lg}}>{s.count}</Text>
            <Text style={{color:s.color,fontSize:FONT.xs,fontWeight:'700'}}>{s.label}</Text>
          </View>
        ))}
        {pendingAmt>0 && (
          <View style={[styles.summaryChip,{backgroundColor:dark?COLORS.slate700:COLORS.slate100}]}>
            <Text style={{color:text,fontWeight:'800',fontSize:FONT.sm}}>{formatMoney(pendingAmt,settings.currency)}</Text>
            <Text style={{color:sub,fontSize:FONT.xs}}>Pending Amt</Text>
          </View>
        )}
      </View>

      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{maxHeight:48,borderBottomWidth:1,borderBottomColor:brd,backgroundColor:card}}
        contentContainerStyle={{padding:SPACING.sm,gap:SPACING.sm}}>
        {FILTERS.map(f=>(
          <TouchableOpacity key={f}
            style={[styles.filterTab, filter===f && styles.filterTabActive]}
            onPress={()=>setFilter(f)}
          >
            <Text style={[styles.filterTabText, filter===f && {color:COLORS.white}]}>
              {f.charAt(0).toUpperCase()+f.slice(1)}
              {f!=='all'?' ('+cheques.filter(c=>c.status===f).length+')':' ('+cheques.length+')'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      <ScrollView contentContainerStyle={{padding:SPACING.md,paddingBottom:80}}>
        {filtered.length===0 && (
          <View style={{alignItems:'center',marginTop:80}}>
            <Text style={{fontSize:48}}>💳</Text>
            <Text style={{color:sub,marginTop:SPACING.md}}>No cheques found</Text>
          </View>
        )}
        {filtered.map((c,i)=>(
          <FadeSlideIn key={c.id} delay={Math.min(i*20,300)}>
            <View style={[styles.chequeCard,{backgroundColor:card,
              borderLeftColor:c.status==='cleared'?COLORS.success:c.status==='returned'?COLORS.danger:COLORS.warning,
              opacity:c.status==='cleared'?0.75:1,
            }]}>
              <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'}}>
                <View style={{flex:1}}>
                  <Text style={{color:text,fontWeight:'700',fontSize:FONT.base}}>{c.bank}</Text>
                  <Text style={{color:sub,fontSize:FONT.xs,fontFamily:'monospace'}}>#{c.number}</Text>
                  <Text style={{color:sub,fontSize:10,marginTop:2}}>{formatDate(c.date)}</Text>
                  {/* customer name — dashboard view میں دکھائیں */}
                  {c.customerName && (
                    <TouchableOpacity
                      onPress={()=>c.customerId && navigation.navigate('CustomerDetail',{customerId:c.customerId})}
                    >
                      <Text style={{color:COLORS.blue600,fontSize:10,fontWeight:'700',marginTop:3}}>
                        👤 {c.customerName}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {c.invoiceId && (
                    <Text style={{color:sub,fontSize:9,marginTop:2,backgroundColor:dark?COLORS.slate700:COLORS.slate100,paddingHorizontal:4,paddingVertical:2,borderRadius:4,alignSelf:'flex-start'}}>
                      Invoice #{c.invoiceId}
                    </Text>
                  )}
                </View>
                <View style={{alignItems:'flex-end'}}>
                  <Text style={{color:text,fontWeight:'800',fontSize:FONT.md}}>{formatMoney(c.amount,settings.currency)}</Text>
                  <View style={[styles.statusBadge,{
                    backgroundColor:c.status==='cleared'?COLORS.green50:c.status==='returned'?COLORS.red50:COLORS.orange50
                  }]}>
                    <Text style={{fontSize:FONT.xs,fontWeight:'700',
                      color:c.status==='cleared'?COLORS.success:c.status==='returned'?COLORS.danger:COLORS.warning}}>
                      {c.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Action buttons */}
              <View style={[styles.actionRow,{borderTopColor:brd}]}>
                {c.status!=='cleared' && (
                  <TouchableOpacity style={[styles.actBtn,{backgroundColor:COLORS.green50}]}
                    onPress={()=>updateStatus(c.id,'cleared')}>
                    <Text style={{color:COLORS.success,fontWeight:'700',fontSize:FONT.xs}}>Mark Clear</Text>
                  </TouchableOpacity>
                )}
                {c.status!=='returned' && (
                  <TouchableOpacity style={[styles.actBtn,{backgroundColor:COLORS.red50}]}
                    onPress={()=>updateStatus(c.id,'returned')}>
                    <Text style={{color:COLORS.danger,fontWeight:'700',fontSize:FONT.xs}}>Mark Return</Text>
                  </TouchableOpacity>
                )}
                {c.status==='returned' && (
                  <TouchableOpacity style={[styles.actBtn,{backgroundColor:COLORS.blue50}]}
                    onPress={()=>updateStatus(c.id,'cleared')}>
                    <Text style={{color:COLORS.info,fontWeight:'700',fontSize:FONT.xs}}>Re-Clear</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.actBtn,{backgroundColor:dark?COLORS.slate700:COLORS.slate100}]}
                  onPress={()=>handleEdit(c)}>
                  <Text style={{color:sub,fontWeight:'700',fontSize:FONT.xs}}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actBtn,{backgroundColor:COLORS.red50}]}
                  onPress={()=>handleDelete(c.id)}>
                  <Text style={{color:COLORS.danger,fontWeight:'700',fontSize:FONT.xs}}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          </FadeSlideIn>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex:1 },
  header:      { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:SPACING.lg },
  summaryRow:  { flexDirection:'row', padding:SPACING.md, gap:SPACING.sm, borderBottomWidth:1 },
  summaryChip: { flex:1, alignItems:'center', padding:SPACING.sm, borderRadius:RADIUS.lg },
  filterTab:   { paddingHorizontal:SPACING.md, paddingVertical:6, borderRadius:RADIUS.full, backgroundColor:COLORS.slate200 },
  filterTabActive:{ backgroundColor:COLORS.slate800 },
  filterTabText:  { fontSize:FONT.xs, fontWeight:'700', color:COLORS.slate600 },
  chequeCard:  { borderRadius:RADIUS.lg, padding:SPACING.md, marginBottom:SPACING.sm, borderLeftWidth:4, ...SHADOW.sm },
  statusBadge: { paddingHorizontal:SPACING.sm, paddingVertical:3, borderRadius:RADIUS.sm, marginTop:4 },
  actionRow:   { flexDirection:'row', gap:SPACING.sm, marginTop:SPACING.sm, paddingTop:SPACING.sm, borderTopWidth:1, flexWrap:'wrap' },
  actBtn:      { paddingHorizontal:SPACING.md, paddingVertical:SPACING.sm, borderRadius:RADIUS.md },
});
