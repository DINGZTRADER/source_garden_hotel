/**
 * SGHMS V2 Folio System Test Script
 * 
 * This script tests the folio service functions in isolation
 * before integrating them into App.js.
 * 
 * USAGE:
 * 1. Add this script temporarily to your app
 * 2. Call window.testV2Folio() from browser console
 * 3. Check console output and Firestore for results
 * 
 * @version 1.0
 * @date 2026-01-26
 */

import {
    getFirestore,
    collection,
    getDocs,
    doc,
    getDoc,
    query,
    where,
    orderBy,
    deleteDoc
} from 'firebase/firestore';

import {
    createBarFolio,
    createRoomFolio,
    addLineItemToFolio,
    getActiveFolioForRoom,
    closeFolioAndCreateInvoice,
    voidFolio,
} from './folioService';

// Get appId from window or use default
const getAppId = () => typeof window !== 'undefined' && window.__app_id ? window.__app_id : 'default-app-id';

/**
 * Test data generators
 */
const generateTestBarOrder = () => ({
    id: `TX-TEST-${Date.now()}`,
    items: [
        { id: 'beer1', name: 'Nile Special', qty: 2, price: 5000, type: 'bar', category: 'Beers' },
        { id: 'soda1', name: 'Soda (300ml)', qty: 1, price: 3000, type: 'bar', category: 'Drinks' },
    ],
    subtotal: 13000,
    total: 13000,
    paymentMethod: 'CASH',
});

const generateTestRoomData = () => ({
    room: {
        id: `rm_test_${Date.now()}`,
        number: 'TEST-101',
        type: 'Deluxe Double',
        price: 140000,
    },
    guest: {
        name: 'Test Guest',
        contact: '+256700123456',
        nightsBooked: 2,
        adults: 2,
        children: 0,
    },
});

/**
 * Test runner
 */
