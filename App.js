import 'react-native-gesture-handler';
import React, { useRef, useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { AppProvider, useApp } from './src/context/AppContext';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ui/ErrorBoundary';
import PromptModal from './src/components/ui/PromptModal';
import { addNotificationResponseListener } from './src/services/notifications';

// ── Global navigation ref — notification tap handler کے لیے ──
export const navigationRef = React.createRef();

// ── Root: PromptModal + Offline Indicator + Notification handler ──
function Root() {
  const { settings, _modalRef, isOnline, syncPending, flushQueue } = useApp();
  const dark = settings?.mode === 'dark';

  const [modal, setModal] = useState(null);

  // PromptModal register کریں
  React.useEffect(() => {
    if (!_modalRef) return;
    _modalRef.current.alert = ({ msg, title, onOk }) => {
      setModal({ type:'alert', msg, title, onOk: () => { setModal(null); onOk?.(); } });
    };
    _modalRef.current.confirm = ({ msg, title, onOk, onCancel }) => {
      setModal({ type:'confirm', msg, title,
        onOk:    () => { setModal(null); onOk?.(); },
        onCancel:() => { setModal(null); onCancel?.(); },
      });
    };
    _modalRef.current.prompt = ({ msg, title, def, onOk, onCancel }) => {
      setModal({ type:'prompt', msg, title, def,
        onOk:    (val) => { setModal(null); onOk?.(val); },
        onCancel:()    => { setModal(null); onCancel?.(); },
      });
    };
  }, [_modalRef]);

  // ── Notification tap handler ──────────────────────────────
  useEffect(() => {
    const sub = addNotificationResponseListener(navigationRef);  // module-level ref
    return () => sub?.remove();
  }, []);

  const { broadcastMsg, setBroadcastMsg } = useApp();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: dark ? '#0f172a' : '#166534' }]}>
      <StatusBar style="light" backgroundColor="transparent" translucent={false} />
      <View style={styles.content}>
        <AppNavigator />

        {/* ── Offline / Sync indicator ── */}
        {(!isOnline || syncPending > 0) && (
          <TouchableOpacity
            style={[styles.offlineBanner, { backgroundColor: isOnline ? '#d97706' : '#dc2626' }]}
            onPress={() => isOnline && flushQueue()}
            activeOpacity={0.8}
          >
            <Text style={{ color:'#fff', fontSize:11, fontWeight:'700' }}>
              {!isOnline
                ? '📵 Offline — data queue میں محفوظ ہے'
                : `🔄 ${syncPending} operations sync ہو رہی ہیں...`}
            </Text>
          </TouchableOpacity>
        )}

        {/* Broadcast message */}
        {broadcastMsg ? (
          <View style={{
            position:'absolute', bottom:0, left:0, right:0, top:0,
            backgroundColor:'rgba(0,0,0,0.6)', justifyContent:'center', alignItems:'center', padding:24,
          }}>
            <View style={{ backgroundColor:'#fff', borderRadius:16, padding:24, width:'100%', maxWidth:400 }}>
              <Text style={{ fontWeight:'900', fontSize:18, color:'#1e293b', marginBottom:8 }}>
                📢 Message from Admin
              </Text>
              <Text style={{ color:'#475569', fontSize:14, lineHeight:22, marginBottom:20 }}>
                {broadcastMsg}
              </Text>
              <TouchableOpacity
                style={{ backgroundColor:'#166534', padding:14, borderRadius:12, alignItems:'center' }}
                onPress={() => setBroadcastMsg(null)}
              >
                <Text style={{ color:'#fff', fontWeight:'700' }}>OK, Got it</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
        {/* Global modal */}
        {modal && (
          <PromptModal
            visible={true}
            type={modal.type}
            title={modal.title}
            message={modal.msg}
            defaultValue={modal.def || ''}
            onConfirm={modal.onOk}
            onCancel={modal.onCancel || modal.onOk}
            dark={dark}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AppProvider>
          <NavigationContainer ref={navigationRef}>
            <Root />
          </NavigationContainer>
        </AppProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1 },
  content:       { flex: 1 },
  offlineBanner: {
    position:       'absolute',
    top:            0,
    left:           0,
    right:          0,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems:     'center',
    zIndex:         9998,
  },
});
