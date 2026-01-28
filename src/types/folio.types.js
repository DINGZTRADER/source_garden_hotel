/**
 * SGHMS V2 Folio System - Type Definitions
 * 
 * These types define the v2 financial data structures as specified in STEP4_FOLIO_SCHEMA.md
 * and aligned with MASTERVERSION2.md requirements.
 * 
 * @version 1.0
 * @date 2026-01-26
 */

// =============================================================================
// ENUMS
// =============================================================================

/**
 * Folio type classification
 */
export type FolioType = 'BAR' | 'ROOM' | 'EVENT' | 'SERVICE';

/**
 * Folio status lifecycle
 * - OPEN: Accepts new line items
 * - CLOSED: Immutable, invoice generated
 * - VOIDED: Immutable, no invoice
 */
export type FolioStatus = 'OPEN' | 'CLOSED' | 'VOIDED';

/**
 * Payment status tracking
 */
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERPAID';

/**
 * Line item type classification
 */
export type LineItemType =
    | 'ROOM_CHARGE'
    | 'BAR_ORDER'
    | 'LAUNDRY'
    | 'SERVICE'
    | 'FOOD'
    | 'DRINK'
    | 'DISCOUNT'
    | 'PAYMENT'
    | 'ADJUSTMENT';

/**
 * Payment methods supported
 */
export type PaymentMethod = 'CASH' | 'CARD' | 'MOMO' | 'ROOM' | 'CREDIT';

/**
 * Source module for line items
 */
export type SourceModule = 'POS' | 'RECEPTION' | 'LAUNDRY' | 'RESTAURANT' | 'SYSTEM';

/**
 * Audit log action types
 */
export type AuditAction =
    | 'FOLIO_CREATE'
    | 'FOLIO_CLOSE'
    | 'FOLIO_VOID'
    | 'LINE_ITEM_ADD'
    | 'INVOICE_CREATE'
    | 'INVOICE_PRINT'
    | 'DISCOUNT_APPLY'
    | 'PAYMENT_RECEIVE';

// =============================================================================
// FOLIO
// =============================================================================

/**
 * V1 record linkage for migration tracking
 */
export interface V1LinkedRecords {
    /** v1 sales/{txId} references for bar orders */
    salesIds: string[];
    /** v1 checkouts/{id} reference */
    checkoutId: string | null;
    /** v1 rooms/{id} reference */
    roomId: string | null;
}

/**
 * Folio - Core financial container
 * 
 * Collection: /folios/{folioId}
 * 
 * Rules:
 * - OPEN folios can receive new line items
 * - CLOSED folios are immutable and generate an invoice
 * - VOIDED folios are immutable, no invoice generated
 * - No reopening of closed/voided folios
 */
export interface Folio {
    // === Identity ===
    /** Unique folio ID. Format: "FOLIO-{type}-{timestamp}" */
    folioId: string;
    /** Human-readable folio number. Format: "F-{year}-{seq}" */
    folioNumber: string;

    // === Type & Status ===
    folioType: FolioType;
    status: FolioStatus;

    // === Timestamps ===
    /** ISO 8601 creation timestamp */
    createdAt: string;
    /** ISO 8601 timestamp when status → CLOSED */
    closedAt: string | null;
    /** ISO 8601 timestamp when status → VOIDED */
    voidedAt: string | null;

    // === Owner Information ===
    /** Guest profile ID (for room folios) */
    ownerId: string | null;
    /** Display name of owner/customer */
    ownerName: string;
    /** Contact information */
    ownerContact: string | null;

    // === Room-Specific Fields (null for BAR folios) ===
    roomId: string | null;
    roomNumber: string | null;
    checkInDate: string | null;
    checkOutDate: string | null;
    nightsBooked: number | null;
    adults: number | null;
    children: number | null;

    // === Financial Summary (denormalized) ===
    /** Sum of line items before discount */
    subtotal: number;
    /** Sum of discounts applied */
    discountTotal: number;
    /** Sum of taxes (if applicable) */
    taxTotal: number;
    /** Final amount due */
    grandTotal: number;

    // === Payment Tracking ===
    amountPaid: number;
    paymentStatus: PaymentStatus;

    // === Staff Attribution ===
    /** Staff user ID who created the folio */
    createdBy: string;
    /** Staff display name */
    createdByName: string;
    /** Staff user ID who closed/finalized */
    closedBy: string | null;
    closedByName: string | null;

    // === V1 Linkage (migration tracking) ===
    v1LinkedRecords: V1LinkedRecords;

    // === Invoice Reference (set after finalization) ===
    invoiceId: string | null;
    invoiceNumber: string | null;

    // === Metadata ===
    /** Service center for bar folios */
    serviceCenter: string | null;
    notes: string | null;
}

// =============================================================================
// FOLIO LINE ITEM
// =============================================================================

