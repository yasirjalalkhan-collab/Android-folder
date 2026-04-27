# Order Tracking Setup — Timber 360

## 1. Firestore Security Rules
Firebase Console → Firestore → Rules میں یہ add کریں:

```
match /tracking/{docId} {
  allow read:  if true;                    // کوئی بھی پڑھ سکتا ہے (QR scan)
  allow write: if request.auth != null;    // صرف app user لکھ سکتا ہے
}
```

## 2. tracking.html Hosting

### Option A: GitHub Pages (Free)
1. New repo بنائیں: `timber360-track`
2. `tracking.html` → `index.html` rename کریں
3. Settings → Pages → main branch enable
4. URL ملے گی: `https://[username].github.io/timber360-track`

### Option B: Netlify (Free, 1 minute)
1. netlify.com پر جائیں
2. tracking.html drag & drop کریں
3. فوری URL ملے گی

### Option C: Firebase Hosting
```bash
npm install -g firebase-tools
firebase init hosting
# tracking.html کو public/ میں ڈالیں
firebase deploy
# URL: https://timber-360.web.app
```

## 3. App Settings میں URL set کریں
Settings → Order Tracking → Tracking Page URL:
`https://your-deployed-url.com/index.html`

## 4. How it works
1. Invoice بناتے وقت Firestore میں tracking document create ہوتا ہے
2. InvoiceView → Track بٹن → OrderTrackingScreen
3. QR code scan → browser کھلتا ہے → tracking.html → Firestore سے status پڑھتا ہے
4. "Delivered & Closed" → 7 دن بعد QR expire

## 5. Tracking Statuses
- 📥 Order Received
- ⚙️ In Production  
- ✅ Ready
- 🚚 Dispatched
- 🏠 Delivered
- 🔒 Delivered & Closed (7 دن بعد expire)
