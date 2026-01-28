# STEP 6: V2 UI Implementation Plan

**Status:** PLANNING
**Date:** 2026-01-26

---

## 🎯 OBJECTIVE

Build the staff-facing UI for the new V2 Folio/Invoice system to enable visibility and management of the financial data currently being generated in the background.

## 📦 DELIVERABLES

### 1. New Components (`src/components/v2/`)

* **`FolioList.jsx`**: Dashboard showing all open folios (Rooms & Bar Tabs).
  * Filter by Status: OPEN, COMPLETED, VOIDED
  * Filter by Type: BAR, ROOM
* **`FolioDetail.jsx`**: View line items for a specificfolio.
* **`InvoiceList.jsx`**: List of finalized invoices (`INV-2026-XXXX`).
* **`InvoiceView.jsx`**: Printable view of a specific V2 invoice.
* **`AuditLogView.jsx`**: Admin-only view of `audit_logs` collection.
* **`FinanceDashboard.jsx`**: A wrapper component to manage the above views (Tabs/Navigation).

### 2. Integration (`src/App.js`)

* Add `v2_finance` view state.
* Add "Finance (V2)" button to Admin Dashboard.
* Ensure Role-Based Access Control (Admin/Manager only for now).

---

## 📋 PRE-REQUISITES

* V2 Data must exist (Step 5 completed).
* `folioService.js` must be importable.
* `lucide-react` icons are available.

## 🏗️ COMPONENT DETAILS

### A. FinanceDashboard (The Container)

* **Route**: `view === 'v2_finance'`
* **Layout**: Sidebar/Tabs for:
    1. Active Folios
    2. Invoices
    3. Audit Logs
* **Props**: `userRole`, `staffName`

### B. FolioList (Active Folios)

* **Source**: `collection('folios')` where `status == 'OPEN'`
* **Columns**: Folio ID, Type, Reference (Room/Staff), Total, Created At.
* **Actions**: "View Details", "Void" (Admin only).

### C. InvoiceList (History)

* **Source**: `collection('invoices')` ordered by `invoiceNo` desc.
* **Columns**: Invoice #, Date, Amount, Payment Method, Staff.
* **Actions**: "Print", "Email" (future).

### D. AuditLogView (Security)

* **Source**: `collection('audit_logs')` ordered by `timestamp` desc.
* **Rows**: Color-coded by action type (CREATE, MODIFY, VOID, CLOSE).
* **Security**: `if (userRole !== 'admin') return <AccessDenied />`

---

## 🔄 EXECUTION STEPS

1. **Create Components**:
    * Create `src/components/v2/FinanceDashboard.jsx` (Shell)
    * Create `src/components/v2/FolioList.jsx`
    * Create `src/components/v2/InvoiceList.jsx`
    * Create `src/components/v2/AuditLogView.jsx`
2. **Modify App.js**:
    * Import `FinanceDashboard`.
    * Add `view === 'v2_finance'` case.
    * Add navigation button in `AdminDashboard`.
3. **Verification**:
    * Login as Admin.
    * Navigate to Finance.
    * Verify data from Step 5 appears.
    * Print a V2 invoice.

---

## 📚 REFERENCE

* `STEP4_FOLIO_SCHEMA.md` - Data structure reference.
* `src/services/folioService.js` - Data access layer.
