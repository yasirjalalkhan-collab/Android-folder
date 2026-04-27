import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Vibration, Animated } from 'react-native';
import { useApp } from '../context/AppContext';
import { COLORS, SPACING, RADIUS, FONT } from '../utils/theme';

export default function PinScreen() {
  const { settings, setIsLocked, user } = useApp();
  const [pin,      setPin]      = useState('');
  const [error,    setError]    = useState(false);
  const [showPin,  setShowPin]  = useState(false);

  // systemId — HTML جیسا 4 digit ID
  const [systemId] = useState(() => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      // sync fallback
      return Math.floor(1000 + Math.random() * 9000).toString();
    } catch { return '0000'; }
  });

  // Shake animation برائے غلط PIN
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const entranceY = useRef(new Animated.Value(30)).current;
  const entranceO = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entranceY, { toValue:0, duration:400, useNativeDriver:true }),
      Animated.timing(entranceO, { toValue:1, duration:400, useNativeDriver:true }),
    ]).start();
  }, []);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:10,  duration:60,  useNativeDriver:true }),
      Animated.timing(shakeAnim, { toValue:-10, duration:60,  useNativeDriver:true }),
      Animated.timing(shakeAnim, { toValue:8,   duration:60,  useNativeDriver:true }),
      Animated.timing(shakeAnim, { toValue:-8,  duration:60,  useNativeDriver:true }),
      Animated.timing(shakeAnim, { toValue:0,   duration:60,  useNativeDriver:true }),
    ]).start();
  };

  const press = (d) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next); setError(false);
    if (next.length === 4) {
      if (next === settings.securityPin) {
        setIsLocked(false);
      } else {
        Vibration.vibrate(400);
        setError(true);
        shake();
        setTimeout(() => setPin(''), 700);
      }
    }
  };

  const del = () => setPin(p => p.slice(0,-1));

  const BTNS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.inner, { opacity:entranceO, transform:[{translateY:entranceY}] }]}>
        <Text style={styles.icon}>🔒</Text>
        <Text style={styles.title}>Enter PIN</Text>
        <Text style={styles.sub}>Timber 360</Text>

        {/* Dots */}
        <Animated.View style={[styles.dots, { transform:[{translateX:shakeAnim}] }]}>
          {[0,1,2,3].map(i=>(
            <View key={i} style={[
              styles.dot,
              i < pin.length && (showPin ? styles.dotFilled : styles.dotFilledHide),
              error && styles.dotError,
            ]}>
              {showPin && i < pin.length && (
                <Text style={{color:COLORS.white,fontWeight:'800',fontSize:FONT.base}}>{pin[i]}</Text>
              )}
            </View>
          ))}
        </Animated.View>

        {error && <Text style={styles.err}>❌ Incorrect PIN</Text>}

        {/* Toggle show pin */}
        <TouchableOpacity onPress={()=>setShowPin(!showPin)} style={{marginBottom:SPACING.xl}}>
          <Text style={{color:COLORS.slate400,fontSize:FONT.xs}}>{showPin?'Hide':'Show PIN'}</Text>
        </TouchableOpacity>

        {/* Keypad */}
        <View style={styles.pad}>
          {BTNS.map((b,i)=>(
            b==='' ? <View key={i} style={styles.padEmpty} /> :
            <TouchableOpacity key={i} style={styles.padBtn}
              onPress={()=>b==='⌫'?del():press(b)} activeOpacity={0.7}>
              <Text style={styles.padBtnText}>{b}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* System ID */}
        <View style={styles.sysIdBox}>
          <Text style={{color:COLORS.slate500,fontSize:FONT.xs,textAlign:'center'}}>
            Forgot PIN? Send this ID to Admin:
          </Text>
          <Text style={styles.sysId}>{systemId}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:       { flex:1, backgroundColor:COLORS.slate900, justifyContent:'center', alignItems:'center' },
  inner:      { alignItems:'center', padding:SPACING.xl, width:'100%' },
  icon:       { fontSize:56, marginBottom:SPACING.md },
  title:      { fontSize:FONT.xxl, fontWeight:'800', color:COLORS.white, marginBottom:4 },
  sub:        { fontSize:FONT.sm, color:COLORS.slate400, marginBottom:SPACING.xxxl },
  dots:       { flexDirection:'row', gap:SPACING.lg, marginBottom:SPACING.lg },
  dot:        { width:52, height:60, borderRadius:RADIUS.lg, borderWidth:2, borderColor:COLORS.slate500, backgroundColor:'transparent', justifyContent:'center', alignItems:'center' },
  dotFilled:  { backgroundColor:COLORS.primary, borderColor:COLORS.primary },
  dotFilledHide:{ backgroundColor:COLORS.primary, borderColor:COLORS.primary },
  dotError:   { backgroundColor:COLORS.danger, borderColor:COLORS.danger },
  err:        { color:COLORS.danger, fontSize:FONT.sm, marginBottom:SPACING.md, fontWeight:'700' },
  pad:        { flexDirection:'row', flexWrap:'wrap', width:280, gap:12, justifyContent:'center', marginBottom:SPACING.xl },
  padEmpty:   { width:72, height:72 },
  padBtn:     { width:72, height:72, borderRadius:36, backgroundColor:COLORS.slate700, justifyContent:'center', alignItems:'center' },
  padBtnText: { fontSize:FONT.xxl, fontWeight:'600', color:COLORS.white },
  sysIdBox:   { backgroundColor:COLORS.slate800, borderRadius:RADIUS.lg, padding:SPACING.lg, width:'100%', alignItems:'center' },
  sysId:      { fontSize:FONT.xxxl, fontWeight:'900', color:COLORS.white, fontFamily:'monospace', letterSpacing:8, marginTop:4 },
});
