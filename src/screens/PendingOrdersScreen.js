// ── PendingOrdersScreen — Pending Orders + Tracking Update ──
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { FadeSlideIn, ScalePress } from '../components/ui/Animated';
import { COLORS, SPACING, RADIUS, FONT, SHADOW } from '../utils/theme';
import { formatMoney, formatDate } from '../utils/helpers';
import { safeParseAmount } from '../utils/ledger';
import { collection, getDocs, doc, setDoc, getDoc, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';

const STATUSES = [
  { key:'pending',    label:'Order Received',   color:'#64748b', bg:'#f1f5f9', icon:'📥' },
  { key:'processing', label:'In Production',    color:'#d97706', bg:'#fffbeb', icon:'⚙️'  },
  { key:'ready',      label:'Ready',            color:'#0891b2', bg:'#ecfeff', icon:'✅' },
  { key:'dispatched', label:'Dispatched',       color:'#7c3aed', bg:'#f5f3ff', icon:'🚚' },
  { key:'delivered',  label:'Delivered',        color:'#16a34a', bg:'#f0fdf4', icon:'🏠' },
  { key:'closed',     label:'Closed',           color:'#166534', bg:'#dcfce7', icon:'🔒' },
];

export default function PendingOrdersScreen() {
  const navigation = useNavigation();
  const { invoices, customers, settings, isFirebaseMode, user,
          updateTracking, getTracking, showAlert, showConfirm } = useApp();

  const dark    = settings.mode === 'dark';
  const bg      = dark ? COLORS.bgDark     : '#f8fafc';
  const card    = dark ? COLORS.surfaceDark : COLORS.white;
  const text    = dark ? COLORS.textDark   : COLORS.textLight;
  const sub     = dark ? COLORS.slate400   : COLORS.slate500;
  const brd     = dark ? COLORS.borderDark : COLORS.borderLight;

  const [trackingMap, setTrackingMap] = useState({});
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [filterStatus,setFilterStatus]= useState('all');  // all|active|closed
  const [updatingId,  setUpdatingId]  = useState(null);
  const [noteMap,     setNoteMap]     = useState({});
  const [selectedStatus, setSelectedStatus] = useState({});

  const loadTracking = useCallback(async () => {
    if (!isFirebaseMode || !user) { setLoading(false); return; }
    try {
      const snap = await getDocs(collection(db,'tracking'));
      const map = {};
      snap.docs.forEach(d => { map[d.id] = d.data(); });
      setTrackingMap(map);
    } catch(e) { console.log('loadTracking:', e.message); }
    setLoading(false);
    setRefreshing(false);
  }, [isFirebaseMode, user]);

  useEffect(() => { loadTracking(); }, []);

  const onRefresh = () => { setRefreshing(true); loadTracking(); };

  // Active invoices = closed نہیں
  const activeInvoices = [...invoices]
    .sort((a,b) => String(b.id).localeCompare(String(a.id)))
    .filter(inv => {
      const t = trackingMap[String(inv.id)];
      if (filterStatus === 'closed')  return t?.status === 'closed';
      if (filterStatus === 'active')  return !t || t.status !== 'closed';
      return true;
    });

  const handleUpdate = async (inv) => {
    const invId    = String(inv.id);
    const newSt    = selectedStatus[invId];
    const note     = noteMap[invId] || '';
    if (!newSt) { await showAlert('Please select a status first', 'Required'); return; }
    setUpdatingId(invId);
    await updateTracking(invId, newSt, note);
    await loadTracking();
    setNoteMap(p => ({ ...p, [invId]:'' }));
    setSelectedStatus(p => ({ ...p, [invId]: null }));
    setUpdatingId(null);
  };

  if (!isFirebaseMode) {
    return (
      <View style={[styles.root,{backgroundColor:bg}]}>
        <View style={[styles.header,{backgroundColor:COLORS.slate800}]}>
          <Text style={{color:'#fff',fontWeight:'700'}}>Pending Orders</Text>
          <View style={{width:60}}/>
        </View>
        <View style={{flex:1,justifyContent:'center',alignItems:'center',padding:SPACING.xl}}>
          <Text style={{fontSize:40}}>🔒</Text>
          <Text style={{color:text,fontWeight:'800',fontSize:FONT.lg,marginTop:SPACING.md,textAlign:'center'}}>
            Firebase Plan Required
          </Text>
          <Text style={{color:sub,fontSize:FONT.sm,marginTop:SPACING.sm,textAlign:'center',lineHeight:22}}>
            Order tracking is available for Firebase plan users only.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root,{backgroundColor:bg}]}>
      {/* Header */}
      <View style={[styles.header,{backgroundColor:COLORS.slate800}]}>
        <Text style={{color:'#fff',fontWeight:'700',fontSize:FONT.base}}>
          📦 Pending Orders
        </Text>
        <TouchableOpacity onPress={onRefresh} hitSlop={{top:8,bottom:8,left:8,right:8}}>
          <Text style={{color:'#fff',fontSize:FONT.sm}}>🔄</Text>
        </TouchableOpacity>
      </View>

      {/* Filter tabs */}
      <View style={{flexDirection:'row',backgroundColor:card,borderBottomWidth:1,borderBottomColor:brd}}>
        {[
          {key:'all',    label:'All'},
          {key:'active', label:'Active'},
          {key:'closed', label:'Closed'},
        ].map(f=>(
          <TouchableOpacity
            key={f.key}
            style={{flex:1,paddingVertical:SPACING.md,alignItems:'center',
              borderBottomWidth:2,borderBottomColor:filterStatus===f.key?COLORS.primary:'transparent'}}
            onPress={()=>setFilterStatus(f.key)}
          >
            <Text style={{fontWeight:'700',fontSize:FONT.sm,
              color:filterStatus===f.key?COLORS.primary:sub}}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={{flex:1,justifyContent:'center',alignItems:'center'}}>
          <ActivityIndicator color={COLORS.primary} size="large"/>
          <Text style={{color:sub,marginTop:SPACING.md}}>Loading orders...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{padding:SPACING.md,paddingBottom:80}}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary}/>}
        >
          {activeInvoices.length === 0 ? (
            <View style={{alignItems:'center',marginTop:60}}>
              <Text style={{fontSize:48}}>🎉</Text>
              <Text style={{color:sub,marginTop:SPACING.md,fontWeight:'700'}}>
                {filterStatus==='closed' ? 'No closed orders' : 'No pending orders!'}
              </Text>
            </View>
          ) : activeInvoices.map(inv => {
            const invId    = String(inv.id);
            const tracking = trackingMap[invId];
            const curSt    = STATUSES.find(s=>s.key===(tracking?.status||'pending'))||STATUSES[0];
            const cust     = customers.find(c=>String(c.id)===String(inv.customer?.id));
            const isClosed = tracking?.status === 'closed';
            const selSt    = selectedStatus[invId];

            return (
              <FadeSlideIn key={invId}>
                <View style={[styles.orderCard,{backgroundColor:card,borderColor:brd,
                  borderLeftColor:curSt.color,borderLeftWidth:4}]}>
                  {/* Invoice Info */}
                  <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:SPACING.sm}}>
                    <View style={{flex:1}}>
                      <Text style={{color:text,fontWeight:'800',fontSize:FONT.base}}>
                        #{inv.id} — {inv.customer?.name}
                      </Text>
                      <Text style={{color:sub,fontSize:FONT.xs,marginTop:2}}>
                        📅 {formatDate(inv.date)} • {formatMoney(safeParseAmount(inv.total),settings.currency)}
                      </Text>
                      {inv.customer?.mobile ? (
                        <Text style={{color:sub,fontSize:FONT.xs}}>📱 {inv.customer.mobile}</Text>
                      ) : null}
                    </View>
                    {/* Current status badge */}
                    <View style={[styles.statusBadge,{backgroundColor:curSt.bg}]}>
                      <Text style={{fontSize:16}}>{curSt.icon}</Text>
                      <Text style={{color:curSt.color,fontSize:9,fontWeight:'800',marginTop:2,textAlign:'center'}}>
                        {curSt.label}
                      </Text>
                    </View>
                  </View>

                  {/* QR + View buttons */}
                  <View style={{flexDirection:'row',gap:SPACING.sm,marginBottom:SPACING.md}}>
                    <TouchableOpacity
                      style={[styles.miniBtn,{backgroundColor:'#0891b2',flex:1}]}
                      onPress={()=>navigation.navigate('OrderTracking',{invoice:inv})}
                    >
                      <Text style={{color:'#fff',fontSize:FONT.xs,fontWeight:'700'}}>📱 QR Code</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.miniBtn,{backgroundColor:COLORS.slate700,flex:1}]}
                      onPress={()=>navigation.navigate('InvoiceView',{invoice:inv})}
                    >
                      <Text style={{color:'#fff',fontSize:FONT.xs,fontWeight:'700'}}>🧾 Invoice</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Status update — closed orders میں نہیں */}
                  {!isClosed && (
                    <View style={{borderTopWidth:1,borderTopColor:brd,paddingTop:SPACING.md}}>
                      <Text style={{color:sub,fontSize:FONT.xs,fontWeight:'700',textTransform:'uppercase',marginBottom:SPACING.sm}}>
                        Update Status
                      </Text>
                      {/* Status radio buttons */}
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:SPACING.sm}}>
                        {STATUSES.filter(s=>s.key!==tracking?.status).map(s=>(
                          <TouchableOpacity
                            key={s.key}
                            style={[styles.stChip,{
                              backgroundColor:selSt===s.key?s.bg:card,
                              borderColor:selSt===s.key?s.color:brd,
                            }]}
                            onPress={()=>setSelectedStatus(p=>({...p,[invId]:s.key}))}
                          >
                            <Text style={{fontSize:12}}>{s.icon}</Text>
                            <Text style={{fontSize:9,fontWeight:'700',color:selSt===s.key?s.color:sub,marginTop:2}}>
                              {s.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>

                      {/* Note field */}
                      <TextInput
                        value={noteMap[invId]||''}
                        onChangeText={v=>setNoteMap(p=>({...p,[invId]:v}))}
                        placeholder="Note (optional)..."
                        placeholderTextColor={sub}
                        style={[styles.noteInput,{color:text,borderColor:brd,backgroundColor:bg}]}
                      />

                      <TouchableOpacity
                        style={[styles.updateBtn,{
                          backgroundColor:selSt&&updatingId!==invId?COLORS.primary:COLORS.slate300,
                          opacity:updatingId===invId?0.7:1,
                        }]}
                        onPress={()=>handleUpdate(inv)}
                        disabled={!selSt || updatingId===invId}
                      >
                        {updatingId===invId ? (
                          <ActivityIndicator color="#fff" size="small"/>
                        ) : (
                          <Text style={{color:'#fff',fontWeight:'700',fontSize:FONT.sm}}>
                            {selSt ? `✅ Set to "${STATUSES.find(s=>s.key===selSt)?.label}"` : 'Select a status above'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Last update time */}
                  {tracking?.statusHistory?.length > 0 && (
                    <Text style={{color:sub,fontSize:9,marginTop:SPACING.xs}}>
                      Last update: {formatDate(new Date(parseInt(tracking.statusHistory[tracking.statusHistory.length-1].time||Date.now())).toISOString())}
                    </Text>
                  )}
                </View>
              </FadeSlideIn>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:       { flex:1 },
  header:     { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:SPACING.md, paddingTop:SPACING.lg },
  orderCard:  { borderRadius:RADIUS.xl, padding:SPACING.lg, marginBottom:SPACING.md, borderWidth:1, ...SHADOW.sm },
  statusBadge:{ alignItems:'center', padding:SPACING.sm, borderRadius:RADIUS.lg, minWidth:68 },
  miniBtn:    { paddingVertical:SPACING.sm, borderRadius:RADIUS.lg, alignItems:'center', justifyContent:'center' },
  stChip:     { alignItems:'center', padding:SPACING.sm, borderRadius:RADIUS.lg, borderWidth:1.5, marginRight:SPACING.sm, minWidth:70 },
  noteInput:  { borderWidth:1, borderRadius:RADIUS.md, paddingHorizontal:SPACING.md, paddingVertical:SPACING.sm, fontSize:FONT.sm, marginBottom:SPACING.sm },
  updateBtn:  { padding:SPACING.md, borderRadius:RADIUS.lg, alignItems:'center' },
});
