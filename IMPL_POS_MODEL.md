# IMPL_POS_MODEL: POS Data Model & Acceptance Requirements

**Goal:** Implement mandatory multi-order support per Service Center.

## 1. Schema Definition

Mapping "Instructions" to Firestore V2 Architecture:

| Requirement | Firestore Collection | Notes |
| :--- | :--- | :--- |
| **Order** | `folios` | `folioType: 'BAR'`, `status: 'OPEN'`, `serviceCenter: 'bar_main'` |
| **OrderItems** | `folio_line_items` | Linked via `folioId`. `itemType: 'DRINK'|'FOOD'` |
| **Payments** | `folio_payments` **(NEW)** | Append-only payment records linked to `folioId`. |

## 2. Implementation Tasks

### Backend (Services)

- [ ] **Extend `folioService.js`**:
  - [ ] `createOpenBarFolio(serviceCenter, staffId)` - Returns new open folio.
  - [ ] `addPaymentToFolio(folioId, amount, method)` - Records payment, updates folio `amountPaid` and status (`PART_PAID`, `PAID`).
  - [ ] `getOpenFolios(serviceCenter)` - List active orders.

### Verification (Script)

- [ ] **Create `scripts/verify_pos_requirements.js`**:
  - [ ] Simulates: Opening 2 orders, adding items, partial pay.
  - [ ] Outputs: JSON dumps of the created records.

## 3. Execution Plan

1. **Modify `firestore.rules`**: Allow access to `folio_payments`.
2. **Update `folioService.js`**: Implement the new methods.
3. **Run Verification Script**: Generate the proof.
4. **Report**: Show the user the records.

## 4. Acceptance Criteria Checklist

- [ ] Multiple concurrent orders per service center.
- [ ] Orders, items, payments stored correctly.
- [ ] No mixing of totals.
- [ ] Real database records provided.