export async function runV2FolioTests(db, appId) {
    console.log('\n============================================');
    console.log('🧪 SGHMS V2 FOLIO SYSTEM TESTS');
    console.log('============================================\n');

    const results = {
        passed: 0,
        failed: 0,
        tests: [],
    };

    const staffId = 'test_staff_001';
    const staffName = 'Test Staff';
    const basePath = `artifacts/${appId}/public/data`;

    // Helper to log test results
    const logTest = (name, passed, details = '') => {
        results.tests.push({ name, passed, details });
        if (passed) {
            results.passed++;
            console.log(`✅ ${name}`);
        } else {
            results.failed++;
            console.log(`❌ ${name}: ${details}`);
        }
    };

    try {
        // =====================================================
        // TEST 1: Create BAR Folio
        // =====================================================
        console.log('\n📦 Test 1: Create BAR Folio');

        const barOrder = generateTestBarOrder();
        const barResult = await createBarFolio(db, appId, {
            v1SalesId: barOrder.id,
            items: barOrder.items,
            subtotal: barOrder.subtotal,
            total: barOrder.total,
            paymentMethod: barOrder.paymentMethod,
            roomId: null,
            serviceCenter: 'bar_main',
            staffId,
            staffName,
            customerName: 'Test Walk-in',
        });

        if (barResult) {
            logTest('BAR folio created', true);
            logTest('BAR folio has invoiceNumber', !!barResult.invoiceNumber);
            logTest('BAR folio has lineItemIds', barResult.lineItemIds?.length === 2);

            // Verify in Firestore
            const folioDoc = await getDoc(doc(db, basePath, 'folios', barResult.folioId));
            logTest('BAR folio exists in Firestore', folioDoc.exists());
            logTest('BAR folio status is CLOSED', folioDoc.data()?.status === 'CLOSED');

            // Check invoice
            if (barResult.invoiceId) {
                const invoiceDoc = await getDoc(doc(db, basePath, 'invoices', barResult.invoiceId));
                logTest('Invoice exists in Firestore', invoiceDoc.exists());
                logTest('Invoice has correct grandTotal', invoiceDoc.data()?.grandTotal === barOrder.total);
            }
        } else {
            logTest('BAR folio created', false, 'createBarFolio returned null');
        }

        // =====================================================
        // TEST 2: Create ROOM Folio
        // =====================================================
        console.log('\n🛏️ Test 2: Create ROOM Folio');

        const { room, guest } = generateTestRoomData();
        const roomResult = await createRoomFolio(db, appId, {
            roomId: room.id,
            roomNumber: room.number,
            roomType: room.type,
            roomPrice: room.price,
            guestName: guest.name,
            guestContact: guest.contact,
            nightsBooked: guest.nightsBooked,
            adults: guest.adults,
            children: guest.children,
            staffId,
            staffName,
        });

        if (roomResult) {
            logTest('ROOM folio created', true);
            logTest('ROOM folio has roomChargeItemId', !!roomResult.roomChargeItemId);

            // Verify in Firestore
            const roomFolioDoc = await getDoc(doc(db, basePath, 'folios', roomResult.folioId));
            logTest('ROOM folio exists in Firestore', roomFolioDoc.exists());
            logTest('ROOM folio status is OPEN', roomFolioDoc.data()?.status === 'OPEN');
            logTest('ROOM folio grandTotal correct', roomFolioDoc.data()?.grandTotal === room.price * guest.nightsBooked);
        } else {
            logTest('ROOM folio created', false, 'createRoomFolio returned null');
        }

        // =====================================================
        // TEST 3: Find Active Folio for Room
        // =====================================================
        console.log('\n🔍 Test 3: Find Active Folio for Room');

        if (roomResult) {
            const activeFolio = await getActiveFolioForRoom(db, appId, room.id);
            logTest('Found active folio for room', activeFolio !== null);
            logTest('Active folio ID matches', activeFolio?.folioId === roomResult.folioId);
        }

        // =====================================================
        // TEST 4: Add Line Item to Folio
        // =====================================================
        console.log('\n➕ Test 4: Add Line Item to Folio');

        if (roomResult) {
            const lineItemResult = await addLineItemToFolio(db, appId, {
                folioId: roomResult.folioId,
                description: 'POS: Test Bar Order',
                itemType: 'BAR_ORDER',
                quantity: 1,
                unitPrice: 25000,
                category: 'POS',
                staffId,
                staffName,
                v1SalesId: 'TX-TEST-123',
                sourceModule: 'POS',
            });

            if (lineItemResult) {
                logTest('Line item added', true);
                logTest('Line item has itemId', !!lineItemResult.itemId);

                // Verify folio total was updated
                const updatedFolio = await getDoc(doc(db, basePath, 'folios', roomResult.folioId));
                const expectedTotal = (room.price * guest.nightsBooked) + 25000;
                logTest('Folio grandTotal updated', updatedFolio.data()?.grandTotal === expectedTotal);
            } else {
                logTest('Line item added', false, 'addLineItemToFolio returned null');
            }
        }

        // =====================================================
        // TEST 5: Close Folio and Create Invoice
        // =====================================================
        console.log('\n📋 Test 5: Close Folio and Create Invoice');

        if (roomResult) {
            const closeResult = await closeFolioAndCreateInvoice(db, appId, {
                folioId: roomResult.folioId,
                paymentMethod: 'CASH',
                amountPaid: (room.price * guest.nightsBooked) + 25000,
                staffId,
                staffName,
                v1CheckoutId: 'CO-TEST-123',
            });

            if (closeResult) {
                logTest('Folio closed', true);
                logTest('Invoice created', !!closeResult.invoiceNumber);

                // Verify folio is closed
                const closedFolio = await getDoc(doc(db, basePath, 'folios', roomResult.folioId));
                logTest('Folio status is CLOSED', closedFolio.data()?.status === 'CLOSED');
                logTest('Folio has invoiceNumber', closedFolio.data()?.invoiceNumber === closeResult.invoiceNumber);
            } else {
                logTest('Folio closed', false, 'closeFolioAndCreateInvoice returned null');
            }
        }

        // =====================================================
        // TEST 6: Invoice Counter Sequence
        // =====================================================
        console.log('\n🔢 Test 6: Invoice Counter Sequence');

        const year = new Date().getFullYear();
        const counterDoc = await getDoc(doc(db, basePath, 'invoice_counters', String(year)));
        logTest('Invoice counter exists', counterDoc.exists());
        if (counterDoc.exists()) {
            logTest('Counter lastNumber >= 2', counterDoc.data()?.lastNumber >= 2);
        }

        // =====================================================
        // TEST 7: Audit Logs Created
        // =====================================================
        console.log('\n📜 Test 7: Audit Logs Created');

        const auditQuery = query(
            collection(db, basePath, 'audit_logs'),
            orderBy('timestamp', 'desc')
        );
        const auditSnapshot = await getDocs(auditQuery);
        logTest('Audit logs exist', !auditSnapshot.empty);
        logTest('At least 4 audit entries', auditSnapshot.size >= 4);

        // =====================================================
        // TEST 8: Void Folio
        // =====================================================
        console.log('\n🚫 Test 8: Void Folio');

        // Create a new folio to void
        const voidTestRoom = { ...room, id: `rm_void_test_${Date.now()}` };
        const voidFolioResult = await createRoomFolio(db, appId, {
            ...voidTestRoom,
            roomId: voidTestRoom.id,
            roomNumber: 'VOID-TEST',
            roomType: 'Test',
            roomPrice: 100000,
            guestName: 'Void Test Guest',
            guestContact: null,
            nightsBooked: 1,
            adults: 1,
            children: 0,
            staffId,
            staffName,
        });

        if (voidFolioResult) {
            const voidSuccess = await voidFolio(db, appId, {
                folioId: voidFolioResult.folioId,
                reason: 'Test void',
                staffId,
                staffName,
            });

            logTest('Folio voided', voidSuccess);

            // Verify status
            const voidedDoc = await getDoc(doc(db, basePath, 'folios', voidFolioResult.folioId));
            logTest('Voided folio status is VOIDED', voidedDoc.data()?.status === 'VOIDED');
        }

        // =====================================================
        // SUMMARY
        // =====================================================
        console.log('\n============================================');
        console.log('📊 TEST SUMMARY');
        console.log('============================================');
        console.log(`✅ Passed: ${results.passed}`);
        console.log(`❌ Failed: ${results.failed}`);
        console.log(`📦 Total:  ${results.passed + results.failed}`);
        console.log('============================================\n');

        if (results.failed === 0) {
            console.log('🎉 All tests passed! V2 folio system is working correctly.');
        } else {
            console.log('⚠️ Some tests failed. Review the output above.');
        }

        return results;

    } catch (error) {
        console.error('❌ Test execution error:', error);
        return { ...results, error: error.message };
    }
}

