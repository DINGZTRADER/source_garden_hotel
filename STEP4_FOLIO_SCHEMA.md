# STEP 4 — V2 FOLIO SCHEMA DESIGN

**Status:** AUTHORITATIVE  
**Date:** 2026-01-26  
**Reference:** MASTERVERSION2.md (Section 3.2, Section 5)

---

## 1. DESIGN PRINCIPLES

### From MASTERVERSION2.md (Section 3.2)

> - **Folio** is the core financial container
> - Every charge (bar, room, service) maps to a FolioLineItem
> - Invoices are generated only from closed folios
> - Invoice numbers are atomic, sequential, and gapless
> - Invoices are immutable after finalization

### From STEP 3 Analysis

The existing v1 system writes to:

- `sales` — Bar/POS transactions (immutable)
- `checkouts` — Room checkout records (immutable)
- `rooms` — Room status & guest charges (mutable)

### Design Goals

1. **Additive only** — No changes to v1 collections
2. **Shadow mode first** — v2 writes mirror v1 without replacing
3. **Audit-safe** — Folio line items are immutable
4. **Offline-compatible** — Open folios accept offline charges
5. **Invoice-ready** — Closed folios generate sequential invoices

---

## 2. FIRESTORE COLLECTION STRUCTURE

### 2.1 Top-Level v2 Collections

Based on the security rules in MASTERVERSION2.md Appendix A:

```
/folios/{folioId}                    ← Folio headers (v2 core)
/folio_line_items/{itemId}           ← Individual charges (immutable)
/invoices/{invoiceId}                ← Finalized invoices (immutable)
/invoice_counters/{year}             ← Sequential invoice numbers
/discount_rules/{ruleId}             ← Discount configuration
/discount_events/{eventId}           ← Applied discount log
/audit_logs/{logId}                  ← Audit trail (immutable)
/guest_profiles/{guestId}            ← PII-protected guest data
/stock_movements/{movementId}        ← Stock delta log
/work_periods/{periodId}             ← Shift records
```

### 2.2 Collection Paths (Full)

All v2 collections use the same base path as v1:

```
artifacts/{appId}/public/data/folios/{folioId}
artifacts/{appId}/public/data/folio_line_items/{itemId}
artifacts/{appId}/public/data/invoices/{invoiceId}
artifacts/{appId}/public/data/invoice_counters/{year}
```

---

## 3. FOLIO DOCUMENT SCHEMA

### 3.1 Folio Header (`/folios/{folioId}`)

```typescript
interface Folio {
  // Identity
  folioId: string;            // Format: "FOLIO-{timestamp}" or "FOLIO-BAR-{txId}"
  folioNumber: string;        // Human-readable: "F-2026-00001"
  
  // Type classification
  folioType: 'BAR' | 'ROOM' | 'EVENT' | 'SERVICE';
  
  // Status lifecycle
  status: 'OPEN' | 'CLOSED' | 'VOIDED';
  
  // Dates
  createdAt: string;          // ISO 8601
  closedAt: string | null;    // Set when status → CLOSED
  voidedAt: string | null;    // Set when status → VOIDED
  
  // Owner reference
  ownerId: string | null;     // Guest profile ID (for room folios)
  ownerName: string;          // Display name
  ownerContact: string | null;
  
  // Room-specific (null for BAR folios)
  roomId: string | null;
  roomNumber: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
  nightsBooked: number | null;
  adults: number | null;
  children: number | null;
  
  // Financial summary (denormalized for performance)
  subtotal: number;           // Sum of line items before discount
  discountTotal: number;      // Sum of discounts applied
  taxTotal: number;           // Sum of taxes (if applicable)
  grandTotal: number;         // Final amount due
  
  // Payment tracking
  amountPaid: number;
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERPAID';
  
  // Staff attribution
  createdBy: string;          // Staff user ID
  createdByName: string;      // Staff display name
  closedBy: string | null;    // Staff who closed/finalized
  closedByName: string | null;
  
  // v1 linkage (for migration tracking)
  v1LinkedRecords: {
    salesIds: string[];       // v1 sales/{txId} references
    checkoutId: string | null; // v1 checkouts/{id} reference
    roomId: string | null;    // v1 rooms/{id} reference
  };
  
  // Invoice reference (set after finalization)
  invoiceId: string | null;
  invoiceNumber: string | null;
  
  // Metadata
  serviceCenter: string | null;  // For bar folios
  notes: string | null;
}
```

