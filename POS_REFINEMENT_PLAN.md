# POS Refinement Implementation Plan

## Based on MASTERPROMPTPOS.md

### Changes to Implement

## 1. Remove Work Period Gating ❌

**Current Behavior:** POS is locked when work period is closed  
**New Behavior:** POS always available when staff is logged in

**Files to Modify:**

- `src/App.js` - Remove `workPeriodOpen` checks in:
  - `addToCart` function (~line 1625)
  - `handlePaymentComplete` function (~line 1676)
  - POS render blocker (~line 1806-1818)

**What to Keep:**

- Timestamps on all transactions
- Work period ID in transaction data (for reporting)
- Admin shift control panel (for reporting purposes only)

---

## 2. Add Staff Selector Component ✅

**Current Behavior:** Staff name passed from parent as prop  
**New Behavior:** Service staff selects themselves on POS load

**New Component:** `StaffSelector.jsx`

- Dropdown with placeholder names
- Persist selection in localStorage
- Show current staff in POS header

**Placeholder Options:**

- Service Staff A
- Service Staff B  
- Service Staff C
- Riverside Staff A
- Riverside Staff B
- Pool Attendant
- Health Club Attendant

**Data to Track:**

```javascript
{
  service_staff_id: "staff_a",
  service_staff_name: "Service Staff A",
  service_center: "bar_main"
}
```

---

## 3. Update Transaction Attribution

**Ensure all sales record:**

- `service_staff_id`
- `service_staff_name`
- `service_center`
- `timestamp`

---

## Implementation Steps

1. Create `StaffSelector` component
2. Remove work period blocking from POS
3. Update POS to use selected staff
4. Test offline functionality remains intact
5. Verify dual-write still works

---

## What NOT to Change

- Dual-write (V1 + V2) logic
- Offline queuing system
- LocalStorage persistence
- Invoice numbering
- Audit logging
- Single active bill design (already correct)