/**
 * Cleanup test data
 */
export async function cleanupTestData(db, appId) {
    console.log('\n🧹 Cleaning up test data...');

    const basePath = `artifacts/${appId}/public/data`;

    try {
        // Find and delete test folios
        const foliosQuery = query(
            collection(db, basePath, 'folios'),
            where('ownerName', '==', 'Test Walk-in')
        );
        const testFolios = await getDocs(foliosQuery);

        for (const doc of testFolios.docs) {
            await deleteDoc(doc.ref);
            console.log(`  Deleted folio: ${doc.id}`);
        }

        // Find and delete test folios by room
        const roomFoliosQuery = query(
            collection(db, basePath, 'folios'),
            where('ownerName', 'in', ['Test Guest', 'Void Test Guest'])
        );
        const roomTestFolios = await getDocs(roomFoliosQuery);

        for (const doc of roomTestFolios.docs) {
            await deleteDoc(doc.ref);
            console.log(`  Deleted folio: ${doc.id}`);
        }

        console.log('✅ Cleanup complete');

    } catch (error) {
        console.error('❌ Cleanup error:', error);
    }
}

/**
 * Browser-accessible test runner
 * Call window.testV2Folio() from browser console
 */
export function initTestRunner(db, appId) {
    if (typeof window !== 'undefined') {
        window.testV2Folio = () => runV2FolioTests(db, appId);
        window.cleanupV2Tests = () => cleanupTestData(db, appId);

        console.log('\n📋 V2 Folio Test Runner Loaded');
        console.log('   Run tests:    window.testV2Folio()');
        console.log('   Cleanup:      window.cleanupV2Tests()');
    }
}

export default {
    runV2FolioTests,
    cleanupTestData,
    initTestRunner,
};
