// ── Tab Bar SVG Icons — HTML کی طرح exact ────────────────────
import React from 'react';
import { Animated } from 'react-native';
import Svg, { Rect, Polyline, Path, Line, Circle } from 'react-native-svg';

// LayoutDashboard icon (HTML میں Home tab)
export function IconLayoutDashboard({ color, size = 24 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="3" width="7" height="9"/>
      <Rect x="14" y="3" width="7" height="5"/>
      <Rect x="14" y="12" width="7" height="9"/>
      <Rect x="3" y="16" width="7" height="5"/>
    </Svg>
  );
}

// Package icon (Stock tab)
export function IconPackage({ color, size = 24 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/>
      <Path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
      <Polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <Line x1="12" y1="22.08" x2="12" y2="12"/>
    </Svg>
  );
}

// Users icon (Customers tab)
export function IconUsers({ color, size = 24 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <Circle cx="9" cy="7" r="4"/>
      <Path d="M23 21v-2a4 4 0 00-3-3.87"/>
      <Path d="M16 3.13a4 4 0 010 7.75"/>
    </Svg>
  );
}

// TrendingUp icon (Insights tab)
export function IconTrendingUp({ color, size = 24 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <Polyline points="17 6 23 6 23 12"/>
    </Svg>
  );
}

// Animated wrapper — HTML NavBtn کی طرح scale on active
export function NavIcon({ Icon, focused, color, size = 24 }) {
  const scale = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.15 : 1,
      useNativeDriver: true,
      tension: 180, friction: 8,
    }).start();
  }, [focused]);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Icon color={color} size={size} />
    </Animated.View>
  );
}
