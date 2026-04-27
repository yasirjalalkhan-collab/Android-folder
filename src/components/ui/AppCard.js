import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS, SPACING, RADIUS, SHADOW } from '../../utils/theme';

export default function AppCard({ children, style, dark }) {
  return (
    <View style={[
      styles.card,
      dark && { backgroundColor: COLORS.surfaceDark },
      style
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOW.sm,
  },
});
