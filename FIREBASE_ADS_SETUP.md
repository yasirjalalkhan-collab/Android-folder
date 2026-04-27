# Firebase Ad System — Setup Guide

## ایک بار کا کام (Firebase Console میں)

### 1. Firestore میں ad document بنائیں:

**Collection:** `ads`  
**Document ID:** `active`

**Fields:**
```
enabled     : true          (boolean)
title       : "احمد ووڈ ورکس"      (string)
tagline     : "دروازے، کھڑکیاں، فرنیچر — بہترین قیمت"  (string)
cta         : "ابھی رابطہ کریں"   (string)
phone       : "0300-1234567"  (string)
whatsapp    : "923001234567"  (string) — country code کے ساتھ، 0 نہیں
bgColor     : "#166534"      (string) — hex color
textColor   : "#ffffff"      (string)
emoji       : "🪵"           (string)
badge       : "اشتہار"       (string)
```

### 2. Ad بدلنی ہو تو:
Firebase Console → Firestore → ads → active → Edit
بس fields update کریں — سب users کو فوری نظر آئے گا۔

### 3. Ad بند کرنی ہو تو:
`enabled` field کو `false` کر دیں۔

---

## Advertiser کے لیے packages (مثال):

| Package | Duration | Price |
|---------|----------|-------|
| Basic   | 1 ہفتہ  | Rs. 500 |
| Standard| 1 مہینہ | Rs. 1,500 |
| Premium | 3 مہینے | Rs. 3,500 |

---

## Firebase Security Rules (Firestore):

```javascript
// ads collection صرف آپ (admin) لکھ سکتے ہیں
// سب users پڑھ سکتے ہیں
match /ads/{docId} {
  allow read: if true;
  allow write: if request.auth.uid == "YOUR_ADMIN_UID";
}
```
