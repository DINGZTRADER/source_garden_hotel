# FIREBASE WRITE-PATH FLOWCHARTS

## Visual Reference for SGHMS v1 → v2 Migration

---

## 1. BAR/POS ORDER FLOW

```
┌─────────────────────────────────────────────────────────────────┐
│ USER ACTION: Submit Bar/POS Order                              │
│ Function: handleSubmitOrder() [Line 1570]                      │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
    ┌──────────────────────────────────────────────────┐
    │ STEP 1: Queue Transaction Locally (ALWAYS)      │
    │ Location: LocalStorage.tx_queue                 │
    │ Purpose: Offline resilience                     │
    │ Format: { id, date, items, total, method, ... } │
    └──────────────────────────────────────────────────┘
                           │
                           ▼
    ┌──────────────────────────────────────────────────┐
    │ STEP 2: Write to Firestore                      │
    │ Collection: sales/{transactionId}               │
    │ Operation: setDoc (CREATE, immutable)           │
    │ Document ID: TXN-{timestamp}                    │
    └──────────────────────────────────────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Success?   │
                    └─────────────┘
                      │         │
                   Yes│         │No
                      │         └──────────────┐
                      ▼                        ▼
    ┌──────────────────────────────┐  ┌────────────────────┐
    │ Remove from tx_queue        │  │ Keep in queue      │
    │ Clear UI cart               │  │ Retry on next sync │
    └──────────────────────────────┘  └────────────────────┘
                      │
                      ▼
    ┌──────────────────────────────────────────────────┐
    │ STEP 3: Secondary Updates (best-effort)         │
    └──────────────────────────────────────────────────┘
         │              │                │
         ▼              ▼                ▼
    ┌────────┐   ┌────────────┐   ┌──────────────┐
    │ Stock  │   │ Room       │   │ Staff Shift  │
    │ Levels │   │ Charges    │   │ Metrics      │
    └────────┘   └────────────┘   └──────────────┘
    menuItems    rooms/{id}       staffShifts/{id}
    updateDoc    updateDoc         updateDoc
    [Line 1644]  [Line 1647]       [Line 1656]

┌─────────────────────────────────────────────────────────────────┐
│ INVOICE CREATED: Line 1618 → sales/{txId}                      │
│ Format: Full transaction record (items, totals, payment)       │
│ Immutability: ✅ NEVER updated after creation                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. ROOM BOOKING & CHECKOUT FLOW

### A. CHECK-IN FLOW

```
┌─────────────────────────────────────────────────────────────────┐
│ USER ACTION: Check Guest Into Room                             │
│ Function: handleCheckIn() [Line 1180]                          │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
    ┌──────────────────────────────────────────────────┐
    │ STEP 1: Prepare Check-in Data Locally           │
    │ Location: LocalStorage.pending_checkin_{roomId} │
    │ Format: { status, guest: { name, contact, ... }}│
    └──────────────────────────────────────────────────┘
                           │
                           ▼
    ┌──────────────────────────────────────────────────┐
    │ STEP 2: Write to Firestore                      │
    │ Collection: rooms/{roomId}                      │
    │ Operation: updateDoc (UPDATE existing room)     │
    │ Fields: status = 'occupied', guest = {...}      │
    └──────────────────────────────────────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Success?   │
                    └─────────────┘
                      │         │
                   Yes│         │No
                      ▼         ▼
    ┌──────────────────────┐  ┌────────────────────────┐
    │ Clear pending data   │  │ Keep in localStorage   │
    │ Show confirmation    │  │ Manual retry required  │
    └──────────────────────┘  └────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ NOTE: No invoice created yet — created at checkout              │
