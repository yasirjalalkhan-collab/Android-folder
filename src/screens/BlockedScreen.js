import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useApp } from '../context/AppContext';
import { COLORS, SPACING, FONT, RADIUS } from '../utils/theme';

export default function BlockedScreen() {
  const { logout, user } = useApp();
  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={{ fontSize:56, marginBottom:SPACING.xl }}>🚫</Text>
        <Text style={styles.title}>Account Blocked</Text>
        <Text style={styles.sub}>
          Your account has been blocked.{'\n'}
          Please contact us for more information.
        </Text>
        <View style={styles.emailBox}>
          <Text style={styles.emailLabel}>Account</Text>
          <Text style={styles.emailVal}>{user?.email || '—'}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>⏻ Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:      { flex:1, backgroundColor:'#fef2f2', justifyContent:'center', alignItems:'center', padding:SPACING.xl },
  card:      { backgroundColor:'#fff', borderRadius:RADIUS.xxl, padding:SPACING.xl, alignItems:'center', width:'100%', shadowColor:'#000', shadowOffset:{width:0,height:4}, shadowOpacity:0.08, shadowRadius:12, elevation:4 },
  title:     { fontSize:FONT.xxl, fontWeight:'800', color:'#dc2626', marginBottom:SPACING.md, textAlign:'center' },
  sub:       { fontSize:FONT.base, color:'#64748b', textAlign:'center', lineHeight:24, marginBottom:SPACING.xl },
  emailBox:  { backgroundColor:'#fef2f2', borderRadius:RADIUS.lg, padding:SPACING.md, width:'100%', alignItems:'center', marginBottom:SPACING.xl },
  emailLabel:{ fontSize:FONT.xs, color:'#94a3b8', fontWeight:'700', textTransform:'uppercase', marginBottom:4 },
  emailVal:  { fontSize:FONT.base, color:'#1e293b', fontWeight:'600' },
  logoutBtn: { paddingVertical:SPACING.sm, paddingHorizontal:SPACING.xl },
  logoutText:{ color:COLORS.primary, fontWeight:'700', fontSize:FONT.base },
});
