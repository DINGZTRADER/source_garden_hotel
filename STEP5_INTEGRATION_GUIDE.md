# STEP 5 — V2 Dual-Write Implementation Guide

**Status:** IMPLEMENTATION READY  
**Date:** 2026-01-26

---

## 1. DELIVERABLES CREATED

### Service Modules

| File | Purpose | Lines |
|------|---------|-------|
| `src/services/folioService.js` | Core v2 folio operations | ~650 |
| `src/services/folioIntegration.js` | Integration helpers for App.js | ~280 |
| `src/types/folio.types.js` | TypeScript/JSDoc type definitions | ~400 |

### Key Functions

#### folioService.js (Core Operations)

| Function | Purpose |
|----------|---------|
| `createBarFolio()` | Create BAR folio (immediately closed) |
| `createRoomFolio()` | Create ROOM folio (open at check-in) |
| `addLineItemToFolio()` | Add charge to open folio |
| `getActiveFolioForRoom()` | Find active folio for a room |
| `closeFolioAndCreateInvoice()` | Close folio and generate invoice |
| `voidFolio()` | Void an open folio |
| `logAuditEvent()` | Log to audit trail |

#### folioIntegration.js (Simple Wrappers)

| Function | When to Call |
|----------|--------------|
| `v2WriteBarOrder()` | After v1 `sales/{txId}` write |
| `v2WriteRoomCheckIn()` | After v1 `rooms/{roomId}` update |
| `v2WriteRoomCharge()` | After v1 `guest.charges` arrayUnion |
| `v2WriteLaundryCharge()` | After v1 laundry charge write |
| `v2WriteRoomCheckout()` | After v1 `checkouts/{id}` write |
| `v2SyncOfflineTransaction()` | When syncing offline queue |

---

## 2. INTEGRATION INSTRUCTIONS

### Step 2.1: Import the Integration Module

Add this import at the top of `src/App.js`:

```javascript
// V2 Folio Integration (dual-write)
import {
  v2WriteBarOrder,
  v2WriteRoomCheckIn,
  v2WriteRoomCharge,
  v2WriteLaundryCharge,
  v2WriteRoomCheckout,
  v2SyncOfflineTransaction,
  isV2FolioEnabled,
} from './services/folioIntegration';
```

### Step 2.2: Modify Offline TX Queue Sync (Line ~319)

**Location:** `useOfflineTxQueue()` hook, inside the `syncPending` function

**Current v1 Code:**

```javascript
for (const tx of queue) {
  try {
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sales', tx.id), { ...tx, status: 'confirmed', synced: true, syncedAt: new Date().toISOString() });
    setQueue(prev => prev.filter(t => t.id !== tx.id));
    console.log(`Synced offline TX: ${tx.id}`);
  } catch (e) {
    console.error(`Failed to sync TX ${tx.id}:`, e);
    break;
  }
}
```

**Add v2 Write (after v1 success):**

```javascript
for (const tx of queue) {
  try {
    // V1 write (unchanged)
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sales', tx.id), { ...tx, status: 'confirmed', synced: true, syncedAt: new Date().toISOString() });
    
    // V2 write (NEW - create folio for synced transaction)
    if (isV2FolioEnabled()) {
      await v2SyncOfflineTransaction(db, appId, tx);
    }
    
    setQueue(prev => prev.filter(t => t.id !== tx.id));
    console.log(`Synced offline TX: ${tx.id}`);
  } catch (e) {
    console.error(`Failed to sync TX ${tx.id}:`, e);
    break;
  }
}
```

### Step 2.3: Find and Modify POS Order Handler

Search for the function that handles POS order submission. Look for patterns like:

- Setting document to `sales` collection
- Processing cart items
- Calling `enqueue()` for offline queue

**Add v2 Write After v1 Sales Write:**

```javascript
// After the v1 setDoc to sales/{txId} or enqueue()
if (isV2FolioEnabled()) {
  const v2Result = await v2WriteBarOrder(
    db, 
    appId, 
    txPayload,           // The transaction object
    currentUser.id,      // Staff ID
    currentUser.name,    // Staff name
    currentUser.serviceCenter || 'general',  // Service center
    txPayload.roomId     // Room ID if charged to room, null otherwise
  );
  
  if (v2Result) {
    console.log('V2 Folio created:', v2Result.invoiceNumber);
  }
}
```

