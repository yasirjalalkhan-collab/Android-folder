import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Image, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import AppButton from '../components/ui/AppButton';
import AppInput  from '../components/ui/AppInput';
import { COLORS, SPACING, RADIUS, FONT, SHADOW } from '../utils/theme';

export default function ProfileEditorScreen() {
  const navigation = useNavigation();
  const { profile, setProfile, settings, showAlert } = useApp();
  const dark = settings.mode === 'dark';
  const bg   = dark ? COLORS.bgDark     : COLORS.bgLight;
  const card = dark ? COLORS.surfaceDark : COLORS.white;
  const text = dark ? COLORS.textDark   : COLORS.textLight;
  const sub  = dark ? COLORS.slate400   : COLORS.slate500;
  const brd  = dark ? COLORS.borderDark : COLORS.borderLight;

  const [local, setLocal] = useState({ ...profile });

  const handleSave = async () => {
    // فوری واپس جائیں، background میں save
    navigation.goBack();
    setProfile(local);
  };

  const pickLogo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { await showAlert('Gallery permission required', 'Permission'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      const logo = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setLocal(p => ({ ...p, logo }));
    }
  };

  const removeLogo = () => setLocal(p => ({ ...p, logo: null }));

  return (
    <ScrollView style={[styles.root, { backgroundColor: bg }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: card, borderBottomColor: brd }]}>
        <Text style={[styles.title, { color: text }]}>Business Profile</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Logo section */}
      <View style={[styles.card, { backgroundColor: card }]}>
        <Text style={[styles.sectionLabel, { color: sub }]}>BUSINESS LOGO</Text>
        <View style={styles.logoRow}>
          {local.logo ? (
            <Image source={{ uri: local.logo }} style={styles.logoPreview} />
          ) : (
            <View style={[styles.logoPlaceholder, { backgroundColor: dark ? COLORS.slate700 : COLORS.slate100, borderColor: brd }]}>
              <Text style={{ fontSize: 36 }}>🏪</Text>
              <Text style={{ color: sub, fontSize: FONT.xs, marginTop: 4 }}>No logo</Text>
            </View>
          )}
          <View style={{ gap: SPACING.sm }}>
            <TouchableOpacity style={[styles.logoBtn, { backgroundColor: COLORS.primary }]} onPress={pickLogo}>
              <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: FONT.sm }}>
                📷  {local.logo ? 'Change' : 'Upload Logo'}
              </Text>
            </TouchableOpacity>
            {local.logo && (
              <TouchableOpacity style={[styles.logoBtn, { backgroundColor: COLORS.red50, borderWidth:1, borderColor:COLORS.danger }]} onPress={removeLogo}>
                <Text style={{ color: COLORS.danger, fontWeight: '700', fontSize: FONT.sm }}>🗑️  Remove</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Business info */}
      <View style={[styles.card, { backgroundColor: card }]}>
        <Text style={[styles.sectionLabel, { color: sub }]}>BUSINESS INFO</Text>
        <AppInput label="Business Name"    value={local.name||''}        onChangeText={v=>setLocal(p=>({...p,name:v}))}        dark={dark} />
        <AppInput label="Owner Name"       value={local.ownerName||''}   onChangeText={v=>setLocal(p=>({...p,ownerName:v}))}   dark={dark} />
        <AppInput label="Phone"            value={local.phone||''}       onChangeText={v=>setLocal(p=>({...p,phone:v}))}       keyboardType="phone-pad" dark={dark} />
        <AppInput label="Address"          value={local.address||''}     onChangeText={v=>setLocal(p=>({...p,address:v}))}     dark={dark} />
        <AppInput label="Invoice Prefix"   value={local.invoicePrefix||''} onChangeText={v=>setLocal(p=>({...p,invoicePrefix:v}))} dark={dark} />
        <AppInput
          label="Invoice Footer"
          value={local.footer||''}
          onChangeText={v=>setLocal(p=>({...p,footer:v}))}
          dark={dark}
          placeholder="e.g. Thank you for your business!"
          multiline
        />
      </View>

      <AppButton onPress={handleSave} style={{ margin: SPACING.lg }}>💾  Save Profile</AppButton>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:           { flex:1 },
  content:        { paddingBottom: 60 },
  header:         { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:SPACING.lg, borderBottomWidth:1 },
  title:          { fontSize:FONT.xl, fontWeight:'700' },
  card:           { margin:SPACING.md, padding:SPACING.lg, borderRadius:RADIUS.xl, ...SHADOW.sm },
  sectionLabel:   { fontSize:FONT.xs, fontWeight:'700', textTransform:'uppercase', marginBottom:SPACING.md, letterSpacing:0.5 },
  logoRow:        { flexDirection:'row', alignItems:'center', gap:SPACING.lg },
  logoPreview:    { width:80, height:80, borderRadius:RADIUS.xl },
  logoPlaceholder:{ width:80, height:80, borderRadius:RADIUS.xl, borderWidth:1, borderStyle:'dashed', justifyContent:'center', alignItems:'center' },
  logoBtn:        { paddingVertical:SPACING.sm, paddingHorizontal:SPACING.md, borderRadius:RADIUS.lg },
});