### 3.2 Folio Status Lifecycle

```
                    ┌──────────────────┐
                    │      OPEN        │
                    │  (accepts new    │
                    │   line items)    │
                    └────────┬─────────┘
                             │
                ┌────────────┼────────────┐
                │            │            │
                ▼            ▼            ▼
        [Add Charge]  [Close Folio]  [Void Folio]
                             │            │
                             ▼            ▼
                    ┌─────────────┐  ┌─────────────┐
                    │   CLOSED    │  │   VOIDED    │
                    │ (immutable) │  │ (immutable) │
                    │ (generates  │  │ (logged,    │
                    │  invoice)   │  │  no invoice)│
                    └─────────────┘  └─────────────┘
```

**Rules:**

- `OPEN` folios can receive new line items
- `CLOSED` folios are immutable and generate an invoice
- `VOIDED` folios are immutable, no invoice generated
- Transitions: OPEN → CLOSED or OPEN → VOIDED only
- No reopening of closed/voided folios

---

## 4. FOLIO LINE ITEM SCHEMA

### 4.1 Line Item Document (`/folio_line_items/{itemId}`)

```typescript
interface FolioLineItem {
  // Identity
  itemId: string;             // Format: "FLI-{timestamp}-{seq}"
  folioId: string;            // Parent folio reference
  
  // Timestamps
  createdAt: string;          // ISO 8601
  
  // Item details
  description: string;        // Human-readable description
  itemType: 'ROOM_CHARGE' | 'BAR_ORDER' | 'LAUNDRY' | 'SERVICE' | 
            'FOOD' | 'DRINK' | 'DISCOUNT' | 'PAYMENT' | 'ADJUSTMENT';
  
  // Quantity and pricing
  quantity: number;
  unitPrice: number;
  subtotal: number;           // quantity × unitPrice
  
  // Discount (if applicable)
  discountAmount: number;
  discountReason: string | null;
  discountRuleId: string | null;  // Reference to discount_rules
  
  // Tax (if applicable)
  taxAmount: number;
  taxRate: number;            // e.g., 0.18 for 18%
  
  // Final amount
  totalAmount: number;        // subtotal - discount + tax
  
  // Staff attribution
  staffId: string;
  staffName: string;
  
  // Category grouping
  category: string;           // e.g., "Breakfast", "Drinks", "Laundry"
  
  // v1 linkage
  v1SalesId: string | null;   // If mirrored from v1 sales
  v1MenuItemId: string | null; // Menu item reference
  
  // Payment-specific (for PAYMENT type items)
  paymentMethod: 'CASH' | 'CARD' | 'MOMO' | 'ROOM' | 'CREDIT' | null;
  paymentReference: string | null;
  
  // Source tracking
  sourceModule: 'POS' | 'RECEPTION' | 'LAUNDRY' | 'RESTAURANT' | 'SYSTEM';
  isOfflineCreated: boolean;  // True if created while offline
  syncedAt: string | null;    // When synchronized to Firestore
  
  // Immutability marker
  isLocked: boolean;          // True after folio is closed
}
```

### 4.2 Line Item Immutability Rules

1. **Create-only** — Line items cannot be updated or deleted
2. **Corrections via adjustment** — Mistakes are corrected by adding a negative adjustment line item
3. **Void via folio** — Voiding the entire folio voids all line items
4. **Lock on close** — When folio status → CLOSED, all line items set `isLocked: true`

---

## 5. INVOICE SCHEMA

### 5.1 Invoice Document (`/invoices/{invoiceId}`)

