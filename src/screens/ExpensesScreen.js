import React, { useState, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ScrollView, Alert,
} from 'react-native';
import { useApp } from '../context/AppContext';
import AppButton from '../components/ui/AppButton';
import AppInput  from '../components/ui/AppInput';
import { FadeSlideIn, ScalePress, SlideModal } from '../components/ui/Animated';
import { COLORS, SPACING, RADIUS, FONT, SHADOW } from '../utils/theme';
import { formatMoney, formatDate, generateId, todayISO } from '../utils/helpers';
import { safeParseAmount } from '../utils/ledger';
import { EXPENSE_CATEGORIES } from '../utils/calculations';

export default function ExpensesScreen() {
  const { expenses, settings, saveData, deleteData, showConfirm } = useApp();
  const dark  = settings.mode === 'dark';
  const bg    = dark ? COLORS.bgDark     : COLORS.bgLight;
  const card  = dark ? COLORS.surfaceDark : COLORS.white;
  const text  = dark ? COLORS.textDark   : COLORS.textLight;
  const sub   = dark ? COLORS.slate400   : COLORS.slate500;
  const border= dark ? COLORS.borderDark : COLORS.borderLight;

  const [adding,      setAdding]      = useState(false);
  const [filterMonth, setFilterMonth] = useState('');
  const [form, setForm] = useState({
    date:todayISO(), category:'Miscellaneous', customCategory:'', desc:'', amount:''
  });

  const months = useMemo(() => {
    const set = new Set((expenses||[]).map(e=>e.date?.substring(0,7)).filter(Boolean));
    return [...set].sort().reverse();
  }, [expenses]);

  const filtered = useMemo(() => {
    if (!filterMonth) return expenses||[];
    return (expenses||[]).filter(e=>e.date?.startsWith(filterMonth));
  }, [expenses, filterMonth]);

  const total = filtered.reduce((a,e)=>a+safeParseAmount(e.amount),0);

  const catTotals = useMemo(() => {
    const map = {};
    filtered.forEach(e=>{ map[e.category]=(map[e.category]||0)+safeParseAmount(e.amount); });
    return map;
  }, [filtered]);

  const handleAdd = async () => {
    if (!form.amount || !form.desc) {
      Alert.alert('Required', 'Amount and description are required');
      return;
    }
    const cat = form.category === 'Custom' ? form.customCategory : form.category;
    const exp = {
      id: `exp_${Date.now()}`,
      date: form.date, category: cat,
      desc: form.desc, amount: safeParseAmount(form.amount),
    };
    // فوری بند کریں، background میں save
    setAdding(false);
    setForm({ date:todayISO(), category:'Miscellaneous', customCategory:'', desc:'', amount:'' });
    saveData('expenses', exp.id, exp);
  };

  const renderItem = ({ item:e, index }) => (
    <FadeSlideIn delay={Math.min(index*25,200)}>
      <View style={[styles.row,{backgroundColor:card,borderColor:border}]}>
        <View style={{flex:1}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:SPACING.sm,flexWrap:'wrap'}}>
            <View style={[styles.catBadge,{backgroundColor:COLORS.red50}]}>
              <Text style={styles.catText}>{e.category}</Text>
            </View>
            <Text style={[styles.date,{color:sub}]}>{formatDate(e.date)}</Text>
          </View>
          <Text style={[styles.desc,{color:text}]}>{e.desc}</Text>
        </View>
        <View style={{alignItems:'flex-end',gap:4}}>
          <Text style={styles.amount}>{formatMoney(e.amount,settings.currency)}</Text>
          <TouchableOpacity onPress={async()=>{
            const ok=await showConfirm('Delete this expense?');
            if(ok) deleteData('expenses',e.id);
          }}>
            <Text style={{color:sub,fontSize:18}}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    </FadeSlideIn>
  );

  return (
    <View style={[styles.root,{backgroundColor:bg}]}>
      {/* Header */}
      <FadeSlideIn delay={0}>
        <View style={[styles.header,{backgroundColor:card,borderBottomColor:border}]}>
          <Text style={[styles.title,{color:text}]}>Expenses</Text>
          <ScalePress style={styles.addBtn} onPress={()=>setAdding(true)}>
            <Text style={{color:COLORS.white,fontWeight:'700'}}>+ Add</Text>
          </ScalePress>
        </View>
      </FadeSlideIn>

      {/* Total + summary */}
      <FadeSlideIn delay={60}>
        <View style={[styles.totalBox,{backgroundColor:card,borderColor:border}]}>
          <View>
            <Text style={[styles.totalLabel,{color:sub}]}>
              {filterMonth ? filterMonth : 'Total'} Expenses
            </Text>
            <Text style={[styles.totalVal,{color:COLORS.danger}]}>{formatMoney(total,settings.currency)}</Text>
          </View>
          <Text style={{color:sub,fontSize:FONT.xs}}>{filtered.length} entries</Text>
        </View>
      </FadeSlideIn>

      {/* Month filter */}
      {months.length>0 && (
        <FadeSlideIn delay={80}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={{paddingHorizontal:SPACING.md,marginBottom:SPACING.sm}}>
            <TouchableOpacity
              style={[styles.monthChip,!filterMonth&&styles.monthChipActive]}
              onPress={()=>setFilterMonth('')}
            >
              <Text style={[styles.monthChipText,!filterMonth&&{color:COLORS.white}]}>All</Text>
            </TouchableOpacity>
            {months.map(m=>(
              <TouchableOpacity key={m}
                style={[styles.monthChip,filterMonth===m&&styles.monthChipActive]}
                onPress={()=>setFilterMonth(m)}
              >
                <Text style={[styles.monthChipText,filterMonth===m&&{color:COLORS.white}]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </FadeSlideIn>
      )}

      <FlatList
        data={filtered}
        keyExtractor={e=>e.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={{alignItems:'center',marginTop:80}}>
            <Text style={{fontSize:48}}>💸</Text>
            <Text style={{color:sub,marginTop:SPACING.md}}>No expenses yet</Text>
          </View>
        }
      />

      {/* Add Slide Modal */}
      <SlideModal visible={adding} onClose={()=>setAdding(false)} style={{backgroundColor:card}}>
        <ScrollView contentContainerStyle={{padding:SPACING.xl,paddingBottom:40}} keyboardShouldPersistTaps="handled">
          <Text style={[styles.modalTitle,{color:text}]}>Add New Expense</Text>
          <AppInput label="Date" value={form.date} onChangeText={v=>setForm(p=>({...p,date:v}))} dark={dark} />

          <Text style={{color:sub,fontSize:FONT.xs,fontWeight:'700',marginBottom:6,textTransform:'uppercase'}}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:SPACING.md}}>
            {EXPENSE_CATEGORIES.map(c=>(
              <TouchableOpacity key={c}
                style={[styles.catChip, form.category===c&&styles.catChipActive]}
                onPress={()=>setForm(p=>({...p,category:c}))}
              >
                <Text style={[styles.catChipText,form.category===c&&{color:COLORS.white}]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {form.category==='Custom' && (
            <AppInput label="Category Name" value={form.customCategory} onChangeText={v=>setForm(p=>({...p,customCategory:v}))} dark={dark} />
          )}
          <AppInput label="Description *" value={form.desc}   onChangeText={v=>setForm(p=>({...p,desc:v}))}   dark={dark} />
          <AppInput label="Amount *"   value={form.amount} onChangeText={v=>setForm(p=>({...p,amount:v}))} keyboardType="numeric" dark={dark} />
          <View style={{flexDirection:'row',gap:SPACING.md,marginTop:SPACING.md}}>
            <AppButton variant="secondary" onPress={()=>setAdding(false)} style={{flex:1}}>Cancel</AppButton>
            <AppButton variant="danger"    onPress={handleAdd}             style={{flex:1}}>Save</AppButton>
          </View>
        </ScrollView>
      </SlideModal>
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex:1 },
  header:        { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:SPACING.lg, borderBottomWidth:1 },
  title:         { fontSize:FONT.xl, fontWeight:'700' },
  addBtn:        { backgroundColor:COLORS.danger, paddingVertical:SPACING.sm, paddingHorizontal:SPACING.lg, borderRadius:RADIUS.full },
  totalBox:      { flexDirection:'row', justifyContent:'space-between', alignItems:'center', margin:SPACING.md, padding:SPACING.md, borderRadius:RADIUS.lg, borderWidth:1 },
  totalLabel:    { fontSize:FONT.xs, fontWeight:'700', textTransform:'uppercase' },
  totalVal:      { fontSize:FONT.xl, fontWeight:'800' },
  monthChip:     { paddingHorizontal:SPACING.md, paddingVertical:6, borderRadius:RADIUS.full, backgroundColor:COLORS.slate200, marginRight:SPACING.sm },
  monthChipActive:{ backgroundColor:COLORS.danger },
  monthChipText: { fontSize:FONT.xs, fontWeight:'700', color:COLORS.slate600 },
  list:          { padding:SPACING.md, paddingBottom:80 },
  row:           { flexDirection:'row', alignItems:'center', padding:SPACING.md, borderRadius:RADIUS.lg, marginBottom:SPACING.sm, borderWidth:1, ...SHADOW.sm },
  catBadge:      { paddingHorizontal:SPACING.sm, paddingVertical:3, borderRadius:RADIUS.sm },
  catText:       { color:COLORS.danger, fontSize:FONT.xs, fontWeight:'700' },
  date:          { fontSize:FONT.xs },
  desc:          { fontSize:FONT.base, fontWeight:'600', marginTop:4 },
  amount:        { color:COLORS.danger, fontWeight:'800', fontSize:FONT.md },
  modalTitle:    { fontSize:FONT.xl, fontWeight:'700', marginBottom:SPACING.lg },
  catChip:       { paddingHorizontal:SPACING.md, paddingVertical:SPACING.sm, borderRadius:RADIUS.full, backgroundColor:COLORS.slate200, marginRight:SPACING.sm },
  catChipActive: { backgroundColor:COLORS.danger },
  catChipText:   { fontSize:FONT.xs, fontWeight:'700', color:COLORS.slate600 },
});