│ Room document now contains: guest data + empty charges array    │
└─────────────────────────────────────────────────────────────────┘
```

### B. ADDING CHARGES DURING STAY

```
┌─────────────────────────────────────────────────────────────────┐
│ USER ACTION: Add Laundry/POS Charges to Room                   │
│ Functions: handleLaundrySubmit(), handleSubmitOrder()          │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
    ┌──────────────────────────────────────────────────┐
    │ Update Room Document                             │
    │ Collection: rooms/{roomId}                      │
    │ Operation: updateDoc with arrayUnion            │
    │ Field: guest.charges (append new charge)        │
    └──────────────────────────────────────────────────┘
                           │
                           ▼
    ┌──────────────────────────────────────────────────┐
    │ Room Document After Update:                      │
    │ {                                                │
    │   status: 'occupied',                            │
    │   guest: {                                       │
    │     name: "John Doe",                            │
    │     charges: [                                   │
    │       { description: "Laundry", amount: 15000 }, │
    │       { description: "POS: Beer", amount: 8000 } │
    │     ]                                            │
    │   }                                              │
    │ }                                                │
    └──────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ AUDIT CONCERN: Room document is being updated (not versioned)  │
│ Mitigation: Checkout will create immutable snapshot            │
└─────────────────────────────────────────────────────────────────┘
```

### C. CHECKOUT FLOW

```
┌─────────────────────────────────────────────────────────────────┐
│ USER ACTION: Check Guest Out of Room                           │
│ Function: handleCheckOut() [Line 1230]                         │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
    ┌──────────────────────────────────────────────────┐
    │ STEP 1: Archive Guest Data Locally               │
    │ Location: LocalStorage.checkout_archive_{roomId} │
    │ Purpose: Backup before any Firestore writes      │
    └──────────────────────────────────────────────────┘
                           │
                           ▼
    ┌──────────────────────────────────────────────────┐
    │ STEP 2: Create Checkout Record (INVOICE)        │
    │ Collection: checkouts/{checkoutId}              │
    │ Operation: setDoc (CREATE, immutable)           │
    │ Document ID: CHK-{timestamp}                    │
    │ Content: Full guest folio with all charges      │
    └──────────────────────────────────────────────────┘
                           │
                           ▼
    ┌──────────────────────────────────────────────────┐
    │ STEP 3: Clear Room Status                       │
    │ Collection: rooms/{roomId}                      │
    │ Operation: updateDoc                            │
    │ Fields: status = 'dirty', guest = null          │
    └──────────────────────────────────────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Success?   │
                    └─────────────┘
                      │         │
                   Yes│         │No
                      ▼         ▼
    ┌──────────────────────┐  ┌────────────────────────┐
    │ Clear archive data   │  │ Keep in localStorage   │
    │ Show confirmation    │  │ Guest data preserved   │
    └──────────────────────┘  └────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ INVOICE CREATED: Line 1248 → checkouts/{checkoutId}            │
│ Format: Complete guest folio (all charges, payment, totals)    │
│ Immutability: ✅ NEVER updated after creation                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. COLLECTIONS HIERARCHY MAP

