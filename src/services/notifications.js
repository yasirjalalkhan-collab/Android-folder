// ── Notifications Service — Expo Notifications ───────────────
// چیک due date reminder + cheque return alert

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// ── Notification handler — app foreground میں بھی دکھائیں ──
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

// ── Permission request ────────────────────────────────────────
export const requestNotificationPermission = async () => {
  if (!Device.isDevice) return false; // simulator پر کام نہیں
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

// ── Push token (Firebase remote notifications کے لیے) ────────
export const getExpoPushToken = async () => {
  try {
    const { data } = await Notifications.getExpoPushTokenAsync();
    return data;
  } catch {
    return null;
  }
};

// ── چیک due reminder schedule کریں ──────────────────────────
// ہر چیک کے لیے اس کی تاریخ کی صبح 9 بجے
export const scheduleChequeReminder = async (cheque) => {
  try {
    if (!cheque.date || cheque.status !== 'pending') return null;

    const dueDate = new Date(cheque.date + 'T09:00:00');
    const now     = new Date();

    // گزری تاریخ نہ schedule کریں
    if (dueDate <= now) return null;

    // پہلے اگر پہلے سے scheduled ہے تو cancel کریں
    const id = 'chq-' + String(cheque.id);
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});

    const notifId = await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title:    '🏦 چیک جمع کروانے کا وقت!',
        body:     `${cheque.customerName} کا چیک آج کیش ہوگا\n${cheque.bank} #${cheque.number} — Rs. ${Number(cheque.amount).toLocaleString()}`,
        sound:    true,
        data:     { chequeId: cheque.id, type: 'cheque_due' },
      },
      trigger: { date: dueDate },
    });

    return notifId;
  } catch (e) {
    console.log('scheduleChequeReminder:', e.message);
    return null;
  }
};

// ── چیک reminder cancel کریں (status بدلنے پر) ──────────────
export const cancelChequeReminder = async (chequeId) => {
  try {
    await Notifications.cancelScheduledNotificationAsync('chq-' + String(chequeId));
  } catch { /* silent */ }
};

// ── تمام pending cheques کے reminders schedule کریں ─────────
export const scheduleAllChequeReminders = async (cheques) => {
  const pending = (cheques || []).filter(c => c.status === 'pending' && c.date);
  await Promise.all(pending.map(c => scheduleChequeReminder(c)));
};

// ── چیک return فوری notification ─────────────────────────────
export const notifyChequeReturned = async (cheque) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚠️ چیک واپس آگیا!',
        body:  `${cheque.customerName} کا چیک واپس ہوا\n${cheque.bank} #${cheque.number} — Rs. ${Number(cheque.amount).toLocaleString()}\nفوری رابطہ کریں`,
        sound: true,
        data:  { chequeId: cheque.id, type: 'cheque_returned' },
      },
      trigger: null, // فوری
    });
  } catch (e) {
    console.log('notifyChequeReturned:', e.message);
  }
};

// ── Invoice بنانے پر confirmation notification ───────────────
export const notifyInvoiceSaved = async (invoice) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '✅ Invoice محفوظ',
        body:  `#${invoice.id} — ${invoice.customer?.name} — Rs. ${Number(invoice.total).toLocaleString()}`,
        sound: false,
        data:  { invoiceId: invoice.id, type: 'invoice_saved' },
      },
      trigger: null,
    });
  } catch { /* silent */ }
};

// ── تمام scheduled notifications cancel کریں ─────────────────
export const cancelAllScheduled = async () => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch { /* silent */ }
};

// ── Notification tap handler ──────────────────────────────────
// App.js میں register کریں — notification tap پر navigate
export const addNotificationResponseListener = (navigationRef) => {
  return Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data;
    if (!navigationRef?.current) return;
    if (data?.type === 'cheque_due' || data?.type === 'cheque_returned') {
      navigationRef.current.navigate('Cheques');
    } else if (data?.type === 'invoice_saved') {
      // navigate to invoice if needed
    }
  });
};
