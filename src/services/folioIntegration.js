/**
 * SGHMS V2 Folio Integration Helper
 * 
 * This module provides simple wrapper functions to add v2 folio writes
 * alongside existing v1 writes. Each function is designed to be called
 * AFTER the corresponding v1 write completes.
 * 
 * USAGE:
 * 
 * 1. Import this module at the top of App.js:
 *    import { v2WriteBarOrder, v2WriteRoomCheckIn, ... } from './services/folioIntegration';
 * 
 * 2. Call the appropriate function after each v1 write:
 *    // After v1 sales write
 *    await v2WriteBarOrder(db, appId, txPayload, staffId, staffName);
 * 
 * @version 1.0
 * @date 2026-01-26
 */

import {
    createBarFolio,
    createRoomFolio,
    addLineItemToFolio,
    getActiveFolioForRoom,
    closeFolioAndCreateInvoice,
    linkSalesToFolio,
} from './folioService';

// =============================================================================
// BAR/POS ORDER INTEGRATION
// =============================================================================

/**
 * Add v2 folio write after bar/POS order
 * Call this AFTER the v1 write to 'sales/{txId}' completes
 * 
 * @param {object} db - Firestore instance
 * @param {string} appId - Application ID
 * @param {object} txPayload - Transaction payload from v1 (must include id, items, total, etc.)
 * @param {string} staffId - Staff user ID
 * @param {string} staffName - Staff display name
 * @param {string} serviceCenter - Service center ID (e.g., 'bar_main')
 * @param {string|null} roomId - Room ID if charged to room, null for cash/card sales
 * @param {string|null} existingFolioId - Optional ID of an open folio to add items to
 * @returns {Promise<object|null>} - Returns folio result or null on error
 */
export async function v2WriteBarOrder(db, appId, txPayload, staffId, staffName, serviceCenter, roomId = null, existingFolioId = null) {
    try {
        console.log('[v2] Processing BAR order. Folio Mode:', existingFolioId ? 'APPEND' : 'CREATE');

        if (existingFolioId) {
            // APPEND MODE: Add items to existing open folio
            const items = txPayload.items || [];

            for (const item of items) {
                await addLineItemToFolio(db, appId, {
                    folioId: existingFolioId,
                    description: item.name,
                    itemType: item.type === 'kitchen' ? 'FOOD' : 'DRINK',
                    quantity: item.qty,
                    unitPrice: item.price,
                    category: item.category || 'POS',
                    staffId,
                    staffName,
                    v1SalesId: txPayload.id,
                    v1MenuItemId: item.id,
                    sourceModule: 'POS'
                });
            }

            // Link the V1 Sales record to this Folio
            await linkSalesToFolio(db, appId, txPayload.id, existingFolioId);

            return { folioId: existingFolioId, status: 'UPDATED' };
        }

        // CREATE MODE: Create new closed folio (legacy behavior)
        const result = await createBarFolio(db, appId, {
            v1SalesId: txPayload.id,
            items: txPayload.items || [],
            subtotal: txPayload.subtotal || txPayload.total,
            total: txPayload.total,
            paymentMethod: txPayload.paymentMethod || txPayload.method || 'CASH',
            roomId: roomId,
            serviceCenter: serviceCenter,
            staffId: staffId,
            staffName: staffName,
            customerName: roomId ? `Room ${roomId}` : 'Walk-in Customer',
        });

        if (result) {
            console.log('[v2] Created BAR folio:', result.folioId, 'Invoice:', result.invoiceNumber);
        }

        return result;

    } catch (error) {
        console.error('[v2] Error creating BAR folio:', error);
        // V2 errors should never break v1 flow
        return null;
    }
}

/**
 * Add v2 line item when POS order is charged to a room
 * Call this AFTER the v1 arrayUnion to rooms/{roomId}/guest.charges completes
 * 
 * @param {object} db - Firestore instance
 * @param {string} appId - Application ID
 * @param {string} roomId - Room ID
 * @param {object} txPayload - Transaction payload
 * @param {string} staffId - Staff user ID
 * @param {string} staffName - Staff display name
 * @returns {Promise<object|null>} - Returns line item result or null
 */