```typescript
interface Invoice {
  // Identity
  invoiceId: string;          // Format: "INV-{timestamp}"
  invoiceNumber: string;      // Sequential: "INV-2026-00001"
  
  // Source
  folioId: string;            // Reference to closed folio
  folioNumber: string;
  folioType: 'BAR' | 'ROOM' | 'EVENT' | 'SERVICE';
  
  // Dates
  issuedAt: string;           // ISO 8601 (finalization time)
  dueDate: string | null;     // For credit invoices
  
  // Customer details (snapshot at invoice time)
  customerName: string;
  customerContact: string | null;
  customerAddress: string | null;
  
  // Room details (for room folios)
  roomNumber: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
  
  // Financial summary (immutable snapshot)
  lineItems: InvoiceLineItem[];  // Denormalized copy of folio line items
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  
  // Payment status at invoice time
  amountPaid: number;
  amountDue: number;
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
  paymentMethod: string | null;  // Primary payment method used
  
  // Staff attribution
  issuedBy: string;           // Staff user ID
  issuedByName: string;
  
  // Service center (for bar invoices)
  serviceCenter: string | null;
  
  // v1 linkage
  v1CheckoutId: string | null;
  v1SalesIds: string[];
  
  // Print/delivery tracking
  printCount: number;         // How many times printed
  lastPrintedAt: string | null;
  emailedTo: string | null;
  
  // Immutability guarantee
  hash: string;               // SHA-256 of invoice content (optional)
}

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  category: string;
}
```

### 5.2 Invoice Number Sequence

**Counter Document:** `/invoice_counters/{year}`

```typescript
interface InvoiceCounter {
  year: number;               // e.g., 2026
  lastNumber: number;         // e.g., 42
  prefix: string;             // e.g., "INV-2026-"
}
```

**Invoice Number Generation:**

```javascript
// Atomic increment in transaction
const counterRef = doc(db, 'invoice_counters', '2026');
await runTransaction(db, async (transaction) => {
  const counterDoc = await transaction.get(counterRef);
  const lastNumber = counterDoc.data()?.lastNumber || 0;
  const newNumber = lastNumber + 1;
  
  // Update counter
  transaction.update(counterRef, { lastNumber: newNumber });
  
  // Create invoice with sequential number
  const invoiceNumber = `INV-2026-${String(newNumber).padStart(5, '0')}`;
  // ... create invoice document
});
```

**Gapless Guarantee:**

- Invoice numbers are generated inside a Firestore transaction
- Counter increment and invoice creation are atomic
- Failed transactions don't increment the counter
- Result: Sequential, gapless invoice numbers (INV-2026-00001, INV-2026-00002, ...)

---

## 6. FOLIO TYPE SPECIFICATIONS

### 6.1 BAR Folio

**Created when:** POS order is submitted  
**Lifecycle:** Created → Immediately Closed (single-transaction)  
**Duration:** Instantaneous (no open period)

```typescript
// BAR Folio example
const barFolio: Folio = {
  folioId: "FOLIO-BAR-TXN-1737882001234",
  folioNumber: "F-2026-00042",
  folioType: "BAR",
  status: "CLOSED",  // Immediately closed
  
  createdAt: "2026-01-26T08:30:00.000Z",
  closedAt: "2026-01-26T08:30:00.000Z",  // Same time as created
  
  ownerId: null,  // Walk-in customer
  ownerName: "Walk-in Customer",
  
  roomId: null,  // Not a room charge
  roomNumber: null,
  
  subtotal: 35000,
  discountTotal: 0,
  taxTotal: 0,
  grandTotal: 35000,
  
  amountPaid: 35000,
  paymentStatus: "PAID",
  
  createdBy: "staff_user_123",
  createdByName: "Bar Staff",
  closedBy: "staff_user_123",
  closedByName: "Bar Staff",
  
  v1LinkedRecords: {
    salesIds: ["TXN-1737882001234"],
    checkoutId: null,
    roomId: null,
  },
  
  invoiceId: "INV-1737882001234",
  invoiceNumber: "INV-2026-00042",
  
  serviceCenter: "bar_main",
};
```

