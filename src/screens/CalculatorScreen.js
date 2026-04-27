// ── Calculator Screen — exact port from HTML ──────────────────
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { COLORS, SPACING, RADIUS, FONT, SHADOW } from '../utils/theme';
import { FadeSlideIn, ScalePress } from '../components/ui/Animated';

export default function CalculatorScreen() {
  const navigation = useNavigation();
  const { settings } = useApp();
  const dark = settings.mode === 'dark';
  const bg   = dark ? COLORS.bgDark     : '#F1F5F9';
  const card = dark ? COLORS.surfaceDark : COLORS.white;
  const text = dark ? COLORS.textDark   : COLORS.textLight;

  const [input,      setInput]      = useState('');
  const [liveResult, setLiveResult] = useState('');
  const [history,    setHistory]    = useState([]);

  // Live result preview
  useEffect(() => {
    if (!input) { setLiveResult(''); return; }
    try {
      // صرف numbers اور operators — کوئی بھی دوسری string reject
      if (!/^[0-9+\-*\/×÷−%.() ]+$/.test(input)) { setLiveResult(''); return; }
      const expr = input.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-');
      const r = Function('"use strict"; return (' + expr + ')')();
      if (isFinite(r) && !isNaN(r) && String(r) !== input) {
        setLiveResult(Number(r.toFixed(6)).toString());
      } else setLiveResult('');
    } catch { setLiveResult(''); }
  }, [input]);

  const handleBtn = (b) => {
    if (b === 'C')  { setInput(''); setLiveResult(''); return; }
    if (b === '⌫')  { setInput(p => p.slice(0, -1)); return; }
    if (b === '%')  {
      try {
        if (!/^[0-9+\-*\/×÷%.() ]+$/.test(input)) return;
        const expr = input.replace(/×/g,'*').replace(/÷/g,'/');
        const r = Function('"use strict"; return (' + expr + ')')();
        setInput(String(r / 100));
      } catch { setInput(p => p + '%'); }
      return;
    }
    if (b === '=') {
      try {
        if (!/^[0-9+\-*\/×÷−%.() ]+$/.test(input)) { setInput('Error'); return; }
        const expr = input.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-');
        const r = Function('"use strict"; return (' + expr + ')')();
        if (!isFinite(r) || isNaN(r)) { setInput('Error'); return; }
        const result = Number(r.toFixed(10)).toString();
        setHistory(h => [`${input} = ${result}`, ...h.slice(0, 9)]);
        setInput(result);
        setLiveResult('');
      } catch { setInput('Error'); }
      return;
    }
    if (input === 'Error') { setInput(b); return; }
    // Prevent double operators
    const ops = ['+','-','×','÷','*','/'];
    if (ops.includes(b) && ops.includes(input.slice(-1))) {
      setInput(p => p.slice(0,-1) + b);
      return;
    }
    setInput(p => p + b);
  };

  const btns = [
    { label:'C',   color:COLORS.danger,   textColor:COLORS.white },
    { label:'⌫',   color:'#FEF2F2',       textColor:COLORS.danger },
    { label:'%',   color:dark?COLORS.slate700:COLORS.slate100, textColor:COLORS.primary },
    { label:'÷',   color:COLORS.primary,  textColor:COLORS.white },
    { label:'7',   color:card },
    { label:'8',   color:card },
    { label:'9',   color:card },
    { label:'×',   color:COLORS.primary,  textColor:COLORS.white },
    { label:'4',   color:card },
    { label:'5',   color:card },
    { label:'6',   color:card },
    { label:'-',   color:COLORS.primary,  textColor:COLORS.white },
    { label:'1',   color:card },
    { label:'2',   color:card },
    { label:'3',   color:card },
    { label:'+',   color:COLORS.primary,  textColor:COLORS.white },
    { label:'00',  color:card },
    { label:'0',   color:card },
    { label:'.',   color:card },
    { label:'=',   color:COLORS.slate900, textColor:COLORS.primaryLight },
  ];

  return (
    <View style={[styles.root, { backgroundColor:bg }]}>
      {/* Header */}
      <FadeSlideIn delay={0}>
        <View style={[styles.header, { backgroundColor:card }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <View style={[styles.closeCircle, { backgroundColor:COLORS.danger }]}>
              <Text style={{ color:COLORS.white, fontSize:18, fontWeight:'700' }}>✕</Text>
            </View>
          </TouchableOpacity>
          <Text style={[styles.title, { color:COLORS.primary }]}>Calculator</Text>
          <View style={{ width:40 }} />
        </View>
      </FadeSlideIn>

      {/* Display */}
      <FadeSlideIn delay={60}>
        <View style={[styles.display, { backgroundColor:COLORS.slate800, borderColor:COLORS.primary }]}>
          {/* History */}
          <ScrollView style={{ maxHeight:60 }} showsVerticalScrollIndicator={false}>
            {history.slice(0, 3).map((h, i) => (
              <Text key={i} style={styles.histText}>{h}</Text>
            ))}
          </ScrollView>
          {/* Live preview */}
          {liveResult ? (
            <Text style={styles.liveResult}>= {liveResult}</Text>
          ) : null}
          {/* Main input */}
          <Text style={styles.displayText} numberOfLines={1} adjustsFontSizeToFit>
            {input || '0'}
          </Text>
        </View>
      </FadeSlideIn>

      {/* Buttons grid */}
      <FadeSlideIn delay={120}>
        <View style={styles.grid}>
          {btns.map((b, i) => (
            <CalcBtn
              key={i}
              label={b.label}
              color={b.color || card}
              textColor={b.textColor || (dark ? COLORS.textDark : COLORS.textLight)}
              onPress={() => handleBtn(b.label)}
            />
          ))}
        </View>
      </FadeSlideIn>
    </View>
  );
}

function CalcBtn({ label, color, textColor, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  const onIn  = () => Animated.spring(scale, { toValue:0.88, useNativeDriver:true, speed:40 }).start();
  const onOut = () => Animated.spring(scale, { toValue:1,    useNativeDriver:true, speed:30 }).start();

  return (
    <TouchableOpacity onPressIn={onIn} onPressOut={onOut} onPress={onPress} activeOpacity={1} style={{ width:'25%', padding:4 }}>
      <Animated.View style={[styles.btn, { backgroundColor:color, transform:[{scale}] }]}>
        <Text style={[styles.btnText, { color:textColor }]}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root:      { flex:1 },
  header:    { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:SPACING.lg, ...SHADOW.sm },
  backBtn:   { padding:SPACING.xs },
  closeCircle:{ width:36, height:36, borderRadius:18, justifyContent:'center', alignItems:'center' },
  title:     { fontSize:FONT.xl, fontWeight:'800' },
  display:   { margin:SPACING.lg, borderRadius:RADIUS.xxl, padding:SPACING.xl, borderWidth:2, minHeight:140, justifyContent:'flex-end' },
  histText:  { color:COLORS.slate400, fontSize:FONT.xs, textAlign:'right', fontFamily:'monospace' },
  liveResult:{ color:COLORS.primaryLight, fontSize:FONT.md, fontWeight:'600', textAlign:'right', marginBottom:4, fontFamily:'monospace' },
  displayText:{ color:COLORS.white, fontSize:FONT.xxxl, fontWeight:'800', textAlign:'right', fontFamily:'monospace' },
  grid:      { flex:1, flexDirection:'row', flexWrap:'wrap', paddingHorizontal:SPACING.md, paddingBottom:20 },
  btn:       { height:72, borderRadius:RADIUS.xl, justifyContent:'center', alignItems:'center', ...SHADOW.sm },
  btnText:   { fontSize:FONT.xxl, fontWeight:'700' },
});
