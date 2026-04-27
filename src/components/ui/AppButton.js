import React, { useRef, useState } from 'react';
import {
  TouchableOpacity, Text, StyleSheet,
  Animated, ActivityIndicator, View, Alert,
} from 'react-native';
import { COLORS, SPACING, RADIUS, FONT } from '../../utils/theme';

export default function AppButton({
  children, onPress, variant = 'primary',
  style, disabled = false, loading = false,
}) {
  const [saving, setSaving] = useState(false);
  const scale      = useRef(new Animated.Value(1)).current;
  const mountedRef = useRef(true);

  React.useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const onIn  = () => Animated.spring(scale, { toValue:0.94, useNativeDriver:true, speed:40 }).start();
  const onOut = () => Animated.spring(scale, { toValue:1,    useNativeDriver:true, speed:30 }).start();

  const bg = {
    primary:   COLORS.primary,
    secondary: COLORS.slate200,
    success:   COLORS.success,
    danger:    COLORS.danger,
    indigo:    COLORS.indigo600,
    dark:      COLORS.slate900,
  }[variant] || COLORS.primary;

  const clr        = variant === 'secondary' ? COLORS.slate700 : COLORS.white;
  const isDisabled = disabled || saving || loading;

  const handlePress = async () => {
    if (isDisabled || !onPress) return;
    setSaving(true);
    onOut();
    try {
      await onPress();
    } catch (err) {
      Alert.alert(
        'Error',
        err?.message || 'Something went wrong. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      // Screen unmount ہوجائے تو setState نہ کریں
      if (mountedRef.current) {
        setTimeout(() => {
          if (mountedRef.current) setSaving(false);
        }, 200);
      }
    }
  };

  return (
    <TouchableOpacity
      onPressIn={onIn}
      onPressOut={onOut}
      onPress={handlePress}
      activeOpacity={0.9}
      disabled={isDisabled}
      style={[styles.btn, {
        backgroundColor: isDisabled ? COLORS.slate300 : bg,
        opacity: saving ? 0.88 : 1,
      }, style]}
    >
      <Animated.View style={[
        { flex:1, alignItems:'center', justifyContent:'center', transform: [{ scale }] },
      ]}>
        {saving || loading ? (
          <View style={styles.row}>
            <ActivityIndicator
              size="small"
              color={variant === 'secondary' ? COLORS.slate600 : COLORS.white}
              style={{ marginRight: SPACING.sm }}
            />
            <Text style={[styles.text, { color: COLORS.slate400 }]}>Saving...</Text>
          </View>
        ) : (
          <Text style={[styles.text, { color: isDisabled ? COLORS.slate500 : clr }]}>
            {children}
          </Text>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn:  { padding:SPACING.lg, borderRadius:RADIUS.xl, overflow:'hidden' },
  text: { fontWeight:'700', fontSize:FONT.base },
  row:  { flexDirection:'row', alignItems:'center' },
});
