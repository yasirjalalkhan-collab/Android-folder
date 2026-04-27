// ── StockScreen — مکمل fix (Custom tab + ItemIcon + fast save) ─
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  StyleSheet, ScrollView, Dimensions,
} from 'react-native';
import { useApp } from '../context/AppContext';
import AppButton from '../components/ui/AppButton';
import { FadeSlideIn } from '../components/ui/Animated';
import { COLORS, SPACING, RADIUS, FONT, SHADOW } from '../utils/theme';
import { formatMoney } from '../utils/helpers';
import { ITEM_TYPES, TYPE_DOOR, TYPE_SKIN, TYPE_PLYWOOD, TYPE_WOOD } from '../utils/calculations';
import InlineItemEntry from '../components/invoice/InlineItemEntry';

const TYPE_CUSTOM = 'custom';

const STOCK_TABS = [
  { id: TYPE_DOOR,    label: 'Door'   },
  { id: TYPE_SKIN,    label: 'Skins'  },
  { id: TYPE_PLYWOOD, label: 'Ply'    },
  { id: TYPE_WOOD,    label: 'Wood'   },
  { id: TYPE_CUSTOM,  label: 'Custom' },
];

const TAB_CONFIG = {
  [TYPE_DOOR]:    { bg:'#dcfce7', fg:'#166534', activeBg:'#166534' },
  [TYPE_SKIN]:    { bg:'#dbeafe', fg:'#1e40af', activeBg:'#1e40af' },
  [TYPE_PLYWOOD]: { bg:'#ede9fe', fg:'#5b21b6', activeBg:'#5b21b6' },
  [TYPE_WOOD]:    { bg:'#fef3c7', fg:'#92400e', activeBg:'#92400e' },
  [TYPE_CUSTOM]:  { bg:'#fee2e2', fg:'#991b1b', activeBg:'#991b1b' },
};

const SW     = Dimensions.get('window').width;
const PAD    = SPACING.md;
const GAP    = SPACING.sm;
const CARD_2 = Math.floor((SW - PAD * 2 - GAP)     / 2);
const CARD_3 = Math.floor((SW - PAD * 2 - GAP * 2) / 3);

function ItemIcon({ type, name, size = 40 }) {
  const cfg    = TAB_CONFIG[type] || { bg:'#f1f5f9', fg:'#334155' };
  const letter = ((name || '?')[0]).toUpperCase();
  return (
    <View style={{
      width: size, height: size,
      borderRadius: Math.round(size * 0.28),
      backgroundColor: cfg.bg,
      justifyContent: 'center', alignItems: 'center',
    }}>
      <Text style={{ color:cfg.fg, fontWeight:'900', fontSize:Math.round(size * 0.46) }}>
        {letter}
      </Text>
    </View>
  );
}

