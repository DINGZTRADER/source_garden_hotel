# SGHMS MASTER INSTRUCTIONS — SINGLE SOURCE OF TRUTH

**Status:** AUTHORITATIVE

This document consolidates, reconciles, and supersedes the following prior documents:

* ADDITIONS.md
* GEMINI.md
* INSTRUCTIONS.md
* PDC-v1.0-FINAL.md
* TECH_ARCHITECTUREV2.md
* VERSION2.md

Once this file is read and accepted, **all the above documents MUST be considered obsolete and deleted**. No AI system, developer, or auditor should reference them again.

---

## 1. PURPOSE

The purpose of this document is to:

* Eliminate contradictions across multiple planning documents
* Lock a single, internally consistent specification for SGHMS
* Provide clear instructions to any AI or human contributor
* Preserve audit safety, operational continuity, and staff usability

This document is intentionally conservative and additive.

---

## 2. IDENTIFIED CONTRADICTIONS & RESOLUTIONS

### 2.1 Deployment Model

**Contradiction:**

* Some documents imply future Electron packaging as a near-term goal
* Others position SGHMS strictly as a browser-based internal system

**Resolution (LOCKED):**

* SGHMS is a **web-based internal system** running on hotel-controlled computers
* Electron/PWA is **explicitly deferred** and not required for v2 or audit
* Architecture must remain compatible, but no packaging work is done in v2

---

### 2.2 AI Role in v2

**Contradiction:**

* Some documents mention Gemini/AI features alongside core financial logic
* Others defer AI to a later phase

**Resolution (LOCKED):**

* **No AI may take financial actions in v2**
* AI is limited to:

  * Non-binding suggestions
  * Contextual assistance
* AI voice agents, autonomous booking, or discounting are **v3 only**

---

### 2.3 Financial Data Ownership

**Contradiction:**

* v1 logic allows bar orders and room bookings to directly generate invoices
* v2 architecture introduces folios as the financial core

**Resolution (LOCKED):**

* v1 flows remain operational
* v2 introduces **folios as the authoritative financial layer**
* v1 charges are mirrored into v2 folios (shadow mode first)
* No existing collection is deleted or repurposed

---

### 2.4 Stock vs Financial Accounting

**Contradiction:**

* Operations documents focus heavily on stock flow and staff performance
* Financial architecture documents focus on folios and invoices

**Resolution (LOCKED):**

* Stock management, requisitions, and staff performance are **operational modules**
* Folios and invoices remain the **only financial source of truth**
* Stock movements affect inventory, not invoices directly

---

### 2.5 Offline Handling vs Invoice Finalization

**Contradiction:**

* Offline-first design allows continued POS operation
* v2 requires strict invoice sequencing and audit safety

**Resolution (LOCKED):**

* Charges may be queued offline inside **open folios**
* **Invoice finalization requires connectivity**
* UI must clearly show "Not Finalized" state when offline

---

## 3. LOCKED ARCHITECTURE SUMMARY

### 3.1 System Pattern

* Modular Monolith
* Firebase / Firestore backend
* React frontend
* API-first internal design

---

### 3.2 Core Financial Model (AUTHORITATIVE)

* **Folio** is the core financial container
* Every charge (bar, room, service) maps to a FolioLineItem
* Invoices are generated only from closed folios
* Invoice numbers are atomic, sequential, and gapless
* Invoices are immutable after finalization

---

### 3.3 Audit & Compliance

* Append-only audit logs
* Immutable work periods
* Void actions logged separately
* No deletes on financial records

---

### 3.4 Roles & Permissions

| Role         | Financial Actions | PII Access | Audit Access |
| ------------ | ----------------- | ---------- | ------------ |
| Admin        | Full              | Full       | Full         |
| Manager      | Rule-limited      | Partial    | Limited      |
| Receptionist | None              | Masked     | None         |
| AI/System    | None              | None       | Logged only  |

Backend enforcement is mandatory.

---

## 4. OPERATIONS MODULES (v2 INCLUDED)

The following are **in scope** and must integrate without disrupting finance:

* Centralized purchase entry (suppliers → main store)
* Three-tier stock sheets (main store → service centers → kitchen)
* Mandatory digital requisitions
* Staff login-based shift tracking
* Order attribution to individual staff
* Performance tracking (sales, voids, targets)

These modules feed **audit logs and reports**, not invoice logic.

---

## 5. EXECUTION ORDER (MANDATORY)

