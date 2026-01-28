DEPARTMENTS

Examples:

Main Bar

Riverside Bar

Restaurant

Health Club

Swimming Pool

Each user is locked to one department.

TABLE LOGIC

Tables are department-scoped and visually stateful.

Table states:

free

active

billing

disabled (admin only)

Firestore tables
tables/{tableId} {
  "departmentId": "main_bar",
  "tableNumber": "T1",
  "status": "free",
  "currentOrderId": null
}

ORDER LOGIC (TABLE-CENTRIC)

One open order per table

If a table is active, reopen the existing order

Orders belong to:

department

table

logged-in user (staffEmail)

Firestore orders
orders/{orderId} {
  "departmentId": "main_bar",
  "tableId": "main_bar_T1",
  "staffEmail": "mainbar@domain.com",
  "status": "open",          // open | paid | cancelled
  "createdAt": timestamp,
  "total": number
}

Firestore orderItems
orderItems/{itemId} {
  "orderId": "orderId",
  "name": "Nile Special",
  "qty": 2,
  "price": 8000
}

PAYMENT LOGIC (CRITICAL – DO NOT BREAK PMS)
Supported payment methods:

Cash

Mobile Money (MM)

Card

Room

Key Rule:

The POS does NOT manage rooms.
Rooms are owned by Reception / PMS.

ROOM PAYMENTS (INTEGRATION – NOT REWRITE)
Behavior:

When Payment = Room:

Show a dropdown

ONLY list rooms where status == "occupied"

User must select a room before completing payment

Room charges must be visible at Reception immediately

Firestore rooms (READ ONLY for POS)
rooms/{roomId} {
  "roomNumber": "101",
  "status": "occupied",     // vacant | occupied
  "guestName": "John Doe",
  "currentFolioId": "folio_abc"
}

Firestore payments
payments/{paymentId} {
  "orderId": "order_123",
  "method": "room",         // cash | momo | card | room
  "roomId": "room_101",     // only if method == room
  "folioId": "folio_abc",   // required for room charges
  "amount": 45000,
  "paidAt": timestamp,
  "source": "main_bar"
}


POS can CREATE payments

POS CANNOT modify room status or folios

RECEIPTS & PRINTING

Receipt prints on completion

Must show:

Department

Table

Items

Total

Payment method

If Room: “Charged to Room XXX”

Printing logic must not affect room billing

REALTIME REQUIREMENTS

Tables update live across devices

Order status updates instantly

Reception can see room charges immediately

OFFLINE REQUIREMENTS

Orders and payments must queue offline

Queue syncs automatically when online

No data loss

FIRESTORE SECURITY (ENFORCED)

Staff:

Can only read/write documents in their department

Admin:

Full access

Rooms:

Read-only for POS users

Default deny all unspecified access

UI PRIORITIES

Touch-friendly

Minimal clicks

Clear visual states

No unnecessary dialogs

Speed over polish (for now)

NON-GOALS (DO NOT BUILD)

Do NOT redesign the PMS

Do NOT change room logic

Do NOT introduce staff email/password per waiter

Do NOT refactor auth during this phase

SUCCESS CRITERIA

Staff can log in and sell immediately

Tables behave correctly

Payments work (including Room)

Reception sees room charges

System survives power/network loss

No breaking changes to existing logic

Build exactly this system.