```
Firestore Database
│
└── artifacts/
    └── {appId}/
        └── public/
            └── data/
                │
                ├── sales/                    [BAR/POS INVOICES]
                │   ├── TXN-1737882001234     ← setDoc (immutable)
                │   ├── TXN-1737882001567
                │   └── TXN-...
                │
                ├── checkouts/                [ROOM INVOICES]
                │   ├── CHK-1737883000111     ← setDoc (immutable)
                │   ├── CHK-1737883005222
                │   └── CHK-...
                │
                ├── rooms/                    [ROOM STATUS & ACTIVE GUESTS]
                │   ├── cot_fam               ← updateDoc (mutable)
                │   ├── twin_1                ← updateDoc (mutable)
                │   └── rm_27                 ← updateDoc (mutable)
                │
                ├── voids/                    [VOIDED TRANSACTIONS]
                │   ├── VOID-{txId}           ← setDoc (immutable)
                │   └── ...
                │
                ├── workPeriods/              [SHIFT OPEN/CLOSE]
                │   ├── current               ← setDoc (active shift)
                │   ├── WP-1737882000000      ← setDoc (closed shift)
                │   └── ...
                │
                ├── expenses/                 [PETTY CASH & EXPENSES]
                │   └── EXP-{timestamp}       ← setDoc
                │
                ├── stockTransactions/        [STOCK MOVEMENT LOG]
                │   └── STK-{timestamp}       ← setDoc
                │
                ├── mainStoreStock/           [MAIN INVENTORY]
                │   └── {itemId}              ← updateDoc (quantities)
                │
                ├── serviceCenterStock/       [SERVICE LOCATION STOCK]
                │   └── {centerId}/items/{itemId} ← updateDoc
                │
                ├── menuItems/                [MENU & BAR STOCK]
                │   └── {itemId}              ← updateDoc (stock_sold)
                │
                ├── staffShifts/              [SHIFT-LEVEL STAFF METRICS]
                │   └── {userId}              ← updateDoc
                │
                ├── staffPerformance/         [MONTHLY STAFF STATS]
                │   └── {userId}_{month}      ← updateDoc
                │
                ├── requisitions/             [STOCK REQUESTS]
                │   └── REQ-{timestamp}       ← setDoc + updateDoc (status)
                │
                ├── laundryOrders/            [LAUNDRY SERVICES]
                │   └── LAUN-{timestamp}      ← setDoc
                │
                ├── events/                   [EVENT BOOKINGS]
                │   └── {eventId}             ← updateDoc (payments)
                │
                ├── users/                    [STAFF ACCOUNTS]
                │   └── {userId}              ← setDoc
                │
                └── salesTargets/             [SALES TARGETS]
                    └── {targetId}            ← setDoc

Legend:
  setDoc        = CREATE (write once, never update)
  updateDoc     = UPDATE (can modify after creation)
  [CAPS]        = Financial/audit-critical collection
```

---

## 4. V1 → V2 MIGRATION MAPPING

```
┌─────────────────────────────────────────────────────────────────┐
│ GOAL: Add v2 folio collections WITHOUT changing v1 behavior    │
└─────────────────────────────────────────────────────────────────┘

                        BEFORE (v1)
┌─────────────────────────────────────────────────────────────────┐
│ Bar Order:                                                      │
│   1. Queue locally                                              │
│   2. setDoc → sales/{txId}                                      │
│   3. updateDoc → menuItems (stock)                              │
│   4. updateDoc → rooms (if room charge)                         │
│   5. updateDoc → staffShifts                                    │
└─────────────────────────────────────────────────────────────────┘

                        AFTER (v1 + v2 dual-write)
┌─────────────────────────────────────────────────────────────────┐
│ Bar Order:                                                      │
│   1. Queue locally                        [UNCHANGED]           │
│   2. setDoc → sales/{txId}                [UNCHANGED]           │
│   3. setDoc → folios/bar/{txId}           [NEW - v2]            │
│   4. updateDoc → menuItems (stock)        [UNCHANGED]           │
│   5. updateDoc → rooms (if room charge)   [UNCHANGED]           │
│   6. updateDoc → staffShifts              [UNCHANGED]           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Room Checkout:                                                  │
│   BEFORE (v1):                                                  │
│     1. Archive locally                                          │
│     2. setDoc → checkouts/{checkoutId}                          │
│     3. updateDoc → rooms/{roomId} (clear guest)                 │
│                                                                 │
│   AFTER (v1 + v2):                                              │
│     1. Archive locally                    [UNCHANGED]           │
│     2. setDoc → checkouts/{checkoutId}    [UNCHANGED]           │
│     3. updateDoc → folios/rooms/{folioId} [NEW - close folio]   │
│     4. updateDoc → rooms/{roomId}         [UNCHANGED]           │
└─────────────────────────────────────────────────────────────────┘
```

### Proposed v2 Folio Schema

