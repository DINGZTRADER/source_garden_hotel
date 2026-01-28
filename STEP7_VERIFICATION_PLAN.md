# STEP 7: Verification & Testing Plan

**Status:** PLANNING
**Date:** 2026-01-26

---

## 🎯 OBJECTIVE

Verify that the Source Garden HMS is successfully running in "Dual-Write" mode, ensuring data integrity between the legacy V1 system (sales/rooms) and the new V2 financial engine (folios/invoices).

## 🧪 TEST STRATEGY

We will perform a series of "End-to-End" (E2E) tests simulating real-world hotel operations. For each action, we will verify:

1. **UI Feedback**: Does the app behave normally for the staff?
2. **V1 Write**: Is the legacy data correct?
3. **V2 Write**: Is the new folio/invoice data correct?
4. **Audit Log**: Is the action securely logged?

---

## 📋 TEST CASES

### TEST A: Bar Sale (Cash)

**Action**: Create a POS order for "1x Nile Special" paid via Cash.

* **V1 Expectation**: New doc in `sales/{txId}`.
* **V2 Expectation**:
  * New Folio in `folios/{folioId}` (Status: CLOSED, Type: BAR).
  * New Invoice in `invoices/{invoiceId}`.
  * Invoice counter incremented.
* **Audit**: Log entry `FOLIO_CREATE` and `INVOICE_CREATE`.

### TEST B: Room Check-In

**Action**: Check in a guest to a Room (e.g., Room 101).

* **V1 Expectation**: `rooms/{roomId}` status becomes 'occupied'.
* **V2 Expectation**:
  * New Folio in `folios/{folioId}` (Status: OPEN, Type: ROOM).
  * Audit log `FOLIO_CREATE`.

### TEST C: Charge to Room

**Action**: Add a POS order (e.g., Dinner) charged to Room 101.

* **V1 Expectation**: `rooms/{roomId}.guest.charges` array updated.
* **V2 Expectation**:
  * New `FolioLineItem` added to the open Room Folio.
  * Folio totals updated.
  * Audit log `LINE_ITEM_ADD`.

### TEST D: Room Checkout

**Action**: Check out the guest from Room 101.

* **V1 Expectation**: `rooms/{roomId}` status 'dirty', checkout record created.
* **V2 Expectation**:
  * Room Folio status changes to CLOSED.
  * Final Invoice generated.
  * Audit log `FOLIO_CLOSE`.

---

## 🛠️ VERIFICATION TOOLS

### 1. Automated Verification Script

We will use `src/services/folioTest.js` (already initialized in App.js) to run a headless verification suite in the browser console.

### 2. Manual UI Verification

We will use the newly built **Financial Dashboard** to visually confirm:

* Invoices appear in the list.
* Open folios appear in the active list.
* Audit logs show the recent actions.

---

## ⏭️ EXECUTION STEPS

1. **Run Automated Tests**: Execute `window.testV2Folio()` in the browser console (simulated via agent command or user instruction).
2. **Manual Verification**: Ask user to perform a real flow (optional) or verify the dashboard.
3. **Sign-Off**: Confirm V1/V2 parity.

---

## ✅ SUCCESS CRITERIA

* All V2 writes occur without errors.
* V2 Invoices are sequential.
* V1 operations remain uninterrupted.
