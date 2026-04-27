import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import { COLORS, SPACING, RADIUS, FONT } from '../../utils/theme';
import {
  calculateDoor, calculateWood, calculatePlywood,
  ITEM_TYPES, TYPE_DOOR, TYPE_SKIN, TYPE_PLYWOOD, TYPE_WOOD,
} from '../../utils/calculations';
import { safeParseAmount } from '../../utils/ledger';
import { formatMoney } from '../../utils/helpers';

// ── Custom type constant ──────────────────────────────────────
const TYPE_CUSTOM = 'custom';

// تمام tabs: 4 اصلی + Custom
const ALL_TYPES = [
  ...ITEM_TYPES,
  { id: TYPE_CUSTOM, label: 'Custom' },
];

export default function InlineItemEntry({ onAdd, settings, initialData, clearAfterAdd = true, stock = [] }) {
  const dark = settings?.mode === 'dark';
  const bg   = dark ? COLORS.slate700 : COLORS.white;
  const brd  = dark ? COLORS.borderDark : COLORS.borderLight;
  const col  = dark ? COLORS.textDark : COLORS.textLight;
  const subC = dark ? COLORS.slate400 : COLORS.slate500;

  const [type,      setType]      = useState(initialData?.type    || TYPE_DOOR);
  const [itemName,  setItemName]  = useState(String(initialData?.name    || ''));
  const [rate,      setRate]      = useState(String(initialData?.rate    || ''));
  const [costRate,  setCostRate]  = useState(String(initialData?.costRate || ''));
  const [qty,       setQty]       = useState(String(initialData?.qty     || ''));
  const [showSugg,  setShowSugg]  = useState(false);

  // Door / Skin fields
  const [w,         setW]         = useState(String(initialData?.w       || ''));
  const [hIn,       setHIn]       = useState(String(initialData?.hIn     || ''));
  const [skinH,     setSkinH]     = useState(initialData?.hIn === 96 ? 96 : 84);

  // Wood fields
  const [woodL,     setWoodL]     = useState(String(initialData?.woodL   || ''));
  const [woodLUnit, setWoodLUnit] = useState(initialData?.woodLUnit || 'ft');
  const [woodW,     setWoodW]     = useState(String(initialData?.woodW   || ''));
  const [woodT,     setWoodT]     = useState(String(initialData?.woodT   || ''));

  // Custom fields
  const [customUnit, setCustomUnit] = useState(initialData?.customUnit || 'pcs');

  const isLive = settings?.invMode === 'live';

  // ── Enter key chain refs ──────────────────────────────────
  const refRate     = useRef(null);
  const refCostRate = useRef(null);
  const refW        = useRef(null);
  const refHIn      = useRef(null);
  const refWoodL    = useRef(null);
  const refWoodW    = useRef(null);
  const refWoodT    = useRef(null);
  const refQty      = useRef(null);
  const refCustomUnit = useRef(null);

  useEffect(() => {
    if (!initialData) return;
    setType(initialData.type || TYPE_DOOR);
    setItemName(String(initialData.name || ''));
    setRate(String(initialData.rate || ''));
    setCostRate(String(initialData.costRate || ''));
    setQty(String(initialData.qty || ''));
    setW(String(initialData.w || ''));
    setHIn(String(initialData.hIn || ''));
    setWoodL(String(initialData.woodL || ''));
    setWoodW(String(initialData.woodW || ''));
    setWoodT(String(initialData.woodT || ''));
    if (initialData.woodLUnit)  setWoodLUnit(initialData.woodLUnit);
    if (initialData.customUnit) setCustomUnit(initialData.customUnit);
  }, [initialData]);

  const r      = safeParseAmount(rate);
  const qtyNum = safeParseAmount(qty);
  const cr     = safeParseAmount(costRate);

  // ── Calculation per type ──────────────────────────────────
  const calc = (() => {
    if (type === TYPE_DOOR) return calculateDoor(w, hIn, r, settings?.doorCalc || 'standard');
    if (type === TYPE_SKIN) return calculateDoor(w, skinH, r, settings?.doorCalc || 'standard');
    if (type === TYPE_WOOD) return calculateWood(woodL, woodW, woodT, settings?.woodUnit || 'in', woodLUnit, r);
    if (type === TYPE_CUSTOM) {
      // سیدھا: تعداد × ریٹ = رقم
      return {
        displaySize: `${qtyNum} ${customUnit}`,
        billingSize:  `${qtyNum} ${customUnit}`,
        unit:    customUnit,
        qtyUnit: 1,          // 1 unit per piece — amount already = rate
        amount:  r,          // per unit amount = rate directly
      };
    }
    return calculatePlywood(r);
  })();

  const totalAmt  = calc.amount * qtyNum;
  const totalCost = type === TYPE_CUSTOM
    ? cr * qtyNum                       // Custom: costRate × qty
    : cr * calc.qtyUnit * qtyNum;
  const profit = totalAmt - totalCost;

  // ── Add handler ───────────────────────────────────────────
  // ── Door/Wood size validation limits ─────────────────────
  // دروازہ: چوڑائی max 120 inch (10ft), اونچائی max 144 inch (12ft)
  // لکڑی: لمبائی max 40ft, چوڑائی/موٹائی max 48 inch
  const MAX_DOOR_W  = 120;   // 10 فٹ
  const MAX_DOOR_H  = 144;   // 12 فٹ
  const MAX_WOOD_L  = 40;    // 40 فٹ (ft) یا میٹر میں کم
  const MAX_WOOD_WT = 48;    // 48 inch (4 فٹ)
  const MAX_RATE    = 9_999_999;  // 99 لاکھ فی یونٹ
  const MAX_QTY     = 99_999;     // 99 ہزار عدد

  const handleAdd = () => {
    if (!itemName)                     return;
    if (safeParseAmount(rate) <= 0)    return;
    if (safeParseAmount(qty)  <= 0)    return;

    // ── غیر حقیقی dimensions کی جانچ ──────────────────────
    if (type === TYPE_DOOR || type === TYPE_SKIN) {
      const wNum = safeParseAmount(w);
      const hNum = safeParseAmount(hIn);
      if (wNum > MAX_DOOR_W) { alert(`چوڑائی ${MAX_DOOR_W}" سے زیادہ نہیں ہو سکتی`); return; }
      if (hNum > MAX_DOOR_H && type === TYPE_DOOR) { alert(`اونچائی ${MAX_DOOR_H}" سے زیادہ نہیں ہو سکتی`); return; }
    }
    if (type === TYPE_WOOD) {
      const lNum = safeParseAmount(woodL);
      const wNum = safeParseAmount(woodW);
      const tNum = safeParseAmount(woodT);
      const maxL = woodLUnit === 'ft' ? MAX_WOOD_L : MAX_WOOD_L * 0.3048;
      if (lNum > maxL)     { alert(`لمبائی حد سے زیادہ ہے`); return; }
      if (wNum > MAX_WOOD_WT) { alert(`چوڑائی ${MAX_WOOD_WT} سے زیادہ نہیں ہو سکتی`); return; }
      if (tNum > MAX_WOOD_WT) { alert(`موٹائی ${MAX_WOOD_WT} سے زیادہ نہیں ہو سکتی`); return; }
    }
    if (safeParseAmount(rate) > MAX_RATE) { alert(`ریٹ ${MAX_RATE.toLocaleString()} سے زیادہ نہیں ہو سکتا`); return; }
    if (safeParseAmount(qty)  > MAX_QTY)  { alert(`تعداد ${MAX_QTY.toLocaleString()} سے زیادہ نہیں ہو سکتی`); return; }

    onAdd({
      type,
      name:        itemName,
      qty:         qtyNum,
      rate:        r,
      costRate:    cr,
      amount:      calc.amount,
      displaySize: type === TYPE_CUSTOM ? `${qtyNum} ${customUnit}` : calc.displaySize,
      billingSize: type === TYPE_CUSTOM ? `${qtyNum} ${customUnit}` : calc.billingSize,
      unit:        calc.unit,
      qtyUnit:     calc.qtyUnit,
      // پرانے fields (edit کے لیے)
      w,
      hIn:         type === TYPE_SKIN ? skinH : hIn,
      woodL, woodLUnit, woodW, woodT,
      customUnit:  type === TYPE_CUSTOM ? customUnit : undefined,
      profit:      isLive ? profit : 0,
    });

    if (clearAfterAdd) {
      setW(''); setHIn(''); setWoodL(''); setWoodW(''); setWoodT('');
      setQty(''); setCostRate('');
      // itemName custom میں صاف کریں، باقی میں رہے
      if (type === TYPE_CUSTOM) setItemName('');
    }
  };

  // ── Small input helper (ref + maxLength شامل) ─────────────
  const inp = (placeholder, value, onChange, kb = 'default', extraStyle = {}, ref = null, onSubmit = null, retKey = 'next', maxLen = 6) => (
    <TextInput
      ref={ref}
      placeholder={placeholder}
      value={value}
      onChangeText={onChange}
      keyboardType={kb}
      placeholderTextColor={COLORS.slate400}
      returnKeyType={retKey}
      blurOnSubmit={false}
      onSubmitEditing={onSubmit}
      maxLength={maxLen}
      style={[styles.inp, { backgroundColor: bg, borderColor: brd, color: col }, extraStyle]}
    />
  );

  const isCustom = type === TYPE_CUSTOM;

  return (
    <View style={[styles.box, { backgroundColor: dark ? COLORS.slate800 : COLORS.slate100, borderColor: brd }]}>

      {/* ── Type tabs ─────────────────────────────────────── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.sm }}>
        {ALL_TYPES.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[
              styles.typeTab,
              type === t.id && styles.typeTabActive,
            ]}
            onPress={() => setType(t.id)}
          >
            <Text style={[
              styles.typeText,
              type === t.id && styles.typeTextActive,
            ]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Name + Rate row ───────────────────────────────── */}
      <View style={{ flexDirection:'row', gap:SPACING.sm, marginBottom:SPACING.sm }}>
        <TextInput
          placeholder={isCustom ? 'Item name (e.g. Hinge, Lock, Glass...)' : 'Item Name'}
          value={itemName}
          onChangeText={v => { setItemName(v); setShowSugg(v.length > 0); }}
          onFocus={() => { if (itemName.length > 0) setShowSugg(true); }}
          onBlur={() => setTimeout(() => setShowSugg(false), 200)}
          placeholderTextColor={COLORS.slate400}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => refRate.current?.focus()}
          style={[styles.inp, { backgroundColor:bg, borderColor:brd, color:col, flex:2 }]}
        />
        <TextInput
          ref={refRate}
          placeholder="Rate"
          value={rate}
          onChangeText={setRate}
          keyboardType="numeric"
          placeholderTextColor={COLORS.slate400}
          returnKeyType="next"
          blurOnSubmit={false}
          maxLength={10}
          onSubmitEditing={() => refCostRate.current?.focus()}
          style={[styles.inp, { backgroundColor:bg, borderColor:brd, color:col, flex:1 }]}
        />
        <TextInput
          ref={refCostRate}
          placeholder="Cost"
          value={costRate}
          onChangeText={setCostRate}
          keyboardType="numeric"
          placeholderTextColor={COLORS.slate400}
          returnKeyType="next"
          blurOnSubmit={false}
          maxLength={10}
          onSubmitEditing={() => {
            if (type === TYPE_DOOR || type === TYPE_SKIN) refW.current?.focus();
            else if (type === TYPE_WOOD) refWoodL.current?.focus();
            else refQty.current?.focus();
          }}
          style={[styles.inp, { backgroundColor:bg, borderColor:brd, color:col, flex:1 }]}
        />
      </View>

      {/* ── Stock suggestions (HTML جیسا autocomplete) ────── */}
      {showSugg && stock.length > 0 && (() => {
        const q = itemName.toLowerCase();
        const seen = new Set();
        const suggs = stock
          .filter(s => s.type === type && (s.name||'').toLowerCase().includes(q) && q.length > 0)
          .filter(s => { if (seen.has(s.name)) return false; seen.add(s.name); return true; })
          .slice(0, 5);
        if (!suggs.length) return null;
        return (
          <View style={{ backgroundColor: dark?COLORS.slate800:COLORS.white, borderWidth:1, borderColor:COLORS.primary, borderRadius:RADIUS.md, marginBottom:SPACING.sm, overflow:'hidden' }}>
            {suggs.map((s, i) => (
              <TouchableOpacity
                key={s.id||i}
                style={{ padding:SPACING.sm, borderBottomWidth:i<suggs.length-1?1:0, borderBottomColor:dark?COLORS.borderDark:COLORS.borderLight, flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}
                onPress={() => {
                  setItemName(s.name);
                  if (s.rate)     setRate(String(s.rate));
                  if (s.costRate) setCostRate(String(s.costRate));
                  setShowSugg(false);
                }}
              >
                <Text style={{ color:dark?COLORS.textDark:COLORS.textLight, fontWeight:'600', fontSize:FONT.sm }}>{s.name}</Text>
                {s.rate ? <Text style={{ color:COLORS.primary, fontSize:FONT.xs, fontWeight:'700' }}>Rs.{s.rate}</Text> : null}
              </TouchableOpacity>
            ))}
          </View>
        );
      })()}

      {/* ── Dimensions / Custom row ───────────────────────── */}
      <View style={{ flexDirection:'row', gap:SPACING.sm, alignItems:'flex-end' }}>

        {/* Door fields */}
        {(type === TYPE_DOOR || type === TYPE_SKIN) && (
          <>
            <View style={{ flex:1 }}>
              <Text style={[styles.dimLabel, { color:subC }]}>W (in)</Text>
              {inp('', w, setW, 'numeric', {}, refW, () => type === TYPE_DOOR ? refHIn.current?.focus() : refQty.current?.focus())}
            </View>
            {type === TYPE_DOOR && (
              <View style={{ flex:1 }}>
                <Text style={[styles.dimLabel, { color:subC }]}>H (in)</Text>
                {inp('', hIn, setHIn, 'numeric', {}, refHIn, () => refQty.current?.focus())}
              </View>
            )}
            {type === TYPE_SKIN && (
              <View style={{ flex:1 }}>
                <Text style={[styles.dimLabel, { color:subC }]}>Height</Text>
                <TouchableOpacity
                  style={[styles.inp, { backgroundColor:bg, borderColor:brd, justifyContent:'center', alignItems:'center' }]}
                  onPress={() => setSkinH(h => h === 84 ? 96 : 84)}
                >
                  <Text style={{ color:COLORS.blue600, fontWeight:'700', fontSize:FONT.xs }}>
                    {skinH === 84 ? '7 Ft' : '8 Ft'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* Wood fields */}
        {type === TYPE_WOOD && (
          <>
            <View style={{ flex:1 }}>
              <TouchableOpacity onPress={() => setWoodLUnit(u => u==='ft'?'m':'ft')}>
                <Text style={[styles.dimLabel, { color:COLORS.blue600, fontWeight:'700' }]}>
                  Len ({woodLUnit}) 🔄
                </Text>
              </TouchableOpacity>
              {inp('', woodL, setWoodL, 'numeric', {}, refWoodL, () => refWoodW.current?.focus())}
            </View>
            <View style={{ flex:1 }}>
              <Text style={[styles.dimLabel, { color:subC }]}>W ({settings?.woodUnit||'in'})</Text>
              {inp('', woodW, setWoodW, 'numeric', {}, refWoodW, () => refWoodT.current?.focus())}
            </View>
            <View style={{ flex:1 }}>
              <Text style={[styles.dimLabel, { color:subC }]}>T ({settings?.woodUnit||'in'})</Text>
              {inp('', woodT, setWoodT, 'numeric', {}, refWoodT, () => refQty.current?.focus())}
            </View>
          </>
        )}

        {/* ── CUSTOM fields: صرف تعداد اور یونٹ ─────────── */}
        {isCustom && (
          <View style={{ flex:1 }}>
            <Text style={[styles.dimLabel, { color:subC }]}>
              Unit (pcs / set / ft)
            </Text>
            <TextInput
              ref={refCustomUnit}
              value={customUnit}
              onChangeText={setCustomUnit}
              placeholder="pcs"
              placeholderTextColor={COLORS.slate400}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => refQty.current?.focus()}
              style={[styles.inp, {
                backgroundColor: bg,
                borderColor: COLORS.indigo600,
                color: col,
              }]}
            />
          </View>
        )}

        {/* Qty — سب میں مشترک */}
        <View style={{ width: isCustom ? 70 : 52 }}>
          <Text style={[styles.dimLabel, { color: subC }]}>
            {isCustom ? 'Qty *' : 'Qty'}
          </Text>
          <TextInput
            ref={refQty}
            placeholder=""
            value={qty}
            onChangeText={setQty}
            keyboardType="numeric"
            placeholderTextColor={COLORS.slate400}
            returnKeyType="done"
            blurOnSubmit={false}
            onSubmitEditing={handleAdd}
            style={[styles.inp, { backgroundColor: bg, borderColor: brd, color: col, textAlign:'center', fontWeight:'700' }]}
          />
        </View>

        {/* Total display box */}
        <View style={[styles.measBox, {
          backgroundColor: isCustom
            ? (dark ? COLORS.indigo600+'40' : '#EEF2FF')
            : (dark ? COLORS.slate700 : COLORS.slate200),
          borderColor: 'transparent',
          borderWidth: isCustom ? 1 : 0,
        }]}>
          {isCustom ? (
            <>
              <Text style={{ fontSize:9, color:COLORS.indigo600, fontWeight:'700' }}>Amt</Text>
              <Text style={{ fontWeight:'800', fontSize:11, color: dark ? COLORS.white : COLORS.slate900 }}>
                {qtyNum > 0 && r > 0 ? formatMoney(qtyNum * r, settings?.currency||'PKR').replace('Rs. ','') : '—'}
              </Text>
            </>
          ) : (
            <>
              <Text style={{ fontSize:9, color:subC }}>{calc.unit}</Text>
              <Text style={{ fontWeight:'700', fontSize:12, color:col }}>
                {(calc.qtyUnit * qtyNum).toFixed(type === TYPE_WOOD ? 4 : 2)}
              </Text>
            </>
          )}
        </View>

        {/* Add button */}
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: COLORS.primary }]}
          onPress={handleAdd}
          activeOpacity={0.8}
        >
          <Text style={{ color:COLORS.white, fontSize:22, fontWeight:'800' }}>
            {initialData ? '✓' : '+'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Custom type: رقم کا خلاصہ ─────────────────────── */}
      {isCustom && qtyNum > 0 && r > 0 && (
        <View style={[styles.customSummary, {
          backgroundColor: dark ? COLORS.slate700+'40' : '#f1f5f9',
          borderColor: brd,
        }]}>
          <Text style={{ color:text, fontSize:FONT.sm }}>
            {qtyNum} {customUnit} × {formatMoney(r, settings?.currency||'PKR')} =
          </Text>
          <Text style={{ color:COLORS.primary, fontWeight:'900', fontSize:FONT.md }}>
            {formatMoney(qtyNum * r, settings?.currency||'PKR')}
          </Text>
        </View>
      )}

      {/* ── Live profit preview (Custom اور باقی دونوں) ────── */}
      {isLive && costRate && qty && (
        <View style={[styles.profitRow, {
          backgroundColor: dark ? 'rgba(22,163,74,0.1)' : COLORS.green50,
          borderColor: dark ? COLORS.green700 : '#86EFAC',
        }]}>
          <Text style={{ color:subC, fontSize:FONT.xs }}>
            Cost: <Text style={{ fontWeight:'700', color:col }}>{formatMoney(totalCost, settings?.currency||'PKR')}</Text>
          </Text>
          <Text style={{ color:subC, fontSize:FONT.xs }}>
            Sale: <Text style={{ fontWeight:'700', color:col }}>{formatMoney(totalAmt, settings?.currency||'PKR')}</Text>
          </Text>
          <Text style={{ color:COLORS.success, fontWeight:'700', fontSize:FONT.xs }}>
            Profit: {formatMoney(profit, settings?.currency||'PKR')}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box:          { padding:SPACING.md, borderRadius:RADIUS.xl, borderWidth:1, marginBottom:SPACING.md },
  typeTab:      { paddingHorizontal:SPACING.md, paddingVertical:6, borderRadius:RADIUS.full, backgroundColor:COLORS.slate200, marginRight:SPACING.sm },
  typeTabActive:{ backgroundColor:COLORS.slate800 },
  typeTabCustom:{ backgroundColor:COLORS.indigo600 },
  typeText:     { fontSize:FONT.xs, fontWeight:'700', color:COLORS.slate600 },
  typeTextActive:{ color:COLORS.white },
  inp:          { borderWidth:1, borderRadius:RADIUS.md, padding:SPACING.sm, fontSize:FONT.sm, height:38 },
  dimLabel:     { fontSize:10, marginBottom:4 },
  measBox:      { width:64, height:38, borderRadius:RADIUS.md, justifyContent:'center', alignItems:'center' },
  addBtn:       { width:44, height:38, borderRadius:RADIUS.md, justifyContent:'center', alignItems:'center' },
  customSummary:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:SPACING.sm, padding:SPACING.sm, borderRadius:RADIUS.md, borderWidth:1 },
  profitRow:    { flexDirection:'row', justifyContent:'space-between', padding:SPACING.sm, borderRadius:RADIUS.md, borderWidth:1, marginTop:SPACING.sm },
});
