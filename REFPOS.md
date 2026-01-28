Reference POS Model (Authoritative)

This is not UI.
This is the source of truth the UI must obey.

1. Core Principle (Freeze This)

A Service Center can have MANY concurrent OPEN orders.
An Order is the atomic unit of billing.

If this principle is violated anywhere, the system is invalid.

2. Canonical Data Model
2.1 ServiceCenter

Represents a physical or logical point of sale.

ServiceCenter {
  id: string              // e.g. "MAIN_BAR"
  name: string            // "Main Bar"
  type: BAR | RESTAURANT | POOL | SPA
  isActive: boolean
}


✅ One service center
❌ Never stores totals
❌ Never stores items
❌ Never stores payments

2.2 Order (THIS IS THE HEART)
Order {
  id: string              // e.g. MB-2026-000123
  serviceCenterId: string
  openedAt: timestamp
  closedAt: timestamp | null

  status: OPEN | PART_PAID | PAID | CANCELLED

  openedByStaffId: string

  notes?: string          // "Group near window", "Table 4"

  totalAmount: number     // derived, not manually edited
}


Rules

One group = one order

Orders are independent

Order exists even if UI closes or staff logs out

2.3 OrderItem
OrderItem {
  id: string
  orderId: string

  productId: string
  productName: string
  unitPrice: number
  quantity: number

  addedByStaffId: string
  addedAt: timestamp
}


Rules

Items belong to ONE order only

Editing items updates order total automatically

Never shared between orders

2.4 Payment (Critical for Real Life)
Payment {
  id: string
  orderId: string

  method: CASH | MTN_MOMO | AIRTEL_MOMO | CARD
  amount: number

  receivedByStaffId: string
  receivedAt: timestamp
}


Rules

An order can have MANY payments

Payments NEVER overwrite totals

Balance = total − sum(payments)

2.5 StaffUser (Audit is non-negotiable)
StaffUser {
  id: string
  name: string
  role: CASHIER | BARTENDER | SUPERVISOR | ADMIN
}


Every action must reference staffId.

3. Order State Machine (THIS IS WHAT ANTIGRAVITY LIKELY MISSED)
OPEN
 ├── add items
 ├── remove items
 ├── add payment (partial)
 │        ↓
 │     PART_PAID
 │        ├── add items
 │        ├── add payment
 │        │        ↓
 │        │      PAID
 │        └── cancel (supervisor)
 └── cancel

State Rules

OPEN → no payment or partial payment

PART_PAID → some money received

PAID → balance = 0 → auto close

CANCELLED → immutable, logged

4. How 10 Groups at the Bar Are Represented
Database Reality (Simultaneous)
Orders table:

MB-0001 | OPEN       | UGX 120,000
MB-0002 | OPEN       | UGX 45,000
MB-0003 | PART_PAID  | UGX 210,000
MB-0004 | OPEN       | UGX 18,000
MB-0005 | PAID       | UGX 60,000
MB-0006 | OPEN       | UGX 92,000
MB-0007 | OPEN       | UGX 34,000
MB-0008 | OPEN       | UGX 11,000
MB-0009 | OPEN       | UGX 78,000
MB-0010 | OPEN       | UGX 150,000

UI Is Just a View of This

The UI does not own state.
The database does.

5. Mandatory POS Screens (Derived From Model)
5.1 Service Center Dashboard

Shows:

List of OPEN / PART_PAID orders

Order ID

Amount

Status

Time open

❌ Not “current bill”
❌ Not “one running tab”

5.2 Order Detail Screen

Shows:

Items

Payments

Balance

Audit trail

6. Non-Negotiable Behaviors (Audit Checklist)

Ask Antigravity YES / NO to each:

Can Main Bar have 10 open orders at once?

Does each order have a unique Order ID?

Can payments be split across methods?

Does partial payment keep order open?

If staff logs out, do orders persist?

Are staff actions logged?

Can supervisor reopen a wrongly closed order?

If any answer is NO, the system is broken.

7. Why This Matters for Reports & Money

If the model is wrong:

Cash reports won’t reconcile

Stock deductions will be wrong

Staff disputes will be unresolvable

Theft becomes easy

End-of-day close fails

A POS is a financial system, not a screen.

8. What You Should Tell Antigravity (Exact Instruction)

You can copy-paste this:

“Please map your POS exactly to this reference model:
ServiceCenter → Orders → OrderItems → Payments.

Confirm support for multiple concurrent open orders per service center, partial payments, and order persistence independent of UI sessions.

Do not modify UI until the data model and order state machine are confirmed.”