export default function StockScreen() {
  const { stock, settings, saveData, deleteData, showConfirm } = useApp();
  const dark   = settings.mode === 'dark';
  const bg     = dark ? COLORS.bgDark      : '#f8fafc';
  const card   = dark ? COLORS.surfaceDark  : COLORS.white;
  const text   = dark ? COLORS.textDark    : COLORS.textLight;
  const sub    = dark ? COLORS.slate400    : COLORS.slate500;
  const border = dark ? COLORS.borderDark  : COLORS.borderLight;

  const [view,         setView]         = useState('list');
  const [tab,          setTab]          = useState(TYPE_DOOR);
  const [editingItem,  setEditingItem]  = useState(null);
  const [batch,        setBatch]        = useState([]);
  const [searchTerm,   setSearchTerm]   = useState('');
  const [openedFolder, setOpenedFolder] = useState(null);
  const [mainView,     setMainView]     = useState('compact');
  const [folderView,   setFolderView]   = useState('compact');

  // stock state change ہونے پر openedFolder sync کریں
  useEffect(() => {
    if (!openedFolder) return;
    const updated = stock.find(s =>
      (s.name||'').trim() === (openedFolder.name||'').trim() && s.type === openedFolder.type
    );
    if (!updated) return;
    // folder کے items re-build
    const items = stock.filter(s =>
      (s.name||'').trim() === (openedFolder.name||'').trim() && s.type === openedFolder.type
    );
    const totalQty = items.reduce((a,x) => a+(parseFloat(x.qty)||0), 0);
    setOpenedFolder(prev => prev ? { ...prev, items, totalQty } : null);
  }, [stock]);

  const addToBatch = (item) =>
    setBatch(prev => [...prev, { ...item, tempId:String(Date.now()+Math.random()), type:tab }]);

  const removeFromBatch = (tempId) =>
    setBatch(prev => prev.filter(b => b.tempId !== tempId));

  const handleFinishSave = async () => {
    if (batch.length === 0) { setView('list'); return; }
    // فوری list view پر جائیں
    const pendingBatch = [...batch];
    setBatch([]); setView('list');
    // Background میں save
    Promise.all(pendingBatch.map(newItem => {
      const existing = stock.find(s =>
        (s.name||'').toLowerCase() === (newItem.name||'').toLowerCase() &&
        s.displaySize === newItem.displaySize && s.type === newItem.type
      );
      if (existing) {
        const updQty = (parseFloat(existing.qty)||0) + (parseFloat(newItem.qty)||0);
        return saveData('stock', existing.id, { ...existing, qty:updQty });
      } else {
        const id = String(Date.now()) + String(Math.random()).slice(2,6);
        return saveData('stock', id, { ...newItem, id });
      }
    }));
  };

  const typeItems = stock.filter(s =>
    s.type === tab && (s.name||'').toLowerCase().includes(searchTerm.toLowerCase())
  );
  const grouped = {};
  typeItems.forEach(item => {
    const k = (item.name||'').trim();
    if (!grouped[k]) grouped[k] = { name:k, totalQty:0, variations:0, items:[] };
    grouped[k].items.push(item);
    grouped[k].totalQty  += parseFloat(item.qty)||0;
    grouped[k].variations += 1;
  });
  const groupsArr = Object.values(grouped);

  const ViewToggles = ({ current, onChange }) => (
    <View style={{ flexDirection:'row', gap:4 }}>
      {[{ v:'list', label:'☰' }, { v:'compact', label:'⊟' }, { v:'grid', label:'⊞' }].map(opt => (
        <TouchableOpacity
          key={opt.v}
          style={[styles.viewBtn, { backgroundColor: current===opt.v ? COLORS.primary : (dark?COLORS.slate700:COLORS.slate100) }]}
          onPress={() => onChange(opt.v)}
        >
          <Text style={{ fontSize:16, color: current===opt.v ? COLORS.white : (dark?COLORS.textDark:COLORS.slate600) }}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ══════════════════════════════════════════
  // ADD VIEW
  // ══════════════════════════════════════════
  if (view === 'add') return (
    <View style={[styles.root, { backgroundColor:bg }]}>
      <View style={[styles.header, { backgroundColor:card, borderBottomColor:border }]}>
        <TouchableOpacity onPress={() => { setView('list'); setBatch([]); }}>
          <Text style={{ color:COLORS.primary, fontSize:22 }}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color:text }]}>
          Add — {STOCK_TABS.find(t => t.id===tab)?.label}
        </Text>
        <View style={{ width:60 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding:PAD, paddingBottom:120 }} keyboardShouldPersistTaps="handled">
        <View style={[styles.entryCard, { backgroundColor:card }]}>
          <InlineItemEntry onAdd={addToBatch} settings={{ ...settings, invMode:'live' }} stock={stock} clearAfterAdd={true} />
        </View>
        <View style={[styles.batchBox, { backgroundColor:card, borderColor:border }]}>
          <Text style={[styles.batchLabel, { color:sub }]}>Pending Items ({batch.length})</Text>
          {batch.length === 0 ? (
            <Text style={{ color:COLORS.slate400, textAlign:'center', padding:SPACING.xl, fontSize:FONT.sm }}>
              Items you add will appear here...
            </Text>
          ) : batch.map(b => (
            <View key={b.tempId} style={[styles.batchRow, { borderBottomColor:border }]}>
              <ItemIcon type={b.type} name={b.name} size={32} />
              <View style={{ flex:1, marginLeft:SPACING.sm }}>
                <Text style={{ color:text, fontWeight:'700', fontSize:FONT.sm }}>{b.name}</Text>
                <Text style={{ color:sub, fontSize:FONT.xs }}>
                  {b.displaySize} | Qty: {b.qty}{b.costRate ? `  | Cost: ${b.costRate}` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => removeFromBatch(b.tempId)} style={{ padding:SPACING.sm }}>
                <Text style={{ color:COLORS.danger, fontWeight:'700', fontSize:FONT.md }}>x</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
        <AppButton onPress={handleFinishSave} disabled={batch.length===0} style={{ marginTop:SPACING.md }}>
          Save All ({batch.length})
        </AppButton>
      </ScrollView>
    </View>
  );

  // ══════════════════════════════════════════
  // FOLDER DETAIL VIEW
  // ══════════════════════════════════════════
  if (openedFolder) {
    const refreshFolder = (deletedId, deletedQty) => {
      setOpenedFolder(prev => {
        if (!prev) return null;
        const items    = prev.items.filter(x => x.id !== deletedId);
        const totalQty = items.reduce((a,x) => a+(parseFloat(x.qty)||0), 0);
        return { ...prev, items, totalQty };
      });
    };
    const updateFolderItem = (updItem) => {
      setOpenedFolder(prev => {
        if (!prev) return null;
        const items    = prev.items.map(x => x.id===updItem.id ? updItem : x);
        const totalQty = items.reduce((a,x) => a+(parseFloat(x.qty)||0), 0);
        return { ...prev, items, totalQty };
      });
    };

    return (
      <View style={[styles.root, { backgroundColor:bg }]}>
        <View style={[styles.header, { backgroundColor:card, borderBottomColor:border }]}>
          <TouchableOpacity onPress={() => { setOpenedFolder(null); setEditingItem(null); }}>
            <Text style={{ color:COLORS.primary, fontSize:22 }}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex:1, marginHorizontal:SPACING.md }}>
            <Text style={[styles.headerTitle, { color:text }]} numberOfLines={1}>{openedFolder.name}</Text>
            <Text style={{ color:sub, fontSize:FONT.xs }}>{openedFolder.totalQty} units • {openedFolder.variations} sizes</Text>
          </View>
          <ViewToggles current={folderView} onChange={v => { setFolderView(v); setEditingItem(null); }} />
        </View>

        <ScrollView contentContainerStyle={{ padding:PAD, paddingBottom:80 }}>

          {/* LIST */}
          {folderView==='list' && openedFolder.items.map((s, i) => {
            const qty=parseFloat(s.qty)||0, isLow=qty<5, isEditing=editingItem?.id===s.id;
            return (
              <FadeSlideIn key={s.id} delay={i*20}>
                <View style={[styles.listItem, { backgroundColor:card, borderColor:isEditing?COLORS.primary:(isLow?COLORS.warning:border), flexDirection:'column', alignItems:'stretch' }]}>
                  <View style={{ flexDirection:'row', alignItems:'center' }}>
                    <ItemIcon type={tab} name={s.displaySize||s.name} size={38} />
                    <View style={{ flex:1, marginLeft:SPACING.sm }}>
                      <Text style={{ color:text, fontWeight:'600', fontSize:FONT.sm }}>{s.displaySize||s.name}</Text>
                      {(s.rate||s.costRate) ? (
                        <Text style={{ color:sub, fontSize:FONT.xs }}>
                          {s.rate?`Rate: ${formatMoney(s.rate,settings.currency)}`:''}
                          {s.costRate?`  Cost: ${formatMoney(s.costRate,settings.currency)}`:''}
                        </Text>
                      ) : null}
                    </View>
                    <View style={[styles.qtyPill, { backgroundColor:isLow?'#fff7ed':'#f0fdf4' }]}>
                      <Text style={{ color:isLow?COLORS.warning:COLORS.success, fontWeight:'800', fontSize:FONT.sm }}>{s.qty}</Text>
                    </View>
                    <TouchableOpacity style={styles.actionBtn}
                      onPress={() => setEditingItem(isEditing?null:{ id:s.id, qty:String(s.qty||''), rate:String(s.rate||''), costRate:String(s.costRate||'') })}>
                      <Text style={{ fontSize:FONT.xs, color:isEditing?COLORS.danger:COLORS.info, fontWeight:'700' }}>{isEditing?'Close':'Edit'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn}
                      onPress={async()=>{ const ok=await showConfirm('Delete this item?','Confirm'); if(ok){await deleteData('stock',s.id);refreshFolder(s.id,s.qty);} }}>
                      <Text style={{ fontSize:FONT.xs, color:COLORS.danger, fontWeight:'700' }}>Del</Text>
                    </TouchableOpacity>
                  </View>
                  {isEditing && (
                    <View style={{ marginTop:SPACING.sm, paddingTop:SPACING.sm, borderTopWidth:1, borderTopColor:border, flexDirection:'row', gap:GAP, alignItems:'flex-end' }}>
                      {[{label:'Qty',key:'qty',bc:COLORS.primary},{label:'Rate',key:'rate',bc:border},{label:'Cost',key:'costRate',bc:'#FCD34D'}].map(f=>(
                        <View key={f.key} style={{ flex:1 }}>
                          <Text style={{ color:sub, fontSize:10, marginBottom:3 }}>{f.label}</Text>
                          <TextInput value={editingItem[f.key]} onChangeText={v=>setEditingItem(p=>({...p,[f.key]:v}))} keyboardType="numeric"
                            style={{ borderWidth:1.5, borderColor:f.bc, borderRadius:RADIUS.sm, padding:SPACING.xs, color:text, fontSize:FONT.sm, backgroundColor:bg }} />
                        </View>
                      ))}
                      <TouchableOpacity
                        style={{ backgroundColor:COLORS.primary, paddingHorizontal:SPACING.md, paddingVertical:SPACING.sm, borderRadius:RADIUS.md, marginBottom:1 }}
                        onPress={async()=>{
                          const upd={...s, qty:parseFloat(editingItem.qty)||0, rate:parseFloat(editingItem.rate)||0, costRate:parseFloat(editingItem.costRate)||0};
                          await saveData('stock',s.id,upd); updateFolderItem(upd); setEditingItem(null);
                        }}>
                        <Text style={{ color:COLORS.white, fontWeight:'700', fontSize:FONT.sm }}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </FadeSlideIn>
            );
          })}

          {/* COMPACT */}
          {folderView==='compact' && (
            <View style={{ flexDirection:'row', flexWrap:'wrap', gap:GAP }}>
              {openedFolder.items.map((s,i)=>{
                const qty=parseFloat(s.qty)||0, isLow=qty<5;
                return (
                  <FadeSlideIn key={s.id} delay={i*20}>
                    <View style={[styles.compactCard,{width:CARD_2,backgroundColor:card,borderColor:isLow?COLORS.warning:border}]}>
                      <ItemIcon type={tab} name={s.displaySize||s.name} size={34} />
                      <Text style={{color:text,fontWeight:'700',fontSize:FONT.sm,textAlign:'center',marginTop:6}} numberOfLines={2}>{s.displaySize||s.name}</Text>
                      {s.rate?<Text style={{color:sub,fontSize:10,textAlign:'center',marginTop:2}}>{formatMoney(s.rate,settings.currency)}</Text>:null}
                      <View style={[styles.qtyBadge,{backgroundColor:isLow?'#fff7ed':'#f0fdf4'}]}>
                        <Text style={{color:isLow?COLORS.warning:COLORS.success,fontWeight:'900',fontSize:FONT.xl}}>{s.qty}</Text>
                      </View>
                      <TouchableOpacity style={{marginTop:SPACING.sm,paddingVertical:4}}
                        onPress={async()=>{const ok=await showConfirm('Delete?','Confirm');if(ok){await deleteData('stock',s.id);refreshFolder(s.id,s.qty);}}}>
                        <Text style={{color:COLORS.danger,fontSize:FONT.xs,fontWeight:'700',textAlign:'center'}}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </FadeSlideIn>
                );
              })}
            </View>
          )}

          {/* GRID */}
          {folderView==='grid' && (
            <View style={{ flexDirection:'row', flexWrap:'wrap', gap:GAP }}>
              {openedFolder.items.map((s,i)=>{
                const qty=parseFloat(s.qty)||0, isLow=qty<5;
                return (
                  <FadeSlideIn key={s.id} delay={i*20}>
                    <View style={[styles.gridCard,{width:CARD_3,backgroundColor:card,borderColor:isLow?COLORS.warning:border}]}>
                      <ItemIcon type={tab} name={s.displaySize||s.name} size={28} />
                      <Text style={{color:text,fontWeight:'700',fontSize:10,textAlign:'center',marginTop:4}} numberOfLines={2}>{s.displaySize||s.name}</Text>
                      <View style={[styles.qtyBadge,{backgroundColor:isLow?'#fff7ed':'#f0fdf4'}]}>
                        <Text style={{color:isLow?COLORS.warning:COLORS.success,fontWeight:'900',fontSize:FONT.lg}}>{s.qty}</Text>
                      </View>
                      <TouchableOpacity onPress={async()=>{const ok=await showConfirm('Delete?','Confirm');if(ok){await deleteData('stock',s.id);refreshFolder(s.id,s.qty);}}}>
                        <Text style={{color:COLORS.danger,fontSize:10,textAlign:'center',marginTop:4}}>Del</Text>
                      </TouchableOpacity>
                    </View>
                  </FadeSlideIn>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ══════════════════════════════════════════
  // MAIN SCREEN
  // ══════════════════════════════════════════
  return (
    <View style={[styles.root, { backgroundColor:bg }]}>
      <View style={[styles.header, { backgroundColor:card, borderBottomColor:border }]}>
        <Text style={[styles.headerTitle, { color:text }]}>Stock</Text>
        <View style={{ flexDirection:'row', alignItems:'center', gap:SPACING.sm }}>
          <ViewToggles current={mainView} onChange={setMainView} />
          <TouchableOpacity style={styles.addBtn} onPress={() => { setBatch([]); setView('add'); }}>
            <Text style={{ color:COLORS.white, fontWeight:'700', fontSize:FONT.sm }}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.searchBox, { backgroundColor:card, borderColor:border }]}>
        <Text style={{ color:sub, marginRight:8, fontSize:15 }}>🔍</Text>
        <TextInput value={searchTerm} onChangeText={setSearchTerm} placeholder="Search stock..." placeholderTextColor={sub} style={{ flex:1, fontSize:FONT.base, color:text }} />
        {searchTerm?<TouchableOpacity onPress={()=>setSearchTerm('')}><Text style={{color:sub,fontSize:18}}>✕</Text></TouchableOpacity>:null}
      </View>

      {/* Tabs — flex row، سب اسکرین کے اندر */}
      <View style={[styles.tabRow, { backgroundColor:card, borderBottomColor:border }]}>
        {STOCK_TABS.map(t => {
          const active=tab===t.id, cfg=TAB_CONFIG[t.id];
          const count=stock.filter(s=>s.type===t.id).length;
          return (
            <TouchableOpacity key={t.id}
              style={[styles.tab, { backgroundColor:active?cfg.activeBg:'transparent' }]}
              onPress={() => { setTab(t.id); setOpenedFolder(null); }}>
              <Text style={{ fontSize:FONT.xs, fontWeight:'700', color:active?COLORS.white:(dark?COLORS.slate400:COLORS.slate600) }}>{t.label}</Text>
              {count>0 && (
                <View style={{ backgroundColor:active?'rgba(255,255,255,0.3)':COLORS.slate200, borderRadius:RADIUS.full, paddingHorizontal:5, paddingVertical:1, marginLeft:3 }}>
                  <Text style={{ fontSize:9, fontWeight:'800', color:active?COLORS.white:COLORS.slate600 }}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ padding:PAD, paddingBottom:80 }}>
        {groupsArr.length===0 ? (
          <View style={{ alignItems:'center', marginTop:80 }}>
            <ItemIcon type={tab} name={tab} size={64} />
            <Text style={{ color:sub, marginTop:SPACING.md, fontSize:FONT.base }}>No items in this category</Text>
            <TouchableOpacity style={[styles.addBtn,{marginTop:SPACING.xl,paddingHorizontal:SPACING.xl}]} onPress={()=>{setBatch([]);setView('add');}}>
              <Text style={{ color:COLORS.white, fontWeight:'700' }}>+ Add Stock</Text>
            </TouchableOpacity>
          </View>
        ) : mainView==='list' ? (
          <View>
            {groupsArr.map((grp,i)=>{
              const isLow=grp.totalQty<5;
              return (
                <FadeSlideIn key={grp.name} delay={i*25}>
                  <TouchableOpacity style={[styles.listFolderRow,{backgroundColor:card,borderColor:isLow?COLORS.warning:border}]}
                    onPress={()=>{setOpenedFolder(grp);setEditingItem(null);}}>
                    <ItemIcon type={tab} name={grp.name} size={42} />
                    <View style={{ flex:1, marginLeft:SPACING.md }}>
                      <Text style={{ color:text, fontWeight:'700', fontSize:FONT.base }}>{grp.name}</Text>
                      <Text style={{ color:sub, fontSize:FONT.xs, marginTop:2 }}>{grp.variations} size{grp.variations!==1?'s':''}</Text>
                    </View>
                    <View style={[styles.qtyPill,{backgroundColor:isLow?'#fff7ed':'#f0fdf4'}]}>
                      <Text style={{color:isLow?COLORS.warning:COLORS.success,fontWeight:'800',fontSize:FONT.base}}>{grp.totalQty}</Text>
                    </View>
                    <Text style={{color:sub,marginLeft:SPACING.sm,fontSize:FONT.lg}}>›</Text>
                  </TouchableOpacity>
                </FadeSlideIn>
              );
            })}
          </View>
        ) : mainView==='compact' ? (
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:GAP }}>
            {groupsArr.map((grp,i)=>{
              const isLow=grp.totalQty<5;
              return (
                <FadeSlideIn key={grp.name} delay={i*35}>
                  <TouchableOpacity style={[styles.folderCard,{width:CARD_2,backgroundColor:card,borderColor:isLow?COLORS.warning:border}]}
                    onPress={()=>{setOpenedFolder(grp);setEditingItem(null);}}>
                    <ItemIcon type={tab} name={grp.name} size={44} />
                    <Text style={[styles.folderName,{color:text}]} numberOfLines={2}>{grp.name}</Text>
                    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:SPACING.xs,marginTop:4}}>
                      <Text style={{color:sub,fontSize:10}}>{grp.variations} sizes</Text>
                      <View style={[styles.qtyChip,{backgroundColor:isLow?'#fff7ed':(dark?COLORS.slate700:COLORS.slate100)}]}>
                        <Text style={{color:isLow?COLORS.warning:(dark?COLORS.textDark:COLORS.slate700),fontWeight:'800',fontSize:FONT.xs}}>{grp.totalQty}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </FadeSlideIn>
              );
            })}
          </View>
        ) : (
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:GAP }}>
            {groupsArr.map((grp,i)=>{
              const isLow=grp.totalQty<5;
              return (
                <FadeSlideIn key={grp.name} delay={i*25}>
                  <TouchableOpacity style={[styles.folderCardSm,{width:CARD_3,backgroundColor:card,borderColor:isLow?COLORS.warning:border}]}
                    onPress={()=>{setOpenedFolder(grp);setEditingItem(null);}}>
                    <ItemIcon type={tab} name={grp.name} size={32} />
                    <Text style={{color:text,fontWeight:'700',fontSize:10,textAlign:'center',marginTop:4}} numberOfLines={2}>{grp.name}</Text>
                    <View style={[styles.qtyChip,{backgroundColor:isLow?'#fff7ed':(dark?COLORS.slate700:COLORS.slate100),marginTop:4}]}>
                      <Text style={{color:isLow?COLORS.warning:(dark?COLORS.textDark:COLORS.slate700),fontWeight:'800',fontSize:FONT.sm}}>{grp.totalQty}</Text>
                    </View>
                  </TouchableOpacity>
                </FadeSlideIn>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex:1 },
  header:        { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:SPACING.lg, paddingVertical:SPACING.md, borderBottomWidth:1 },
  headerTitle:   { fontSize:FONT.xl, fontWeight:'800' },
  addBtn:        { backgroundColor:COLORS.primary, paddingVertical:SPACING.sm, paddingHorizontal:SPACING.md, borderRadius:RADIUS.full },
  searchBox:     { flexDirection:'row', alignItems:'center', margin:SPACING.md, marginBottom:SPACING.sm, padding:SPACING.md, borderRadius:RADIUS.lg, borderWidth:1 },
  viewBtn:       { width:32, height:32, borderRadius:RADIUS.sm, justifyContent:'center', alignItems:'center' },
  tabRow:        { flexDirection:'row', borderBottomWidth:1, paddingHorizontal:SPACING.sm },
  tab:           { flex:1, flexDirection:'row', justifyContent:'center', alignItems:'center', paddingVertical:SPACING.sm, borderRadius:RADIUS.md, margin:4 },
  listFolderRow: { flexDirection:'row', alignItems:'center', padding:SPACING.md, borderRadius:RADIUS.lg, marginBottom:SPACING.sm, borderWidth:1, ...SHADOW.sm },
  folderCard:    { borderRadius:RADIUS.xl, padding:SPACING.md, alignItems:'center', borderWidth:1, ...SHADOW.sm },
  folderCardSm:  { borderRadius:RADIUS.xl, padding:SPACING.sm, alignItems:'center', borderWidth:1, ...SHADOW.sm },
  folderName:    { fontWeight:'700', textAlign:'center', fontSize:FONT.sm, marginTop:6 },
  qtyChip:       { paddingHorizontal:SPACING.sm, paddingVertical:2, borderRadius:RADIUS.full },
  listItem:      { padding:SPACING.md, borderRadius:RADIUS.lg, marginBottom:SPACING.sm, borderWidth:1 },
  qtyPill:       { paddingHorizontal:SPACING.md, paddingVertical:4, borderRadius:RADIUS.full, minWidth:44, alignItems:'center' },
  actionBtn:     { paddingHorizontal:SPACING.sm, paddingVertical:SPACING.xs, marginLeft:SPACING.xs },
  compactCard:   { borderRadius:RADIUS.xl, padding:SPACING.md, alignItems:'center', borderWidth:1.5, ...SHADOW.sm },
  gridCard:      { borderRadius:RADIUS.xl, padding:SPACING.sm, alignItems:'center', borderWidth:1.5, ...SHADOW.sm },
  qtyBadge:      { marginTop:SPACING.sm, paddingHorizontal:SPACING.md, paddingVertical:SPACING.sm, borderRadius:RADIUS.lg, alignItems:'center' },
  entryCard:     { borderRadius:RADIUS.xl, padding:SPACING.md, marginBottom:SPACING.md, ...SHADOW.sm },
  batchBox:      { borderWidth:1, borderRadius:RADIUS.xl, borderStyle:'dashed' },
  batchLabel:    { fontSize:FONT.xs, fontWeight:'700', textTransform:'uppercase', padding:SPACING.md },
  batchRow:      { flexDirection:'row', alignItems:'center', padding:SPACING.md, borderBottomWidth:1 },
});