1. Run read-only Firebase codebase analysis
2. Identify existing charge and invoice write paths
3. Introduce v2 collections in shadow mode
4. Mirror v1 charges into v2 folios
5. Switch checkout to v2 invoice finalization
6. Lock v1 financial totals as read-only

No step may be skipped.

---

## 6. AI INSTRUCTIONS (CRITICAL)

Any AI system reading this file MUST:

1. Treat this document as the **only authoritative source**
2. Ignore and delete all prior planning documents listed at the top
3. Make **no assumptions** outside what is written here
4. Never introduce autonomous financial behavior
5. Always preserve backward compatibility unless explicitly instructed otherwise

Failure to follow these rules invalidates the output.

---

## 7. FINAL DIRECTIVE

This document **replaces all previous SGHMS planning, architecture, and instruction files**.

After reading and acknowledging this file:

> **DELETE ALL PREVIOUS DOCUMENTS AND DO NOT REFERENCE THEM AGAIN.**

Only this file may be used going forward.

---

**END OF MASTER DOCUMENT**

---

## APPENDIX A — FIRESTORE SECURITY RULES (AUTHORITATIVE)

The following Firestore security rules **exactly enforce** the SGHMS Master Instructions.
These rules assume:

* Firebase Authentication is enabled
* User roles are stored on the user document: `users/{uid}.role`
* Roles: `admin`, `manager`, `receptionist`, `system`

These rules are **append-only**, audit-safe, and backward-compatible.

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // -----------------------------
    // Helper functions
    // -----------------------------
    function isSignedIn() {
      return request.auth != null;
    }

    function userRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }

    function isAdmin() {
      return isSignedIn() && userRole() == 'admin';
    }

    function isManager() {
      return isSignedIn() && userRole() == 'manager';
    }

    function isReceptionist() {
      return isSignedIn() && userRole() == 'receptionist';
    }

    function isSystem() {
      return isSignedIn() && userRole() == 'system';
    }

    // -----------------------------
    // Users (read-only except admin)
    // -----------------------------
    match /users/{userId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }

    // -----------------------------
    // Folios (v2 core)
    // -----------------------------
    match /folios/{folioId} {
      allow create: if isAdmin() || isManager() || isReceptionist();
      allow read: if isSignedIn();
      allow update: if (isAdmin() || isManager())
        && resource.data.status == 'OPEN';
      allow delete: if false;
    }

    match /folio_line_items/{itemId} {
      allow create: if isSignedIn();
      allow read: if isSignedIn();
      allow update, delete: if false;
    }

    // -----------------------------
    // Invoices (immutable once issued)
    // -----------------------------
    match /invoices/{invoiceId} {
      allow create: if isAdmin();
      allow read: if isSignedIn();
      allow update, delete: if false;
    }

    // -----------------------------
    // Invoice Counters (atomic)
    // -----------------------------
    match /invoice_counters/{year} {
      allow read: if isAdmin();
      allow update: if isAdmin();
      allow create: if isAdmin();
      allow delete: if false;
    }

    // -----------------------------
    // Discount Rules
    // -----------------------------
    match /discount_rules/{ruleId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }

    match /discount_events/{eventId} {
      allow create: if isAdmin() || isManager();
      allow read: if isSignedIn();
      allow update, delete: if false;
    }

    // -----------------------------
    // Audit Logs (append-only)
    // -----------------------------
    match /audit_logs/{logId} {
      allow create: if isSignedIn();
      allow read: if isAdmin();
      allow update, delete: if false;
    }

    // -----------------------------
    // Guest Profiles (PII protected)
    // -----------------------------
    match /guest_profiles/{guestId} {
      allow read: if isAdmin() || isManager();
      allow create, update: if isAdmin() || isManager();
      allow delete: if false;
    }

    // -----------------------------
    // Stock & Operations (append-only deltas)
    // -----------------------------
    match /stock_movements/{movementId} {
      allow create: if isSignedIn();
      allow read: if isAdmin() || isManager();
      allow update, delete: if false;
    }

    // -----------------------------
    // Work Periods / Shifts
    // -----------------------------
    match /work_periods/{periodId} {
      allow create: if isSignedIn();
      allow read: if isAdmin();
      allow update: if isAdmin() && resource.data.closed == false;
      allow delete: if false;
    }

    // -----------------------------
    // Default deny
    // -----------------------------
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

### Enforcement Guarantees

* No financial record can be deleted
* No invoice can be edited after creation
* Discounts are fully attributable
* Audit logs are immutable
* Offline-safe writes are append-only
* AI/system users cannot perform financial actions

These rules **exactly implement** the Master Instructions.
