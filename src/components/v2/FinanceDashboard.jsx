import React, { useState } from 'react';
import {
    CreditCard, FileText, Receipt, ShieldAlert,
    LayoutDashboard, ArrowLeft, Printer, Download
} from 'lucide-react';
import FolioList from './FolioList';
import InvoiceList from './InvoiceList';
import AuditLogView from './AuditLogView';
import FolioDetail from './FolioDetail';

const FinanceDashboard = ({ db, appId, userRole, staffName, onNavigateHome }) => {
    const [activeTab, setActiveTab] = useState('folios'); // folios, invoices, audit
    const [selectedFolio, setSelectedFolio] = useState(null);
    const [printInvoiceData, setPrintInvoiceData] = useState(null);

    // Print handler used by InvoiceList
    const handlePrintInvoice = (invoice) => {
        // In a real app we might open a dedicated print window or PDF
        // For now, we'll just log it or show a simple alert/window print
        alert(`This would open the print dialog for invoice #${invoice.invoiceNo}`);
    };

    return (
        <div className="h-full flex flex-col bg-slate-50">
            {/* Top Navigation Bar */}
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shadow-md z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onNavigateHome}
                        className="p-2 hover:bg-slate-700 rounded-full transition-colors"
                        title="Back to Dashboard"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <CreditCard className="text-blue-400" />
                        Finance & Audit
                    </h1>
                    <span className="px-2 py-0.5 bg-blue-600/30 border border-blue-500/50 rounded text-xs font-mono text-blue-200">
                        V2 ENGINE
                    </span>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                        <div className="text-sm font-semibold">{staffName}</div>
                        <div className="text-xs text-slate-400 uppercase tracking-wider">{userRole}</div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar Navigation */}
                <div className="w-64 bg-white border-r border-slate-200 flex flex-col py-4">
                    <nav className="space-y-1 px-2">
                        <NavButton
                            active={activeTab === 'folios'}
                            onClick={() => setActiveTab('folios')}
                            icon={FileText}
                            label="Active Folios"
                            desc="Open rooms & tabs"
                        />
                        <NavButton
                            active={activeTab === 'invoices'}
                            onClick={() => setActiveTab('invoices')}
                            icon={Receipt}
                            label="Invoices"
                            desc="History & Printing"
                        />
                        {userRole === 'admin' && (
                            <NavButton
                                active={activeTab === 'audit'}
                                onClick={() => setActiveTab('audit')}
                                icon={ShieldAlert}
                                label="Audit Logs"
                                desc="Security Trail"
                            />
                        )}
                    </nav>

                    <div className="mt-auto px-6 py-4 text-xs text-slate-400">
                        <p className="font-bold text-slate-500">System Status</p>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            <span>Dual-Write Active</span>
                        </div>
                    </div>
                </div>

                {/* Content Panel */}
                <div className="flex-1 overflow-hidden p-6 relative">
                    {activeTab === 'folios' && (
                        <FolioList
                            db={db}
                            appId={appId}
                            onSelectFolio={setSelectedFolio}
                        />
                    )}

                    {activeTab === 'invoices' && (
                        <InvoiceList
                            db={db}
                            appId={appId}
                            onPrintInvoice={handlePrintInvoice}
                        />
                    )}

                    {activeTab === 'audit' && (
                        <AuditLogView
                            db={db}
                            appId={appId}
                            userRole={userRole}
                        />
                    )}
                </div>
            </div>

            {/* Modals */}
            {selectedFolio && (
                <FolioDetail
                    db={db}
                    appId={appId}
                    folio={selectedFolio}
                    onClose={() => setSelectedFolio(null)}
                />
            )}
        </div>
    );
};

const NavButton = ({ active, onClick, icon: Icon, label, desc }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left ${active
                ? 'bg-blue-50 text-blue-700 border border-blue-100 shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
    >
        <div className={`p-2 rounded-lg ${active ? 'bg-blue-200 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
            <Icon size={20} />
        </div>
        <div>
            <div className="font-semibold text-sm">{label}</div>
            <div className="text-xs opacity-70 font-normal">{desc}</div>
        </div>
    </button>
);

export default FinanceDashboard;
