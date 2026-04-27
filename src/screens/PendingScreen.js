import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated,
  TouchableOpacity,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { COLORS, SPACING, FONT, RADIUS } from '../utils/theme';

export default function PendingScreen() {
  const { logout, user } = useApp();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue:1.08, duration:900, useNativeDriver:true }),
        Animated.timing(pulse, { toValue:1,    duration:900, useNativeDriver:true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        {/* Icon */}
        <Animated.View style={[styles.iconBox, { transform:[{ scale:pulse }] }]}>
          <Text style={{ fontSize:56 }}>⏳</Text>
        </Animated.View>

        <Text style={styles.title}>Account Pending</Text>
        <Text style={styles.sub}>
          Your account is under review.{'\n'}
          You can use the app after approval.
        </Text>

        {/* Email */}
        <View style={styles.emailBox}>
          <Text style={styles.emailLabel}>Registered Email</Text>
          <Text style={styles.emailVal}>{user?.email || '—'}</Text>
        </View>

        <Text style={styles.note}>
          Approval usually takes a few hours.{'\n'}
          Reopen the app to check your status.
        </Text>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>⏻ Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:      { flex:1, backgroundColor:'#f8fafc', justifyContent:'center', alignItems:'center', padding:SPACING.xl },
  card:      { backgroundColor:'#fff', borderRadius:RADIUS.xxl, padding:SPACING.xl, alignItems:'center', width:'100%', shadowColor:'#000', shadowOffset:{width:0,height:4}, shadowOpacity:0.08, shadowRadius:12, elevation:4 },
  iconBox:   { marginBottom:SPACING.xl },
  title:     { fontSize:FONT.xxl, fontWeight:'800', color:'#1e293b', marginBottom:SPACING.md, textAlign:'center' },
  sub:       { fontSize:FONT.base, color:'#64748b', textAlign:'center', lineHeight:24, marginBottom:SPACING.xl },
  emailBox:  { backgroundColor:'#f1f5f9', borderRadius:RADIUS.lg, padding:SPACING.md, width:'100%', alignItems:'center', marginBottom:SPACING.xl },
  emailLabel:{ fontSize:FONT.xs, color:'#94a3b8', fontWeight:'700', textTransform:'uppercase', marginBottom:4 },
  emailVal:  { fontSize:FONT.base, color:'#1e293b', fontWeight:'600' },
  note:      { fontSize:FONT.xs, color:'#94a3b8', textAlign:'center', lineHeight:20, marginBottom:SPACING.xl },
  logoutBtn: { paddingVertical:SPACING.sm, paddingHorizontal:SPACING.xl },
  logoutText:{ color:COLORS.primary, fontWeight:'700', fontSize:FONT.base },
});