### 6.2 ROOM Folio

**Created when:** Guest checks in  
**Lifecycle:** Created (OPEN) → Charges added → Closed at checkout  
**Duration:** Multi-day (1+ nights)

```typescript
// ROOM Folio example (during stay)
const roomFolioOpen: Folio = {
  folioId: "FOLIO-ROOM-1737800000000",
  folioNumber: "F-2026-00040",
  folioType: "ROOM",
  status: "OPEN",  // Still accepting charges
  
  createdAt: "2026-01-24T14:00:00.000Z",
  closedAt: null,  // Not closed yet
  
  ownerId: "guest_profile_456",
  ownerName: "John Doe",
  ownerContact: "+256700123456",
  
  roomId: "rm_27",
  roomNumber: "RM 27",
  checkInDate: "2026-01-24T14:00:00.000Z",
  checkOutDate: null,  // Still in residence
  nightsBooked: 3,
  adults: 2,
  children: 1,
  
  subtotal: 435000,  // 3 nights + extras
  discountTotal: 0,
  taxTotal: 0,
  grandTotal: 435000,
  
  amountPaid: 0,
  paymentStatus: "UNPAID",
  
  createdBy: "reception_staff_789",
  createdByName: "Receptionist",
  closedBy: null,
  closedByName: null,
  
  v1LinkedRecords: {
    salesIds: ["TXN-1737850000111", "TXN-1737860000222"],  // POS charges
    checkoutId: null,
    roomId: "rm_27",
  },
  
  invoiceId: null,  // No invoice until closed
  invoiceNumber: null,
  
  serviceCenter: null,
};

// Line items for this folio
const roomLineItems: FolioLineItem[] = [
  {
    itemId: "FLI-1737800000000-001",
    folioId: "FOLIO-ROOM-1737800000000",
    createdAt: "2026-01-24T14:00:00.000Z",
    description: "Room Charge - RM 27 (Deluxe Double)",
    itemType: "ROOM_CHARGE",
    quantity: 3,  // 3 nights
    unitPrice: 140000,
    subtotal: 420000,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 420000,
    staffId: "reception_staff_789",
    staffName: "Receptionist",
    category: "Accommodation",
    v1SalesId: null,
    sourceModule: "RECEPTION",
    isOfflineCreated: false,
    isLocked: false,
  },
  {
    itemId: "FLI-1737850000111-002",
    folioId: "FOLIO-ROOM-1737800000000",
    createdAt: "2026-01-25T19:30:00.000Z",
    description: "POS: Beer (2), Soda (1)",
    itemType: "BAR_ORDER",
    quantity: 1,
    unitPrice: 15000,
    subtotal: 15000,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 15000,
    staffId: "bar_staff_123",
    staffName: "Bar Staff",
    category: "Drinks",
    v1SalesId: "TXN-1737850000111",
    sourceModule: "POS",
    isOfflineCreated: false,
    isLocked: false,
  },
];
```

### 6.3 ROOM Folio (After Checkout)

```typescript
// Same folio after checkout
const roomFolioClosed: Folio = {
  // ... same as above, but:
  status: "CLOSED",
  closedAt: "2026-01-27T11:00:00.000Z",
  checkOutDate: "2026-01-27T11:00:00.000Z",
  
  amountPaid: 435000,
  paymentStatus: "PAID",
  
  closedBy: "reception_staff_789",
  closedByName: "Receptionist",
  
  v1LinkedRecords: {
    salesIds: ["TXN-1737850000111", "TXN-1737860000222"],
    checkoutId: "CHK-1737882001234",  // Now linked
    roomId: "rm_27",
  },
  
  invoiceId: "INV-1737882001234",
  invoiceNumber: "INV-2026-00043",
};
```

---

## 7. V1 → V2 WRITE MAPPING

### 7.1 Bar Order (handleSubmitOrder)

**v1 Write:** `setDoc → sales/{txId}`

**v2 Writes (to add):**

