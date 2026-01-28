MASTER PROMPT — Source Garden Hotel POS Refinement
Context

You are working on a production-grade, offline-first React POS system for Source Garden Hotel, operating across multiple service centers (bars, kitchen, pool, health club, front office).
The system is already live, stable, and used by staff with minimal IT support and unreliable internet.

Your task is to refine and simplify the system while preserving reliability, auditability, and staff performance tracking.

Core Design Principles (DO NOT VIOLATE)

Simplicity over features

Offline-first always

No workflow friction for service staff

Every sale must be attributable to a human

No single failure may block a sale

Append-only audit trail

No unnecessary abstractions or enterprise complexity

REQUIRED CHANGES (MANDATORY)
1. ❌ Remove Shift / Work-Period Gating

Completely remove:

Admin “Open Shift / Close Shift”

POS locking outside work periods

POS must be usable any time a staff member is logged in

Retain timestamps for:

Sale creation

Void

Payment

Rationale:

Hotel operates continuously

Shift gating creates operational friction and workarounds

Performance and reconciliation can be done via timestamps, not locks

2. ✅ POS Screen = One Active Bill (No Tables)

Each POS terminal can handle only ONE active bill at a time

No table numbers

No table switching

When a bill is settled:

Cart clears immediately

POS is ready for the next guest

Rationale:

Reduces cognitive load

Prevents abandoned or mixed bills

Matches real bar / counter behavior

3. ✅ Bills Are Owned by Service Staff (Not Tables)

Every bill must be explicitly attached to a service staff member

On POS load:

Staff selects themselves from a list (placeholder names allowed)

Example placeholders:

Service Staff A

Service Staff B

Service Staff C

Staff selection persists for the session

Each sale records:

service_staff_id

service_staff_name

service_center

Rationale:

Enables accurate performance tracking

Supports targets, commissions, accountability

Mirrors how good hotels evaluate staff

4. ✅ Staff Performance Metrics (Lightweight)

Without adding dashboards or complexity, ensure data supports:

Sales per staff (daily / monthly)

Total value sold per staff

Items sold per staff

Room charges initiated per staff

Do not add UI dashboards now
Just ensure the data model supports this cleanly

5. ✅ Keep Dual-Write (V1 + V2) Exactly As Is

V1 must always succeed

V2 failures must:

Be logged

Never block sales

Invoice numbering remains sequential

Audit logs remain append-only

Do NOT refactor dual-write unless there is a bug.

6. ✅ Offline Guarantees Must Remain Untouched

LocalStorage persistence

Offline queue for:

Sales

Voids

Auto-sync on reconnection

Survive:

Browser refresh

Power loss

Temporary crashes

THINGS NOT TO ADD

🚫 Table management
🚫 Kitchen display systems
🚫 Loyalty programs
🚫 Multi-bill per screen
🚫 Complex shift logic
🚫 Inventory costing logic
🚫 Accounting journals
🚫 Excessive configuration screens

If it does not directly improve speed, accountability, or reliability, do not add it.

BENCHMARK COMPARISON (FOR INSPIRATION ONLY)

Toast POS: Excellent staff attribution and simplicity → emulate conceptually, not architecturally

Square POS: Fast, single-screen flow → match speed, not features

Lightspeed: Strong reporting → keep only the data hooks, not the UI complexity

Your system should remain leaner than all of them.

OUTPUT EXPECTATION

When modifying or proposing changes:

Explain what changes

Explain why

Provide clean, production-ready code

Avoid speculative features

Prefer deletion over addition where possible

FINAL CHECK

Before finalizing any change, ask:

“Does this make the POS easier for a tired staff member at 11:45 PM with bad internet?”

If the answer is not YES, do not implement it.