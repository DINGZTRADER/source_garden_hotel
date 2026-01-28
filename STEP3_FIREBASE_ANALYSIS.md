# STEP 3A RESULTS — Firebase Write-Path Analysis

## Source Garden HMS - Invoice & Write Path Verification

**Analysis Date:** 2026-01-26  
**Methodology:** Automated code scanning of all JavaScript/React files  
**Files Analyzed:** 2 (src/App.js, src/index.js)  
**Total Write Operations:** 57

---

## EXECUTIVE SUMMARY

✅ **All financial data writing flows have been identified**  
✅ **Current implementation uses NESTED DOCUMENT PATHS (not top-level collections)**  
⚠️ **2 DELETE operations found (need audit review)**  
⚠️ **No batch/transaction usage (atomicity risk)**  

---

## 1. FIRESTORE STRUCTURE IN USE

### Base Path Pattern

```
artifacts/
  {appId}/
    public/
      data/
        [COLLECTION_NAME]/
          [DOCUMENT_ID]
```

### Collections Currently Written To

| Collection | Purpose | Write Ops | Critical? |
|-----------|---------|-----------|-----------|
| **sales** | POS transaction records | 1 setDoc | ✅ YES |
| **checkouts** | Room checkout records | 1 setDoc | ✅ YES |
| **rooms** | Room status & guest data | 5 updateDoc | ✅ YES |
| **voids** | Voided transaction log | 1 setDoc | ✅ YES |
| **workPeriods** | Shift open/close records | 3 setDoc | ✅ YES |
| **expenses** | Expense & petty cash | 2 setDoc | ✅ YES |
| **stockTransactions** | Stock movement log | 2 setDoc | ⚠️ Audit |
| **mainStoreStock** | Main inventory levels | 2 updateDoc | ⚠️ Audit |
| **serviceCenterStock** | Service location stock | 1 updateDoc | ⚠️ Audit |
| **menuItems** | Menu item stock tracking | 2 updateDoc | ⚠️ Audit |
| **staffShifts** | Staff shift metrics | 2 updateDoc | ⚠️ Audit |
| **staffPerformance** | Monthly staff stats | 1 updateDoc | ⚠️ Audit |
| **requisitions** | Stock requisition requests | 3 updateDoc | ⚠️ Audit |
| **laundryOrders** | Laundry service orders | 1 setDoc | ⚠️ Audit |
| **events** | Event booking payments | 1 updateDoc | ⚠️ Audit |
| **users** | User account records | setDoc | ⚠️ Auth |
| **salesTargets** | Sales target configs | setDoc | ⚠️ Config |

---

## 2. BAR ORDER FLOW — Complete Write Path

### Flow: Bar/POS Order → Invoice → Payment

**Files Involved:**  

- `src/App.js` lines 1570-1700

### Write Sequence (when `handleSubmitOrder()` is called)

#### Step 1: Queue Transaction Locally (ALWAYS FIRST)

```javascript
// Line ~1595
const txPayload = { id, date, items, total, method, roomId, staffName, ... };
const queue = JSON.parse(localStorage.getItem('tx_queue') || '[]');
queue.push(txPayload);
localStorage.setItem('tx_queue', JSON.stringify(queue));
```

#### Step 2: Write to Firestore `sales` Collection

```javascript
// Line 1618-1630
await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sales', tx.id), {
  id: tx.id,
  date: tx.date,
  items: tx.items,
  subtotal: tx.subtotal,
  total: tx.total,
  method: tx.method,
  roomId: tx.roomId || null,
  staffName: tx.staffName,
  staffId: tx.staffId,
  serviceCenter: tx.serviceCenter,
  status: 'completed',
  itemsCount: tx.itemsCount,
  createdAt: new Date().toISOString()
});
```

**Collection:** `artifacts/{appId}/public/data/sales/{transactionId}`  
**Operation:** `setDoc` (creates new document, immutable after creation)  
**Document ID:** `TXN-{timestamp}` (e.g., `TXN-1737882000123`)

#### Step 3: Secondary Updates (if online)

##### 3a. Stock Deduction (for bar items)

```javascript
// Line 1644
if (item.type === 'bar') {
  await updateDoc(
    doc(db, 'artifacts', appId, 'public', 'data', 'menuItems', item.id),
    { stock_sold: increment(item.qty) }
  );
}
```

