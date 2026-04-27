import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { COLORS, SPACING, RADIUS, FONT } from '../../utils/theme';

const AppInput = React.forwardRef(function AppInput({
  label, value, onChangeText, placeholder,
  keyboardType = 'default', secureTextEntry, multiline,
  dark, style, inputStyle, editable = true,
  onSubmitEditing, returnKeyType, autoCapitalize = 'none',
}, ref) {
  const bg    = dark ? COLORS.slate700 : COLORS.white;
  const border= dark ? COLORS.borderDark : COLORS.borderLight;
  const color = dark ? COLORS.textDark   : COLORS.textLight;
  const ph    = dark ? COLORS.slate500   : COLORS.slate400;

  return (
    <View style={[styles.wrapper, style]}>
      {label ? <Text style={[styles.label, { color: dark ? COLORS.slate300 : COLORS.slate500 }]}>{label}</Text> : null}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={ph}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        editable={editable}
        onSubmitEditing={onSubmitEditing}
        returnKeyType={returnKeyType}
        autoCapitalize={autoCapitalize}
        blurOnSubmit={false}
        style={[
          styles.input,
          { backgroundColor: bg, borderColor: border, color },
          multiline && { height: 80, textAlignVertical: 'top' },
          !editable && { opacity: 0.5 },
          inputStyle,
        ]}
      />
    </View>
  );
});

export default AppInput;

const styles = StyleSheet.create({
  wrapper: { marginBottom: SPACING.sm },
  label:   { fontSize: FONT.xs, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input:   { borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: FONT.base },
});
