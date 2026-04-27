// ── AppContext — Global State + Firebase ──────────────────────
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Alert } from 'react-native';
import * as Network from 'expo-network';
import {
  collection, doc, setDoc, deleteDoc, onSnapshot,
  getDoc, getDocs, writeBatch,
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged,
} from 'firebase/auth';
import { auth, db, enableNetwork, disableNetwork } from '../services/firebase';
import {
  loadGuest, updateGuestItem, deleteGuestItem,
  saveGuestObject, loadGuestObject, clearAllGuest,
  loadUserLocal, updateUserLocalItem, deleteUserLocalItem,
  loadUserLocalObject, saveUserLocalObject, saveUserLocal,
} from '../utils/storage';
import { calculateLedgerBalance, safeParseAmount } from '../utils/ledger';
import {
  requestNotificationPermission,
  scheduleChequeReminder,
  cancelChequeReminder,
  scheduleAllChequeReminders,
  notifyChequeReturned,
} from '../services/notifications';
import {
  enqueueOp, getQueue, clearQueue, removeFromQueue,
} from '../services/syncQueue';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

// ── Admin UID ─────────────────────────────────────────────────
export const ADMIN_UID = ['64Iy6Gz','pNLOR6b','rsEyejD','mMUCOp1'].join('');

const DEFAULT_SETTINGS = {
  currency:'PKR', mode:'light', doorCalc:'standard',
  woodUnit:'in', invMode:'live', loginLock:false,
  securityPin:'', showCalcFAB:true,
};
const DEFAULT_PROFILE = {
  name:'Timber 360', ownerName:'', address:'', phone:'',
  invoicePrefix:'', footer:'Thank you for your business!', logo:null,
};

