import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Share } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useApp } from '../context/AppContext';
import { FadeSlideIn, ScalePress } from '../components/ui/Animated';
import { calculateLedgerBalance, safeParseAmount } from '../utils/ledger';
import { formatMoney, formatDate } from '../utils/helpers';
import { buildInvoiceHTML } from '../utils/pdfTemplates';
import { COLORS, SPACING, RADIUS, FONT, SHADOW } from '../utils/theme';

export default function InvoiceViewScreen() {
  const navigation = useNavigation();
  const { params }  = useRoute();
  const { customers, settings, profile, isFirebaseMode } = useApp();
  const dark = settings.mode === 'dark';
  const bg   = dark ? COLORS.bgDark     : '#F1F5F9';
  const card = dark ? COLORS.surfaceDark : COLORS.white;
  const text = dark ? COLORS.textDark   : COLORS.textLight;
  const sub  = dark ? COLORS.slate400   : COLORS.slate500;
  const brd  = dark ? COLORS.borderDark : COLORS.borderLight;

  const invoice  = params?.invoice;
  if (!invoice) return null;

  const customer = invoice.customer || {};
  const items    = invoice.items    || [];

  const currentCust   = (customers||[]).find(c=>String(c.id)===String(customer.id)) || customer;
  const { previousBalance } = calculateLedgerBalance(currentCust.ledger, { upToBillId:'bill-'+invoice.id, useEffective:true });
  const cashPaid    = safeParseAmount(invoice.cashPaid);
  const chequeList  = invoice.cheques || [];
  const chqAmt      = chequeList.filter(c=>c.status==='cleared').reduce((a,c)=>a+safeParseAmount(c.amount),0);
  const netPayable  = previousBalance + safeParseAmount(invoice.total) - cashPaid - chqAmt;

  const groups = {
    DOOR:   items.filter(i=>i.unit==='Sq.Ft'),
    WOOD:   items.filter(i=>i.unit==='Cu.Ft'),
    PLY:    items.filter(i=>i.unit!=='Cu.Ft'&&i.unit!=='Sq.Ft'&&i.type!=='custom'),
    CUSTOM: items.filter(i=>i.type==='custom'),
  };

  // ── Standard group section ────────────────────────────────
  const GroupSection = ({ title, unit, data }) => {
    if (!data.length) return null;
    const totQty  = data.reduce((a,i)=>a+(i.qty||0),0);
    const totMeas = data.reduce((a,i)=>a+(i.qtyUnit||0)*(i.qty||0),0);
    const totAmt  = data.reduce((a,i)=>a+(i.amount||0)*(i.qty||0),0);
    return (
      <View style={{marginBottom:SPACING.md}}>
        <View style={[styles.groupHeader,{backgroundColor:dark?COLORS.slate700:COLORS.slate800}]}>
          <Text style={{color:COLORS.white,fontWeight:'800',fontSize:FONT.xs,textTransform:'uppercase'}}>{title}</Text>
        </View>
        {data.map((item,i)=>(
          <View key={i} style={[styles.itemRow,{borderBottomColor:brd}]}>
            <Text style={{flex:2,color:text,fontWeight:'600',fontSize:FONT.sm}} numberOfLines={2}>{item.name}</Text>
            <Text style={[styles.cell,{color:sub,fontSize:10}]}>{item.displaySize||''}</Text>
            <Text style={[styles.cell,{color:text,fontWeight:'700'}]}>{item.qty}</Text>
            <Text style={[styles.cell,{color:sub}]}>{((item.qtyUnit||0)*(item.qty||0)).toFixed(2)}</Text>
            <Text style={[styles.cell,{color:sub}]}>{item.rate||0}</Text>
            <Text style={[styles.cell,{color:text,fontWeight:'700',textAlign:'right'}]}>
              {formatMoney((item.amount||0)*(item.qty||1),settings.currency)}
            </Text>
          </View>
        ))}
        <View style={[styles.groupTotal,{backgroundColor:dark?COLORS.slate700:COLORS.slate100}]}>
          <Text style={{color:text,fontWeight:'700',flex:2}}>Total {title}</Text>
          <Text style={{color:sub,flex:1}}/>
          <Text style={{color:text,fontWeight:'700',flex:1,textAlign:'center'}}>{totQty}</Text>
          <Text style={{color:sub,flex:1,textAlign:'center'}}>{totMeas.toFixed(2)} {unit}</Text>
          <Text style={{color:sub,flex:1}}/>
          <Text style={{color:text,fontWeight:'800',flex:1,textAlign:'right'}}>{formatMoney(totAmt,settings.currency)}</Text>
        </View>
      </View>
    );
  };

  // ── Custom group — تعداد × ریٹ ───────────────────────────
  const CustomSection = ({ data }) => {
    if (!data.length) return null;
    const totQty = data.reduce((a,i)=>a+(i.qty||0),0);
    const totAmt = data.reduce((a,i)=>a+(i.amount||i.rate||0)*(i.qty||0),0);
    return (
      <View style={{marginBottom:SPACING.md}}>
        <View style={[styles.groupHeader,{backgroundColor:dark?COLORS.slate700:COLORS.slate800}]}>
          <Text style={{color:COLORS.white,fontWeight:'800',fontSize:FONT.xs,textTransform:'uppercase'}}>CUSTOM ITEMS</Text>
        </View>
        {data.map((item,i)=>(
          <View key={i} style={[styles.itemRow,{borderBottomColor:brd}]}>
            <Text style={{flex:2,color:text,fontWeight:'600',fontSize:FONT.sm}} numberOfLines={2}>{item.name}</Text>
            <Text style={[styles.cell,{color:sub,fontSize:10}]}>{item.customUnit||'pcs'}</Text>
            <Text style={[styles.cell,{color:text,fontWeight:'700'}]}>{item.qty}</Text>
            <Text style={[styles.cell,{color:sub}]}>{item.qty} {item.customUnit||'pcs'}</Text>
            <Text style={[styles.cell,{color:sub}]}>{item.rate||item.amount||0}</Text>
            <Text style={[styles.cell,{color:text,fontWeight:'700',textAlign:'right'}]}>
              {formatMoney((item.amount||item.rate||0)*(item.qty||1),settings.currency)}
            </Text>
          </View>
        ))}
        <View style={[styles.groupTotal,{backgroundColor:dark?COLORS.slate700:COLORS.slate100}]}>
          <Text style={{color:text,fontWeight:'700',flex:2}}>Total Custom</Text>
          <Text style={{color:sub,flex:1}}/>
          <Text style={{color:text,fontWeight:'700',flex:1,textAlign:'center'}}>{totQty}</Text>
          <Text style={{color:sub,flex:1,textAlign:'center'}}>{totQty} pcs</Text>
          <Text style={{color:sub,flex:1}}/>
          <Text style={{color:text,fontWeight:'800',flex:1,textAlign:'right'}}>{formatMoney(totAmt,settings.currency)}</Text>
        </View>
      </View>
    );
  };

  const handleShare = async () => {
    const lines = [
      `━━━━━━━━━━━━━━━━━━━━`,
      `${profile.name||'Timber 360'}`,
      `${profile.address||''} | ${profile.phone||''}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `Invoice #${invoice.id}`,
      `Date: ${formatDate(invoice.date)}`,
      `Customer: ${customer.name}`,
      `Mobile: ${customer.mobile||''}`,
      ``,`━━ ITEMS ━━`,
      ...items.map(i=>`${i.name} | ${i.displaySize||''} | Qty:${i.qty} | ${formatMoney((i.amount||0)*(i.qty||1),settings.currency)}`),
      ``,
      `Total: ${formatMoney(invoice.total,settings.currency)}`,
      cashPaid>0?`Cash Paid: ${formatMoney(cashPaid,settings.currency)}`:'',
      ...chequeList.map(c=>`Cheque ${c.bank} #${c.number} = ${formatMoney(c.amount,settings.currency)} (${c.status})`),
      previousBalance>0?`Previous Balance: ${formatMoney(previousBalance,settings.currency)}`:'',
      `Net Payable: ${formatMoney(netPayable,settings.currency)}`,
      `━━━━━━━━━━━━━━━━━━━━`,
    ].filter(Boolean);
    await Share.share({ message:lines.join('\n') });
  };

  const handlePDF = async () => {
    try {
      const html = buildInvoiceHTML(invoice, profile, settings, customers);
      const { uri } = await Print.printToFileAsync({ html, base64:false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType:'application/pdf', dialogTitle:`Invoice #${invoice.id}` });
      } else {
        await Print.printAsync({ uri });
      }
    } catch(e) { console.error('PDF error:', e); }
  };

  return (
    <View style={[styles.root,{backgroundColor:bg}]}>
      {/* Toolbar */}
      <FadeSlideIn delay={0}>
        <View style={[styles.toolbar,{backgroundColor:COLORS.slate800}]}>
          <View style={{flex:1}}>
            <Text style={{color:COLORS.white,fontWeight:'700',fontSize:FONT.base}}>Invoice #{invoice.id}</Text>
            {/* ── Paid Status Badge ── */}
            {(() => {
              const tot     = safeParseAmount(invoice.total);
              const cash    = safeParseAmount(invoice.cashPaid);
              const chqClrd = (invoice.cheques||[]).filter(c=>c.status==='cleared').reduce((a,c)=>a+safeParseAmount(c.amount),0);
              const chqPend = (invoice.cheques||[]).filter(c=>c.status==='pending').reduce((a,c)=>a+safeParseAmount(c.amount),0);
              const paid    = cash + chqClrd;
              const bal     = tot - paid;
              const stBg    = bal<=0 ? '#dcfce7' : (paid>0||chqPend>0) ? '#fef3c7' : '#fee2e2';
              const stCol   = bal<=0 ? '#166534' : (paid>0||chqPend>0) ? '#92400e' : '#991b1b';
              const stLbl   = bal<=0 ? '✓ PAID'  : (paid>0||chqPend>0) ? '~ PARTIAL' : '● UNPAID';
              return (
                <View style={{flexDirection:'row',alignItems:'center',gap:6,marginTop:3}}>
                  <View style={{backgroundColor:stBg,paddingHorizontal:6,paddingVertical:2,borderRadius:4}}>
                    <Text style={{color:stCol,fontSize:9,fontWeight:'800'}}>{stLbl}</Text>
                  </View>
                  {bal>0 && <Text style={{color:'#fca5a5',fontSize:FONT.xs}}>باقی: {formatMoney(bal,settings.currency)}</Text>}
                </View>
              );
            })()}
          </View>
          <View style={{flexDirection:'row',gap:SPACING.sm}}>
            <ScalePress style={styles.toolbarBtn}
              onPress={()=>navigation.navigate('InvoiceEditor',{invoiceId:invoice.id})}>
              <Text style={{color:COLORS.white,fontSize:FONT.xs,fontWeight:'700'}}>✏️ Edit</Text>
            </ScalePress>
            <ScalePress style={[styles.toolbarBtn,{backgroundColor:COLORS.indigo600}]} onPress={handlePDF}>
              <Text style={{color:COLORS.white,fontSize:FONT.xs,fontWeight:'700'}}>📄 PDF</Text>
            </ScalePress>
            <ScalePress style={[styles.toolbarBtn,{backgroundColor:COLORS.primary}]} onPress={handleShare}>
              <Text style={{color:COLORS.white,fontSize:FONT.xs,fontWeight:'700'}}>📤 Share</Text>
            </ScalePress>
          </View>
        </View>
      </FadeSlideIn>

      <ScrollView contentContainerStyle={styles.content}>
        <FadeSlideIn delay={60}>
          <View style={[styles.card,{backgroundColor:card}]}>
            {/* Invoice Header */}
            <View style={styles.invoiceHeader}>
              <View style={{flex:1}}>
                <Text style={{fontSize:FONT.xl,fontWeight:'800',color:COLORS.primary}}>{profile.name||'Timber 360'}</Text>
                {profile.ownerName ? <Text style={{fontSize:FONT.xs,color:sub,marginTop:2}}>{profile.ownerName}</Text> : null}
                {profile.address  ? <Text style={{fontSize:FONT.xs,color:sub}}>{profile.address}</Text> : null}
                {profile.phone    ? <Text style={{fontSize:FONT.xs,color:COLORS.warning,fontWeight:'700'}}>{profile.phone}</Text> : null}
              </View>
              <View style={{alignItems:'flex-end'}}>
                <Text style={{fontSize:FONT.xs,fontWeight:'800',textTransform:'uppercase',letterSpacing:2,color:brd}}>INVOICE</Text>
                <Text style={{fontSize:FONT.xl,fontWeight:'900',color:text}}>#{invoice.id}</Text>
                <Text style={{fontSize:FONT.xs,color:sub}}>{formatDate(invoice.date)}</Text>
              </View>
            </View>

            {/* Customer */}
            <View style={[styles.custBox,{backgroundColor:dark?COLORS.slate700:COLORS.slate50,borderColor:brd}]}>
              <Text style={{fontSize:FONT.xs,fontWeight:'800',textTransform:'uppercase',color:sub,marginBottom:4}}>Bill To</Text>
              <Text style={{fontSize:FONT.lg,fontWeight:'700',color:text}}>{customer.name}</Text>
              {customer.mobile  && <Text style={{color:sub,fontSize:FONT.xs,marginTop:2}}>{customer.mobile}</Text>}
              {customer.address && <Text style={{color:sub,fontSize:FONT.xs}}>{customer.address}</Text>}
            </View>

            {/* Column headers — standard items */}
            {(groups.DOOR.length>0||groups.WOOD.length>0||groups.PLY.length>0) && (
              <View style={[styles.tableHeader,{backgroundColor:dark?COLORS.slate700:COLORS.slate100}]}>
                <Text style={{flex:2,fontSize:FONT.xs,fontWeight:'700',color:sub,textTransform:'uppercase'}}>Item</Text>
                <Text style={[styles.th,{textAlign:'center'}]}>Size</Text>
                <Text style={[styles.th,{textAlign:'center'}]}>Qty</Text>
                <Text style={[styles.th,{textAlign:'center'}]}>Meas.</Text>
                <Text style={[styles.th,{textAlign:'center'}]}>Rate</Text>
                <Text style={[styles.th,{textAlign:'right'}]}>Amount</Text>
              </View>
            )}

            <GroupSection title="DOORS"   unit="Sq.Ft" data={groups.DOOR} />
            <GroupSection title="WOOD"    unit="Cu.Ft" data={groups.WOOD} />
            <GroupSection title="PLYWOOD" unit="Sheet" data={groups.PLY}  />
            <CustomSection data={groups.CUSTOM} />

            {/* Payment summary */}
            <View style={[styles.payBox,{borderTopColor:brd}]}>
              <View style={styles.payRow}>
                <Text style={{color:text,fontWeight:'700',fontSize:FONT.lg}}>Total:</Text>
                <Text style={{color:COLORS.success,fontWeight:'900',fontSize:FONT.lg}}>{formatMoney(invoice.total,settings.currency)}</Text>
              </View>
              {previousBalance>0 && (
                <View style={styles.payRow}>
                  <Text style={{color:sub}}>+ Previous Balance:</Text>
                  <Text style={{color:COLORS.warning,fontWeight:'700'}}>{formatMoney(previousBalance,settings.currency)}</Text>
                </View>
              )}
              {cashPaid>0 && (
                <View style={styles.payRow}>
                  <Text style={{color:sub}}>- Cash Paid:</Text>
                  <Text style={{color:COLORS.success,fontWeight:'700'}}>{formatMoney(cashPaid,settings.currency)}</Text>
                </View>
              )}
              {chequeList.map((c,i)=>(
                <View key={i} style={styles.payRow}>
                  <Text style={{color:sub,fontSize:FONT.xs}}>- Cheque: {c.bank} #{c.number} ({c.status}):</Text>
                  <Text style={{color:c.status==='cleared'?COLORS.success:COLORS.warning,fontWeight:'700',fontSize:FONT.xs}}>
                    {formatMoney(c.amount,settings.currency)}
                  </Text>
                </View>
              ))}
              <View style={[styles.netRow,{borderTopColor:brd}]}>
                <Text style={{color:COLORS.warning,fontWeight:'800',fontSize:FONT.lg}}>Net Payable:</Text>
                <Text style={{color:COLORS.warning,fontWeight:'900',fontSize:FONT.xl}}>{formatMoney(netPayable,settings.currency)}</Text>
              </View>
              {profile.footer ? (
                <Text style={{color:sub,fontSize:FONT.xs,textAlign:'center',marginTop:SPACING.lg,paddingTop:SPACING.md,borderTopWidth:1,borderTopColor:brd}}>
                  {profile.footer}
                </Text>
              ) : null}
              {/* Track بٹن — صرف Firebase users کے لیے */}
              {isFirebaseMode ? (
                <ScalePress
                  style={{marginTop:SPACING.lg,padding:SPACING.md,borderRadius:RADIUS.xl,backgroundColor:'#0891b2',alignItems:'center'}}
                  onPress={()=>navigation.navigate('OrderTracking',{invoice})}
                >
                  <Text style={{color:'#fff',fontWeight:'700'}}>📦 Order Tracking / QR Code</Text>
                </ScalePress>
              ) : (
                <View style={{marginTop:SPACING.lg,padding:SPACING.md,borderRadius:RADIUS.xl,backgroundColor:'#f1f5f9',alignItems:'center',borderWidth:1,borderColor:'#cbd5e1'}}>
                  <Text style={{color:'#64748b',fontSize:12,fontWeight:'600'}}>📦 Order Tracking — Firebase Plan میں دستیاب</Text>
                </View>
              )}
            </View>
          </View>
        </FadeSlideIn>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex:1 },
  toolbar:      { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:SPACING.md },
  toolbarBtn:   { backgroundColor:'rgba(255,255,255,0.15)', paddingHorizontal:SPACING.md, paddingVertical:SPACING.sm, borderRadius:RADIUS.md },
  content:      { padding:SPACING.md, paddingBottom:60 },
  card:         { borderRadius:RADIUS.xl, padding:SPACING.xl, ...SHADOW.md },
  invoiceHeader:{ flexDirection:'row', justifyContent:'space-between', marginBottom:SPACING.lg },
  custBox:      { borderWidth:1, borderRadius:RADIUS.md, padding:SPACING.md, marginBottom:SPACING.lg },
  tableHeader:  { flexDirection:'row', padding:SPACING.sm, borderRadius:RADIUS.sm, marginBottom:SPACING.xs },
  th:           { flex:1, fontSize:FONT.xs, fontWeight:'700', color:COLORS.slate400, textTransform:'uppercase' },
  groupHeader:  { padding:SPACING.sm, borderRadius:RADIUS.sm, marginBottom:SPACING.xs },
  itemRow:      { flexDirection:'row', paddingVertical:SPACING.sm, borderBottomWidth:1, alignItems:'center' },
  cell:         { flex:1, fontSize:FONT.xs, textAlign:'center' },
  groupTotal:   { flexDirection:'row', padding:SPACING.sm, borderRadius:RADIUS.sm, marginTop:SPACING.xs, marginBottom:SPACING.sm },
  customHdrRow: { flexDirection:'row', padding:SPACING.sm, borderBottomWidth:1 },
  customRow:    { flexDirection:'row', paddingVertical:SPACING.sm, paddingHorizontal:SPACING.sm, borderBottomWidth:1, alignItems:'center' },
  payBox:       { paddingTop:SPACING.xl, marginTop:SPACING.lg, borderTopWidth:1 },
  payRow:       { flexDirection:'row', justifyContent:'space-between', marginBottom:SPACING.sm },
  netRow:       { flexDirection:'row', justifyContent:'space-between', paddingTop:SPACING.md, marginTop:SPACING.md, borderTopWidth:2, alignItems:'center' },
});