1. `setDoc → folios/{folioId}` — Create BAR folio (status: CLOSED)
2. `setDoc → folio_line_items/{itemId}` — One per cart item
3. `runTransaction → invoice_counters/{year}` — Get next invoice number
4. `setDoc → invoices/{invoiceId}` — Create invoice

**Pseudocode:**

```javascript
// After v1 write to sales/{txId}
const folioId = `FOLIO-BAR-${txId}`;

// Create folio (closed immediately for bar orders)
await setDoc(doc(db, 'folios', folioId), {
  folioId,
  folioType: 'BAR',
  status: 'CLOSED',
  // ... other fields from txPayload
  v1LinkedRecords: { salesIds: [txId] },
});

// Create line items
for (const item of cart) {
  const itemId = `FLI-${Date.now()}-${index}`;
  await setDoc(doc(db, 'folio_line_items', itemId), {
    itemId,
    folioId,
    description: item.name,
    quantity: item.qty,
    unitPrice: item.price,
    // ... other fields
    v1SalesId: txId,
  });
}

// Create invoice (atomic with counter)
await runTransaction(db, async (tx) => {
  // Get/increment counter
  const counter = await tx.get(doc(db, 'invoice_counters', '2026'));
  const newNum = (counter.data()?.lastNumber || 0) + 1;
  tx.update(doc(db, 'invoice_counters', '2026'), { lastNumber: newNum });
  
  // Create invoice
  const invoiceId = `INV-${Date.now()}`;
  const invoiceNumber = `INV-2026-${String(newNum).padStart(5, '0')}`;
  tx.set(doc(db, 'invoices', invoiceId), {
    invoiceId,
    invoiceNumber,
    folioId,
    // ... snapshot of folio data
  });
  
  // Update folio with invoice reference
  tx.update(doc(db, 'folios', folioId), {
    invoiceId,
    invoiceNumber,
  });
});
```

### 7.2 Room Check-In (handleCheckIn)

**v1 Write:** `updateDoc → rooms/{roomId}`

**v2 Writes (to add):**

1. `setDoc → folios/{folioId}` — Create ROOM folio (status: OPEN)
2. `setDoc → folio_line_items/{itemId}` — Room charge line item

**Pseudocode:**

```javascript
// After v1 write to rooms/{roomId}
const folioId = `FOLIO-ROOM-${Date.now()}`;

// Create open folio
await setDoc(doc(db, 'folios', folioId), {
  folioId,
  folioType: 'ROOM',
  status: 'OPEN',
  roomId: selectedRoom.id,
  roomNumber: selectedRoom.number,
  ownerName: guestName,
  v1LinkedRecords: { roomId: selectedRoom.id },
  // ... other fields
});

// Add room charge line item
const roomChargePerNight = selectedRoom.price;
await setDoc(doc(db, 'folio_line_items', `FLI-${Date.now()}-001`), {
  folioId,
  description: `Room Charge - ${selectedRoom.number} (${selectedRoom.type})`,
  itemType: 'ROOM_CHARGE',
  quantity: nightsBooked,
  unitPrice: roomChargePerNight,
  subtotal: nightsBooked * roomChargePerNight,
  // ... other fields
});

// Store folioId on room document for lookup
await updateDoc(doc(db, 'rooms', selectedRoom.id), {
  activeFolioId: folioId,  // New field for v2 linkage
});
```

### 7.3 Adding Room Charges (POS charge to room)

**v1 Write:** `updateDoc → rooms/{roomId}` (arrayUnion to guest.charges)

**v2 Writes (to add):**

1. `setDoc → folio_line_items/{itemId}` — New line item on open folio

**Pseudocode:**