export function AppProvider({ children }) {
  const [user,     setUser]     = useState(null);
  const [isGuest,  setIsGuest]  = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  // userPlan: null | 'pending' | 'approved' | 'firebase' | 'blocked' | 'expired'
  const [userPlan,    setUserPlan]    = useState(null);
  const [planExpiry,    setPlanExpiry]    = useState(null); // 'YYYY-MM-DD' or null
  const [isMigrating,  setIsMigrating]  = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState(null); // Admin broadcast message

  const [invoices,  setInvoices]  = useState([]);
  const [customers, setCustomers] = useState([]);
  const [stock,     setStock]     = useState([]);
  const [cheques,   setCheques]   = useState([]);
  const [expenses,  setExpenses]  = useState([]);
  const [logs,      setLogs]      = useState([]);
  const [settings,  setSettings]  = useState(DEFAULT_SETTINGS);
  const [profile,   setProfile]   = useState(DEFAULT_PROFILE);

  const modalRef = useRef({});
  const [isOnline,       setIsOnline]       = useState(true);
  const [syncPending,    setSyncPending]    = useState(0);  // queue میں کتنی operations
  const isSyncing = useRef(false);

  // ── Computed ──────────────────────────────────────────────
  const isAdmin        = user?.uid === ADMIN_UID;
  const isFirebaseMode = !isGuest && user && (userPlan === 'firebase');
  const isLocalMode    = !isGuest && user && (userPlan === 'approved');

  // ── Network status — expo-network سے poll ────────────────
  useEffect(() => {
    let interval = null;
    const checkNet = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        const online = state.isConnected && state.isInternetReachable !== false;
        setIsOnline(prev => {
          // offline → online transition پر queue flush
          if (!prev && online && (isFirebaseMode || isLocalMode)) {
            flushQueue();
          }
          return !!online;
        });
      } catch { /* silent */ }
    };
    checkNet();
    interval = setInterval(checkNet, 5000); // ہر 5 سیکنڈ چیک
    return () => clearInterval(interval);
  }, [isFirebaseMode, isLocalMode]);

  // ── Notification permission + cheque reminders ───────────
  useEffect(() => {
    if (isGuest || !user) return;
    requestNotificationPermission().then(granted => {
      if (granted && cheques.length > 0) {
        scheduleAllChequeReminders(cheques);
      }
    });
  }, [user, isGuest, cheques.length]);

  // ── Plan expiry check helper ───────────────────────────────
  const checkExpiry = (expiry) => {
    if (!expiry) return false;
    const today = new Date().toISOString().split('T')[0];
    return expiry < today; // true = expired
  };

  // ── Guest: AppState background clear + midnight reset ─────────
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    if (!isGuest) return;

    // App background میں جائے تو فوری guest data صاف
    const appSub = AppState.addEventListener('change', nextState => {
      if (appStateRef.current === 'active' && nextState === 'background') {
        clearAllGuest().catch(() => {});
        setInvoices([]); setCustomers([]); setStock([]);
        setCheques([]); setExpenses([]);
      }
      appStateRef.current = nextState;
    });

    // ہر رات 12:00 بجے guest data reset
    const schedMidnight = () => {
      const now  = new Date();
      const next = new Date(now);
      next.setHours(24, 0, 0, 0);
      const ms = next.getTime() - now.getTime();
      return setTimeout(async () => {
        await clearAllGuest();
        setInvoices([]); setCustomers([]); setStock([]);
        setCheques([]); setExpenses([]);
        setSettings(DEFAULT_SETTINGS);
        setProfile(DEFAULT_PROFILE);
        schedMidnight();
      }, ms);
    };
    const midTimer = schedMidnight();

    return () => {
      appSub.remove();
      clearTimeout(midTimer);
    };
  }, [isGuest]);

    // ── Auth listener ─────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
      if (!u) { setUserPlan(null); setPlanExpiry(null); setLoading(false); }
    });
    return unsub;
  }, []);

  // ── userStatus realtime listener ───────────────────────────
  useEffect(() => {
    if (!user || isGuest) return;
    const uid       = user.uid;
    const statusRef = doc(db, 'userStatus', uid);

    const unsub = onSnapshot(statusRef, async (snap) => {
      if (!snap.exists()) {
        // نیا user
        const newStatus = {
          uid, email: user.email || '',
          status:    uid === ADMIN_UID ? 'firebase' : 'pending',
          createdAt: String(Date.now()),
          planExpiry: '',
        };
        await setDoc(statusRef, newStatus);
        setUserPlan(newStatus.status);
        setPlanExpiry('');
      } else {
        const data    = snap.data();
        const expiry  = data.planExpiry || '';
        const expired = expiry && checkExpiry(expiry);

        setPlanExpiry(expiry);

        // Admin ہمیشہ firebase
        if (uid === ADMIN_UID) { setUserPlan('firebase'); return; }

        // Firebase plan expired → واپس approved
        if (data.status === 'firebase' && expired) {
          await setDoc(statusRef, { ...data, status:'approved' }, { merge:true });
          setUserPlan('approved');
        } else {
          setUserPlan(data.status || 'pending');
        }
      }
    }, (err) => {
      console.log('userStatus:', err.message);
      setUserPlan(uid === ADMIN_UID ? 'firebase' : 'pending');
    });

    return unsub;
  }, [user, isGuest]);

  // ── Load local data (approved users) ─────────────────────
  useEffect(() => {
    if (!user || isGuest || userPlan !== 'approved') return;
    const uid = user.uid;
    (async () => {
      const [inv,cust,stk,chq,exp,s,p] = await Promise.all([
        loadUserLocal(uid,'invoices'), loadUserLocal(uid,'customers'),
        loadUserLocal(uid,'stock'),    loadUserLocal(uid,'cheques'),
        loadUserLocal(uid,'expenses'),
        loadUserLocalObject(uid,'settings'), loadUserLocalObject(uid,'profile'),
      ]);
      setInvoices(inv||[]);  setCustomers(cust||[]);
      setStock(stk||[]);     setCheques(chq||[]);
      setExpenses(exp||[]);
      if (s) setSettings({ ...DEFAULT_SETTINGS, ...s });
      if (p) setProfile({ ...DEFAULT_PROFILE,   ...p });
      setLoading(false);
    })();
  }, [user, isGuest, userPlan]);

  // ── Pending users — بس loading ختم کریں ──────────────────
  useEffect(() => {
    if (!user || isGuest || userPlan !== 'pending') return;
    setLoading(false);
  }, [user, isGuest, userPlan]);

  // ── Firebase listeners (firebase plan + admin) ────────────
  useEffect(() => {
    if (!user || isGuest || userPlan !== 'firebase') return;
    const uid   = user.uid;
    const base  = (col) => collection(db, 'users', uid, col);
    const onErr = (col) => (e) => console.log(`${col}:`, e.code || e.message);

    const unsubs = [
      onSnapshot(doc(db,'users',uid,'config','settings'),
        (d) => { if(d.exists()){const s={...DEFAULT_SETTINGS,...d.data()};setSettings(s);if(s.securityPin&&s.loginLock)setIsLocked(true);} }, onErr('settings')),
      onSnapshot(doc(db,'users',uid,'config','profile'),
        (d) => { if(d.exists()) setProfile({...DEFAULT_PROFILE,...d.data()}); }, onErr('profile')),
      onSnapshot(base('invoices'),
        (s) => setInvoices(s.docs.map(d=>d.data()).sort((a,b)=>String(b.id).localeCompare(String(a.id)))), onErr('invoices')),
      onSnapshot(base('stock'),
        (s) => setStock(s.docs.map(d=>d.data())), onErr('stock')),
      onSnapshot(base('customers'),
        (s) => setCustomers(s.docs.map(d=>d.data())), onErr('customers')),
      onSnapshot(base('cheques'),
        (s) => setCheques(s.docs.map(d=>d.data())), onErr('cheques')),
      onSnapshot(base('expenses'),
        (s) => setExpenses(s.docs.map(d=>d.data()).sort((a,b)=>b.date?.localeCompare?.(a.date)||0)), onErr('expenses')),
      onSnapshot(base('logs'),
        (s) => setLogs(s.docs.map(d=>d.data())), onErr('logs')),
    ];

    // ── Broadcast listener (latest unread message) ──────────
    const broadcastUnsub = onSnapshot(
      collection(db, 'broadcasts'),
      (snap) => {
        const msgs = snap.docs.map(d => d.data()).sort((a,b) => Number(b.sentAt||0) - Number(a.sentAt||0));
        const latest = msgs[0];
        if (latest && !latest.read) setBroadcastMsg(latest.message || null);
      },
      (e) => console.log('broadcast:', e.message)
    );

    setLoading(false);
    return () => { unsubs.forEach(u => u()); broadcastUnsub(); };
  }, [user, isGuest, userPlan]);

  // ── Guest login ───────────────────────────────────────────
  const loginGuest = useCallback(async () => {
    const [inv,cust,stk,chq,exp,s,p] = await Promise.all([
      loadGuest('invoices'), loadGuest('customers'), loadGuest('stock'),
      loadGuest('cheques'),  loadGuest('expenses'),
      loadGuestObject('settings'), loadGuestObject('profile'),
    ]);
    setInvoices(inv||[]); setCustomers(cust||[]);
    setStock(stk||[]);    setCheques(chq||[]);
    setExpenses(exp||[]);
    if (s) setSettings({...DEFAULT_SETTINGS,...s});
    if (p) setProfile({...DEFAULT_PROFILE,...p});
    setIsGuest(true); setLoading(false);
  }, []);

  const loginEmail = useCallback(async (e, p) => {
    await signInWithEmailAndPassword(auth, e, p);
  }, []);

  const registerEmail = useCallback(async (email, password, secretQuestion, secretAnswer) => {
    // 1. Firebase Auth account بنائیں
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid  = cred.user.uid;

    // 2. Secret Q&A — email-keyed collection میں store
    // (Forgot password کے لیے — UID جانے بغیر email سے lookup ممکن ہو)
    const emailKey = email.toLowerCase().replace(/[.#$[\]]/g, '_');
    if (secretQuestion && secretAnswer) {
      await setDoc(doc(db, 'userSecrets', emailKey), {
        uid,
        email:          email.toLowerCase(),
        secretQuestion: secretQuestion,
        secretAnswer:   secretAnswer.toLowerCase().trim(),
        createdAt:      String(Date.now()),
      });
    }

    // 3. userStatus
    await setDoc(doc(db, 'userStatus', uid), {
      uid,
      email:          email.toLowerCase(),
      status:         uid === ADMIN_UID ? 'firebase' : 'pending',
      secretQuestion: secretQuestion || '',
      secretAnswer:   secretAnswer ? secretAnswer.toLowerCase().trim() : '',
      createdAt:      String(Date.now()),
      planExpiry:     '',
    });

    // 4. Admin notification — نئے user کی اطلاع
    if (uid !== ADMIN_UID) {
      try {
        await setDoc(doc(db, 'adminNotifications', uid), {
          type:      'new_registration',
          email:     email.toLowerCase(),
          uid,
          createdAt: String(Date.now()),
          read:      false,
          message:   `New user registered: ${email.toLowerCase()}`,
        });
      } catch(e) { /* silent */ }
    }
  }, []);

  const logout = useCallback(async () => {
    if (isGuest) {
      setIsGuest(false);
      setInvoices([]); setCustomers([]); setStock([]);
      setCheques([]); setExpenses([]);
      setSettings(DEFAULT_SETTINGS); setProfile(DEFAULT_PROFILE);
      setLoading(false); return;
    }
    setUserPlan(null); setPlanExpiry(null);
    setInvoices([]); setCustomers([]); setStock([]);
    setCheques([]); setExpenses([]);
    await signOut(auth);
  }, [isGuest]);

  // ── sanitize — undefined + dangerous strings صاف ──────────
  const sanitize = (obj) => {
    if (Array.isArray(obj)) return obj.map(sanitize);
    if (obj !== null && typeof obj === 'object') {
      const clean = {};
      for (const [k,v] of Object.entries(obj)) {
        if (v === undefined) continue;
        clean[k] = sanitize(v);
      }
      return clean;
    }
    if (typeof obj === 'string') {
      // Script injection patterns ہٹائیں
      return obj
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
    }
    return obj;
  };

  // ── flushQueue — internet واپس آنے پر pending ops sync ───
  const flushQueue = useCallback(async () => {
    if (isSyncing.current) return;
    const queue = await getQueue();
    if (queue.length === 0) { setSyncPending(0); return; }

    isSyncing.current = true;
    setSyncPending(queue.length);

    for (const op of queue) {
      try {
        if (op.type === 'save') {
          if (isFirebaseMode && user) {
            await setDoc(doc(db, 'users', user.uid, op.col, op.id), op.data);
          } else if (user) {
            await updateUserLocalItem(user.uid, op.col, op.id, op.data);
          }
        } else if (op.type === 'delete') {
          if (isFirebaseMode && user) {
            await deleteDoc(doc(db, 'users', user.uid, op.col, op.id));
          } else if (user) {
            await deleteUserLocalItem(user.uid, op.col, op.id);
          }
        }
        await removeFromQueue(op.col, op.id, op.type);
      } catch (e) {
        console.log('flushQueue op failed:', e.message);
        break; // اگر ایک fail ہو تو رکو — اگلی بار retry
      }
    }
    const remaining = await getQueue();
    setSyncPending(remaining.length);
    isSyncing.current = false;
  }, [isFirebaseMode, user]);

  // ── saveData ──────────────────────────────────────────────
  const saveData = useCallback(async (col, id, data) => {
    const strId    = String(id);
    const safeData = sanitize(data);

    // Local state فوری update
    const up = (prev) => {
      const idx = prev.findIndex(x => String(x.id) === strId);
      return idx >= 0 ? [...prev.slice(0,idx),safeData,...prev.slice(idx+1)] : [safeData,...prev];
    };
    if (col==='invoices')  setInvoices(up);
    if (col==='customers') setCustomers(up);
    if (col==='stock')     setStock(up);
    if (col==='cheques')   setCheques(up);
    if (col==='expenses')  setExpenses(up);

    // ── Cheque notification: status بدلنے پر ────────────────
    if (col === 'cheques') {
      const oldCheque = cheques.find(c => String(c.id) === strId);
      const newStatus = safeData.status;
      if (oldCheque && newStatus !== oldCheque.status) {
        if (newStatus === 'pending') {
          // نئی یا re-pending cheque — reminder schedule کریں
          scheduleChequeReminder(safeData).catch(() => {});
        } else if (newStatus === 'returned') {
          // Return notification فوری
          notifyChequeReturned(safeData).catch(() => {});
          cancelChequeReminder(strId).catch(() => {});
        } else if (newStatus === 'cleared') {
          // Cleared — reminder cancel کریں
          cancelChequeReminder(strId).catch(() => {});
        }
      } else if (!oldCheque && newStatus === 'pending') {
        // بالکل نیا cheque
        scheduleChequeReminder(safeData).catch(() => {});
      }
    }

    if (isGuest) {
      await updateGuestItem(col, strId, safeData);
    } else if (isFirebaseMode) {
      if (isOnline) {
        try {
          await setDoc(doc(db,'users',user.uid,col,strId), safeData);
          await removeFromQueue(col, strId, 'save');
        } catch (e) {
          // Offline یا error — queue میں ڈالو
          await enqueueOp({ type:'save', col, id:strId, data:safeData });
          setSyncPending(p => p + 1);
        }
      } else {
        // قطعی offline — queue میں
        await enqueueOp({ type:'save', col, id:strId, data:safeData });
        setSyncPending(p => p + 1);
      }
    } else if (user) {
      await updateUserLocalItem(user.uid, col, strId, safeData);
    }
  }, [isGuest, user, isFirebaseMode, isOnline, cheques]);

  // ── deleteData ────────────────────────────────────────────
  const deleteData = useCallback(async (col, id) => {
    const strId = String(id);
    if (col==='invoices')  setInvoices(p  => p.filter(x=>String(x.id)!==strId));
    if (col==='customers') setCustomers(p => p.filter(x=>String(x.id)!==strId));
    if (col==='stock')     setStock(p     => p.filter(x=>String(x.id)!==strId));
    if (col==='cheques')   setCheques(p   => p.filter(x=>String(x.id)!==strId));
    if (col==='expenses')  setExpenses(p  => p.filter(x=>String(x.id)!==strId));

    if (isGuest) {
      await deleteGuestItem(col, strId);
    } else if (isFirebaseMode) {
      if (isOnline) {
        try {
          await deleteDoc(doc(db,'users',user.uid,col,strId));
          await removeFromQueue(col, strId, 'delete');
        } catch (e) {
          await enqueueOp({ type:'delete', col, id:strId, data:null });
          setSyncPending(p => p + 1);
        }
      } else {
        await enqueueOp({ type:'delete', col, id:strId, data:null });
        setSyncPending(p => p + 1);
      }
    } else if (user) {
      await deleteUserLocalItem(user.uid, col, strId);
    }
  }, [isGuest, user, isFirebaseMode, isOnline]);

  // ── saveSettings ──────────────────────────────────────────
  const saveSettings = useCallback(async (s) => {
    setSettings(s);
    if (isGuest) { await saveGuestObject('settings',s); }
    else if (isFirebaseMode) { await setDoc(doc(db,'users',user.uid,'config','settings'),s); }
    else if (user) { await saveUserLocalObject(user.uid,'settings',s); }
  }, [isGuest, user, isFirebaseMode]);

  // ── saveProfile ───────────────────────────────────────────
  const saveProfile = useCallback(async (p) => {
    setProfile(p);
    if (isGuest) { await saveGuestObject('profile',p); }
    else if (isFirebaseMode) { await setDoc(doc(db,'users',user.uid,'config','profile'),p); }
    else if (user) { await saveUserLocalObject(user.uid,'profile',p); }
  }, [isGuest, user, isFirebaseMode]);

  // ── logAction ─────────────────────────────────────────────
  const logAction = useCallback((action) => {
    if (!isFirebaseMode || !user) return;
    const uid        = user.uid;
    const id         = String(Date.now());
    const tenDaysAgo = Date.now() - (10 * 24 * 60 * 60 * 1000);
    setDoc(doc(db,'users',uid,'logs',id), {id, time:id, action, uid}).catch(()=>{});
    // 10 دن سے پرانی entries delete
    getDocs(collection(db,'users',uid,'logs'))
      .then(snap => snap.docs.forEach(d => {
        if (parseInt(d.data().time||'0') < tenDaysAgo) deleteDoc(d.ref).catch(()=>{});
      })).catch(()=>{});
  }, [isFirebaseMode, user]);

  // ════════════════════════════════════════════════════════
  // ── PHASE 2: migrateToFirebase ────────────────────────
  // Local AsyncStorage → Firebase (ایک بار، data loss نہیں)
  // ════════════════════════════════════════════════════════
  const migrateToFirebase = useCallback(async (onProgress) => {
    if (!user || !user.uid) throw new Error('Not logged in');
    const uid = user.uid;

    setIsMigrating(true);
    try {
      // 1. Local data پڑھیں
      onProgress?.('Reading local data...', 5);
      const [inv,cust,stk,chq,exp,s,p] = await Promise.all([
        loadUserLocal(uid,'invoices'), loadUserLocal(uid,'customers'),
        loadUserLocal(uid,'stock'),    loadUserLocal(uid,'cheques'),
        loadUserLocal(uid,'expenses'),
        loadUserLocalObject(uid,'settings'), loadUserLocalObject(uid,'profile'),
      ]);

      const total = (inv?.length||0)+(cust?.length||0)+(stk?.length||0)+(chq?.length||0)+(exp?.length||0);
      let done = 0;

      // 2. writeBatch سے fast upload (Firestore batch = 500 ops max)
      const pushBatch = async (col, items) => {
        if (!items?.length) return;
        const chunks = [];
        for (let i=0; i<items.length; i+=400) chunks.push(items.slice(i,i+400));
        for (const chunk of chunks) {
          const batch = writeBatch(db);
          chunk.forEach(item => {
            if (!item?.id) return;
            batch.set(doc(db,'users',uid,col,String(item.id)), sanitize(item));
          });
          await batch.commit();
          done += chunk.length;
          onProgress?.(`Uploading ${col}... (${done}/${total})`, Math.round(10+(done/Math.max(total,1))*80));
        }
      };

      onProgress?.('Uploading invoices...', 15);  await pushBatch('invoices', inv);
      onProgress?.('Uploading customers...', 35); await pushBatch('customers', cust);
      onProgress?.('Uploading stock...', 50);     await pushBatch('stock', stk);
      onProgress?.('Uploading cheques...', 65);   await pushBatch('cheques', chq);
      onProgress?.('Uploading expenses...', 75);  await pushBatch('expenses', exp);

      // 3. Settings + Profile
      onProgress?.('Saving settings...', 85);
      if (s) await setDoc(doc(db,'users',uid,'config','settings'), sanitize({...DEFAULT_SETTINGS,...s}));
      if (p) await setDoc(doc(db,'users',uid,'config','profile'),  sanitize({...DEFAULT_PROFILE,...p}));

      // 4. userStatus → firebase
      onProgress?.('Activating Firebase...', 95);
      await setDoc(doc(db,'userStatus',uid), {
        status:      'firebase',
        migratedAt:  String(Date.now()),
        firebaseAt:  String(Date.now()),
      }, { merge:true });

      onProgress?.('Done!', 100);
      // userPlan onSnapshot سے خودبخود update ہوگا

    } finally {
      setIsMigrating(false);
    }
  }, [user, sanitize]);

  // ── Backup / Restore / Reset ──────────────────────────────
  const handleBackup = useCallback(() => {
    return JSON.stringify({invoices,customers,stock,cheques,expenses,settings,profile,backupDate:new Date().toISOString()},null,2);
  },[invoices,customers,stock,cheques,expenses,settings,profile]);

  const handleRestore = useCallback(async (jsonString) => {
    try {
      const data = JSON.parse(jsonString);
      if (!data.invoices && !data.customers) return false;
      for (const inv  of (data.invoices  ||[])) await saveData('invoices',  inv.id,  inv);
      for (const cust of (data.customers ||[])) await saveData('customers', cust.id, cust);
      for (const s    of (data.stock     ||[])) await saveData('stock',     s.id,    s);
      for (const chq  of (data.cheques   ||[])) await saveData('cheques',   chq.id,  chq);
      for (const exp  of (data.expenses  ||[])) await saveData('expenses',  exp.id,  exp);
      if (data.settings) await saveSettings(data.settings);
      if (data.profile)  await saveProfile(data.profile);
      return true;
    } catch { return false; }
  },[saveData,saveSettings,saveProfile]);

  const handleFactoryReset = useCallback(async () => {
    if (isGuest) { await clearAllGuest(); }
    else if (isFirebaseMode && user) {
      const base = (col) => collection(db,'users',user.uid,col);
      for (const col of ['invoices','customers','stock','cheques','expenses','logs']) {
        const snap = await getDocs(base(col));
        for (const d of snap.docs) await deleteDoc(d.ref);
      }
    } else if (user) {
      for (const col of ['invoices','customers','stock','cheques','expenses']) {
        await saveUserLocal(user.uid, col, []);
      }
    }
    setInvoices([]); setCustomers([]); setStock([]);
    setCheques([]); setExpenses([]);
    await saveSettings(DEFAULT_SETTINGS);
    await saveProfile(DEFAULT_PROFILE);
  },[isGuest,isFirebaseMode,user,saveSettings,saveProfile]);

  // ── Order Tracking ───────────────────────────────────────────
  const createTracking = useCallback(async (invoice, profileData) => {
    if (!user || isGuest || !isFirebaseMode) return; // صرف Firebase users
    const tid = String(invoice.id);
    const record = {
      invoiceId:      tid,
      customerId:     String(invoice.customer?.id || ''),
      customerName:   invoice.customer?.name   || '',
      customerMobile: invoice.customer?.mobile || '',
      invoiceTotal:   safeParseAmount(invoice.total),
      status:         'pending',
      statusHistory:  [{
        status: 'pending',
        note:   'Order received',
        time:   String(Date.now()),
      }],
      bizName:   profileData?.name  || 'Timber 360',
      bizPhone:  profileData?.phone || '',
      createdAt: String(Date.now()),
      closedAt:  null,
      expiresAt: null,
    };
    try {
      await setDoc(doc(db, 'tracking', tid), record);
    } catch(e) { console.log('tracking create:', e.message); }
  }, [user, isGuest]);

  const updateTracking = useCallback(async (invoiceId, newStatus, note) => {
    if (!user || isGuest || !isFirebaseMode) return;
    const tid = String(invoiceId);
    try {
      const snap = await getDoc(doc(db, 'tracking', tid));
      const current = snap.exists() ? snap.data() : null;
      const histEntry = { status: newStatus, note: note||'', time: String(Date.now()) };
      const history = current ? [...(current.statusHistory||[]), histEntry] : [histEntry];
      const isClosing = newStatus === 'closed';
      const closedAt  = isClosing ? String(Date.now()) : (current?.closedAt || null);
      // 7 دن بعد expire
      const expiresAt = isClosing
        ? String(Date.now() + 7*24*60*60*1000)
        : (current?.expiresAt || null);
      await setDoc(doc(db,'tracking',tid), {
        ...(current||{}),
        status: newStatus,
        statusHistory: history,
        closedAt,
        expiresAt,
      }, { merge:true });
    } catch(e) { console.log('tracking update:', e.message); }
  }, [user, isGuest]);

  const getTracking = useCallback(async (invoiceId) => {
    if (!user || isGuest || !isFirebaseMode) return null;
    try {
      const snap = await getDoc(doc(db,'tracking',String(invoiceId)));
      return snap.exists() ? snap.data() : null;
    } catch(e) { return null; }
  }, [user, isGuest]);

  // ── getStats ──────────────────────────────────────────────
  const getStats = useCallback(() => {
    const today      = new Date().toDateString();
    const todaySales = invoices.filter(i=>new Date(i.date).toDateString()===today).reduce((a,b)=>a+safeParseAmount(b.total),0);
    const todayCount = invoices.filter(i=>new Date(i.date).toDateString()===today).length;
    const balance    = customers.reduce((a,c)=>{
      const {finalBalance} = calculateLedgerBalance(c.ledger,{useEffective:true});
      return a+(finalBalance>0?finalBalance:0);
    },0);
    return {todaySales,todayCount,balance};
  },[invoices,customers]);

  // ── Modal helpers ─────────────────────────────────────────
  const showAlert = useCallback((msg,title='Alert') =>
    new Promise(resolve => {
      if (typeof modalRef.current?.alert === 'function') {
        modalRef.current.alert({msg,title,onOk:resolve});
      } else {
        Alert.alert(title,msg,[{text:'OK',onPress:resolve}]);
      }
    }),[]);

  const showConfirm = useCallback((msg,title='Confirm') =>
    new Promise(resolve => {
      if (typeof modalRef.current?.confirm === 'function') {
        modalRef.current.confirm({msg,title,onOk:()=>resolve(true),onCancel:()=>resolve(false)});
      } else {
        Alert.alert(title,msg,[
          {text:'Cancel',onPress:()=>resolve(false),style:'cancel'},
          {text:'OK',    onPress:()=>resolve(true) },
        ]);
      }
    }),[]);

  const showPrompt = useCallback((msg,def='',title='Input') =>
    new Promise(resolve => {
      if (typeof modalRef.current?.prompt === 'function') {
        modalRef.current.prompt({msg,title,def,onOk:resolve,onCancel:()=>resolve(null)});
      } else { resolve(null); }
    }),[]);

  const value = {
    user, isGuest, loading, isLocked, setIsLocked,
    userPlan, planExpiry, isAdmin, isFirebaseMode, isLocalMode, isMigrating,
    loginGuest, loginEmail, registerEmail, logout,
    settings, setSettings: saveSettings,
    profile,  setProfile:  saveProfile,
    invoices, customers, stock, cheques, expenses, logs,
    setInvoices, setCustomers,
    saveData, deleteData, logAction, getStats,
    handleBackup, handleRestore, handleFactoryReset,
    broadcastMsg, setBroadcastMsg,
    createTracking, updateTracking, getTracking,
    migrateToFirebase,
    showAlert, showConfirm, showPrompt,
    isOnline, syncPending, flushQueue,
    _modalRef: modalRef,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