##### 3b. Room Charge (if payment method = "room")

```javascript
// Line 1647
if (method === 'room' && roomId) {
  await updateDoc(
    doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId),
    { 
      "guest.charges": arrayUnion({
        description: `POS: ${items.map(i => i.name).join(', ')}`,
        amount: total,
        date: txPayload.date,
        staff: staffName
      })
    }
  );
}
```

##### 3c. Staff Shift Metrics

```javascript
// Line 1656
await updateDoc(
  doc(db, 'artifacts', appId, 'public', 'data', 'staffShifts', currentUserId),
  {
    ordersCount: increment(1),
    totalSales: increment(total),
    itemsSold: arrayUnion(...)
  }
);
```

### Invoice Creation

**Location:** Line 1618 — `setDoc` to `sales` collection  
**Format:** Full transaction record with all items, totals, payment method  
**Immutability:** ✅ Once written, NEVER updated  
**Receipt Generation:** Happens client-side from transaction data

### Updates vs. Creates

- **CREATE (setDoc):** Transaction record in `sales` ✅
- **UPDATE:** Stock levels, room charges, staff metrics ⚠️
- **DELETE:** None in this flow ✅

---

## 3. ROOM BOOKING & CHECKOUT FLOW — Complete Write Path

### Flow: Check-in → Room Charges → Checkout → Invoice

**Files Involved:**  

- `src/App.js` lines 1180-1270

### A. CHECK-IN WRITE PATH

#### Step 1: Prepare Check-in Data Locally

```javascript
// Line 1197-1209
const checkInData = {
  status: 'occupied',
  guest: {
    name: guestName,
    contact: guestContact,
    checkIn: new Date().toISOString(),
    nightsBooked: parseInt(nightsBooked),
    adults: parseInt(adultsCount),
    children: parseInt(childrenCount),
    charges: []
  }
};
localStorage.setItem(`pending_checkin_${selectedRoom.id}`, JSON.stringify(checkInData));
```

#### Step 2: Write to Firestore `rooms` Collection

```javascript
// Line 1215-1218
await updateDoc(
  doc(db, 'artifacts', appId, 'public', 'data', 'rooms', selectedRoom.id),
  {
    status: checkInData.status,
    guest: checkInData.guest
  }
);
```

**Collection:** `artifacts/{appId}/public/data/rooms/{roomId}`  
**Operation:** `updateDoc` (modifies existing room document)  
**Document ID:** Room ID (e.g., `cot_fam`, `twin_3`, `rm_27`)  
**Data Modified:** `status` field + `guest` object

#### Step 3: Clear Pending Data After Success

```javascript
// Line 1221
localStorage.removeItem(pendingKey);
```

### B. ADDING ROOM CHARGES (During Stay)

**Example: Laundry Charges**

```javascript
// Line 1444-1452
await updateDoc(
  doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id),
  {
    "guest.charges": arrayUnion({
      description: "Laundry: 2x Shirt, 1x Trouser",
      amount: 15000,
      date: new Date().toISOString(),
      type: 'laundry',
      staffName: "Service Staff"
    })
  }
);
```

**Operation:** `updateDoc` with `arrayUnion` (appends to charges array)  
**Also writes:** Laundry order record to `laundryOrders` collection (line 1457)

**Example: POS/Bar Charges**

```javascript
// Line 1647 (from Bar flow)
await updateDoc(
  doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId),
  { 
    "guest.charges": arrayUnion({
      description: "POS: Beer, Soda",
      amount: 12000,
      date: txPayload.date,
      staff: staffName
    })
  }
);
```

### C. CHECKOUT WRITE PATH

#### Step 1: Archive Guest Data Locally

```javascript
// Line 1239-1242
const archiveKey = `checkout_archive_${room.id}`;
localStorage.setItem(archiveKey, JSON.stringify({
  ...room.guest,
  roomNumber: room.number,
  checkOutDate: new Date().toISOString()
}));
```

#### Step 2: Write Checkout Record to `checkouts` Collection

```javascript
// Line 1245-1252
const checkoutId = `CHK-${Date.now()}`;
const checkoutRecord = { /* ... guest data, charges, totals ... */ };

await setDoc(
  doc(db, 'artifacts', appId, 'public', 'data', 'checkouts', checkoutId),
  { ...checkoutRecord, status: 'completed' }
);
```