```javascript
// Bar/POS Folio (one-to-one with v1 'sales' doc)
folios/bar/{txId} = {
  folioId: txId,              // Same as v1 sales doc ID
  folioType: "bar",
  folioStatus: "closed",      // Bar folios always closed
  createdDate: "...",
  closedDate: "...",
  
  // Mirrored from v1 sales doc
  date: "...",
  items: [...],
  subtotal: 0,
  total: 0,
  method: "cash" | "momo" | "card" | "room",
  roomId: null | "...",
  staffName: "...",
  staffId: "...",
  serviceCenter: "...",
  
  // v2 additions
  paymentStatus: "paid" | "pending" | "voided",
  voidReason: null | "...",
  linkedRoomFolio: null | "..." // if charged to room
}

// Room Folio (created at check-in, closed at checkout)
folios/rooms/{checkInTimestamp} = {
  folioId: "FOLIO-{checkInTimestamp}",
  folioType: "room",
  folioStatus: "open" | "closed",
  createdDate: "...",          // Check-in date
  closedDate: null | "...",    // Checkout date
  
  // Guest info
  roomId: "...",
  roomNumber: "...",
  guestName: "...",
  guestContact: "...",
  nightsBooked: 0,
  adults: 0,
  children: 0,
  
  // Line items (charges during stay)
  lineItems: [
    {
      date: "...",
      description: "Room charge",
      amount: 140000,
      type: "room",
      staffName: null
    },
    {
      date: "...",
      description: "POS: Beer, Soda",
      amount: 12000,
      type: "pos",
      staffName: "Bar Staff",
      linkedBarFolio: "TXN-123456" // Link to bar folio
    },
    {
      date: "...",
      description: "Laundry: 2x Shirt",
      amount: 15000,
      type: "laundry",
      staffName: "Service Staff"
    }
  ],
  
  // Totals
  roomCharges: 140000,
  extraCharges: 27000,
  totalCharges: 167000,
  
  // Payment
  paymentStatus: "unpaid" | "partial" | "paid",
  paymentMethod: null | "...",
  amountPaid: 0,
  
  // Link to v1 checkout
  v1CheckoutId: null | "CHK-..."  // Set at checkout
}
```

---

## 5. CRITICAL WRITE OPERATIONS BY TYPE

```
┌─────────────────────────────────────────────────────────────────┐
│ IMMUTABLE WRITES (setDoc - create once, never update)          │
│ ✅ Audit compliant                                              │
└─────────────────────────────────────────────────────────────────┘

  Collection          Purpose                Lines     Count
  ─────────────────────────────────────────────────────────────
  sales               POS transactions       1618      1
  checkouts           Room checkouts         1248      1
  voids               Voided transactions    358       1
  workPeriods         Closed shifts          417       1
  expenses            Expense records        2231,2283 2
  stockTransactions   Stock movements        536,565   2
  laundryOrders       Laundry services       1457      1
  mainStoreStock      Stock items (init)     524       1
  users               User accounts          (init)    1
  requisitions        Stock requests (new)   665       1
  
  Total: 33 setDoc operations


┌─────────────────────────────────────────────────────────────────┐
│ MUTABLE WRITES (updateDoc - can modify after creation)         │
│ ⚠️ Need audit review                                            │
└─────────────────────────────────────────────────────────────────┘

  Collection          Purpose                Lines     Count
  ─────────────────────────────────────────────────────────────
  rooms               Check-in/out/charges   1215,1254 4
                                             1267,1444
                                             1647
  
  staffShifts         Shift metrics          494,1656  2
  staffPerformance    Monthly stats          738,1670  2
  
  menuItems           Stock levels           1644,2049 2
  mainStoreStock      Inventory              559,4034  2
  serviceCenterStock  Service stock          614       1
  
  requisitions        Status updates         670,679   3
                                             689
  
  events              Payment tracking       3438      1
  
  Total: 22 updateDoc operations


┌─────────────────────────────────────────────────────────────────┐
│ DELETE OPERATIONS (deleteDoc/delete)                            │
│ ⚠️ CRITICAL: Need verification                                  │
└─────────────────────────────────────────────────────────────────┘

  Location   Context                         Status
  ─────────────────────────────────────────────────────────────
  Line 358   Void transaction handling       ✅ False positive
                                             (writes to voids
                                              collection)
  
  Line 1267  Room status update              ✅ False positive
                                             (updateDoc, not
                                              deleteDoc)
  
  Total: 2 flagged, 0 actual financial deletes ✅
```

