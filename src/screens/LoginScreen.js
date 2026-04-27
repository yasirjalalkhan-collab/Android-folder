import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Animated, Alert,
} from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { db, auth } from '../services/firebase';
import { useApp } from '../context/AppContext';
import { COLORS, SPACING, RADIUS, FONT, SHADOW } from '../utils/theme';

// ── Secret Questions List ─────────────────────────────────────
export const SECRET_QUESTIONS = [
  "What is your mother's maiden name?",
  "What was the name of your first pet?",
  "What city were you born in?",
  "What was the name of your first school?",
  "What is your oldest sibling's name?",
  "What was your childhood nickname?",
  "What is your favorite sports team?",
];

// ── Password Input Field ──────────────────────────────────────
function PasswordInput({ label, value, onChangeText, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <View style={{ marginBottom: SPACING.md }}>
      <Text style={styles.label}>{label}</Text>
      <View style={{ position:'relative' }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder || '••••••••'}
          placeholderTextColor={COLORS.slate400}
          secureTextEntry={!show}
          style={[styles.input, { paddingRight:50, marginBottom:0 }]}
        />
        <TouchableOpacity
          style={{ position:'absolute', right:SPACING.md, top:SPACING.md }}
          onPress={() => setShow(!show)}
        >
          <Text style={{ fontSize:16 }}>{show ? '🙈' : '👁️'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Question Picker ───────────────────────────────────────────
function QuestionPicker({ selected, onSelect }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: SPACING.md }}>
      <Text style={styles.label}>Secret Question</Text>
      <TouchableOpacity
        style={[styles.input, { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:SPACING.md }]}
        onPress={() => setOpen(!open)}
      >
        <Text style={{ color: selected ? COLORS.textLight : COLORS.slate400, fontSize:FONT.sm, flex:1 }} numberOfLines={2}>
          {selected || 'Select a question...'}
        </Text>
        <Text style={{ color:COLORS.slate400, marginLeft:8 }}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.dropdown}>
          {SECRET_QUESTIONS.map((q, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.dropdownItem, i < SECRET_QUESTIONS.length - 1 && styles.dropdownItemBorder]}
              onPress={() => { onSelect(q); setOpen(false); }}
            >
              <Text style={{ color: q === selected ? COLORS.primary : COLORS.textLight, fontSize:FONT.sm, lineHeight:18 }}>
                {q}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ════════════════════════════════════════════════════════════
// MAIN LOGIN SCREEN
// ════════════════════════════════════════════════════════════
export default function LoginScreen() {
  const { loginEmail, registerEmail, loginGuest, showAlert } = useApp();

  const [mode,     setMode]     = useState('login'); // 'login' | 'register' | 'forgot'
  const [loading,  setLoading]  = useState(false);
  const [regAllowed, setRegAllowed] = useState(true);

  // Login fields
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');

  // Register extra fields
  const [confirmPass, setConfirmPass]   = useState('');
  const [secretQ,     setSecretQ]       = useState('');
  const [secretA,     setSecretA]       = useState('');

  // Forgot fields
  const [forgotEmail,  setForgotEmail]  = useState('');
  const [forgotAnswer, setForgotAnswer] = useState('');
  const [forgotQ,      setForgotQ]      = useState('');  // fetched from Firestore
  const [forgotStep,   setForgotStep]   = useState(1);   // 1=email, 2=answer

  // Animations
  const logoAnim    = useRef(new Animated.Value(0)).current;
  const cardAnim    = useRef(new Animated.Value(40)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(logoAnim,   { toValue:1, duration:600, useNativeDriver:true }),
      Animated.parallel([
        Animated.timing(cardAnim,    { toValue:0, duration:400, useNativeDriver:true }),
        Animated.timing(cardOpacity, { toValue:1, duration:400, useNativeDriver:true }),
      ]),
    ]).start();

    getDoc(doc(db, 'appConfig', 'settings'))
      .then(snap => {
        if (snap.exists()) setRegAllowed(snap.data().registrationEnabled !== false);
      }).catch(() => {});
  }, []);

  // ── Firebase error → readable message ───────────────────────
  const parseError = (e) => {
    const msg = e.message || 'Failed — please try again';
    if (e.code === 'auth/email-already-in-use') return 'This email is already registered.';
    if (e.code === 'auth/invalid-email')        return 'Invalid email address.';
    if (e.code === 'auth/wrong-password')        return 'Incorrect password.';
    if (e.code === 'auth/invalid-credential')    return 'Incorrect email or password.';
    if (e.code === 'auth/user-not-found')        return 'Account not found.';
    if (e.code === 'auth/weak-password')         return 'Password must be at least 6 characters.';
    if (e.code === 'auth/too-many-requests')     return 'Too many attempts — try again later.';
    return msg;
  };

  // ── LOGIN ────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Required', 'Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      await loginEmail(email.trim(), password);
    } catch (e) {
      Alert.alert('Login Failed', parseError(e));
    } finally {
      setLoading(false);
    }
  };

  // ── REGISTER ─────────────────────────────────────────────────
  const handleRegister = async () => {
    if (!regAllowed) {
      Alert.alert('Closed', 'New registration is currently closed.');
      return;
    }
    if (!email.trim()) { Alert.alert('Required', 'Please enter your email'); return; }
    if (!password)     { Alert.alert('Required', 'Please enter a password'); return; }
    if (password.length < 6) { Alert.alert('Too Short', 'Password must be at least 6 characters'); return; }
    if (password !== confirmPass) { Alert.alert('Mismatch', 'Passwords do not match'); return; }
    if (!secretQ) { Alert.alert('Required', 'Please select a secret question'); return; }
    if (!secretA.trim()) { Alert.alert('Required', 'Please enter your secret answer'); return; }
    if (secretA.trim().length < 2) { Alert.alert('Too Short', 'Secret answer is too short'); return; }

    setLoading(true);
    try {
      await registerEmail(email.trim(), password, secretQ, secretA.trim().toLowerCase());
    } catch (e) {
      Alert.alert('Registration Failed', parseError(e));
    } finally {
      setLoading(false);
    }
  };

  // ── FORGOT PASSWORD — Step 1: find email ────────────────────
  const handleForgotStep1 = async () => {
    if (!forgotEmail.trim()) {
      Alert.alert('Required', 'Please enter your registered email');
      return;
    }
    setLoading(true);
    try {
      // Email سے userSecrets document پڑھیں
      const key  = forgotEmail.trim().toLowerCase().replace(/[.#$[\]]/g, '_');
      const snap = await getDoc(doc(db, 'userSecrets', key));
      if (!snap.exists()) {
        Alert.alert('Not Found', 'No account found with this email address');
        return;
      }
      setForgotQ(snap.data().secretQuestion || '');
      setForgotStep(2);
    } catch (e) {
      Alert.alert('Error', 'Could not find account. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  // ── FORGOT PASSWORD — Step 2: verify answer + reset ─────────
  const handleForgotStep2 = async () => {
    if (!forgotAnswer.trim()) {
      Alert.alert('Required', 'Please enter your secret answer');
      return;
    }
    setLoading(true);
    try {
      const key  = forgotEmail.trim().toLowerCase().replace(/[.#$[\]]/g, '_');
      const snap = await getDoc(doc(db, 'userSecrets', key));
      if (!snap.exists()) { Alert.alert('Error', 'Account not found'); return; }

      const stored = snap.data().secretAnswer || '';
      const entered = forgotAnswer.trim().toLowerCase();

      if (entered !== stored) {
        Alert.alert('Wrong Answer', 'Secret answer is incorrect. Please try again.');
        setForgotAnswer('');
        return;
      }

      // Answer correct → Firebase password reset email
      await sendPasswordResetEmail(auth, forgotEmail.trim());

      Alert.alert(
        'Email Sent ✅',
        `A password reset link has been sent to:\n${forgotEmail}\n\nPlease check your inbox.`,
        [{ text: 'OK', onPress: () => { setMode('login'); setForgotStep(1); setForgotEmail(''); setForgotAnswer(''); setForgotQ(''); } }]
      );
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        Alert.alert('Not Found', 'No account with this email');
      } else {
        Alert.alert('Error', e.message || 'Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    setLoading(true);
    try { await loginGuest(); } finally { setLoading(false); }
  };

  // ════════════════════════════════════════════════════════════
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.root}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <Animated.View style={[styles.header, {
          opacity: logoAnim,
          transform:[{ scale: logoAnim.interpolate({ inputRange:[0,1], outputRange:[0.7,1] }) }]
        }]}>
          <Text style={styles.logo}>🌲</Text>
          <Text style={styles.appName}>Timber 360</Text>
          <Text style={styles.tagline}>Doors & Wood Business Manager</Text>
        </Animated.View>

        {/* Card */}
        <Animated.View style={[styles.card, { opacity:cardOpacity, transform:[{translateY:cardAnim}] }]}>

          {/* ── Forgot Password ──────────────────────────────── */}
          {mode === 'forgot' ? (
            <>
              <TouchableOpacity onPress={() => { setMode('login'); setForgotStep(1); }} style={{ marginBottom:SPACING.lg }}>
                <Text style={{ color:COLORS.primary, fontWeight:'700', fontSize:FONT.sm }}>‹ Back to Login</Text>
              </TouchableOpacity>

              <Text style={styles.sectionTitle}>
                {forgotStep === 1 ? '🔑 Password Recovery' : '❓ Secret Question'}
              </Text>

              {forgotStep === 1 ? (
                <>
                  <Text style={[styles.hintText]}>
                    Enter your registered email to find your account.
                  </Text>
                  <Text style={styles.label}>Registered Email</Text>
                  <TextInput
                    value={forgotEmail} onChangeText={setForgotEmail}
                    placeholder="your@email.com"
                    placeholderTextColor={COLORS.slate400}
                    keyboardType="email-address" autoCapitalize="none"
                    style={styles.input}
                  />
                  <TouchableOpacity style={styles.btnPrimary} onPress={handleForgotStep1} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Find Account →</Text>}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.questionBox}>
                    <Text style={styles.questionLabel}>Your Security Question:</Text>
                    <Text style={styles.questionText}>{forgotQ}</Text>
                  </View>
                  <Text style={styles.label}>Your Answer</Text>
                  <TextInput
                    value={forgotAnswer} onChangeText={setForgotAnswer}
                    placeholder="Enter your answer..."
                    placeholderTextColor={COLORS.slate400}
                    autoCapitalize="none"
                    style={styles.input}
                  />
                  <Text style={styles.hintText}>Answer is not case-sensitive.</Text>
                  <TouchableOpacity style={styles.btnPrimary} onPress={handleForgotStep2} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Send Reset Link →</Text>}
                  </TouchableOpacity>
                </>
              )}
            </>
          ) : (
            <>
              {/* ── Login / Register Tabs ─────────────────────── */}
              <View style={styles.modeRow}>
                {['login','register'].map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.modeBtn, mode===m && styles.modeBtnActive]}
                    onPress={() => setMode(m)}
                  >
                    <Text style={[styles.modeBtnText, mode===m && {color:COLORS.white}]}>
                      {m==='login' ? 'Login' : 'Register'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Registration closed */}
              {mode === 'register' && !regAllowed && (
                <View style={styles.closedBox}>
                  <Text style={styles.closedText}>🚫 Registration is currently closed</Text>
                </View>
              )}

              {/* Email */}
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email} onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor={COLORS.slate400}
                keyboardType="email-address" autoCapitalize="none"
                style={styles.input}
              />

              {/* Password */}
              <PasswordInput
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
              />

              {/* Register extra fields */}
              {mode === 'register' && (
                <>
                  <PasswordInput
                    label="Confirm Password"
                    value={confirmPass}
                    onChangeText={setConfirmPass}
                    placeholder="Re-enter password"
                  />

                  {/* Secret Question */}
                  <QuestionPicker selected={secretQ} onSelect={setSecretQ} />

                  <Text style={styles.label}>Your Answer</Text>
                  <TextInput
                    value={secretA} onChangeText={setSecretA}
                    placeholder="Answer (used for password recovery)"
                    placeholderTextColor={COLORS.slate400}
                    autoCapitalize="none"
                    style={styles.input}
                  />
                  <Text style={styles.hintText}>
                    💡 Remember this answer — it's needed to reset your password or PIN.
                  </Text>
                </>
              )}

              {/* Submit */}
              <TouchableOpacity
                style={[styles.btnPrimary, mode==='register' && !regAllowed && { opacity:0.5 }]}
                onPress={mode === 'register' ? handleRegister : handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={styles.btnPrimaryText}>
                      {mode === 'login' ? 'Login →' : 'Create Account →'}
                    </Text>
                }
              </TouchableOpacity>

              {/* Forgot password link — login mode only */}
              {mode === 'login' && (
                <TouchableOpacity
                  onPress={() => setMode('forgot')}
                  style={{ alignItems:'center', marginTop:SPACING.md }}
                >
                  <Text style={{ color:COLORS.primary, fontSize:FONT.sm, fontWeight:'600' }}>
                    Forgot password?
                  </Text>
                </TouchableOpacity>
              )}

              <View style={styles.divider}>
                <View style={styles.dividerLine}/>
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine}/>
              </View>

              <TouchableOpacity style={styles.btnGuest} onPress={handleGuest} disabled={loading} activeOpacity={0.85}>
                <Text style={styles.btnGuestText}>👤 Continue as Guest</Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>

        <Animated.View style={[styles.guestNote, { opacity:cardOpacity }]}>
          <Text style={styles.guestNoteText}>
            ⚠️ In guest mode, data is only saved on this device
          </Text>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:           { flex:1, backgroundColor:COLORS.bgLight },
  scroll:         { flexGrow:1, justifyContent:'center', padding:SPACING.xl },
  header:         { alignItems:'center', marginBottom:SPACING.xxxl },
  logo:           { fontSize:64, marginBottom:SPACING.sm },
  appName:        { fontSize:FONT.xxxl, fontWeight:'800', color:COLORS.primary },
  tagline:        { fontSize:FONT.sm, color:COLORS.slate500, marginTop:4 },
  card:           { backgroundColor:COLORS.white, borderRadius:RADIUS.xxl, padding:SPACING.xl, ...SHADOW.md },
  sectionTitle:   { fontSize:FONT.xl, fontWeight:'800', color:COLORS.textLight, marginBottom:SPACING.md },
  hintText:       { fontSize:FONT.xs, color:COLORS.slate400, marginBottom:SPACING.md, lineHeight:18 },
  modeRow:        { flexDirection:'row', backgroundColor:COLORS.slate100, borderRadius:RADIUS.lg, padding:4, marginBottom:SPACING.lg },
  modeBtn:        { flex:1, padding:SPACING.sm, borderRadius:RADIUS.md, alignItems:'center' },
  modeBtnActive:  { backgroundColor:COLORS.primary },
  modeBtnText:    { fontSize:FONT.sm, fontWeight:'700', color:COLORS.slate600 },
  closedBox:      { backgroundColor:'#FEF2F2', borderRadius:RADIUS.md, padding:SPACING.md, marginBottom:SPACING.md },
  closedText:     { color:'#DC2626', fontSize:FONT.xs, fontWeight:'700', textAlign:'center' },
  label:          { fontSize:FONT.xs, fontWeight:'700', color:COLORS.slate500, marginBottom:4, textTransform:'uppercase', letterSpacing:0.5 },
  input:          { borderWidth:1.5, borderColor:COLORS.borderLight, borderRadius:RADIUS.lg, padding:SPACING.md, fontSize:FONT.base, color:COLORS.textLight, marginBottom:SPACING.md },
  btnPrimary:     { backgroundColor:COLORS.primary, borderRadius:RADIUS.lg, padding:SPACING.lg, alignItems:'center', marginTop:SPACING.sm },
  btnPrimaryText: { color:COLORS.white, fontWeight:'700', fontSize:FONT.md },
  divider:        { flexDirection:'row', alignItems:'center', marginVertical:SPACING.lg, gap:SPACING.md },
  dividerLine:    { flex:1, height:1, backgroundColor:COLORS.borderLight },
  dividerText:    { color:COLORS.slate400, fontSize:FONT.xs },
  btnGuest:       { backgroundColor:COLORS.slate100, borderRadius:RADIUS.lg, padding:SPACING.lg, alignItems:'center' },
  btnGuestText:   { color:COLORS.slate600, fontWeight:'600', fontSize:FONT.base },
  guestNote:      { marginTop:SPACING.xl, padding:SPACING.md, backgroundColor:COLORS.orange50, borderRadius:RADIUS.md },
  guestNoteText:  { color:COLORS.warning, fontSize:FONT.sm, textAlign:'center' },
  // Dropdown
  dropdown:       { borderWidth:1.5, borderColor:COLORS.primary, borderRadius:RADIUS.lg, overflow:'hidden', marginTop:-SPACING.sm, marginBottom:SPACING.md, backgroundColor:COLORS.white },
  dropdownItem:   { padding:SPACING.md },
  dropdownItemBorder: { borderBottomWidth:1, borderBottomColor:COLORS.borderLight },
  // Forgot
  questionBox:    { backgroundColor:COLORS.green50, borderRadius:RADIUS.lg, padding:SPACING.md, marginBottom:SPACING.md, borderLeftWidth:3, borderLeftColor:COLORS.primary },
  questionLabel:  { fontSize:FONT.xs, color:COLORS.slate500, fontWeight:'700', marginBottom:4 },
  questionText:   { fontSize:FONT.sm, color:COLORS.textLight, fontWeight:'600', lineHeight:20 },
});
