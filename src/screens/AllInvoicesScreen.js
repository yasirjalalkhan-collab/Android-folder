import React, { useState, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  TextInput, StyleSheet, Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { FadeSlideIn, ScalePress } from '../components/ui/Animated';
import { formatMoney, formatDate } from '../utils/helpers';
import { safeParseAmount } from '../utils/ledger';
import { COLORS, SPACING, RADIUS, FONT, SHADOW } from '../utils/theme';

// ── Invoice کا paid status حساب کریں ────────────────────────
const getInvoiceStatus = (inv) => {
  const total    = safeParseAmount(inv.total);
  const cash     = safeParseAmount(inv.cashPaid);
  const chqClrd  = (inv.cheques||[])
    .filter(c => c.status === 'cleared')
    .reduce((a,c) => a + safeParseAmount(c.amount), 0);
  const chqPend  = (inv.cheques||[])
    .filter(c => c.status === 'pending')
    .reduce((a,c) => a + safeParseAmount(c.amount), 0);
  const paid     = cash + chqClrd;
  const balance  = total - paid;

  if (total <= 0) return { label:'—',      color:COLORS.slate400, bg:'#f1f5f9' };
  if (balance <= 0)           return { label:'✓ PAID',    color:'#166534',     bg:'#dcfce7' };
  if (paid > 0 || chqPend > 0) return { label:'~ PARTIAL', color:'#92400e',    bg:'#fef3c7' };
  return                               { label:'● UNPAID',  color:'#991b1b',    bg:'#fee2e2' };
};

export default function AllInvoicesScreen() {
  const navigation = useNavigation();
  const {
    invoices, customers, settings,
    saveData, deleteData, showConfirm, showPrompt, showAlert,
  } = useApp();
  const dark   = settings.mode === 'dark';
  const bg     = dark ? COLORS.bgDark     : COLORS.bgLight;
  const card   = dark ? COLORS.surfaceDark : COLORS.white;
  const text   = dark ? COLORS.textDark   : COLORS.textLight;
  const sub    = dark ? COLORS.slate400   : COLORS.slate500;
  const border = dark ? COLORS.borderDark : COLORS.borderLight;

  const [search,      setSearch]      = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  // Unique months for filter
  const months = useMemo(() => {
    const set = new Set(invoices.map(i => i.date?.substring(0,7)).filter(Boolean));
    return [...set].sort().reverse();
  }, [invoices]);

  const filtered = useMemo(() => {
    let list = [...invoices];
    if (filterMonth) list = list.filter(i => i.date?.startsWith(filterMonth));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(i => String(i.id).includes(q) || i.customer?.name?.toLowerCase().includes(q));
    }
    return list;
  }, [invoices, search, filterMonth]);

  const totalFiltered = filtered.reduce((a,i) => a + (parseFloat(i.total)||0), 0);

  const handleDelete = async (inv) => {
    // Bug #5: PIN لازمی
    if (!settings.securityPin) {
      await showAlert('Set a Master PIN in Settings to delete invoices.', 'Security Required');
      return;
    }
    const ok = await showConfirm(`Delete Invoice #${inv.id} (${inv.customer?.name})?`, 'Confirm');
    if (!ok) return;
    const pin = await showPrompt('Enter Master PIN:', '', 'PIN Confirm');
    if (pin === null) return;
    if (pin !== settings.securityPin) {
      await showAlert('Wrong PIN! Action cancelled.', 'Error');
      return;
    }

    // Bug #4: customer ledger سے bill/cash/cheque entries صاف کریں
    const invId  = String(inv.id);
    const custId = inv.customerId || inv.customer?.id;
    if (custId) {
      const cust = customers.find(c => String(c.id) === String(custId));
      if (cust) {
        const cleanedLedger = (cust.ledger || []).filter(tx => {
          if (String(tx.id) === 'bill-'  + invId) return false;
          if (String(tx.id) === 'cash-'  + invId) return false;
          if (String(tx.id) === 'pay-'   + invId) return false;
          if (tx.invoiceId && String(tx.invoiceId) === invId &&
              String(tx.id || '').startsWith('chq-inv-')) return false;
          return true;
        });
        await saveData('customers', cust.id, { ...cust, ledger: cleanedLedger });
      }
    }
    await deleteData('invoices', invId);
  };

  const renderItem = ({ item:inv, index }) => {
    const status = getInvoiceStatus(inv);
    return (
    <FadeSlideIn delay={Math.min(index * 20, 300)}>
      <ScalePress
        style={[styles.row,{backgroundColor:card,borderColor:border}]}
        onPress={()=>navigation.navigate('InvoiceView',{invoice:inv})}
      >
        <View style={{flex:1}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:SPACING.sm,flexWrap:'wrap'}}>
            <View style={styles.idBadge}>
              <Text style={styles.idText}>#{inv.id}</Text>
            </View>
            <View style={[styles.statusBadge,{backgroundColor:status.bg}]}>
              <Text style={[styles.statusText,{color:status.color}]}>{status.label}</Text>
            </View>
          </View>
          <Text style={[styles.custName,{color:text}]}>{inv.customer?.name||'—'}</Text>
          <Text style={[styles.date,{color:sub}]}>{formatDate(inv.date)} • {inv.items?.length||0} items</Text>
        </View>
        <View style={{alignItems:'flex-end',gap:4}}>
          <Text style={[styles.total,{color:text}]}>{formatMoney(inv.total,settings.currency)}</Text>
          {safeParseAmount(inv.balance) > 0 && (
            <Text style={{color:COLORS.danger,fontSize:FONT.xs,fontWeight:'600'}}>
              باقی: {formatMoney(inv.balance,settings.currency)}
            </Text>
          )}
          <TouchableOpacity
            style={styles.editBtn}
            onPress={()=>navigation.navigate('InvoiceEditor',{invoiceId:inv.id})}
          >
            <Text style={styles.editBtnText}>✏️ Edit</Text>
          </TouchableOpacity>
          {settings.securityPin ? (
            <TouchableOpacity
              style={[styles.editBtn,{backgroundColor:COLORS.red50}]}
              onPress={()=>handleDelete(inv)}
              hitSlop={{top:6,bottom:6,left:6,right:6}}
            >
              <Text style={{color:COLORS.danger,fontSize:FONT.xs,fontWeight:'700'}}>🗑️</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScalePress>
    </FadeSlideIn>
    );
  };

  return (
    <View style={[styles.root,{backgroundColor:bg}]}>
      {/* Header */}
      <FadeSlideIn delay={0}>
        <View style={[styles.header,{backgroundColor:card,borderBottomColor:border}]}>
          <View style={{flex:1,marginLeft:SPACING.md}}>
            <Text style={[styles.title,{color:text}]}>All Invoices</Text>
            <Text style={{color:sub,fontSize:FONT.xs}}>{filtered.length} • {formatMoney(totalFiltered,settings.currency)}</Text>
          </View>
        </View>
      </FadeSlideIn>

      {/* Search */}
      <FadeSlideIn delay={60}>
        <View style={[styles.searchBox,{backgroundColor:card,borderColor:border}]}>
          <Text style={{marginRight:6}}>🔍</Text>
          <TextInput value={search} onChangeText={setSearch}
            placeholder="Search invoice or customer..."
            placeholderTextColor={sub}
            style={[styles.searchInput,{color:text}]}
          />
          {search ? <TouchableOpacity onPress={()=>setSearch('')}><Text style={{color:sub,fontSize:16}}>✕</Text></TouchableOpacity> : null}
        </View>
      </FadeSlideIn>

      {/* Month filter */}
      {months.length > 0 && (
        <FadeSlideIn delay={80}>
          <View style={{paddingHorizontal:SPACING.md,marginBottom:SPACING.sm}}>
            <Text style={{color:sub,fontSize:FONT.xs,marginBottom:6,fontWeight:'700'}}>Filter by month:</Text>
            <FlatList
              horizontal
              data={[{value:'',label:'All'},...months.map(m=>({value:m,label:m}))]}
              keyExtractor={i=>i.value}
              showsHorizontalScrollIndicator={false}
              renderItem={({item})=>(
                <TouchableOpacity
                  style={[styles.monthChip, filterMonth===item.value&&styles.monthChipActive]}
                  onPress={()=>setFilterMonth(item.value)}
                >
                  <Text style={[styles.monthChipText, filterMonth===item.value&&{color:COLORS.white}]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </FadeSlideIn>
      )}

      <FlatList
        data={filtered}
        keyExtractor={i=>String(i.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={{alignItems:'center',marginTop:80}}>
            <Text style={{fontSize:48}}>📄</Text>
            <Text style={{color:sub,marginTop:SPACING.md,fontSize:FONT.base}}>No invoices</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex:1 },
  header:       { flexDirection:'row', alignItems:'center', padding:SPACING.lg, borderBottomWidth:1 },
  title:        { fontSize:FONT.xl, fontWeight:'700' },
  searchBox:    { flexDirection:'row', alignItems:'center', margin:SPACING.md, marginBottom:SPACING.sm, padding:SPACING.md, borderRadius:RADIUS.lg, borderWidth:1 },
  searchInput:  { flex:1, fontSize:FONT.base },
  monthChip:    { paddingHorizontal:SPACING.md, paddingVertical:6, borderRadius:RADIUS.full, backgroundColor:COLORS.slate200, marginRight:SPACING.sm },
  monthChipActive:{ backgroundColor:COLORS.primary },
  monthChipText:  { fontSize:FONT.xs, fontWeight:'700', color:COLORS.slate600 },
  list:         { padding:SPACING.md, paddingBottom:80 },
  row:          { flexDirection:'row', padding:SPACING.md, borderRadius:RADIUS.xl, marginBottom:SPACING.sm, borderWidth:1, ...SHADOW.sm },
  idBadge:      { backgroundColor:COLORS.slate900, paddingHorizontal:SPACING.sm, paddingVertical:3, borderRadius:RADIUS.sm },
  idText:       { color:COLORS.primaryLight, fontWeight:'800', fontSize:FONT.xs },
  balBadge:     { backgroundColor:COLORS.red50, paddingHorizontal:SPACING.sm, paddingVertical:3, borderRadius:RADIUS.sm },
  balBadgeText: { color:COLORS.danger, fontSize:FONT.xs, fontWeight:'700' },
  statusBadge:  { paddingHorizontal:SPACING.sm, paddingVertical:3, borderRadius:RADIUS.sm },
  statusText:   { fontSize:9, fontWeight:'800', letterSpacing:0.3 },
  custName:     { fontSize:FONT.base, fontWeight:'700', marginTop:4 },
  date:         { fontSize:FONT.xs, marginTop:2 },
  total:        { fontSize:FONT.md, fontWeight:'800' },
  editBtn:      { backgroundColor:COLORS.slate100, paddingHorizontal:SPACING.sm, paddingVertical:4, borderRadius:RADIUS.sm },
  editBtnText:  { fontSize:FONT.xs, color:COLORS.slate600, fontWeight:'600' },
});
