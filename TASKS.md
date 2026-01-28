# Source Garden Hotel POS – Build Tasks

This file defines the EXACT build order.
Tasks must be completed sequentially.
Do NOT skip steps or introduce features early.

---

## PHASE 0 – PROJECT BOOTSTRAP

Goal: Safe foundation

1. Initialize React project
2. Install dependencies:
   - firebase
   - lucide-react
   - tailwindcss
3. Configure Firebase connection
4. Verify Firebase Auth login works with EXISTING users

✅ Exit condition:

- User can log in and see a blank screen

---

## PHASE 1 – AUTH & SESSION CONTROL

Goal: Correct identity + department lock

1. Implement AuthGate
2. On login:
   - Load `users/{uid}` from Firestore
   - Read:
     - role
     - departmentId
3. Store session in memory (no global state lib yet)

❌ Do NOT:

- Change auth method
- Add staff selection UI

✅ Exit condition:

- User is automatically routed to their department context

---

## PHASE 2 – TABLES SCREEN (REALTIME)

Goal: Core operational visibility

1. Build Tables screen
2. Query Firestore:
   - tables where departmentId == user.departmentId
3. Listen with realtime updates
4. Display table states:
   - free
   - active
   - billing (optional)
   - disabled (admin only)

5. Table click behavior:
   - free → create order
   - active → open existing order

✅ Exit condition:

- Two devices see table changes live

---

## PHASE 3 – ORDER CREATION & MANAGEMENT

Goal: Sell items correctly

1. When table is opened:
   - Create ONE order per table
2. Lock table status = active
3. Build Order screen:
   - Add items
   - Update quantities
   - Calculate running total
4. Store items in `orderItems`
5. Persist order state safely

❌ Do NOT:

- Allow multiple open orders per table

✅ Exit condition:

- Orders survive refresh and reconnect

---

## PHASE 4 – REVIEW & PAYMENT

Goal: Close orders safely

1. Build Review screen:
   - Items
   - Totals
   - Payment buttons
2. Payment methods:
   - Cash
   - Mobile Money
   - Card
   - Room

3. For Room payment:
   - Query rooms where status == "occupied"
   - Show dropdown
   - Require selection before completion

❌ Do NOT:

- Modify rooms
- Modify folios

✅ Exit condition:

- Payments are written correctly to Firestore

---

## PHASE 5 – ROOM INTEGRATION SAFETY

Goal: Zero PMS breakage

1. POS reads rooms (READ ONLY)
2. On room payment:
   - Write payment with:
     - roomId
     - folioId
3. Reception can see charges immediately

❌ Absolute rules:

- POS NEVER changes room status
- POS NEVER edits folios

✅ Exit condition:

- Reception confirms room charges appear correctly

---

## PHASE 6 – COMPLETE & PRINT

Goal: Operational closure

1. On payment completion:
   - Mark order = paid
   - Free table
2. Generate receipt:
   - Department
   - Table
   - Items
   - Payment method
   - Room number (if applicable)
3. Trigger print

✅ Exit condition:

- Staff returns automatically to Tables screen

---

## PHASE 7 – OFFLINE SAFETY

Goal: Uganda-proof system

1. Queue:
   - Orders
   - Payments
2. Detect offline state
3. Replay queue when online
4. Prevent duplicates

✅ Exit condition:

- Sales work with internet off

---

## PHASE 8 – ADMIN (OPTIONAL, LAST)

Goal: Control without disruption

1. Admin can:
   - Edit staff profiles
   - Enable/disable tables
2. Admin sees all departments

❌ Do NOT:

- Block staff flow

---

## FINAL ACCEPTANCE TEST

System is approved only if:

- Staff can sell immediately
- Tables behave correctly
- Room bills appear at reception
- No data loss offline
- No auth or PMS refactors required
