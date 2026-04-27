// ── Admin Panel — Timber 360 ──────────────────────────────────
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  StyleSheet, TextInput, Switch, Alert, ActivityIndicator, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import {
  collection, doc, onSnapshot, setDoc,
  getDocs, deleteDoc, addDoc, updateDoc, getDoc,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useApp } from '../context/AppContext';
import { COLORS, SPACING, RADIUS, FONT, SHADOW } from '../utils/theme';
import { formatDate } from '../utils/helpers';
import AppButton from '../components/ui/AppButton';
import AppInput  from '../components/ui/AppInput';

// ── Status badge ──────────────────────────────────────────────
const STATUS_COLOR = {
  pending:  { bg:'#FFF7ED', fg:'#92400E', label:'⏳ Pending'  },
  approved: { bg:'#F0FDF4', fg:'#166534', label:'✓ Approved'  },
  firebase: { bg:'#EFF6FF', fg:'#1E40AF', label:'☁️ Firebase' },
  blocked:  { bg:'#FEF2F2', fg:'#991B1B', label:'🚫 Blocked'  },
};

function StatusBadge({ status }) {
  const s = STATUS_COLOR[status] || STATUS_COLOR.pending;
  return (
    <View style={[styles.badge, { backgroundColor:s.bg }]}>
      <Text style={{ color:s.fg, fontSize:FONT.xs, fontWeight:'700' }}>{s.label}</Text>
    </View>
  );
}

