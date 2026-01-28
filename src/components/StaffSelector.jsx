import React, { useState, useEffect } from 'react';
import { UserCheck, ChevronDown } from 'lucide-react';

/**
 * Staff Selector Component
 * Allows service staff to identify themselves for transaction attribution
 * Selection persists in localStorage for the session
 */

const STAFF_OPTIONS = [
    { id: 'staff_a', name: 'Service Staff A', center: 'bar_main' },
    { id: 'staff_b', name: 'Service Staff B', center: 'bar_main' },
    { id: 'staff_c', name: 'Service Staff C', center: 'bar_main' },
    { id: 'riverside_a', name: 'Riverside Staff A', center: 'bar_river' },
    { id: 'riverside_b', name: 'Riverside Staff B', center: 'bar_river' },
    { id: 'pool_staff', name: 'Pool Attendant', center: 'pool' },
    { id: 'health_staff', name: 'Health Club Attendant', center: 'health_club' },
    { id: 'kitchen_staff', name: 'Kitchen Staff', center: 'kitchen' },
];

const StaffSelector = ({ onStaffSelected, currentDepartment }) => {
    const [selectedStaff, setSelectedStaff] = useState(null);
    const [showSelector, setShowSelector] = useState(false);

    // Load saved selection on mount
    useEffect(() => {
        const saved = localStorage.getItem('pos_selected_staff');
        if (saved) {
            try {
                const staff = JSON.parse(saved);
                setSelectedStaff(staff);
                onStaffSelected?.(staff);
            } catch (e) {
                console.error('Failed to parse saved staff:', e);
            }
        } else {
            setShowSelector(true);
        }
    }, []);

    const handleSelectStaff = (staff) => {
        setSelectedStaff(staff);
        localStorage.setItem('pos_selected_staff', JSON.stringify(staff));
        onStaffSelected?.(staff);
        setShowSelector(false);
    };

    const handleChangeStaff = () => {
        setShowSelector(true);
    };

    // Filter staff by current department if provided
    const availableStaff = currentDepartment
        ? STAFF_OPTIONS.filter(s => s.center === currentDepartment.id)
        : STAFF_OPTIONS;

    // Show selector modal if no staff selected
    if (showSelector || !selectedStaff) {
        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
                    <div className="p-6 bg-blue-600 text-white rounded-t-2xl">
                        <div className="flex items-center gap-3">
                            <UserCheck size={28} />
                            <div>
                                <h3 className="text-xl font-bold">Select Service Staff</h3>
                                <p className="text-sm opacity-90">Who is taking orders?</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6">
                        <p className="text-slate-600 mb-4 text-sm">
                            Select your name to attribute sales and track performance:
                        </p>

                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {availableStaff.map(staff => (
                                <button
                                    key={staff.id}
                                    onClick={() => handleSelectStaff(staff)}
                                    className="w-full p-4 text-left bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg transition-all"
                                >
                                    <div className="font-bold text-slate-800">{staff.name}</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                        {staff.center.replace('_', ' ').toUpperCase()}
                                    </div>
                                </button>
                            ))}
                        </div>

                        {availableStaff.length === 0 && (
                            <div className="text-center py-8 text-slate-400">
                                <p>No staff available for this department</p>
                                <button
                                    onClick={() => handleSelectStaff(STAFF_OPTIONS[0])}
                                    className="mt-4 text-blue-600 underline"
                                >
                                    Use default staff
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Show current staff badge
    return (
        <button
            onClick={handleChangeStaff}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            title="Click to change service staff"
        >
            <UserCheck size={18} />
            <div className="text-left">
                <div className="text-xs opacity-80">Service Staff:</div>
                <div className="font-bold text-sm">{selectedStaff.name}</div>
            </div>
            <ChevronDown size={16} className="opacity-60" />
        </button>
    );
};

export default StaffSelector;