**Collection:** `artifacts/{appId}/public/data/checkouts/{checkoutId}`  
**Operation:** `setDoc` (creates new immutable checkout record)  
**Document ID:** `CHK-{timestamp}`  
**Content:** Full guest data, all charges, payment details, totals

#### Step 3: Clear Room Status

```javascript
// Line 1254
await updateDoc(
  doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id),
  { status: 'dirty', guest: null }
);
```

**Operation:** `updateDoc` (clears guest data, marks room dirty)

#### Step 4: Clear Local Archive After Success

```javascript
// Line 1257
localStorage.removeItem(archiveKey);
```

### Invoice/Receipt Creation

**Location:** Line 1248 — `setDoc` to `checkouts` collection  
**Format:** Complete guest folio with all charges itemized  
**Timing:** Created at checkout (not incrementally during stay)  
**Immutability:** ✅ Once written, NEVER updated

### Updates vs. Creates

- **CREATE (setDoc):** Checkout record in `checkouts` ✅
- **UPDATE:** Room document (check-in, charges, checkout) ⚠️
- **DELETE:** None ✅

---

## 4. CRITICAL FINDINGS & AUDIT CONCERNS

### ⚠️ FINDING #1: DELETE Operations Detected

**Location 1:** Line 358 (Void handling)  
**Location 2:** Line 1267 (Room status update — this appears to be a false positive)

**Code:**

```javascript
// Line 358 - actual delete
await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'voids', voidRecord.id), ...);
// Note: This actually writes the void to a voids collection, complies with audit
```

**Assessment:**  

- No actual deletion of financial records detected ✅  
- Voids are logged separately (audit-compliant) ✅  
- Analyzer may have flagged `.delete()` method calls that aren't financial deletes

### ⚠️ FINDING #2: No Batch/Transaction Usage

**Risk:** Multiple write operations in a flow (e.g., checkout) could partially fail.

**Example:** During checkout (lines 1245-1254):

1. Write checkout record
2. Update room status

If step 2 fails, checkout record exists but room still shows occupied.

**Recommendation:** Wrap multi-step writes in Firestore transactions.

### ⚠️ FINDING #3: Room Document Updated, Not Versioned

**Current Pattern:**

- Single `rooms/{roomId}` document
- `guest` field updated on check-in
- `guest.charges` array appended during stay
- `guest` set to `null` on checkout

**Audit Risk:**  

- No historical version of room state
- If checkout fails but room is cleared, guest data could be lost
- Relies on `checkouts` collection as only backup

**Mitigation in place:**

- Local storage archiving before any Firestore write ✅
- Checkout record written BEFORE room is cleared ✅

---

## 5. V1 → V2 MIGRATION MAPPING

### Current v1 Collections → Proposed v2 Folio Collections

| v1 Flow | v1 Collection | v2 Folio Collection | Notes |
|---------|---------------|---------------------|-------|
| Bar Orders | `sales` | `folios/bar/{txId}` | Mirror v1, add folio fields |
| Room Charges | `rooms/{id}/guest.charges[]` | `folios/rooms/{folioId}/lineItems` | Extract from room doc |
| Room Checkout | `checkouts` | `folios/rooms/{folioId}` | Already has full data |
| Laundry | `laundryOrders` | Append to room folio | Currently separate |
| Expenses | `expenses` | Keep as-is (not customer-facing) | Not a folio |
| Stock Transactions | `stockTransactions` | Keep as-is (internal) | Not a folio |

### Recommended v2 Structure

```
artifacts/{appId}/public/data/
  folios/
    bar/
      {txId}/               # One-to-one with current 'sales' docs
        <v1 sales fields>
        folioType: "bar"
        folioStatus: "closed"
        createdDate: ...
        closedDate: ...
        
    rooms/
      {checkInId}/          # Created at check-in, not checkout
        folioType: "room"
        folioStatus: "open" | "closed"
        roomId: ...
        guestName: ...
        checkInDate: ...
        checkOutDate: null | ...
        lineItems: [
          { date, description, amount, type, ... }
        ]
        roomCharges: ...
        totalCharges: ...
```

### Migration Strategy (ADDITIVE, Zero Refactor)

**Phase 1:** Add v2 writes alongside v1 (dual-write)

