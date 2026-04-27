// ── PromptModal — Custom animated prompt (fixes showPrompt bug) ─
import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  Animated, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS, SPACING, RADIUS, FONT, SHADOW } from '../../utils/theme';

export default function PromptModal({
  visible, type = 'alert', title, message, defaultValue = '',
  onConfirm, onCancel, dark,
}) {
  const [inputVal, setInputVal] = useState(defaultValue || '');
  const scale   = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setInputVal(defaultValue || '');
      setMounted(true);
      Animated.parallel([
        Animated.spring(scale,   { toValue:1, useNativeDriver:true, tension:90, friction:8 }),
        Animated.timing(opacity, { toValue:1, duration:200, useNativeDriver:true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(scale,   { toValue:0.85, useNativeDriver:true, tension:90, friction:8 }),
        Animated.timing(opacity, { toValue:0,    duration:180, useNativeDriver:true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  if (!mounted) return null;

  const card  = dark ? COLORS.surfaceDark : COLORS.white;
  const text  = dark ? COLORS.textDark   : COLORS.textLight;
  const sub   = dark ? COLORS.slate400   : COLORS.slate500;
  const brd   = dark ? COLORS.borderDark : COLORS.borderLight;

  const typeIcon = type === 'alert' ? '🔔' : type === 'confirm' ? '❓' : '✏️';

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <TouchableOpacity style={{ flex:1 }} onPress={type !== 'prompt' ? onCancel : undefined} activeOpacity={1} />
      </Animated.View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.center}>
        <Animated.View style={[styles.card, { backgroundColor:card, transform:[{scale}], opacity }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.icon}>{typeIcon}</Text>
            <Text style={[styles.title, { color:COLORS.white }]}>{title || 'Notice'}</Text>
          </View>
          {/* Body */}
          <View style={styles.body}>
            <Text style={[styles.message, { color:text }]}>{message}</Text>
            {type === 'prompt' && (
              <TextInput
                value={inputVal}
                onChangeText={setInputVal}
                style={[styles.input, { color:text, borderColor:brd, backgroundColor: dark ? COLORS.slate700 : COLORS.slate50 }]}
                autoFocus
                placeholderTextColor={sub}
                onSubmitEditing={() => onConfirm && onConfirm(inputVal)}
              />
            )}
            {/* Buttons */}
            <View style={styles.btnRow}>
              {(type === 'confirm' || type === 'prompt') && (
                <TouchableOpacity style={[styles.btn, styles.btnCancel, { borderColor:brd }]} onPress={onCancel}>
                  <Text style={[styles.btnText, { color:sub }]}>Cancel</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.btn, styles.btnOk]}
                onPress={() => onConfirm && onConfirm(type === 'prompt' ? inputVal : true)}
              >
                <Text style={[styles.btnText, { color:COLORS.white }]}>
                  {type === 'prompt' ? 'Submit' : type === 'confirm' ? 'OK' : 'OK'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position:'absolute', top:0, left:0, right:0, bottom:0, zIndex:9999 },
  backdrop:{ ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(0,0,0,0.6)' },
  center:  { flex:1, justifyContent:'center', alignItems:'center', padding:SPACING.xl },
  card:    { width:'100%', borderRadius:RADIUS.xxl, overflow:'hidden', ...SHADOW.lg },
  header:  { backgroundColor:COLORS.primary, flexDirection:'row', alignItems:'center', gap:SPACING.md, padding:SPACING.xl },
  icon:    { fontSize:22 },
  title:   { fontSize:FONT.lg, fontWeight:'800', flex:1 },
  body:    { padding:SPACING.xl },
  message: { fontSize:FONT.base, lineHeight:22, marginBottom:SPACING.lg },
  input:   { borderWidth:2, borderRadius:RADIUS.lg, padding:SPACING.md, fontSize:FONT.base, marginBottom:SPACING.lg },
  btnRow:  { flexDirection:'row', gap:SPACING.md, justifyContent:'flex-end' },
  btn:     { paddingVertical:SPACING.md, paddingHorizontal:SPACING.xl, borderRadius:RADIUS.lg, minWidth:90, alignItems:'center' },
  btnCancel:{ borderWidth:1.5 },
  btnOk:   { backgroundColor:COLORS.primary },
  btnText: { fontWeight:'700', fontSize:FONT.base },
});
