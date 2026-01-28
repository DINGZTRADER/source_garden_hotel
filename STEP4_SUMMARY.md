# ✅ STEP 4 COMPLETE — V2 Folio Schema Design

**Status:** COMPLETE  
**Date:** 2026-01-26

---

## 📦 DELIVERABLES

| File | Purpose |
|------|---------|
| `STEP4_FOLIO_SCHEMA.md` | Comprehensive schema documentation |
| `src/types/folio.types.js` | TypeScript/JSDoc type definitions |

---

## 🏗️ V2 COLLECTIONS DESIGNED

### Core Financial Collections

| Collection | Purpose | Mutability |
|------------|---------|------------|
| `/folios/{folioId}` | Folio headers (core container) | Update while OPEN only |
| `/folio_line_items/{itemId}` | Individual charges | CREATE-ONLY |
| `/invoices/{invoiceId}` | Finalized invoices | IMMUTABLE |
| `/invoice_counters/{year}` | Sequential numbering | Atomic increment only |

### Supporting Collections

| Collection | Purpose | Mutability |
|------------|---------|------------|
| `/discount_rules/{ruleId}` | Discount configuration | Admin-editable |
| `/discount_events/{eventId}` | Applied discount log | CREATE-ONLY |
| `/audit_logs/{logId}` | Audit trail | APPEND-ONLY |
| `/guest_profiles/{guestId}` | PII-protected data | Admin-editable |

---

## 📊 FOLIO TYPES

### BAR Folio

- **Created:** When POS order is submitted
- **Lifecycle:** Instantly created → closed (single transaction)
- **Duration:** Immediate
- **Invoice:** Generated immediately

### ROOM Folio

- **Created:** When guest checks in
- **Lifecycle:** Open during stay, closed at checkout
- **Duration:** 1+ nights
- **Invoice:** Generated at checkout

---

## 🔄 V1 → V2 WRITE MAPPING

### Bar Order Flow

```
v1: setDoc → sales/{txId}
v2: setDoc → folios/{folioId}           (status: CLOSED)
    setDoc → folio_line_items/{itemId}  (per cart item)
    transaction → invoice_counters      (atomic increment)
    setDoc → invoices/{invoiceId}       (finalized)
```

### Room Check-In Flow

```
v1: updateDoc → rooms/{roomId}
v2: setDoc → folios/{folioId}           (status: OPEN)
    setDoc → folio_line_items/{itemId}  (room charge)
    updateDoc → rooms/{roomId}          (add activeFolioId field)
```

### Room Charge Flow

```
v1: updateDoc → rooms/{roomId} (arrayUnion to guest.charges)
v2: setDoc → folio_line_items/{itemId}  (on active folio)
    updateDoc → folios/{folioId}        (update totals)
```

### Room Checkout Flow

```
v1: setDoc → checkouts/{checkoutId}
    updateDoc → rooms/{roomId}
v2: transaction → invoice_counters      (atomic increment)
    setDoc → invoices/{invoiceId}       (finalized)
    updateDoc → folios/{folioId}        (status: CLOSED)
```

---

## 📋 KEY SCHEMA FEATURES

### 1. Folio Status Lifecycle

```
OPEN → CLOSED (generates invoice)
OPEN → VOIDED (no invoice, logged)
```

### 2. Sequential Invoice Numbers

- Format: `INV-{year}-{seq5}` (e.g., `INV-2026-00001`)
- Atomic counter in `/invoice_counters/{year}`
- Gapless sequence guaranteed by Firestore transaction

### 3. V1 Linkage

Every v2 document contains `v1LinkedRecords`:

```javascript
v1LinkedRecords: {
  salesIds: ["TXN-123", "TXN-456"],
  checkoutId: "CHK-789",
  roomId: "rm_27"
}
```

### 4. Offline Support

- Line items can be created offline on OPEN folios
- Invoice finalization requires connectivity
- UI shows "Not Finalized" state when offline

### 5. Audit Trail

Every action logs to `/audit_logs/{logId}`:

- `FOLIO_CREATE`, `FOLIO_CLOSE`, `FOLIO_VOID`
- `LINE_ITEM_ADD`, `INVOICE_CREATE`, `INVOICE_PRINT`
- `DISCOUNT_APPLY`, `PAYMENT_RECEIVE`

---

## 🔒 SECURITY RULES (from MASTERVERSION2.md)

| Collection | Create | Read | Update | Delete |
|------------|--------|------|--------|--------|
| `folios` | All staff | All staff | Admin/Manager (OPEN only) | ❌ |
| `folio_line_items` | All staff | All staff | ❌ | ❌ |
| `invoices` | Admin only | All staff | ❌ | ❌ |
| `audit_logs` | All staff | Admin only | ❌ | ❌ |

---

## ⏭️ NEXT STEPS

### STEP 5: Implement Dual-Write Functions

1. **Create folio service module**
   - `createBarFolio()`
   - `createRoomFolio()`
   - `addLineItem()`
   - `closeFolio()`

2. **Integrate with existing handlers**
   - Modify `handleSubmitOrder()` in App.js
   - Modify `handleCheckIn()` in App.js
   - Modify `handleCheckOut()` in App.js

3. **Add audit logging**
   - Create `logAuditEvent()` helper
   - Call on every folio operation

4. **Test dual-write behavior**
   - Verify v1 and v2 data match
   - Verify offline resilience
   - Verify invoice sequence

---

## 📚 REFERENCE DOCUMENTS

| Document | Purpose |
|----------|---------|
| `MASTERVERSION2.md` | Authoritative requirements |
| `STEP3_FIREBASE_ANALYSIS.md` | V1 write path analysis |
| `STEP4_FOLIO_SCHEMA.md` | V2 schema specification |
| `src/types/folio.types.js` | Type definitions |

---

## ✅ STEP 4 OBJECTIVES ACHIEVED

1. ✅ Defined `Folio` document structure
2. ✅ Defined `FolioLineItem` document structure
3. ✅ Defined `Invoice` document structure
4. ✅ Designed sequential invoice numbering
5. ✅ Mapped v1 → v2 write paths
6. ✅ Specified offline handling
7. ✅ Documented status lifecycle
8. ✅ Created TypeScript type definitions
9. ✅ Aligned with MASTERVERSION2.md security rules

---

**Schema design complete. Ready for STEP 5 implementation.**
