import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Receipt, Printer, Calendar, Search } from 'lucide-react';

const InvoiceList = ({ db, appId, onPrintInvoice }) => {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const q = query(
            collection(db, 'invoices'),
            orderBy('invoiceNo', 'desc'),
            limit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const invoiceData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setInvoices(invoiceData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [db]);

    const filteredInvoices = invoices.filter(inv =>
        inv.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.guestName && inv.guestName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (inv.staffName && inv.staffName.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
                <h2 className="font-bold text-slate-700 flex items-center gap-2">
                    <Receipt size={20} className="text-emerald-600" />
                    Invoices
                </h2>
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search invoice..."
                        className="pl-9 pr-4 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 sticky top-0">
                        <tr>
                            <th className="p-3 font-semibold border-b">Number</th>
                            <th className="p-3 font-semibold border-b">Date</th>
                            <th className="p-3 font-semibold border-b">Billed To</th>
                            <th className="p-3 font-semibold border-b text-right">Amount</th>
                            <th className="p-3 font-semibold border-b text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan="5" className="p-8 text-center text-slate-400">Loading history...</td></tr>
                        ) : filteredInvoices.length === 0 ? (
                            <tr><td colSpan="5" className="p-8 text-center text-slate-400">No invoices found</td></tr>
                        ) : (
                            filteredInvoices.map(inv => (
                                <tr key={inv.id} className="hover:bg-slate-50 group transition-colors">
                                    <td className="p-3 font-mono font-medium text-slate-700">{inv.invoiceNo}</td>
                                    <td className="p-3 text-slate-500">
                                        {inv.finalizedAt ? new Date(inv.finalizedAt).toLocaleDateString() : '-'}
                                    </td>
                                    <td className="p-3 text-slate-600">
                                        <div className="font-medium text-slate-900">{inv.guestName || 'Walk-in Customer'}</div>
                                        <div className="text-xs">{inv.staffName || 'Unknown Staff'}</div>
                                    </td>
                                    <td className="p-3 text-emerald-600 font-bold font-mono text-right">
                                        {new Intl.NumberFormat('en-UG').format(inv.total)}
                                    </td>
                                    <td className="p-3 text-center">
                                        <button
                                            onClick={() => onPrintInvoice(inv)}
                                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                            title="Print Invoice"
                                        >
                                            <Printer size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default InvoiceList;
