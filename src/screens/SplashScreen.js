import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions } from 'react-native';
import { COLORS } from '../utils/theme';
import { checkAppIntegrity } from '../services/appIntegrity';

const { width: SW } = Dimensions.get('window');

export default function SplashScreen() {
  // Animations
  const logoScale   = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textSlide   = useRef(new Animated.Value(20)).current;
  const dotAnim     = useRef(new Animated.Value(0)).current;
  const ringScale   = useRef(new Animated.Value(0.5)).current;
  const ringOpacity = useRef(new Animated.Value(0.6)).current;

  const [integrityFailed, setIntegrityFailed] = React.useState(false);
  const [integrityChecked, setIntegrityChecked] = React.useState(false);

  useEffect(() => {
    // App integrity check — 1 سیکنڈ بعد چیک کریں تاکہ splash animation پہلے دکھے
    setTimeout(() => {
      checkAppIntegrity().then(result => {
        setIntegrityChecked(true);
        if (!result.ok) setIntegrityFailed(true);
      });
    }, 1200);

    // Ring pulse
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ringScale,   { toValue:1.5, duration:900, useNativeDriver:true }),
          Animated.timing(ringOpacity, { toValue:0,   duration:900, useNativeDriver:true }),
        ]),
        Animated.parallel([
          Animated.timing(ringScale,   { toValue:0.5, duration:0,   useNativeDriver:true }),
          Animated.timing(ringOpacity, { toValue:0.6, duration:0,   useNativeDriver:true }),
        ]),
      ])
    ).start();

    // Logo entrance
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale,   { toValue:1, tension:60, friction:7, useNativeDriver:true }),
        Animated.timing(logoOpacity, { toValue:1, duration:400, useNativeDriver:true }),
      ]),
      // Text slide in
      Animated.parallel([
        Animated.timing(textOpacity, { toValue:1, duration:350, useNativeDriver:true }),
        Animated.timing(textSlide,   { toValue:0, duration:350, useNativeDriver:true }),
      ]),
    ]).start();

    // Loading dots loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue:1, duration:600, useNativeDriver:true }),
        Animated.timing(dotAnim, { toValue:0, duration:600, useNativeDriver:true }),
      ])
    ).start();
  }, []);

  const dot1 = dotAnim.interpolate({ inputRange:[0,0.33,1], outputRange:[0.3,1,0.3] });
  const dot2 = dotAnim.interpolate({ inputRange:[0,0.5,1],  outputRange:[0.3,1,0.3] });
  const dot3 = dotAnim.interpolate({ inputRange:[0,0.66,1], outputRange:[0.3,1,0.3] });

  if (integrityChecked && integrityFailed) {
    return (
      <View style={[styles.root, { justifyContent:'center', alignItems:'center', padding:40 }]}>
        <Text style={{ fontSize:48, marginBottom:20 }}>🚫</Text>
        <Text style={{ color:'#fff', fontSize:20, fontWeight:'800', textAlign:'center', marginBottom:12 }}>
          Unauthorized App
        </Text>
        <Text style={{ color:'rgba(255,255,255,0.6)', fontSize:13, textAlign:'center', lineHeight:20 }}>
          {'This version of the app is not authorized.\nPlease download the official version.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Background circles */}
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />

      {/* Logo area */}
      <View style={styles.center}>
        {/* Pulse ring */}
        <Animated.View style={[
          styles.ring,
          { transform:[{scale:ringScale}], opacity:ringOpacity }
        ]} />

        {/* Logo */}
        <Animated.View style={[
          styles.logoBox,
          { transform:[{scale:logoScale}], opacity:logoOpacity }
        ]}>
          <Text style={styles.logoEmoji}>🌲</Text>
        </Animated.View>

        {/* App name */}
        <Animated.View style={{
          opacity: textOpacity,
          transform:[{ translateY: textSlide }],
          alignItems:'center',
          marginTop: 20,
        }}>
          <Text style={styles.appName}>Timber 360</Text>
          <Text style={styles.tagline}>Doors & Wood Business Manager</Text>
        </Animated.View>

        {/* Loading dots */}
        <View style={styles.dotsRow}>
          {[dot1, dot2, dot3].map((anim, i) => (
            <Animated.View
              key={i}
              style={[styles.dot, { opacity: anim }]}
            />
          ))}
        </View>
      </View>

      {/* Footer */}
      <Animated.Text style={[styles.footer, { opacity:textOpacity }]}>
        Loading your workspace...
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root:      {
    flex:1,
    backgroundColor: '#0f4c2a',
    justifyContent:'center',
    alignItems:'center',
  },
  bgCircle1: {
    position:'absolute', top:-80, right:-80,
    width:280, height:280, borderRadius:140,
    backgroundColor:'rgba(255,255,255,0.05)',
  },
  bgCircle2: {
    position:'absolute', bottom:-60, left:-60,
    width:220, height:220, borderRadius:110,
    backgroundColor:'rgba(255,255,255,0.04)',
  },
  center:    { alignItems:'center' },
  ring:      {
    position:'absolute',
    width:120, height:120, borderRadius:60,
    borderWidth:2, borderColor:'rgba(255,255,255,0.3)',
  },
  logoBox:   {
    width:100, height:100, borderRadius:28,
    backgroundColor:'#166534',
    justifyContent:'center', alignItems:'center',
    shadowColor:'#000',
    shadowOffset:{ width:0, height:8 },
    shadowOpacity:0.4, shadowRadius:16,
    elevation:12,
    borderWidth:2, borderColor:'rgba(255,255,255,0.15)',
  },
  logoEmoji: { fontSize:52 },
  appName:   {
    color:'#fff', fontSize:32, fontWeight:'900',
    letterSpacing:0.5,
  },
  tagline:   {
    color:'rgba(255,255,255,0.6)',
    fontSize:12, marginTop:4, letterSpacing:0.3,
  },
  dotsRow:   {
    flexDirection:'row', gap:8,
    marginTop:40,
  },
  dot:       {
    width:8, height:8, borderRadius:4,
    backgroundColor:'rgba(255,255,255,0.8)',
  },
  footer:    {
    position:'absolute', bottom:48,
    color:'rgba(255,255,255,0.4)',
    fontSize:12, letterSpacing:0.5,
  },
});
