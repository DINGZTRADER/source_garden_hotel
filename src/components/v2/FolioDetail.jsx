import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { X, BedDouble, Coffee, User, Calendar, CreditCard } from 'lucide-react';

const FolioDetail = ({ db, appId, folio, onClose }) => {
    const [lineItems, setLineItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!folio) return;

        const fetchItems = async () => {
            setLoading(true);
            try {
                const q = query(
                    collection(db, 'folio_line_items'),
                    where('folioId', '==', folio.id),
                    orderBy('createdAt', 'asc')
                );
                const snap = await getDocs(q);
                const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setLineItems(items);
            } catch (e) {
                console.error("Fetch items error:", e);
            } finally {
                setLoading(false);
            }
        };

        fetchItems();
    }, [db, folio]);

    if (!folio) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 bg-slate-800 text-white flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 text-blue-300 font-mono text-xs mb-1">
                            <span>{folio.id}</span>
                            <span className="px-1.5 py-0.5 bg-white/10 rounded">{folio.status}</span>
                        </div>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            {folio.type === 'ROOM' ? <BedDouble className="text-blue-400" /> : <Coffee className="text-amber-400" />}
                            {folio.type === 'ROOM' ? `Room ${folio.v1LinkedRecords?.roomNumber || 'Unknown'}` : 'Bar Tab'}
                        </h2>
                        <p className="text-slate-400 text-sm mt-1 flex items-center gap-2">
                            <User size={14} /> {folio.guestName || 'Walk-in'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                        <div className="bg-white p-3 rounded border border-slate-200">
                            <div className="text-slate-500 text-xs mb-1">Created By</div>
                            <div className="font-medium">{folio.staffName}</div>
                        </div>
                        <div className="bg-white p-3 rounded border border-slate-200">
                            <div className="text-slate-500 text-xs mb-1">Date</div>
                            <div className="font-medium">{new Date(folio.createdAt).toLocaleString()}</div>
                        </div>
                    </div>

                    {/* Line Items Table */}
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden mb-6">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-100 text-slate-500 font-medium">
                                <tr>
                                    <th className="p-3 text-left">Description</th>
                                    <th className="p-3 text-center">Qty</th>
                                    <th className="p-3 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr><td colSpan="3" className="p-8 text-center text-slate-400">Loading charges...</td></tr>
                                ) : lineItems.length === 0 ? (
                                    <tr><td colSpan="3" className="p-8 text-center text-slate-400">No charges found</td></tr>
                                ) : (
                                    lineItems.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50">
                                            <td className="p-3">
                                                <div className="font-medium text-slate-800">{item.description}</div>
                                                <div className="text-xs text-slate-400 font-mono">{item.department} • {new Date(item.createdAt).toLocaleTimeString()}</div>
                                            </td>
                                            <td className="p-3 text-center text-slate-500">
                                                {item.type === 'ROOM_CHARGE' ? `${item.details?.nights || 1} nights` : '1'}
                                            </td>
                                            <td className="p-3 text-right font-mono font-medium">
                                                {new Intl.NumberFormat('en-UG').format(item.amount)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                                <tr>
                                    <td className="p-3 text-right uppercase text-xs text-slate-500" colSpan="2">Total Due</td>
                                    <td className="p-3 text-right text-lg text-slate-800">
                                        {new Intl.NumberFormat('en-UG').format(folio.total || 0)} <span className="text-xs text-slate-400 font-normal">UGX</span>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {folio.status === 'OPEN' && (
                        <div className="p-3 bg-blue-50 text-blue-700 text-sm rounded-lg border border-blue-100 flex items-center justify-center">
                            This folio is currently active. Charges can be added via POS/Front Office.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FolioDetail;
