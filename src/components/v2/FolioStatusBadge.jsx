import React from 'react';
import { useActiveFolio } from '../../hooks/useV2Folio';
import { FileText, CheckCircle, AlertCircle } from 'lucide-react';

/**
 * Badge to display V2 Folio status in Room Details modal
 * @param {object} db - Firestore instance
 * @param {string} appId - Application ID
 * @param {string} roomId - Room ID to check
 */
const FolioStatusBadge = ({ db, appId, roomId }) => {
    const { activeFolio, loading } = useActiveFolio(db, appId, roomId);

    if (loading) return <span className="text-xs text-slate-400 animate-pulse">Checking folio...</span>;

    if (activeFolio) {
        return (
            <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full border border-blue-200 text-sm font-medium">
                <FileText size={14} />
                <span>V2 Folio: {activeFolio.folioId.split('-').slice(2).join('-')}</span>
                <span className="text-xs bg-blue-200 px-1.5 rounded text-blue-800">OPEN</span>
                <span className="text-xs text-slate-500 font-mono ml-1">
                    ({activeFolio.grandTotal?.toLocaleString()} UGX)
                </span>
            </div>
        );
    }

    // If room is occupied but no V2 folio found (migration support)
    return (
        <div className="flex items-center gap-1 text-slate-400 text-xs" title="No V2 Folio active">
            <AlertCircle size={12} />
            <span>Legacy Mode</span>
        </div>
    );
};

export default FolioStatusBadge;