export async function v2WriteRoomCharge(db, appId, roomId, txPayload, staffId, staffName) {
    try {
        // Find active folio for this room
        const activeFolio = await getActiveFolioForRoom(db, appId, roomId);

        if (!activeFolio) {
            console.warn('[v2] No active folio found for room:', roomId);
            return null;
        }

        console.log('[v2] Adding line item to folio:', activeFolio.folioId);

        // Create summary description from items
        const itemNames = (txPayload.items || [])
            .map(i => `${i.name}${i.qty > 1 ? ` x${i.qty}` : ''}`)
            .join(', ');

        const result = await addLineItemToFolio(db, appId, {
            folioId: activeFolio.folioId,
            description: `POS: ${itemNames || 'Order'}`,
            itemType: 'BAR_ORDER',
            quantity: 1,
            unitPrice: txPayload.total,
            category: 'POS',
            staffId: staffId,
            staffName: staffName,
            v1SalesId: txPayload.id,
            sourceModule: 'POS',
        });

        if (result) {
            console.log('[v2] Added line item:', result.itemId, 'to folio:', activeFolio.folioId);
        }

        return result;

    } catch (error) {
        console.error('[v2] Error adding room charge:', error);
        return null;
    }
}

// =============================================================================
// ROOM CHECK-IN INTEGRATION
// =============================================================================

/**
 * Add v2 folio write after room check-in
 * Call this AFTER the v1 updateDoc to rooms/{roomId} completes
 * 
 * @param {object} db - Firestore instance
 * @param {string} appId - Application ID
 * @param {object} room - Room object (must include id, number, type, price)
 * @param {object} guestData - Guest data (must include name, contact, nightsBooked, adults, children)
 * @param {string} staffId - Staff user ID
 * @param {string} staffName - Staff display name
 * @returns {Promise<object|null>} - Returns folio result or null
 */
export async function v2WriteRoomCheckIn(db, appId, room, guestData, staffId, staffName) {
    try {
        console.log('[v2] Creating ROOM folio for check-in:', room.number);

        const result = await createRoomFolio(db, appId, {
            roomId: room.id,
            roomNumber: room.number,
            roomType: room.type,
            roomPrice: room.price,
            guestName: guestData.name,
            guestContact: guestData.contact || null,
            nightsBooked: guestData.nightsBooked || 1,
            adults: guestData.adults || 1,
            children: guestData.children || 0,
            staffId: staffId,
            staffName: staffName,
        });

        if (result) {
            console.log('[v2] Created ROOM folio:', result.folioId);

            // Store folio ID reference for later room charges
            // This can be used to link room charges to the correct folio
            try {
                localStorage.setItem(`v2_active_folio_${room.id}`, result.folioId);
            } catch (e) {
                // Ignore localStorage errors
            }
        }

        return result;

    } catch (error) {
        console.error('[v2] Error creating ROOM folio:', error);
        return null;
    }
}

// =============================================================================
// LAUNDRY CHARGE INTEGRATION
// =============================================================================

/**
 * Add v2 line item for laundry charges
 * Call this AFTER the v1 laundry charge write completes
 * 
 * @param {object} db - Firestore instance
 * @param {string} appId - Application ID
 * @param {string} roomId - Room ID
 * @param {string} description - Laundry description
 * @param {number} amount - Charge amount
 * @param {string} staffId - Staff user ID
 * @param {string} staffName - Staff display name
 * @returns {Promise<object|null>} - Returns line item result or null
 */
export async function v2WriteLaundryCharge(db, appId, roomId, description, amount, staffId, staffName) {
    try {
        const activeFolio = await getActiveFolioForRoom(db, appId, roomId);

        if (!activeFolio) {
            console.warn('[v2] No active folio found for room:', roomId);
            return null;
        }

        console.log('[v2] Adding laundry charge to folio:', activeFolio.folioId);

        const result = await addLineItemToFolio(db, appId, {
            folioId: activeFolio.folioId,
            description: `Laundry: ${description}`,
            itemType: 'LAUNDRY',
            quantity: 1,
            unitPrice: amount,
            category: 'Laundry',
            staffId: staffId,
            staffName: staffName,
            sourceModule: 'RECEPTION',
        });

        if (result) {
            console.log('[v2] Added laundry charge:', result.itemId);
        }

        return result;

    } catch (error) {
        console.error('[v2] Error adding laundry charge:', error);
        return null;
    }
}

