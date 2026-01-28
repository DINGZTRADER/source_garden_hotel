
import {
    createOpenBarFolio,
    addLineItemToFolio,
    addPaymentToFolio
} from './folioService';
import { getDoc, doc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';

/**
 * POS DATA MODEL ACCEPTANCE TEST RUNNER
 */
export async function runPosAcceptanceTests(db, appId) {
    const report = {
        timestamp: new Date().toISOString(),
        tests: {},
        records: {}
    };

    const log = (section, msg, success = true) => {
        console.log(`[${section}] ${msg}`);
        if (!report.tests[section]) report.tests[section] = [];
        report.tests[section].push({ msg, success });
    };

    const staffId = 'test_admin';
    const staffName = 'Test Admin';
    const centerId = 'bar_main';

    try {
        log('INIT', 'Starting POS Acceptance Tests...');

        // -----------------------------------------------------
        // TEST 1: CONCURRENT ORDERS
        // -----------------------------------------------------
        const orderIds = [];
        log('TEST_1', 'Creating 3 Concurrent Open Orders...');

        for (let i = 1; i <= 3; i++) {
            const order = await createOpenBarFolio(db, appId, {
                serviceCenter: centerId,
                staffId,
                staffName,
                tableOrLabel: `Test Table ${i}`
            });
            if (order) {
                orderIds.push(order.folioId);
                log('TEST_1', `Created Order ${i}: ${order.folioId} (${order.ownerName})`);
            } else {
                log('TEST_1', `Failed to create Order ${i}`, false);
            }
        }

        // Add distinct items
        log('TEST_1', 'Adding items to orders...');
        await addLineItemToFolio(db, appId, {
            folioId: orderIds[0],
            description: 'Order 1 Item (Beer)',
            itemType: 'DRINK',
            quantity: 2,
            unitPrice: 5000,
            category: 'Bar',
            staffId, staffName
        });

        await addLineItemToFolio(db, appId, {
            folioId: orderIds[1],
            description: 'Order 2 Item (Pizza)',
            itemType: 'FOOD',
            quantity: 1,
            unitPrice: 30000,
            category: 'Kitchen',
            staffId, staffName
        });

        await addLineItemToFolio(db, appId, {
            folioId: orderIds[2],
            description: 'Order 3 Item (Water)',
            itemType: 'DRINK',
            quantity: 1,
            unitPrice: 2000,
            category: 'Bar',
            staffId, staffName
        });

        // Verify distinct totals
        const orders = [];
        for (const id of orderIds) {
            const docSnap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'folios', id));
            orders.push(docSnap.data());
        }

        report.records.concurrent_orders = orders;

        const totalsCorrect = orders[0].grandTotal === 10000 &&
            orders[1].grandTotal === 30000 &&
            orders[2].grandTotal === 2000;

        log('TEST_1', `Totals Verification: ${totalsCorrect ? 'PASS' : 'FAIL'}`, totalsCorrect);


        // -----------------------------------------------------
        // TEST 2: PARTIAL PAYMENTS
        // -----------------------------------------------------
        log('TEST_2', 'Testing Partial Payment on Order 2...');

        // Pay 10,000 on Order 2 (Total 30,000)
        const paymentResult = await addPaymentToFolio(db, appId, {
            folioId: orderIds[1],
            amount: 10000,
            method: 'CASH',
            staffId, staffName
        });

        // Fetch updated order
        const order2Snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'folios', orderIds[1]));
        const order2Data = order2Snap.data();

        report.records.partial_payment_order = order2Data;

        const statusCorrect = order2Data.status === 'PART_PAID';
        const balanceCorrect = (order2Data.grandTotal - order2Data.amountPaid) === 20000;

        log('TEST_2', `Status is PART_PAID: ${statusCorrect}`, statusCorrect);
        log('TEST_2', `Balance is 20,000: ${balanceCorrect}`, balanceCorrect);


        // -----------------------------------------------------
        // TEST 4: AUDIT TRAIL (Requirement 4)
        // -----------------------------------------------------
        log('TEST_4', 'Verifying Audit Trail...');
        const audits = [];
        const q = query(
            collection(db, 'artifacts', appId, 'public', 'data', 'audit_logs'),
            where('entityId', 'in', orderIds),
            orderBy('timestamp', 'desc')
        );
        const auditSnaps = await getDocs(q);
        auditSnaps.forEach(doc => audits.push(doc.data()));

        report.records.audit_logs = audits;
        log('TEST_4', `Found ${audits.length} audit logs for test orders`, audits.length > 0);


        // -----------------------------------------------------
        // CLEANUP (Optional)
        // -----------------------------------------------------
        log('DONE', 'Tests Complete. returning report.');

        return report;

    } catch (e) {
        log('ERROR', e.message, false);
        return report;
    }
}

export function initPosTestRunner(db, appId) {
    if (typeof window !== 'undefined') {
        window.runPosAcceptanceTests = () => runPosAcceptanceTests(db, appId);
        console.log('✅ POS Acceptance Test Runner Initialized. Run window.runPosAcceptanceTests()');
    }
}
