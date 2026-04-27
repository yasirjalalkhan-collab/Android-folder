import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { COLORS, SPACING, RADIUS, FONT } from '../utils/theme';
import { formatDate } from '../utils/helpers';

export default function ActivityLogsScreen() {
  const navigation = useNavigation();
  const { logs, settings } = useApp();
  const dark   = settings.mode === 'dark';
  const bg     = dark ? COLORS.bgDark     : COLORS.bgLight;
  const card   = dark ? COLORS.surfaceDark : COLORS.white;
  const text   = dark ? COLORS.textDark   : COLORS.textLight;
  const sub    = dark ? COLORS.slate400   : COLORS.slate500;
  const border = dark ? COLORS.borderDark : COLORS.borderLight;

  const renderItem = ({ item: log, index }) => (
    <View style={[styles.row, { backgroundColor: index%2===0 ? card : (dark?'#1a2332':COLORS.slate50), borderColor: border }]}>
      <View style={styles.dot} />
      <View style={{ flex:1 }}>
        <Text style={[styles.action, { color:text }]} numberOfLines={2}>{log.action}</Text>
        <Text style={[styles.meta, { color:sub }]}>
          {formatDate(new Date(log.time).toISOString())} • {log.device || 'Mobile'}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor:bg }]}>
      <View style={[styles.header, { backgroundColor:card, borderBottomColor:border }]}>
        <Text style={[styles.title, { color:text }]}>Activity Logs</Text>
        <Text style={[{ color:sub, fontSize:FONT.xs }]}>{logs.length} entries</Text>
      </View>

      <FlatList
        data={logs}
        keyExtractor={(l, i) => String(l.time || i)}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom:60 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize:48 }}>📋</Text>
            <Text style={[{ color:sub, marginTop:SPACING.md, fontSize:FONT.base }]}>No logs yet</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex:1 },
  header: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:SPACING.lg, borderBottomWidth:1 },
  title:  { fontSize:FONT.xl, fontWeight:'700' },
  row:    { flexDirection:'row', alignItems:'center', padding:SPACING.md, borderBottomWidth:1, gap:SPACING.md },
  dot:    { width:8, height:8, borderRadius:4, backgroundColor:COLORS.primary },
  action: { fontSize:FONT.base, fontWeight:'600' },
  meta:   { fontSize:FONT.xs, marginTop:2 },
  empty:  { alignItems:'center', marginTop:80 },
});