// ── User Card ─────────────────────────────────────────────────
// ── User Action Confirm Modal ────────────────────────────────
function UserActionModal({ user, visible, onClose, onConfirm }) {
  const [selected, setSelected] = React.useState(null);

  if (!user) return null;

  const actions = [];
  if (user.status === 'pending')   actions.push({ key:'approve',  label:'✅ Approve',    color:'#166534', bg:'#F0FDF4' });
  if (user.status === 'approved')  actions.push({ key:'firebase',  label:'☁️ Firebase',   color:'#1E40AF', bg:'#EFF6FF' });
  if (user.status === 'firebase')  actions.push({ key:'approved',  label:'⬇️ Downgrade', color:'#92400E', bg:'#FFFBEB' });
  if (user.status !== 'blocked')   actions.push({ key:'block',     label:'🚫 Block',      color:'#991B1B', bg:'#FEF2F2' });
  else                             actions.push({ key:'unblock',   label:'🔓 Unblock',    color:'#166534', bg:'#F0FDF4' });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex:1, backgroundColor:'rgba(0,0,0,0.5)' }} activeOpacity={1} onPress={onClose} />
      <View style={{ backgroundColor:'#fff', borderTopLeftRadius:20, borderTopRightRadius:20, padding:20, paddingBottom:40 }}>
        <Text style={{ fontWeight:'800', fontSize:16, color:'#1e293b', marginBottom:4 }}>User Action</Text>
        <Text style={{ color:'#64748b', fontSize:12, marginBottom:16 }} numberOfLines={1}>{user.email}</Text>

        <View style={{ backgroundColor:'#f8fafc', borderRadius:12, padding:12, marginBottom:16, borderWidth:1, borderColor:'#e2e8f0' }}>
          <Text style={{ fontSize:11, fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', marginBottom:4 }}>Current Status</Text>
          <StatusBadge status={user.status} />
          {user.blockedReason ? (
            <Text style={{ color:'#991B1B', fontSize:11, marginTop:4 }}>Reason: {user.blockedReason}</Text>
          ) : null}
        </View>

        <Text style={{ fontSize:11, fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', marginBottom:8 }}>
          Select Action
        </Text>

        {actions.map(a => (
          <TouchableOpacity
            key={a.key}
            style={{ flexDirection:'row', alignItems:'center', padding:14, borderRadius:10, borderWidth:2,
              borderColor: selected===a.key ? a.color : '#e2e8f0',
              backgroundColor: selected===a.key ? a.bg : '#fff', marginBottom:8 }}
            onPress={() => setSelected(a.key)}
          >
            <View style={{ width:20, height:20, borderRadius:10, borderWidth:2,
              borderColor: selected===a.key ? a.color : '#cbd5e1',
              justifyContent:'center', alignItems:'center', marginRight:10 }}>
              {selected===a.key && <View style={{ width:10, height:10, borderRadius:5, backgroundColor:a.color }} />}
            </View>
            <Text style={{ fontWeight:'700', fontSize:13, color: selected===a.key ? a.color : '#1e293b' }}>
              {a.label}
            </Text>
          </TouchableOpacity>
        ))}

        <View style={{ flexDirection:'row', gap:10, marginTop:8 }}>
          <TouchableOpacity style={{ flex:1, padding:14, borderRadius:10, backgroundColor:'#f1f5f9', alignItems:'center' }} onPress={onClose}>
            <Text style={{ fontWeight:'700', color:'#64748b' }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flex:1, padding:14, borderRadius:10,
              backgroundColor: selected ? '#166534' : '#cbd5e1', alignItems:'center' }}
            onPress={() => { if (selected) { onConfirm(user, selected); setSelected(null); onClose(); } }}
            disabled={!selected}
          >
            <Text style={{ fontWeight:'700', color:'#fff' }}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function UserCard({ user, onPress }) {
  return (
    <TouchableOpacity style={[styles.userCard, SHADOW.sm]} onPress={() => onPress(user)} activeOpacity={0.8}>
      <View style={{ flex:1 }}>
        <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
        <Text style={styles.userDate}>
          Joined: {user.createdAt ? formatDate(new Date(parseInt(user.createdAt)).toISOString()) : '—'}
        </Text>
        {user.blockedReason ? (
          <Text style={{ color:COLORS.danger, fontSize:FONT.xs, marginTop:2 }}>
            Reason: {user.blockedReason}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems:'flex-end', gap:SPACING.xs }}>
        <StatusBadge status={user.status} />
        <Text style={{ color:COLORS.slate400, fontSize:10 }}>Tap to manage →</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Listing Form ──────────────────────────────────────────────
const EMPTY_LISTING = {
  enabled:true, title:'', tagline:'', description:'',
  category:'Woodwork', phone:'', whatsapp:'',
  city:'', emoji:'🪵', bgColor:'#166534', order:1,
  expiresAt:'', images:[], website:'',
};

function ListingForm({ initial, onSave, onCancel, dark }) {
  const [form, setForm] = useState(initial || EMPTY_LISTING);
  const set = (k, v) => setForm(p => ({ ...p, [k]:v }));

  return (
    <View style={[styles.formBox, { backgroundColor: dark?COLORS.surfaceDark:COLORS.white }]}>
      <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:SPACING.md }}>
        <Text style={{ color: dark?COLORS.textDark:COLORS.textLight, fontWeight:'700', fontSize:FONT.md }}>
          {initial?.id ? 'Edit Listing' : 'New Listing'}
        </Text>
        <View style={{ flexDirection:'row', alignItems:'center', gap:SPACING.sm }}>
          <Text style={{ color: dark?COLORS.slate400:COLORS.slate500, fontSize:FONT.xs }}>Enabled</Text>
          <Switch value={form.enabled} onValueChange={v=>set('enabled',v)}
            trackColor={{ false:COLORS.slate300, true:COLORS.primary }} thumbColor="#fff" />
        </View>
      </View>

      <View style={{ flexDirection:'row', gap:SPACING.sm }}>
        <AppInput label="Title"   value={form.title}   onChangeText={v=>set('title',v)}   dark={dark} style={{ flex:2 }} />
        <AppInput label="Emoji"   value={form.emoji}   onChangeText={v=>set('emoji',v)}   dark={dark} style={{ flex:1 }} />
      </View>
      <AppInput label="Tagline"   value={form.tagline}  onChangeText={v=>set('tagline',v)}  dark={dark} />
      <View style={{ flexDirection:'row', gap:SPACING.sm }}>
        <AppInput label="Category" value={form.category} onChangeText={v=>set('category',v)} dark={dark} style={{ flex:1 }} />
        <AppInput label="City"     value={form.city}     onChangeText={v=>set('city',v)}     dark={dark} style={{ flex:1 }} />
      </View>
      <View style={{ flexDirection:'row', gap:SPACING.sm }}>
        <AppInput label="Phone"    value={form.phone}    onChangeText={v=>set('phone',v)}    keyboardType="phone-pad" dark={dark} style={{ flex:1 }} />
        <AppInput label="WhatsApp" value={form.whatsapp} onChangeText={v=>set('whatsapp',v)} keyboardType="phone-pad" dark={dark} style={{ flex:1 }} />
      </View>
      <View style={{ flexDirection:'row', gap:SPACING.sm }}>
        <AppInput label="BG Color (#hex)" value={form.bgColor}    onChangeText={v=>set('bgColor',v)}    dark={dark} style={{ flex:1 }} />
        <AppInput label="Order"           value={String(form.order)} onChangeText={v=>set('order',parseInt(v)||1)} keyboardType="numeric" dark={dark} style={{ flex:1 }} />
      </View>
      <AppInput
        label="Expires (YYYY-MM-DD) — leave empty for no expiry"
        value={form.expiresAt}
        onChangeText={v=>set('expiresAt',v)}
        dark={dark}
        placeholder="2025-12-31"
      />
      <AppInput label="Website URL" value={form.website||''} onChangeText={v=>set('website',v)} dark={dark} placeholder="https://example.com" />
      <AppInput label="Description" value={form.description||''} onChangeText={v=>set('description',v)} dark={dark} multiline />

      {/* Images */}
      <Text style={{ color:dark?COLORS.slate400:COLORS.slate500, fontSize:FONT.xs, fontWeight:'700', textTransform:'uppercase', marginTop:SPACING.sm, marginBottom:SPACING.xs }}>
        Images ({(form.images||[]).length}/5)
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:SPACING.sm }}>
        <View style={{ flexDirection:'row', gap:SPACING.sm }}>
          {(form.images||[]).map((img, i) => (
            <View key={i} style={{ position:'relative' }}>
              <Image source={{ uri:img }} style={{ width:80, height:80, borderRadius:RADIUS.md }} />
              <TouchableOpacity
                style={{ position:'absolute', top:-6, right:-6, backgroundColor:'#dc2626', width:20, height:20, borderRadius:10, justifyContent:'center', alignItems:'center' }}
                onPress={() => set('images', (form.images||[]).filter((_,idx)=>idx!==i))}
              >
                <Text style={{ color:'#fff', fontSize:10, fontWeight:'900' }}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          {(form.images||[]).length < 5 && (
            <TouchableOpacity
              style={{ width:80, height:80, borderRadius:RADIUS.md, borderWidth:1.5, borderColor:COLORS.primary, borderStyle:'dashed', justifyContent:'center', alignItems:'center' }}
              onPress={async () => {
                const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (!perm.granted) { Alert.alert('Permission', 'Gallery permission required'); return; }
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  allowsEditing: true, quality: 0.5, base64: true,
                });
                if (!result.canceled && result.assets[0]?.base64) {
                  const uri = `data:image/jpeg;base64,${result.assets[0].base64}`;
                  set('images', [...(form.images||[]), uri]);
                }
              }}
            >
              <Text style={{ color:COLORS.primary, fontSize:28 }}>+</Text>
              <Text style={{ color:COLORS.primary, fontSize:8, fontWeight:'700' }}>Add Image</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <View style={{ flexDirection:'row', gap:SPACING.md, marginTop:SPACING.md }}>
        <AppButton variant="secondary" onPress={onCancel} style={{ flex:1 }}>Cancel</AppButton>
        <AppButton onPress={() => onSave(form)} style={{ flex:1 }}>Save Listing</AppButton>
      </View>
    </View>
  );
}

// ── Ad Banner Form ────────────────────────────────────────────
const EMPTY_AD = {
  enabled:false, title:'', tagline:'', cta:'Contact Us',
  phone:'', whatsapp:'', bgColor:'#166534',
  textColor:'#ffffff', emoji:'🪵', badge:'Ad',
};

function AdBannerForm({ initial, onSave, dark }) {
  const [form, setForm] = useState(initial || EMPTY_AD);
  const set = (k, v) => setForm(p => ({ ...p, [k]:v }));

  return (
    <View style={[styles.formBox, { backgroundColor: dark?COLORS.surfaceDark:COLORS.white }]}>
      <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:SPACING.md }}>
        <Text style={{ color: dark?COLORS.textDark:COLORS.textLight, fontWeight:'700', fontSize:FONT.md }}>
          Ad Banner
        </Text>
        <View style={{ flexDirection:'row', alignItems:'center', gap:SPACING.sm }}>
          <Text style={{ color: dark?COLORS.slate400:COLORS.slate500, fontSize:FONT.xs }}>
            {form.enabled ? 'Live ✓' : 'Off'}
          </Text>
          <Switch value={form.enabled} onValueChange={v=>set('enabled',v)}
            trackColor={{ false:COLORS.slate300, true:COLORS.primary }} thumbColor="#fff" />
        </View>
      </View>

      <View style={{ flexDirection:'row', gap:SPACING.sm }}>
        <AppInput label="Title"  value={form.title}  onChangeText={v=>set('title',v)}  dark={dark} style={{ flex:2 }} />
        <AppInput label="Emoji"  value={form.emoji}  onChangeText={v=>set('emoji',v)}  dark={dark} style={{ flex:1 }} />
      </View>
      <AppInput label="Tagline" value={form.tagline} onChangeText={v=>set('tagline',v)} dark={dark} />
      <AppInput label="CTA Button Text" value={form.cta} onChangeText={v=>set('cta',v)} dark={dark} />
      <View style={{ flexDirection:'row', gap:SPACING.sm }}>
        <AppInput label="Phone"    value={form.phone}    onChangeText={v=>set('phone',v)}    keyboardType="phone-pad" dark={dark} style={{ flex:1 }} />
        <AppInput label="WhatsApp" value={form.whatsapp} onChangeText={v=>set('whatsapp',v)} keyboardType="phone-pad" dark={dark} style={{ flex:1 }} />
      </View>
      <View style={{ flexDirection:'row', gap:SPACING.sm }}>
        <AppInput label="BG Color"   value={form.bgColor}   onChangeText={v=>set('bgColor',v)}   dark={dark} style={{ flex:1 }} />
        <AppInput label="Text Color" value={form.textColor} onChangeText={v=>set('textColor',v)} dark={dark} style={{ flex:1 }} />
      </View>
      <View style={{ flexDirection:'row', gap:SPACING.sm }}>
        <AppInput label="Badge Text" value={form.badge} onChangeText={v=>set('badge',v)} dark={dark} style={{ flex:1 }} />
      </View>

      <AppButton onPress={() => onSave(form)} style={{ marginTop:SPACING.md }}>
        Save Banner
      </AppButton>
    </View>
  );
}

// ══════════════════════════════════════════
// MAIN ADMIN PANEL
// ══════════════════════════════════════════
export default function AdminPanelScreen() {
  const navigation = useNavigation();
  const { settings } = useApp();
  const dark = settings.mode === 'dark';
  const bg   = dark ? COLORS.bgDark : '#f8fafc';
  const card = dark ? COLORS.surfaceDark : COLORS.white;
  const text = dark ? COLORS.textDark : COLORS.textLight;
  const sub  = dark ? COLORS.slate400 : COLORS.slate500;
  const brd  = dark ? COLORS.borderDark : COLORS.borderLight;

  const [tab,        setTab]        = useState('users');
  const [userFilter, setUserFilter] = useState('all');
  const [regEnabled, setRegEnabled] = useState(true);

  // Users
  const [users,    setUsers]    = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [selectedUser,    setSelectedUser]    = useState(null);
  const [notifications,   setNotifications]   = useState([]);
  const [notifLoading,    setNotifLoading]    = useState(true);
  const [broadcastMsg,    setBroadcastMsg]    = useState('');
  const [directMsg,       setDirectMsg]       = useState('');
  const [directEmail,     setDirectEmail]     = useState('');
  const [sendingMsg,      setSendingMsg]      = useState(false);

  // Marketplace
  const [listings,       setListings]       = useState([]);
  const [listingsLoading,setListingsLoading] = useState(true);
  const [editingListing, setEditingListing]  = useState(null); // null=none, 'new', or listing object
  const [listingsFilter, setListingsFilter]  = useState('all'); // 'all'|'active'|'expired'

  // Ad Banner
  const [adData,    setAdData]    = useState(null);
  const [adLoading, setAdLoading] = useState(true);

  // ── Load appConfig (registration toggle) ─────────────────
  useEffect(() => {
    getDoc(doc(db, 'appConfig', 'settings'))
      .then(snap => {
        if (snap.exists()) {
          setRegEnabled(snap.data().registrationEnabled !== false);
        }
      }).catch(() => {});
  }, []);

  // ── Load Users — manual fetch, no auto-refresh ──────────────
  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const snap = await getDocs(collection(db, 'userStatus'));
      const list = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      list.sort((a,b) => parseInt(b.createdAt||0) - parseInt(a.createdAt||0));
      setUsers(list);
    } catch(err) {
      console.log('users fetch:', err.message);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  // ── Load Admin Notifications ──────────────────────────────
  useEffect(() => {
    if (tab !== 'notifications') return;
    setNotifLoading(true);
    const unsub = onSnapshot(
      collection(db, 'adminNotifications'),
      (snap) => {
        const list = snap.docs.map(d => ({ id:d.id, ...d.data() }));
        list.sort((a,b) => parseInt(b.createdAt||'0') - parseInt(a.createdAt||'0'));
        setNotifications(list);
        setNotifLoading(false);
      },
      () => setNotifLoading(false)
    );
    return unsub;
  }, [tab]);

  // ── Load Marketplace ───────────────────────────────────────
  useEffect(() => {
    if (tab !== 'marketplace') return;
    const unsub = onSnapshot(
      collection(db, 'marketplace'),
      (snap) => {
        const list = snap.docs.map(d => ({ id:d.id, ...d.data() }));
        list.sort((a,b) => (a.order||0) - (b.order||0));
        setListings(list);
        setListingsLoading(false);
      },
      (err) => { console.log('listings:', err.message); setListingsLoading(false); }
    );
    return unsub;
  }, [tab]);

  // ── Load Ad Banner ─────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'banner') return;
    const unsub = onSnapshot(
      doc(db, 'ads', 'active'),
      (snap) => {
        setAdData(snap.exists() ? snap.data() : EMPTY_AD);
        setAdLoading(false);
      },
      (err) => { console.log('ad:', err.message); setAdLoading(false); }
    );
    return unsub;
  }, [tab]);

  // ── Registration toggle ────────────────────────────────────
  const handleRegToggle = async (val) => {
    setRegEnabled(val);
    await setDoc(doc(db, 'appConfig', 'settings'), { registrationEnabled: val }, { merge:true });
  };

  // ── User actions ───────────────────────────────────────────
  const handleUserAction = async (u, action) => {
    const statusRef = doc(db, 'userStatus', u.uid || u.id);

    if (action === 'block') {
      Alert.alert('Block User', `Block ${u.email}?`, [
        { text:'Cancel', style:'cancel' },
        { text:'Block', style:'destructive', onPress: async () => {
          await updateDoc(statusRef, { status:'blocked', blockedAt:String(Date.now()) });
        }},
      ]);
      return;
    }
    if (action === 'approve') {
      await updateDoc(statusRef, { status:'approved', approvedAt:String(Date.now()) });
      Alert.alert('Done', `${u.email} approved ✅`);
      return;
    }
    if (action === 'firebase') {
      // planExpiry prompt
      Alert.alert(
        'Firebase Access',
        `${u.email}\nPlan expiry date (YYYY-MM-DD)\nLeave empty for no expiry`,
        [
          { text:'Cancel', style:'cancel' },
          {
            text:'Upgrade',
            onPress: async () => {
              // default: آج سے 30 دن
              const expiry = new Date();
              expiry.setDate(expiry.getDate() + 30);
              const defaultExpiry = expiry.toISOString().split('T')[0];
              await updateDoc(statusRef, {
                status:     'firebase',
                firebaseAt: String(Date.now()),
                planExpiry: defaultExpiry,
              });
              Alert.alert('Done', `Firebase access (30 days)\nExpiry: ${defaultExpiry} ✅`);
            },
          },
        ]
      );
      return;
    }
    if (action === 'unblock') {
      await updateDoc(statusRef, { status:'approved', unblockedAt:String(Date.now()), blockedReason:'' });
      Alert.alert('Done', `${u.email} unblocked ✅`);
      return;
    }
    if (action === 'approved') {
      await updateDoc(statusRef, { status:'approved' });
      return;
    }
  };

  // ── Send message to single user ────────────────────────────
  const handleSendDirect = async () => {
    if (!directEmail.trim() || !directMsg.trim()) {
      Alert.alert('Required', 'Email and message required');
      return;
    }
    setSendingMsg(true);
    try {
      const targetUser = users.find(u => u.email === directEmail.trim().toLowerCase());
      const uid = targetUser?.uid || directEmail.replace(/[.#$[\]]/g,'_');
      await setDoc(doc(db, 'userMessages', String(Date.now())), {
        toEmail:   directEmail.trim().toLowerCase(),
        toUid:     uid,
        message:   directMsg.trim(),
        from:      'Admin (No Reply)',
        sentAt:    String(Date.now()),
        read:      false,
        type:      'direct',
      });
      setDirectMsg(''); setDirectEmail('');
      Alert.alert('Sent ✅', 'Message delivered to user');
    } catch(e) {
      Alert.alert('Error', e.message);
    }
    setSendingMsg(false);
  };

  // ── Broadcast to all users ──────────────────────────────────
  const handleBroadcast = async () => {
    if (!broadcastMsg.trim()) { Alert.alert('Required', 'Message required'); return; }
    Alert.alert('Confirm Broadcast', `Send to ALL ${users.length} users?`, [
      { text:'Cancel', style:'cancel' },
      { text:'Send All', style:'destructive', onPress: async () => {
        setSendingMsg(true);
        try {
          const ts = String(Date.now());
          await setDoc(doc(db, 'broadcasts', ts), {
            message:  broadcastMsg.trim(),
            from:     'Admin (No Reply)',
            sentAt:   ts,
            read:     false,
            type:     'broadcast',
          });
          setBroadcastMsg('');
          Alert.alert('Sent ✅', `Broadcast saved — all users will see it on next login`);
        } catch(e) { Alert.alert('Error', e.message); }
        setSendingMsg(false);
      }},
    ]);
  };

  // ── Listing actions ────────────────────────────────────────
  const handleSaveListing = async (form) => {
    try {
      const data = {
        enabled:     form.enabled,
        title:       form.title       || '',
        tagline:     form.tagline     || '',
        description: form.description || '',
        category:    form.category    || '',
        phone:       form.phone       || '',
        whatsapp:    form.whatsapp    || '',
        city:        form.city        || '',
        emoji:       form.emoji       || '🪵',
        bgColor:     form.bgColor     || '#166534',
        order:       parseInt(form.order) || 1,
        expiresAt:   form.expiresAt   || '',
        website:     form.website     || '',
        images:      form.images      || [],
        updatedAt:   String(Date.now()),
      };
      if (form.id) {
        await setDoc(doc(db, 'marketplace', form.id), data);
      } else {
        data.createdAt = String(Date.now());
        await addDoc(collection(db, 'marketplace'), data);
      }
      setEditingListing(null);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const handleDeleteListing = (listing) => {
    Alert.alert('Delete', `Delete "${listing.title}"?`, [
      { text:'Cancel', style:'cancel' },
      { text:'Delete', style:'destructive', onPress: async () => {
        await deleteDoc(doc(db, 'marketplace', listing.id));
      }},
    ]);
  };

  const handleToggleListing = async (listing) => {
    await updateDoc(doc(db, 'marketplace', listing.id), { enabled: !listing.enabled });
  };

  // ── Banner save ────────────────────────────────────────────
  const handleSaveBanner = async (form) => {
    try {
      await setDoc(doc(db, 'ads', 'active'), {
        enabled:    form.enabled,
        title:      form.title      || '',
        tagline:    form.tagline    || '',
        cta:        form.cta        || 'رابطہ کریں',
        phone:      form.phone      || '',
        whatsapp:   form.whatsapp   || '',
        bgColor:    form.bgColor    || '#166534',
        textColor:  form.textColor  || '#ffffff',
        emoji:      form.emoji      || '🪵',
        badge:      form.badge      || 'اشتہار',
        updatedAt:  String(Date.now()),
      });
      Alert.alert('Done', 'Banner updated ✅');
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  // ── Listings filter ────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];
  const filteredListings = listings.filter(l => {
    if (listingsFilter === 'active')  return l.enabled && (!l.expiresAt || l.expiresAt >= today);
    if (listingsFilter === 'expired') return l.expiresAt && l.expiresAt < today;
    return true;
  });

  // ── Users filter ──────────────────────────────────────────
  const filteredUsers = userFilter === 'all'
    ? users
    : users.filter(u => u.status === userFilter);

  const TABS = [
    { id:'users',         label:'👥 Users'      },
    { id:'notifications', label:'🔔 Notify'     },
    { id:'marketplace',   label:'📋 Listings'   },
    { id:'banner',        label:'📢 Banner'     },
    { id:'stats',         label:'📊 Stats'      },
  ];

  return (
    <View style={[styles.root, { backgroundColor:bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor:'#0f172a' }]}>
        <Text style={{ color:'#fff', fontWeight:'800', fontSize:FONT.lg }}>
          🛡️ Admin Panel
        </Text>
        <View style={{ width:60 }} />
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor:card, borderBottomColor:brd }]}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tabItem, tab===t.id && styles.tabItemActive]}
            onPress={() => setTab(t.id)}
          >
            <Text style={[styles.tabLabel, { color: tab===t.id ? COLORS.primary : sub }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding:SPACING.md, paddingBottom:80 }} keyboardShouldPersistTaps="handled">

        {/* ──────────────── USERS ─────────────────────── */}
        {tab === 'users' && (
          <>
            {/* Refresh Button */}
            <TouchableOpacity
              style={{ flexDirection:'row', alignItems:'center', justifyContent:'flex-end', marginBottom:SPACING.md, gap:SPACING.xs }}
              onPress={fetchUsers}
            >
              <Text style={{ color:COLORS.primary, fontSize:FONT.xs, fontWeight:'700' }}>
                🔄 Refresh Users
              </Text>
            </TouchableOpacity>

            {/* Registration Toggle */}
            <View style={[styles.userCard, { backgroundColor: regEnabled?'#F0FDF4':'#FEF2F2', marginBottom:SPACING.md }]}>
              <View style={{ flex:1 }}>
                <Text style={{ fontWeight:'700', color: regEnabled?'#166534':'#DC2626', fontSize:FONT.base }}>
                  {regEnabled ? '✅ Registration Open' : '🚫 Registration Closed'}
                </Text>
                <Text style={{ color:'#64748B', fontSize:FONT.xs, marginTop:2 }}>
                  {regEnabled ? 'New users can register' : 'Registration closed — login only'}
                </Text>
              </View>
              <Switch
                value={regEnabled}
                onValueChange={handleRegToggle}
                trackColor={{ false:'#FCA5A5', true:'#86EFAC' }}
                thumbColor={regEnabled ? '#166534' : '#DC2626'}
              />
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
              {['all','pending','approved','firebase','blocked'].map(s => {
                const count = s === 'all' ? users.length : users.filter(u=>u.status===s).length;
                const sc    = s === 'all' ? {bg:'#f1f5f9',fg:'#334155'} : (STATUS_COLOR[s] || STATUS_COLOR.pending);
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.statChip, { backgroundColor: userFilter===s ? sc.fg : sc.bg }]}
                    onPress={() => setUserFilter(s)}
                  >
                    <Text style={{ color: userFilter===s ? '#fff' : sc.fg, fontWeight:'800', fontSize:FONT.lg }}>
                      {count}
                    </Text>
                    <Text style={{ color: userFilter===s ? 'rgba(255,255,255,0.8)' : sc.fg, fontSize:9, fontWeight:'700', textTransform:'uppercase' }}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {usersLoading ? (
              <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop:40 }} />
            ) : filteredUsers.length === 0 ? (
              <View style={{ alignItems:'center', marginTop:60 }}>
                <Text style={{ fontSize:48 }}>👥</Text>
                <Text style={{ color:sub, marginTop:SPACING.md }}>No {userFilter} users</Text>
              </View>
            ) : filteredUsers.map(u => (
              <UserCard key={u.id} user={u} onPress={(u) => setSelectedUser(u)} />
            ))}
          </>
        )}

        {/* ──────────────── NOTIFICATIONS ──────────────── */}
        {tab === 'notifications' && (
          <>
            {/* New Registrations */}
            <Text style={[styles.sectionLabel, { color:sub }]}>NEW REGISTRATIONS</Text>
            {notifLoading ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginTop:20 }} />
            ) : notifications.length === 0 ? (
              <View style={{ alignItems:'center', marginVertical:30 }}>
                <Text style={{ fontSize:32 }}>🔔</Text>
                <Text style={{ color:sub, marginTop:10 }}>No new notifications</Text>
              </View>
            ) : notifications.slice(0,10).map(n => (
              <View key={n.id} style={[styles.notifCard, { backgroundColor:n.read?card:'#f0fdf4', borderColor:n.read?brd:'#22c55e' }]}>
                <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <View style={{ flex:1 }}>
                    <Text style={{ fontSize:12 }}>👤 New Registration</Text>
                    <Text style={{ color:text, fontWeight:'700', fontSize:FONT.base, marginTop:2 }}>{n.email}</Text>
                    <Text style={{ color:sub, fontSize:FONT.xs, marginTop:2 }}>
                      {n.createdAt ? new Date(parseInt(n.createdAt)).toLocaleString() : '—'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={{ backgroundColor:COLORS.primary, paddingHorizontal:10, paddingVertical:6, borderRadius:8 }}
                    onPress={async () => {
                      await updateDoc(doc(db,'adminNotifications',n.id),{ read:true });
                    }}
                  >
                    <Text style={{ color:'#fff', fontSize:FONT.xs, fontWeight:'700' }}>
                      {n.read ? '✓ Read' : 'Mark Read'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {/* Direct Message */}
            <Text style={[styles.sectionLabel, { color:sub, marginTop:SPACING.xl }]}>SEND DIRECT MESSAGE</Text>
            <View style={[styles.settingCard, { backgroundColor:card }]}>
              <Text style={{ color:sub, fontSize:FONT.xs, marginBottom:6 }}>User Email</Text>
              <AppInput
                label="Recipient Email"
                value={directEmail}
                onChangeText={setDirectEmail}
                dark={dark}
              />
              <Text style={{ color:sub, fontSize:FONT.xs, marginBottom:6, marginTop:SPACING.sm }}>Message</Text>
              <TextInput
                value={directMsg}
                onChangeText={setDirectMsg}
                placeholder="Your message to user..."
                placeholderTextColor={sub}
                multiline
                numberOfLines={3}
                style={{ borderWidth:1, borderColor:brd, borderRadius:10, padding:12, color:text,
                  backgroundColor:dark?COLORS.bgDark:'#f8fafc', textAlignVertical:'top', minHeight:80, fontSize:FONT.sm }}
              />
              <TouchableOpacity
                style={{ backgroundColor: sendingMsg ? COLORS.slate400 : COLORS.primary,
                  padding:14, borderRadius:12, alignItems:'center', marginTop:12 }}
                onPress={handleSendDirect}
                disabled={sendingMsg}
              >
                <Text style={{ color:'#fff', fontWeight:'700' }}>
                  {sendingMsg ? 'Sending...' : '📤 Send Message (No Reply)'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Broadcast */}
            <Text style={[styles.sectionLabel, { color:sub, marginTop:SPACING.xl }]}>BROADCAST TO ALL USERS</Text>
            <View style={[styles.settingCard, { backgroundColor:card }]}>
              <Text style={{ color:sub, fontSize:FONT.xs, marginBottom:6 }}>
                یہ پیغام تمام یوزرز کو اگلی بار login پر نظر آئے گا
              </Text>
              <TextInput
                value={broadcastMsg}
                onChangeText={setBroadcastMsg}
                placeholder="Broadcast message for all users..."
                placeholderTextColor={sub}
                multiline
                numberOfLines={3}
                style={{ borderWidth:1, borderColor:'#fbbf24', borderRadius:10, padding:12, color:text,
                  backgroundColor:dark?'#1c1400':'#fffbeb', textAlignVertical:'top', minHeight:80, fontSize:FONT.sm }}
              />
              <TouchableOpacity
                style={{ backgroundColor: sendingMsg ? COLORS.slate400 : '#d97706',
                  padding:14, borderRadius:12, alignItems:'center', marginTop:12 }}
                onPress={handleBroadcast}
                disabled={sendingMsg}
              >
                <Text style={{ color:'#fff', fontWeight:'700' }}>
                  {sendingMsg ? 'Sending...' : '📢 Send to ALL Users'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ──────────────── MARKETPLACE ───────────────── */}
        {tab === 'marketplace' && (
          <>
            {/* Add button */}
            {!editingListing && (
              <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:SPACING.md }}>
                <View style={{ flexDirection:'row', gap:SPACING.xs }}>
                  {['all','active','expired'].map(f => (
                    <TouchableOpacity
                      key={f}
                      style={[styles.filterChip, listingsFilter===f && styles.filterChipActive]}
                      onPress={() => setListingsFilter(f)}
                    >
                      <Text style={{ color: listingsFilter===f ? '#fff' : sub, fontSize:FONT.xs, fontWeight:'700' }}>
                        {f.charAt(0).toUpperCase()+f.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.addListingBtn}
                  onPress={() => setEditingListing('new')}
                >
                  <Text style={{ color:'#fff', fontWeight:'700', fontSize:FONT.sm }}>+ New</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* New/Edit form */}
            {editingListing && (
              <ListingForm
                initial={editingListing === 'new' ? null : editingListing}
                onSave={handleSaveListing}
                onCancel={() => setEditingListing(null)}
                dark={dark}
              />
            )}

            {/* Listings */}
            {!editingListing && (
              listingsLoading ? (
                <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop:40 }} />
              ) : filteredListings.length === 0 ? (
                <View style={{ alignItems:'center', marginTop:60 }}>
                  <Text style={{ fontSize:48 }}>📋</Text>
                  <Text style={{ color:sub, marginTop:SPACING.md }}>No listings</Text>
                </View>
              ) : filteredListings.map(listing => {
                const isExpired = listing.expiresAt && listing.expiresAt < today;
                return (
                  <View key={listing.id} style={[styles.listingCard, { backgroundColor:card, borderColor:isExpired?COLORS.danger:brd }]}>
                    <View style={{ flexDirection:'row', alignItems:'flex-start' }}>
                      <View style={[styles.listingEmoji, { backgroundColor: listing.bgColor||'#166534' }]}>
                        <Text style={{ fontSize:22 }}>{listing.emoji||'🪵'}</Text>
                      </View>
                      <View style={{ flex:1, marginLeft:SPACING.md }}>
                        <View style={{ flexDirection:'row', alignItems:'center', gap:SPACING.sm }}>
                          <Text style={{ color:text, fontWeight:'700', fontSize:FONT.base }}>{listing.title||'—'}</Text>
                          {isExpired && (
                            <View style={[styles.badge, { backgroundColor:'#FEF2F2' }]}>
                              <Text style={{ color:COLORS.danger, fontSize:FONT.xs, fontWeight:'700' }}>Expired</Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ color:sub, fontSize:FONT.xs }}>{listing.tagline||''}</Text>
                        <Text style={{ color:sub, fontSize:FONT.xs, marginTop:2 }}>
                          {listing.city||''} • {listing.category||''} • Order: {listing.order||1}
                        </Text>
                        {listing.expiresAt && (
                          <Text style={{ color: isExpired?COLORS.danger:COLORS.warning, fontSize:FONT.xs, marginTop:2, fontWeight:'700' }}>
                            Expires: {listing.expiresAt}
                          </Text>
                        )}
                      </View>
                      {/* enabled toggle */}
                      <Switch
                        value={!!listing.enabled}
                        onValueChange={() => handleToggleListing(listing)}
                        trackColor={{ false:COLORS.slate300, true:COLORS.primary }}
                        thumbColor="#fff"
                      />
                    </View>
                    {/* Actions */}
                    <View style={[styles.listingActions, { borderTopColor:brd }]}>
                      <TouchableOpacity
                        style={[styles.actBtn, { backgroundColor:'#EFF6FF' }]}
                        onPress={() => setEditingListing(listing)}
                      >
                        <Text style={{ color:COLORS.info, fontWeight:'700', fontSize:FONT.xs }}>✏️ Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actBtn, { backgroundColor:'#FEF2F2' }]}
                        onPress={() => handleDeleteListing(listing)}
                      >
                        <Text style={{ color:COLORS.danger, fontWeight:'700', fontSize:FONT.xs }}>🗑️ Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}

        {/* ──────────────── AD BANNER ─────────────────── */}
        {tab === 'banner' && (
          adLoading ? (
            <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop:40 }} />
          ) : (
            <AdBannerForm initial={adData} onSave={handleSaveBanner} dark={dark} />
          )
        )}

        {/* ──────────────── STATS ─────────────────────── */}
        {tab === 'stats' && (() => {
          const today = new Date().toISOString().split('T')[0];
          const total     = users.length;
          const pending   = users.filter(u=>u.status==='pending').length;
          const approved  = users.filter(u=>u.status==='approved').length;
          const firebase  = users.filter(u=>u.status==='firebase').length;
          const blocked   = users.filter(u=>u.status==='blocked').length;
          const expiring  = users.filter(u=>{
            if (u.status!=='firebase'||!u.planExpiry) return false;
            const d = new Date(u.planExpiry);
            const diff = Math.ceil((d-new Date(today))/86400000);
            return diff>=0 && diff<=7;
          });
          const expired = users.filter(u=>u.status==='firebase'&&u.planExpiry&&u.planExpiry<today);

          const StatBox = ({label,value,bg,fg}) => (
            <View style={[styles.statBox,{backgroundColor:bg}]}>
              <Text style={{color:fg,fontWeight:'900',fontSize:32}}>{value}</Text>
              <Text style={{color:fg,fontSize:FONT.xs,fontWeight:'700',opacity:0.8,marginTop:2}}>{label}</Text>
            </View>
          );

          return (
            <View>
              <Text style={[styles.statSectionLabel,{color:sub}]}>USER SUMMARY</Text>
              <View style={styles.statGrid}>
                <StatBox label="Total"    value={total}    bg="#F1F5F9" fg="#334155" />
                <StatBox label="Pending"  value={pending}  bg="#FFF7ED" fg="#92400E" />
                <StatBox label="Approved" value={approved} bg="#F0FDF4" fg="#166534" />
                <StatBox label="Firebase" value={firebase} bg="#EFF6FF" fg="#1E40AF" />
                <StatBox label="Blocked"  value={blocked}  bg="#FEF2F2" fg="#991B1B" />
              </View>

              {expiring.length > 0 && (
                <View>
                  <Text style={[styles.statSectionLabel,{color:sub,marginTop:SPACING.md}]}>
                    ⚠️ EXPIRING SOON ({expiring.length})
                  </Text>
                  {expiring.map(u=>{
                    const diff=Math.ceil((new Date(u.planExpiry)-new Date(today))/86400000);
                    return (
                      <View key={u.id||u.uid} style={[styles.userCard,{backgroundColor:'#FFF7ED',borderLeftWidth:3,borderLeftColor:'#D97706'}]}>
                        <View style={{flex:1}}>
                          <Text style={{fontWeight:'700',fontSize:FONT.sm,color:'#92400E'}}>{u.email}</Text>
                          <Text style={{color:'#B45309',fontSize:FONT.xs}}>
                            Expires: {u.planExpiry} ({diff===0?'Today':`${diff} days`})
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {expired.length > 0 && (
                <View>
                  <Text style={[styles.statSectionLabel,{color:sub,marginTop:SPACING.md}]}>
                    🔴 EXPIRED ({expired.length})
                  </Text>
                  {expired.map(u=>(
                    <View key={u.id||u.uid} style={[styles.userCard,{backgroundColor:'#FEF2F2',borderLeftWidth:3,borderLeftColor:'#DC2626'}]}>
                      <View style={{flex:1}}>
                        <Text style={{fontWeight:'700',fontSize:FONT.sm,color:'#991B1B'}}>{u.email}</Text>
                        <Text style={{color:'#B91C1C',fontSize:FONT.xs}}>Expired: {u.planExpiry}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {expiring.length===0 && expired.length===0 && (
                <View style={{alignItems:'center',marginTop:40}}>
                  <Text style={{fontSize:48}}>✅</Text>
                  <Text style={{color:sub,marginTop:SPACING.md}}>سب plans ٹھیک ہیں</Text>
                </View>
              )}
            </View>
          );
        })()}

      </ScrollView>

    <UserActionModal
      user={selectedUser}
      visible={!!selectedUser}
      onClose={() => setSelectedUser(null)}
      onConfirm={handleUserAction}
    />
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex:1 },
  header:       { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:SPACING.lg },
  tabBar:       { flexDirection:'row', borderBottomWidth:1 },
  tabItem:      { flex:1, paddingVertical:SPACING.md, alignItems:'center' },
  tabItemActive:{ borderBottomWidth:2, borderBottomColor:COLORS.primary },
  tabLabel:     { fontSize:FONT.xs, fontWeight:'700' },
  // Users
  statsRow:     { flexDirection:'row', gap:SPACING.xs, marginBottom:SPACING.md, flexWrap:'wrap' },
  statChip:     { flex:1, minWidth:56, borderRadius:RADIUS.lg, padding:SPACING.sm, alignItems:'center' },
  userCard:     { backgroundColor:'#fff', borderRadius:RADIUS.xl, padding:SPACING.md, marginBottom:SPACING.sm, flexDirection:'row', alignItems:'flex-start' },
  userEmail:    { fontWeight:'700', fontSize:FONT.sm, color:'#1e293b', marginBottom:2 },
  userDate:     { fontSize:FONT.xs, color:'#64748b' },
  badge:        { paddingHorizontal:SPACING.sm, paddingVertical:3, borderRadius:RADIUS.sm },
  actBtn:       { paddingHorizontal:SPACING.sm, paddingVertical:SPACING.xs, borderRadius:RADIUS.md },
  // Marketplace
  notifCard:      { borderRadius:RADIUS.lg, padding:SPACING.md, marginBottom:SPACING.sm, borderWidth:1.5, ...SHADOW.sm },
  filterChip:     { paddingHorizontal:SPACING.md, paddingVertical:6, borderRadius:RADIUS.full, backgroundColor:COLORS.slate200 },
  filterChipActive:{ backgroundColor:COLORS.slate800 },
  addListingBtn:  { backgroundColor:COLORS.primary, paddingVertical:SPACING.sm, paddingHorizontal:SPACING.md, borderRadius:RADIUS.full },
  listingCard:    { borderRadius:RADIUS.xl, padding:SPACING.md, marginBottom:SPACING.sm, borderWidth:1 },
  listingEmoji:   { width:48, height:48, borderRadius:RADIUS.lg, justifyContent:'center', alignItems:'center' },
  listingActions:    { flexDirection:'row', gap:SPACING.sm, marginTop:SPACING.sm, paddingTop:SPACING.sm, borderTopWidth:1 },
  // Form
  formBox:           { borderRadius:RADIUS.xl, padding:SPACING.md, marginBottom:SPACING.md, ...SHADOW.sm },
  // Stats
  statSectionLabel:  { fontSize:FONT.xs, fontWeight:'700', textTransform:'uppercase', color:'#64748B', marginBottom:SPACING.sm },
  statGrid:          { flexDirection:'row', flexWrap:'wrap', gap:SPACING.sm, marginBottom:SPACING.sm },
  statBox:           { flex:1, minWidth:80, borderRadius:RADIUS.xl, padding:SPACING.md, alignItems:'center', justifyContent:'center' },
});