/**
 * FolioLineItem - Individual charge on a folio
 * 
 * Collection: /folio_line_items/{itemId}
 * 
 * Rules:
 * - Line items are CREATE-ONLY (cannot be updated or deleted)
 * - Corrections via negative adjustment line items
 * - Voiding happens at folio level, not line item level
 * - isLocked set to true when parent folio is closed
 */
export interface FolioLineItem {
    // === Identity ===
    /** Unique item ID. Format: "FLI-{timestamp}-{seq}" */
    itemId: string;
    /** Parent folio reference */
    folioId: string;

    // === Timestamps ===
    /** ISO 8601 creation timestamp */
    createdAt: string;

    // === Item Details ===
    /** Human-readable description */
    description: string;
    itemType: LineItemType;

    // === Quantity & Pricing ===
    quantity: number;
    unitPrice: number;
    /** quantity × unitPrice */
    subtotal: number;

    // === Discount ===
    discountAmount: number;
    discountReason: string | null;
    /** Reference to discount_rules collection */
    discountRuleId: string | null;

    // === Tax ===
    taxAmount: number;
    /** Tax rate as decimal (e.g., 0.18 for 18%) */
    taxRate: number;

    // === Final Amount ===
    /** subtotal - discount + tax */
    totalAmount: number;

    // === Staff Attribution ===
    staffId: string;
    staffName: string;

    // === Category ===
    /** Category for grouping (e.g., "Breakfast", "Drinks", "Laundry") */
    category: string;

    // === V1 Linkage ===
    /** If mirrored from v1 sales */
    v1SalesId: string | null;
    /** Menu item reference */
    v1MenuItemId: string | null;

    // === Payment-Specific (for PAYMENT type) ===
    paymentMethod: PaymentMethod | null;
    paymentReference: string | null;

    // === Source Tracking ===
    sourceModule: SourceModule;
    /** True if created while offline */
    isOfflineCreated: boolean;
    /** When synchronized to Firestore */
    syncedAt: string | null;

    // === Immutability ===
    /** True after folio is closed */
    isLocked: boolean;
}

// =============================================================================
// INVOICE
// =============================================================================

/**
 * Denormalized line item snapshot for invoice
 */
export interface InvoiceLineItem {
    description: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    totalAmount: number;
    category: string;
}

/**
 * Invoice - Finalized financial document
 * 
 * Collection: /invoices/{invoiceId}
 * 
 * Rules:
 * - Invoices are IMMUTABLE after creation
 * - Invoice numbers are sequential and gapless
 * - Created only from CLOSED folios
 */
export interface Invoice {
    // === Identity ===
    /** Unique invoice ID. Format: "INV-{timestamp}" */
    invoiceId: string;
    /** Sequential invoice number. Format: "INV-{year}-{seq5}" */
    invoiceNumber: string;

    // === Source ===
    /** Reference to closed folio */
    folioId: string;
    folioNumber: string;
    folioType: FolioType;

    // === Timestamps ===
    /** ISO 8601 finalization timestamp */
    issuedAt: string;
    /** For credit invoices */
    dueDate: string | null;

    // === Customer Details (snapshot) ===
    customerName: string;
    customerContact: string | null;
    customerAddress: string | null;

    // === Room Details (for room folios) ===
    roomNumber: string | null;
    checkInDate: string | null;
    checkOutDate: string | null;

    // === Financial Summary (immutable snapshot) ===
    /** Denormalized copy of folio line items */
    lineItems: InvoiceLineItem[];
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    grandTotal: number;

    // === Payment Status (at invoice time) ===
    amountPaid: number;
    amountDue: number;
    paymentStatus: Exclude<PaymentStatus, 'OVERPAID'>;
    /** Primary payment method used */
    paymentMethod: string | null;

    // === Staff Attribution ===
    issuedBy: string;
    issuedByName: string;

    // === Service Center (for bar invoices) ===
    serviceCenter: string | null;

    // === V1 Linkage ===
    v1CheckoutId: string | null;
    v1SalesIds: string[];

    // === Print/Delivery Tracking ===
    printCount: number;
    lastPrintedAt: string | null;
    emailedTo: string | null;

    // === Integrity ===
    /** SHA-256 hash of invoice content (optional) */
    hash: string | null;
}

// =============================================================================
// INVOICE COUNTER
// =============================================================================

/**
 * Invoice counter for sequential numbering
 * 
 * Collection: /invoice_counters/{year}
 */
export interface InvoiceCounter {
    /** Year (e.g., 2026) */
    year: number;
    /** Last issued invoice number */
    lastNumber: number;
    /** Number prefix (e.g., "INV-2026-") */
    prefix: string;
}

// =============================================================================
// AUDIT LOG
// =============================================================================

/**
 * Audit log entry
 * 
 * Collection: /audit_logs/{logId}
 * 
 * Rules:
 * - Audit logs are APPEND-ONLY
 * - Cannot be updated or deleted
 */
