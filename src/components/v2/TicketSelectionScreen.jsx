
import React, { useState } from 'react';
import { Plus, Users, Clock, ArrowRight, LayoutGrid } from 'lucide-react';
import { useOpenFolios } from '../../hooks/useV2Folio';
import { createOpenBarFolio } from '../../services/folioService';


const TicketSelectionScreen = ({ db, appId, department, staffName, onSelectTicket, onBack }) => {
    const { folios, loading } = useOpenFolios(db, appId, department?.id);
    const [isCreating, setIsCreating] = useState(false);
    const [newTicketName, setNewTicketName] = useState('');

    const handleCreateTicket = async (e) => {
        e.preventDefault();
        if (!newTicketName.trim()) return;

        setIsCreating(true);
        try {
            const newFolio = await createOpenBarFolio(db, appId, {
                serviceCenter: department.id,
                staffId: 'staff_id_ph', // In real app, pass actual staff ID
                staffName: staffName,
                tableOrLabel: newTicketName
            });

            if (newFolio) {
                onSelectTicket(newFolio); // Navigate to POS with this folio
            }
        } catch (error) {
            console.error("Failed to create ticket", error);
            alert("Error creating ticket");
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50">
            {/* Header */}
            <div className="bg-white p-4 border-b flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600">
                        Back
                    </button>
                    <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <LayoutGrid size={24} className="text-blue-600" />
                        {department?.name} - Open Tickets
                    </h1>
                </div>
                <div className="text-sm text-slate-500">
                    {staffName}
                </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
                <div className="max-w-7xl mx-auto">
                    {/* New Ticket Section */}
                    <div className="mb-8">
                        <form onSubmit={handleCreateTicket} className="flex gap-4 max-w-2xl">
                            <input
                                type="text"
                                placeholder="New Ticket Name (e.g. Table 5, James)"
                                className="flex-1 p-4 rounded-xl border border-slate-300 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-lg"
                                value={newTicketName}
                                onChange={(e) => setNewTicketName(e.target.value)}
                                autoFocus
                            />
                            <button
                                type="submit"
                                disabled={isCreating || !newTicketName}
                                className="bg-blue-600 text-white px-8 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 shadow-md transition-all active:scale-95"
                            >
                                <Plus size={24} />
                                {isCreating ? 'Creating...' : 'New Ticket'}
                            </button>
                        </form>
                    </div>

                    {/* Open Tickets Grid */}
                    {loading ? (
                        <div className="text-center py-10 text-slate-500">Loading open tickets...</div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {folios.length === 0 && (
                                <div className="col-span-full text-center py-10 bg-white rounded-xl border border-dashed border-slate-300">
                                    <div className="text-slate-400 mb-2">No open tickets</div>
                                    <div className="text-sm text-slate-500">Create a new ticket above to start taking orders.</div>
                                </div>
                            )}

                            {folios.map(folio => (
                                <button
                                    key={folio.id}
                                    onClick={() => onSelectTicket(folio)}
                                    className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-400 transition-all text-left flex flex-col justify-between h-40 group relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <Users size={64} />
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-bold text-lg text-slate-800 break-words w-full pr-6 leading-tight">
                                                {folio.ownerName}
                                            </span>
                                            {folio.status === 'PART_PAID' && (
                                                <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full font-bold absolute top-3 right-3">
                                                    PART PAID
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                            <Clock size={12} />
                                            {new Date(folio.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-end">
                                        <div>
                                            <div className="text-xs text-slate-400 uppercase font-semibold">Total</div>
                                            <div className="font-bold text-xl text-slate-700">
                                                {(folio.grandTotal || 0).toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="bg-blue-50 text-blue-600 p-2 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                            <ArrowRight size={20} />
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TicketSelectionScreen;
