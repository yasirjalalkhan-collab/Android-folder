// ── AdBanner — Firebase سے dynamic ads ───────────────────────
// Firebase path: ads/active  (global document)
// آپ Firebase Console سے یہ document update کریں — سب users کو فوری نظر آئے گا
//
// Document structure:
// {
//   enabled:    true,
//   title:      "احمد ووڈ ورکس",
//   tagline:    "دروازے، کھڑکیاں، فرنیچر — بہترین قیمت",
//   cta:        "ابھی رابطہ کریں",
//   phone:      "0300-1234567",
//   whatsapp:   "923001234567",
//   bgColor:    "#166534",
//   textColor:  "#ffffff",
//   emoji:      "🪵",
//   badge:      "اشتہار",
// }

import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Linking,
} from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { COLORS, SPACING, RADIUS, FONT, SHADOW } from '../utils/theme';

export default function AdBanner({ dark }) {
  const [ad, setAd]         = useState(null);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Real-time listener — Firebase میں change ہو تو فوری update
    const unsub = onSnapshot(
      doc(db, 'ads', 'active'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.enabled) {
            setAd(data);
            // Fade in animation
            Animated.timing(fadeAnim, {
              toValue: 1, duration: 500, useNativeDriver: true,
            }).start();
          } else {
            setAd(null);
          }
        } else {
          setAd(null);
        }
        setLoading(false);
      },
      (err) => {
        console.log('Ad fetch error:', err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  if (loading || !ad) return null;

  const bg      = ad.bgColor    || (dark ? '#1e293b' : '#166534');
  const txtClr  = ad.textColor  || '#ffffff';
  const emoji   = ad.emoji      || '📢';
  const badge   = ad.badge      || 'Ad';

  const handleCall = () => {
    if (ad.phone) Linking.openURL(`tel:${ad.phone}`);
  };

  const handleWhatsApp = () => {
    if (ad.whatsapp) {
      const msg = encodeURIComponent(`Hello, I saw your ad on Timber 360 app.`);
      Linking.openURL(`https://wa.me/${ad.whatsapp}?text=${msg}`);
    }
  };

  return (
    <Animated.View style={[styles.wrapper, { opacity: fadeAnim }]}>
      <View style={[styles.card, { backgroundColor: bg }]}>
        {/* Badge */}
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        </View>

        {/* Main content — image نہ ہو تو emoji + text */}
        <View style={styles.body}>
          <Text style={{ fontSize:30, marginRight:SPACING.md, flexShrink:0 }}>{emoji}</Text>
          <View style={{ flex:1, minWidth:0 }}>
            <Text style={[styles.title, { color:txtClr }]} numberOfLines={2}>{ad.title}</Text>
            {ad.tagline ? (
              <Text style={[styles.tagline, { color:txtClr+'CC' }]} numberOfLines={2}>{ad.tagline}</Text>
            ) : null}
          </View>
        </View>

        {/* CTA buttons */}
        <View style={styles.ctaRow}>
          {ad.phone ? (
            <TouchableOpacity style={styles.ctaBtn} onPress={handleCall} activeOpacity={0.8}>
              <Text style={styles.ctaBtnText}>📞  {ad.cta || 'Call'}</Text>
            </TouchableOpacity>
          ) : null}
          {ad.whatsapp ? (
            <TouchableOpacity
              style={[styles.ctaBtn, { backgroundColor: '#25D366' }]}
              onPress={handleWhatsApp}
              activeOpacity={0.8}
            >
              <Text style={styles.ctaBtnText}>💬  WhatsApp</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper:   { marginBottom: 4 },
  card:      { borderRadius: RADIUS.xl, padding: SPACING.lg, ...SHADOW.md, overflow: 'hidden' },
  badgeRow:  { flexDirection: 'row', marginBottom: SPACING.sm },
  badge:     { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  body:      { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  title:     { fontSize: FONT.lg, fontWeight: '800', lineHeight: 22 },
  tagline:   { fontSize: FONT.xs, marginTop: 3, lineHeight: 16 },
  ctaRow:    { flexDirection: 'row', gap: SPACING.sm },
  ctaBtn:    { flex: 1, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: RADIUS.lg, paddingVertical: SPACING.sm, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  ctaBtnText:{ color: '#fff', fontWeight: '700', fontSize: FONT.sm },
});