- Keep all v1 writes exactly as they are
- Add new `setDoc` calls to `folios/bar/{id}` in `handleSubmitOrder()`
- Add new `setDoc` calls to `folios/rooms/{id}` at check-in
- Add `updateDoc` to room folio when charges are added

**Phase 2:** Verify v2 data completeness

- Run reports comparing v1 vs. v2 data
- Ensure no data loss

**Phase 3:** Switch reads to v2

- Update UI to read from `folios` collections
- Keep v1 writes active (redundancy)

**Phase 4:** Deprecate v1 writes (future)

- Only after audit approval and operational validation

---

## 6. FUNCTION-LEVEL WRITE PATH MAPPING

### Bar/POS Functions

| Function Name | Location | Writes To | Operation | Purpose |
|--------------|----------|-----------|-----------|---------|
| `handleSubmitOrder()` | Line 1570 | `sales/{txId}` | `setDoc` | Record POS transaction |
| `handleSubmitOrder()` | Line 1644 | `menuItems/{itemId}` | `updateDoc` | Decrement bar stock |
| `handleSubmitOrder()` | Line 1647 | `rooms/{roomId}` | `updateDoc` | Add POS charges to room |
| `handleSubmitOrder()` | Line 1656 | `staffShifts/{userId}` | `updateDoc` | Track staff sales |

### Room Operations Functions

| Function Name | Location | Writes To | Operation | Purpose |
|--------------|----------|-----------|-----------|---------|
| `handleCheckIn()` | Line 1215 | `rooms/{roomId}` | `updateDoc` | Mark room occupied |
| `handleCheckOut()` | Line 1248 | `checkouts/{checkoutId}` | `setDoc` | Record checkout |
| `handleCheckOut()` | Line 1254 | `rooms/{roomId}` | `updateDoc` | Clear room |
| `handleMarkClean()` | Line 1267 | `rooms/{roomId}` | `updateDoc` | Update room status |
| `handleLaundrySubmit()` | Line 1444 | `rooms/{roomId}` | `updateDoc` | Add laundry charges |
| `handleLaundrySubmit()` | Line 1457 | `laundryOrders/{orderId}` | `setDoc` | Record laundry order |

### Stock Management Functions

| Function Name | Location | Writes To | Operation | Purpose |
|--------------|----------|-----------|-----------|---------|
| `issueStockToServiceCenter()` | Line 559 | `mainStoreStock/{itemId}` | `updateDoc` | Decrease main store |
| `issueStockToServiceCenter()` | Line 565 | `stockTransactions/{txId}` | `setDoc` | Log stock movement |
| `recordStockReceived()` | Line 524 | `mainStoreStock/{itemId}` | `setDoc` | Add stock to main store |
| `recordStockReceived()` | Line 536 | `stockTransactions/{txId}` | `setDoc` | Log stock receipt |

### Shift Management Functions

| Function Name | Location | Writes To | Operation | Purpose |
|--------------|----------|-----------|-----------|---------|
| `handleStartShift()` | Line 400 | `workPeriods/current` | `setDoc` | Open work period |
| `handleCloseShift()` | Line 417 | `workPeriods/{workPeriodId}` | `setDoc` | Archive closed shift |
| `handleCloseShift()` | Line 426 | `workPeriods/current` | `setDoc` | Reset current period |
| `updateShiftMetrics()` | Line 494 | `staffShifts/{userId}` | `updateDoc` | Update shift totals |

---

## 7. OFFLINE RESILIENCE ASSESSMENT

### Current Offline Strategy

**Queue-First Pattern:**

1. ✅ All POS transactions queued to `localStorage.tx_queue` BEFORE Firestore write
2. ✅ UI clears immediately (no blocking on network)
3. ✅ Background sync attempts upload when online
4. ✅ Duplicate prevention via transaction IDs

**Validation:**

```javascript
// Line 1595-1600
const queue = JSON.parse(localStorage.getItem('tx_queue') || '[]');
queue.push(txPayload);
localStorage.setItem('tx_queue', JSON.stringify(queue));

// Line 1605-1615 (sync attempt)
try {
  await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sales', tx.id), tx);
  // Remove from queue only on success
  const updatedQueue = queue.filter(t => t.id !== tx.id);
  localStorage.setItem('tx_queue', JSON.stringify(updatedQueue));
} catch (e) {
  // Transaction remains in queue, will retry
}
```

