SGHMS v2 — TECHNICAL ARCHITECTURE (LOCKED)
1. Architecture Overview (High Level)

Pattern: Modular Monolith (v2), API-first
Reason:

Easier auditing than microservices

Lower operational risk

Clear transaction boundaries

[ Frontend (Web / Desktop) ]
            |
            v
[ Application API Layer ]
            |
            v
[ Domain Modules ]
  ├─ Billing & Folios
  ├─ Invoicing
  ├─ Discounts & Rules
  ├─ Guest Management
  ├─ Room Management
  ├─ Audit Logging
            |
            v
[ Database ]


AI (future v3) will sit outside this core and call explicit APIs only.

2. Core Domain Modules (Authoritative)
2.1 Billing & Folios (CORE OF THE SYSTEM)
Entities
Folio {
  folio_id: UUID
  folio_type: "MASTER" | "INDIVIDUAL"
  parent_folio_id?: UUID
  guest_id?: UUID
  status: "OPEN" | "CLOSED"
  created_at
}

FolioLineItem {
  item_id: UUID
  folio_id: UUID
  description
  quantity
  unit_price
  total_price
  created_by_user_id
  created_at
}


Rules

Every charge must belong to a folio

Rooms never hold financial data

Closing a folio is a one-way operation

2.2 Invoicing (AUDIT-CRITICAL)
Invoice Entity
Invoice {
  invoice_id: UUID
  invoice_number: string   // SGH-2026-000123
  folio_id: UUID
  subtotal
  tax
  total
  status: "FINAL"
  issued_at
}

Invoice Number Generator (MANDATORY)

Implemented at database level

Atomic counter

One sequence per financial year

No deletes

No edits after issuance

If a mistake occurs → future Credit Note module (v3).

2.3 Discount & Rules Engine (NO HARD-CODING)
DiscountRule
DiscountRule {
  rule_id: UUID
  name
  percentage | fixed_amount
  valid_from
  valid_to
  allowed_roles
  is_active
}

DiscountEvent (Audit Trail)
DiscountEvent {
  event_id: UUID
  folio_id
  rule_id
  approved_by_user_id
  original_amount
  discounted_amount
  timestamp
}


Key Rule

Discounts modify totals, never history.

2.4 Audit Log (IMMUTABLE)
AuditLog {
  log_id: UUID
  actor_id
  actor_type: "USER" | "SYSTEM"
  action
  entity_type
  entity_id
  metadata
  timestamp
}


Properties

Append-only

No updates

No deletes

Separate from operational tables

This protects you legally.

2.5 Guest Management (PII-SAFE)
GuestProfile {
  guest_id: UUID
  full_name
  phone_number_encrypted
  date_of_birth_encrypted
  created_at
}


Rules

Phone number = secondary unique key

Masked in UI unless role allows

Encryption at rest required

2.6 Room Management (HISTORICAL PRESERVATION)
Room {
  room_id: UUID
  room_number
  room_type
  status: "ACTIVE" | "INACTIVE" | "DECOMMISSIONED"
}


Rooms are never deleted.

3. Authorization Model (Enforced in Backend)
Role Matrix (Implemented in Code, Not UI)
Action	Admin	Manager	Receptionist
Create Folio	✅	✅	✅
Apply Discount	✅	Rule-based	❌
Finalize Invoice	✅	❌	❌
View Full PII	✅	Partial	❌
Close Work Period	✅	❌	❌

Backend rejects unauthorized actions even if UI is bypassed.

4. Printing Architecture (Deterministic)

Trigger: Invoice.status = FINAL
Flow:

Payment confirmed

Invoice finalized

Print job dispatched

Audit log written

No speculative or AI-driven printing.

5. Failure & Offline Strategy (v2 Minimal)

No invoice finalization without connectivity

Charges can be queued in folios

UI clearly indicates “Not finalized”

Prevents audit gaps

6. What This Architecture Guarantees

No missing invoices

No invisible discounts

No historical data loss

Staff clarity

Audit defensibility

Safe foundation for AI later

Next Step (Execution Phase)

We now have two correct next moves. Choose one:

Option 1 — Data Layer Implementation

Translate this into actual database schema + migrations.

Option 2 — User Workflow Mapping

Convert architecture into exact staff screen flows (check-in → checkout).

Reply with Option 1 or Option 2.

Once chosen, we begin implementation-level detail.