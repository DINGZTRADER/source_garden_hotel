# IMPLEMENTATION PLAN: Multi-Table POS Support

**Status:** PLANNING
**Date:** 2026-01-26

## 🎯 Goal

Enable a single POS terminal to manage multiple concurrent orders (e.g., multiple tables) simultaneously, allowing staff to "park" one order and work on another.

## 🚧 Current Limitation

* The system uses a single `cart` per department stored in `localStorage`.
* If a waiter is entering an order for Table 1 and needs to serve Table 2 strategies, they must either finish Table 1 or clear it (losing data).

## 🛠️ Proposed Solution

### 1. Data Structure Change

Upgrade the local storage schema from a single `cart` array to a `tables` dictionary.

**Old Keys:**

* `sourcegarden_pos_cart_{deptId}`: `[Item, Item...]`

**New Keys:**

* `sourcegarden_active_orders_{deptId}`:

    ```javascript
    {
      "Table 1": { items: [...], startTime: "...", status: "active" },
      "Table 4": { items: [...], startTime: "...", status: "active" },
      "Bar Seat 2": { items: [...], startTime: "...", status: "active" }
    }
    ```

### 2. UI Changes in `POSSystem`

#### A. Table Selector (New State)

* When the POS loads, instead of showing the cart immediately, show a **"Active Orders"** dashboard.
* **Grid View**: "New Order" button + Cards for existing open tables.

#### B. Top Bar Navigation

* Show current context: e.g., "River Bar > **Table 5**".
* "Switch Table" button to return to the active orders grid.

#### C. Cart Actions

* **"Save/Park"**: Save current items to the table slot and return to grid.
* **"Pay/Complete"**: Completing the order clears that specific table slot.

### 3. Component Architecture

* **New Hook**: `useOrderManager(departmentId)`
  * Replaces `usePersistentCart`.
  * Methods: `openOrder(tableName)`, `saveOrder(tableName, items)`, `closeOrder(tableName)`, `getActiveOrders()`.
* **Component**: `ActiveOrdersGrid`
  * Visual representation of open tabs.
* **Modifications to `POSSystem`**:
  * Wrap the existing POS view in a conditional: `if (selectedTable) return <POSView ... /> else return <ActiveOrdersGrid ... />`

## ⚠️ Edge Cases

* **Two tables with same name**: Prevent duplicate table names (warn user).
* **Stale Data**: Allow "Force Close" of old orphaned tables.

## 🧪 Verification

1. Open "Table 1", add a beer.
2. Switch to "Table 2", add a soda.
3. Switch back to "Table 1", confirm beer is still there.
4. Pay for "Table 1", confirm it disappears from list.
