import React, { useState, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, Linking, Modal, TextInput, Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Print   from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useApp } from '../context/AppContext';
import AppButton from '../components/ui/AppButton';
import AppInput  from '../components/ui/AppInput';
import { FadeSlideIn, ScalePress, SlideModal } from '../components/ui/Animated';
import { calculateLedgerBalance, safeParseAmount } from '../utils/ledger';
import { formatMoney, formatMoneyCompact, formatDate, generateId, getWaLink, todayISO } from '../utils/helpers';
import { buildLedgerHTML } from '../utils/pdfTemplates';
import { COLORS, SPACING, RADIUS, FONT, SHADOW } from '../utils/theme';

export default function CustomerDetailScreen() {
  const navigation = useNavigation();
  const { params }  = useRoute();
  const {
    customers, invoices, cheques, settings, profile,
    saveData, deleteData, showAlert, showConfirm, showPrompt,
  } = useApp();
  const dark   = settings.mode === 'dark';
  const bg     = dark ? COLORS.bgDark     : COLORS.bgLight;
  const card   = dark ? COLORS.surfaceDark : COLORS.white;
  const text   = dark ? COLORS.textDark   : COLORS.textLight;
  const sub    = dark ? COLORS.slate400   : COLORS.slate500;
  const border = dark ? COLORS.borderDark : COLORS.borderLight;

  const [editData,     setEditData]     = useState(null); // null=closed, obj=editing

  // ── Enter key chain refs ───────────────────────────────────
  const refEditCompany  = useRef(null);
  const refEditMobile   = useRef(null);
  const refEditAddress  = useRef(null);
  const refPayDate      = useRef(null);
  const refPayBank      = useRef(null);
  const refPayChequeNo  = useRef(null);
  const refPayDesc      = useRef(null);
  const [showBills,    setShowBills]    = useState(false);
  const [showCheques,  setShowCheques]  = useState(false);
  const [showLedger,   setShowLedger]   = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payType,      setPayType]      = useState('cash');
  const [payForm,      setPayForm]      = useState({ amount:'', date:todayISO(), desc:'', bank:'', chequeNo:'', invoiceId:'' });
  const [ledgerLimit,  setLedgerLimit]  = useState(20);
  const [startDate,    setStartDate]    = useState('');
  const [endDate,      setEndDate]      = useState('');
  const [showFilter,   setShowFilter]   = useState(false);

  const cData = customers.find(c => String(c.id) === String(params?.customerId));

  const { sortedLedger, finalBalance: netBalance } = calculateLedgerBalance(
    cData?.ledger, { useEffective:true }
  );

  const filteredLedger = useMemo(() => {
    if (!startDate || !endDate) return sortedLedger || [];
    const start = new Date(startDate + 'T00:00:00');
    const end   = new Date(endDate   + 'T23:59:59');
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return sortedLedger || [];

    // ── Opening balance: filter سے پہلے کی تمام entries کا بقایا ──
    let openingBal = 0;
    (sortedLedger || []).forEach(tx => {
      const d = new Date(tx.date);
      if (d < start) {
        const amt = safeParseAmount(tx.amount);
        openingBal += tx.type === 'Debit' ? amt : (tx._skipped ? 0 : -amt);
      }
    });

    const raw = sortedLedger.filter(tx => {
      const d = new Date(tx.date);
      return d >= start && d <= end;
    });

    // اگر filter range میں کچھ نہیں تو opening balance entry دکھائیں
    if (raw.length === 0) return [];

    // ── Running balance: opening سے شروع ────────────────────────
    let fb = openingBal;
    const mapped = raw.map(tx => {
      const amt = safeParseAmount(tx.amount);
      fb += tx.type === 'Debit' ? amt : (tx._skipped ? 0 : -amt);
      return { ...tx, currentBal: fb };
    });

    // ── Opening balance row — سب سے پہلے دکھائیں ────────────────
    if (openingBal !== 0) {
      const openingRow = {
        id:         'opening-balance-row',
        date:       startDate,
        createdAt:  '0',
        type:       openingBal > 0 ? 'Debit' : 'Credit',
        amount:     Math.abs(openingBal),
        desc:       `Opening Balance (${startDate} سے پہلے)`,
        currentBal: openingBal,
        _skipped:   false,
        _isOpening: true,
      };
      return [openingRow, ...mapped];
    }
    return mapped;
  }, [sortedLedger, startDate, endDate]);

  if (!cData) return (
    <View style={{flex:1,justifyContent:'center',alignItems:'center'}}>
      <Text>Customer not found</Text>
    </View>
  );

  const displayLedger = [...filteredLedger].reverse().slice(0, ledgerLimit);
  const hasMore = filteredLedger.length > ledgerLimit;

  const totalBilled  = sortedLedger.filter(tx=>tx.type==='Debit').reduce((a,b)=>a+safeParseAmount(b.amount),0);
  const totalCredits = sortedLedger.filter(tx=>tx.type==='Credit'&&!tx._skipped).reduce((a,b)=>a+safeParseAmount(b.amount),0);
  const custInvs     = invoices.filter(i=>i.customer&&String(i.customer.id)===String(cData.id)).sort((a,b)=>b.id-a.id);
  const custCheques  = cheques.filter(c=>String(c.customerId)===String(cData.id));
  const pendingCount = custCheques.filter(c=>c.status==='pending').length;

  const handleUpdate = () => {
    if (!editData?.name?.trim()) {
      Alert.alert('Required', 'Customer name cannot be empty');
      return;
    }
    const snapshot = { ...editData };
    setEditData(null);  // modal بند

    // Background میں save + sync
    saveData('customers', snapshot.id, snapshot);
    const strId = String(snapshot.id);
    Promise.all(
      invoices.filter(inv => inv.customer && String(inv.customer.id) === strId)
        .map(inv => saveData('invoices', inv.id, {
          ...inv,
          customer: {
            ...inv.customer,
            name:    snapshot.name,
            mobile:  snapshot.mobile  || inv.customer.mobile,
            address: snapshot.address || inv.customer.address,
            company: snapshot.company || inv.customer.company,
          },
        }))
    );
    Promise.all(
      cheques.filter(c => String(c.customerId) === strId)
        .map(c => saveData('cheques', c.id, { ...c, customerName: snapshot.name }))
    );
  };

  const handleSavePayment = async () => {
    if (!payForm.amount) { await showAlert('Please enter amount','Required'); return; }
    const payAmount = safeParseAmount(payForm.amount);
    if (payAmount <= 0) return;
    const payId = String(Date.now());
    const newTx = {
      id: payId, createdAt: payId, date: payForm.date,
      desc: payForm.desc || (payType==='cash' ? 'Cash Received' : `Cheque (${payForm.chequeNo})`),
      amount: payAmount, type:'Credit',
      method: payType==='cheque' ? 'Cheque' : 'Cash',
      chequeStatus: payType==='cheque' ? 'pending' : undefined,
      invoiceId: payForm.invoiceId || undefined,
    };
    if (payType==='cheque') {
      if (!payForm.bank||!payForm.chequeNo) { await showAlert('Bank and Cheque No required','Required'); return; }
      const chq = { id:generateId('chq'), date:payForm.date, amount:payAmount, bank:payForm.bank, number:payForm.chequeNo, status:'pending', customerId:cData.id, customerName:cData.name };
      saveData('cheques', chq.id, chq);
    }
    const updLedger = [newTx, ...(cData.ledger||[]).filter(t=>String(t.id)!==payId)];
    setShowPayModal(false);
    setPayType('cash');
    setPayForm({ amount:'', date:todayISO(), desc:'', bank:'', chequeNo:'', invoiceId:'' });
    saveData('customers', cData.id, { ...cData, ledger:updLedger });
  };

  const handleDeletePayment = async (tx) => {
    if (tx.invoiceId) { await showAlert('This entry is linked to an invoice — delete the invoice first','Locked'); return; }
    const ok = await showConfirm('Delete this payment?','Confirm');
    if (!ok) return;
    const upd = (cData.ledger||[]).filter(t=>t.id!==tx.id);
    saveData('customers', cData.id, { ...cData, ledger:upd });
  };

  const handleDeleteCustomer = async () => {
    if (!settings.securityPin) { await showAlert('Set a Master PIN in Settings first','Security'); return; }
    const ok = await showConfirm('Delete customer and ALL invoices permanently!','Delete Customer');
    if (!ok) return;
    const pin = await showPrompt('Enter Master PIN:','','Confirm');
    if (pin === null) return;
    if (pin !== settings.securityPin) { await showAlert('Wrong PIN! Action cancelled.','Error'); return; }
    custInvs.forEach(i => deleteData('invoices', i.id));
    custCheques.forEach(c => deleteData('cheques', c.id));
    await deleteData('customers', cData.id);
    navigation.goBack();
  };

  const handleChequeStatusUpdate = async (c, newStatus) => {
    const confirmMsg =
      newStatus === 'cleared'  ? `✅ چیک کلئیر مارک کریں؟\n${c.bank} #${c.number}\nرقم: ${formatMoney(c.amount, settings.currency)}` :
      newStatus === 'returned' ? `⚠️ چیک ریٹرن مارک کریں؟\n${c.bank} #${c.number}\nرقم: ${formatMoney(c.amount, settings.currency)}` :
      `چیک پینڈنگ کریں؟`;
    const ok = await showConfirm(confirmMsg);
    if (!ok) return;

    const oldStatus = c.status;
    const ts  = String(Date.now());
    const amt = safeParseAmount(c.amount);
    const today = new Date().toISOString().split('T')[0];

    // ── Step 1: cheque record update ──────────────────────
    saveData('cheques', c.id, { ...c, status: newStatus });

    // ── Step 2: Ledger entries آپ کے فلو کے مطابق ──────────
    //
    // فلو:
    // Invoice میں چیک داخل  → pending Credit  → بیلنس فوری مائنس (30,000)
    // Cleared               → status بدلے    → بیلنس ویسا ہی رہے (30,000) ✅
    // Returned (pending→)  → Debit entry add  → بیلنس واپس 50,000 ⚠️
    // دوبارہ Cleared (ret→) → Credit entry add → بیلنس واپس 30,000 ✅
    // Cleared → Returned   → Debit entry add  → بیلنس واپس بڑھے ⚠️
    //
    // ledger میں original chq-inv entry کا chequeStatus sync کریں
    const updatedLedger = (cData.ledger || []).map(tx => {
      const isLinked =
        (tx.chequeId && String(tx.chequeId) === String(c.id)) ||
        (String(tx.id || '') === 'chq-inv-' + String(c.id));
      if (!isLinked) return tx;
      return { ...tx, chequeStatus: newStatus };
    });

    let finalLedger = updatedLedger;

    if (oldStatus === 'pending' && newStatus === 'returned') {
      // pending چیک واپس → بیلنس 50,000 پر آئے
      // pending Credit already effective تھی (balance کم کر رہی تھی)
      // returned کرنے پر وہ Credit غیر مؤثر ہوگی — balance خود بڑھ جائے گا
      // کوئی اضافی entry نہیں چاہیے — ledger engine سنبھال لے گا ✅
      finalLedger = updatedLedger;

    } else if (oldStatus === 'returned' && newStatus === 'cleared') {
      // دوبارہ کلئیر → بیلنس 30,000 پر آئے
      // returned Credit غیر مؤثر تھی — cleared کرنے پر مؤثر ہوگی
      // ledger engine خود سنبھالے گا ✅
      finalLedger = updatedLedger;

    } else if (oldStatus === 'cleared' && newStatus === 'returned') {
      // cleared چیک کو واپس مارک کریں (غلطی کی اصلاح)
      // cleared Credit مؤثر تھی — returned ہونے پر غیر مؤثر ہوگی ✅
      finalLedger = updatedLedger;

    } else if (oldStatus === 'pending' && newStatus === 'cleared') {
      // pending تھا پہلے سے balance کم کر رہا تھا — کوئی فرق نہیں ✅
      finalLedger = updatedLedger;
    }

    saveData('customers', cData.id, { ...cData, ledger: finalLedger });

    // ── Step 3: WhatsApp Reminder — صرف Return پر ──────────
    if (newStatus === 'returned' && cData.mobile) {
      const newBalance = (() => {
        const { finalBalance } = calculateLedgerBalance(finalLedger, { useEffective: true });
        return finalBalance;
      })();

      const waMsg = encodeURIComponent(
        `السلام علیکم ${cData.name}،\n\n` +
        `آپ کا چیک واپس آ گیا ہے:\n` +
        `🏦 بینک: ${c.bank}\n` +
        `🔢 نمبر: #${c.number}\n` +
        `💰 رقم: ${formatMoney(amt, settings.currency)}\n\n` +
        `آپ کا کل بقایا: ${formatMoney(newBalance, settings.currency)}\n\n` +
        `براہ کرم جلد از جلد ادائیگی کریں۔\n` +
        `— ${profile?.name || 'Timber 360'}`
      );
      let mobile = cData.mobile.toString().replace(/[^0-9]/g, '');
      if (mobile.startsWith('0')) mobile = '92' + mobile.substring(1);
      Linking.openURL(`https://wa.me/${mobile}?text=${waMsg}`);
    }
  };

  const handleLedgerPDF = async () => {
    try {
      const html = buildLedgerHTML(cData, sortedLedger, filteredLedger, startDate||null, endDate||null, settings, profile);
      const { uri } = await Print.printToFileAsync({ html, base64:false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType:'application/pdf', dialogTitle:`Ledger - ${cData.name}` });
      }
    } catch(e) { console.error('Ledger PDF:', e); }
  };

  // ── Edit mode ────────────────────────────────────────────────
  if (editData) return (
    <View style={{flex:1,backgroundColor:bg}}>
      <View style={[styles.modalHdr,{backgroundColor:card,borderBottomColor:border}]}>
        <TouchableOpacity onPress={()=>setEditData(null)}>
          <Text style={{color:COLORS.primary,fontSize:22}}>✕</Text>
        </TouchableOpacity>
        <Text style={{fontSize:FONT.md,fontWeight:'700',color:text}}>Edit Customer</Text>
        <TouchableOpacity onPress={handleUpdate}>
          <Text style={{color:COLORS.primary,fontSize:FONT.md,fontWeight:'700'}}>Save</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{padding:SPACING.md,paddingBottom:80}} keyboardShouldPersistTaps="handled">
        <View style={[styles.formCard,{backgroundColor:card}]}>
          <AppInput label="Name"    value={editData.name||''}    onChangeText={v=>setEditData(p=>({...p,name:v}))}    dark={dark} returnKeyType="next" onSubmitEditing={()=>refEditCompany.current?.focus()} />
          <AppInput label="Company"  ref={refEditCompany} value={editData.company||''} onChangeText={v=>setEditData(p=>({...p,company:v}))} dark={dark} returnKeyType="next" onSubmitEditing={()=>refEditMobile.current?.focus()} />
          <AppInput label="Mobile" ref={refEditMobile} value={editData.mobile||''}  onChangeText={v=>setEditData(p=>({...p,mobile:v}))}  keyboardType="phone-pad" dark={dark} returnKeyType="next" onSubmitEditing={()=>refEditAddress.current?.focus()} />
          <AppInput label="Address"    ref={refEditAddress} value={editData.address||''} onChangeText={v=>setEditData(p=>({...p,address:v}))} dark={dark} returnKeyType="done" onSubmitEditing={handleUpdate} />
        </View>
        <TouchableOpacity style={styles.deleteRow} onPress={handleDeleteCustomer}>
          <Text style={{color:COLORS.danger,fontSize:FONT.sm}}>🗑️ Permanently Delete Customer</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  return (
    <View style={{flex:1,backgroundColor:bg}}>
      <ScrollView contentContainerStyle={{padding:SPACING.md,paddingBottom:80}}>

        <FadeSlideIn delay={0}>
        </FadeSlideIn>

        {/* Profile Card */}
        <View style={styles.profileCard}>
            <TouchableOpacity
              style={styles.editIcon}
              onPress={()=>setEditData({...cData})}
              hitSlop={{top:10,bottom:10,left:10,right:10}}
            >
              <Text>✏️</Text>
            </TouchableOpacity>
            <Text style={styles.custName}>{cData.name}</Text>
            {cData.company ? <Text style={styles.custInfo}>{cData.company}</Text> : null}
            {cData.mobile  ? <Text style={styles.custInfo}>{cData.mobile}</Text>  : null}
            <View style={styles.profileStats}>
              <View style={{alignItems:'center'}}>
                <Text style={{color:COLORS.slate300,fontSize:FONT.xs,fontWeight:'700'}}>Total Billed</Text>
                <Text style={{color:COLORS.white,fontWeight:'800',fontSize:FONT.md}}>{formatMoney(totalBilled,settings.currency)}</Text>
              </View>
              <View style={{alignItems:'center'}}>
                <Text style={{color:COLORS.slate300,fontSize:FONT.xs,fontWeight:'700'}}>Received</Text>
                <Text style={{color:COLORS.primaryLight,fontWeight:'800',fontSize:FONT.md}}>{formatMoney(totalCredits,settings.currency)}</Text>
              </View>
              <View style={{alignItems:'center'}}>
                <Text style={{color:COLORS.slate300,fontSize:FONT.xs,fontWeight:'700'}}>Balance</Text>
                <Text style={{color:netBalance>0?COLORS.warning:COLORS.primaryLight,fontWeight:'800',fontSize:FONT.md}}>{formatMoney(netBalance,settings.currency)}</Text>
              </View>
            </View>
            <View style={styles.actionRow}>
              {cData.mobile ? (
                <ScalePress style={styles.actionBtn} onPress={()=>Linking.openURL(`tel:${cData.mobile}`)}>
                  <Text style={{color:COLORS.white,fontWeight:'700'}}>📞 Call</Text>
                </ScalePress>
              ) : null}
              {cData.mobile ? (
                <ScalePress style={[styles.actionBtn,{backgroundColor:COLORS.teal500}]}
                  onPress={()=>Linking.openURL(getWaLink(cData.mobile,cData.name,netBalance,settings.currency))}>
                  <Text style={{color:COLORS.white,fontWeight:'700'}}>💬 WhatsApp</Text>
                </ScalePress>
              ) : null}
            </View>
            <ScalePress style={styles.newInvBtn} onPress={()=>navigation.navigate('InvoiceEditor',{prefillCustomer:cData})}>
              <Text style={{color:COLORS.slate900,fontWeight:'800',fontSize:FONT.base}}>✚ New Invoice</Text>
            </ScalePress>
        </View>

        {/* Section buttons */}
        <View>
          <View style={{flexDirection:'row',gap:SPACING.md,marginBottom:SPACING.md}}>
            <ScalePress style={[styles.secBtn,{backgroundColor:card,borderColor:border}]} onPress={()=>setShowBills(!showBills)}>
              <Text style={{color:text,fontWeight:'700'}}>📋 Invoice {showBills?'▲':'▼'} ({custInvs.length})</Text>
            </ScalePress>
            <ScalePress style={[styles.secBtn,{backgroundColor:'#FFF7ED',borderColor:'#FED7AA'}]} onPress={()=>setShowCheques(true)}>
              <Text style={{color:COLORS.warning,fontWeight:'700'}}>💳 Cheques{pendingCount>0?` (${pendingCount})`:''}</Text>
            </ScalePress>
          </View>
        </View>

        {showBills && (
          <View style={{marginBottom:SPACING.md}}>
            {custInvs.length === 0 ? (
              <Text style={{color:sub,textAlign:'center',padding:SPACING.lg,fontSize:FONT.sm}}>
                No invoices found.
              </Text>
            ) : custInvs.map(inv=>{
              const tot     = safeParseAmount(inv.total);
              const cash    = safeParseAmount(inv.cashPaid);
              const chqClrd = (inv.cheques||[]).filter(c=>c.status==='cleared').reduce((a,c)=>a+safeParseAmount(c.amount),0);
              const chqPend = (inv.cheques||[]).filter(c=>c.status==='pending').reduce((a,c)=>a+safeParseAmount(c.amount),0);
              const paid    = cash + chqClrd;
              const bal     = tot - paid;
              const stBg    = bal<=0 ? '#dcfce7' : (paid>0||chqPend>0) ? '#fef3c7' : '#fee2e2';
              const stCol   = bal<=0 ? '#166534' : (paid>0||chqPend>0) ? '#92400e' : '#991b1b';
              const stLbl   = bal<=0 ? '✓ PAID'  : (paid>0||chqPend>0) ? '~ PARTIAL' : '● UNPAID';
              return (
              <ScalePress key={inv.id} style={[styles.invRow,{backgroundColor:card,borderColor:border}]}
                onPress={()=>navigation.navigate('InvoiceView',{invoice:inv})}>
                <View style={{flex:1}}>
                  <View style={{flexDirection:'row',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                    <Text style={{color:COLORS.primary,fontWeight:'700'}}>Invoice #{inv.id}</Text>
                    <View style={{backgroundColor:stBg,paddingHorizontal:5,paddingVertical:2,borderRadius:4}}>
                      <Text style={{color:stCol,fontSize:8,fontWeight:'800'}}>{stLbl}</Text>
                    </View>
                  </View>
                  <Text style={{color:sub,fontSize:FONT.xs}}>{formatDate(inv.date)} • {inv.items?.length||0} items</Text>
                </View>
                <View style={{alignItems:'flex-end'}}>
                  <Text style={{color:text,fontWeight:'700'}}>{formatMoney(inv.total,settings.currency)}</Text>
                  <TouchableOpacity
                    style={styles.editSmallBtn}
                    onPress={()=>navigation.navigate('InvoiceEditor',{invoiceId:inv.id})}
                    hitSlop={{top:8,bottom:8,left:8,right:8}}
                  >
                    <Text style={{color:COLORS.slate500,fontSize:FONT.xs}}>✏️ Edit</Text>
                  </TouchableOpacity>
                </View>
              </ScalePress>
              );
            })}
          </View>
        )}

        <ScalePress style={styles.ledgerBtn} onPress={()=>setShowLedger(true)}>
          <Text style={{color:COLORS.white,fontWeight:'800',fontSize:FONT.base}}>📒 Ledger / Cash In</Text>
        </ScalePress>
      </ScrollView>

      {/* ── LEDGER MODAL ─────────────────────────────────────── */}
      <Modal visible={showLedger} animationType="slide" onRequestClose={()=>setShowLedger(false)}>
        <View style={[styles.modalRoot,{backgroundColor:bg}]}>
          {/* Header */}
          <View style={[styles.modalHdr,{backgroundColor:card,borderBottomColor:border}]}>
            <TouchableOpacity onPress={()=>setShowLedger(false)}>
              <Text style={{color:COLORS.primary,fontSize:22}}>‹</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle,{color:text}]} numberOfLines={1}>{cData.name}</Text>
            <View style={{flexDirection:'row',gap:SPACING.sm}}>
              <TouchableOpacity style={[styles.hdrBtn,{backgroundColor:COLORS.indigo600}]} onPress={()=>setShowFilter(!showFilter)}>
                <Text style={{color:COLORS.white,fontWeight:'700',fontSize:FONT.xs}}>🗓 Filter</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.hdrBtn,{backgroundColor:'#4f46e5'}]} onPress={handleLedgerPDF}>
                <Text style={{color:COLORS.white,fontWeight:'700',fontSize:FONT.xs}}>📄 PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.hdrBtn} onPress={()=>setShowPayModal(true)}>
                <Text style={{color:COLORS.white,fontWeight:'700',fontSize:FONT.xs}}>+ Cash In</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Date filter panel */}
          {showFilter && (<View>
            <View style={[{backgroundColor:card,padding:SPACING.md,borderBottomWidth:1,borderBottomColor:border}]}>
              <View style={{flexDirection:'row',gap:SPACING.sm,alignItems:'center'}}>
                <View style={{flex:1}}>
                  <Text style={{color:sub,fontSize:FONT.xs,marginBottom:4}}>Start Date</Text>
                  <TextInput value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD"
                    placeholderTextColor={sub} style={[styles.filterInput,{color:text,borderColor:border,backgroundColor:bg}]} />
                </View>
                <View style={{flex:1}}>
                  <Text style={{color:sub,fontSize:FONT.xs,marginBottom:4}}>End Date</Text>
                  <TextInput value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD"
                    placeholderTextColor={sub} style={[styles.filterInput,{color:text,borderColor:border,backgroundColor:bg}]} />
                </View>
                <TouchableOpacity style={{backgroundColor:COLORS.danger,padding:SPACING.sm,borderRadius:RADIUS.md,marginTop:16}}
                  onPress={()=>{ setStartDate(''); setEndDate(''); }}>
                  <Text style={{color:COLORS.white,fontSize:FONT.xs,fontWeight:'700'}}>✕ Clear</Text>
                </TouchableOpacity>
              </View>
              {(startDate||endDate) && (
                <Text style={{color:COLORS.primary,fontSize:FONT.xs,marginTop:SPACING.sm,fontWeight:'700'}}>
                  {filteredLedger.length} entries shown
                </Text>
              )}
            </View>
          </View>)}

          {/* Balance summary */}
          <View style={[styles.balBox,{backgroundColor:card,borderColor:border}]}>
            <View style={{alignItems:'center'}}>
              <Text style={{color:sub,fontSize:FONT.xs,fontWeight:'700'}}>Total Billed</Text>
              <Text style={{color:COLORS.warning,fontWeight:'900',fontSize:FONT.lg}}>{formatMoney(totalBilled,settings.currency)}</Text>
            </View>
            <View style={{alignItems:'center'}}>
              <Text style={{color:sub,fontSize:FONT.xs,fontWeight:'700'}}>Received</Text>
              <Text style={{color:COLORS.success,fontWeight:'900',fontSize:FONT.lg}}>{formatMoney(totalCredits,settings.currency)}</Text>
            </View>
            <View style={{alignItems:'center'}}>
              <Text style={{color:sub,fontSize:FONT.xs,fontWeight:'700'}}>Balance</Text>
              <Text style={{color:netBalance>0?COLORS.warning:COLORS.success,fontWeight:'900',fontSize:FONT.lg}}>{formatMoney(netBalance,settings.currency)}</Text>
            </View>
          </View>

          {/* ── Table Header ── */}
          <View style={{flexDirection:'row',backgroundColor:dark?COLORS.slate700:COLORS.slate800,paddingVertical:8,paddingHorizontal:SPACING.sm}}>
            <Text style={{color:'#94a3b8',fontSize:9,fontWeight:'700',width:60,textTransform:'uppercase'}}>Date</Text>
            <Text style={{color:'#94a3b8',fontSize:9,fontWeight:'700',flex:1,textTransform:'uppercase'}}>Description</Text>
            <Text style={{color:'#fca5a5',fontSize:9,fontWeight:'700',width:68,textAlign:'right',textTransform:'uppercase'}}>Debit</Text>
            <Text style={{color:'#86efac',fontSize:9,fontWeight:'700',width:68,textAlign:'right',textTransform:'uppercase'}}>Credit</Text>
            <Text style={{color:'#94a3b8',fontSize:9,fontWeight:'700',width:68,textAlign:'right',textTransform:'uppercase'}}>Balance</Text>
            <View style={{width:28}}/>
          </View>

          <ScrollView contentContainerStyle={{paddingBottom:80}}>
            {displayLedger.length===0 ? (
              <View style={{alignItems:'center',marginTop:40}}>
                <Text style={{fontSize:32}}>📒</Text>
                <Text style={{color:sub,marginTop:SPACING.md}}>No entries in this period</Text>
              </View>
            ) : displayLedger.map((tx,i)=>{
              const isDebit = tx.type==='Debit';
              const isOpening = tx._isOpening === true;
              const method = tx.method;
              const methodLabel = !isOpening && (method==='Cheque'
                ? ('🏦 Cheque'+(tx.chequeStatus?' ('+tx.chequeStatus+')':''))
                : method==='Cash' ? '💵 Cash' : null);
              const methodColor = method==='Cheque'
                ? (tx.chequeStatus==='cleared'?COLORS.success:tx.chequeStatus==='returned'?COLORS.danger:COLORS.warning)
                : COLORS.primary;
              return (
                <View key={tx.id||i} style={{
                  borderBottomWidth:1,borderBottomColor:border,
                  backgroundColor: isOpening
                    ? (dark?'rgba(99,102,241,0.15)':'#EEF2FF')
                    : i%2===0?(dark?'rgba(255,255,255,0.025)':'#fafafa'):(dark?'transparent':'#fff')
                }}>
                  <View style={{flexDirection:'row',alignItems:'flex-start',paddingVertical:SPACING.sm,paddingHorizontal:SPACING.sm}}>
                    <View style={{width:60}}>
                      <Text style={{color:sub,fontSize:9,lineHeight:13}}>{formatDate(tx.date)}</Text>
                    </View>
                    <View style={{flex:1,paddingRight:4}}>
                      <Text style={{
                        color: isOpening ? COLORS.indigo600 : text,
                        fontSize:FONT.sm,
                        fontWeight: isOpening ? '700' : '600',
                        lineHeight:18,
                        fontStyle: isOpening ? 'italic' : 'normal',
                      }} numberOfLines={2}>
                        {tx.desc}
                      </Text>
                      {methodLabel ? (
                        <Text style={{fontSize:9,fontWeight:'700',color:methodColor,marginTop:2}}>
                          {methodLabel}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={{width:68,textAlign:'right',color:isDebit&&!isOpening?'#ef4444':'transparent',fontWeight:'700',fontSize:FONT.sm}}>
                      {isDebit&&!isOpening?formatMoneyCompact(tx.amount,settings.currency):''}
                    </Text>
                    <Text style={{width:68,textAlign:'right',color:tx._skipped?COLORS.slate400:COLORS.success,fontWeight:'700',fontSize:FONT.sm}}>
                      {!isDebit&&!isOpening?(tx._skipped?'⏳':formatMoney(tx.amount,settings.currency)):''}
                    </Text>
                    <Text style={{width:68,textAlign:'right',fontWeight:'800',fontSize:FONT.sm,
                      color:(tx.currentBal||0)>0?COLORS.warning:(tx.currentBal||0)<0?COLORS.danger:COLORS.success}}>
                      {formatMoneyCompact(tx.currentBal||0,settings.currency)}
                    </Text>
                    <View style={{width:28,alignItems:'center',justifyContent:'center',paddingTop:2}}>
                      {isOpening ? (
                        <Text style={{color:COLORS.indigo600,fontSize:11}}>↑</Text>
                      ) : tx.invoiceId ? (
                        <Text style={{color:COLORS.slate400,fontSize:12}}>🔒</Text>
                      ) : (
                        <TouchableOpacity
                          onPress={()=>handleDeletePayment(tx)}
                          hitSlop={{top:8,bottom:8,left:8,right:8}}
                        >
                          <Text style={{color:COLORS.slate400,fontSize:12}}>🗑️</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
            {hasMore && (
              <TouchableOpacity style={styles.loadMore} onPress={()=>setLedgerLimit(l=>l+20)}>
                <Text style={{color:COLORS.primary,fontWeight:'700'}}>Load More ↓</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ── PAYMENT SLIDE MODAL ──────────────────────────────── */}
      <SlideModal visible={showPayModal} onClose={()=>{ setShowPayModal(false); setPayType('cash'); setPayForm({ amount:'', date:todayISO(), desc:'', bank:'', chequeNo:'', invoiceId:'' }); }} style={{backgroundColor:card}}>
        <View style={{padding:SPACING.xl,paddingBottom:40}}>
          <Text style={[styles.payTitle,{color:text}]}>Receive Payment</Text>
          <View style={styles.payTypRow}>
            {['cash','cheque'].map(t=>(
              <TouchableOpacity key={t}
                style={[styles.payTypeBtn,payType===t&&styles.payTypeBtnActive]}
                onPress={()=>setPayType(t)}
              >
                <Text style={[{fontWeight:'700',fontSize:FONT.sm},payType===t&&{color:COLORS.white}]}>
                  {t==='cash'?'💵 Cash':'💳 Cheque'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <AppInput label="Amount *" value={payForm.amount} onChangeText={v=>setPayForm(p=>({...p,amount:v}))} keyboardType="numeric" dark={dark} returnKeyType="next" onSubmitEditing={()=>refPayDate.current?.focus()} />
          <AppInput label="Date"     ref={refPayDate} value={payForm.date}   onChangeText={v=>setPayForm(p=>({...p,date:v}))}   dark={dark} returnKeyType={payType==='cheque'?'next':'next'} onSubmitEditing={()=>payType==='cheque'?refPayBank.current?.focus():refPayDesc.current?.focus()} />
          {payType==='cheque' && <>
            <AppInput label="Bank *"      ref={refPayBank} value={payForm.bank}     onChangeText={v=>setPayForm(p=>({...p,bank:v}))}     dark={dark} returnKeyType="next" onSubmitEditing={()=>refPayChequeNo.current?.focus()} />
            <AppInput label="Cheque No *" ref={refPayChequeNo} value={payForm.chequeNo} onChangeText={v=>setPayForm(p=>({...p,chequeNo:v}))} dark={dark} returnKeyType="next" onSubmitEditing={()=>refPayDesc.current?.focus()} />
          </>}
          <AppInput label="Description (optional)" ref={refPayDesc} value={payForm.desc} onChangeText={v=>setPayForm(p=>({...p,desc:v}))} dark={dark} returnKeyType="done" onSubmitEditing={handleSavePayment} />
          {custInvs.length>0 && (
            <View style={{marginBottom:SPACING.md}}>
              <Text style={{color:sub,fontSize:FONT.xs,fontWeight:'700',marginBottom:4,textTransform:'uppercase'}}>Link to Invoice</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity
                  style={[styles.invChip,!payForm.invoiceId&&styles.invChipActive]}
                  onPress={()=>setPayForm(p=>({...p,invoiceId:''}))}
                >
                  <Text style={[styles.invChipText,!payForm.invoiceId&&{color:COLORS.white}]}>No Link</Text>
                </TouchableOpacity>
                {custInvs.slice(0,5).map(inv=>(
                  <TouchableOpacity key={inv.id}
                    style={[styles.invChip,payForm.invoiceId===String(inv.id)&&styles.invChipActive]}
                    onPress={()=>setPayForm(p=>({...p,invoiceId:String(inv.id)}))}
                  >
                    <Text style={[styles.invChipText,payForm.invoiceId===String(inv.id)&&{color:COLORS.white}]}>
                      #{inv.id}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          <View style={{flexDirection:'row',gap:SPACING.md,marginTop:SPACING.md}}>
            <AppButton variant="secondary" onPress={()=>setShowPayModal(false)} style={{flex:1}}>Cancel</AppButton>
            <AppButton variant="success"   onPress={handleSavePayment}          style={{flex:1}}>Save</AppButton>
          </View>
        </View>
      </SlideModal>

      {/* ── CHEQUES MODAL ────────────────────────────────────── */}
      <Modal visible={showCheques} animationType="slide" onRequestClose={()=>setShowCheques(false)}>
        <View style={[styles.modalRoot,{backgroundColor:bg}]}>
          <View style={[styles.modalHdr,{backgroundColor:card,borderBottomColor:border}]}>
            <TouchableOpacity onPress={()=>setShowCheques(false)}>
              <Text style={{color:COLORS.primary,fontSize:22}}>‹</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle,{color:text}]}>Cheques — {cData.name}</Text>
            <View style={{width:60}}/>
          </View>
          <ScrollView contentContainerStyle={{padding:SPACING.md}}>
            {custCheques.length===0
              ? <Text style={{color:sub,textAlign:'center',marginTop:60}}>No cheques</Text>
              : custCheques.map(c=>(
                <View key={c.id} style={[styles.chequeCard,{backgroundColor:card,
                  borderLeftColor:c.status==='cleared'?COLORS.success:c.status==='returned'?COLORS.danger:COLORS.warning}]}>
                  <View style={{flexDirection:'row',justifyContent:'space-between'}}>
                    <View>
                      <Text style={{color:text,fontWeight:'700',fontSize:FONT.base}}>{c.bank}</Text>
                      <Text style={{color:sub,fontSize:FONT.xs}}>#{c.number} • {formatDate(c.date)}</Text>
                    </View>
                    <View style={{alignItems:'flex-end'}}>
                      <Text style={{color:text,fontWeight:'800',fontSize:FONT.md}}>{formatMoney(c.amount,settings.currency)}</Text>
                      <View style={[styles.statusBadge,{backgroundColor:c.status==='cleared'?COLORS.green50:c.status==='returned'?COLORS.red50:COLORS.orange50}]}>
                        <Text style={{fontSize:FONT.xs,fontWeight:'700',color:c.status==='cleared'?COLORS.success:c.status==='returned'?COLORS.danger:COLORS.warning}}>
                          {c.status==='cleared'?'✓ Cleared':c.status==='returned'?'✗ Returned':'⏳ Pending'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={{flexDirection:'row',gap:SPACING.sm,marginTop:SPACING.sm,flexWrap:'wrap'}}>
                    {c.status!=='cleared'  && <TouchableOpacity style={[styles.chqBtn,{backgroundColor:COLORS.green50}]}
                      onPress={()=>handleChequeStatusUpdate(c,'cleared')}>
                      <Text style={{color:COLORS.success,fontWeight:'700',fontSize:FONT.xs}}>✓ Clear</Text></TouchableOpacity>}
                    {c.status!=='returned' && <TouchableOpacity style={[styles.chqBtn,{backgroundColor:COLORS.red50}]}
                      onPress={()=>handleChequeStatusUpdate(c,'returned')}>
                      <Text style={{color:COLORS.danger,fontWeight:'700',fontSize:FONT.xs}}>✗ Return</Text></TouchableOpacity>}
                    {c.status!=='pending'  && <TouchableOpacity style={[styles.chqBtn,{backgroundColor:COLORS.blue50}]}
                      onPress={()=>handleChequeStatusUpdate(c,'pending')}>
                      <Text style={{color:COLORS.info,fontWeight:'700',fontSize:FONT.xs}}>⟳ Pending</Text></TouchableOpacity>}
                  </View>
                </View>
              ))
            }
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  backRow:      { paddingVertical:SPACING.md },
  modalHdr:     { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:SPACING.md, borderBottomWidth:1 },
  profileCard:  { backgroundColor:COLORS.slate800, borderRadius:RADIUS.xxl, padding:SPACING.xl, marginBottom:SPACING.md, position:'relative' },
  editIcon:     { position:'absolute', top:SPACING.lg, right:SPACING.lg, backgroundColor:'rgba(255,255,255,0.1)', padding:SPACING.sm, borderRadius:RADIUS.full },
  custName:     { color:COLORS.white, fontSize:FONT.xxl, fontWeight:'800' },
  custInfo:     { color:COLORS.slate300, fontSize:FONT.sm, marginTop:2 },
  profileStats: { flexDirection:'row', justifyContent:'space-between', marginTop:SPACING.xl, paddingTop:SPACING.lg, borderTopWidth:1, borderTopColor:COLORS.slate700 },
  actionRow:    { flexDirection:'row', gap:SPACING.md, marginTop:SPACING.lg },
  actionBtn:    { flex:1, backgroundColor:COLORS.primary, padding:SPACING.md, borderRadius:RADIUS.xl, alignItems:'center' },
  newInvBtn:    { backgroundColor:COLORS.white, padding:SPACING.lg, borderRadius:RADIUS.xl, alignItems:'center', marginTop:SPACING.md },
  secBtn:       { flex:1, padding:SPACING.md, borderRadius:RADIUS.lg, alignItems:'center', borderWidth:1, ...SHADOW.sm },
  ledgerBtn:    { backgroundColor:COLORS.indigo600, padding:SPACING.lg, borderRadius:RADIUS.xl, alignItems:'center', marginBottom:SPACING.md },
  invRow:       { flexDirection:'row', padding:SPACING.md, borderRadius:RADIUS.lg, marginBottom:SPACING.sm, borderWidth:1, ...SHADOW.sm },
  editSmallBtn: { padding:4, backgroundColor:COLORS.slate100, borderRadius:RADIUS.sm, marginTop:4, alignItems:'center' },
  deleteRow:    { marginTop:SPACING.xl, paddingTop:SPACING.lg, borderTopWidth:1, borderTopColor:COLORS.borderLight, alignItems:'center' },
  formCard:     { padding:SPACING.xl, borderRadius:RADIUS.xl, ...SHADOW.sm, margin:SPACING.md },
  formTitle:    { fontSize:FONT.xl, fontWeight:'700', marginBottom:SPACING.lg },
  modalRoot:    { flex:1 },
  modalTitle:   { fontSize:FONT.md, fontWeight:'700', flex:1, textAlign:'center' },
  hdrBtn:       { backgroundColor:COLORS.primary, paddingHorizontal:SPACING.md, paddingVertical:6, borderRadius:RADIUS.md },
  filterInput:  { borderWidth:1, borderRadius:RADIUS.md, padding:SPACING.sm, fontSize:FONT.sm },
  balBox:       { flexDirection:'row', justifyContent:'space-around', alignItems:'center', margin:SPACING.md, padding:SPACING.md, borderRadius:RADIUS.lg, borderWidth:1 },
  txRow:        { flexDirection:'row', padding:SPACING.md, borderBottomWidth:1 },
  loadMore:     { padding:SPACING.xl, alignItems:'center' },
  payTitle:     { fontSize:FONT.xl, fontWeight:'700', marginBottom:SPACING.lg },
  payTypRow:    { flexDirection:'row', backgroundColor:COLORS.slate100, borderRadius:RADIUS.lg, padding:4, marginBottom:SPACING.md },
  payTypeBtn:   { flex:1, padding:SPACING.sm, borderRadius:RADIUS.md, alignItems:'center' },
  payTypeBtnActive:{ backgroundColor:COLORS.primary },
  invChip:      { paddingHorizontal:SPACING.md, paddingVertical:6, borderRadius:RADIUS.full, backgroundColor:COLORS.slate200, marginRight:SPACING.sm },
  invChipActive:{ backgroundColor:COLORS.indigo600 },
  invChipText:  { fontSize:FONT.xs, fontWeight:'700', color:COLORS.slate600 },
  chequeCard:   { borderRadius:RADIUS.lg, padding:SPACING.md, marginBottom:SPACING.sm, borderLeftWidth:4, ...SHADOW.sm },
  statusBadge:  { paddingHorizontal:SPACING.sm, paddingVertical:3, borderRadius:RADIUS.sm, marginTop:4 },
  chqBtn:       { paddingHorizontal:SPACING.md, paddingVertical:SPACING.sm, borderRadius:RADIUS.md },
});