// =============================================================================
// ROOM CHECKOUT INTEGRATION
// =============================================================================

/**
 * Add v2 folio close and invoice creation after room checkout
 * Call this AFTER the v1 checkout write completes
 * 
 * @param {object} db - Firestore instance
 * @param {string} appId - Application ID
 * @param {string} roomId - Room ID
 * @param {object} checkoutData - Checkout data (must include paymentMethod, amountPaid)
 * @param {string} v1CheckoutId - The v1 checkout document ID
 * @param {string} staffId - Staff user ID
 * @param {string} staffName - Staff display name
 * @returns {Promise<object|null>} - Returns invoice result or null
 */
export async function v2WriteRoomCheckout(db, appId, roomId, checkoutData, v1CheckoutId, staffId, staffName) {
    try {
        const activeFolio = await getActiveFolioForRoom(db, appId, roomId);

        if (!activeFolio) {
            console.warn('[v2] No active folio found for room:', roomId);
            return null;
        }

        console.log('[v2] Closing ROOM folio and creating invoice:', activeFolio.folioId);

        const result = await closeFolioAndCreateInvoice(db, appId, {
            folioId: activeFolio.folioId,
            paymentMethod: checkoutData.paymentMethod || 'CASH',
            amountPaid: checkoutData.amountPaid || checkoutData.total || activeFolio.grandTotal,
            staffId: staffId,
            staffName: staffName,
            v1CheckoutId: v1CheckoutId,
        });

        if (result) {
            console.log('[v2] Created invoice:', result.invoiceNumber, 'for folio:', activeFolio.folioId);

            // Clear the local storage reference
            try {
                localStorage.removeItem(`v2_active_folio_${roomId}`);
            } catch (e) {
                // Ignore localStorage errors
            }
        }

        return result;

    } catch (error) {
        console.error('[v2] Error closing folio:', error);
        return null;
    }
}

// =============================================================================
// OFFLINE QUEUE SYNC INTEGRATION
// =============================================================================

/**
 * Create v2 folio for queued offline transaction during sync
 * Call this when processing the offline TX queue
 * 
 * @param {object} db - Firestore instance
 * @param {string} appId - Application ID
 * @param {object} tx - Transaction from offline queue
 * @returns {Promise<object|null>} - Returns folio result or null
 */
export async function v2SyncOfflineTransaction(db, appId, tx) {
    try {
        console.log('[v2] Creating folio for synced offline transaction:', tx.id);

        const result = await createBarFolio(db, appId, {
            v1SalesId: tx.id,
            items: tx.items || [],
            subtotal: tx.subtotal || tx.total,
            total: tx.total,
            paymentMethod: tx.paymentMethod || tx.method || 'CASH',
            roomId: tx.roomId || null,
            serviceCenter: tx.serviceCenter || 'general',
            staffId: tx.staffId || 'unknown',
            staffName: tx.staffName || 'Unknown Staff',
            customerName: tx.roomId ? `Room ${tx.roomId}` : 'Walk-in Customer',
        });

        return result;

    } catch (error) {
        console.error('[v2] Error syncing offline transaction:', error);
        return null;
    }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if v2 folio system is enabled
 * Can be used to conditionally enable/disable v2 writes
 */
export function isV2FolioEnabled() {
    // This can be controlled via localStorage or environment variable
    const disabled = localStorage.getItem('v2_folio_disabled');
    return disabled !== 'true';
}

/**
 * Enable/disable v2 folio system
 */
export function setV2FolioEnabled(enabled) {
    if (enabled) {
        localStorage.removeItem('v2_folio_disabled');
    } else {
        localStorage.setItem('v2_folio_disabled', 'true');
    }
}

/**
 * Get active folio ID for a room from local cache
 */
export function getLocalFolioId(roomId) {
    try {
        return localStorage.getItem(`v2_active_folio_${roomId}`);
    } catch (e) {
        return null;
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
    v2WriteBarOrder,
    v2WriteRoomCharge,
    v2WriteRoomCheckIn,
    v2WriteLaundryCharge,
    v2WriteRoomCheckout,
    v2SyncOfflineTransaction,
    isV2FolioEnabled,
    setV2FolioEnabled,
    getLocalFolioId,
};
