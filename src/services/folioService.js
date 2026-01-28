/**
 * SGHMS V2 Folio Service
 * 
 * Dual-write service that creates v2 folio records alongside v1 writes.
 * This module is ADDITIVE - it does not modify any v1 behavior.
 * 
 * @version 1.0
 * @date 2026-01-26
 * @reference STEP4_FOLIO_SCHEMA.md, MASTERVERSION2.md
 */

import {
    doc,
    setDoc,
    updateDoc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    runTransaction,
    increment,
    serverTimestamp
} from 'firebase/firestore';

// =============================================================================
// CONSTANTS
// =============================================================================

const COLLECTIONS = {
    FOLIOS: 'folios',
    FOLIO_LINE_ITEMS: 'folio_line_items',
    INVOICES: 'invoices',
    INVOICE_COUNTERS: 'invoice_counters',
    AUDIT_LOGS: 'audit_logs',
    PAYMENTS: 'folio_payments',
};

const ID_PREFIXES = {
    FOLIO_BAR: 'FOLIO-BAR-',
    FOLIO_ROOM: 'FOLIO-ROOM-',
    LINE_ITEM: 'FLI-',
    INVOICE: 'INV-',
    AUDIT: 'LOG-',
    PAYMENT: 'PAY-',
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get the base path for all v2 collections
 * Matches v1 path structure: artifacts/{appId}/public/data/
 */
function getBasePath(appId) {
    return `artifacts/${appId}/public/data`;
}

/**
 * Generate a unique ID with prefix
 */
function generateId(prefix) {
    return `${prefix}${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Get current year for invoice numbering
 */
function getCurrentYear() {
    return new Date().getFullYear();
}

/**
 * Get ISO timestamp
 */
function getTimestamp() {
    return new Date().toISOString();
}

/**
 * Format folio number: F-YYYY-NNNNN
 */
function formatFolioNumber(year, sequence) {
    return `F-${year}-${String(sequence).padStart(5, '0')}`;
}

/**
 * Format invoice number: INV-YYYY-NNNNN
 */
function formatInvoiceNumber(year, sequence) {
    return `INV-${year}-${String(sequence).padStart(5, '0')}`;
}

// =============================================================================
// FOLIO COUNTER SERVICE
// =============================================================================

/**
 * Get next folio number (non-atomic, used for display purposes)
 * Actual invoice numbers use atomic transaction
 */
async function getNextFolioNumber(db, appId) {
    const year = getCurrentYear();
    const basePath = getBasePath(appId);
    const counterRef = doc(db, basePath, 'folio_counters', String(year));

    try {
        const counterDoc = await getDoc(counterRef);
        if (counterDoc.exists()) {
            return formatFolioNumber(year, counterDoc.data().lastNumber + 1);
        }
        return formatFolioNumber(year, 1);
    } catch (error) {
        console.warn('[FolioService] Error getting folio number:', error);
        return formatFolioNumber(year, Date.now() % 100000);
    }
}

/**
 * Increment folio counter
 */
async function incrementFolioCounter(db, appId) {
    const year = getCurrentYear();
    const basePath = getBasePath(appId);
    const counterRef = doc(db, basePath, 'folio_counters', String(year));

    try {
        const counterDoc = await getDoc(counterRef);
        if (counterDoc.exists()) {
            const newNumber = counterDoc.data().lastNumber + 1;
            await updateDoc(counterRef, { lastNumber: newNumber });
            return newNumber;
        } else {
            await setDoc(counterRef, { year, lastNumber: 1, prefix: `F-${year}-` });
            return 1;
        }
    } catch (error) {
        console.error('[FolioService] Error incrementing folio counter:', error);
        return Date.now() % 100000;
    }
}

// =============================================================================
// AUDIT LOGGING
// =============================================================================

/**
 * Log an audit event
 */
async function logAuditEvent(db, appId, {
    action,
    entityType,
    entityId,
    userId,
    userName,
    userRole = 'staff',
    previousState = null,
    newState,
    isOfflineAction = false,
}) {
    try {
        const basePath = getBasePath(appId);
        const logId = generateId(ID_PREFIXES.AUDIT);

        await setDoc(doc(db, basePath, COLLECTIONS.AUDIT_LOGS, logId), {
            logId,
            timestamp: getTimestamp(),
            action,
            entityType,
            entityId,
            userId,
            userName,
            userRole,
            previousState,
            newState,
            ipAddress: null,
            deviceInfo: navigator?.userAgent || null,
            isOfflineAction,
        });

        console.log(`[Audit] ${action} on ${entityType}:${entityId} by ${userName}`);
    } catch (error) {
        // Audit logging should never break main flow
        console.error('[FolioService] Audit log failed:', error);
    }
}

// =============================================================================
// BAR FOLIO OPERATIONS
// =============================================================================

/**
 * Create a BAR folio from a POS transaction
 * Called after v1 write to sales/{txId}
 * 
 * BAR folios are created and closed immediately (single transaction)
 */
export async function createBarFolio(db, appId, {
    v1SalesId,
    items,
    subtotal,
    total,
    paymentMethod,
    roomId = null,
    serviceCenter,
    staffId,
    staffName,
    customerName = 'Walk-in Customer',
}) {
    const basePath = getBasePath(appId);
    const timestamp = getTimestamp();
    const year = getCurrentYear();

    try {
        // Generate IDs
        const folioId = `${ID_PREFIXES.FOLIO_BAR}${v1SalesId}`;
        const folioNumber = await incrementFolioCounter(db, appId);
        const formattedFolioNumber = formatFolioNumber(year, folioNumber);

        // Create folio document (status: CLOSED for bar orders)
        const folioData = {
            folioId,
            folioNumber: formattedFolioNumber,
            folioType: 'BAR',
            status: 'CLOSED', // Bar folios are immediately closed

            createdAt: timestamp,
            closedAt: timestamp,
            voidedAt: null,

            ownerId: null,
            ownerName: customerName,
            ownerContact: null,

            // Room fields (null for bar folios unless charged to room)
            roomId: roomId,
            roomNumber: null,
            checkInDate: null,
            checkOutDate: null,
            nightsBooked: null,
            adults: null,
            children: null,

            // Financial
            subtotal: subtotal,
            discountTotal: 0,
            taxTotal: 0,
            grandTotal: total,

            amountPaid: total,
            paymentStatus: 'PAID',

            // Staff
            createdBy: staffId,
            createdByName: staffName,
            closedBy: staffId,
            closedByName: staffName,

            // V1 linkage
            v1LinkedRecords: {
                salesIds: [v1SalesId],
                checkoutId: null,
                roomId: roomId,
            },

            // Invoice (will be set after invoice creation)
            invoiceId: null,
            invoiceNumber: null,

            serviceCenter: serviceCenter,
            notes: null,
        };

        // Write folio
        await setDoc(doc(db, basePath, COLLECTIONS.FOLIOS, folioId), folioData);
        console.log(`[FolioService] Created BAR folio: ${folioId}`);

        // Create line items
        const lineItemIds = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const itemId = `${ID_PREFIXES.LINE_ITEM}${Date.now()}-${i}`;

            const lineItemData = {
                itemId,
                folioId,
                createdAt: timestamp,

                description: item.name,
                itemType: item.type === 'kitchen' ? 'FOOD' : 'DRINK',

                quantity: item.qty,
                unitPrice: item.price,
                subtotal: item.qty * item.price,

                discountAmount: 0,
                discountReason: null,
                discountRuleId: null,

                taxAmount: 0,
                taxRate: 0,

                totalAmount: item.qty * item.price,

                staffId,
                staffName,

                category: item.category || 'POS',

                v1SalesId,
                v1MenuItemId: item.id || null,

                paymentMethod: null,
                paymentReference: null,

                sourceModule: 'POS',
                isOfflineCreated: false,
                syncedAt: timestamp,

                isLocked: true, // Locked because folio is closed
            };

            await setDoc(doc(db, basePath, COLLECTIONS.FOLIO_LINE_ITEMS, itemId), lineItemData);
            lineItemIds.push(itemId);
        }

        console.log(`[FolioService] Created ${lineItemIds.length} line items for folio ${folioId}`);

        // Create invoice via transaction (atomic invoice number)
        const invoiceResult = await createInvoiceForFolio(db, appId, folioId, folioData, items, staffId, staffName);

        // Update folio with invoice reference
        if (invoiceResult) {
            await updateDoc(doc(db, basePath, COLLECTIONS.FOLIOS, folioId), {
                invoiceId: invoiceResult.invoiceId,
                invoiceNumber: invoiceResult.invoiceNumber,
            });
        }

        // Audit log
        await logAuditEvent(db, appId, {
            action: 'FOLIO_CREATE',
            entityType: 'FOLIO',
            entityId: folioId,
            userId: staffId,
            userName: staffName,
            newState: { folioId, folioType: 'BAR', status: 'CLOSED', total },
        });

        return {
            folioId,
            folioNumber: formattedFolioNumber,
            invoiceId: invoiceResult?.invoiceId,
            invoiceNumber: invoiceResult?.invoiceNumber,
            lineItemIds,
        };

    } catch (error) {
        console.error('[FolioService] Error creating BAR folio:', error);
        // Don't throw - v2 errors should not break v1 flow
        return null;
    }
}

// =============================================================================
// ROOM FOLIO OPERATIONS
// =============================================================================

/**
 * Create a ROOM folio at check-in
 * Called after v1 write to rooms/{roomId}
 * 
 * ROOM folios start as OPEN and are closed at checkout
 */
export async function createRoomFolio(db, appId, {
    roomId,
    roomNumber,
    roomType,
    roomPrice,
    guestName,
    guestContact = null,
    nightsBooked,
    adults,
    children,
    staffId,
    staffName,
}) {
    const basePath = getBasePath(appId);
    const timestamp = getTimestamp();
    const year = getCurrentYear();

    try {
        // Generate IDs
        const folioId = `${ID_PREFIXES.FOLIO_ROOM}${Date.now()}`;
        const folioNumber = await incrementFolioCounter(db, appId);
        const formattedFolioNumber = formatFolioNumber(year, folioNumber);

        // Calculate room charge
        const roomChargeTotal = nightsBooked * roomPrice;

        // Create folio document (status: OPEN for room folios)
        const folioData = {
            folioId,
            folioNumber: formattedFolioNumber,
            folioType: 'ROOM',
            status: 'OPEN', // Room folios start open

            createdAt: timestamp,
            closedAt: null,
            voidedAt: null,

            ownerId: null, // Could link to guest_profiles if implemented
            ownerName: guestName,
            ownerContact: guestContact,

            // Room fields
            roomId,
            roomNumber,
            checkInDate: timestamp,
            checkOutDate: null,
            nightsBooked,
            adults,
            children,

            // Financial
            subtotal: roomChargeTotal,
            discountTotal: 0,
            taxTotal: 0,
            grandTotal: roomChargeTotal,

            amountPaid: 0,
            paymentStatus: 'UNPAID',

            // Staff
            createdBy: staffId,
            createdByName: staffName,
            closedBy: null,
            closedByName: null,

            // V1 linkage
            v1LinkedRecords: {
                salesIds: [],
                checkoutId: null,
                roomId,
            },

            // Invoice (set at checkout)
            invoiceId: null,
            invoiceNumber: null,

            serviceCenter: null,
            notes: null,
        };

        // Write folio
        await setDoc(doc(db, basePath, COLLECTIONS.FOLIOS, folioId), folioData);
        console.log(`[FolioService] Created ROOM folio: ${folioId}`);

        // Create room charge line item
        const roomChargeItemId = `${ID_PREFIXES.LINE_ITEM}${Date.now()}-room`;
        const roomChargeData = {
            itemId: roomChargeItemId,
            folioId,
            createdAt: timestamp,

            description: `Room Charge - ${roomNumber} (${roomType})`,
            itemType: 'ROOM_CHARGE',

            quantity: nightsBooked,
            unitPrice: roomPrice,
            subtotal: roomChargeTotal,

            discountAmount: 0,
            discountReason: null,
            discountRuleId: null,

            taxAmount: 0,
            taxRate: 0,

            totalAmount: roomChargeTotal,

            staffId,
            staffName,

            category: 'Accommodation',

            v1SalesId: null,
            v1MenuItemId: null,

            paymentMethod: null,
            paymentReference: null,

            sourceModule: 'RECEPTION',
            isOfflineCreated: false,
            syncedAt: timestamp,

            isLocked: false, // Not locked - folio is still open
        };

        await setDoc(doc(db, basePath, COLLECTIONS.FOLIO_LINE_ITEMS, roomChargeItemId), roomChargeData);
        console.log(`[FolioService] Created room charge line item: ${roomChargeItemId}`);

        // Audit log
        await logAuditEvent(db, appId, {
            action: 'FOLIO_CREATE',
            entityType: 'FOLIO',
            entityId: folioId,
            userId: staffId,
            userName: staffName,
            newState: { folioId, folioType: 'ROOM', status: 'OPEN', roomNumber, guestName },
        });

        return {
            folioId,
            folioNumber: formattedFolioNumber,
            roomChargeItemId,
        };

    } catch (error) {
        console.error('[FolioService] Error creating ROOM folio:', error);
        return null;
    }
}

/**
 * Add a line item to an existing (open) folio
 * Called when charges are added during a guest's stay
 */
export async function addLineItemToFolio(db, appId, {
    folioId,
    description,
    itemType,
    quantity,
    unitPrice,
    category,
    staffId,
    staffName,
    v1SalesId = null,
    v1MenuItemId = null,
    sourceModule = 'POS',
    discountAmount = 0,
    discountReason = null,
}) {
    const basePath = getBasePath(appId);
    const timestamp = getTimestamp();

    try {
        // Verify folio exists and is OPEN
        const folioRef = doc(db, basePath, COLLECTIONS.FOLIOS, folioId);
        const folioDoc = await getDoc(folioRef);

        if (!folioDoc.exists()) {
            console.error(`[FolioService] Folio not found: ${folioId}`);
            return null;
        }

        const folioData = folioDoc.data();
        if (folioData.status !== 'OPEN' && folioData.status !== 'PART_PAID') {
            console.error(`[FolioService] Cannot add to ${folioData.status} folio: ${folioId}`);
            return null;
        }

        // Create line item
        const itemId = generateId(ID_PREFIXES.LINE_ITEM);
        const subtotal = quantity * unitPrice;
        const totalAmount = subtotal - discountAmount;

        const lineItemData = {
            itemId,
            folioId,
            createdAt: timestamp,

            description,
            itemType,

            quantity,
            unitPrice,
            subtotal,

            discountAmount,
            discountReason,
            discountRuleId: null,

            taxAmount: 0,
            taxRate: 0,

            totalAmount,

            staffId,
            staffName,

            category,

            v1SalesId,
            v1MenuItemId,

            paymentMethod: null,
            paymentReference: null,

            sourceModule,
            isOfflineCreated: false,
            syncedAt: timestamp,

            isLocked: false,
        };

        await setDoc(doc(db, basePath, COLLECTIONS.FOLIO_LINE_ITEMS, itemId), lineItemData);

        // Update folio totals
        await updateDoc(folioRef, {
            subtotal: increment(subtotal),
            discountTotal: increment(discountAmount),
            grandTotal: increment(totalAmount),
            'v1LinkedRecords.salesIds': v1SalesId
                ? [...(folioData.v1LinkedRecords?.salesIds || []), v1SalesId]
                : folioData.v1LinkedRecords?.salesIds || [],
        });

        console.log(`[FolioService] Added line item ${itemId} to folio ${folioId}`);

        // Audit log
        await logAuditEvent(db, appId, {
            action: 'LINE_ITEM_ADD',
            entityType: 'LINE_ITEM',
            entityId: itemId,
            userId: staffId,
            userName: staffName,
            newState: { itemId, folioId, description, totalAmount },
        });

        return { itemId, totalAmount };

    } catch (error) {
        console.error('[FolioService] Error adding line item:', error);
        return null;
    }
}

/**
 * Find active folio for a room
 */
export async function getActiveFolioForRoom(db, appId, roomId) {
    const basePath = getBasePath(appId);

    try {
        const foliosRef = collection(db, basePath, COLLECTIONS.FOLIOS);
        const q = query(
            foliosRef,
            where('roomId', '==', roomId),
            where('status', '==', 'OPEN'),
            where('folioType', '==', 'ROOM')
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return null;
        }

        // Return the first (should be only) open folio for this room
        const folioDoc = snapshot.docs[0];
        return { id: folioDoc.id, ...folioDoc.data() };

    } catch (error) {
        console.error('[FolioService] Error finding active folio:', error);
        return null;
    }
}

/**
 * Link a V1 Sales record to a V2 Folio
 */
export async function linkSalesToFolio(db, appId, salesId, folioId) {
    const basePath = getBasePath(appId);
    try {
        // We assume 'sales' is the collection name for V1 transactions
        const salesRef = doc(db, basePath, 'sales', salesId);
        await updateDoc(salesRef, {
            folioId: folioId,
            isLinkedToFolio: true,
            linkedAt: getTimestamp()
        });
        console.log(`[FolioService] Linked Sales ${salesId} to Folio ${folioId}`);
        return true;
    } catch (error) {
        console.error('[FolioService] Error linking sales to folio:', error);
        return false;
    }
}

/**
 * FEATURE: OPEN BAR ORDERS (Multi-order support)
 * Create a BAR folio that remains OPEN for adding items later
 */
export async function createOpenBarFolio(db, appId, {
    serviceCenter,
    staffId,
    staffName,
    tableOrLabel, // e.g., "Table 5" or "James"
}) {
    const basePath = getBasePath(appId);
    const timestamp = getTimestamp();
    const year = getCurrentYear();

    try {
        const folioId = `${ID_PREFIXES.FOLIO_BAR}${Date.now()}`;
        const folioNumber = await incrementFolioCounter(db, appId);
        const formattedFolioNumber = formatFolioNumber(year, folioNumber);

        const folioData = {
            folioId,
            folioNumber: formattedFolioNumber,
            folioType: 'BAR',
            status: 'OPEN', // Starts OPEN

            createdAt: timestamp,
            closedAt: null,
            voidedAt: null,

            ownerId: null,
            ownerName: tableOrLabel || `Order ${formattedFolioNumber}`,
            ownerContact: null,

            roomId: null,
            roomNumber: null,

            subtotal: 0,
            discountTotal: 0,
            taxTotal: 0,
            grandTotal: 0,

            amountPaid: 0,
            paymentStatus: 'UNPAID',

            createdBy: staffId,
            createdByName: staffName,
            closedBy: null,
            closedByName: null,

            v1LinkedRecords: { salesIds: [] },
            invoiceId: null,

            serviceCenter,
            notes: null,
        };

        await setDoc(doc(db, basePath, COLLECTIONS.FOLIOS, folioId), folioData);

        await logAuditEvent(db, appId, {
            action: 'ORDER_OPEN',
            entityType: 'FOLIO',
            entityId: folioId,
            userId: staffId,
            userName: staffName,
            newState: { folioId, status: 'OPEN', table: tableOrLabel }
        });

        return { ...folioData, id: folioId };

    } catch (error) {
        console.error('[FolioService] Error creating Open Bar Folio:', error);
        return null;
    }
}

/**
 * FEATURE: PAYMENTS (Append-only)
 * Add a payment to a folio. Auto-closes if fully paid.
 */
export async function addPaymentToFolio(db, appId, {
    folioId,
    amount,
    method, // 'CASH', 'MOBILE_MONEY', 'CARD', 'ROOM'
    reference = null,
    staffId,
    staffName
}) {
    const basePath = getBasePath(appId);
    const timestamp = getTimestamp();

    try {
        return await runTransaction(db, async (transaction) => {
            const folioRef = doc(db, basePath, COLLECTIONS.FOLIOS, folioId);
            const folioDoc = await transaction.get(folioRef);

            if (!folioDoc.exists()) throw new Error("Folio not found");
            const folio = folioDoc.data();

            if (folio.status !== 'OPEN' && folio.status !== 'PART_PAID') {
                throw new Error(`Cannot pay settled order (Status: ${folio.status})`);
            }

            // 1. Create Payment Record (Append-only)
            const paymentId = generateId(ID_PREFIXES.PAYMENT);
            const paymentRef = doc(db, basePath, COLLECTIONS.PAYMENTS, paymentId);

            const paymentData = {
                paymentId,
                folioId,
                amount: Number(amount),
                method,
                reference,
                createdAt: timestamp,
                createdBy: staffId,
                createdByName: staffName
            };

            transaction.set(paymentRef, paymentData);

            // 2. Update Folio State
            const newAmountPaid = (folio.amountPaid || 0) + Number(amount);
            const balance = folio.grandTotal - newAmountPaid;

            let newStatus = folio.status;
            let paymentStatus = 'PARTIAL';
            let closedAt = null;
            let closedBy = null;
            let closedByName = null;

            if (balance <= 0) {
                // Fully Paid -> Auto Close
                newStatus = 'CLOSED';
                paymentStatus = newAmountPaid > folio.grandTotal ? 'OVERPAID' : 'PAID';
                closedAt = timestamp;
                closedBy = staffId;
                closedByName = staffName;
            } else if (newAmountPaid > 0) {
                newStatus = 'PART_PAID'; // Support OPEN -> PART_PAID requirement
            }

            transaction.update(folioRef, {
                amountPaid: newAmountPaid,
                paymentStatus,
                status: newStatus,
                closedAt,
                closedBy,
                closedByName,
                updatedAt: timestamp
            });

            return {
                paymentId,
                newStatus,
                balance: Math.max(0, balance),
                paymentStatus
            };
        });

    } catch (error) {
        console.error('[FolioService] Payment failed:', error);
        return null;
    }
}

// =============================================================================
// FOLIO CLOSURE & INVOICE CREATION
// =============================================================================

/**
 * Close a folio and generate an invoice
 * Called at room checkout (after v1 checkout write)
 */
export async function closeFolioAndCreateInvoice(db, appId, {
    folioId,
    paymentMethod,
    amountPaid,
    staffId,
    staffName,
    v1CheckoutId = null,
}) {
    const basePath = getBasePath(appId);
    const timestamp = getTimestamp();

    try {
        // Get folio
        const folioRef = doc(db, basePath, COLLECTIONS.FOLIOS, folioId);
        const folioDoc = await getDoc(folioRef);

        if (!folioDoc.exists()) {
            console.error(`[FolioService] Folio not found: ${folioId}`);
            return null;
        }

        const folioData = folioDoc.data();

        if (folioData.status !== 'OPEN') {
            console.error(`[FolioService] Folio already ${folioData.status}: ${folioId}`);
            return null;
        }

        // Get all line items for this folio
        const lineItemsRef = collection(db, basePath, COLLECTIONS.FOLIO_LINE_ITEMS);
        const lineItemsQuery = query(lineItemsRef, where('folioId', '==', folioId));
        const lineItemsSnapshot = await getDocs(lineItemsQuery);

        const lineItems = lineItemsSnapshot.docs.map(doc => doc.data());

        // Calculate payment status
        const grandTotal = folioData.grandTotal;
        let paymentStatus = 'UNPAID';
        if (amountPaid >= grandTotal) {
            paymentStatus = amountPaid > grandTotal ? 'OVERPAID' : 'PAID';
        } else if (amountPaid > 0) {
            paymentStatus = 'PARTIAL';
        }

        // Create invoice via transaction
        const invoiceResult = await runTransaction(db, async (transaction) => {
            const year = getCurrentYear();
            const counterRef = doc(db, basePath, COLLECTIONS.INVOICE_COUNTERS, String(year));

            // Get/create counter
            const counterDoc = await transaction.get(counterRef);
            let newNumber;

            if (counterDoc.exists()) {
                newNumber = counterDoc.data().lastNumber + 1;
                transaction.update(counterRef, { lastNumber: newNumber });
            } else {
                newNumber = 1;
                transaction.set(counterRef, { year, lastNumber: 1, prefix: `INV-${year}-` });
            }

            const invoiceId = `${ID_PREFIXES.INVOICE}${Date.now()}`;
            const invoiceNumber = formatInvoiceNumber(year, newNumber);

            // Prepare invoice line items (denormalized snapshot)
            const invoiceLineItems = lineItems.map(item => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                subtotal: item.subtotal,
                discountAmount: item.discountAmount || 0,
                taxAmount: item.taxAmount || 0,
                totalAmount: item.totalAmount,
                category: item.category,
            }));

            // Create invoice
            const invoiceData = {
                invoiceId,
                invoiceNumber,

                folioId,
                folioNumber: folioData.folioNumber,
                folioType: folioData.folioType,

                issuedAt: timestamp,
                dueDate: null,

                customerName: folioData.ownerName,
                customerContact: folioData.ownerContact,
                customerAddress: null,

                roomNumber: folioData.roomNumber,
                checkInDate: folioData.checkInDate,
                checkOutDate: timestamp,

                lineItems: invoiceLineItems,
                subtotal: folioData.subtotal,
                discountTotal: folioData.discountTotal,
                taxTotal: folioData.taxTotal,
                grandTotal: folioData.grandTotal,

                amountPaid,
                amountDue: Math.max(0, grandTotal - amountPaid),
                paymentStatus: paymentStatus === 'OVERPAID' ? 'PAID' : paymentStatus,
                paymentMethod,

                issuedBy: staffId,
                issuedByName: staffName,

                serviceCenter: folioData.serviceCenter,

                v1CheckoutId,
                v1SalesIds: folioData.v1LinkedRecords?.salesIds || [],

                printCount: 0,
                lastPrintedAt: null,
                emailedTo: null,

                hash: null,
            };

            transaction.set(doc(db, basePath, COLLECTIONS.INVOICES, invoiceId), invoiceData);

            // Close folio
            transaction.update(folioRef, {
                status: 'CLOSED',
                closedAt: timestamp,
                checkOutDate: timestamp,
                amountPaid,
                paymentStatus,
                closedBy: staffId,
                closedByName: staffName,
                invoiceId,
                invoiceNumber,
                'v1LinkedRecords.checkoutId': v1CheckoutId,
            });

            return { invoiceId, invoiceNumber };
        });

        console.log(`[FolioService] Closed folio ${folioId}, created invoice ${invoiceResult.invoiceNumber}`);

        // Lock all line items
        for (const itemDoc of lineItemsSnapshot.docs) {
            await updateDoc(doc(db, basePath, COLLECTIONS.FOLIO_LINE_ITEMS, itemDoc.id), {
                isLocked: true,
            });
        }

        // Audit log
        await logAuditEvent(db, appId, {
            action: 'FOLIO_CLOSE',
            entityType: 'FOLIO',
            entityId: folioId,
            userId: staffId,
            userName: staffName,
            previousState: { status: 'OPEN' },
            newState: { status: 'CLOSED', invoiceNumber: invoiceResult.invoiceNumber },
        });

        await logAuditEvent(db, appId, {
            action: 'INVOICE_CREATE',
            entityType: 'INVOICE',
            entityId: invoiceResult.invoiceId,
            userId: staffId,
            userName: staffName,
            newState: { invoiceNumber: invoiceResult.invoiceNumber, grandTotal },
        });

        return invoiceResult;

    } catch (error) {
        console.error('[FolioService] Error closing folio:', error);
        return null;
    }
}

/**
 * Create invoice for a BAR folio (already closed)
 */
async function createInvoiceForFolio(db, appId, folioId, folioData, items, staffId, staffName) {
    const basePath = getBasePath(appId);
    const timestamp = getTimestamp();

    try {
        return await runTransaction(db, async (transaction) => {
            const year = getCurrentYear();
            const counterRef = doc(db, basePath, COLLECTIONS.INVOICE_COUNTERS, String(year));

            // Get/create counter
            const counterDoc = await transaction.get(counterRef);
            let newNumber;

            if (counterDoc.exists()) {
                newNumber = counterDoc.data().lastNumber + 1;
                transaction.update(counterRef, { lastNumber: newNumber });
            } else {
                newNumber = 1;
                transaction.set(counterRef, { year, lastNumber: 1, prefix: `INV-${year}-` });
            }

            const invoiceId = `${ID_PREFIXES.INVOICE}${Date.now()}`;
            const invoiceNumber = formatInvoiceNumber(year, newNumber);

            // Prepare invoice line items
            const invoiceLineItems = items.map(item => ({
                description: item.name,
                quantity: item.qty,
                unitPrice: item.price,
                subtotal: item.qty * item.price,
                discountAmount: 0,
                taxAmount: 0,
                totalAmount: item.qty * item.price,
                category: item.category || 'POS',
            }));

            // Create invoice
            const invoiceData = {
                invoiceId,
                invoiceNumber,

                folioId,
                folioNumber: folioData.folioNumber,
                folioType: 'BAR',

                issuedAt: timestamp,
                dueDate: null,

                customerName: folioData.ownerName || 'Walk-in Customer',
                customerContact: null,
                customerAddress: null,

                roomNumber: null,
                checkInDate: null,
                checkOutDate: null,

                lineItems: invoiceLineItems,
                subtotal: folioData.subtotal,
                discountTotal: 0,
                taxTotal: 0,
                grandTotal: folioData.grandTotal,

                amountPaid: folioData.grandTotal,
                amountDue: 0,
                paymentStatus: 'PAID',
                paymentMethod: null,

                issuedBy: staffId,
                issuedByName: staffName,

                serviceCenter: folioData.serviceCenter,

                v1CheckoutId: null,
                v1SalesIds: [folioData.v1LinkedRecords?.salesIds?.[0]].filter(Boolean),

                printCount: 0,
                lastPrintedAt: null,
                emailedTo: null,

                hash: null,
            };

            transaction.set(doc(db, basePath, COLLECTIONS.INVOICES, invoiceId), invoiceData);

            return { invoiceId, invoiceNumber };
        });

    } catch (error) {
        console.error('[FolioService] Error creating invoice:', error);
        return null;
    }
}

// =============================================================================
// VOID OPERATIONS
// =============================================================================

/**
 * Void a folio (prevent invoice generation)
 */
export async function voidFolio(db, appId, {
    folioId,
    reason,
    staffId,
    staffName,
}) {
    const basePath = getBasePath(appId);
    const timestamp = getTimestamp();

    try {
        const folioRef = doc(db, basePath, COLLECTIONS.FOLIOS, folioId);
        const folioDoc = await getDoc(folioRef);

        if (!folioDoc.exists()) {
            console.error(`[FolioService] Folio not found: ${folioId}`);
            return false;
        }

        const folioData = folioDoc.data();

        if (folioData.status !== 'OPEN') {
            console.error(`[FolioService] Cannot void ${folioData.status} folio: ${folioId}`);
            return false;
        }

        // Void the folio
        await updateDoc(folioRef, {
            status: 'VOIDED',
            voidedAt: timestamp,
            closedBy: staffId,
            closedByName: staffName,
            notes: `VOIDED: ${reason}`,
        });

        // Lock line items
        const lineItemsRef = collection(db, basePath, COLLECTIONS.FOLIO_LINE_ITEMS);
        const lineItemsQuery = query(lineItemsRef, where('folioId', '==', folioId));
        const lineItemsSnapshot = await getDocs(lineItemsQuery);

        for (const itemDoc of lineItemsSnapshot.docs) {
            await updateDoc(doc(db, basePath, COLLECTIONS.FOLIO_LINE_ITEMS, itemDoc.id), {
                isLocked: true,
            });
        }

        // Audit log
        await logAuditEvent(db, appId, {
            action: 'FOLIO_VOID',
            entityType: 'FOLIO',
            entityId: folioId,
            userId: staffId,
            userName: staffName,
            previousState: { status: 'OPEN' },
            newState: { status: 'VOIDED', reason },
        });

        console.log(`[FolioService] Voided folio ${folioId}: ${reason}`);
        return true;

    } catch (error) {
        console.error('[FolioService] Error voiding folio:', error);
        return false;
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

// New POS Features
export default {
    createOpenBarFolio,
    addPaymentToFolio,
    createOpenBarFolio,
    addPaymentToFolio,
    linkSalesToFolio,
    createBarFolio,
    createRoomFolio,
    addLineItemToFolio,
    getActiveFolioForRoom,
    closeFolioAndCreateInvoice,
    voidFolio,
    logAuditEvent,
};
