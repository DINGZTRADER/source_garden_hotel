import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { FileText, User, Calendar, CreditCard, ArrowRight, XCircle } from 'lucide-react';

const FolioList = ({ db, appId, onSelectFolio }) => {
    const [folios, setFolios] = useState([]);
    const [filter, setFilter] = useState('OPEN'); // OPEN, CLOSED, VOIDED
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Query folios based on status
        const q = query(
            collection(db, 'folios'),
            where('status', '==', filter),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const folioData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setFolios(folioData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching folios:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [db, filter]);

    const getStatusColor = (status) => {
        switch (status) {
            case 'OPEN': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'CLOSED': return 'bg-slate-100 text-slate-800 border-slate-200';
            case 'VOIDED': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-UG', { style: 'decimal' }).format(amount) + ' UGX';
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
                <h2 className="font-bold text-slate-700 flex items-center gap-2">
                    <FileText size={20} className="text-blue-600" />
                    Folio Management
                </h2>
                <div className="flex bg-white rounded-lg border border-slate-200 p-1">
                    {['OPEN', 'CLOSED', 'VOIDED'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilter(status)}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${filter === status
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-slate-500 hover:bg-slate-50'
                                }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {loading ? (
                    <div className="text-center p-8 text-slate-400">Loading folios...</div>
                ) : folios.length === 0 ? (
                    <div className="text-center p-8 text-slate-400 flex flex-col items-center">
                        <custom-icon name="ghost" className="mb-2 opacity-50" />
                        <p>No {filter.toLowerCase()} folios found</p>
                    </div>
                ) : (
                    folios.map(folio => (
                        <div
                            key={folio.id}
                            onClick={() => onSelectFolio && onSelectFolio(folio)}
                            className="p-3 bg-white border border-slate-100 rounded-lg hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <div className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                                        {folio.id}
                                    </div>
                                    <div className="text-xs text-slate-500 flex items-center gap-1">
                                        <Calendar size={10} />
                                        {new Date(folio.createdAt).toLocaleString()}
                                    </div>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusColor(folio.status)}`}>
                                    {folio.status}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-sm text-slate-600 mb-2">
                                <div className="flex items-center gap-1.5">
                                    <User size={14} className="text-slate-400" />
                                    <span className="truncate">{folio.guestName || folio.staffName || 'Unknown'}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <CreditCard size={14} className="text-slate-400" />
                                    <span className="truncate">{folio.type}</span>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-slate-50 flex justify-between items-end">
                                <div className="text-xs text-slate-400">Total Amount</div>
                                <div className="font-mono font-bold text-lg text-slate-800">
                                    {formatCurrency(folio.total || 0)}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default FolioList;