```javascript
// After v1 write to rooms/{roomId}
// Find the active folio for this room
const roomDoc = await getDoc(doc(db, 'rooms', roomId));
const activeFolioId = roomDoc.data()?.activeFolioId;

if (activeFolioId) {
  // Add line item to existing folio
  await setDoc(doc(db, 'folio_line_items', `FLI-${Date.now()}-${index}`), {
    folioId: activeFolioId,
    description: `POS: ${items.map(i => i.name).join(', ')}`,
    itemType: 'BAR_ORDER',
    totalAmount: total,
    v1SalesId: txId,
    sourceModule: 'POS',
    // ... other fields
  });
  
  // Update folio totals
  await updateDoc(doc(db, 'folios', activeFolioId), {
    subtotal: increment(total),
    grandTotal: increment(total),
  });
}
```

### 7.4 Room Checkout (handleCheckOut)

**v1 Writes:**

1. `setDoc → checkouts/{checkoutId}`
2. `updateDoc → rooms/{roomId}` (clear guest)

**v2 Writes (to add):**

1. `updateDoc → folios/{folioId}` — Close folio (status: CLOSED)
2. Lock all line items (already immutable by design)
3. `runTransaction → invoice_counters/{year}` — Get next invoice number
4. `setDoc → invoices/{invoiceId}` — Create invoice

**Pseudocode:**

```javascript
// Get active folio before v1 checkout
const roomDoc = await getDoc(doc(db, 'rooms', room.id));
const activeFolioId = roomDoc.data()?.activeFolioId;

// Do v1 checkout writes
await setDoc(doc(db, 'checkouts', checkoutId), checkoutRecord);
await updateDoc(doc(db, 'rooms', room.id), { status: 'dirty', guest: null });

// Close v2 folio and create invoice
if (activeFolioId) {
  await runTransaction(db, async (tx) => {
    // Get counter
    const counter = await tx.get(doc(db, 'invoice_counters', '2026'));
    const newNum = (counter.data()?.lastNumber || 0) + 1;
    tx.update(doc(db, 'invoice_counters', '2026'), { lastNumber: newNum });
    
    // Create invoice
    const invoiceId = `INV-${Date.now()}`;
    const invoiceNumber = `INV-2026-${String(newNum).padStart(5, '0')}`;
    
    // Fetch folio and line items for snapshot
    const folioDoc = await tx.get(doc(db, 'folios', activeFolioId));
    const lineItemsQuery = query(
      collection(db, 'folio_line_items'),
      where('folioId', '==', activeFolioId)
    );
    // ... build invoice from folio data
    
    tx.set(doc(db, 'invoices', invoiceId), {
      invoiceId,
      invoiceNumber,
      folioId: activeFolioId,
      v1CheckoutId: checkoutId,
      // ... snapshot of all folio data and line items
    });
    
    // Close folio
    tx.update(doc(db, 'folios', activeFolioId), {
      status: 'CLOSED',
      closedAt: new Date().toISOString(),
      invoiceId,
      invoiceNumber,
      v1LinkedRecords: {
        checkoutId: checkoutId,
        // preserve existing salesIds and roomId
      },
    });
  });
  
  // Clear active folio reference from room
  await updateDoc(doc(db, 'rooms', room.id), {
    activeFolioId: null,
  });
}
```

---

## 8. OFFLINE HANDLING

### 8.1 Offline-Safe Operations (Per MASTERVERSION2.md Section 2.5)

**Allowed Offline:**

- Creating line items on OPEN folios (room charges during stay)
- Queuing BAR transactions (existing v1 offline queue)

**Requires Connectivity:**

- Invoice finalization (atomic invoice number generation)
- Folio closure (triggers invoice creation)

### 8.2 Offline Line Item Queue

```typescript
// Local storage structure for offline line items
interface OfflineLineItemQueue {
  items: {
    tempId: string;           // Temporary ID for queue management
    folioId: string;          // Target folio
    lineItem: Partial<FolioLineItem>;
    createdAt: string;
    syncAttempts: number;
  }[];
}

// On online sync
for (const queuedItem of offlineQueue.items) {
  const itemId = `FLI-${Date.now()}-${uuid()}`;
  await setDoc(doc(db, 'folio_line_items', itemId), {
    ...queuedItem.lineItem,
    itemId,
    isOfflineCreated: true,
    syncedAt: new Date().toISOString(),
  });
  // Remove from queue
}
```

