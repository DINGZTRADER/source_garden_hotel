import { useState, useEffect } from 'react';
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    doc,
    getDoc
} from 'firebase/firestore';
import { v2WriteBarOrder } from '../services/folioIntegration';

/**
 * Hook to fetch ALL open folios for a department (Ticket Switcher)
 * @param {object} db - Firestore instance
 * @param {string} appId - Application ID
 * @param {string} serviceCenter - Service center ID (e.g., 'bar_main')
 * @returns {object} { folios, loading }
 */
export function useOpenFolios(db, appId, serviceCenter) {
    const [folios, setFolios] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!serviceCenter) {
            setFolios([]);
            setLoading(false);
            return;
        }

        // Query for OPEN and PART_PAID folios
        const q = query(
            collection(db, 'artifacts', appId, 'public', 'data', 'folios'),
            where('serviceCenter', '==', serviceCenter),
            where('status', 'in', ['OPEN', 'PART_PAID'])
        );

        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                const docs = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
                // Client-side sort by createdAt desc
                docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
                setFolios(docs);
                setLoading(false);
            },
            (err) => {
                console.error("Error fetching open folios:", err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [db, appId, serviceCenter]);

    return { folios, loading };
}

/**
 * Adapter Hook: Makes a V2 Folio behave like a Local Cart for POSSystem
 * Mimics persistentCart interface
 */
export function useFolioCart(db, appId, folioId, staffId, staffName, department) {
    const [cart, setCart] = useState([]);
    const { lineItems, loading } = useFolioDetails(db, appId, folioId);

    // Sync line items to cart format
    useEffect(() => {
        if (!loading && lineItems) {
            // Transform Folio Line Items to POS Cart Items
            // Aggregate similar items?
            // SambaPOS lists individual lines or aggregates.
            // We'll aggregate for the Cart View usually, or list all.
            // POSSystem aggregates by ID in its display logic? No, it iterates cart.
            // We'll aggregate here to match POSSystem expectation.

            const aggregated = {};
            lineItems.forEach(item => {
                const key = item.v1MenuItemId || item.id;
                if (!aggregated[key]) {
                    aggregated[key] = {
                        id: key,
                        name: item.description,
                        price: item.unitPrice,
                        qty: 0,
                        category: item.category,
                        type: item.itemType === 'FOOD' ? 'kitchen' : 'bar'
                    };
                }
                aggregated[key].qty += item.quantity;
            });

            setCart(Object.values(aggregated));
        }
    }, [lineItems, loading]);

    // Add to Cart -> Immediate Server Write
    const addToCart = async (item) => {
        // Construct payload mimicking V1 txPayload (minimal)
        const payload = {
            id: `TX-PARTIAL-${Date.now()}`,
            items: [{
                ...item,
                qty: 1
            }],
            total: item.price,
            status: 'pending'
        };

        // Append to Folio
        await v2WriteBarOrder(db, appId, payload, staffId, staffName, department?.id, null, folioId);
    };

    const clearCart = () => { }; // No-op for Folio

    return { cart, addToCart, clearCart, isFolioMode: true, setCart: () => { } };
}

/**
 * Hook to listen for an active folio for a specific room
 * @param {object} db - Firestore instance
 * @param {string} appId - Application ID
 * @param {string} roomId - Room ID to listen for
 * @returns {object} { activeFolio, loading, error }
 */
export function useActiveFolio(db, appId, roomId) {
    const [activeFolio, setActiveFolio] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!roomId) {
            setActiveFolio(null);
            setLoading(false);
            return;
        }

        setLoading(true);

        const q = query(
            collection(db, 'artifacts', appId, 'public', 'data', 'folios'),
            where('roomId', '==', roomId),
            where('status', '==', 'OPEN'),
            orderBy('createdAt', 'desc'),
            limit(1)
        );

        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                if (!snapshot.empty) {
                    const docData = snapshot.docs[0].data();
                    setActiveFolio({ ...docData, id: snapshot.docs[0].id });
                } else {
                    setActiveFolio(null);
                }
                setLoading(false);
            },
            (err) => {
                console.error("Error fetching active folio:", err);
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [db, appId, roomId]);

    return { activeFolio, loading, error };
}

/**
 * Hook to fetch full details of a folio including line items
 * @param {object} db - Firestore instance
 * @param {string} appId - Application ID
 * @param {string} folioId - Folio ID to fetch
 * @returns {object} { folio, lineItems, loading, error }
 */
export function useFolioDetails(db, appId, folioId) {
    const [folio, setFolio] = useState(null);
    const [lineItems, setLineItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!folioId) {
            setFolio(null);
            setLineItems([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        // 1. Listen to Folio Document
        const folioUnsub = onSnapshot(
            doc(db, 'artifacts', appId, 'public', 'data', 'folios', folioId),
            (docSnap) => {
                if (docSnap.exists()) {
                    setFolio({ ...docSnap.data(), id: docSnap.id });
                } else {
                    setFolio(null);
                }
            },
            (err) => {
                console.error("Error fetching folio doc:", err);
                setError(err);
            }
        );

        // 2. Listen to Line Items
        const itemsQuery = query(
            collection(db, 'artifacts', appId, 'public', 'data', 'folio_line_items'),
            where('folioId', '==', folioId),
            orderBy('createdAt', 'asc')
        );

        const itemsUnsub = onSnapshot(itemsQuery,
            (snapshot) => {
                const items = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
                setLineItems(items);
                setLoading(false);
            },
            (err) => {
                console.error("Error fetching line items:", err);
                setLoading(false);
            }
        );

        return () => {
            folioUnsub();
            itemsUnsub();
        };
    }, [db, appId, folioId]);

    return { folio, lineItems, loading, error };
}

/**
 * Hook to fetch recent V2 activity (Invoices/Audit Logs) for Debug View
 * @param {object} db - Firestore instance
 * @param {string} appId - Application ID
 * @param {number} limitCount - limit
 * @returns {object} { invoices, auditLogs, loading }
 */
export function useV2DebugData(db, appId, limitCount = 10) {
    const [invoices, setInvoices] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const invQuery = query(
            collection(db, 'artifacts', appId, 'public', 'data', 'invoices'),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );

        const auditQuery = query(
            collection(db, 'artifacts', appId, 'public', 'data', 'audit_logs'),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        );

        const unsubInv = onSnapshot(invQuery, (snap) => {
            setInvoices(snap.docs.map(d => ({ ...d.data(), id: d.id })));
        });

        const unsubAudit = onSnapshot(auditQuery, (snap) => {
            setAuditLogs(snap.docs.map(d => ({ ...d.data(), id: d.id })));
            setLoading(false);
        });

        return () => {
            unsubInv();
            unsubAudit();
        };
    }, [db, appId, limitCount]);

    return { invoices, auditLogs, loading };
}
