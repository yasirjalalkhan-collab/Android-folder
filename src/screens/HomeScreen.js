// ── HomeScreen — exact port from HTML Dashboard ──────────────
import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { FadeSlideIn, ScalePress, Pulse } from '../components/ui/Animated';
import { COLORS, SPACING, RADIUS, FONT, SHADOW } from '../utils/theme';
import { formatMoney, formatDate } from '../utils/helpers';
import { calculateLedgerBalance, safeParseAmount } from '../utils/ledger';
import Marketplace from '../components/Marketplace';
import AdBanner    from '../components/AdBanner';

export default function HomeScreen() {
  const navigation = useNavigation();
  const { invoices, customers, cheques, stock, settings, isGuest, isFirebaseMode, getStats } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const dark = settings.mode === 'dark';
  const bg   = dark ? COLORS.bgDark     : '#f8fafc';
  const card = dark ? COLORS.surfaceDark : COLORS.white;
  const text = dark ? COLORS.textDark   : COLORS.textLight;
  const sub  = dark ? COLORS.slate400   : COLORS.slate500;
  const brd  = dark ? COLORS.borderDark : COLORS.borderLight;

  const stats      = getStats();
  const dueCheques = (cheques || []).filter(c => c.status === 'pending');

  // ── آج کی تاریخ کے چیک جو جمع کروانے ہیں ──────────────
  const todayStr = new Date().toISOString().split('T')[0];
  const dueTodayCheques = (cheques || []).filter(c =>
    c.status === 'pending' && c.date && c.date <= todayStr
  );

  const searchResults = useMemo(() => {
    if (!searchQuery) return null;
    const q = searchQuery.toLowerCase();
    return {
      customers: customers.filter(c =>
        c.name?.toLowerCase().includes(q) || (c.mobile || '').includes(q)
      ),
      invoices: invoices.filter(i =>
        String(i.id).toLowerCase().includes(q) ||
        (i.customer && i.customer.name?.toLowerCase().includes(q))
      ),
    };
  }, [searchQuery, customers, invoices]);

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
    <ScrollView
      style={{ flex:1 }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Guest Warning */}
      {isGuest && (
        <View style={[styles.guestBanner, { borderLeftColor: COLORS.warning }]}>
          <Text style={{ color: COLORS.warning, fontWeight: '700', fontSize: FONT.sm }}>⚠️ Guest Mode Active</Text>
          <Text style={{ color: COLORS.warning, fontSize: FONT.xs }}>Data will not be saved permanently.</Text>
        </View>
      )}

      {/* Search Bar */}
      <View style={[styles.searchBox, { backgroundColor: card, borderColor: brd }]}>
        <Text style={{ fontSize: 16, color: COLORS.slate400, marginRight: 8 }}>🔍</Text>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search Customer, Invoice..."
          placeholderTextColor={COLORS.slate400}
          style={[styles.searchInput, { color: text }]}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={{ color: sub, fontSize: 18 }}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Search Results */}
      {searchResults ? (
        <FadeSlideIn delay={0}>
          {searchResults.customers.length > 0 && (
            <View style={{ marginBottom: SPACING.md }}>
              <Text style={[styles.sectionLabel, { color: sub }]}>Customers</Text>
              {searchResults.customers.map(c => (
                <ScalePress key={c.id}
                  style={[styles.resultRow, { backgroundColor: card, borderColor: brd }]}
                  onPress={() => navigation.navigate('CustomerDetail', { customerId: c.id })}
                >
                  <Text style={{ color: text }}>{c.name}</Text>
                  <Text style={{ color: COLORS.slate400, fontSize: 18 }}>›</Text>
                </ScalePress>
              ))}
            </View>
          )}
          {searchResults.invoices.length > 0 && (
            <View>
              <Text style={[styles.sectionLabel, { color: sub }]}>Invoices</Text>
              {searchResults.invoices.map(i => (
                <ScalePress key={i.id}
                  style={[styles.resultRow, { backgroundColor: card, borderColor: brd }]}
                  onPress={() => navigation.navigate('InvoiceView', { invoice: i })}
                >
                  <Text style={{ color: text }}>#{i.id} - {i.customer?.name}</Text>
                  <Text style={{ color: text, fontWeight: '700' }}>{formatMoney(i.total, settings.currency)}</Text>
                </ScalePress>
              ))}
            </View>
          )}
          {searchResults.customers.length === 0 && searchResults.invoices.length === 0 && (
            <Text style={{ color: sub, textAlign: 'center', marginTop: SPACING.xl }}>No results found</Text>
          )}
        </FadeSlideIn>
      ) : (
        <>
          {/* ── چیک تاریخ یاددہانی ─────────────────────────── */}
          {dueTodayCheques.length > 0 && (
            <FadeSlideIn delay={0}>
              <Pulse>
                <ScalePress
                  style={[styles.chequeAlert, { backgroundColor: dark ? '#422006' : '#fff7ed', borderLeftColor: COLORS.warning }]}
                  onPress={() => navigation.navigate('Cheques')}
                >
                  <Text style={{ color: COLORS.warning, fontWeight: '800', fontSize: FONT.base }}>
                    🏦 {dueTodayCheques.length} چیک آج جمع کروائیں!
                  </Text>
                  {dueTodayCheques.slice(0, 3).map((c, i) => (
                    <Text key={i} style={{ color: COLORS.warning, fontSize: FONT.xs, marginTop: 2 }}>
                      • {c.customerName} — {c.bank} #{c.number} — Rs.{Number(c.amount).toLocaleString()}
                    </Text>
                  ))}
                  {dueTodayCheques.length > 3 && (
                    <Text style={{ color: COLORS.warning, fontSize: FONT.xs, marginTop: 2 }}>
                      + {dueTodayCheques.length - 3} مزید چیک...
                    </Text>
                  )}
                </ScalePress>
              </Pulse>
            </FadeSlideIn>
          )}

          {/* Pending Cheques Alert */}
          {dueCheques.length > 0 && (
            <FadeSlideIn delay={0}>
              <Pulse>
                <ScalePress
                  style={[styles.chequeAlert, { backgroundColor: card, borderLeftColor: COLORS.danger }]}
                  onPress={() => navigation.navigate('Cheques')}
                >
                  <Text style={{ color: COLORS.danger, fontWeight: '700', fontSize: FONT.base }}>
                    👥 {dueCheques.length} Pending Cheque{dueCheques.length > 1 ? 's' : ''}
                  </Text>
                  <Text style={{ color: sub, fontSize: FONT.xs, marginTop: 2 }}>Click to view details.</Text>
                </ScalePress>
              </Pulse>
            </FadeSlideIn>
          )}

          {/* Stats Cards */}
          <FadeSlideIn delay={60}>
            <View style={styles.row2}>
              <View style={[styles.statCard, { backgroundColor: dark ? '#052e16' : '#f0fdf4', borderColor: dark ? COLORS.green700 : '#bbf7d0' }]}>
                <Text style={{ color: COLORS.green600, fontSize: FONT.xs, fontWeight: '700', textTransform: 'uppercase' }}>Today Sales</Text>
                <Text style={{ color: text, fontSize: FONT.xl, fontWeight: '800', marginVertical: 4 }}>{formatMoney(stats.todaySales, settings.currency)}</Text>
                <Text style={{ color: sub, fontSize: FONT.xs }}>{stats.todayCount} Invoice{stats.todayCount !== 1 ? 's' : ''}</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: dark ? '#1e1b4b' : '#eff6ff', borderColor: dark ? COLORS.indigo600 : '#bfdbfe' }]}>
                <Text style={{ color: COLORS.blue600, fontSize: FONT.xs, fontWeight: '700', textTransform: 'uppercase' }}>Total Receivables</Text>
                <Text style={{ color: text, fontSize: FONT.xl, fontWeight: '800', marginVertical: 4 }}>{formatMoney(stats.balance, settings.currency)}</Text>
              </View>
            </View>
          </FadeSlideIn>

          {/* Action Buttons Row 1 — Pending Orders + History */}
          <FadeSlideIn delay={100}>
            <View style={styles.row2}>
              <ScalePress style={[styles.btnSecondary, { backgroundColor: card, borderColor: brd }]}
                onPress={() => navigation.navigate('PendingOrders')}>
                <Text style={[styles.btnSecondaryText, { color: text }]}>📦  Pending Orders</Text>
              </ScalePress>
              <ScalePress style={[styles.btnSecondary, { backgroundColor: card, borderColor: brd }]}
                onPress={() => navigation.navigate('AllInvoices')}>
                <Text style={[styles.btnSecondaryText, { color: text }]}>📋  History</Text>
              </ScalePress>
            </View>
          </FadeSlideIn>

          {/* Action Buttons Row 2 */}
          <FadeSlideIn delay={130}>
            <View style={styles.row2}>
              <ScalePress style={[styles.btnSecondary, { backgroundColor: card, borderColor: brd }]}
                onPress={() => navigation.navigate('Cheques')}>
                <Text style={[styles.btnSecondaryText, { color: text }]}>💳  Cheques</Text>
              </ScalePress>
              <ScalePress style={[styles.btnSecondary, { backgroundColor: card, borderColor: brd }]}
                onPress={() => navigation.navigate('Expenses')}>
                <Text style={[styles.btnSecondaryText, { color: text }]}>💰  Expenses</Text>
              </ScalePress>
            </View>
          </FadeSlideIn>

          {/* ── Featured Ad Banner ── */}
          <AdBanner dark={dark} />

          {/* ── Marketplace ── */}
          <Marketplace />
        </>
      )}
    </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1 },
  content:      { padding: SPACING.lg, paddingBottom: 100, gap: SPACING.md },
  guestBanner:  { backgroundColor: '#FFF7ED', borderLeftWidth: 4, padding: SPACING.md, borderRadius: RADIUS.md },
  searchBox:    { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, ...SHADOW.sm },
  searchInput:  { flex: 1, fontSize: FONT.base },
  sectionLabel: { fontSize: FONT.xs, fontWeight: '700', textTransform: 'uppercase', marginBottom: SPACING.sm },
  resultRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: 6, borderWidth: 1 },
  chequeAlert:  { padding: SPACING.lg, borderRadius: RADIUS.lg, borderLeftWidth: 4, ...SHADOW.sm },
  row2:         { flexDirection: 'row', gap: SPACING.md },
  statCard:     { flex: 1, borderRadius: RADIUS.xl, padding: SPACING.lg, borderWidth: 1 },
  btnPrimary:   { flex: 1, backgroundColor: COLORS.primary, padding: SPACING.lg, borderRadius: RADIUS.xl, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { color: COLORS.white, fontWeight: '700', fontSize: FONT.base },
  btnSecondary:   { flex: 1, padding: SPACING.lg, borderRadius: RADIUS.xl, alignItems: 'center', justifyContent: 'center', borderWidth: 1, ...SHADOW.sm },
  btnSecondaryText: { fontWeight: '700', fontSize: FONT.base },
});
