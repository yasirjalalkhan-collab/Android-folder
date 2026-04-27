import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Switch, StyleSheet, Share, TextInput, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import AppButton from '../components/ui/AppButton';
import AppInput  from '../components/ui/AppInput';
import { ScalePress, ExpandCollapse } from '../components/ui/Animated';
import { COLORS, SPACING, RADIUS, FONT, SHADOW } from '../utils/theme';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const {
    settings, setSettings, profile, setProfile,
    logout, user, showAlert, showConfirm, showPrompt, isGuest,
    handleBackup, handleRestore, handleFactoryReset,
    userPlan, planExpiry, isFirebaseMode, isMigrating,
    migrateToFirebase,
  } = useApp();
  const dark = settings.mode === 'dark';
  const bg   = dark ? COLORS.bgDark     : '#F1F5F9';
  const card = dark ? COLORS.surfaceDark : COLORS.white;
  const text = dark ? COLORS.textDark   : COLORS.textLight;
  const sub  = dark ? COLORS.slate400   : COLORS.slate500;
  const brd  = dark ? COLORS.borderDark : COLORS.borderLight;

  const [showSecurity,      setShowSecurity]      = useState(false);
  const [pinInput,          setPinInput]          = useState('');      // نیا PIN
  const [oldPinInput,       setOldPinInput]       = useState('');      // پرانا PIN verify
  const [migrationProgress, setMigrationProgress] = useState(null);

  const updateSetting = (key, val) => setSettings({ ...settings, [key]: val });

  // ── Forgot PIN — secret question سے verify ────────────────
  const handleForgotPin = async () => {
    // دو آپشن: Secret Question یا Admin Reset
    const ok = await showConfirm(
      'PIN بھول گئے؟\n\nاگر آپ نے registration کے وقت Secret Question سیٹ کی تھی تو OK دبائیں — ورنہ Cancel کریں اور ایڈمن سے رابطہ کریں۔',
      'PIN Reset'
    );
    if (!ok) return;

    if (!user?.email && !isGuest) {
      // Guest mode — directly allow reset (no account protection)
      const confirm2 = await showConfirm('Guest mode میں PIN reset ہو جائے گا۔ جاری رکھیں؟', 'Confirm');
      if (!confirm2) return;
      setOldPinInput('');
      setPinInput('');
      await setSettings({ ...settings, securityPin: '', loginLock: false });
      Alert.alert('PIN Reset ✅', 'PIN ہٹا دیا گیا۔ نیا PIN سیٹ کریں۔');
      return;
    }

    try {
      const snap = await getDoc(doc(db, 'userStatus', user.uid));
      if (!snap.exists() || !snap.data().secretQuestion) {
        // Secret question نہیں — Admin سے reset
        Alert.alert(
          'Secret Question نہیں ملی',
          'آپ کی Secret Question نہیں ملی۔\n\nادمن سے رابطہ کریں:\nAdmin Panel → Users → آپ کا account → Reset PIN\n\nیا account سے logout کر کے دوبارہ login کریں — PIN خودبخود reset ہو جائے گا (اگر Firebase plan ہے)۔',
          [{ text: 'OK' }]
        );
        return;
      }

      const q            = snap.data().secretQuestion;
      const storedAnswer = (snap.data().secretAnswer || '').trim().toLowerCase();
      const answer       = await showPrompt(q, '', 'Security Question');
      if (answer === null) return;
      if (!answer.trim()) { Alert.alert('ضروری', 'جواب لکھیں'); return; }

      if (answer.trim().toLowerCase() !== storedAnswer) {
        Alert.alert('غلط جواب', 'Secret answer غلط ہے۔ دوبارہ کوشش کریں یا ادمن سے رابطہ کریں۔');
        return;
      }

      setOldPinInput('');
      setPinInput('');
      await setSettings({ ...settings, securityPin: '', loginLock: false });
      Alert.alert('PIN Reset ✅', 'PIN ہٹا دیا گیا۔ نیا PIN سیٹ کریں۔');
    } catch (e) {
      Alert.alert('Error', e.message || 'Internet connection چیک کریں۔');
    }
  };

  const handleSavePin = async () => {
    // پرانا PIN ہے تو verify کریں
    if (settings.securityPin) {
      if (!oldPinInput) {
        Alert.alert('Required', 'Please enter your current PIN first');
        return;
      }
      if (oldPinInput !== settings.securityPin) {
        Alert.alert('Wrong PIN', 'Current PIN is incorrect');
        setOldPinInput('');
        return;
      }
    }

    // نیا PIN validation
    if (pinInput && !/^\d{4,}$/.test(pinInput)) {
      Alert.alert('Invalid PIN', 'PIN must be at least 4 digits (numbers only)');
      return;
    }

    // Save
    setSettings({ ...settings, securityPin: pinInput });
    setOldPinInput('');
    setPinInput('');
    Alert.alert('Success', pinInput ? 'PIN updated ✅' : 'PIN removed ✅');
  };

  const handleLogout = async () => {
    const ok = await showConfirm('Are you sure you want to logout?', 'Logout');
    if (ok) { await logout(); }
  };

  const doBackup = async () => {
    const json = handleBackup();
    const date = new Date().toISOString().split('T')[0];
    await Share.share({ message: json, title: `timber360-backup-${date}.json` });
  };

  const doRestore = async () => {
    const ok = await showConfirm('Replace current data with backup?', 'Restore Data');
    if (!ok) return;
    try {
      const DocumentPicker = require('expo-document-picker');
      const res = await DocumentPicker.getDocumentAsync({ type:'application/json', copyToCacheDirectory:true });
      if (res.canceled || !res.assets?.[0]) return;
      const content = await (await fetch(res.assets[0].uri)).text();
      const result  = await handleRestore(content);
      await showAlert(result ? '✅ Data restored' : '❌ Invalid file', 'Result');
    } catch (e) {
      await showAlert('Install expo-document-picker for restore', 'Required');
    }
  };

  const doFactoryReset = async () => {
    if (settings.securityPin) {
      const pin = await showPrompt('Enter Master PIN:', '', 'Factory Reset');
      if (pin === null) return;
      if (pin !== settings.securityPin) { await showAlert('Wrong PIN! Cancelled.', 'Error'); return; }
    }
    const ok = await showConfirm('⚠️ Danger! ALL data will be permanently deleted. Are you sure?', 'Factory Reset');
    if (!ok) return;
    await handleFactoryReset();
    await showAlert('System completely reset ✅', 'Done');
  };

  const pickLogo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { await showAlert('Gallery permission required', 'Permission'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing:true, aspect:[1,1], quality:0.7, base64:true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      const logo = `data:image/jpeg;base64,${result.assets[0].base64}`;
      await setProfile({ ...profile, logo });
      await showAlert('Logo updated ✅', 'Success');
    }
  };

  const Section = ({ title, children, delay=0 }) => (
    <View style={{ marginBottom:SPACING.md }}>
        <Text style={[styles.sectionLabel, { color:sub }]}>{title}</Text>
        <View style={[styles.sectionBox, { backgroundColor:card }]}>{children}</View>
      </View>
  );

  const Row = ({ label, rowSub, icon, right, onPress, border=true }) => (
    <TouchableOpacity
      style={[styles.row, border && styles.rowBorder, { borderColor:brd }]}
      onPress={onPress} activeOpacity={onPress?0.7:1} disabled={!onPress}
    >
      {icon ? <Text style={styles.rowIcon}>{icon}</Text> : null}
      <View style={{ flex:1 }}>
        <Text style={[styles.rowLabel, { color:text }]}>{label}</Text>
        {rowSub ? <Text style={[styles.rowSub, { color:sub }]}>{rowSub}</Text> : null}
      </View>
      {right}
    </TouchableOpacity>
  );

  return (
    <ScrollView style={[styles.root,{backgroundColor:bg}]} contentContainerStyle={styles.content}>

      {/* Banner */}
      <View style={styles.banner}>
          <View>
            <Text style={styles.bannerBrand}>TIMBER 360</Text>
            <Text style={styles.bannerTitle}>Settings</Text>
            <Text style={styles.bannerSub}>App Settings & Preferences</Text>
          </View>
          <ScalePress onPress={()=>navigation.goBack()} style={styles.closeBtn}>
            <Text style={{color:COLORS.white,fontSize:22}}>✕</Text>
          </ScalePress>
        </View>

      {/* Appearance */}
      <Section title="APPEARANCE" delay={40}>
        <Row
          icon={dark?'🌙':'☀️'} label="App Theme"
          rowSub={dark?'Dark Mode Active':'Light Mode Active'}
          right={
            <Switch value={dark} onValueChange={v=>updateSetting('mode',v?'dark':'light')}
              trackColor={{false:COLORS.slate300,true:COLORS.indigo600}} thumbColor={COLORS.white} />
          }
          border={false}
        />
      </Section>

      {/* Inventory Mode */}
      <Section title="INVENTORY MODE" delay={80}>
        {[
          { id:'live',   label:'Live Order',   rowSub:'Always create bill',      color:COLORS.success },
          { id:'hybrid', label:'Hybrid',        rowSub:'Warns on low stock', color:COLORS.warning },
          { id:'stock',  label:'Stock Only',    rowSub:'Blocks if insufficient',     color:COLORS.danger  },
        ].map((opt,i,arr)=>(
          <TouchableOpacity key={opt.id}
            style={[styles.row, i<arr.length-1&&styles.rowBorder, {borderColor:brd}]}
            onPress={()=>updateSetting('invMode',opt.id)}
          >
            <View style={[styles.radio,{borderColor:settings.invMode===opt.id?opt.color:COLORS.slate400}]}>
              {settings.invMode===opt.id && <View style={[styles.radioDot,{backgroundColor:opt.color}]} />}
            </View>
            <View style={{flex:1}}>
              <Text style={[styles.rowLabel,{color:text}]}>{opt.label}</Text>
              <Text style={[styles.rowSub,{color:sub}]}>{opt.rowSub}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </Section>

      {/* Preferences */}
      <Section title="PREFERENCES" delay={120}>
        <View style={styles.row}>
          <Text style={[styles.rowLabel,{color:text,flex:1}]}>Currency</Text>
          <View style={styles.chips}>
            {['PKR','USD','EUR'].map(c=>(
              <TouchableOpacity key={c}
                style={[styles.chip,settings.currency===c&&styles.chipActive]}
                onPress={()=>updateSetting('currency',c)}
              >
                <Text style={[styles.chipText,settings.currency===c&&styles.chipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={[styles.row,styles.rowBorder,{borderColor:brd}]}>
          <Text style={[styles.rowLabel,{color:text,flex:1}]}>Wood Unit</Text>
          <View style={styles.chips}>
            {[{v:'in',l:'Inches'},{v:'mm',l:'MM'}].map(u=>(
              <TouchableOpacity key={u.v}
                style={[styles.chip,settings.woodUnit===u.v&&styles.chipActive]}
                onPress={()=>updateSetting('woodUnit',u.v)}
              >
                <Text style={[styles.chipText,settings.woodUnit===u.v&&styles.chipTextActive]}>{u.l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <Row label="Door Calculation"
          rowSub={settings.doorCalc==='standard'?'Standard (Rounded)':'Actual Size'}
          right={
            <View style={styles.chips}>
              {[{v:'standard',l:'Std'},{v:'actual',l:'Act'}].map(d=>(
                <TouchableOpacity key={d.v}
                  style={[styles.chip,settings.doorCalc===d.v&&styles.chipActive]}
                  onPress={()=>updateSetting('doorCalc',d.v)}
                >
                  <Text style={[styles.chipText,settings.doorCalc===d.v&&styles.chipTextActive]}>{d.l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          }
          border={false}
        />
      </Section>

      {/* Security */}
      {!isGuest && (
        <Section title="SECURITY" delay={160}>
          <Row
            icon="🔒" label="Master PIN"
            rowSub={settings.securityPin ? '✅ PIN is active' : 'No PIN set — tap to configure'}
            right={<Text style={{color:sub,fontSize:20}}>{showSecurity?'▲':'▼'}</Text>}
            onPress={()=>setShowSecurity(!showSecurity)}
          />
        <Row
            icon="🔑" label="Ask PIN on App Start"
            rowSub={settings.securityPin ? 'Require PIN when opening app' : 'Set a PIN first to enable this'}
            right={
              <Switch
                value={!!settings.loginLock && !!settings.securityPin}
                disabled={!settings.securityPin}
                onValueChange={v => updateSetting('loginLock', v)}
                trackColor={{false:COLORS.slate300, true:COLORS.primary}}
                thumbColor={COLORS.white}
              />
            }
          />
          <ExpandCollapse visible={showSecurity}>
            <View style={[styles.secBox,{borderTopWidth:1,borderTopColor:dark?COLORS.borderDark:COLORS.borderLight}]}>

              {/* پرانا PIN — صرف تب جب PIN set ہو */}
              {settings.securityPin ? (
                <View style={{marginBottom:SPACING.sm}}>
                  <Text style={{fontSize:FONT.xs,fontWeight:'600',marginBottom:4,textTransform:'uppercase',letterSpacing:0.5,color:dark?COLORS.slate300:COLORS.slate500}}>
                    Current PIN (required)
                  </Text>
                  <TextInput
                    value={oldPinInput}
                    onChangeText={setOldPinInput}
                    placeholder="Enter current PIN"
                    placeholderTextColor={dark?COLORS.slate500:COLORS.slate400}
                    secureTextEntry
                    keyboardType="number-pad"
                    blurOnSubmit={false}
                    returnKeyType="next"
                    style={[pinInputStyle, {color:dark?COLORS.textDark:COLORS.textLight, backgroundColor:dark?COLORS.slate700:COLORS.white, borderColor:dark?COLORS.borderDark:COLORS.borderLight}]}
                  />
                </View>
              ) : null}

              {/* نیا PIN */}
              <View style={{marginBottom:SPACING.sm}}>
                <Text style={{fontSize:FONT.xs,fontWeight:'600',marginBottom:4,textTransform:'uppercase',letterSpacing:0.5,color:dark?COLORS.slate300:COLORS.slate500}}>
                  {settings.securityPin ? 'New PIN (leave empty to remove)' : 'Set PIN (4+ digits)'}
                </Text>
                <TextInput
                  value={pinInput}
                  onChangeText={setPinInput}
                  placeholder={settings.securityPin ? 'New PIN...' : '4+ digits'}
                  placeholderTextColor={dark?COLORS.slate500:COLORS.slate400}
                  secureTextEntry
                  keyboardType="number-pad"
                  blurOnSubmit={false}
                  returnKeyType="done"
                  style={[pinInputStyle, {color:dark?COLORS.textDark:COLORS.textLight, backgroundColor:dark?COLORS.slate700:COLORS.white, borderColor:dark?COLORS.borderDark:COLORS.borderLight}]}
                />
              </View>

              <AppButton onPress={handleSavePin} style={{marginTop:SPACING.sm}}>
                {settings.securityPin ? 'Update PIN' : 'Set PIN'}
              </AppButton>

              {settings.securityPin ? (
                <TouchableOpacity
                  onPress={handleForgotPin}
                  style={{marginTop:SPACING.sm, alignItems:'center', padding:SPACING.sm}}
                >
                  <Text style={{color:COLORS.info, fontSize:FONT.xs, fontWeight:'600'}}>
                    🔑 PIN بھول گئے؟ یہاں Reset کریں
                  </Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                onPress={() => { setShowSecurity(false); setOldPinInput(''); setPinInput(''); }}
                style={{marginTop:SPACING.xs, alignItems:'center'}}
              >
                <Text style={{color:sub, textDecorationLine:'underline', fontSize:FONT.xs}}>Hide</Text>
              </TouchableOpacity>
            </View>
          </ExpandCollapse>
        </Section>
      )}

      {/* Profile */}
      <Section title="BUSINESS PROFILE" delay={200}>
        <Row icon="🏪" label="Edit Profile"
          rowSub={profile.name||'Edit Profile'}
          right={<Text style={{color:sub}}>›</Text>}
          onPress={()=>navigation.navigate('ProfileEditor')}
        />
        <Row icon="🖼️" label="Business Logo"
          rowSub={profile.logo?'Logo uploaded ✅':'No logo'}
          right={<Text style={{color:sub}}>›</Text>}
          onPress={pickLogo} border={false}
        />
      </Section>

      {/* Monthly Goal */}
      <Section title="MONTHLY GOAL" delay={215}>
        <View style={styles.row}>
          <Text style={[styles.rowLabel,{color:text,flex:1}]}>Monthly Target</Text>
          <TextInput
            value={String(settings.monthlyGoal||'')}
            onChangeText={v=>updateSetting('monthlyGoal',parseFloat(v)||0)}
            keyboardType="numeric"
            placeholder="e.g. 1500000"
            placeholderTextColor={sub}
            style={{borderWidth:1,borderColor:brd,borderRadius:RADIUS.md,padding:SPACING.sm,color:text,fontSize:FONT.sm,minWidth:120,textAlign:'right',backgroundColor:bg}}
          />
        </View>
      </Section>

      {/* ☁️ Live Sync */}
      <Section title="DATA SYNC" delay={210}>
        {/* Status row */}
        <View style={[styles.row, { borderColor:brd }]}>
          <Text style={styles.rowIcon}>☁️</Text>
          <View style={{ flex:1 }}>
            <Text style={[styles.rowLabel, { color:text }]}>Live Sync to Server</Text>
            <Text style={[styles.rowSub, { color:sub }]}>
              {isFirebaseMode
                ? planExpiry
                  ? `✅ Active — Expires: ${planExpiry}`
                  : '✅ Active — your data is synced to server'
                : userPlan === 'approved'
                  ? '📲 Local mode — Upgrade to sync'
                  : '⏳ Pending approval'}
            </Text>
          </View>
          <View style={[styles.badge, {
            backgroundColor: isFirebaseMode ? '#F0FDF4' : userPlan==='approved' ? '#FFF7ED' : '#F1F5F9'
          }]}>
            <Text style={{
              color: isFirebaseMode ? '#166534' : userPlan==='approved' ? '#92400E' : '#475569',
              fontSize:FONT.xs, fontWeight:'700'
            }}>
              {isFirebaseMode ? '☁️ Live' : userPlan==='approved' ? 'Local' : 'Pending'}
            </Text>
          </View>
        </View>

        {/* Migration progress bar */}
        {migrationProgress && (
          <View style={{ margin:SPACING.sm, padding:SPACING.md, backgroundColor:'#EFF6FF', borderRadius:RADIUS.lg }}>
            <Text style={{ color:'#1E40AF', fontSize:FONT.xs, fontWeight:'700', marginBottom:SPACING.sm }}>
              {migrationProgress.msg}
            </Text>
            <View style={{ height:8, backgroundColor:'#BFDBFE', borderRadius:4, overflow:'hidden' }}>
              <View style={{ height:8, backgroundColor:'#2563EB', borderRadius:4, width:`${migrationProgress.pct}%` }} />
            </View>
            <Text style={{ color:'#1E40AF', fontSize:10, marginTop:4, textAlign:'right' }}>
              {migrationProgress.pct}%
            </Text>
          </View>
        )}

        {/* Approved users — migration button */}
        {userPlan === 'approved' && !migrationProgress && (
          <View style={{ margin:SPACING.sm, padding:SPACING.md, backgroundColor:'#EFF6FF', borderRadius:RADIUS.lg }}>
            <Text style={{ color:'#1E40AF', fontSize:FONT.xs, lineHeight:18, marginBottom:SPACING.md }}>
              {'💡 Your data will be automatically saved to the server.\nNo existing data will be lost — everything migrates to Firebase.\nThis feature requires a subscription. Contact us to upgrade.'}
            </Text>
            <AppButton
              variant="indigo"
              disabled={isMigrating}
              onPress={async () => {
                const ok = await showConfirm(
                  'Migrate your data to Firebase.\n\nThis action cannot be undone — all data will be moved to Firebase.\n\nContinue?',
                  'Activate Live Sync'
                );
                if (!ok) return;
                try {
                  await migrateToFirebase((msg, pct) => {
                    setMigrationProgress({ msg, pct });
                  });
                  setMigrationProgress(null);
                  await showAlert('✅ Migration complete! Your data is now on Firebase.', 'Done');
                } catch (e) {
                  setMigrationProgress(null);
                  await showAlert(e.message || 'Migration failed — please try again', 'Error');
                }
              }}
              style={{ marginTop:SPACING.sm }}
            >
              ☁️ Activate Live Sync
            </AppButton>
          </View>
        )}

        {/* Firebase users — plan info */}
        {isFirebaseMode && planExpiry && (() => {
          const today = new Date().toISOString().split('T')[0];
          const daysLeft = Math.ceil((new Date(planExpiry) - new Date(today)) / 86400000);
          const isNearExpiry = daysLeft <= 7;
          return (
            <View style={{ margin:SPACING.sm, padding:SPACING.md, backgroundColor: isNearExpiry?'#FFF7ED':'#F0FDF4', borderRadius:RADIUS.lg }}>
              <Text style={{ color: isNearExpiry?'#92400E':'#166534', fontSize:FONT.xs, fontWeight:'700' }}>
                {isNearExpiry
                  ? `⚠️ Subscription ${daysLeft <= 0 ? 'expires today' : `expires in ${daysLeft} days`}`
                  : `✅ Subscription active — ${daysLeft} days remaining`}
              </Text>
            </View>
          );
        })()}
      </Section>

      {/* Order Tracking URL */}
      <Section title="ORDER TRACKING" delay={215}>
        <View style={[styles.settingCard,{backgroundColor:card}]}>
          <Text style={[styles.settingTitle,{color:text}]}>📦 Tracking Page URL</Text>
          <Text style={{color:sub,fontSize:FONT.xs,marginBottom:SPACING.sm,lineHeight:18}}>
            QR code میں یہ URL شامل ہوگی۔ GitHub Pages پر tracking.html ہوسٹ کریں۔
          </Text>
          <AppInput
            label="Tracking Base URL"
            value={settings.trackingUrl||''}
            onChangeText={v=>updateSetting('trackingUrl',v)}
            dark={dark}
            placeholder="https://yasirjalalkhan-collab.github.io/tracking"
          />
        </View>
      </Section>

     {/* Calculator FAB */}
      <Section title="CALCULATOR" delay={220}>
        <Row icon="🧮" label="Calculator FAB"
          rowSub="Shortcut on home screen"
          right={
            <Switch value={!!settings.showCalcFAB} onValueChange={v=>updateSetting('showCalcFAB',v)}
              trackColor={{false:COLORS.slate300,true:COLORS.primary}} thumbColor={COLORS.white} />
          }
          border={false}
        />
      </Section>

      {/* Data */}
      {!isGuest && (
        <Section title="DATA MANAGEMENT" delay={240}>
          <Row icon="📤" label="Backup Data"
            rowSub="Share as JSON file"
            right={<Text style={{color:sub}}>›</Text>}
            onPress={doBackup}
          />
          <Row icon="📥" label="Restore Data"
            rowSub="Restore from backup file"
            right={<Text style={{color:sub}}>›</Text>}
            onPress={doRestore}
          />
          <Row icon="📋" label="Activity Logs"
            rowSub="Record of all actions"
            right={<Text style={{color:sub}}>›</Text>}
            onPress={()=>navigation.navigate('ActivityLogs')}
            border={false}
          />
        </Section>
      )}

      {/* ── About ────────────────────────────────────────── */}
      <Section title="ABOUT APP" delay={220}>
        <View style={[styles.aboutBox,{backgroundColor:card,borderColor:brd}]}>
          {/* Logo + Name */}
          <View style={styles.aboutHeader}>
            <View style={styles.aboutLogo}>
              <Text style={{fontSize:36}}>🌲</Text>
            </View>
            <View style={{flex:1,marginLeft:SPACING.lg}}>
              <Text style={{color:text,fontSize:FONT.xl,fontWeight:'900'}}>Timber 360</Text>
              <Text style={{color:sub,fontSize:FONT.xs,marginTop:2}}>Doors & Wood Business Manager</Text>
            </View>
          </View>

          {/* Version info */}
          <View style={[styles.aboutRow,{borderTopColor:brd}]}>
            <Text style={{color:sub,fontSize:FONT.xs,fontWeight:'700',textTransform:'uppercase'}}>Version</Text>
            <Text style={{color:text,fontWeight:'700'}}>1.0.1</Text>
          </View>
          <View style={[styles.aboutRow,{borderTopColor:brd}]}>
            <Text style={{color:sub,fontSize:FONT.xs,fontWeight:'700',textTransform:'uppercase'}}>Build</Text>
            <Text style={{color:text,fontWeight:'700'}}>2025 · Expo SDK 52</Text>
          </View>
          <View style={[styles.aboutRow,{borderTopColor:brd}]}>
            <Text style={{color:sub,fontSize:FONT.xs,fontWeight:'700',textTransform:'uppercase'}}>Platform</Text>
            <Text style={{color:text,fontWeight:'700'}}>Android · React Native 0.76</Text>
          </View>
          <View style={[styles.aboutRow,{borderTopColor:brd}]}>
            <Text style={{color:sub,fontSize:FONT.xs,fontWeight:'700',textTransform:'uppercase'}}>Database</Text>
            <Text style={{color:text,fontWeight:'700'}}>Firebase Firestore + AsyncStorage</Text>
          </View>
          <View style={[styles.aboutRow,{borderTopColor:brd}]}>
            <Text style={{color:sub,fontSize:FONT.xs,fontWeight:'700',textTransform:'uppercase'}}>Features</Text>
            <Text style={{color:text,fontWeight:'700',textAlign:'right',flex:1,marginLeft:8}}>Invoice · Ledger · Cheque · Stock · Analytics</Text>
          </View>

          {/* Tagline */}
          <View style={{padding:SPACING.lg,borderTopWidth:1,borderTopColor:brd,alignItems:'center'}}>
            <Text style={{color:COLORS.primary,fontSize:FONT.xs,fontWeight:'700',textAlign:'center',lineHeight:18}}>
              ❝ پاکستانی لکڑی اور دروازے کے کاروبار کے لیے مکمل حل ❞
            </Text>
            <Text style={{color:sub,fontSize:10,marginTop:8,textAlign:'center'}}>
              © 2025 Timber 360 · All Rights Reserved
            </Text>
          </View>
        </View>
      </Section>

      {/* Logout */}
      <ScalePress style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>🚪 Sign Out</Text>
        </ScalePress>

        <ScalePress style={[styles.logoutBtn,{backgroundColor:'#7f1d1d',borderColor:COLORS.danger,marginTop:SPACING.md}]} onPress={doFactoryReset}>
          <Text style={[styles.logoutText,{color:'#fca5a5'}]}>☢️ Factory Reset (Danger)</Text>
        </ScalePress>

    </ScrollView>
  );
}

const pinInputStyle = { borderWidth:1, borderRadius:8, paddingHorizontal:12, paddingVertical:10, fontSize:16, letterSpacing:4 };

const styles = StyleSheet.create({
  root:        { flex:1 },
  content:     { paddingBottom:60 },
  banner:      { backgroundColor:COLORS.slate900, padding:SPACING.xl, paddingTop:SPACING.xxxl, flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:SPACING.md },
  bannerBrand: { color:COLORS.primaryLight, fontSize:FONT.xs, fontWeight:'700', letterSpacing:2 },
  bannerTitle: { color:COLORS.white, fontSize:FONT.xxl, fontWeight:'800', marginTop:4 },
  bannerSub:   { color:COLORS.slate400, fontSize:FONT.xs, marginTop:2 },
  closeBtn:    { padding:SPACING.sm },
  sectionLabel:{ fontSize:FONT.xs, fontWeight:'700', color:COLORS.slate400, textTransform:'uppercase', paddingHorizontal:SPACING.xl, paddingBottom:SPACING.sm },
  sectionBox:  { marginHorizontal:SPACING.md, borderRadius:RADIUS.xl, overflow:'hidden', ...SHADOW.sm },
  row:         { flexDirection:'row', alignItems:'center', padding:SPACING.lg, gap:SPACING.md },
  rowBorder:   { borderTopWidth:1 },
  rowIcon:     { fontSize:22, width:28 },
  rowLabel:    { fontSize:FONT.base, fontWeight:'600' },
  rowSub:      { fontSize:FONT.xs, marginTop:2 },
  radio:       { width:20, height:20, borderRadius:10, borderWidth:2, justifyContent:'center', alignItems:'center' },
  radioDot:    { width:10, height:10, borderRadius:5 },
  chips:       { flexDirection:'row', gap:SPACING.xs },
  chip:        { paddingHorizontal:SPACING.md, paddingVertical:6, borderRadius:RADIUS.md, backgroundColor:COLORS.slate100, borderWidth:1, borderColor:COLORS.slate200 },
  chipActive:  { backgroundColor:COLORS.primary, borderColor:COLORS.primary },
  chipText:    { fontSize:FONT.xs, fontWeight:'700', color:COLORS.slate600 },
  chipTextActive:{ color:COLORS.white },
  secBox:      { padding:SPACING.md },
  logoutBtn:   { margin:SPACING.xl, padding:SPACING.lg, backgroundColor:COLORS.red50, borderRadius:RADIUS.xl, alignItems:'center', borderWidth:1, borderColor:COLORS.red600 },
  badge:       { paddingHorizontal:SPACING.sm, paddingVertical:3, borderRadius:RADIUS.sm },
  logoutText:  { color:COLORS.danger, fontWeight:'700', fontSize:FONT.base },
  aboutBox:    { borderRadius:RADIUS.xl, borderWidth:1, overflow:'hidden', marginBottom:SPACING.sm },
  aboutHeader: { flexDirection:'row', alignItems:'center', padding:SPACING.lg },
  aboutLogo:   { width:64, height:64, borderRadius:RADIUS.xl, backgroundColor:COLORS.slate800, justifyContent:'center', alignItems:'center' },
  aboutRow:    { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:SPACING.lg, paddingVertical:SPACING.md, borderTopWidth:1 },
});
