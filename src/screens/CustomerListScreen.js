import React, { useState, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, TextInput, Animated, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import AppInput from '../components/ui/AppInput';
import AppButton from '../components/ui/AppButton';
import { COLORS, SPACING, RADIUS, FONT, SHADOW } from '../utils/theme';
import { formatMoney, generateId, normalizePhone } from '../utils/helpers';
import { calculateLedgerBalance } from '../utils/ledger';

export default function CustomerListScreen() {
  const navigation = useNavigation();
  const { customers, invoices, settings, saveData, isGuest, showAlert } = useApp();
  const dark = settings.mode === 'dark';
  const bg   = dark ? COLORS.bgDark     : '#f8fafc';
  const card = dark ? COLORS.surfaceDark : COLORS.white;
  const text = dark ? COLORS.textDark   : COLORS.textLight;
  const sub  = dark ? COLORS.slate400   : COLORS.slate500;
  const brd  = dark ? COLORS.borderDark : COLORS.borderLight;

  const [search,  setSearch]  = useState('');
  const [sortBy,  setSortBy]  = useState('name');
  const [adding,  setAdding]  = useState(false);
  const [form,    setForm]    = useState({ name:'', company:'', mobile:'', address:'' });

  const enriched = useMemo(() =>
    customers.map(c => {
      const { finalBalance } = calculateLedgerBalance(c.ledger, { useEffective:true });
      const invCount = invoices.filter(i => i.customer && String(i.customer.id)===String(c.id)).length;
      return { ...c, balance:finalBalance, invCount };
    }), [customers, invoices]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = q
      ? enriched.filter(c =>
          (c.name||'').toLowerCase().includes(q) ||
          (c.mobile||'').includes(q) ||
          (c.address||'').toLowerCase().includes(q) ||
          (c.company||'').toLowerCase().includes(q)
        )
      : enriched;
    return sortBy === 'balance'
      ? [...list].sort((a,b) => b.balance - a.balance)
      : [...list].sort((a,b) => (a.name||'').localeCompare(b.name||''));
  }, [enriched, search, sortBy]);

  const handleAdd = async () => {
    if (!form.name) {
      Alert.alert('Required', 'Name is required');
      return;
    }
    if (form.mobile && customers.find(c => normalizePhone(c.mobile||'') === normalizePhone(form.mobile))) {
      Alert.alert('Duplicate', 'Mobile number already exists!');
      return;
    }
    const id = generateId();
    // فوری بند کریں، background میں save
    setAdding(false);
    setForm({ name:'', company:'', mobile:'', address:'' });
    saveData('customers', id, { id, ...form, ledger:[] });
  };

  const getBalance = (c) => calculateLedgerBalance(c.ledger, { useEffective:true }).finalBalance;

  const renderItem = ({ item: c }) => {
    const balance = getBalance(c);
    return (
      <TouchableOpacity
        style={[styles.row, { backgroundColor:card, borderColor:brd }]}
        onPress={() => navigation.navigate('CustomerDetail', { customerId:c.id })}
        activeOpacity={0.75}
      >
        <View style={{ flex:1 }}>
          <Text style={[styles.name, { color:text }]} numberOfLines={1}>{c.name}</Text>
          <Text style={{ color:sub, fontSize:FONT.xs, marginTop:2 }}>
            {c.mobile || 'No Mobile'}{c.address ? ' • '+c.address : ''}
          </Text>
        </View>
        <View style={{ alignItems:'flex-end', gap:4 }}>
          {balance > 0 ? (
            <Text style={[styles.balBadge, { color:dark?'#f87171':COLORS.danger, backgroundColor:dark?'rgba(239,68,68,0.15)':'#fef2f2' }]}>
              {formatMoney(balance, settings.currency)}
            </Text>
          ) : null}
          <Text style={{ color:COLORS.slate400, fontSize:16 }}>›</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor:bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor:card, borderBottomColor:brd }]}>
        <Text style={[styles.title, { color:text }]}>Customer Directory</Text>
        {!isGuest && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setAdding(a => !a)}
            activeOpacity={0.8}
          >
            <Text style={{ color:COLORS.white, fontWeight:'700', fontSize:FONT.sm }}>
              {adding ? 'Cancel' : '+ Add Customer'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Add Form */}
      {adding && (
        <View style={[styles.addForm, { backgroundColor:card, borderBottomColor:brd }]}>
          <Text style={[styles.formTitle, { color:text }]}>New Customer</Text>
          <AppInput label="Name" value={form.name} onChangeText={v=>setForm(p=>({...p,name:v}))} dark={dark} />
          <AppInput label="Company" value={form.company} onChangeText={v=>setForm(p=>({...p,company:v}))} dark={dark} />
          <AppInput label="Mobile (Unique ID)" value={form.mobile} onChangeText={v=>setForm(p=>({...p,mobile:v}))} keyboardType="phone-pad" dark={dark} />
          <AppInput label="Address / City" value={form.address} onChangeText={v=>setForm(p=>({...p,address:v}))} dark={dark} />
          <AppButton onPress={handleAdd} style={{ marginTop:SPACING.sm }}>Save</AppButton>
        </View>
      )}

      {/* Search + Sort */}
      <View style={[styles.searchRow, { backgroundColor:card, borderBottomColor:brd }]}>
        <View style={[styles.searchBox, { backgroundColor:bg, borderColor:brd, flex:1 }]}>
          <Text style={{ color:sub, marginRight:6 }}>🔍</Text>
          <TextInput
            value={search} onChangeText={setSearch}
            placeholder="Search..."
            placeholderTextColor={sub}
            style={{ flex:1, color:text, fontSize:FONT.base }}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{top:8,bottom:8,left:8,right:8}}>
              <Text style={{ color:sub }}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={[styles.sortBox, { backgroundColor:bg, borderColor:brd }]}>
          {[{v:'name',l:'A-Z'},{v:'balance',l:'Balance'}].map(s => (
            <TouchableOpacity key={s.v}
              style={[styles.sortBtn, sortBy===s.v && styles.sortBtnActive]}
              onPress={() => setSortBy(s.v)}
            >
              <Text style={{ fontSize:FONT.xs, fontWeight:'700', color:sortBy===s.v?COLORS.white:sub }}>
                {s.l}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={c => c.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding:SPACING.md, paddingBottom:80, gap:SPACING.sm }}
        ListEmptyComponent={
          <View style={{ alignItems:'center', marginTop:60 }}>
            <Text style={{ fontSize:40 }}>👥</Text>
            <Text style={{ color:sub, marginTop:SPACING.md }}>No customers yet</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:       { flex:1 },
  header:     { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:SPACING.lg, borderBottomWidth:1 },
  title:      { fontSize:FONT.xl, fontWeight:'800' },
  addBtn:     { backgroundColor:COLORS.primary, paddingVertical:SPACING.sm, paddingHorizontal:SPACING.md, borderRadius:RADIUS.full },
  addForm:    { padding:SPACING.lg, borderBottomWidth:1 },
  formTitle:  { fontSize:FONT.lg, fontWeight:'700', marginBottom:SPACING.md },
  searchRow:  { flexDirection:'row', gap:SPACING.sm, padding:SPACING.md, borderBottomWidth:1 },
  searchBox:  { flexDirection:'row', alignItems:'center', padding:SPACING.md, borderRadius:RADIUS.lg, borderWidth:1 },
  sortBox:    { flexDirection:'row', borderRadius:RADIUS.lg, borderWidth:1, overflow:'hidden' },
  sortBtn:    { paddingHorizontal:SPACING.md, paddingVertical:SPACING.sm },
  sortBtnActive: { backgroundColor:COLORS.primary },
  row:        { flexDirection:'row', alignItems:'center', padding:SPACING.md, borderRadius:RADIUS.xl, borderWidth:1, ...SHADOW.sm },
  name:       { fontSize:FONT.base, fontWeight:'700' },
  balBadge:   { fontSize:FONT.xs, fontWeight:'800', paddingHorizontal:SPACING.sm, paddingVertical:3, borderRadius:RADIUS.sm },
});