### Step 2.4: Find and Modify Room Check-In Handler

Search for the function that handles room check-in. Look for patterns like:

- Updating room document with `status: 'occupied'`
- Setting guest data

**Add v2 Write After v1 Room Update:**

```javascript
// After the v1 updateDoc to rooms/{roomId}
if (isV2FolioEnabled()) {
  const v2Result = await v2WriteRoomCheckIn(
    db,
    appId,
    selectedRoom,        // Room object {id, number, type, price}
    {                    // Guest data
      name: guestName,
      contact: guestContact,
      nightsBooked: parseInt(nightsBooked),
      adults: parseInt(adultsCount),
      children: parseInt(childrenCount),
    },
    currentUser.id,      // Staff ID
    currentUser.name,    // Staff name
  );
  
  if (v2Result) {
    console.log('V2 Room Folio created:', v2Result.folioId);
  }
}
```

### Step 2.5: Find and Modify Room Charge Handler (POS to Room)

Search for where POS charges are added to a room. Look for patterns like:

- `arrayUnion` to `guest.charges`
- Payment method === 'room'

**Add v2 Write After v1 Room Charge:**

```javascript
// After the v1 arrayUnion to rooms/{roomId}/guest.charges
if (isV2FolioEnabled() && roomId) {
  const v2Result = await v2WriteRoomCharge(
    db,
    appId,
    roomId,              // Room ID
    txPayload,           // Transaction payload
    currentUser.id,      // Staff ID
    currentUser.name,    // Staff name
  );
  
  if (v2Result) {
    console.log('V2 Room charge added:', v2Result.itemId);
  }
}
```

### Step 2.6: Find and Modify Laundry Charge Handler

Search for laundry order handling. Look for patterns like:

- Writing to `laundryOrders` collection
- Adding to room charges

**Add v2 Write After v1 Laundry Write:**

```javascript
// After the v1 laundry charge write
if (isV2FolioEnabled()) {
  await v2WriteLaundryCharge(
    db,
    appId,
    roomId,              // Room ID
    laundryDescription,  // e.g., "2x Shirt, 1x Trouser"
    totalAmount,         // Laundry charge amount
    currentUser.id,      // Staff ID
    currentUser.name,    // Staff name
  );
}
```

### Step 2.7: Find and Modify Room Checkout Handler

Search for checkout handling. Look for patterns like:

- Writing to `checkouts` collection
- Clearing room guest data

**Add v2 Write After v1 Checkout:**

```javascript
// After the v1 setDoc to checkouts/{checkoutId}
if (isV2FolioEnabled()) {
  const v2Result = await v2WriteRoomCheckout(
    db,
    appId,
    room.id,             // Room ID
    {                    // Checkout data
      paymentMethod: paymentMethod,
      amountPaid: totalPaid,
      total: grandTotal,
    },
    checkoutId,          // The v1 checkout document ID
    currentUser.id,      // Staff ID
    currentUser.name,    // Staff name
  );
  
  if (v2Result) {
    console.log('V2 Invoice created:', v2Result.invoiceNumber);
  }
}
```

---

## 3. TESTING CHECKLIST

### 3.1 BAR/POS Order Tests

- [ ] Create a cash order → v2 BAR folio created, invoice generated
- [ ] Create a card order → v2 BAR folio created, invoice generated
- [ ] Create an order while offline → v2 folio created on sync
- [ ] Open console → check for `[v2]` log messages

### 3.2 Room Check-In Tests

- [ ] Check in a guest → v2 ROOM folio created (status: OPEN)
- [ ] Check console for `[v2] Created ROOM folio: FOLIO-ROOM-...`

### 3.3 Room Charge Tests

- [ ] Add POS charge to room → v2 line item added to folio
- [ ] Add laundry charge → v2 line item added to folio
- [ ] Check console for `[v2] Added line item:` messages

### 3.4 Room Checkout Tests

- [ ] Complete checkout → v2 folio closed, invoice created
- [ ] Check console for `[v2] Created invoice: INV-2026-...`
- [ ] Verify invoice number is sequential

### 3.5 Firestore Verification

After testing, check Firestore for these collections:

- [ ] `artifacts/{appId}/public/data/folios/` — Folio documents exist
- [ ] `artifacts/{appId}/public/data/folio_line_items/` — Line items exist
- [ ] `artifacts/{appId}/public/data/invoices/` — Invoices exist
- [ ] `artifacts/{appId}/public/data/invoice_counters/` — Counter incremented
- [ ] `artifacts/{appId}/public/data/audit_logs/` — Audit entries exist

---

## 4. ROLLBACK PROCEDURE

If v2 writes cause issues:

### Option 1: Disable via Console

```javascript
// Run in browser console
localStorage.setItem('v2_folio_disabled', 'true');
location.reload();
```

### Option 2: Remove Imports

Comment out the v2 import and all v2 function calls:

```javascript
// import { v2WriteBarOrder, ... } from './services/folioIntegration';
```

### V2 writes are non-blocking

All v2 write functions catch errors internally and return `null` on failure.
V1 operations will never fail due to v2 errors.

---

## 5. DATA COMPARISON

After running both systems in parallel:

### Compare v1 vs v2 Data

```javascript
// Run in browser console to compare counts
const basePath = `artifacts/${appId}/public/data`;
const v1Sales = await getDocs(collection(db, basePath, 'sales'));
const v2BarFolios = await getDocs(query(
  collection(db, basePath, 'folios'),
  where('folioType', '==', 'BAR')
));

console.log('V1 Sales:', v1Sales.size);
console.log('V2 BAR Folios:', v2BarFolios.size);
console.log('Match:', v1Sales.size === v2BarFolios.size);
```

### Verify Invoice Sequence

```javascript
const invoices = await getDocs(collection(db, basePath, 'invoices'));
const numbers = invoices.docs.map(d => d.data().invoiceNumber).sort();
console.log('Invoice Numbers:', numbers);
// Should be: INV-2026-00001, INV-2026-00002, INV-2026-00003, ...
```

---

## 6. FILE STRUCTURE AFTER STEP 5

```
src/
├── App.js                          (modified to import v2 functions)
├── services/
│   ├── folioService.js             (NEW - core v2 operations)
│   └── folioIntegration.js         (NEW - integration helpers)
├── types/
│   └── folio.types.js              (NEW - type definitions)
└── ...

Project Root/
├── STEP3_FIREBASE_ANALYSIS.md      (v1 write path analysis)
├── STEP4_FOLIO_SCHEMA.md           (v2 schema design)
├── STEP5_INTEGRATION_GUIDE.md      (THIS FILE)
└── ...
```

---

## 7. NEXT STEPS

### After Successful Integration

1. **Monitor logs** — Watch console for `[v2]` messages
2. **Compare data** — Run comparison scripts to verify parity
3. **Check invoice sequence** — Ensure gapless numbering
4. **Run for 1-2 days** — Parallel operation before any switchover

### Future Work (STEP 6+)

- [ ] Add v2 folio display in UI
- [ ] Add invoice printing from v2 data
- [ ] Add folio search/filter in admin
- [ ] Switch reports to read from v2
- [ ] Deprecate v1 reads (keep writes for backup)

---

## 8. TROUBLESHOOTING

### Issue: v2 writes not appearing in Firestore

**Check:**

1. `isV2FolioEnabled()` returns `true`
2. Console shows `[v2]` log messages
3. No errors in console after `[v2]` messages
4. Firestore security rules allow writes

### Issue: Invoice numbers not sequential

**Check:**

1. `invoice_counters` collection exists
2. Counter document has `lastNumber` field
3. No transaction failures in console

### Issue: Room charges not linking to folio

**Check:**

1. ROOM folio was created at check-in
2. `getActiveFolioForRoom()` finds the folio
3. Folio status is still `OPEN`

### Issue: Offline sync not creating v2 folios

**Check:**

1. `v2SyncOfflineTransaction()` is called in queue sync
2. Transaction has required fields (id, items, total)
3. No errors during sync

---

## ✅ STEP 5 COMPLETE

V2 dual-write implementation is ready. The integration requires:

1. **Import** the integration module in App.js
2. **Add** v2 write calls after each v1 write
3. **Test** all flows (POS, check-in, charges, checkout)
4. **Verify** data in Firestore matches v1

All v2 writes are:

- ✅ Non-blocking (errors don't break v1)
- ✅ Logged to console (easy debugging)
- ✅ Can be disabled via localStorage
- ✅ Audit-logged to Firestore
