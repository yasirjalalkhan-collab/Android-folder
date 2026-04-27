// ── OrderTrackingScreen — Invoice Tracking Update ────────────
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { useApp } from '../context/AppContext';
import { COLORS, SPACING, RADIUS, FONT, SHADOW } from '../utils/theme';
import { formatDate, formatMoney } from '../utils/helpers';

// ── Tracking statuses ─────────────────────────────────────────
const STATUSES = [
  { key:'pending',    label:'آرڈر موصول',    eng:'Order Received',  color:'#64748b', bg:'#f1f5f9', icon:'📥' },
  { key:'processing', label:'کام جاری ہے',    eng:'In Production',   color:'#d97706', bg:'#fffbeb', icon:'⚙️' },
  { key:'ready',      label:'تیار ہے',        eng:'Ready',           color:'#0891b2', bg:'#ecfeff', icon:'✅' },
  { key:'dispatched', label:'روانہ کر دیا',   eng:'Dispatched',      color:'#7c3aed', bg:'#f5f3ff', icon:'🚚' },
  { key:'delivered',  label:'پہنچ گیا',       eng:'Delivered',       color:'#16a34a', bg:'#f0fdf4', icon:'🏠' },
  { key:'closed',     label:'مکمل',           eng:'Delivered & Closed', color:'#166534', bg:'#dcfce7', icon:'🔒' },
];

