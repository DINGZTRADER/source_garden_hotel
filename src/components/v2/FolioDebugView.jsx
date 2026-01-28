import React, { useState } from 'react';
import { useV2DebugData } from '../../hooks/useV2Folio';
import {
    Database, FileText, Activity, ChevronDown, ChevronRight,
    ExternalLink, Clock, DollarSign
} from 'lucide-react';

/**
 * Debug panel for Admin Dashboard to visualize V2 Folio System activity
 */
const FolioDebugView = ({ db, appId }) => {
    const [isOpen, setIsOpen] = useState(false);
    const { invoices, auditLogs, loading } = useV2DebugData(db, appId, 10);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 bg-slate-800 text-slate-300 p-3 rounded-full shadow-lg hover:bg-slate-700 transition-all z-40 flex items-center gap-2 border border-slate-600"
            >
                <Database size={20} className="text-blue-400" />
                <span className="font-bold text-sm">V2 Debug</span>
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 w-96 bg-slate-900 text-slate-300 rounded-xl shadow-2xl border border-slate-700 z-50 flex flex-col max-h-[80vh]">
            {/* Header */}
            <div
                className="p-3 border-b border-slate-700 flex justify-between items-center bg-slate-800 rounded-t-xl cursor-pointer"
                onClick={() => setIsOpen(false)}
            >
                <div className="flex items-center gap-2">
                    <Database size={18} className="text-blue-400" />
                    <h3 className="font-bold text-white">V2 System Activity</h3>
                </div>
                <ChevronDown size={18} />
            </div>

            <div className="overflow-y-auto p-0 flex-1 custom-scrollbar text-xs">
                {loading ? (
                    <div className="p-4 text-center animate-pulse">Loading stream...</div>
                ) : (
                    <div className="flex flex-col">
                        {/* INVOICES SECTION */}
                        <div className="p-2 bg-slate-800/50 font-bold text-blue-300 sticky top-0 backdrop-blur-sm border-b border-slate-700 flex items-center gap-2">
                            <FileText size={14} /> Recent Invoices
                        </div>

                        {invoices.length === 0 ? (
                            <div className="p-4 text-slate-500 italic text-center">No invoices yet</div>
                        ) : (
                            invoices.map(inv => (
                                <div key={inv.id} className="p-3 border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold text-white tracking-wide">{inv.invoiceNumber}</span>
                                        <span className="text-emerald-400 font-mono">{(inv.grandTotal || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <div className="text-slate-500 text-[10px] space-y-0.5">
                                            <div>{new Date(inv.createdAt).toLocaleString()}</div>
                                            <div>{inv.customerName || 'Walk-in'}</div>
                                        </div>
                                        <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] uppercase">{inv.paymentMethod}</span>
                                    </div>
                                </div>
                            ))
                        )}

                        {/* AUDIT LOG SECTION */}
                        <div className="p-2 bg-slate-800/50 font-bold text-amber-300 sticky top-0 backdrop-blur-sm border-y border-slate-700 flex items-center gap-2 mt-2">
                            <Activity size={14} /> System Audit Stream
                        </div>

                        {auditLogs.length === 0 ? (
                            <div className="p-4 text-slate-500 italic text-center">No logs yet</div>
                        ) : (
                            auditLogs.map((log, idx) => (
                                <div key={log.id || idx} className="p-3 border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`w-1.5 h-1.5 rounded-full ${getActionColor(log.action)}`}></span>
                                        <span className="font-bold text-slate-200">{log.action?.replace('FOLIO_', '')}</span>
                                    </div>
                                    <div className="text-slate-400 mb-1 line-clamp-2">{log.details}</div>
                                    <div className="flex justify-between text-[10px] text-slate-600">
                                        <span>{log.performedBy}</span>
                                        <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                </div>
                            ))
                        )}

                        <div className="p-4 text-center text-slate-600 border-t border-slate-800 bg-slate-900">
                            End of stream (Last 10 events)
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Helper for log colors
const getActionColor = (action) => {
    if (action?.includes('CREATE')) return 'bg-emerald-500';
    if (action?.includes('VOID')) return 'bg-red-500';
    if (action?.includes('ADD')) return 'bg-blue-500';
    if (action?.includes('CLOSE')) return 'bg-amber-500';
    return 'bg-slate-500';
};

export default FolioDebugView;
