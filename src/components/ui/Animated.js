// ── Reusable Animated Components ─────────────────────────────
import React, { useEffect, useRef } from 'react';
import { Animated, TouchableOpacity, View, Modal, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

// ── FadeSlideIn ───────────────────────────────────────────────
// flash روکنے کے لیے: opacity نہیں بلکہ translateY سے animate
// پہلی render پر invisible ہو، پھر smooth آئے
export function FadeSlideIn({ children, delay = 0, style }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    // Delay سے پہلے بالکل invisible — کوئی flash نہیں
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity,    { toValue:1, duration:220, useNativeDriver:true }),
        Animated.timing(translateY, { toValue:0, duration:220, useNativeDriver:true }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[{ opacity, transform:[{translateY}] }, style]}>
      {children}
    </Animated.View>
  );
}

// ── ScalePress ────────────────────────────────────────────────
// FIX: style کو Animated.View پر لگائیں تاکہ flexDirection کام کرے
export function ScalePress({ children, onPress, style, disabled }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue:0.96, useNativeDriver:true, speed:40 }).start();
  const onOut = () => Animated.spring(scale, { toValue:1,    useNativeDriver:true, speed:30 }).start();
  // کالا دائرہ روکنے کے لیے: Animated.View باہر، TouchableOpacity اندر
  // Animated.View تمام layout styles لیتا ہے، TouchableOpacity صرف press handle
  return (
    <Animated.View style={[style, { transform:[{ scale }] }]}>
      {children}
      <TouchableOpacity
        onPressIn={onIn}
        onPressOut={onOut}
        onPress={onPress}
        activeOpacity={1}
        disabled={disabled}
        style={StyleSheet.absoluteFillObject}
      />
    </Animated.View>
  );
}

// ── SlideModal ────────────────────────────────────────────────
export function SlideModal({ visible, children, onClose, style }) {
  const translateY = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, { toValue:0, useNativeDriver:true, tension:80, friction:10 }).start();
    } else {
      Animated.timing(translateY, { toValue:600, duration:220, useNativeDriver:true }).start();
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex:1 }}
      >
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.55)', justifyContent:'flex-end' }}>
          <Animated.View style={[
            {
              borderTopLeftRadius:24, borderTopRightRadius:24,
              backgroundColor:'#fff', maxHeight:'92%',
              transform:[{translateY}],
            },
            style,
          ]}>
            {children}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── ExpandCollapse ────────────────────────────────────────────
export function ExpandCollapse({ visible, children }) {
  const opacity  = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [show, setShow] = React.useState(visible);

  useEffect(() => {
    if (visible) {
      setShow(true);
      Animated.timing(opacity, { toValue:1, duration:220, useNativeDriver:true }).start();
    } else {
      Animated.timing(opacity, { toValue:0, duration:180, useNativeDriver:true })
        .start(() => setShow(false));
    }
  }, [visible]);

  if (!show) return null;

  return (
    <Animated.View style={{ opacity, overflow:'hidden' }}>
      {children}
    </Animated.View>
  );
}

// ── Pulse ─────────────────────────────────────────────────────
export function Pulse({ children, style }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue:1.04, duration:900, useNativeDriver:true }),
        Animated.timing(scale, { toValue:1,    duration:900, useNativeDriver:true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[{ transform:[{scale}] }, style]}>
      {children}
    </Animated.View>
  );
}