export default function OrderTrackingScreen() {
  const navigation = useNavigation();
  const { params }  = useRoute();
  const { settings, profile, isFirebaseMode, updateTracking, getTracking, showAlert, showConfirm } = useApp();

  const invoice   = params?.invoice;
  const dark      = settings.mode === 'dark';
  const bg        = dark ? COLORS.bgDark     : '#f8fafc';
  const card      = dark ? COLORS.surfaceDark : COLORS.white;
  const text      = dark ? COLORS.textDark   : COLORS.textLight;
  const sub       = dark ? COLORS.slate400   : COLORS.slate500;
  const brd       = dark ? COLORS.borderDark : COLORS.borderLight;

  const [tracking,  setTracking]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [note,      setNote]      = useState('');
  const [saving,    setSaving]    = useState(false);
  const [newStatus, setNewStatus] = useState(null);

  // Tracking base URL — settings سے یا default
  const trackingBase = settings.trackingUrl ||
    `https://firestore.googleapis.com/v1/projects/timber-360/databases/(default)/documents/tracking`;
  const qrUrl = `${settings.trackingUrl || 'https://yasirjalalkhan-collab.github.io/tracking'}?id=${invoice?.id}`;

  useEffect(() => {
    if (!invoice) return;
    getTracking(invoice.id).then(data => {
      setTracking(data);
      if (data?.status) setNewStatus(data.status);
      setLoading(false);
    });
  }, [invoice?.id]);

  if (!invoice) return null;

  const currentSt = STATUSES.find(s => s.key === (tracking?.status||'pending')) || STATUSES[0];

  const handleUpdate = async () => {
    if (!newStatus) return;
    if (newStatus === tracking?.status && !note.trim()) {
      await showAlert('Please select a different status or add a note', 'No Change');
      return;
    }
    if (newStatus === 'closed') {
      const ok = await showConfirm(
        '⚠️ "Delivered & Closed" کرنے پر QR code ایک ہفتے بعد کام کرنا بند کر دے گا۔\n\nکیا آپ یقین سے بند کرنا چاہتے ہیں؟',
        'Confirm Close'
      );
      if (!ok) return;
    }
    setSaving(true);
    await updateTracking(invoice.id, newStatus, note.trim());
    const updated = await getTracking(invoice.id);
    setTracking(updated);
    setNote('');
    setSaving(false);
    await showAlert('Status updated ✅', 'Done');
  };

  return (
    <View style={[styles.root, { backgroundColor:bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: COLORS.slate800 }]}>
        <Text style={{ color:'#fff', fontWeight:'700', fontSize:FONT.base }}>
          Order Tracking #{invoice.id}
        </Text>
        <View style={{ width:60 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding:SPACING.md, paddingBottom:80 }}>

        {/* QR Code Card */}
        <View style={[styles.card, { backgroundColor:card, borderColor:brd }]}>
          <Text style={[styles.cardTitle, { color:text }]}>📱 Customer Tracking QR</Text>
          <Text style={[styles.cardSub, { color:sub }]}>
            کسٹمر اس QR کو اپنے فون کے کیمرے سے اسکین کر کے آرڈر کا status دیکھ سکتا ہے
          </Text>
          <View style={{ alignItems:'center', marginVertical:SPACING.xl }}>
            <View style={{ padding:SPACING.md, backgroundColor:'#fff', borderRadius:RADIUS.lg }}>
              <QRCode
                value={qrUrl}
                size={180}
                color="#1e293b"
                backgroundColor="#fff"
              />
            </View>
            <Text style={{ color:sub, fontSize:10, marginTop:SPACING.sm, textAlign:'center' }}>
              Invoice #{invoice.id} • {invoice.customer?.name}
            </Text>
          </View>

          {/* Current Status Badge */}
          {loading ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: currentSt.bg }]}>
              <Text style={{ fontSize:24 }}>{currentSt.icon}</Text>
              <View style={{ flex:1, marginLeft:SPACING.md }}>
                <Text style={{ fontWeight:'800', fontSize:FONT.base, color: currentSt.color }}>
                  {currentSt.eng}
                </Text>
                <Text style={{ fontSize:FONT.sm, color: currentSt.color, opacity:0.8 }}>
                  {currentSt.label}
                </Text>
              </View>
              <Text style={{ fontSize:FONT.xs, color:currentSt.color, opacity:0.6 }}>
                CURRENT
              </Text>
            </View>
          )}
        </View>

        {/* Update Status Card */}
        <View style={[styles.card, { backgroundColor:card, borderColor:brd }]}>
          <Text style={[styles.cardTitle, { color:text }]}>🔄 Status Update کریں</Text>

          {STATUSES.map(s => {
            const active = newStatus === s.key;
            return (
              <TouchableOpacity
                key={s.key}
                style={[styles.statusOption, {
                  borderColor: active ? s.color : brd,
                  backgroundColor: active ? s.bg : card,
                }]}
                onPress={() => setNewStatus(s.key)}
              >
                <View style={[styles.radio, {
                  borderColor: active ? s.color : brd,
                }]}>
                  {active && <View style={[styles.radioDot, { backgroundColor: s.color }]} />}
                </View>
                <Text style={{ fontSize:18, marginHorizontal:SPACING.sm }}>{s.icon}</Text>
                <View style={{ flex:1 }}>
                  <Text style={{ fontWeight:'700', color: active ? s.color : text, fontSize:FONT.base }}>
                    {s.eng}
                  </Text>
                  <Text style={{ color: active ? s.color : sub, fontSize:FONT.xs }}>
                    {s.label}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Note field */}
          <View style={{ marginTop:SPACING.md }}>
            <Text style={{ color:sub, fontSize:FONT.xs, fontWeight:'700', marginBottom:6, textTransform:'uppercase' }}>
              Note (اختیاری)
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="مثال: آرڈر تیار ہے، کل تک پہنچ جائے گا..."
              placeholderTextColor={sub}
              style={[styles.noteInput, { color:text, borderColor:brd, backgroundColor: dark?COLORS.bgDark:'#f8fafc' }]}
              multiline
              numberOfLines={3}
            />
          </View>

          <TouchableOpacity
            style={[styles.updateBtn, { backgroundColor: saving ? COLORS.slate400 : COLORS.primary }]}
            onPress={handleUpdate}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={{ color:'#fff', fontWeight:'800', fontSize:FONT.base }}>✅ Update Status</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Status History */}
        {tracking?.statusHistory?.length > 0 && (
          <View style={[styles.card, { backgroundColor:card, borderColor:brd }]}>
            <Text style={[styles.cardTitle, { color:text }]}>📋 Status History</Text>
            {[...(tracking.statusHistory||[])].reverse().map((h, i) => {
              const st = STATUSES.find(s => s.key === h.status) || STATUSES[0];
              return (
                <View key={i} style={[styles.histRow, { borderLeftColor: st.color }]}>
                  <Text style={{ fontSize:14 }}>{st.icon}</Text>
                  <View style={{ flex:1, marginLeft:SPACING.sm }}>
                    <Text style={{ fontWeight:'700', color: st.color, fontSize:FONT.sm }}>
                      {st.eng}
                    </Text>
                    {h.note ? (
                      <Text style={{ color:sub, fontSize:FONT.xs, marginTop:2 }}>{h.note}</Text>
                    ) : null}
                    <Text style={{ color:sub, fontSize:10, marginTop:2 }}>
                      {formatDate(new Date(parseInt(h.time||Date.now())).toISOString())}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Expiry info */}
        {tracking?.expiresAt && (
          <View style={[styles.card, { backgroundColor:'#fffbeb', borderColor:'#fde68a' }]}>
            <Text style={{ color:'#92400e', fontWeight:'700', fontSize:FONT.sm }}>
              ⏳ QR Code Expiry
            </Text>
            <Text style={{ color:'#92400e', fontSize:FONT.xs, marginTop:4 }}>
              {new Date(parseInt(tracking.expiresAt)) > new Date()
                ? `یہ QR ${formatDate(new Date(parseInt(tracking.expiresAt)).toISOString())} کو کام کرنا بند کر دے گا`
                : 'یہ QR expire ہو چکا ہے'
              }
            </Text>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex:1 },
  header:       { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:SPACING.md, paddingTop:SPACING.lg },
  card:         { borderRadius:RADIUS.xl, padding:SPACING.lg, marginBottom:SPACING.md, borderWidth:1, ...SHADOW.sm },
  cardTitle:    { fontWeight:'800', fontSize:FONT.lg, marginBottom:4 },
  cardSub:      { fontSize:FONT.xs, lineHeight:18, marginBottom:SPACING.sm },
  statusBadge:  { flexDirection:'row', alignItems:'center', padding:SPACING.md, borderRadius:RADIUS.lg },
  statusOption: { flexDirection:'row', alignItems:'center', padding:SPACING.md, borderRadius:RADIUS.lg, borderWidth:2, marginBottom:SPACING.sm },
  radio:        { width:22, height:22, borderRadius:11, borderWidth:2, justifyContent:'center', alignItems:'center' },
  radioDot:     { width:12, height:12, borderRadius:6 },
  noteInput:    { borderWidth:1, borderRadius:RADIUS.md, padding:SPACING.md, fontSize:FONT.sm, textAlignVertical:'top', minHeight:80 },
  updateBtn:    { padding:SPACING.lg, borderRadius:RADIUS.xl, alignItems:'center', marginTop:SPACING.md },
  histRow:      { flexDirection:'row', borderLeftWidth:3, paddingLeft:SPACING.md, marginBottom:SPACING.md },
});