---

## 6. OFFLINE QUEUE MECHANISM

```
┌─────────────────────────────────────────────────────────────────┐
│ POS TRANSACTION OFFLINE RESILIENCE                              │
└─────────────────────────────────────────────────────────────────┘

    Browser LocalStorage: tx_queue
    ┌────────────────────────────────────────┐
    │ [                                      │
    │   {                                    │
    │     id: "TXN-1737882001234",           │
    │     date: "...",                       │
    │     items: [...],                      │
    │     total: 35000,                      │
    │     method: "cash",                    │
    │     status: "pending"  ← Not synced    │
    │   },                                   │
    │   {                                    │
    │     id: "TXN-1737882001567",           │
    │     ...                                │
    │   }                                    │
    │ ]                                      │
    └────────────────────────────────────────┘
              │
              │ Sync attempt every 5 seconds
              ▼
    ┌────────────────────┐
    │ Network available? │
    └────────────────────┘
         │           │
       Yes│          │No
         ▼           └──────► Keep in queue, retry later
    Upload to Firestore
         │
         ▼
    ┌────────────────┐
    │    Success?    │
    └────────────────┘
         │           │
       Yes│          │No
         ▼           └──────► Keep in queue, retry later
    Remove from queue

┌─────────────────────────────────────────────────────────────────┐
│ GUARANTEE: No transaction is ever lost due to:                 │
│   • Power failure                                               │
│   • Browser crash                                               │
│   • Network outage                                              │
│   • Device restart                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. RECOMMENDATION: WRAP IN TRANSACTIONS

```
┌─────────────────────────────────────────────────────────────────┐
│ CURRENT ISSUE: Multi-step writes without atomicity             │
└─────────────────────────────────────────────────────────────────┘

Example: Room Checkout (Lines 1245-1257)

  CURRENT (No Transaction):
    Step 1: setDoc → checkouts/{id}       ✅ Success
    Step 2: updateDoc → rooms/{id}        ❌ Fails (network error)
    
    RESULT: Checkout record exists, but room still shows occupied
    IMPACT: Room unavailable for booking, data inconsistency


┌─────────────────────────────────────────────────────────────────┐
│ RECOMMENDED: Firestore Transaction Wrapper                     │
└─────────────────────────────────────────────────────────────────┘

  IMPROVED (With Transaction):
  
    await runTransaction(db, async (transaction) => {
      // Step 1: Write checkout record
      transaction.set(
        doc(db, 'artifacts', appId, 'public', 'data', 'checkouts', checkoutId),
        checkoutRecord
      );
      
      // Step 2: Clear room status
      transaction.update(
        doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id),
        { status: 'dirty', guest: null }
      );
      
      // Both succeed or both fail (atomic)
    });
    
    RESULT: ✅ Atomicity guaranteed
            ✅ No partial writes
            ✅ Consistent state


┌─────────────────────────────────────────────────────────────────┐
│ APPLY TO:                                                       │
│   • Room checkout (checkout + room update)                     │
│   • Stock transfers (main store - service center +)            │
│   • Shift close (workPeriod + staffShift updates)              │
└─────────────────────────────────────────────────────────────────┘
```

---

**END OF FLOWCHARTS**

These diagrams provide a visual reference for all write paths identified in STEP 3A analysis.
Use alongside `STEP3_FIREBASE_ANALYSIS.md` for v2 folio migration planning.
