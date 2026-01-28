import React, { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { INITIAL_MENU } from '../../data/initialMenu';

const MenuSyncControl = ({ db, appId }) => {
    const [syncing, setSyncing] = useState(false);
    const [progress, setProgress] = useState({ total: 0, current: 0 });
    const [status, setStatus] = useState('idle'); // idle, syncing, success, error

    const handleSyncMenu = async () => {
        if (!window.confirm(`This will sync ${INITIAL_MENU.length} menu items to the database. Existing items with same IDs will be updated. Continue?`)) {
            return;
        }

        setSyncing(true);
        setStatus('syncing');
        setProgress({ total: INITIAL_MENU.length, current: 0 });

        let successCount = 0;
        let errors = [];

        try {
            for (const item of INITIAL_MENU) {
                try {
                    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'menuItems', item.id), item);
                    successCount++;
                    setProgress(prev => ({ ...prev, current: prev.current + 1 }));
                } catch (e) {
                    console.error(`Failed to sync item ${item.id}:`, e);
                    errors.push(`${item.name}: ${e.message}`);
                }
            }

            if (errors.length > 0) {
                alert(`Sync complete with ${errors.length} errors:\n${errors.join('\n')}`);
                setStatus('error');
            } else {
                setStatus('success');
            }
        } catch (e) {
            console.error("Critical sync error:", e);
            alert("Sync failed: " + e.message);
            setStatus('error');
        } finally {
            setSyncing(false);
            setTimeout(() => setStatus('idle'), 5000);
        }
    };

    return (
        <button
            onClick={handleSyncMenu}
            disabled={syncing}
            className={`bg-white p-5 rounded-xl shadow-sm hover:shadow-md border border-slate-200 text-left hover:border-blue-500 group transition-all relative overflow-hidden`}
        >
            <div className="flex items-center justify-between mb-2">
                <RefreshCw className={`text-slate-600 group-hover:text-blue-500 ${syncing ? 'animate-spin text-blue-600' : ''}`} size={24} />
                {status === 'success' && <CheckCircle size={20} className="text-emerald-500" />}
                {status === 'error' && <AlertTriangle size={20} className="text-amber-500" />}
            </div>

            <h3 className="font-semibold text-sm group-hover:text-blue-600">
                {syncing ? `Syncing ${progress.current}/${progress.total}...` : 'Sync Menu Data'}
            </h3>

            <p className="text-xs text-slate-500 mt-1">
                {syncing ? 'Updating Firestore...' : 'Push code menu to DB'}
            </p>

            {syncing && (
                <div className="absolute bottom-0 left-0 h-1 bg-blue-100 w-full">
                    <div
                        className="h-full bg-blue-500 transition-all duration-200"
                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                </div>
            )}
        </button>
    );
};

export default MenuSyncControl;