export interface AuditLog {
    logId: string;
    /** ISO 8601 timestamp */
    timestamp: string;

    // === Action ===
    action: AuditAction;

    // === Entity ===
    entityType: 'FOLIO' | 'LINE_ITEM' | 'INVOICE';
    entityId: string;

    // === Actor ===
    userId: string;
    userName: string;
    userRole: string;

    // === Changes ===
    previousState: Record<string, unknown> | null;
    newState: Record<string, unknown>;

    // === Context ===
    ipAddress: string | null;
    deviceInfo: string | null;
    isOfflineAction: boolean;
}

// =============================================================================
// DISCOUNT
// =============================================================================

/**
 * Discount rule configuration
 * 
 * Collection: /discount_rules/{ruleId}
 */
export interface DiscountRule {
    ruleId: string;
    name: string;
    description: string;

    /** Discount type */
    type: 'PERCENTAGE' | 'FIXED_AMOUNT';
    /** Value (percentage or amount depending on type) */
    value: number;

    /** Maximum discount amount (for percentage discounts) */
    maxAmount: number | null;
    /** Minimum purchase amount required */
    minPurchase: number | null;

    /** Applicable folio types */
    applicableTo: FolioType[];
    /** Applicable item categories */
    applicableCategories: string[];

    /** Role required to apply */
    requiredRole: 'admin' | 'manager' | null;

    isActive: boolean;
    createdAt: string;
    createdBy: string;
}

/**
 * Applied discount event log
 * 
 * Collection: /discount_events/{eventId}
 */
export interface DiscountEvent {
    eventId: string;
    timestamp: string;

    ruleId: string;
    ruleName: string;

    folioId: string;
    lineItemId: string | null;

    discountAmount: number;
    reason: string | null;

    appliedBy: string;
    appliedByName: string;
}

// =============================================================================
// HELPER TYPES
// =============================================================================

/**
 * Folio creation input (for BAR folios)
 */
export interface CreateBarFolioInput {
    ownerName: string;
    items: Array<{
        name: string;
        quantity: number;
        unitPrice: number;
        category: string;
        menuItemId?: string;
    }>;
    paymentMethod: PaymentMethod;
    serviceCenter: string;
    staffId: string;
    staffName: string;
    v1SalesId: string;
}

/**
 * Folio creation input (for ROOM folios)
 */
export interface CreateRoomFolioInput {
    roomId: string;
    roomNumber: string;
    roomType: string;
    roomPrice: number;

    guestName: string;
    guestContact: string | null;

    nightsBooked: number;
    adults: number;
    children: number;

    staffId: string;
    staffName: string;
}

/**
 * Line item addition input
 */
export interface AddLineItemInput {
    folioId: string;
    description: string;
    itemType: LineItemType;
    quantity: number;
    unitPrice: number;
    category: string;

    staffId: string;
    staffName: string;

    v1SalesId?: string;
    v1MenuItemId?: string;

    discountAmount?: number;
    discountReason?: string;
    discountRuleId?: string;

    sourceModule: SourceModule;
    isOfflineCreated?: boolean;
}

/**
 * Folio close input
 */
export interface CloseFolioInput {
    folioId: string;
    paymentMethod: PaymentMethod;
    amountPaid: number;
    staffId: string;
    staffName: string;
    v1CheckoutId?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Firestore collection paths
 */
export const COLLECTIONS = {
    FOLIOS: 'folios',
    FOLIO_LINE_ITEMS: 'folio_line_items',
    INVOICES: 'invoices',
    INVOICE_COUNTERS: 'invoice_counters',
    DISCOUNT_RULES: 'discount_rules',
    DISCOUNT_EVENTS: 'discount_events',
    AUDIT_LOGS: 'audit_logs',
    GUEST_PROFILES: 'guest_profiles',
    STOCK_MOVEMENTS: 'stock_movements',
    WORK_PERIODS: 'work_periods', // DEPRECATED: No longer used for operational control (Always Open mode)
} as const;

/**
 * ID prefixes for generated IDs
 */
export const ID_PREFIXES = {
    FOLIO_BAR: 'FOLIO-BAR-',
    FOLIO_ROOM: 'FOLIO-ROOM-',
    FOLIO_EVENT: 'FOLIO-EVENT-',
    FOLIO_SERVICE: 'FOLIO-SERVICE-',
    LINE_ITEM: 'FLI-',
    INVOICE: 'INV-',
    AUDIT: 'LOG-',
    DISCOUNT_EVENT: 'DISC-',
} as const;

/**
 * Default values
 */
export const DEFAULTS = {
    TAX_RATE: 0,  // No tax by default
    CURRENCY: 'UGX',
    INVOICE_NUMBER_PAD: 5,  // INV-2026-00001
    FOLIO_NUMBER_PAD: 5,    // F-2026-00001
} as const;
