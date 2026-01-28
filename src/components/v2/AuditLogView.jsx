import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { ShieldAlert, RefreshCcw, Search } from 'lucide-react';

const AuditLogView = ({ db, appId, userRole }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (userRole !== 'admin') return;

        const q = query(
            collection(db, 'audit_logs'),
            orderBy('timestamp', 'desc'),
            limit(100)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const logData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setLogs(logData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [db, userRole]);

    // Security check: Only admins see this
    if (userRole !== 'admin') {
        return (
            <div className="h-full flex flex-col items-center justify-center text-red-500 bg-red-50 rounded-xl m-4 border border-red-200">
                <ShieldAlert size={48} className="mb-4" />
                <h2 className="text-xl font-bold">Access Denied</h2>
                <p className="text-sm opacity-80 mt-2">Only Administrators can view the financial audit trail.</p>
            </div>
        );
    }

    const getActionColor = (action) => {
        if (action.includes('CREATE')) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
        if (action.includes('VOID')) return 'text-red-600 bg-red-50 border-red-200';
        if (action.includes('CLOSE')) return 'text-blue-600 bg-blue-50 border-blue-200';
        return 'text-slate-600 bg-slate-50 border-slate-200';
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-800 text-white rounded-t-xl">
                <h2 className="font-bold flex items-center gap-2">
                    <ShieldAlert size={20} className="text-amber-400" />
                    Financial Audit Trail
                </h2>
                <div className="text-xs opacity-70 font-mono">
                    IMMUTABLE LEDGER
                </div>
            </div>

            <div className="flex-1 overflow-auto bg-slate-50 p-4">
                {loading ? (
                    <div className="text-center p-8 text-slate-400">Loading secure logs...</div>
                ) : (
                    <div className="space-y-4">
                        {logs.map(log => (
                            <div key={log.id} className="flex gap-4">
                                <div className="flex flex-col items-center">
                                    <div className="w-2 h-2 rounded-full bg-slate-300 mt-2"></div>
                                    <div className="w-0.5 flex-1 bg-slate-200 my-1"></div>
                                </div>
                                <div className="flex-1 bg-white p-3 rounded-lg border border-slate-200 shadow-sm text-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getActionColor(log.action)}`}>
                                            {log.action}
                                        </span>
                                        <span className="text-xs text-slate-400 font-mono">
                                            {new Date(log.timestamp).toLocaleString()}
                                        </span>
                                    </div>
                                    <p className="text-slate-700 font-medium mb-1">
                                        {log.details || 'No details provided'}
                                    </p>
                                    <div className="flex gap-4 text-xs text-slate-500 mt-2 pt-2 border-t border-slate-50">
                                        <span>User: <strong>{log.performedBy || 'System'}</strong></span>
                                        {log.targetId && <span>Target: <span className="font-mono">{log.targetId}</span></span>}
                                        {log.metadata?.ipv4 && <span>IP: {log.metadata.ipv4}</span>}
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div className="text-center py-4 text-xs text-slate-400 uppercase tracking-widest">
                            End of Live Log
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuditLogView;
