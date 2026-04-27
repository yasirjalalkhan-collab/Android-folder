import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Linking, Image,
  Modal, Dimensions, FlatList, ScrollView,
} from 'react-native';
import {
  collection, query, where, orderBy, onSnapshot,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useApp } from '../context/AppContext';
import { COLORS, SPACING, RADIUS, FONT, SHADOW } from '../utils/theme';

const { width: SW } = Dimensions.get('window');
const CARD_W = SW - SPACING.lg * 2;

// ── Fullscreen Image Viewer ───────────────────────────────────
function FullscreenImageViewer({ images, startIndex = 0, visible, onClose }) {
  const [idx, setIdx] = useState(startIndex);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.97)' }}>
        {/* Close */}
        <TouchableOpacity
          style={{ position:'absolute', top:48, right:20, zIndex:10,
            backgroundColor:'rgba(255,255,255,0.15)', borderRadius:20,
            width:40, height:40, justifyContent:'center', alignItems:'center' }}
          onPress={onClose}
        >
          <Text style={{ color:'#fff', fontWeight:'900', fontSize:18 }}>✕</Text>
        </TouchableOpacity>

        {/* Counter */}
        {images.length > 1 && (
          <View style={{ position:'absolute', top:52, alignSelf:'center', zIndex:10,
            backgroundColor:'rgba(0,0,0,0.5)', paddingHorizontal:12, paddingVertical:4, borderRadius:20 }}>
            <Text style={{ color:'rgba(255,255,255,0.9)', fontSize:12, fontWeight:'700' }}>
              {idx+1} / {images.length}
            </Text>
          </View>
        )}

        <FlatList
          data={images}
          horizontal pagingEnabled
          initialScrollIndex={startIndex}
          showsHorizontalScrollIndicator={false}
          onScroll={e => setIdx(Math.round(e.nativeEvent.contentOffset.x / SW))}
          scrollEventThrottle={16}
          getItemLayout={(_,i) => ({ length:SW, offset:SW*i, index:i })}
          keyExtractor={(_,i) => String(i)}
          renderItem={({ item }) => (
            <ScrollView
              style={{ width:SW }}
              contentContainerStyle={{ flex:1, justifyContent:'center', alignItems:'center' }}
              maximumZoomScale={4}
              minimumZoomScale={1}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              centerContent
            >
              <Image
                source={{ uri: item }}
                style={{ width:SW, height:SW * 1.2 }}
                resizeMode="contain"
              />
            </ScrollView>
          )}
        />

        {/* Dots */}
        {images.length > 1 && (
          <View style={{ position:'absolute', bottom:48, alignSelf:'center', flexDirection:'row', gap:6 }}>
            {images.map((_,i) => (
              <View key={i} style={{
                width: i===idx ? 20 : 6, height:6, borderRadius:3,
                backgroundColor: i===idx ? '#fff' : 'rgba(255,255,255,0.35)',
              }} />
            ))}
          </View>
        )}

        <Text style={{ position:'absolute', bottom:24, alignSelf:'center',
          color:'rgba(255,255,255,0.35)', fontSize:11 }}>
          Pinch to zoom
        </Text>
      </View>
    </Modal>
  );
}