### 8.3 Checkout Offline Handling

```
┌─────────────────────────────────────────────────────────────────┐
│ USER ATTEMPTS CHECKOUT WHILE OFFLINE                            │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
         ┌─────────────────────────────────────┐
         │ Check network connectivity          │
         └─────────────────────────────────────┘
                    │              │
                 Online          Offline
                    ▼              ▼
         ┌─────────────┐  ┌─────────────────────────────┐
         │ Proceed     │  │ Show "Not Finalized" state  │
         │ normally    │  │ Allow local-only checkout   │
         └─────────────┘  │ Queue for sync              │
                          │ Block invoice printing      │
                          └─────────────────────────────┘
                                       │
                                       ▼ (when online)
                          ┌─────────────────────────────┐
                          │ Sync checkout               │
                          │ Generate invoice number     │
                          │ Finalize folio              │
                          │ Enable invoice printing     │
                          └─────────────────────────────┘
```

---

## 9. AUDIT LOG INTEGRATION

### 9.1 Audit Log Document (`/audit_logs/{logId}`)

```typescript
interface AuditLog {
  logId: string;
  timestamp: string;
  
  // Action details
  action: 'FOLIO_CREATE' | 'FOLIO_CLOSE' | 'FOLIO_VOID' | 
          'LINE_ITEM_ADD' | 'INVOICE_CREATE' | 'INVOICE_PRINT' |
          'DISCOUNT_APPLY' | 'PAYMENT_RECEIVE';
  
  // Entity references
  entityType: 'FOLIO' | 'LINE_ITEM' | 'INVOICE';
  entityId: string;
  
  // Actor
  userId: string;
  userName: string;
  userRole: string;
  
  // Change details
  previousState: object | null;  // For updates
  newState: object;
  
  // Context
  ipAddress: string | null;
  deviceInfo: string | null;
  isOfflineAction: boolean;
}
```

### 9.2 Audit Triggers

Every v2 write operation logs to `audit_logs`:

| Action | Trigger |
|--------|---------|
| `FOLIO_CREATE` | New folio created |
| `FOLIO_CLOSE` | Folio status → CLOSED |
| `FOLIO_VOID` | Folio status → VOIDED |
| `LINE_ITEM_ADD` | New line item created |
| `INVOICE_CREATE` | Invoice generated |
| `INVOICE_PRINT` | Invoice printed/downloaded |
| `DISCOUNT_APPLY` | Discount applied to line item |
| `PAYMENT_RECEIVE` | Payment recorded |

---

## 10. MIGRATION CHECKLIST

### Phase 1: Schema Deployment

- [ ] Create `invoice_counters` collection with initial counter
- [ ] Deploy updated Firestore security rules (from MASTERVERSION2.md)
- [ ] Create indexes for folio and line item queries

### Phase 2: Dual-Write Implementation

- [ ] Modify `handleSubmitOrder()` to create BAR folios
- [ ] Modify `handleCheckIn()` to create ROOM folios
- [ ] Modify room charge functions to add line items
- [ ] Modify `handleCheckOut()` to close folios and create invoices

### Phase 3: Verification

- [ ] Compare v1 sales records with v2 BAR folios
- [ ] Compare v1 checkout records with v2 ROOM folios
- [ ] Verify invoice number sequence is gapless
- [ ] Test offline behavior for all scenarios

### Phase 4: UI Updates

- [ ] Add folio status indicator in room view
- [ ] Add invoice number display on receipts
- [ ] Add "Not Finalized" indicator for offline checkouts
- [ ] Add folio search/filter in admin reports

---

## 11. DOCUMENT METADATA

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Created | 2026-01-26 |
| Author | STEP 4 Analysis |
| Status | READY FOR IMPLEMENTATION |
| Reference | MASTERVERSION2.md |
| Dependencies | STEP 3 Analysis Complete |

---

## ✅ STEP 4 COMPLETE

V2 folio schema is fully designed and ready for implementation.

**Next Step:** STEP 5 — Implement dual-write functions (shadow mode)
