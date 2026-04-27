import React, { Component } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING, RADIUS, FONT } from '../../utils/theme';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Timber360 Crash:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.root}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>Something Went Wrong</Text>
          <Text style={styles.msg}>
            The app crashed. Please restart.
          </Text>
          {this.state.error?.message ? (
            <View style={styles.errBox}>
              <Text style={styles.errText}>{String(this.state.error.message)}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.btn}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={styles.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root:   { flex:1, justifyContent:'center', alignItems:'center', padding:SPACING.xl, backgroundColor:COLORS.bgLight },
  icon:   { fontSize:64, marginBottom:SPACING.lg },
  title:  { fontSize:FONT.xxl, fontWeight:'800', color:COLORS.textLight, marginBottom:SPACING.md, textAlign:'center' },
  msg:    { fontSize:FONT.base, color:COLORS.slate500, textAlign:'center', marginBottom:SPACING.xl, lineHeight:22 },
  errBox: { backgroundColor:COLORS.red50, borderRadius:RADIUS.md, padding:SPACING.md, marginBottom:SPACING.xl, width:'100%' },
  errText:{ color:COLORS.danger, fontSize:FONT.xs, fontFamily:'monospace' },
  btn:    { backgroundColor:COLORS.primary, paddingHorizontal:SPACING.xxxl, paddingVertical:SPACING.md, borderRadius:RADIUS.xl },
  btnText:{ color:COLORS.white, fontWeight:'800', fontSize:FONT.md },
});

export default ErrorBoundary;