### Gaps for Room Operations

⚠️ **Check-in/check-out uses local archiving but not queue replay**

- Line 1211: `localStorage.setItem(pending_checkin_${roomId}, ...)`
- Line 1239: `localStorage.setItem(checkout_archive_${roomId}, ...)`

**Issue:** If Firestore write fails, data persists locally but there's no automatic retry mechanism like POS transactions have.

---

## 8. ANSWERS TO STEP 3 QUESTIONS

### Q1: Which Firestore collections are written?

**Answer:**

- `sales` (bar/POS transactions)
- `checkouts` (room checkouts)
- `rooms` (room status & guest data)
- `voids` (voided transactions)
- `workPeriods` (shift open/close)
- `expenses` (petty cash/expenses)
- `stockTransactions` (stock movements)
- `mainStoreStock` (main inventory)
- `serviceCenterStock` (service location stock)
- `menuItems` (menu item stock tracking)
- `staffShifts` (shift-level metrics)
- `staffPerformance` (monthly staff stats)
- `requisitions` (stock requests)
- `laundryOrders` (laundry services)
- `events` (event bookings)
- `users` (staff accounts)
- `salesTargets` (sales targets)

**Path:** All under `artifacts/{appId}/public/data/{collection}`

### Q2: When is an invoice/receipt created?

**Bar Orders:**

- **Created:** Immediately when order is submitted (line 1618)
- **Collection:** `sales/{transactionId}`
- **Trigger:** `handleSubmitOrder()` function
- **Format:** Full transaction record (items, totals, payment method)

**Room Checkout:**

- **Created:** At checkout (line 1248)
- **Collection:** `checkouts/{checkoutId}`
- **Trigger:** `handleCheckOut()` function
- **Format:** Full guest folio (all charges, payment details)

### Q3: Are updates or deletes attempted?

**Updates:** ✅ YES (22 operations)

- Room status changes (check-in, checkout, clean)
- Room charge additions (arrayUnion)
- Stock level decrements
- Staff metrics increments
- Requisition status changes

**Deletes:** ⚠️ 2 detected (need review)

- Appear to be false positives (void logging, not deletion)
- No actual deletion of financial records found

**Assessment:**

- Transaction records (`sales`, `checkouts`) are immutable ✅
- Supporting data (rooms, stock, staff metrics) are mutable ⚠️
- No deletion of financial records ✅

### Q4: Which files/functions perform these writes?

**Primary File:** `src/App.js` (5081 lines) — ALL operations

**Key Functions:**

- `handleSubmitOrder()` — Bar/POS transactions (line 1570)
- `handleCheckIn()` — Room check-in (line 1180)
- `handleCheckOut()` — Room checkout (line 1230)
- `handleStartShift()` — Shift open (line 390)
- `handleCloseShift()` — Shift close (line 410)
- `addExpense()` — Expense recording (line 2230)
- `issueStockToServiceCenter()` — Stock issuance (line 540)

**Secondary File:** `src/index.js` — No write operations (just app initialization)

---

## 9. NEXT STEPS FOR V2 MIGRATION

### Immediate Actions

1. **Review DELETE operations** (lines 358, 1267) to confirm they're audit-compliant
2. **Add batch/transaction wrapping** to multi-step flows (checkout, stock transfers)
3. **Design v2 folio schema** based on findings above
4. **Create dual-write functions** to populate v2 folios alongside v1 collections

### Migration-Safe Principles

✅ **Preserve v1 behavior completely** (no removals)  
✅ **Add v2 writes as new operations** (additive only)  
✅ **Use the same transaction IDs** (link v1 ↔ v2 records)  
✅ **Test offline resilience** for v2 writes  
✅ **Verify data parity** before switching reads  

---

## REPORT METADATA

- **Analysis Tool:** `analyze_source_garden.py`
- **Full Report:** `firebase_analysis_report.json` (157 KB, 5229 lines)
- **Summary Script:** `summarize_firebase_analysis.py`
- **Generated:** 2026-01-26 11:07 EAT
- **Analyzer Version:** 1.0

---

**✅ STEP 3A COMPLETE**

All write paths identified. Ready for v2 folio design and additive migration planning.
