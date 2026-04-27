import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONT, SPACING, RADIUS } from '../utils/theme';
import { useApp, ADMIN_UID } from '../context/AppContext';
import {
  IconLayoutDashboard, IconPackage,
  IconUsers, IconTrendingUp, NavIcon,
} from '../components/ui/TabIcons';

import SplashScreen         from '../screens/SplashScreen';
import LoginScreen          from '../screens/LoginScreen';
import PinScreen            from '../screens/PinScreen';
import PendingScreen        from '../screens/PendingScreen';
import BlockedScreen        from '../screens/BlockedScreen';
import AdminPanelScreen     from '../screens/AdminPanelScreen';
import HomeScreen           from '../screens/HomeScreen';
import CustomerListScreen   from '../screens/CustomerListScreen';
import CustomerDetailScreen from '../screens/CustomerDetailScreen';
import InvoiceEditorScreen  from '../screens/InvoiceEditorScreen';
import InvoiceViewScreen    from '../screens/InvoiceViewScreen';
import AllInvoicesScreen    from '../screens/AllInvoicesScreen';
import StockScreen          from '../screens/StockScreen';
import AnalyticsScreen      from '../screens/AnalyticsScreen';
import ExpensesScreen       from '../screens/ExpensesScreen';
import SettingsScreen       from '../screens/SettingsScreen';
import CalculatorScreen     from '../screens/CalculatorScreen';
import ProfileEditorScreen  from '../screens/ProfileEditorScreen';
import ActivityLogsScreen   from '../screens/ActivityLogsScreen';
import ChequesScreen        from '../screens/ChequesScreen';
import PendingOrdersScreen  from '../screens/PendingOrdersScreen';
import OrderTrackingScreen  from '../screens/OrderTrackingScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// ── App Header ────────────────────────────────────────────────
function AppHeader() {
  const navigation = useNavigation();
  const { profile, settings, user, isAdmin } = useApp();
  const dark    = settings.mode === 'dark';
  const initial = profile?.name ? profile.name[0].toUpperCase() : 'T';

  return (
    <View style={[styles.appHeader, { backgroundColor: dark ? '#0f172a' : '#166534' }]}>
      {/* Left */}
      <View style={styles.headerLeft}>
        <View style={[styles.logoBox, { backgroundColor: dark ? COLORS.primary : '#15803d' }]}>
          <Text style={styles.logoText}>{initial}</Text>
        </View>
        <View>
          <Text style={styles.bizName} numberOfLines={1}>
            {profile?.name || 'Timber 360'}
          </Text>
          {profile?.address ? (
            <Text style={styles.bizSub} numberOfLines={1}>{profile.address}</Text>
          ) : null}
        </View>
      </View>

      {/* Right */}
      <View style={styles.headerRight}>
        {/* Admin: Admin Panel button | Regular: Profile Editor */}
        {isAdmin ? (
          <TouchableOpacity
            style={[styles.headerBtn, { backgroundColor:'rgba(234,179,8,0.25)' }]}
            onPress={() => navigation.navigate('AdminPanel')}
            hitSlop={{ top:8, bottom:8, left:8, right:8 }}
          >
            <Text style={{ fontSize:16 }}>🛡️</Text>
          </TouchableOpacity>
        ) : null}

        {/* Settings — سب کو */}
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.navigate('Settings')}
          hitSlop={{ top:8, bottom:8, left:8, right:8 }}
        >
          <Text style={{ fontSize:16 }}>⚙️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Centre FAB ────────────────────────────────────────────────
function CenterFAB() {
  const navigation = useNavigation();
  const scale = React.useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue:0.88, useNativeDriver:true, speed:40 }).start();
  const onOut = () => Animated.spring(scale, { toValue:1,    useNativeDriver:true, speed:25 }).start();
  return (
    <View style={{ alignItems:'center', justifyContent:'center', top:-14 }}>
      <TouchableOpacity onPressIn={onIn} onPressOut={onOut} activeOpacity={1}
        onPress={() => navigation.navigate('InvoiceEditor', {})}>
        <Animated.View style={{
          width:62, height:62, borderRadius:31,
          backgroundColor: COLORS.slate900,
          justifyContent:'center', alignItems:'center',
          transform:[{scale}],
          shadowColor:'#000', shadowOffset:{width:0,height:6},
          shadowOpacity:0.3, shadowRadius:10, elevation:10,
          borderWidth:4, borderColor:'#fff',
        }}>
          <Text style={{ color:COLORS.primaryLight, fontSize:30, fontWeight:'900', lineHeight:34 }}>+</Text>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

// ── Calculator FAB ────────────────────────────────────────────
function CalcFAB() {
  const navigation   = useNavigation();
  const { settings } = useApp();
  const [expanded, setExpanded] = useState(false);
  const widthAnim  = useRef(new Animated.Value(44)).current;

  if (!settings.showCalcFAB) return null;

  const toggle = () => {
    const toVal = expanded ? 44 : 130;
    Animated.spring(widthAnim, { toValue:toVal, useNativeDriver:false, tension:120, friction:8 }).start();
    setExpanded(e => !e);
    if (!expanded) {
      setTimeout(() => {
        Animated.spring(widthAnim, { toValue:44, useNativeDriver:false, tension:120, friction:8 }).start();
        setExpanded(false);
      }, 4000);
    }
  };

  return (
    <Animated.View style={{ position:'absolute', bottom:74, left:0, width:widthAnim, overflow:'hidden', zIndex:99 }}>
      <TouchableOpacity
        onPress={() => { if (expanded) navigation.navigate('Calculator'); else toggle(); }}
        onLongPress={toggle}
        activeOpacity={0.85}
        style={{
          backgroundColor:'#16a34a', paddingVertical:10, paddingHorizontal:12,
          borderTopRightRadius:22, borderBottomRightRadius:22,
          flexDirection:'row', alignItems:'center',
          shadowColor:'#000', shadowOffset:{width:2,height:2},
          shadowOpacity:0.25, shadowRadius:4, elevation:6, minWidth:44,
        }}
      >
        <Text style={{ fontSize:18 }}>🧮</Text>
        {expanded && (
          <Text style={{ color:'#fff', fontWeight:'700', fontSize:12, marginLeft:6 }}>
            Calculator
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Main Tabs ─────────────────────────────────────────────────
function MainTabs() {
  const { settings } = useApp();
  const dark    = settings.mode === 'dark';
  const bg      = dark ? COLORS.surfaceDark : COLORS.white;
  const brd     = dark ? COLORS.borderDark  : COLORS.borderLight;
  const active  = COLORS.primary;
  const inactive= dark ? COLORS.slate500    : COLORS.slate400;

  return (
    <View style={{ flex:1 }}>
      <AppHeader />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor:bg, borderTopColor:brd, borderTopWidth:1,
            height:64, paddingBottom:10, paddingTop:6,
            shadowColor:'#000', shadowOffset:{width:0,height:-2},
            shadowOpacity:0.05, shadowRadius:5, elevation:8,
          },
          tabBarActiveTintColor:   active,
          tabBarInactiveTintColor: inactive,
          tabBarLabelStyle: { fontSize:10, fontWeight:'600', marginTop:2 },
        }}
      >
        <Tab.Screen name="Home"      component={HomeScreen}
          options={{ tabBarLabel:'Home',      tabBarIcon:({focused,color})=><NavIcon Icon={IconLayoutDashboard} focused={focused} color={color} size={22}/> }} />
        <Tab.Screen name="Stock"     component={StockScreen}
          options={{ tabBarLabel:'Stock',     tabBarIcon:({focused,color})=><NavIcon Icon={IconPackage}         focused={focused} color={color} size={22}/> }} />
        <Tab.Screen name="NewInvoiceTab" component={HomeScreen}
          options={{ tabBarLabel:'', tabBarIcon:()=>null, tabBarButton:()=><CenterFAB /> }} />
        <Tab.Screen name="Customers" component={CustomerListScreen}
          options={{ tabBarLabel:'Customers', tabBarIcon:({focused,color})=><NavIcon Icon={IconUsers}           focused={focused} color={color} size={22}/> }} />
        <Tab.Screen name="Analytics" component={AnalyticsScreen}
          options={{ tabBarLabel:'Insights',  tabBarIcon:({focused,color})=><NavIcon Icon={IconTrendingUp}      focused={focused} color={color} size={22}/> }} />
      </Tab.Navigator>
      <CalcFAB />
    </View>
  );
}

// ── Root Navigator ────────────────────────────────────────────
export default function AppNavigator() {
  const { user, isGuest, loading, isLocked, userPlan, isAdmin } = useApp();

  // App loading — SplashScreen دکھائیں
  if (loading) return <SplashScreen />;

  // Logged in but plan not loaded yet — SplashScreen
  if (user && !isGuest && userPlan === null) return <SplashScreen />;

  // Not logged in
  if (!user && !isGuest) return <LoginScreen />;

  // Locked (PIN screen)
  if (isLocked) return <PinScreen />;

  // Pending — admin کو یہ نہیں دکھے گا
  if (user && !isGuest && !isAdmin && userPlan === 'pending') return <PendingScreen />;

  // Blocked
  if (user && !isGuest && userPlan === 'blocked') return <BlockedScreen />;

  return (
    <Stack.Navigator screenOptions={{
      headerShown: false,
      animation: 'slide_from_right',
      gestureEnabled: true,
    }}>
      <Stack.Screen name="Main"           component={MainTabs}            options={{ animation:'none' }} />
      <Stack.Screen name="AdminPanel"     component={AdminPanelScreen}    options={{ animation:'slide_from_bottom' }} />
      <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} />
      <Stack.Screen name="InvoiceEditor"  component={InvoiceEditorScreen}  options={{ animation:'slide_from_bottom' }} />
      <Stack.Screen name="InvoiceView"    component={InvoiceViewScreen} />
      <Stack.Screen name="AllInvoices"    component={AllInvoicesScreen} />
      <Stack.Screen name="Settings"       component={SettingsScreen} />
      <Stack.Screen name="Calculator"     component={CalculatorScreen}     options={{ animation:'slide_from_bottom' }} />
      <Stack.Screen name="ProfileEditor"  component={ProfileEditorScreen} />
      <Stack.Screen name="ActivityLogs"   component={ActivityLogsScreen} />
      <Stack.Screen name="Cheques"        component={ChequesScreen} />
      <Stack.Screen name="Expenses"       component={ExpensesScreen} />
      <Stack.Screen name="OrderTracking"   component={OrderTrackingScreen} />
      <Stack.Screen name="PendingOrders"   component={PendingOrdersScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  appHeader:  { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:SPACING.lg, paddingVertical:12 },
  headerLeft: { flexDirection:'row', alignItems:'center', gap:SPACING.md, flex:1 },
  logoBox:    { width:40, height:40, borderRadius:10, justifyContent:'center', alignItems:'center', shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.2, shadowRadius:4, elevation:3 },
  logoText:   { color:'#fff', fontWeight:'900', fontSize:FONT.xl },
  bizName:    { color:'#fff', fontWeight:'700', fontSize:FONT.base, lineHeight:20 },
  bizSub:     { color:'rgba(255,255,255,0.65)', fontSize:10, lineHeight:14 },
  headerRight:{ flexDirection:'row', gap:SPACING.sm },
  headerBtn:  { backgroundColor:'rgba(255,255,255,0.15)', width:36, height:36, borderRadius:18, justifyContent:'center', alignItems:'center' },
});
