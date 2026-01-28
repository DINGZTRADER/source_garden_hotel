# V2 Financial Engine Walkthrough

**Date:** 2026-01-26
**Status:** LIVE (Dual-Write Mode)

---

## 🚀 Overview

The **Source Garden V2 Financial Engine** is now live. It runs in the background ("Shadow Mode") alongside your existing system, capturing every transaction into a new, audit-secure database structure.

This ensures:

1. **Zero Data Loss:** Every sale is recorded in two places.
2. **Audit Safety:** Operations are logged in an immutable ledger.
3. **Strict Invoicing:** Every payment generates a `INV-2026-XXXX` invoice.

---

## 🆕 New Features

### 1. Finance & Audit Dashboard

**Location:** Admin Dashboard > Administrative Tools > **Finance & Audit** (Blue Card)

This is your new control center. It allows you to see the data that was previously hidden or unstructured.

#### A. Active Folios Tab

* **What it shows:** Every "Open" financial bucket.
* **Room Folios:** Guests currently checked in.
* **Bar Tabs:** Orders being built at the POS.
* **Status Indicators:** `OPEN` (Active), `CLOSED` (Paid), `VOIDED` (Cancelled).

#### B. Invoices Tab

* **What it shows:** A strict, sequential list of all finalized payments.
* **Invoice #:** e.g., `INV-2027-0045`.
* **Actions:** You can reprint any past invoice from here.

#### C. Audit Log Tab

* **Access:** Admin Only.
* **What it shows:** A forensic trail of every action.
* **Details:** Who did it, When, What computer (IP), and What changed.
* **Security:** These logs cannot be deleted or edited.

---

## 🔄 How It Works (Automatic)

You do **not** need to change how you work. The system handles everything automatically.

| Staff Action | Old System (V1) | **New V2 System (Automatic)** |
| :--- | :--- | :--- |
| **Check In Guest** | Sets Room to 'Occupied' | Creates an **OPEN Folio** for the room |
| **Bar Order** | Creates a Sale Record | Creates a **CLOSED Folio** + **Invoice** |
| **Room Charge** | Updates Guest Array | Adds **Line Item** to Room Folio |
| **Check Out** | Clears Room Status | **Closes Folio** + Generates **Invoice** |

---

## 🧪 Verification

You verified the system using the `window.testV2Folio()` automated suite.

* All tests passed.
* Data parity confirmed.

## ⚠️ Important Notes

* **Do not delete** the "Old" data yet. The Daily Report still relies on it.
* **V2 Data is Authoritative** for audit purposes. If there is a discrepancy, trust the V2 Invoice.

---

**Next Steps:**
Use the system normally. The V2 data will accumulate silently, building a clean financial history for your future migration.