// ── In-App Browser ────────────────────────────────────────────
function InAppBrowser({ url, title, visible, onClose, dark }) {
  if (!visible) return null;
  const headerBg = dark ? '#0f172a' : '#1e293b'; // header ہمیشہ dark
  const bodyBg   = dark ? '#0f172a' : '#ffffff';
  const WebView  = (() => { try { return require('react-native-webview').WebView; } catch { return null; } })();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex:1, backgroundColor:bodyBg }}>
        <View style={{ flexDirection:'row', alignItems:'center',
          paddingTop:48, paddingHorizontal:SPACING.md, paddingBottom:SPACING.md,
          backgroundColor:headerBg }}>
          <TouchableOpacity onPress={onClose} style={{ paddingRight:SPACING.md }}>
            <Text style={{ color:'#fff', fontWeight:'700', fontSize:FONT.base }}>✕ Close</Text>
          </TouchableOpacity>
          <Text style={{ flex:1, color:'rgba(255,255,255,0.6)', fontSize:FONT.xs, textAlign:'center' }} numberOfLines={1}>
            {title}
          </Text>
          <TouchableOpacity onPress={() => Linking.openURL(url)} style={{ paddingLeft:SPACING.md }}>
            <Text style={{ color:COLORS.primaryLight, fontSize:FONT.xs, fontWeight:'700' }}>Browser ↗</Text>
          </TouchableOpacity>
        </View>
        {WebView ? (
          <WebView source={{ uri:url }} style={{ flex:1 }} />
        ) : (
          <View style={{ flex:1, justifyContent:'center', alignItems:'center', padding:SPACING.xl }}>
            <Text style={{ fontSize:48, marginBottom:SPACING.md }}>🌐</Text>
            <Text style={{ color:dark?'#fff':'#1e293b', fontSize:FONT.base, textAlign:'center', marginBottom:SPACING.xl }}>{url}</Text>
            <TouchableOpacity style={[s.ctaBtn,{backgroundColor:COLORS.primary}]} onPress={() => Linking.openURL(url)}>
              <Text style={s.ctaBtnText}>Open in Browser ↗</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ── Full Screen Ad Detail ─────────────────────────────────────
function FullScreenAd({ item, visible, onClose, dark }) {
  const [browserUrl,      setBrowserUrl]      = useState(null);
  const [browserVisible,  setBrowserVisible]  = useState(false);
  const [imgViewerIdx,    setImgViewerIdx]    = useState(0);
  const [imgViewerOpen,   setImgViewerOpen]   = useState(false);
  const [currentImg,      setCurrentImg]      = useState(0);
  const flatRef = useRef(null);

  if (!item) return null;

  const bg      = dark ? '#0f172a' : '#ffffff';
  const textClr = dark ? '#f1f5f9' : '#1e293b';
  const subClr  = dark ? '#94a3b8' : '#64748b';
  const bgColor = item.bgColor || '#166634';
  const hasImgs = item.images?.length > 0;

  return (
    <>
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={{ flex:1, backgroundColor:bg }}>

          {/* Coloured header */}
          <View style={{ flexDirection:'row', alignItems:'center',
            paddingTop:48, paddingHorizontal:SPACING.lg, paddingBottom:SPACING.lg,
            backgroundColor:bgColor }}>
            <TouchableOpacity onPress={onClose} style={{ marginRight:SPACING.md }}>
              <Text style={{ color:'#fff', fontSize:24 }}>‹</Text>
            </TouchableOpacity>
            <View style={{ flex:1 }}>
              <Text style={{ color:'#fff', fontWeight:'800', fontSize:FONT.lg }} numberOfLines={1}>
                {item.title}
              </Text>
              {item.city && (
                <Text style={{ color:'rgba(255,255,255,0.7)', fontSize:FONT.xs, marginTop:2 }}>
                  📍 {item.city}
                </Text>
              )}
            </View>
            {item.category && (
              <View style={{ backgroundColor:'rgba(255,255,255,0.2)',
                paddingHorizontal:SPACING.sm, paddingVertical:3, borderRadius:RADIUS.full }}>
                <Text style={{ color:'#fff', fontSize:FONT.xs, fontWeight:'700' }}>{item.category}</Text>
              </View>
            )}
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom:60 }} showsVerticalScrollIndicator={false}>

            {/* Images — swipeable + tap to zoom */}
            {hasImgs && (
              <View>
                <FlatList
                  ref={flatRef}
                  data={item.images}
                  horizontal pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={e => setCurrentImg(Math.round(e.nativeEvent.contentOffset.x / SW))}
                  scrollEventThrottle={16}
                  keyExtractor={(_,i) => String(i)}
                  renderItem={({ item:img, index }) => (
                    <TouchableOpacity activeOpacity={0.92}
                      onPress={() => { setImgViewerIdx(index); setImgViewerOpen(true); }}>
                      <Image source={{ uri:img }} style={{ width:SW, height:SW*0.65 }} resizeMode="cover" />
                    </TouchableOpacity>
                  )}
                />
                {/* Dots */}
                {item.images.length > 1 && (
                  <View style={{ flexDirection:'row', justifyContent:'center', gap:6, marginTop:SPACING.sm }}>
                    {item.images.map((_,i) => (
                      <TouchableOpacity key={i}
                        onPress={() => { flatRef.current?.scrollToIndex({index:i,animated:true}); setCurrentImg(i); }}>
                        <View style={{
                          width: i===currentImg ? 20 : 6, height:6, borderRadius:3,
                          backgroundColor: i===currentImg ? bgColor : '#cbd5e1',
                        }} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <Text style={{ color:subClr, fontSize:10, textAlign:'center', marginTop:4 }}>
                  Tap image to zoom
                </Text>
              </View>
            )}

            {/* Text content */}
            <View style={{ padding:SPACING.lg }}>
              {item.tagline && (
                <Text style={{ color:textClr, fontSize:FONT.md, fontWeight:'700', marginBottom:SPACING.sm }}>
                  {item.tagline}
                </Text>
              )}
              {item.description && (
                <Text style={{ color:subClr, fontSize:FONT.base, lineHeight:24, marginBottom:SPACING.lg }}>
                  {item.description}
                </Text>
              )}

              {/* Contact buttons */}
              <View style={{ gap:SPACING.md }}>
                {item.phone && (
                  <TouchableOpacity style={[s.ctaBtn,{backgroundColor:'#1e40af'}]}
                    onPress={() => Linking.openURL(`tel:${item.phone}`)}>
                    <Text style={s.ctaBtnText}>📞  Call — {item.phone}</Text>
                  </TouchableOpacity>
                )}
                {item.whatsapp && (
                  <TouchableOpacity style={[s.ctaBtn,{backgroundColor:'#15803d'}]}
                    onPress={() => Linking.openURL(`https://wa.me/${item.whatsapp}?text=${encodeURIComponent('Hello, I saw your Timber 360 Marketplace listing.')}`)}>
                    <Text style={s.ctaBtnText}>💬  WhatsApp</Text>
                  </TouchableOpacity>
                )}
                {item.website && (
                  <TouchableOpacity style={[s.ctaBtn,{backgroundColor:'#7c3aed'}]}
                    onPress={() => { setBrowserUrl(item.website); setBrowserVisible(true); }}>
                    <Text style={s.ctaBtnText}>🌐  Visit Website</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {hasImgs && (
        <FullscreenImageViewer
          images={item.images}
          startIndex={imgViewerIdx}
          visible={imgViewerOpen}
          onClose={() => setImgViewerOpen(false)}
        />
      )}

      <InAppBrowser
        url={browserUrl || ''}
        title={item.title}
        visible={browserVisible}
        onClose={() => setBrowserVisible(false)}
        dark={dark}
      />
    </>
  );
}

// ── Listing Card ──────────────────────────────────────────────
function ListingCard({ item, index, dark, onPress }) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;
  const bgColor   = item.bgColor || '#166634';
  const hasImages = item.images?.length > 0;
  const cardBg    = dark ? '#1e293b' : '#fff';

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue:1, duration:300, useNativeDriver:true }),
        Animated.timing(slideAnim, { toValue:0, duration:300, useNativeDriver:true }),
      ]).start();
    }, index * 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View style={[s.card, { opacity:fadeAnim, transform:[{translateY:slideAnim}] }]}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.92}>

        {/* Image or colour header */}
        {hasImages ? (
          <View style={{ borderTopLeftRadius:RADIUS.xl, borderTopRightRadius:RADIUS.xl, overflow:'hidden' }}>
            <Image source={{ uri:item.images[0] }} style={{ width:CARD_W, height:180 }} resizeMode="cover" />
            {item.images.length > 1 && (
              <View style={s.imgCounter}>
                <Text style={s.imgCounterText}>🖼 {item.images.length}</Text>
              </View>
            )}
            {/* Bottom gradient overlay */}
            <View style={[s.cardImgOverlay, { backgroundColor:bgColor+'CC' }]}>
              <Text style={s.cardTitleWhite} numberOfLines={1}>{item.title}</Text>
              {item.tagline && <Text style={s.cardTaglineWhite} numberOfLines={1}>{item.tagline}</Text>}
            </View>
          </View>
        ) : (
          <View style={[s.cardColorHeader, { backgroundColor:bgColor }]}>
            <Text style={{ fontSize:30 }}>{item.emoji || '🏪'}</Text>
            <View style={{ flex:1, marginLeft:SPACING.md }}>
              <Text style={s.cardTitleWhite} numberOfLines={1}>{item.title}</Text>
              {item.tagline && <Text style={s.cardTaglineWhite} numberOfLines={1}>{item.tagline}</Text>}
            </View>
            {item.city && (
              <Text style={{ color:'rgba(255,255,255,0.75)', fontSize:10 }}>📍{item.city}</Text>
            )}
          </View>
        )}

        {/* Info row */}
        <View style={[s.cardBottom, { backgroundColor:cardBg }]}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:SPACING.xs, marginBottom:SPACING.sm, flexWrap:'wrap' }}>
            {item.category && (
              <View style={[s.catBadge, { backgroundColor:bgColor+'22' }]}>
                <Text style={{ color:bgColor, fontSize:9, fontWeight:'700' }}>{item.category}</Text>
              </View>
            )}
            {item.city && (
              <View style={s.catBadge}>
                <Text style={{ color:dark?COLORS.slate400:'#64748b', fontSize:9 }}>📍{item.city}</Text>
              </View>
            )}
            <Text style={{ color:'#94a3b8', fontSize:9, marginLeft:'auto' }}>Tap to view →</Text>
          </View>

          {/* CTA buttons */}
          <View style={s.ctaRow}>
            {item.phone && (
              <TouchableOpacity
                style={[s.ctaBtn, { backgroundColor:'#1e40af', flex:1 }]}
                onPress={() => Linking.openURL(`tel:${item.phone}`)}
              >
                <Text style={s.ctaBtnText}>📞 Call</Text>
              </TouchableOpacity>
            )}
            {item.whatsapp && (
              <TouchableOpacity
                style={[s.ctaBtn, { backgroundColor:'#15803d', flex:1 }]}
                onPress={() => Linking.openURL(`https://wa.me/${item.whatsapp}?text=${encodeURIComponent('Hello, I saw your Timber 360 Marketplace listing.')}`)}
              >
                <Text style={s.ctaBtnText}>💬 WhatsApp</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Main Export ───────────────────────────────────────────────
export default function Marketplace() {
  const { settings } = useApp();
  const dark = settings?.mode === 'dark';

  const [listings, setListings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const q = query(
      collection(db, 'marketplace'),
      where('enabled', '==', true),
      orderBy('order', 'asc')
    );
    const unsub = onSnapshot(q,
      snap => {
        const data = snap.docs
          .map(d => ({ id:d.id, ...d.data() }))
          .filter(l => !l.expiresAt || l.expiresAt >= today);
        setListings(data);
        setLoading(false);
      },
      () => {
        // orderBy index نہیں — fallback
        const q2 = query(collection(db,'marketplace'), where('enabled','==',true));
        onSnapshot(q2, snap => {
          const data = snap.docs
            .map(d => ({ id:d.id, ...d.data() }))
            .filter(l => !l.expiresAt || l.expiresAt >= today)
            .sort((a,b) => (a.order||99) - (b.order||99));
          setListings(data);
          setLoading(false);
        }, () => setLoading(false));
      }
    );
    return unsub;
  }, []);

  if (loading || listings.length === 0) return null;

  const brd = dark ? COLORS.borderDark : '#e2e8f0';

  return (
    <>
      <View style={[s.section, { borderColor:brd }]}>
        {/* Header */}
        <View style={s.sectionHeader}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:SPACING.sm }}>
            <Text style={{ fontSize:18 }}>🛒</Text>
            <Text style={[s.headerTitle, { color:dark ? COLORS.textDark : COLORS.textLight }]}>
              Marketplace
            </Text>
          </View>
          <Text style={{ color:COLORS.slate400, fontSize:FONT.xs }}>
            {listings.length} listing{listings.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Cards */}
        <View style={{ paddingHorizontal:SPACING.md, paddingBottom:SPACING.md, gap:SPACING.md }}>
          {listings.map((item, i) => (
            <ListingCard
              key={item.id}
              item={item}
              index={i}
              dark={dark}
              onPress={() => setSelected(item)}
            />
          ))}
        </View>
      </View>

      <FullScreenAd
        item={selected}
        visible={!!selected}
        onClose={() => setSelected(null)}
        dark={dark}
      />
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────
const s = StyleSheet.create({
  section:         { borderRadius:RADIUS.xl, borderWidth:1, overflow:'hidden', marginBottom:4 },
  sectionHeader:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center',
                     paddingHorizontal:SPACING.lg, paddingVertical:SPACING.md },
  headerTitle:     { fontSize:FONT.lg, fontWeight:'800' },
  // Card
  card:            { borderRadius:RADIUS.xl, overflow:'hidden', ...SHADOW.md },
  cardColorHeader: { flexDirection:'row', alignItems:'center', padding:SPACING.lg, minHeight:80 },
  cardTitleWhite:  { color:'#fff', fontWeight:'800', fontSize:FONT.base },
  cardTaglineWhite:{ color:'rgba(255,255,255,0.8)', fontSize:FONT.xs, marginTop:2 },
  cardImgOverlay:  { position:'absolute', bottom:0, left:0, right:0, padding:SPACING.md },
  cardBottom:      { padding:SPACING.md },
  catBadge:        { paddingHorizontal:SPACING.sm, paddingVertical:2, borderRadius:RADIUS.full, backgroundColor:'#f1f5f9' },
  // CTA
  ctaRow:          { flexDirection:'row', gap:SPACING.sm },
  ctaBtn:          { borderRadius:RADIUS.lg, paddingVertical:SPACING.sm, paddingHorizontal:SPACING.md,
                     alignItems:'center', justifyContent:'center' },
  ctaBtnText:      { color:'#fff', fontWeight:'700', fontSize:FONT.xs },
  // Image
  imgCounter:      { position:'absolute', top:SPACING.sm, right:SPACING.sm,
                     backgroundColor:'rgba(0,0,0,0.5)', paddingHorizontal:8, paddingVertical:3,
                     borderRadius:RADIUS.full },
  imgCounterText:  { color:'#fff', fontSize:10, fontWeight:'700' },
});
