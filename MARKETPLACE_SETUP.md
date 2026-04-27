# Marketplace Setup — Firebase Console

## ─── ایک بار کا کام ───────────────────────────────

### Firestore میں listings شامل کریں:

**Collection:** `marketplace`
**Document ID:** کوئی بھی (Firebase auto-generate کرے گا)

### ہر listing کے fields:

```
enabled   : true           (boolean) ← یہ false کریں تو listing غائب
title     : "احمد ووڈ ورکس"    (string)
tagline   : "دروازے، کھڑکیاں، فرنیچر — بہترین معیار"  (string)
category  : "لکڑی کا کام"    (string)
phone     : "0300-1234567"   (string)
whatsapp  : "923001234567"   (string) ← 92 سے شروع، 0 نہیں
city      : "کراچی"          (string)
emoji     : "🪵"             (string)
order     : 1                (number) ← چھوٹا نمبر = پہلے
bgColor   : "#166534"        (string, optional) ← اپنا رنگ
```

## ─── روزانہ کا کام ───────────────────────────────

| کام | طریقہ |
|-----|--------|
| نئی listing | نیا document add کریں |
| listing بند | `enabled: false` |
| ترتیب بدلیں | `order` number بدلیں |
| معلومات update | field edit کریں |

## ─── Packages (مثال) ────────────────────────────

| Package  | Listings | Duration | Price     |
|----------|----------|----------|-----------|
| Basic    | 1        | 1 ہفتہ  | Rs. 500   |
| Standard | 1        | 1 مہینہ | Rs. 1,500 |
| Premium  | 1        | 3 مہینے | Rs. 3,500 |
| Featured | سب سے اوپر | 1 مہینہ | Rs. 2,500 |

## ─── Firestore Security Rules ────────────────────

```javascript
match /marketplace/{docId} {
  allow read:  if true;                              // سب users پڑھ سکتے ہیں
  allow write: if request.auth.uid == "ADMIN_UID";  // صرف آپ لکھ سکتے ہیں
}
```

## ─── آپ کا اپنا اشتہار (پہلی listing) ──────────

```
enabled  : true
title    : "[آپ کا کاروبار کا نام]"
tagline  : "[آپ کی خدمات]"
category : "لکڑی کا کام"
phone    : "[آپ کا نمبر]"
whatsapp : "[آپ کا نمبر 92 سے]"
city     : "[آپ کا شہر]"
emoji    : "🪵"
order    : 1
```
