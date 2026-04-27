// ── AnalyticsScreen — exact port from HTML AnalyticsDashboard ─
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { FadeSlideIn, ScalePress } from '../components/ui/Animated';
import { COLORS, SPACING, RADIUS, FONT, SHADOW } from '../utils/theme';
import { formatMoney, formatDate } from '../utils/helpers';
import { calculateLedgerBalance, safeParseAmount } from '../utils/ledger';
import { EXPENSE_CATEGORIES } from '../utils/calculations';

const Card = ({ children, style }) => (
  <View style={[{ backgroundColor:'#fff', borderRadius:RADIUS.xl, padding:SPACING.lg, marginBottom:SPACING.md, borderWidth:1, borderColor:'#e2e8f0', ...SHADOW.sm }, style]}>
    {children}
  </View>
);

export default function AnalyticsScreen() {
  const navigation = useNavigation();
  const { invoices, customers, cheques, stock, expenses, settings, setSettings } = useApp();
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput,   setGoalInput]   = useState('');
  const dark = settings.mode === 'dark';
  const bg   = dark ? COLORS.bgDark   : '#f8fafc';
  const text = dark ? COLORS.textDark : COLORS.textLight;
  const sub  = dark ? COLORS.slate400 : COLORS.slate500;
  const card = dark ? COLORS.surfaceDark : COLORS.white;
  const brd  = dark ? COLORS.borderDark  : '#e2e8f0';

  const cardStyle = { backgroundColor:card, borderColor:brd };

  // ── Financial Metrics ──────────────────────────────────────
  const totalSales = invoices.reduce((sum, inv) => sum + safeParseAmount(inv.total), 0);
  const totalPaid  = customers.reduce((sum, cust) => {
    const { sortedLedger } = calculateLedgerBalance(cust.ledger, { useEffective:true });
    return sum + sortedLedger.filter(tx=>tx.type==='Credit'&&!tx._skipped).reduce((a,b)=>a+safeParseAmount(b.amount),0);
  }, 0);
  const totalReceivables = customers.reduce((sum, cust) => {
    const { finalBalance } = calculateLedgerBalance(cust.ledger, { useEffective:true });
    return sum + (finalBalance > 0 ? finalBalance : 0);
  }, 0);
  const totalExpenses = (expenses||[]).reduce((sum,e)=>sum+safeParseAmount(e.amount),0);
  const liveProfit    = invoices.reduce((sum,inv)=>sum+(inv.items||[]).reduce((a,i)=>a+(parseFloat(i.profit)||0),0),0);
  const netProfit     = liveProfit - totalExpenses;

  // ── Cheque Stats ───────────────────────────────────────────
  const pendingCheques  = cheques.filter(c=>c.status==='pending');
  const returnedCheques = cheques.filter(c=>c.status==='returned');
  const clearedCheques  = cheques.filter(c=>c.status==='cleared');
  const pendingAmount   = pendingCheques.reduce((s,c)=>s+safeParseAmount(c.amount),0);
  const returnedAmount  = returnedCheques.reduce((s,c)=>s+safeParseAmount(c.amount),0);

  // ── Stock Stats ────────────────────────────────────────────
  const lowStockItems = stock.filter(i=>(parseFloat(i.qty)||0)<5);
  const outOfStock    = stock.filter(i=>(parseFloat(i.qty)||0)===0);
  const stockValue    = stock.reduce((s,i)=>s+((parseFloat(i.qty)||0)*(parseFloat(i.costRate)||parseFloat(i.rate)||0)),0);

  // ── Customer Stats ─────────────────────────────────────────
  const getBalance = c => calculateLedgerBalance(c.ledger,{useEffective:true}).finalBalance;
  const customersWithBalance = customers.filter(c=>getBalance(c)>0);
  const highRiskCustomers    = customersWithBalance.filter(c=>getBalance(c)>100000);
  const topCustomers = customers.map(c=>{
    const custInvs   = invoices.filter(i=>i.customer&&String(i.customer.id)===String(c.id));
    const totalBilled= custInvs.reduce((s,inv)=>s+safeParseAmount(inv.total),0);
    return { ...c, totalBilled, balance:getBalance(c), invoiceCount:custInvs.length };
  }).filter(c=>c.totalBilled>0).sort((a,b)=>b.totalBilled-a.totalBilled).slice(0,5);

  // ── Time-based ─────────────────────────────────────────────
  const today      = new Date().toDateString();
  const thisMonth  = new Date().getMonth();
  const thisYear   = new Date().getFullYear();
  const todaySales = invoices.filter(i=>new Date(i.date).toDateString()===today);
  const todayRevenue = todaySales.reduce((s,i)=>s+safeParseAmount(i.total),0);
  const monthSales = invoices.filter(i=>{const d=new Date(i.date);return d.getMonth()===thisMonth&&d.getFullYear()===thisYear;});
  const monthRevenue = monthSales.reduce((s,i)=>s+safeParseAmount(i.total),0);

  // ── Health Score ───────────────────────────────────────────
  const collectionRate  = totalSales>0 ? (totalPaid/totalSales)*100 : 0;
  const chequeReturnRate= cheques.length>0 ? (returnedCheques.length/cheques.length)*100 : 0;
  const stockHealth     = stock.length>0 ? ((stock.length-outOfStock.length)/stock.length)*100 : 100;
  const healthScore     = Math.round((collectionRate*0.4)+((100-chequeReturnRate)*0.3)+(stockHealth*0.3));

  // ── Smart Insights ─────────────────────────────────────────
  const insights = [];
  if (returnedCheques.length>0) insights.push({ type:'warning', icon:'⚠️', title:'Cheque Returns Alert', message:`${returnedCheques.length} cheque${returnedCheques.length>1?'s':''} returned - ${formatMoney(returnedAmount,settings.currency)}`, priority:1 });
  if (lowStockItems.length>0)   insights.push({ type:'warning', icon:'📦', title:'Low Stock Alert', message:`${lowStockItems.length} item${lowStockItems.length>1?'s':''} running low`, priority:2 });
  if (highRiskCustomers.length>0) insights.push({ type:'danger', icon:'👥', title:'High Balance Customers', message:`${highRiskCustomers.length} customer${highRiskCustomers.length>1?'s':''} with >100k balance`, priority:1 });
  if (totalReceivables>500000)  insights.push({ type:'info', icon:'📈', title:'High Receivables', message:`Focus on collections - ${formatMoney(totalReceivables,settings.currency)} pending`, priority:3 });
  if (collectionRate>80)        insights.push({ type:'success', icon:'✅', title:'Great Collection Rate!', message:`You're collecting ${Math.round(collectionRate)}% of sales`, priority:4 });
  insights.sort((a,b)=>a.priority-b.priority);

  const insightStyle = {
    warning:{ bg:dark?'rgba(251,146,60,0.1)':'#fff7ed', border:COLORS.warning },
    danger: { bg:dark?'rgba(248,113,113,0.1)':'#fef2f2', border:COLORS.danger  },
    info:   { bg:dark?'rgba(96,165,250,0.1)' :'#eff6ff', border:COLORS.info    },
    success:{ bg:dark?'rgba(74,222,128,0.1)' :'#f0fdf4', border:COLORS.success },
  };

  // ── Last 7 days ────────────────────────────────────────────
  const last7 = [];
  for (let i=6; i>=0; i--) {
    const d = new Date(); d.setDate(d.getDate()-i);
    const ds = d.toDateString();
    const rev = invoices.filter(inv=>new Date(inv.date).toDateString()===ds).reduce((s,inv)=>s+safeParseAmount(inv.total),0);
    last7.push({ label: d.toLocaleDateString('en',{weekday:'short'}), rev });
  }
  const maxRev = Math.max(...last7.map(d=>d.rev), 1);

  return (
    <ScrollView style={[styles.root,{backgroundColor:bg}]} contentContainerStyle={styles.content}>

      {/* Header */}
      <FadeSlideIn delay={0}>
        <View style={[styles.headerGrad]}>
          <View style={{flex:1}}>
            <Text style={{fontSize:FONT.xxl,fontWeight:'800',color:COLORS.white}}>📈 Business Insights</Text>
            <Text style={{color:'rgba(255,255,255,0.8)',fontSize:FONT.sm,marginTop:4}}>Your business at a glance</Text>
          </View>

        </View>
      </FadeSlideIn>

      {/* Business Health Score */}
      <FadeSlideIn delay={60}>
        <Card style={cardStyle}>
          <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:SPACING.md}}>
            <View>
              <Text style={{fontSize:FONT.lg,fontWeight:'700',color:text}}>Business Health Score</Text>
              <Text style={{fontSize:FONT.xs,color:sub,marginTop:2}}>Overall performance indicator</Text>
            </View>
            <Text style={{fontSize:36,fontWeight:'900',color:healthScore>=80?COLORS.success:healthScore>=60?COLORS.warning:COLORS.danger}}>
              {healthScore}<Text style={{fontSize:FONT.md}}>/100</Text>
            </Text>
          </View>
          {/* Progress bar */}
          <View style={{height:12,backgroundColor:dark?COLORS.slate700:'#e2e8f0',borderRadius:6,overflow:'hidden',marginBottom:SPACING.md}}>
            <View style={{height:12,width:`${healthScore}%`,backgroundColor:healthScore>=80?COLORS.success:healthScore>=60?COLORS.warning:COLORS.danger,borderRadius:6}} />
          </View>
          {/* Score breakdown */}
          <View style={{flexDirection:'row'}}>
            <View style={{flex:1,alignItems:'center'}}>
              <Text style={{fontSize:FONT.xl,fontWeight:'800',color:COLORS.success}}>{Math.round(collectionRate)}%</Text>
              <Text style={{fontSize:FONT.xs,color:sub}}>Collection Rate</Text>
            </View>
            <View style={{flex:1,alignItems:'center'}}>
              <Text style={{fontSize:FONT.xl,fontWeight:'800',color:COLORS.blue600}}>{Math.round(100-chequeReturnRate)}%</Text>
              <Text style={{fontSize:FONT.xs,color:sub}}>Cheque Success</Text>
            </View>
            <View style={{flex:1,alignItems:'center'}}>
              <Text style={{fontSize:FONT.xl,fontWeight:'800',color:'#9333ea'}}>{Math.round(stockHealth)}%</Text>
              <Text style={{fontSize:FONT.xs,color:sub}}>Stock Health</Text>
            </View>
          </View>
        </Card>
      </FadeSlideIn>

      {/* Smart Alerts */}
      {insights.length>0 && (
        <FadeSlideIn delay={80}>
          <Text style={[styles.sectionLabel,{color:sub}]}>SMART ALERTS</Text>
          {insights.map((ins,i)=>{
            const s = insightStyle[ins.type]||insightStyle.info;
            return (
              <View key={i} style={[styles.insightCard,{backgroundColor:s.bg,borderLeftColor:s.border}]}>
                <Text style={{fontSize:20,marginRight:SPACING.sm}}>{ins.icon}</Text>
                <View style={{flex:1}}>
                  <Text style={{color:text,fontWeight:'700',fontSize:FONT.sm}}>{ins.title}</Text>
                  <Text style={{color:sub,fontSize:FONT.xs,marginTop:2}}>{ins.message}</Text>
                </View>
              </View>
            );
          })}
        </FadeSlideIn>
      )}

      {/* Financial Overview */}
      <FadeSlideIn delay={100}>
        <Text style={[styles.sectionLabel,{color:sub}]}>FINANCIAL OVERVIEW</Text>
        <View style={styles.row2}>
          <Card style={[styles.card2,{backgroundColor:dark?'#052e16':'#f0fdf4',borderColor:dark?COLORS.green700:'#bbf7d0'}]}>
            <Text style={{color:COLORS.green600,fontSize:FONT.xs,fontWeight:'700',textTransform:'uppercase'}}>Today Revenue</Text>
            <Text style={{color:text,fontSize:FONT.xxl,fontWeight:'800',marginVertical:4}}>{formatMoney(todayRevenue,settings.currency)}</Text>
            <Text style={{color:sub,fontSize:FONT.xs}}>{todaySales.length} invoice{todaySales.length!==1?'s':''}</Text>
          </Card>
          <Card style={[styles.card2,{backgroundColor:dark?'#1e1b4b':'#eff6ff',borderColor:dark?COLORS.indigo600:'#bfdbfe'}]}>
            <Text style={{color:COLORS.blue600,fontSize:FONT.xs,fontWeight:'700',textTransform:'uppercase'}}>This Month</Text>
            <Text style={{color:text,fontSize:FONT.xxl,fontWeight:'800',marginVertical:4}}>{formatMoney(monthRevenue,settings.currency)}</Text>
            <Text style={{color:sub,fontSize:FONT.xs}}>{monthSales.length} invoice{monthSales.length!==1?'s':''}</Text>
          </Card>
        </View>
        <View style={styles.row2}>
          <Card style={[styles.card2,{backgroundColor:dark?'#431407':'#fff7ed',borderColor:dark?'#9a3412':'#fed7aa'}]}>
            <Text style={{color:COLORS.warning,fontSize:FONT.xs,fontWeight:'700',textTransform:'uppercase'}}>Receivables</Text>
            <Text style={{color:text,fontSize:FONT.xxl,fontWeight:'800',marginVertical:4}}>{formatMoney(totalReceivables,settings.currency)}</Text>
            <Text style={{color:sub,fontSize:FONT.xs}}>{customersWithBalance.length} customer{customersWithBalance.length!==1?'s':''}</Text>
          </Card>
          <Card style={[styles.card2,{backgroundColor:dark?'#2e1065':'#faf5ff',borderColor:dark?'#6b21a8':'#e9d5ff'}]}>
            <Text style={{color:'#9333ea',fontSize:FONT.xs,fontWeight:'700',textTransform:'uppercase'}}>Stock Value</Text>
            <Text style={{color:text,fontSize:FONT.xxl,fontWeight:'800',marginVertical:4}}>{formatMoney(stockValue,settings.currency)}</Text>
            <Text style={{color:sub,fontSize:FONT.xs}}>{stock.length} item{stock.length!==1?'s':''}</Text>
          </Card>
        </View>
      </FadeSlideIn>

      {/* Profit & Expenses */}
      <FadeSlideIn delay={120}>
        <Text style={[styles.sectionLabel,{color:sub}]}>PROFIT & EXPENSES</Text>
        <View style={styles.row3}>
          <Card style={[styles.card3,{backgroundColor:dark?'#022c22':'#ecfdf5',borderColor:dark?'#065f46':'#a7f3d0'}]}>
            <Text style={{color:'#059669',fontSize:9,fontWeight:'700',textTransform:'uppercase'}}>Gross Profit</Text>
            <Text style={{color:text,fontSize:FONT.lg,fontWeight:'800',marginVertical:4}}>{formatMoney(liveProfit,settings.currency)}</Text>
            <Text style={{color:sub,fontSize:9}}>Live invoices only</Text>
          </Card>
          <Card style={[styles.card3,{backgroundColor:dark?'#450a0a':'#fef2f2',borderColor:dark?'#7f1d1d':'#fecaca'}]}>
            <Text style={{color:COLORS.danger,fontSize:9,fontWeight:'700',textTransform:'uppercase'}}>Total Expenses</Text>
            <Text style={{color:text,fontSize:FONT.lg,fontWeight:'800',marginVertical:4}}>{formatMoney(totalExpenses,settings.currency)}</Text>
            <Text style={{color:sub,fontSize:9}}>{(expenses||[]).length} entries</Text>
          </Card>
          <Card style={[styles.card3,{backgroundColor:netProfit>=0?(dark?'#052e16':'#f0fdf4'):(dark?'#450a0a':'#fef2f2'),borderColor:netProfit>=0?(dark?COLORS.green700:'#bbf7d0'):(dark?'#7f1d1d':'#fecaca')}]}>
            <Text style={{color:netProfit>=0?COLORS.success:COLORS.danger,fontSize:9,fontWeight:'700',textTransform:'uppercase'}}>Net Profit</Text>
            <Text style={{color:text,fontSize:FONT.lg,fontWeight:'800',marginVertical:4}}>{formatMoney(netProfit,settings.currency)}</Text>
            <Text style={{color:sub,fontSize:9}}>{liveProfit>0?`${((netProfit/liveProfit)*100).toFixed(1)}% margin`:'Add cost rates'}</Text>
          </Card>
        </View>
        {/* Expenses by category */}
        {(expenses||[]).length>0 && (
          <Card style={cardStyle}>
            <Text style={{color:sub,fontSize:FONT.xs,fontWeight:'700',textTransform:'uppercase',marginBottom:SPACING.md}}>Expenses by Category</Text>
            {EXPENSE_CATEGORIES.map(cat=>{
              const catTotal=(expenses||[]).filter(e=>e.category===cat).reduce((a,e)=>a+safeParseAmount(e.amount),0);
              if (!catTotal) return null;
              const pct=totalExpenses>0?(catTotal/totalExpenses*100):0;
              return (
                <View key={cat} style={{marginBottom:SPACING.sm}}>
                  <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:3}}>
                    <Text style={{color:text,fontSize:FONT.sm}}>{cat}</Text>
                    <Text style={{color:text,fontWeight:'700',fontSize:FONT.sm}}>{formatMoney(catTotal,settings.currency)}</Text>
                  </View>
                  <View style={{height:6,backgroundColor:dark?COLORS.slate700:'#f1f5f9',borderRadius:3}}>
                    <View style={{height:6,backgroundColor:COLORS.danger,borderRadius:3,width:`${pct}%`}} />
                  </View>
                </View>
              );
            })}
          </Card>
        )}
      </FadeSlideIn>

      {/* Cheque Status */}
      <FadeSlideIn delay={140}>
        <Text style={[styles.sectionLabel,{color:sub}]}>CHEQUE STATUS</Text>
        <View style={styles.row3}>
          <Card style={[styles.card3,{backgroundColor:dark?'#431407':'#fff7ed',borderColor:dark?'#9a3412':'#fed7aa'}]}>
            <Text style={{color:COLORS.warning,fontSize:FONT.xs,fontWeight:'700'}}>Pending</Text>
            <Text style={{color:text,fontSize:FONT.xl,fontWeight:'800',marginVertical:4}}>{pendingCheques.length}</Text>
            <Text style={{color:sub,fontSize:FONT.xs}}>{formatMoney(pendingAmount,settings.currency)}</Text>
          </Card>
          <Card style={[styles.card3,{backgroundColor:dark?'#052e16':'#f0fdf4',borderColor:dark?COLORS.green700:'#bbf7d0'}]}>
            <Text style={{color:COLORS.success,fontSize:FONT.xs,fontWeight:'700'}}>Cleared</Text>
            <Text style={{color:text,fontSize:FONT.xl,fontWeight:'800',marginVertical:4}}>{clearedCheques.length}</Text>
          </Card>
          <Card style={[styles.card3,{backgroundColor:dark?'#450a0a':'#fef2f2',borderColor:dark?'#7f1d1d':'#fecaca'}]}>
            <Text style={{color:COLORS.danger,fontSize:FONT.xs,fontWeight:'700'}}>Returned</Text>
            <Text style={{color:text,fontSize:FONT.xl,fontWeight:'800',marginVertical:4}}>{returnedCheques.length}</Text>
            <Text style={{color:sub,fontSize:FONT.xs}}>{formatMoney(returnedAmount,settings.currency)}</Text>
          </Card>
        </View>
      </FadeSlideIn>

      {/* Stock Alerts */}
      {(lowStockItems.length>0||outOfStock.length>0) && (
        <FadeSlideIn delay={160}>
          <Text style={[styles.sectionLabel,{color:sub}]}>STOCK ALERTS</Text>
          <View style={styles.row2}>
            {outOfStock.length>0 && (
              <Card style={[styles.card2,{backgroundColor:dark?'#450a0a':'#fef2f2',borderColor:dark?'#7f1d1d':'#fecaca'}]}>
                <View style={{flexDirection:'row',alignItems:'center',gap:SPACING.sm}}>
                  <Text style={{fontSize:22}}>🚫</Text>
                  <View>
                    <Text style={{color:COLORS.danger,fontSize:FONT.xs,fontWeight:'700'}}>Out of Stock</Text>
                    <Text style={{color:text,fontSize:FONT.xxl,fontWeight:'800'}}>{outOfStock.length}</Text>
                  </View>
                </View>
              </Card>
            )}
            {lowStockItems.length>0 && (
              <Card style={[styles.card2,{backgroundColor:dark?'#431407':'#fff7ed',borderColor:dark?'#9a3412':'#fed7aa'}]}>
                <View style={{flexDirection:'row',alignItems:'center',gap:SPACING.sm}}>
                  <Text style={{fontSize:22}}>📦</Text>
                  <View>
                    <Text style={{color:COLORS.warning,fontSize:FONT.xs,fontWeight:'700'}}>Low Stock</Text>
                    <Text style={{color:text,fontSize:FONT.xxl,fontWeight:'800'}}>{lowStockItems.length}</Text>
                    <Text style={{color:sub,fontSize:FONT.xs}}>Below 5 units</Text>
                  </View>
                </View>
              </Card>
            )}
          </View>
        </FadeSlideIn>
      )}

      {/* Top 5 Customers */}
      {topCustomers.length>0 && (
        <FadeSlideIn delay={180}>
          <Text style={[styles.sectionLabel,{color:sub}]}>TOP 5 CUSTOMERS</Text>
          <Card style={[{padding:0,overflow:'hidden'},cardStyle]}>
            {topCustomers.map((cust,idx)=>(
              <ScalePress key={cust.id}
                style={[styles.custRow,{borderBottomColor:brd,backgroundColor:card}]}
                onPress={()=>navigation.navigate('CustomerDetail',{customerId:cust.id})}
              >
                <View style={[styles.rankBadge,{backgroundColor:idx===0?'#eab308':idx===1?COLORS.slate400:idx===2?'#b45309':COLORS.blue600}]}>
                  <Text style={{color:COLORS.white,fontWeight:'800',fontSize:FONT.sm}}>{idx+1}</Text>
                </View>
                <View style={{flex:1,marginLeft:SPACING.md}}>
                  <Text style={{color:text,fontWeight:'700',fontSize:FONT.base}}>{cust.name}</Text>
                  <Text style={{color:sub,fontSize:FONT.xs}}>{cust.invoiceCount} invoice{cust.invoiceCount!==1?'s':''}</Text>
                </View>
                <View style={{alignItems:'flex-end'}}>
                  <Text style={{color:text,fontWeight:'700',fontSize:FONT.base}}>{formatMoney(cust.totalBilled,settings.currency)}</Text>
                  {cust.balance>0 && <Text style={{color:COLORS.danger,fontSize:FONT.xs}}>Due: {formatMoney(cust.balance,settings.currency)}</Text>}
                </View>
              </ScalePress>
            ))}
          </Card>
        </FadeSlideIn>
      )}

      {/* Last 7 Days Bar Chart */}
      <FadeSlideIn delay={200}>
        <Text style={[styles.sectionLabel,{color:sub}]}>SALES TREND — LAST 7 DAYS</Text>
        <Card style={cardStyle}>
          <View style={{flexDirection:'row',justifyContent:'space-around',alignItems:'flex-end',height:100,paddingTop:8}}>
            {last7.map((d,i)=>(
              <View key={i} style={{alignItems:'center',flex:1}}>
                <View style={{
                  width:'80%',
                  height:Math.max(4,(d.rev/maxRev)*80),
                  backgroundColor:d.rev>0?(dark?COLORS.blue600:'#3b82f6'):(dark?COLORS.slate700:'#e2e8f0'),
                  borderRadius:4,
                  marginBottom:4,
                }} />
                <Text style={{color:sub,fontSize:9,fontWeight:'700'}}>{d.label}</Text>
              </View>
            ))}
          </View>
          <View style={{marginTop:SPACING.md,paddingTop:SPACING.sm,borderTopWidth:1,borderTopColor:brd,alignItems:'center'}}>
            <Text style={{color:sub,fontSize:FONT.xs}}>
              Total: <Text style={{color:text,fontWeight:'700'}}>{formatMoney(last7.reduce((s,d)=>s+d.rev,0),settings.currency)}</Text>
            </Text>
          </View>
        </Card>
      </FadeSlideIn>

      {/* Performance Comparison: this month vs last month */}
      <FadeSlideIn delay={220}>
        {(() => {
          const tM  = new Date().getMonth();
          const tY  = new Date().getFullYear();
          const lM  = tM===0?11:tM-1;
          const lY  = tM===0?tY-1:tY;
          const MN  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          const thisInvs = invoices.filter(i=>{const d=new Date(i.date);return d.getMonth()===tM&&d.getFullYear()===tY;});
          const lastInvs = invoices.filter(i=>{const d=new Date(i.date);return d.getMonth()===lM&&d.getFullYear()===lY;});
          const thisRev  = thisInvs.reduce((s,i)=>s+safeParseAmount(i.total),0);
          const lastRev  = lastInvs.reduce((s,i)=>s+safeParseAmount(i.total),0);
          const growth   = lastRev>0?((thisRev-lastRev)/lastRev*100):0;
          return (
            <View>
              <Text style={[styles.sectionLabel,{color:sub}]}>PERFORMANCE COMPARISON</Text>
              <View style={styles.row2}>
                <Card style={[styles.card2,{backgroundColor:dark?'#1e1b4b':'#eff6ff',borderColor:dark?COLORS.indigo600:'#bfdbfe'}]}>
                  <Text style={{color:COLORS.blue600,fontSize:FONT.xs,fontWeight:'700'}}>{MN[tM]} {tY}</Text>
                  <Text style={{color:text,fontSize:FONT.xxl,fontWeight:'800',marginVertical:4}}>{formatMoney(thisRev,settings.currency)}</Text>
                  <Text style={{color:sub,fontSize:FONT.xs}}>{thisInvs.length} invoices</Text>
                </Card>
                <Card style={[styles.card2,{backgroundColor:card,borderColor:brd}]}>
                  <Text style={{color:sub,fontSize:FONT.xs,fontWeight:'700'}}>{MN[lM]} {lY}</Text>
                  <Text style={{color:text,fontSize:FONT.xxl,fontWeight:'800',marginVertical:4}}>{formatMoney(lastRev,settings.currency)}</Text>
                  <Text style={{color:sub,fontSize:FONT.xs}}>{lastInvs.length} invoices</Text>
                </Card>
              </View>
              {lastRev>0 && (
                <Card style={[{backgroundColor:growth>=0?(dark?'rgba(22,163,74,0.1)':'#f0fdf4'):(dark?'rgba(239,68,68,0.1)':'#fef2f2'),borderColor:growth>=0?(dark?COLORS.green700:'#bbf7d0'):(dark?'#7f1d1d':'#fecaca')},cardStyle]}>
                  <View style={{alignItems:'center'}}>
                    <Text style={{fontSize:32,marginBottom:4}}>
                      {growth>0?'📈':growth<0?'📉':'➡️'}
                    </Text>
                    <Text style={{fontSize:FONT.xxl,fontWeight:'900',color:growth>0?COLORS.success:growth<0?COLORS.danger:sub}}>
                      {growth>0?'+':''}{Math.round(growth)}%
                    </Text>
                    <Text style={{color:sub,fontSize:FONT.xs,marginTop:4}}>
                      {growth>0?'Growth':growth<0?'Decline':'No Change'} vs Last Month
                    </Text>
                  </View>
                </Card>
              )}
            </View>
          );
        })()}
      </FadeSlideIn>

      {/* Monthly Goal Tracker */}
      <FadeSlideIn delay={240}>
        {(() => {
          const tM=new Date().getMonth(); const tY=new Date().getFullYear();
          const mRev=invoices.filter(i=>{const d=new Date(i.date);return d.getMonth()===tM&&d.getFullYear()===tY;}).reduce((s,i)=>s+safeParseAmount(i.total),0);
          const goal=parseFloat(settings.monthlyGoal)||1500000;
          const pct=Math.min((mRev/goal)*100,100);
          const rem=Math.max(goal-mRev,0);
          const daysIn=new Date(tY,tM+1,0).getDate();
          const todayD=new Date().getDate();
          const daysLeft=daysIn-todayD;
          const dailyNeed=daysLeft>0&&rem>0?rem/daysLeft:0;
          const emoji=pct>=100?'🎉':pct>=75?'🔥':pct>=50?'💪':'🎯';
          const barColor=pct>=100?COLORS.success:pct>=75?COLORS.blue600:pct>=50?COLORS.warning:COLORS.warning;
          return (
            <View>
              <Text style={[styles.sectionLabel,{color:sub}]}>MONTHLY GOAL</Text>
              <Card style={{backgroundColor:dark?'rgba(147,51,234,0.1)':'#faf5ff',borderColor:dark?'#6b21a8':'#e9d5ff'}}>
                <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:SPACING.md}}>
                  <View>
                    {editingGoal ? (
                  <View style={{flexDirection:'row',alignItems:'center',gap:SPACING.xs}}>
                    <TextInput
                      value={goalInput}
                      onChangeText={setGoalInput}
                      keyboardType="numeric"
                      style={{backgroundColor:'rgba(255,255,255,0.3)',borderRadius:RADIUS.md,paddingHorizontal:SPACING.sm,paddingVertical:4,color:'#fff',fontSize:FONT.sm,minWidth:100}}
                      autoFocus
                    />
                    <TouchableOpacity
                      style={{backgroundColor:'#7c3aed',paddingHorizontal:SPACING.sm,paddingVertical:4,borderRadius:RADIUS.md}}
                      onPress={()=>{
                        const g=parseFloat(goalInput);
                        if(g>0){setSettings({...settings,monthlyGoal:g});setEditingGoal(false);}
                        else Alert.alert('Invalid','Enter a valid amount');
                      }}>
                      <Text style={{color:'#fff',fontWeight:'700',fontSize:11}}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={()=>setEditingGoal(false)}>
                      <Text style={{color:'rgba(255,255,255,0.7)',fontSize:12}}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={()=>{setGoalInput(String(goal));setEditingGoal(true);}}>
                    <Text style={{color:'#9333ea',fontSize:FONT.xs,fontWeight:'700'}}>
                      Target: {formatMoney(goal,settings.currency)} ✏️
                    </Text>
                  </TouchableOpacity>
                )}
                    <Text style={{color:text,fontSize:32,fontWeight:'900',marginTop:4}}>{Math.round(pct)}%</Text>
                  </View>
                  <Text style={{fontSize:52}}>{emoji}</Text>
                </View>
                <View style={{height:16,backgroundColor:dark?'rgba(255,255,255,0.1)':'rgba(255,255,255,0.6)',borderRadius:8,overflow:'hidden',marginBottom:SPACING.md}}>
                  <View style={{height:16,width:`${pct}%`,backgroundColor:barColor,borderRadius:8}} />
                </View>
                <View style={styles.row2}>
                  <View style={{flex:1,backgroundColor:dark?'rgba(255,255,255,0.05)':'rgba(255,255,255,0.6)',borderRadius:SPACING.sm,padding:SPACING.md}}>
                    <Text style={{color:sub,fontSize:FONT.xs}}>Achieved</Text>
                    <Text style={{color:text,fontWeight:'700',fontSize:FONT.sm,marginTop:2}}>{formatMoney(mRev,settings.currency)}</Text>
                  </View>
                  <View style={{flex:1,backgroundColor:dark?'rgba(255,255,255,0.05)':'rgba(255,255,255,0.6)',borderRadius:SPACING.sm,padding:SPACING.md}}>
                    <Text style={{color:sub,fontSize:FONT.xs}}>Remaining</Text>
                    <Text style={{color:text,fontWeight:'700',fontSize:FONT.sm,marginTop:2}}>{rem>0?formatMoney(rem,settings.currency):'✓ Done!'}</Text>
                  </View>
                </View>
                {dailyNeed>0 && (
                  <Text style={{color:'#9333ea',fontSize:FONT.xs,textAlign:'center',marginTop:SPACING.md}}>
                    Need {formatMoney(dailyNeed,settings.currency)}/day for {daysLeft} days
                  </Text>
                )}
              </Card>
            </View>
          );
        })()}
      </FadeSlideIn>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:        { flex:1 },
  content:     { padding:SPACING.lg, paddingBottom:80 },
  headerGrad:  { flexDirection:'row', alignItems:'center', backgroundColor:COLORS.blue600, borderRadius:RADIUS.xl, padding:SPACING.xl, marginBottom:SPACING.lg },
  expBtn:      { backgroundColor:'rgba(255,255,255,0.2)', paddingHorizontal:SPACING.md, paddingVertical:SPACING.sm, borderRadius:RADIUS.lg, borderWidth:1, borderColor:'rgba(255,255,255,0.3)' },
  sectionLabel:{ fontSize:FONT.xs, fontWeight:'700', textTransform:'uppercase', marginBottom:SPACING.sm },
  insightCard: { flexDirection:'row', alignItems:'flex-start', padding:SPACING.md, borderRadius:RADIUS.lg, borderLeftWidth:4, marginBottom:SPACING.sm },
  row2:        { flexDirection:'row', gap:SPACING.md, marginBottom:SPACING.sm },
  row3:        { flexDirection:'row', gap:SPACING.sm, marginBottom:SPACING.sm },
  card2:       { flex:1, margin:0, marginBottom:SPACING.sm },
  card3:       { flex:1, margin:0, marginBottom:SPACING.sm },
  custRow:     { flexDirection:'row', alignItems:'center', padding:SPACING.md, borderBottomWidth:1 },
  rankBadge:   { width:32, height:32, borderRadius:16, justifyContent:'center', alignItems:'center' },
});
