import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutGrid, Coffee, BedDouble,
  LogOut, ChefHat, Waves, Activity,
  Trash2, ClipboardList,
  ArrowLeft, FileWarning,
  DollarSign, PieChart, TrendingDown,
  AlertTriangle, Lock, Play, Square, Clock, Eye,
  Printer, Check, Calendar, PartyPopper, Plus, X, Users, MapPin,
  Package, Send, CheckCircle, XCircle, Award, Target,
  Warehouse, ArrowRightLeft, BarChart3, UserCheck, Timer, RefreshCw,
  ShoppingCart, FileText, AlertCircle, CreditCard, Building
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged,
  signInWithPopup, GoogleAuthProvider,
  signInWithEmailAndPassword, createUserWithEmailAndPassword
} from 'firebase/auth';
import {
  getFirestore, collection, doc, setDoc, deleteDoc,
  onSnapshot, updateDoc,
  query, orderBy, increment, arrayUnion, getDoc
} from 'firebase/firestore';

// --- V2 Folio Integration (dual-write) ---
import TicketSelectionScreen from './components/v2/TicketSelectionScreen';
import MenuSyncControl from './components/v2/MenuSyncControl';
import { INITIAL_MENU } from './data/initialMenu';
import { v2WriteBarOrder, v2WriteRoomCharge, v2WriteRoomCheckIn, v2WriteRoomCheckout, v2WriteLaundryCharge, v2SyncOfflineTransaction, isV2FolioEnabled, setV2FolioEnabled, getLocalFolioId } from './services/folioIntegration';
import { addPaymentToFolio } from './services/folioService';
import { initPosTestRunner } from './services/posRequirementsTest';
import { initTestRunner } from './services/folioTest';
import FolioStatusBadge from './components/v2/FolioStatusBadge';
import FolioDebugView from './components/v2/FolioDebugView';
import FinanceDashboard from './components/v2/FinanceDashboard';
import StaffSelector from './components/StaffSelector';
import { useFolioCart } from './hooks/useV2Folio';
// --- Firebase Configuration ---
const firebaseConfig = window.__firebase_config ? JSON.parse(window.__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const appId = typeof window.__app_id !== 'undefined' ? window.__app_id : 'default-app-id';

// Initialize V2 Folio Test Runner (call window.testV2Folio() in console to test)
initTestRunner(db, appId);
initPosTestRunner(db, appId);

// --- STAFF DATABASE (Server-side validated via Firestore) ---
// These are INITIAL seeds - actual auth is via Firebase Auth + Firestore user records
// Service Centers: Main Bar, Riverside Bar, New Kitchen, Health Club, Swimming Pool Bar
const STAFF_SEEDS = [
  // Admin & Supervisor
  { email: 'admin@sourcegarden.ug', name: 'Administrator', role: 'admin', department: null },
  { email: 'supervisor@sourcegarden.ug', name: 'Supervisor', role: 'supervisor', department: null },
  // Front Office
  { email: 'mustafa@sourcegarden.ug', name: 'Mustafa', role: 'staff', department: 'fo' },
  // Main Bar (1 barperson, 2 service staff)
  { email: 'mainbar@sourcegarden.ug', name: 'Main Bar Person', role: 'barperson', department: 'bar_main', serviceCenter: 'bar_main' },
  { email: 'mainbar.s1@sourcegarden.ug', name: 'Main Bar Service 1', role: 'service_staff', department: 'bar_main', serviceCenter: 'bar_main' },
  { email: 'mainbar.s2@sourcegarden.ug', name: 'Main Bar Service 2', role: 'service_staff', department: 'bar_main', serviceCenter: 'bar_main' },
  // Riverside Bar (1 barperson, 2 service staff)
  { email: 'pauline@sourcegarden.ug', name: 'Pauline', role: 'barperson', department: 'bar_river', serviceCenter: 'bar_river' },
  { email: 'riverside.s1@sourcegarden.ug', name: 'Riverside Service 1', role: 'service_staff', department: 'bar_river', serviceCenter: 'bar_river' },
  { email: 'riverside.s2@sourcegarden.ug', name: 'Riverside Service 2', role: 'service_staff', department: 'bar_river', serviceCenter: 'bar_river' },
  // New Kitchen (1 barperson, 2 service staff)
  { email: 'kitchen@sourcegarden.ug', name: 'Kitchen Person', role: 'barperson', department: 'kitchen', serviceCenter: 'kitchen' },
  { email: 'kitchen.s1@sourcegarden.ug', name: 'Kitchen Service 1', role: 'service_staff', department: 'kitchen', serviceCenter: 'kitchen' },
  { email: 'kitchen.s2@sourcegarden.ug', name: 'Kitchen Service 2', role: 'service_staff', department: 'kitchen', serviceCenter: 'kitchen' },
  // Health Club (1 barperson)
  { email: 'healthclub@sourcegarden.ug', name: 'Health Club Person', role: 'barperson', department: 'health', serviceCenter: 'health' },
  // Swimming Pool Bar (1 barperson)
  { email: 'poolbar@sourcegarden.ug', name: 'Pool Bar Person', role: 'barperson', department: 'pool_bar', serviceCenter: 'pool_bar' },
  // External Admin Users
  { email: 'faridahkyohirwe@gmail.com', name: 'Faridah Kyohirwe', role: 'admin', department: null },
  { email: 'wachaexperience@gmail.com', name: 'Wacha Experience', role: 'admin', department: null },
  { email: 'kennethahimbisibwe46@gmail.com', name: 'Kenneth Ahimbisibwe', role: 'admin', department: null },
  { email: 'ocenphillip03@gmail.com', name: 'Ocen Phillip', role: 'admin', department: null },
];

// --- SERVICE CENTERS (for stock management) ---
const SERVICE_CENTERS = [
  { id: 'bar_main', name: 'Main Bar', stockTypes: ['drinks'] },
  { id: 'bar_river', name: 'Riverside Bar', stockTypes: ['drinks'] },
  { id: 'kitchen', name: 'New Kitchen', stockTypes: ['food', 'drinks'] },
  { id: 'health', name: 'Health Club', stockTypes: ['drinks'] },
  { id: 'pool_bar', name: 'Swimming Pool Bar', stockTypes: ['drinks'] },
];

// Stock categories are: drinks_perishable, drinks_non_perishable, food_perishable, food_non_perishable

const KITCHEN_STOCK_ITEMS = [
  // Proteins
  { id: 'raw_whole_fish', name: 'Whole Fish (Raw)', unit: 'pcs', category: 'Proteins' },
  { id: 'raw_fish_fillet', name: 'Fish Fillet', unit: 'kg', category: 'Proteins' },
  { id: 'raw_chicken_whole', name: 'Whole Chicken', unit: 'pcs', category: 'Proteins' },
  { id: 'raw_beef', name: 'Beef (Meat)', unit: 'kg', category: 'Proteins' },
  { id: 'raw_goat', name: 'Goat Meat', unit: 'kg', category: 'Proteins' },
  { id: 'raw_liver', name: 'Liver', unit: 'kg', category: 'Proteins' },
  { id: 'raw_eggs', name: 'Eggs', unit: 'tray', category: 'Proteins' },
  { id: 'raw_sausages', name: 'Sausages', unit: 'pkt', category: 'Proteins' },

  // Produce
  { id: 'raw_potatoes', name: 'Irish Potatoes', unit: 'sack', category: 'Produce' },
  { id: 'raw_matooke', name: 'Matooke', unit: 'bunch', category: 'Produce' },
  { id: 'raw_rice', name: 'Rice', unit: 'kg', category: 'Produce' },
  { id: 'raw_posho', name: 'Posho/Maize Flour', unit: 'kg', category: 'Produce' },
  { id: 'raw_tomatoes', name: 'Tomatoes', unit: 'box', category: 'Produce' },
  { id: 'raw_onions', name: 'Onions', unit: 'net', category: 'Produce' },
  { id: 'raw_garlic', name: 'Garlic', unit: 'kg', category: 'Produce' },
  { id: 'raw_ginger', name: 'Ginger', unit: 'kg', category: 'Produce' },
  { id: 'raw_cabbage', name: 'Cabbages', unit: 'pc', category: 'Produce' },
  { id: 'raw_green_pepper', name: 'Green Peppers', unit: 'kg', category: 'Produce' },
  { id: 'raw_carrots', name: 'Carrots', unit: 'kg', category: 'Produce' },
  { id: 'raw_fruits', name: 'Mixed Fruits', unit: 'kg', category: 'Produce' },

  // Pantry
  { id: 'raw_oil', name: 'Cooking Oil', unit: 'liters', category: 'Pantry' },
  { id: 'raw_salt', name: 'Salt', unit: 'kg', category: 'Pantry' },
  { id: 'raw_sugar', name: 'Sugar', unit: 'kg', category: 'Pantry' },
  { id: 'raw_spaghetti', name: 'Spaghetti', unit: 'pkt', category: 'Pantry' },
  { id: 'raw_wheat_flour', name: 'Wheat Flour', unit: 'kg', category: 'Pantry' },
  { id: 'raw_milk', name: 'Milk', unit: 'liters', category: 'Pantry' },
  { id: 'raw_spices', name: 'Spices (Assorted)', unit: 'tin', category: 'Pantry' },
  { id: 'raw_bread', name: 'Bread', unit: 'loaf', category: 'Pantry' },
];

// --- REAL DATA: 79 ROOMS ---
const INITIAL_ROOMS = [
  // Cottages (11)
  { id: 'cot_fam', number: 'Family', type: 'Family Cottage', price: 450000, status: 'clean' },
  { id: 'cot_ele1', number: 'Elephant 1', type: 'Cottage', price: 170000, status: 'clean' },
  { id: 'cot_ele2', number: 'Elephant 2', type: 'Cottage', price: 170000, status: 'clean' },
  { id: 'cot_gir1', number: 'Giraffe 1', type: 'Cottage', price: 170000, status: 'clean' },
  { id: 'cot_gir2', number: 'Giraffe 2', type: 'Cottage', price: 170000, status: 'clean' },
  { id: 'cot_hor1', number: 'Horse 1', type: 'Cottage', price: 170000, status: 'clean' },
  { id: 'cot_hor2', number: 'Horse 2', type: 'Cottage', price: 170000, status: 'clean' },
  { id: 'cot_leo1', number: 'Leopard 1', type: 'Cottage', price: 170000, status: 'clean' },
  { id: 'cot_leo2', number: 'Leopard 2', type: 'Cottage', price: 170000, status: 'clean' },
  { id: 'cot_zeb1', number: 'Zebra 1', type: 'Cottage', price: 170000, status: 'clean' },
  { id: 'cot_zeb2', number: 'Zebra 2', type: 'Cottage', price: 170000, status: 'clean' },
  // Old Wing (2)
  { id: 'old_04', number: 'D/RM4', type: 'Deluxe Double', price: 120000, status: 'clean' },
  { id: 'old_05', number: 'D/RM5', type: 'Deluxe Double', price: 120000, status: 'clean' },
  // Twins (8)
  { id: 'twin_1', number: 'TWIN 1', type: 'Twin', price: 150000, status: 'clean' },
  { id: 'twin_2', number: 'TWIN 2', type: 'Twin', price: 150000, status: 'clean' },
  { id: 'twin_3', number: 'TWIN 3', type: 'Twin', price: 150000, status: 'clean' },
  { id: 'twin_4', number: 'TWIN 4', type: 'Twin', price: 150000, status: 'clean' },
  { id: 'twin_5', number: 'TWIN 5', type: 'Twin', price: 150000, status: 'clean' },
  { id: 'twin_6', number: 'TWIN 6', type: 'Twin', price: 150000, status: 'clean' },
  { id: 'twin_7', number: 'TWIN 7', type: 'Twin', price: 150000, status: 'clean' },
  { id: 'twin_8', number: 'TWIN 8', type: 'Twin', price: 150000, status: 'clean' },
  // Main Rooms 1-60
  { id: 'rm_01', number: 'RM 1', type: 'Deluxe Single', price: 120000, status: 'clean' },
  { id: 'rm_02', number: 'RM 2', type: 'Deluxe Single', price: 120000, status: 'clean' },
  { id: 'rm_03', number: 'RM 3', type: 'Deluxe Double', price: 140000, status: 'clean' },
  { id: 'rm_04', number: 'RM 4', type: 'Deluxe Single', price: 120000, status: 'clean' },
  { id: 'rm_05', number: 'RM 5', type: 'Deluxe Single', price: 120000, status: 'clean' },
  { id: 'rm_06', number: 'RM 6', type: 'Deluxe Double', price: 140000, status: 'clean' },
  { id: 'rm_07', number: 'RM 7', type: 'Deluxe Single', price: 120000, status: 'clean' },
  { id: 'rm_08', number: 'RM 8', type: 'Deluxe Double', price: 140000, status: 'clean' },
  { id: 'rm_09', number: 'RM 9', type: 'Deluxe Double', price: 140000, status: 'clean' },
  { id: 'rm_10', number: 'RM 10', type: 'Deluxe Double', price: 140000, status: 'clean' },
  { id: 'rm_11', number: 'RM 11', type: 'Deluxe Double', price: 140000, status: 'clean' },
  { id: 'rm_12', number: 'RM 12', type: 'Deluxe Double', price: 140000, status: 'clean' },
  { id: 'rm_13', number: 'RM 13', type: 'Deluxe Double', price: 140000, status: 'clean' },
  { id: 'rm_14', number: 'RM 14', type: 'Deluxe Double', price: 150000, status: 'clean' },
  { id: 'rm_15', number: 'RM 15', type: 'Deluxe Double', price: 150000, status: 'clean' },
  { id: 'rm_16', number: 'RM 16', type: 'Deluxe Double', price: 150000, status: 'clean' },
  { id: 'rm_17', number: 'RM 17', type: 'Deluxe Double', price: 150000, status: 'clean' },
  { id: 'rm_18', number: 'RM 18', type: 'Deluxe Double', price: 150000, status: 'clean' },
  { id: 'rm_19', number: 'RM 19', type: 'Deluxe Single', price: 120000, status: 'clean' },
  { id: 'rm_20', number: 'RM 20', type: 'Deluxe Single', price: 120000, status: 'clean' },
  { id: 'rm_21', number: 'RM 21', type: 'Deluxe Single', price: 120000, status: 'clean' },
  { id: 'rm_22', number: 'RM 22', type: 'Deluxe Double', price: 140000, status: 'clean' },
  { id: 'rm_23', number: 'RM 23', type: 'Deluxe Single', price: 120000, status: 'clean' },
  { id: 'rm_24', number: 'RM 24', type: 'Deluxe Double', price: 140000, status: 'clean' },
  { id: 'rm_25', number: 'RM 25', type: 'Deluxe Single', price: 120000, status: 'clean' },
  { id: 'rm_26', number: 'RM 26', type: 'Deluxe Double', price: 140000, status: 'clean' },
  { id: 'rm_27', number: 'RM 27', type: 'Deluxe Double', price: 140000, status: 'clean' },
  { id: 'rm_28', number: 'RM 28', type: 'Deluxe Double', price: 140000, status: 'clean' },
  { id: 'rm_29', number: 'RM 29', type: 'Deluxe Double', price: 140000, status: 'clean' },
  { id: 'rm_30', number: 'RM 30', type: 'Deluxe Double', price: 140000, status: 'clean' },
  { id: 'rm_31', number: 'RM 31', type: 'Deluxe Double', price: 140000, status: 'clean' },
  { id: 'rm_32', number: 'RM 32', type: 'Deluxe Double', price: 140000, status: 'clean' },
  { id: 'rm_33', number: 'RM 33', type: 'Deluxe Double', price: 150000, status: 'clean' },
  { id: 'rm_34', number: 'RM 34', type: 'Deluxe Double', price: 150000, status: 'clean' },
  { id: 'rm_35', number: 'RM 35', type: 'Deluxe Double', price: 150000, status: 'clean' },
  { id: 'rm_36', number: 'RM 36', type: 'Deluxe Double', price: 150000, status: 'clean' },
  { id: 'rm_37', number: 'RM 37', type: 'Deluxe Double', price: 150000, status: 'clean' },
  { id: 'rm_38', number: 'RM 38', type: 'Deluxe Single', price: 120000, status: 'clean' },
  { id: 'rm_39', number: 'RM 39', type: 'Deluxe Double', price: 140000, status: 'clean' },
  { id: 'rm_40', number: 'RM 40', type: 'Deluxe Double', price: 140000, status: 'clean' },
  { id: 'rm_41', number: 'RM 41', type: 'Deluxe Double', price: 140000, status: 'clean' },
  { id: 'rm_42', number: 'RM 42', type: 'Deluxe Double', price: 140000, status: 'clean' },
  { id: 'rm_43', number: 'RM 43', type: 'Deluxe Double', price: 140000, status: 'clean' },
  { id: 'rm_44', number: 'RM 44', type: 'Deluxe Single', price: 120000, status: 'clean' },
  { id: 'rm_45', number: 'RM 45', type: 'Deluxe Double', price: 120000, status: 'clean' },
  { id: 'rm_46', number: 'RM 46', type: 'Deluxe Single', price: 120000, status: 'clean' },
  { id: 'rm_47', number: 'RM 47', type: 'Deluxe Single', price: 120000, status: 'clean' },
  { id: 'rm_48', number: 'RM 48', type: 'Deluxe Single', price: 120000, status: 'clean' },
  { id: 'rm_49', number: 'RM 49', type: 'Deluxe Single', price: 120000, status: 'clean' },
  { id: 'rm_50', number: 'RM 50', type: 'Deluxe Single', price: 120000, status: 'clean' },
  { id: 'rm_51', number: 'RM 51', type: 'Deluxe Single', price: 120000, status: 'clean' },
  { id: 'rm_52', number: 'RM 52', type: 'Deluxe Single', price: 120000, status: 'clean' },
  { id: 'rm_53', number: 'RM 53', type: 'Deluxe Double', price: 140000, status: 'clean' },
  { id: 'rm_54', number: 'RM 54', type: 'Deluxe Single', price: 120000, status: 'clean' },
  { id: 'rm_55', number: 'RM 55', type: 'Deluxe Double', price: 140000, status: 'clean' },
  { id: 'rm_56', number: 'RM 56', type: 'Deluxe Single', price: 120000, status: 'clean' },
  { id: 'rm_57', number: 'RM 57', type: 'Deluxe Single', price: 120000, status: 'clean' },
  { id: 'rm_58', number: 'RM 58', type: 'Deluxe Single', price: 120000, status: 'clean' },
  { id: 'rm_59', number: 'RM 59', type: 'Deluxe Single', price: 120000, status: 'clean' },
  { id: 'rm_60', number: 'RM 60', type: 'Deluxe Single', price: 120000, status: 'clean' },
];

// --- MENU ITEMS ---
// --- MENU ITEMS ---
// INITIAL_MENU is now imported from src/data/initialMenu.js to allow shared usage

const DEPARTMENTS = [
  { id: 'fo', name: 'Front Office', icon: BedDouble, color: 'bg-blue-600', isServiceCenter: false },
  { id: 'bar_main', name: 'Main Bar', icon: Coffee, color: 'bg-amber-600', isServiceCenter: true },
  { id: 'bar_river', name: 'Riverside Bar', icon: Waves, color: 'bg-cyan-600', isServiceCenter: true },
  { id: 'kitchen', name: 'New Kitchen', icon: ChefHat, color: 'bg-red-600', isServiceCenter: true },
  { id: 'health', name: 'Health Club', icon: Activity, color: 'bg-emerald-600', isServiceCenter: true },
  { id: 'pool_bar', name: 'Swimming Pool Bar', icon: Waves, color: 'bg-sky-500', isServiceCenter: true },
];

// --- Components ---
const Button = ({ children, onClick, className = "", variant = "primary", disabled = false, icon: Icon }) => {
  const baseStyle = "px-4 py-2 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-slate-800 text-white hover:bg-slate-700 shadow-lg",
    secondary: "bg-white text-slate-800 border border-slate-200 hover:bg-slate-50",
    danger: "bg-red-500 text-white hover:bg-red-600",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
  };
  return <button onClick={onClick} className={`${baseStyle} ${variants[variant]} ${className}`} disabled={disabled}>{Icon && <Icon size={18} />}{children}</button>;
};

// --- Persistent Cart Hook ---
function usePersistentCart(departmentId) {
  const key = `sourcegarden_pos_cart_${departmentId || 'default'}`;
  const [cart, setCart] = useState(() => {
    try { const saved = localStorage.getItem(key); return saved ? JSON.parse(saved) : []; } catch { return []; }
  });

  // Re-load if department changes
  useEffect(() => {
    try { const saved = localStorage.getItem(key); setCart(saved ? JSON.parse(saved) : []); } catch { setCart([]); }
  }, [key]);

  useEffect(() => { localStorage.setItem(key, JSON.stringify(cart)); }, [cart, key]);
  const clearCart = () => { localStorage.removeItem(key); setCart([]); };
  return { cart, setCart, clearCart };
}

// --- Offline TX Queue with Auto-Retry ---
function useOfflineTxQueue() {
  const [queue, setQueue] = useState(() => {
    try { const saved = localStorage.getItem('sourcegarden_tx_queue'); return saved ? JSON.parse(saved) : []; } catch { return []; }
  });
  const [syncing, setSyncing] = useState(false);

  useEffect(() => { localStorage.setItem('sourcegarden_tx_queue', JSON.stringify(queue)); }, [queue]);

  const enqueue = useCallback((tx) => setQueue(prev => [...prev, tx]), []);
  const dequeue = useCallback((txId) => setQueue(prev => prev.filter(t => t.id !== txId)), []);

  // Auto-sync when online
  useEffect(() => {
    const syncPending = async () => {
      if (syncing || queue.length === 0) return;
      setSyncing(true);

      for (const tx of queue) {
        try {
          // V1 write (unchanged)
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sales', tx.id), { ...tx, status: 'confirmed', synced: true, syncedAt: new Date().toISOString() });

          // V2 write (NEW - create folio for synced transaction)
          if (isV2FolioEnabled()) {
            await v2SyncOfflineTransaction(db, appId, tx);
          }

          setQueue(prev => prev.filter(t => t.id !== tx.id));
          console.log(`Synced offline TX: ${tx.id}`);
        } catch (e) {
          console.error(`Failed to sync TX ${tx.id}:`, e);
          break;
        }
      }
      setSyncing(false);
    };

    syncPending();
    window.addEventListener('online', syncPending);
    return () => window.removeEventListener('online', syncPending);
  }, [queue, syncing]);

  return { queue, enqueue, dequeue, syncing };
}

// --- Offline VOID Queue with Auto-Retry (FIX: Audit finding) ---
function useOfflineVoidQueue() {
  const [voidQueue, setVoidQueue] = useState(() => {
    try { const saved = localStorage.getItem('sourcegarden_pending_voids'); return saved ? JSON.parse(saved) : []; } catch { return []; }
  });
  const [syncingVoids, setSyncingVoids] = useState(false);

  useEffect(() => { localStorage.setItem('sourcegarden_pending_voids', JSON.stringify(voidQueue)); }, [voidQueue]);

  const enqueueVoid = useCallback((voidRecord) => setVoidQueue(prev => [...prev, voidRecord]), []);
  const dequeueVoid = useCallback((voidId) => setVoidQueue(prev => prev.filter(v => v.id !== voidId)), []);

  // Auto-sync voids when online
  useEffect(() => {
    const syncPendingVoids = async () => {
      if (syncingVoids || voidQueue.length === 0) return;
      setSyncingVoids(true);

      for (const voidRecord of voidQueue) {
        try {
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'voids', voidRecord.id), { ...voidRecord, synced: true, syncedAt: new Date().toISOString() });
          setVoidQueue(prev => prev.filter(v => v.id !== voidRecord.id));
          console.log(`Synced offline VOID: ${voidRecord.id}`);
        } catch (e) {
          console.error(`Failed to sync VOID ${voidRecord.id}:`, e);
          break;
        }
      }
      setSyncingVoids(false);
    };

    syncPendingVoids();
    window.addEventListener('online', syncPendingVoids);
    return () => window.removeEventListener('online', syncPendingVoids);
  }, [voidQueue, syncingVoids]);

  return { voidQueue, enqueueVoid, dequeueVoid, syncingVoids };
}

// --- Work Period Hook ---
function useWorkPeriod() {
  const [workPeriod, setWorkPeriod] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'workPeriods', 'current'), (snap) => {
      if (snap.exists()) {
        setWorkPeriod({ id: 'current', ...snap.data() });
      } else {
        setWorkPeriod(null);
      }
      setLoading(false);
    }, (err) => {
      console.error("Work period listener error:", err);
      setLoading(false);
    });
    return unsub;
  }, []);

  const openWorkPeriod = async (staffName) => {
    const now = new Date().toISOString();
    const periodId = `WP-${Date.now()}`;
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'workPeriods', 'current'), {
      id: periodId,
      status: 'open',
      openedAt: now,
      openedBy: staffName,
      closedAt: null,
      closedBy: null,
      salesCount: 0,
      totalRevenue: 0
    });
  };

  const closeWorkPeriod = async (staffName, summary) => {
    if (!workPeriod) return;
    const now = new Date().toISOString();

    // Archive the work period
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'workPeriods', workPeriod.id), {
      ...workPeriod,
      status: 'closed',
      closedAt: now,
      closedBy: staffName,
      ...summary
    });

    // Clear current
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'workPeriods', 'current'), {
      status: 'closed',
      lastPeriodId: workPeriod.id,
      closedAt: now
    });
  };

  return { workPeriod, loading, openWorkPeriod, closeWorkPeriod, isOpen: workPeriod?.status === 'open' };
}

// --- Staff Shift Tracking Hook ---
function useStaffShift(userId, staffName, serviceCenter) {
  const [currentShift, setCurrentShift] = useState(null);

  // Track current shift
  useEffect(() => {
    if (!userId) return;
    const unsub = onSnapshot(
      doc(db, 'artifacts', appId, 'public', 'data', 'staffShifts', userId),
      (snap) => {
        if (snap.exists()) setCurrentShift({ id: userId, ...snap.data() });
        else setCurrentShift(null);
      }
    );
    return unsub;
  }, [userId]);

  // Start shift on login
  const startShift = useCallback(async () => {
    if (!userId || !staffName) return;
    const shiftId = `SHIFT-${Date.now()}`;
    const shiftData = {
      shiftId,
      staffId: userId,
      staffName,
      serviceCenter: serviceCenter || 'general',
      loginTime: new Date().toISOString(),
      logoutTime: null,
      status: 'active',
      ordersCount: 0,
      totalSales: 0,
      itemsSold: [],
    };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'staffShifts', userId), shiftData);
    return shiftData;
  }, [userId, staffName, serviceCenter]);

  // End shift on logout
  const endShift = useCallback(async (summary = {}) => {
    if (!userId || !currentShift) return;
    const now = new Date().toISOString();
    const shiftDuration = currentShift.loginTime
      ? Math.round((new Date(now) - new Date(currentShift.loginTime)) / (1000 * 60))
      : 0;

    // Archive the shift
    await setDoc(
      doc(db, 'artifacts', appId, 'public', 'data', 'shiftHistory', currentShift.shiftId),
      { ...currentShift, logoutTime: now, status: 'completed', shiftDuration, ...summary }
    );

    // Clear current shift
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'staffShifts', userId));
  }, [userId, currentShift]);

  // Update shift metrics
  const updateShiftMetrics = useCallback(async (orderTotal, items) => {
    if (!userId || !currentShift) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'staffShifts', userId), {
      ordersCount: increment(1),
      totalSales: increment(orderTotal),
      itemsSold: arrayUnion(...items.map(i => ({ name: i.name, qty: i.qty, price: i.price })))
    });
  }, [userId, currentShift]);

  return { currentShift, startShift, endShift, updateShiftMetrics };
}

// --- Main Store Stock Hook (available for modular components) ---
// eslint-disable-next-line no-unused-vars
function useMainStoreStock() {
  const [mainStoreStock, setMainStoreStock] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'mainStoreStock'),
      (snap) => setMainStoreStock(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => console.error('Main store stock error:', err)
    );
    return unsub;
  }, []);

  const receiveStock = async (item, quantity, supplier, receivedBy) => {
    const txId = `RCV-${Date.now()}`;
    const itemDoc = mainStoreStock.find(s => s.itemId === item.id);
    const newQty = (itemDoc?.quantity || 0) + quantity;

    // Update stock level
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'mainStoreStock', item.id), {
      itemId: item.id,
      itemName: item.name,
      category: item.category,
      type: item.type,
      quantity: newQty,
      unit: item.unit || 'pcs',
      lastUpdated: new Date().toISOString(),
      minThreshold: item.minThreshold || 10,
    });

    // Log the receipt transaction
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'stockTransactions', txId), {
      id: txId,
      type: 'receive',
      itemId: item.id,
      itemName: item.name,
      quantity,
      fromLocation: supplier,
      toLocation: 'main_store',
      receivedBy,
      date: new Date().toISOString(),
    });

    return txId;
  };

  const issueStock = async (item, quantity, toCenter, issuedBy, requisitionId) => {
    const txId = `ISS-${Date.now()}`;
    const itemDoc = mainStoreStock.find(s => s.itemId === item.id);
    const currentQty = itemDoc?.quantity || 0;

    if (currentQty < quantity) throw new Error('Insufficient stock in main store');

    // Decrease main store
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'mainStoreStock', item.id), {
      quantity: increment(-quantity),
      lastUpdated: new Date().toISOString(),
    });

    // Log the issue transaction
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'stockTransactions', txId), {
      id: txId,
      type: 'issue',
      itemId: item.id,
      itemName: item.itemName || item.name,
      quantity,
      fromLocation: 'main_store',
      toLocation: toCenter,
      issuedBy,
      requisitionId,
      date: new Date().toISOString(),
    });

    return txId;
  };

  return { mainStoreStock, receiveStock, issueStock };
}

// --- Service Center Stock Hook (available for modular components) ---
// eslint-disable-next-line no-unused-vars
function useServiceCenterStock(centerId) {
  const [centerStock, setCenterStock] = useState([]);

  useEffect(() => {
    if (!centerId) return;
    const unsub = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'serviceCenterStock', centerId, 'items'),
      (snap) => setCenterStock(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => console.error('Service center stock error:', err)
    );
    return unsub;
  }, [centerId]);

  const receiveFromMainStore = async (item, quantity, receivedBy) => {
    const itemDoc = centerStock.find(s => s.itemId === item.id);
    const newQty = (itemDoc?.quantity || 0) + quantity;

    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'serviceCenterStock', centerId, 'items', item.id), {
      itemId: item.id,
      itemName: item.name,
      category: item.category,
      quantity: newQty,
      lastReceived: new Date().toISOString(),
      receivedBy,
    });
  };

  const recordSale = async (itemId, quantity) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'serviceCenterStock', centerId, 'items', itemId), {
      quantity: increment(-quantity),
      lastSold: new Date().toISOString(),
    });
  };

  return { centerStock, receiveFromMainStore, recordSale };
}

// --- Requisition System Hook (available for modular components) ---
// eslint-disable-next-line no-unused-vars
function useRequisitions(centerId, staffName, isApprover = false) {
  const [requisitions, setRequisitions] = useState([]);
  const [myRequisitions, setMyRequisitions] = useState([]);

  useEffect(() => {
    // All requisitions (for approvers/supervisors)
    const unsubAll = onSnapshot(
      query(collection(db, 'artifacts', appId, 'public', 'data', 'requisitions'), orderBy('createdAt', 'desc')),
      (snap) => setRequisitions(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => console.error('Requisitions error:', err)
    );

    return () => { unsubAll(); };
  }, []);

  // Filter my requisitions
  useEffect(() => {
    if (centerId) {
      setMyRequisitions(requisitions.filter(r => r.serviceCenter === centerId));
    }
  }, [requisitions, centerId]);

  const createRequisition = async (items, notes = '') => {
    const reqId = `REQ-${Date.now()}`;
    const reqData = {
      id: reqId,
      serviceCenter: centerId,
      serviceCenterName: SERVICE_CENTERS.find(c => c.id === centerId)?.name || centerId,
      requestedBy: staffName,
      items: items.map(i => ({ itemId: i.id, itemName: i.name, quantity: i.requestQty, unit: i.unit || 'pcs' })),
      status: 'pending',
      notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      approvedBy: null,
      approvedAt: null,
      issuedBy: null,
      issuedAt: null,
    };

    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'requisitions', reqId), reqData);
    return reqId;
  };

  const approveRequisition = async (reqId, approverName) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'requisitions', reqId), {
      status: 'approved',
      approvedBy: approverName,
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  const rejectRequisition = async (reqId, approverName, reason) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'requisitions', reqId), {
      status: 'rejected',
      rejectedBy: approverName,
      rejectedAt: new Date().toISOString(),
      rejectionReason: reason,
      updatedAt: new Date().toISOString(),
    });
  };

  const fulfillRequisition = async (reqId, issuerName) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'requisitions', reqId), {
      status: 'fulfilled',
      issuedBy: issuerName,
      issuedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  return { requisitions, myRequisitions, createRequisition, approveRequisition, rejectRequisition, fulfillRequisition };
}

// --- Performance Tracking Hook ---
function usePerformanceTracking(staffId, serviceCenter) {
  const [performanceData, setPerformanceData] = useState(null);
  const [salesTargets, setSalesTargets] = useState([]);

  useEffect(() => {
    if (!staffId) return;

    // Get current month's performance
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const unsub = onSnapshot(
      doc(db, 'artifacts', appId, 'public', 'data', 'staffPerformance', `${staffId}_${currentMonth}`),
      (snap) => {
        if (snap.exists()) setPerformanceData(snap.data());
        else setPerformanceData({ totalSales: 0, ordersCount: 0, itemsSold: 0, shiftsWorked: 0 });
      }
    );

    // Get sales targets
    const unsubTargets = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'salesTargets'),
      (snap) => setSalesTargets(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    );

    return () => { unsub(); unsubTargets(); };
  }, [staffId]);

  const getStaffTarget = () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    return salesTargets.find(t => t.staffId === staffId && t.month === currentMonth);
  };

  const updatePerformance = async (orderTotal, itemsCount) => {
    if (!staffId) return;
    const currentMonth = new Date().toISOString().slice(0, 7);
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'staffPerformance', `${staffId}_${currentMonth}`);

    try {
      await updateDoc(docRef, {
        totalSales: increment(orderTotal),
        ordersCount: increment(1),
        itemsSold: increment(itemsCount),
        lastUpdated: new Date().toISOString(),
      });
    } catch {
      // Document doesn't exist, create it
      await setDoc(docRef, {
        staffId,
        serviceCenter,
        month: currentMonth,
        totalSales: orderTotal,
        ordersCount: 1,
        itemsSold: itemsCount,
        shiftsWorked: 1,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      });
    }
  };

  return { performanceData, salesTargets, getStaffTarget, updatePerformance };
}

// --- Main App ---
export default function App() {
  const [user, setUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [view, setView] = useState('login');
  const [activeFolio, setActiveFolio] = useState(null);
  const [navHistory, setNavHistory] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [activeDepartment, setActiveDepartment] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const { workPeriod, openWorkPeriod, closeWorkPeriod, isOpen: workPeriodOpen } = useWorkPeriod();

  // Staff shift tracking (startShift is called automatically on login, updateShiftMetrics called in POS)
  // eslint-disable-next-line no-unused-vars
  const { currentShift, startShift, endShift, updateShiftMetrics } = useStaffShift(
    appUser?.id,
    appUser?.name,
    appUser?.serviceCenter || appUser?.department
  );

  // Performance tracking (metrics are updated directly in POSSystem handlePaymentComplete)
  // eslint-disable-next-line no-unused-vars
  const { performanceData, updatePerformance } = usePerformanceTracking(
    appUser?.id,
    appUser?.serviceCenter || appUser?.department
  );

  // Auth - Firebase Authentication with Shift Tracking
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Fetch user role from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', u.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const fullUserData = {
              ...userData,
              id: u.uid,
              email: u.email,
              photo: u.photoURL,
              name: userData.name || u.displayName || u.email
            };
            setAppUser(fullUserData);

            // Start shift automatically for service staff
            if (['staff', 'barperson', 'service_staff'].includes(userData.role)) {
              try {
                const shiftDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'staffShifts', u.uid));
                if (!shiftDoc.exists()) {
                  // Auto-start shift on login
                  const shiftData = {
                    shiftId: `SHIFT-${Date.now()}`,
                    staffId: u.uid,
                    staffName: fullUserData.name,
                    serviceCenter: userData.serviceCenter || userData.department || 'general',
                    loginTime: new Date().toISOString(),
                    logoutTime: null,
                    status: 'active',
                    ordersCount: 0,
                    totalSales: 0,
                    itemsSold: [],
                  };
                  await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'staffShifts', u.uid), shiftData);
                }
              } catch (shiftErr) {
                console.error("Error starting shift:", shiftErr);
              }
            }

            // Auto-navigate based on role
            if (userData.role === 'admin' || userData.role === 'supervisor') {
              setView('dashboard');
            } else if (userData.department) {
              setActiveDepartment(DEPARTMENTS.find(d => d.id === userData.department));
              setView(userData.department === 'fo' ? 'frontoffice' : 'pos');
            }
          } else {
            // New user - create with default admin role (first user) or pending
            const newUserData = {
              name: u.displayName || u.email,
              email: u.email,
              role: 'admin', // First user gets admin
              department: null,
              createdAt: new Date().toISOString()
            };
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', u.uid), newUserData);
            setAppUser({ ...newUserData, id: u.uid, photo: u.photoURL });
            setView('dashboard');
          }
        } catch (e) {
          console.error("Error fetching user role:", e);
          // Fallback - allow access but log error
          setAppUser({ name: u.displayName || u.email, role: 'admin', id: u.uid, email: u.email, photo: u.photoURL });
          setView('dashboard');
        }
      } else {
        setAppUser(null);
        setView('login');
      }
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  // Data Loading
  useEffect(() => {
    if (appUser && rooms.length === 0) {
      setRooms(INITIAL_ROOMS);
      setMenuItems(INITIAL_MENU);
    }
    if (!user || !appUser) return;
    const unsubRooms = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'rooms'), (snap) => {
      if (snap.empty) { INITIAL_ROOMS.forEach(r => setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', r.id), r)); setRooms(INITIAL_ROOMS); }
      else { setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => { const numA = parseInt(a.number.replace(/\D/g, '')) || 0; const numB = parseInt(b.number.replace(/\D/g, '')) || 0; return numA - numB; })); }
    }, () => setRooms(INITIAL_ROOMS));
    const unsubMenu = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'menuItems'), (snap) => {
      if (snap.empty) { INITIAL_MENU.forEach(m => setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'menuItems', m.id), m)); setMenuItems(INITIAL_MENU); }
      else { setMenuItems(snap.docs.map(d => ({ id: d.id, ...d.data() }))); }
    }, () => setMenuItems(INITIAL_MENU));
    return () => { unsubRooms(); unsubMenu(); };
  }, [user, appUser, rooms.length]);

  const navigateTo = (newView) => { setNavHistory(prev => [...prev, view]); setView(newView); };
  const goBack = () => { if (navHistory.length === 0) { if (appUser?.role === 'admin') setView('dashboard'); return; } const prev = navHistory[navHistory.length - 1]; if (prev === 'login' && user) { setNavHistory([]); return; } setNavHistory(h => h.slice(0, -1)); setView(prev); };

  // Firebase Email/Password Login (replaces hardcoded PINs)
  const handleEmailLogin = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will handle the rest
    } catch (e) {
      // Handle both old and new Firebase error codes
      if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
        // Auto-create staff accounts from seeds
        const seed = STAFF_SEEDS.find(s => s.email.toLowerCase() === email.toLowerCase());
        if (seed && password === 'sourcegarden2024') {
          try {
            await createUserWithEmailAndPassword(auth, email, password);
            // User doc will be created in onAuthStateChanged
          } catch (createError) {
            if (createError.code === 'auth/email-already-in-use') {
              // Account exists but wrong password
              throw new Error("Wrong password. Use: sourcegarden2024");
            }
            throw createError;
          }
        } else {
          throw new Error("Invalid credentials. Use your email and password: sourcegarden2024");
        }
      } else {
        throw e;
      }
    }
  };

  const handleGoogleLogin = async () => {
    await signInWithPopup(auth, googleProvider);
    // onAuthStateChanged will handle the rest
  };

  const handleLogout = async () => {
    // End shift on logout
    if (currentShift && appUser?.id) {
      try {
        await endShift({ endReason: 'logout' });
      } catch (e) {
        console.error("Error ending shift:", e);
      }
    }
    await auth.signOut();
    setAppUser(null);
    setNavHistory([]);
    setView('login');
    setActiveDepartment(null);
  };

  if (!authReady) return <div className="h-screen flex items-center justify-center bg-slate-900 text-white">Starting Source Garden System...</div>;

  return (
    <div className="h-screen w-screen bg-slate-100 font-sans text-slate-800 overflow-hidden flex flex-col">
      {view !== 'login' && (
        <header className="h-14 bg-slate-900 text-white flex items-center justify-between px-6 shadow-md z-10 shrink-0">
          <div className="flex items-center gap-3">
            {navHistory.length > 0 && <button onClick={goBack} className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-full mr-2"><ArrowLeft size={18} /></button>}
            <div className="bg-blue-500 p-1.5 rounded-lg"><LayoutGrid size={20} /></div>
            <h1 className="font-bold text-lg tracking-wide">SOURCE GARDEN HMS</h1>
            {activeDepartment && <span className="bg-slate-700 px-3 py-1 rounded-full text-xs text-blue-200 uppercase">{activeDepartment.name}</span>}
            {/* Work Period Status Indicator */}
            {workPeriod && (
              <span className={`px-3 py-1 rounded-full text-xs uppercase font-bold flex items-center gap-1 ${workPeriodOpen ? 'bg-emerald-600' : 'bg-red-600'}`}>
                {workPeriodOpen ? <><Play size={12} /> Shift Open</> : <><Square size={12} /> Shift Closed</>}
              </span>
            )}
            {view === 'stock' && <span className="bg-amber-600 px-3 py-1 rounded-full text-xs uppercase font-bold">Stock Sheet</span>}
            {view === 'voids' && <span className="bg-red-600 px-3 py-1 rounded-full text-xs uppercase font-bold">Void Logs</span>}
            {view === 'report' && <span className="bg-emerald-600 px-3 py-1 rounded-full text-xs uppercase font-bold">Daily Report</span>}
            {view === 'expenses' && <span className="bg-rose-600 px-3 py-1 rounded-full text-xs uppercase font-bold">Expenses</span>}
            {view === 'calendar' && <span className="bg-indigo-600 px-3 py-1 rounded-full text-xs uppercase font-bold">Bookings Calendar</span>}
            {view === 'events' && <span className="bg-purple-600 px-3 py-1 rounded-full text-xs uppercase font-bold">Events</span>}
            {view === 'stockmanagement' && <span className="bg-teal-600 px-3 py-1 rounded-full text-xs uppercase font-bold">Stock Management</span>}
            {view === 'requisitions' && <span className="bg-orange-600 px-3 py-1 rounded-full text-xs uppercase font-bold">Requisitions</span>}
            {view === 'performance' && <span className="bg-violet-600 px-3 py-1 rounded-full text-xs uppercase font-bold">Performance</span>}
            {view === 'supervisor' && <span className="bg-fuchsia-600 px-3 py-1 rounded-full text-xs uppercase font-bold">Supervisor</span>}
            {currentShift && <span className="bg-blue-500 px-3 py-1 rounded-full text-xs uppercase font-bold flex items-center gap-1"><Timer size={12} /> On Shift</span>}
            {view === 'v2_finance' && <span className="bg-blue-700 px-3 py-1 rounded-full text-xs uppercase font-bold flex items-center gap-1"><CreditCard size={12} /> Finance V2</span>}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block"><p className="text-sm font-semibold">{appUser?.name}</p><p className="text-xs text-slate-400">{appUser?.email || appUser?.role?.toUpperCase()}</p></div>
            {appUser?.photo && <img src={appUser.photo} alt="" className="w-8 h-8 rounded-full border-2 border-slate-600" />}
            <button onClick={() => { if (appUser?.role === 'admin') { setNavHistory([]); setView('dashboard'); } }} className="p-2 hover:bg-slate-700 rounded-full"><LayoutGrid size={20} /></button>
            <button onClick={handleLogout} className="p-2 bg-red-600 hover:bg-red-700 rounded-full"><LogOut size={18} /></button>
          </div>
        </header>
      )}
      <main className="flex-1 overflow-hidden relative">
        {view === 'login' && <LoginScreen onEmailLogin={handleEmailLogin} onGoogleLogin={handleGoogleLogin} />}
        {view === 'dashboard' && <AdminDashboard
          onSelectDept={(d) => { setActiveDepartment(d); navigateTo(d.id === 'fo' ? 'frontoffice' : 'pos'); }}
          onOpenFinance={() => navigateTo('v2_finance')}
          onOpenStock={() => navigateTo('stock')}
          onOpenVoids={() => navigateTo('voids')}
          onOpenReport={() => navigateTo('report')}
          onOpenExpenses={() => navigateTo('expenses')}
          onOpenShiftControl={() => navigateTo('shiftcontrol')}
          onOpenCalendar={() => navigateTo('calendar')}
          onOpenEvents={() => navigateTo('events')}
          onOpenStockManagement={() => navigateTo('stockmanagement')}
          onOpenRequisitions={() => navigateTo('requisitions')}
          onOpenPerformance={() => navigateTo('performance')}
          onOpenSupervisor={() => navigateTo('supervisor')}
          workPeriod={workPeriod}
          workPeriodOpen={workPeriodOpen}
          userRole={appUser?.role}
        />}
        {view === 'frontoffice' && <FrontOffice rooms={rooms} workPeriodOpen={workPeriodOpen} />}
        {view === 'v2_finance' && <FinanceDashboard db={db} appId={appId} userRole={appUser?.role} staffName={appUser?.name} onNavigateHome={() => setView('dashboard')} />}
        {view === 'pos' && !activeFolio && (
          <TicketSelectionScreen
            db={db}
            appId={appId}
            department={activeDepartment}
            staffName={appUser?.name}
            onSelectTicket={(folio) => setActiveFolio(folio)}
            onBack={() => { setActiveDepartment(null); setView('dashboard'); }} // Back to Service Centers
          />
        )}
        {view === 'pos' && activeFolio && (
          <POSSystem
            menu={menuItems}
            department={activeDepartment}
            rooms={rooms}
            staffName={appUser?.name}
            workPeriodOpen={workPeriodOpen}
            workPeriod={workPeriod}
            activeFolio={activeFolio} // Pass Folio
            onNavigateToDashboard={() => { setView('dashboard'); setActiveDepartment(null); setActiveFolio(null); }}
          />
        )}
        {view === 'stock' && <StockSheet menu={menuItems} />}
        {view === 'voids' && <VoidReports />}
        {view === 'report' && <DailyReport rooms={rooms} />}
        {view === 'expenses' && <ExpensesModule staffName={appUser?.name} />}
        {/* ShiftControl view removed - Always Open mode active */}
        {view === 'calendar' && <BookingsCalendar rooms={rooms} />}
        {view === 'events' && <EventsModule staffName={appUser?.name} />}
        {view === 'stockmanagement' && <StockManagement menu={menuItems} staffName={appUser?.name} userRole={appUser?.role} />}
        {view === 'requisitions' && <RequisitionModule staffName={appUser?.name} userRole={appUser?.role} serviceCenter={appUser?.serviceCenter || appUser?.department} />}
        {view === 'performance' && <PerformanceModule staffName={appUser?.name} userRole={appUser?.role} />}
        {view === 'supervisor' && <SupervisorDashboard staffName={appUser?.name} />}
      </main>
    </div>
  );
}

// --- Login Screen (Firebase Auth - No Hardcoded PINs) ---
const LoginScreen = ({ onEmailLogin, onGoogleLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError('');
    try { await onGoogleLogin(); } catch (e) { setError(e.message || "Sign-in failed"); }
    setIsLoading(false);
  };

  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await onEmailLogin(email, password);
    } catch (err) {
      setError(err.message || "Invalid credentials");
    }
    setIsLoading(false);
  };

  return (
    <div className="h-full w-full flex items-center justify-center bg-slate-900">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><LayoutGrid size={32} className="text-white" /></div>
          <h2 className="text-3xl font-bold text-slate-800">Source Garden</h2>
          <p className="text-slate-500 mt-2">Hotel Management System</p>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

        {!showEmailForm ? (
          <div className="space-y-4">
            <button onClick={handleGoogleSignIn} disabled={isLoading} className="w-full h-14 bg-white border-2 border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-3 disabled:opacity-50">
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
              {isLoading ? 'Signing in...' : 'Sign in with Google (Admin)'}
            </button>
            <div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div><div className="relative flex justify-center text-sm"><span className="px-4 bg-white text-slate-400">or</span></div></div>
            <button onClick={() => setShowEmailForm(true)} className="w-full h-14 bg-slate-100 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 flex items-center justify-center gap-2">
              <Lock size={18} /> Staff Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Staff Email</label>
              <input
                type="email"
                className="w-full p-3 border rounded-lg"
                placeholder="name@sourcegarden.ug"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                className="w-full p-3 border rounded-lg"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
            <button type="button" onClick={() => { setShowEmailForm(false); setError(''); }} className="w-full text-sm text-slate-400 hover:text-slate-600">← Back to Google Sign-in</button>
          </form>
        )}
      </div>
    </div>
  );
};

// --- Admin Dashboard ---
const AdminDashboard = ({ onSelectDept, onOpenStock, onOpenVoids, onOpenReport, onOpenExpenses, onOpenShiftControl, onOpenCalendar, onOpenEvents, onOpenStockManagement, onOpenRequisitions, onOpenPerformance, onOpenSupervisor, onOpenFinance, workPeriod, workPeriodOpen, userRole }) => (
  <div className="h-full overflow-y-auto p-6 bg-slate-100">
    <div className="max-w-6xl mx-auto">
      {/* Work Period Removed - System Always Open */}

      <h2 className="text-2xl font-bold text-slate-800 mb-6">Service Centers</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {DEPARTMENTS.map(dept => (
          <button key={dept.id} onClick={() => onSelectDept(dept)} className={`${dept.color} h-32 rounded-xl p-4 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex flex-col items-center justify-center gap-2`}>
            <dept.icon size={36} className="opacity-90" /><span className="text-sm font-bold text-center">{dept.name}</span>
          </button>
        ))}
      </div>

      {/* Operations Management - New Section */}
      <h2 className="text-2xl font-bold text-slate-800 mt-10 mb-6 flex items-center gap-2"><Warehouse className="text-teal-600" /> Operations Management</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button onClick={onOpenStockManagement} className="bg-gradient-to-br from-teal-500 to-teal-700 p-6 rounded-xl shadow-lg hover:shadow-xl text-white text-left group">
          <Package className="mb-3" size={28} />
          <h3 className="font-bold">Stock Management</h3>
          <p className="text-xs text-teal-100 mt-1">3-tier inventory system</p>
        </button>
        <button onClick={onOpenRequisitions} className="bg-gradient-to-br from-orange-500 to-orange-700 p-6 rounded-xl shadow-lg hover:shadow-xl text-white text-left group">
          <Send className="mb-3" size={28} />
          <h3 className="font-bold">Requisitions</h3>
          <p className="text-xs text-orange-100 mt-1">Request & approve stock</p>
        </button>
        <button onClick={onOpenPerformance} className="bg-gradient-to-br from-violet-500 to-violet-700 p-6 rounded-xl shadow-lg hover:shadow-xl text-white text-left group">
          <Target className="mb-3" size={28} />
          <h3 className="font-bold">Performance</h3>
          <p className="text-xs text-violet-100 mt-1">Staff sales & targets</p>
        </button>
        {(userRole === 'admin' || userRole === 'supervisor') && (
          <button onClick={onOpenSupervisor} className="bg-gradient-to-br from-fuchsia-500 to-fuchsia-700 p-6 rounded-xl shadow-lg hover:shadow-xl text-white text-left group">
            <UserCheck className="mb-3" size={28} />
            <h3 className="font-bold">Supervisor</h3>
            <p className="text-xs text-fuchsia-100 mt-1">Real-time oversight</p>
          </button>
        )}
      </div>

      <h2 className="text-2xl font-bold text-slate-800 mt-10 mb-6">Administrative Tools</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

        {/* V2 Debug View & Sync Tools */}
        {userRole === 'admin' && <FolioDebugView db={db} appId={appId} />}
        {userRole === 'admin' && <MenuSyncControl db={db} appId={appId} />}

        <button onClick={onOpenReport} className="bg-white p-5 rounded-xl shadow-sm hover:shadow-md border border-slate-200 text-left hover:border-emerald-500 group"><PieChart className="text-slate-600 mb-2 group-hover:text-emerald-500" size={24} /><h3 className="font-semibold text-sm group-hover:text-emerald-600">Daily Report</h3><p className="text-xs text-slate-500 mt-1">Revenue & collections</p></button>
        <button onClick={onOpenStock} className="bg-white p-5 rounded-xl shadow-sm hover:shadow-md border border-slate-200 text-left hover:border-amber-500 group"><ClipboardList className="text-slate-600 mb-2 group-hover:text-amber-500" size={24} /><h3 className="font-semibold text-sm group-hover:text-amber-600">Bar Stock Sheet</h3><p className="text-xs text-slate-500 mt-1">Drinks inventory (legacy)</p></button>
        <button onClick={onOpenExpenses} className="bg-white p-5 rounded-xl shadow-sm hover:shadow-md border border-slate-200 text-left hover:border-rose-500 group"><TrendingDown className="text-slate-600 mb-2 group-hover:text-rose-500" size={24} /><h3 className="font-semibold text-sm group-hover:text-rose-600">Expenses</h3><p className="text-xs text-slate-500 mt-1">Petty cash & payouts</p></button>
        <button onClick={onOpenVoids} className="bg-white p-5 rounded-xl shadow-sm hover:shadow-md border border-slate-200 text-left hover:border-red-500 group"><FileWarning className="text-slate-600 mb-2 group-hover:text-red-500" size={24} /><h3 className="font-semibold text-sm group-hover:text-red-600">Void Reports</h3><p className="text-xs text-slate-500 mt-1">Cancelled items audit</p></button>
        <button onClick={onOpenCalendar} className="bg-white p-5 rounded-xl shadow-sm hover:shadow-md border border-slate-200 text-left hover:border-indigo-500 group"><Calendar className="text-slate-600 mb-2 group-hover:text-indigo-500" size={24} /><h3 className="font-semibold text-sm group-hover:text-indigo-600">Bookings Calendar</h3><p className="text-xs text-slate-500 mt-1">Room reservations</p></button>
        <button onClick={onOpenEvents} className="bg-white p-5 rounded-xl shadow-sm hover:shadow-md border border-slate-200 text-left hover:border-purple-500 group"><PartyPopper className="text-slate-600 mb-2 group-hover:text-purple-500" size={24} /><h3 className="font-semibold text-sm group-hover:text-purple-600">Events</h3><p className="text-xs text-slate-500 mt-1">Conferences & functions</p></button>

        {/* V2 FINANCE MODULE (Admin Only) */}
        {(userRole === 'admin') && (
          <button onClick={onOpenFinance} className="bg-white p-5 rounded-xl shadow-sm hover:shadow-md border border-slate-200 text-left hover:border-blue-700 bg-blue-50/50 group">
            <CreditCard className="text-blue-600 mb-2 group-hover:text-blue-700" size={24} />
            <h3 className="font-semibold text-sm text-blue-800 group-hover:text-blue-900">Finance & Audit</h3>
            <p className="text-xs text-blue-600 mt-1">V2 Folios & Invoices</p>
          </button>
        )}
      </div>
    </div>
  </div>
);

// --- Front Office (with Check-in/Check-out dates, Room Charges, and Laundry Services) ---
const FrontOffice = ({ rooms, workPeriodOpen }) => {
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestId, setGuestId] = useState('');
  const [checkInDate, setCheckInDate] = useState(new Date().toISOString().split('T')[0]);
  const [checkOutDate, setCheckOutDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; });
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [notes, setNotes] = useState('');
  // Laundry Services State
  const [showLaundry, setShowLaundry] = useState(false);
  const [laundryRoom, setLaundryRoom] = useState(null);

  const nights = Math.max(1, Math.ceil((new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24)));

  const resetForm = () => { setGuestName(''); setGuestPhone(''); setGuestId(''); setCheckInDate(new Date().toISOString().split('T')[0]); const d = new Date(); d.setDate(d.getDate() + 1); setCheckOutDate(d.toISOString().split('T')[0]); setAdults(1); setChildren(0); setNotes(''); };

  const handleCheckIn = async () => {
    if (!guestName || !selectedRoom) { alert("Please enter guest name"); return; }

    const checkInData = {
      roomId: selectedRoom.id,
      roomNumber: selectedRoom.number,
      status: 'occupied',
      guest: { name: guestName, phone: guestPhone, idNumber: guestId, checkIn: checkInDate, checkOut: checkOutDate, nights, adults: parseInt(adults), children: parseInt(children), notes, charges: [], createdAt: new Date().toISOString() }
    };

    // STEP 1: Save to localStorage BEFORE Firestore (survives crash)
    const pendingKey = `pending_checkin_${selectedRoom.id}`;
    localStorage.setItem(pendingKey, JSON.stringify(checkInData));

    try {
      // STEP 2: Write to Firestore (V1)
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', selectedRoom.id), {
        status: checkInData.status,
        guest: checkInData.guest
      });

      // STEP 2b: Create V2 Room Folio (NEW)
      if (isV2FolioEnabled()) {
        await v2WriteRoomCheckIn(
          db,
          appId,
          selectedRoom,
          {
            name: guestName,
            contact: guestPhone,
            nightsBooked: nights,
            adults: parseInt(adults),
            children: parseInt(children),
          },
          auth.currentUser?.uid || 'unknown',
          guestName  // Using guest name as staff name fallback
        );
      }

      // STEP 3: Clear pending only after success
      localStorage.removeItem(pendingKey);

      alert(`✓ ${guestName} checked into ${selectedRoom.number}`);
      setShowCheckIn(false); setSelectedRoom(null); resetForm();
    } catch (e) {
      // Pending check-in preserved in localStorage for manual recovery
      alert("Check-in failed (saved locally): " + e.message);
    }
  };

  const handleCheckOut = async (room) => {
    if (!window.confirm(`Check out ${room.guest?.name} from ${room.number}?`)) return;

    // STEP 1: Archive guest data to localStorage BEFORE clearing (survives crash)
    const checkoutRecord = {
      roomId: room.id,
      roomNumber: room.number,
      guest: room.guest,
      checkoutTime: new Date().toISOString(),
      status: 'pending_checkout'
    };
    const archiveKey = `checkout_archive_${room.id}_${Date.now()}`;
    localStorage.setItem(archiveKey, JSON.stringify(checkoutRecord));

    try {
      // STEP 2: Also write checkout record to Firestore for permanent audit (V1)
      const checkoutId = `CO-${Date.now()}-${room.id}`;
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'checkouts', checkoutId), {
        ...checkoutRecord,
        status: 'completed'
      });

      // STEP 3: Now safe to clear room
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id), { status: 'dirty', guest: null });

      // STEP 3b: Close V2 Folio and create invoice (NEW)
      if (isV2FolioEnabled()) {
        const roomTotal = (room.price * room.guest?.nights) +
          (room.guest?.charges?.reduce((sum, c) => sum + c.amount, 0) || 0);

        await v2WriteRoomCheckout(
          db,
          appId,
          room.id,
          {
            paymentMethod: 'CASH',  // Default - could be enhanced with payment selection
            amountPaid: roomTotal,
            total: roomTotal,
          },
          checkoutId,
          auth.currentUser?.uid || 'unknown',
          room.guest?.name || 'Staff'
        );
      }

      // STEP 4: Clear local archive only after both writes succeed
      localStorage.removeItem(archiveKey);

      alert(`✓ Checked out from ${room.number}`); setSelectedRoom(null);
    } catch (e) {
      // Guest data preserved in localStorage for manual recovery
      alert("Check-out failed (guest data preserved locally): " + e.message);
    }
  };

  const handleMarkClean = async (room) => {
    try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id), { status: 'clean' }); alert(`✓ ${room.number} marked clean`); setSelectedRoom(null); } catch (e) { alert("Failed: " + e.message); }
  };

  const getStatusColor = (status) => ({ occupied: 'bg-red-500', dirty: 'bg-amber-500' }[status] || 'bg-emerald-500');
  const stats = { total: rooms.length, occupied: rooms.filter(r => r.status === 'occupied').length, available: rooms.filter(r => r.status === 'clean').length, dirty: rooms.filter(r => r.status === 'dirty').length };

  return (
    <div className="h-full overflow-y-auto p-6 bg-slate-100">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border"><div className="text-2xl font-bold">{stats.total}</div><div className="text-sm text-slate-500">Total Rooms</div></div>
          <div className="bg-emerald-50 p-4 rounded-xl shadow-sm border border-emerald-200"><div className="text-2xl font-bold text-emerald-600">{stats.available}</div><div className="text-sm text-emerald-700">Available</div></div>
          <div className="bg-red-50 p-4 rounded-xl shadow-sm border border-red-200"><div className="text-2xl font-bold text-red-600">{stats.occupied}</div><div className="text-sm text-red-700">Occupied</div></div>
          <div className="bg-amber-50 p-4 rounded-xl shadow-sm border border-amber-200"><div className="text-2xl font-bold text-amber-600">{stats.dirty}</div><div className="text-sm text-amber-700">Needs Cleaning</div></div>
        </div>
        <div className="flex gap-4 mb-4 text-sm">
          <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-emerald-500"></div> Available</div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-red-500"></div> Occupied</div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-amber-500"></div> Dirty</div>
        </div>
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
          {rooms.length === 0 ? <div className="col-span-full text-center py-12 text-slate-400"><BedDouble size={48} className="mx-auto mb-4 opacity-50" /><p>Loading rooms...</p></div> : rooms.map(room => (
            <button key={room.id} onClick={() => { setSelectedRoom(room); if (room.status === 'clean') setShowCheckIn(true); }} className={`${getStatusColor(room.status)} p-3 rounded-xl text-center shadow-md text-white transition-all hover:scale-105`}>
              <div className="font-bold text-sm">{room.number}</div>
              <div className="text-xs opacity-80">{room.status === 'occupied' ? room.guest?.name?.split(' ')[0] || 'Guest' : room.status === 'dirty' ? 'Dirty' : 'Available'}</div>
            </button>
          ))}
        </div>

        {/* Room Details Modal - WITH ROOM CHARGES */}
        {selectedRoom && !showCheckIn && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedRoom(null)}>
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className={`p-6 text-white ${getStatusColor(selectedRoom.status)} shrink-0`}><h3 className="text-2xl font-bold">{selectedRoom.number}</h3><p className="opacity-80">{selectedRoom.type} • {selectedRoom.price.toLocaleString()} UGX/night</p></div>
              <div className="p-6 overflow-y-auto flex-1">
                {selectedRoom.status === 'occupied' && selectedRoom.guest && (
                  <>
                    <div className="space-y-2 mb-4 text-sm">
                      <div className="flex justify-between"><span className="text-slate-500">Guest:</span><span className="font-semibold">{selectedRoom.guest.name}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Phone:</span><span>{selectedRoom.guest.phone || 'N/A'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Check-In:</span><span className="text-emerald-600 font-medium">{selectedRoom.guest.checkIn}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Check-Out:</span><span className="text-red-600 font-medium">{selectedRoom.guest.checkOut}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Nights:</span><span>{selectedRoom.guest.nights}</span></div>
                    </div>

                    {/* V2 Folio Status Badge */}
                    <div className="mb-4">
                      <FolioStatusBadge db={db} appId={appId} roomId={selectedRoom.id} />
                    </div>

                    {/* ROOM CHARGES SECTION - FIX #4 */}
                    <div className="border-t pt-4 mt-4">
                      <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><Eye size={16} /> Room Charges</h4>
                      <div className="bg-slate-50 rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                        {/* Room Rate */}
                        <div className="flex justify-between text-sm">
                          <span>Room ({selectedRoom.guest.nights} nights × {selectedRoom.price.toLocaleString()})</span>
                          <span className="font-mono">{(selectedRoom.price * selectedRoom.guest.nights).toLocaleString()}</span>
                        </div>
                        {/* POS Charges */}
                        {selectedRoom.guest.charges && selectedRoom.guest.charges.length > 0 ? (
                          selectedRoom.guest.charges.map((charge, idx) => (
                            <div key={idx} className="flex justify-between text-sm border-t pt-1">
                              <span className="text-slate-600">{charge.description}</span>
                              <span className="font-mono text-amber-600">{charge.amount.toLocaleString()}</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-slate-400 italic">No additional charges</div>
                        )}
                      </div>

                      {/* TOTAL BALANCE */}
                      <div className="border-t-2 border-slate-300 pt-3 mt-3">
                        <div className="flex justify-between font-bold text-lg">
                          <span>TOTAL BALANCE</span>
                          <span className="text-emerald-600">
                            {(
                              (selectedRoom.price * selectedRoom.guest.nights) +
                              (selectedRoom.guest.charges?.reduce((sum, c) => sum + c.amount, 0) || 0)
                            ).toLocaleString()} UGX
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
                <div className="flex gap-3 mt-6">
                  {selectedRoom.status === 'clean' && <Button variant="success" className="flex-1" onClick={() => setShowCheckIn(true)}>Check In</Button>}
                  {selectedRoom.status === 'occupied' && (
                    <>
                      <Button variant="secondary" className="flex-1" onClick={() => { setLaundryRoom(selectedRoom); setShowLaundry(true); }}>
                        <FileText size={16} className="mr-1" /> Laundry
                      </Button>
                      <Button variant="danger" className="flex-1" onClick={() => handleCheckOut(selectedRoom)}>Check Out</Button>
                    </>
                  )}
                  {selectedRoom.status === 'dirty' && <Button variant="success" className="flex-1" onClick={() => handleMarkClean(selectedRoom)}>Mark Clean</Button>}
                  <Button variant="secondary" onClick={() => setSelectedRoom(null)}>Close</Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Laundry Services Modal - Front Office Managed */}
        {showLaundry && laundryRoom && (
          <LaundryModal
            room={laundryRoom}
            onClose={() => { setShowLaundry(false); setLaundryRoom(null); }}
          />
        )}

        {/* Check-In Modal */}
        {showCheckIn && selectedRoom && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden my-4">
              <div className="p-6 bg-emerald-600 text-white"><h3 className="text-xl font-bold">Check In - {selectedRoom.number}</h3><p className="opacity-80">{selectedRoom.type} • {selectedRoom.price.toLocaleString()} UGX/night</p></div>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Guest Name *</label><input type="text" className="w-full p-3 border rounded-lg" placeholder="Full name" value={guestName} onChange={e => setGuestName(e.target.value)} /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Phone</label><input type="tel" className="w-full p-3 border rounded-lg" placeholder="+256..." value={guestPhone} onChange={e => setGuestPhone(e.target.value)} /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">ID/Passport</label><input type="text" className="w-full p-3 border rounded-lg" value={guestId} onChange={e => setGuestId(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Check-In Date *</label><input type="date" className="w-full p-3 border rounded-lg" value={checkInDate} onChange={e => setCheckInDate(e.target.value)} /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Check-Out Date *</label><input type="date" className="w-full p-3 border rounded-lg" value={checkOutDate} min={checkInDate} onChange={e => setCheckOutDate(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Adults</label><input type="number" className="w-full p-3 border rounded-lg" min="1" value={adults} onChange={e => setAdults(e.target.value)} /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Children</label><input type="number" className="w-full p-3 border rounded-lg" min="0" value={children} onChange={e => setChildren(e.target.value)} /></div>
                </div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Notes</label><textarea className="w-full p-3 border rounded-lg" rows="2" value={notes} onChange={e => setNotes(e.target.value)} /></div>
                <div className="bg-slate-50 p-4 rounded-lg"><div className="flex justify-between text-sm"><span>Duration:</span><span>{nights} night{nights > 1 ? 's' : ''}</span></div><div className="border-t pt-2 mt-2 flex justify-between font-bold text-lg"><span>Total:</span><span className="text-emerald-600">{(selectedRoom.price * nights).toLocaleString()} UGX</span></div></div>
                <div className="flex gap-3"><Button variant="secondary" className="flex-1" onClick={() => { setShowCheckIn(false); setSelectedRoom(null); resetForm(); }}>Cancel</Button><Button variant="success" className="flex-1" onClick={handleCheckIn} disabled={!guestName}>Confirm Check-In</Button></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Laundry Modal (Front Office Services) ---
const LaundryModal = ({ room, onClose }) => {
  const [laundryCart, setLaundryCart] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get laundry services from menu
  const laundryServices = INITIAL_MENU.filter(m => m.category === 'FO Laundry');

  const addToLaundry = (service) => {
    const existing = laundryCart.find(i => i.id === service.id);
    if (existing) {
      setLaundryCart(laundryCart.map(i => i.id === service.id ? { ...i, qty: i.qty + 1 } : i));
    } else {
      setLaundryCart([...laundryCart, { ...service, qty: 1 }]);
    }
  };

  const removeFromLaundry = (serviceId) => {
    setLaundryCart(laundryCart.filter(i => i.id !== serviceId));
  };

  const updateQty = (serviceId, qty) => {
    if (qty < 1) {
      removeFromLaundry(serviceId);
    } else {
      setLaundryCart(laundryCart.map(i => i.id === serviceId ? { ...i, qty } : i));
    }
  };

  const total = laundryCart.reduce((sum, i) => sum + (i.price * i.qty), 0);

  const handleSubmit = async () => {
    if (laundryCart.length === 0) return;
    setIsSubmitting(true);

    try {
      // Add laundry charges to room (V1)
      const chargeDescription = `Laundry: ${laundryCart.map(i => `${i.qty}x ${i.name}`).join(', ')}`;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id), {
        "guest.charges": arrayUnion({
          description: chargeDescription,
          amount: total,
          date: new Date().toISOString(),
          type: 'laundry',
          items: laundryCart.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
          processedBy: 'Front Office'
        })
      });

      // Log laundry order for tracking (V1)
      const laundryId = `LAUNDRY-${Date.now()}`;
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'laundryOrders', laundryId), {
        id: laundryId,
        roomId: room.id,
        roomNumber: room.number,
        guestName: room.guest?.name,
        items: laundryCart,
        total,
        status: 'pending',
        createdAt: new Date().toISOString(),
        department: 'fo'
      });

      // Add V2 laundry charge to folio (NEW)
      if (isV2FolioEnabled()) {
        await v2WriteLaundryCharge(
          db,
          appId,
          room.id,
          chargeDescription,
          total,
          auth.currentUser?.uid || 'unknown',
          'Front Office'
        );
      }

      alert(`✓ Laundry order added to Room ${room.number}\nTotal: ${total.toLocaleString()} UGX`);
      onClose();
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6 bg-blue-600 text-white">
          <h3 className="text-xl font-bold">Laundry Services - {room.number}</h3>
          <p className="opacity-80">Guest: {room.guest?.name}</p>
        </div>
        <div className="p-6">
          <div className="mb-4">
            <h4 className="font-bold text-slate-700 mb-2">Available Services</h4>
            <div className="grid grid-cols-2 gap-2">
              {laundryServices.map(service => (
                <button
                  key={service.id}
                  onClick={() => addToLaundry(service)}
                  className="p-3 text-left bg-slate-50 hover:bg-blue-50 rounded-lg border hover:border-blue-300 transition-colors"
                >
                  <div className="font-medium text-sm">{service.name}</div>
                  <div className="text-xs text-slate-500">{service.price.toLocaleString()} UGX</div>
                </button>
              ))}
            </div>
          </div>

          {laundryCart.length > 0 && (
            <div className="mb-4">
              <h4 className="font-bold text-slate-700 mb-2">Selected Items</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {laundryCart.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                    <div>
                      <div className="font-medium text-sm">{item.name}</div>
                      <div className="text-xs text-slate-500">{item.price.toLocaleString()} × {item.qty}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(item.id, item.qty - 1)} className="w-8 h-8 bg-white rounded border text-lg font-bold">-</button>
                      <span className="w-8 text-center font-bold">{item.qty}</span>
                      <button onClick={() => updateQty(item.id, item.qty + 1)} className="w-8 h-8 bg-white rounded border text-lg font-bold">+</button>
                      <button onClick={() => removeFromLaundry(item.id)} className="text-red-500 ml-2"><X size={18} /></button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t pt-3 mt-3 flex justify-between font-bold text-lg">
                <span>Total:</span>
                <span className="text-blue-600">{total.toLocaleString()} UGX</span>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button variant="primary" className="flex-1" onClick={handleSubmit} disabled={laundryCart.length === 0 || isSubmitting}>
              {isSubmitting ? 'Processing...' : 'Add to Room Bill'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- POS System (Always Available - Staff Attribution Required) ---
const POSSystem = ({ menu, department, rooms, staffName, workPeriodOpen, workPeriod, activeFolio, onNavigateToDashboard }) => {
  // MODE: If activeFolio is present, we are in "Folio Mode" (Direct Server Sync)
  const isFolioMode = !!activeFolio;

  // Legacy Cart (Local Storage)
  const persistentCart = usePersistentCart(department?.id);
  // Folio Cart (Firestore)
  const folioCart = useFolioCart(db, appId, activeFolio?.id || activeFolio?.folioId, auth.currentUser?.uid, staffName, department);

  // Active Interface
  const cart = isFolioMode ? folioCart.cart : persistentCart.cart;
  // setCart is only for legacy. Folio updates via addToCart.
  const { setCart } = persistentCart;
  const clearCart = isFolioMode ? folioCart.clearCart : persistentCart.clearCart;

  const { queue, enqueue, dequeue } = useOfflineTxQueue();
  const { voidQueue, enqueueVoid, dequeueVoid } = useOfflineVoidQueue();
  const [selectedCat, setSelectedCat] = useState('Breakfast');
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [isAdding, setIsAdding] = useState(false);

  const categories = ['Breakfast', 'Soups', 'Starters', 'Main Course', 'Pizza & Pasta', 'African', 'Snacks', 'Desserts', 'Beers & Sodas', 'Spirits', 'Fresh Juices', 'Health Club', 'Pool'];
  const filteredItems = menu.filter(m => m.category === selectedCat);

  // Add to cart (NO work period blocking)
  // Add to cart (NO work period blocking)
  const addToCart = async (item) => {
    if (isFolioMode) {
      if (isAdding) return;
      setIsAdding(true);
      try {
        await folioCart.addToCart(item); // Async server write
      } catch (e) {
        alert("Failed to add item: " + e.message);
      } finally {
        setIsAdding(false);
      }
    } else {
      // Legacy Local Cart
      const ex = cart.find(i => i.id === item.id);
      if (ex) setCart(cart.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i));
      else setCart([...cart, { ...item, qty: 1 }]);
    }
  };

  // VOID ITEM - FIX #5 + AUDIT FIX: Append-only void logging with offline sync
  const voidItem = async (item) => {
    if (isFolioMode) {
      alert("Voiding items from Open Tickets is not yet supported. Please ask manager.");
      return;
    }
    if (!window.confirm(`Void ${item.qty}x ${item.name}? This will be logged for audit.`)) return;

    const voidId = `VOID-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const voidRecord = {
      id: voidId,
      item: item.name,
      itemId: item.id,
      qty: item.qty,
      price: item.price,
      total: item.price * item.qty,
      staff: staffName || 'Staff',
      department: department?.name,
      workPeriodId: workPeriod?.id || 'NO_PERIOD',
      date: new Date().toISOString(),
      reason: 'User voided from cart'
    };

    // STEP 1: Enqueue void locally FIRST (survives crash/offline)
    enqueueVoid(voidRecord);

    // STEP 2: Remove from cart immediately (UI feedback)
    setCart(cart.filter(i => i.id !== item.id));

    // STEP 3: Try Firestore write
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'voids', voidId), { ...voidRecord, synced: true });
      // STEP 4: Remove from queue only after successful sync
      dequeueVoid(voidId);
    } catch (e) {
      console.error("Void queued offline, will auto-sync:", e);
      // Void remains in queue - useOfflineVoidQueue will auto-retry
    }
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const vatRate = 0.18;
  const exclusiveAmount = Math.round(subtotal / (1 + vatRate));
  const vatAmount = subtotal - exclusiveAmount;
  const total = subtotal;

  const handlePaymentComplete = async ({ method, roomId, printInvoice }) => {
    if (isFolioMode) {
      // FOLIO MODE: Pay against existing server record
      try {
        await addPaymentToFolio(db, appId, {
          folioId: activeFolio.id || activeFolio.folioId,
          amount: total,
          method,
          staffId: auth.currentUser?.uid,
          staffName
        });
        // Success
        return;
        // Note: SettleModal calls onPrintComplete -> which calls onNavigateToDashboard.
        // We don't need to do anything else here implicitly?
        // SettleModal waits for this promise.
      } catch (e) {
        console.error("Payment failed", e);
        alert("Payment Failed");
        throw e; // Propagate to Modal
      }
    }

    // LEGACY MODE (Local Queue + Sync)
    // NO work period check - POS always available

    const txId = `TX-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const txPayload = {
      id: txId,
      items: [...cart],
      itemsCount: cart.reduce((sum, i) => sum + i.qty, 0),
      subtotal,
      vatAmount,
      total,
      method,
      // STAFF ATTRIBUTION - Use selected service staff
      staff: staffName || 'Staff',
      staffId: null,
      service_staff_id: selectedStaff?.id || 'unknown',
      service_staff_name: selectedStaff?.name || 'Unknown Staff',
      serviceCenter: selectedStaff?.center || department?.id,
      roomId,
      date: new Date().toISOString(),
      department: department?.name,
      workPeriodId: workPeriod?.id || 'NO_PERIOD', // For reporting only
      status: 'pending',
      // Audit trail
      auditTrail: [{
        action: 'created',
        by: selectedStaff?.name || staffName,
        at: new Date().toISOString(),
        details: `Order placed by ${selectedStaff?.name || 'Staff'} with ${cart.length} items`
      }]
    };

    // STEP 1: Persist to local queue BEFORE anything else (survives crash)
    enqueue(txPayload);

    try {
      // STEP 2: Write to Firestore (idempotent - same txId = same doc) (V1)
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sales', txId), { ...txPayload, status: 'confirmed', synced: true });

      // STEP 2b: Create V2 BAR Folio (NEW)
      if (isV2FolioEnabled()) {
        if (method === 'room' && roomId) {
          // If charged to room, add as line item to room's folio
          await v2WriteRoomCharge(
            db,
            appId,
            roomId,
            txPayload,
            auth.currentUser?.uid || 'unknown',
            staffName || 'Staff'
          );
        } else {
          // Cash/Card sale - create standalone BAR folio with invoice
          await v2WriteBarOrder(
            db,
            appId,
            txPayload,
            auth.currentUser?.uid || 'unknown',
            staffName || 'Staff',
            department?.id || 'general',
            null
          );
        }
      }

      // STEP 3: Only clear cart AFTER Firestore write succeeds
      clearCart();

      // STEP 4: Secondary writes (stock, room charges, performance updates)
      try {
        for (const item of txPayload.items) {
          if (item.type === 'bar') await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'menuItems', item.id), { stock_sold: increment(item.qty) });
        }
        if (method === 'room' && roomId) {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId), { "guest.charges": arrayUnion({ description: `POS: ${txPayload.items.map(i => i.name).join(', ')}`, amount: total, date: txPayload.date, staff: staffName }) });
        }

        // STEP 4b: Update staff shift metrics
        const currentUserId = auth.currentUser?.uid;
        if (currentUserId) {
          try {
            const shiftDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'staffShifts', currentUserId));
            if (shiftDoc.exists()) {
              await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'staffShifts', currentUserId), {
                ordersCount: increment(1),
                totalSales: increment(total),
                itemsSold: arrayUnion(...cart.map(i => ({ name: i.name, qty: i.qty, price: i.price, time: new Date().toISOString() })))
              });
            }
          } catch (shiftErr) {
            console.error("Shift metrics update error:", shiftErr);
          }

          // STEP 4c: Update monthly performance
          const currentMonth = new Date().toISOString().slice(0, 7);
          const perfDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'staffPerformance', `${currentUserId}_${currentMonth}`);
          try {
            await updateDoc(perfDocRef, {
              totalSales: increment(total),
              ordersCount: increment(1),
              itemsSold: increment(txPayload.itemsCount),
              lastUpdated: new Date().toISOString(),
            });
          } catch {
            // Document doesn't exist, create it
            await setDoc(perfDocRef, {
              staffId: currentUserId,
              staffName: staffName,
              serviceCenter: department?.id,
              month: currentMonth,
              totalSales: total,
              ordersCount: 1,
              itemsSold: txPayload.itemsCount,
              shiftsWorked: 1,
              createdAt: new Date().toISOString(),
              lastUpdated: new Date().toISOString(),
            });
          }
        }
      } catch (secondaryErr) {
        console.error("Secondary write failed:", secondaryErr);
      }

      // STEP 5: Remove from queue
      dequeue(txId);

    } catch (e) {
      console.error("Sale queued offline:", e);
      alert("Sale saved locally. Will sync when online.");
    }
  };

  return (
    <div className="flex h-full bg-slate-100 overflow-hidden">
      <div className="w-96 bg-white border-r flex flex-col shadow-lg z-10">
        <div className="p-4 bg-slate-50 border-b">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="font-bold text-slate-700">{isFolioMode ? (activeFolio?.ownerName || activeFolio?.folioNumber || 'Open Ticket') : 'Current Order'}</h2>
              {isFolioMode && activeFolio?.status === 'PART_PAID' && <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-bold">PART PAID</span>}
            </div>
            {isFolioMode && <div className="text-xs text-slate-400 font-mono">{activeFolio?.folioNumber}</div>}
          </div>
          <p className="text-sm text-blue-600 mb-2">{department?.name}</p>

          {/* Staff Selector Component */}
          <StaffSelector
            onStaffSelected={setSelectedStaff}
            currentDepartment={department}
          />

          {(queue.length > 0 || voidQueue.length > 0) && (
            <div className="text-xs text-amber-600 font-bold mt-1">
              <AlertTriangle size={12} className="inline mr-1" />
              {queue.length > 0 && `${queue.length} sales`}
              {queue.length > 0 && voidQueue.length > 0 && ', '}
              {voidQueue.length > 0 && `${voidQueue.length} voids`}
              {' pending sync'}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {cart.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-slate-300"><Coffee size={48} className="mb-2" /><p>No items</p></div> : cart.map(item => (
            <div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border">
              <div><div className="font-medium">{item.name}</div><div className="text-xs text-slate-500">{item.price.toLocaleString()} x {item.qty}</div></div>
              <div className="flex items-center gap-2">
                <div className="font-bold">{(item.price * item.qty).toLocaleString()}</div>
                <button onClick={() => voidItem(item)} className="text-red-400 hover:text-red-600 bg-red-50 p-1.5 rounded" title="Void (logged)"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 bg-white border-t">
          <div className="space-y-1 mb-4 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-medium">{subtotal.toLocaleString()} UGX</span></div>
            <div className="flex justify-between"><span className="text-slate-500">VAT (18%)</span><span className="font-medium">{vatAmount.toLocaleString()} UGX</span></div>
            <div className="flex justify-between items-end pt-2 border-t"><span className="text-slate-700 font-bold">Total</span><span className="text-2xl font-bold">{total.toLocaleString()} <span className="text-sm font-normal text-slate-400">UGX</span></span></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="danger" onClick={() => { if (window.confirm("Cancel order?")) clearCart(); }} disabled={cart.length === 0}>Cancel</Button>
            <Button variant="success" onClick={() => setSettleModalOpen(true)} disabled={cart.length === 0}>Settle</Button>
          </div>
        </div>
      </div>
      <div className="w-48 bg-slate-800 flex flex-col overflow-y-auto shrink-0">{categories.map(cat => <button key={cat} onClick={() => setSelectedCat(cat)} className={`p-4 text-left border-b border-slate-700 ${selectedCat === cat ? 'bg-blue-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-700'}`}>{cat}</button>)}</div>
      <div className="flex-1 p-4 overflow-y-auto"><div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">{filteredItems.map(item => <button key={item.id} onClick={() => addToCart(item)} disabled={isAdding} className="bg-white p-4 rounded-xl shadow-sm hover:shadow-lg active:scale-95 border flex flex-col justify-between h-32 text-left group disabled:opacity-50 disabled:scale-100 disabled:cursor-wait"><span className="font-bold text-slate-700 group-hover:text-blue-600">{item.name}</span><span className="font-mono text-slate-500 text-sm bg-slate-50 px-2 py-1 rounded w-fit">{isAdding ? 'Adding...' : item.price.toLocaleString()}</span></button>)}</div></div>
      {settleModalOpen && <SettleModal cart={cart} subtotal={subtotal} vatAmount={vatAmount} total={total} onClose={() => setSettleModalOpen(false)} onPaid={handlePaymentComplete} rooms={rooms} department={department} staffName={staffName} onPrintComplete={() => { clearCart(); setSettleModalOpen(false); if (onNavigateToDashboard) onNavigateToDashboard(); }} />}
    </div>
  );
};

// --- Hotel Info for Invoices ---
const HOTEL_INFO = {
  name: 'Source Garden Hotel',
  address: 'Jinja, Uganda',
  phone: '+256 XXX XXX XXX',
  email: 'info@sourcegarden.ug',
  website: 'www.sourcegarden.ug',
  tin: 'TIN: XXXXXXXXXX',
  motto: 'Your Home Away From Home'
};

// --- Settle Modal with VAT & Invoice ---
const SettleModal = ({ cart, subtotal, vatAmount, total, onClose, onPaid, rooms, department, staffName, onPrintComplete }) => {
  const [method, setMethod] = useState('cash');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);
  const occupiedRooms = rooms?.filter(r => r.status === 'occupied') || [];

  const handlePay = () => {
    if (method === 'room' && !selectedRoom) { alert("Select a room"); return; }

    const txId = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    const guestName = method === 'room' ? occupiedRooms.find(r => r.id === selectedRoom)?.guest?.name : null;

    // Create invoice data
    const invoice = {
      invoiceNo: txId,
      date: new Date(),
      items: cart,
      subtotal, // This is the exclusive amount passed from parent
      vatAmount,
      total,
      paymentMethod: method === 'momo' ? 'Mobile Money' : method.charAt(0).toUpperCase() + method.slice(1),
      department: department?.name || 'POS',
      staffName: staffName || 'Staff',
      guestName,
      roomNumber: method === 'room' ? occupiedRooms.find(r => r.id === selectedRoom)?.number : null
    };

    setInvoiceData(invoice);
    onPaid({ method, roomId: selectedRoom });
    setShowInvoice(true);
  };

  const handlePrint = () => {
    const onAfterPrint = () => {
      window.removeEventListener('afterprint', onAfterPrint);
      if (onPrintComplete) onPrintComplete();
      else handleClose();
    };
    window.addEventListener('afterprint', onAfterPrint);
    window.print();
  };

  const handleClose = () => {
    setShowInvoice(false);
    setInvoiceData(null);
    onClose();
  };

  // Show Invoice after payment
  if (showInvoice && invoiceData) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
          {/* Print-only Invoice */}
          <div className="print:block hidden">
            <PrintableInvoice invoice={invoiceData} />
          </div>

          {/* Screen Invoice Preview */}
          <div className="print:hidden">
            <div className="p-6 bg-emerald-600 text-white text-center">
              <Check size={48} className="mx-auto mb-2" />
              <h3 className="text-xl font-bold">Payment Complete!</h3>
            </div>
            <div className="p-6 max-h-[60vh] overflow-auto">
              <InvoicePreview invoice={invoiceData} />
            </div>
            <div className="p-4 bg-slate-50 border-t flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={handleClose}>Close</Button>
              <Button variant="primary" className="flex-1 flex items-center justify-center gap-2" onClick={handlePrint}>
                <Printer size={18} /> Print Invoice
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6 bg-slate-900 text-white">
          <h3 className="text-xl font-bold">Settle Payment</h3>
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between text-slate-300"><span>Subtotal</span><span>{subtotal.toLocaleString()} UGX</span></div>
            <div className="flex justify-between text-slate-300"><span>VAT (18%)</span><span>{vatAmount.toLocaleString()} UGX</span></div>
            <div className="flex justify-between text-white font-bold text-xl pt-2 border-t border-slate-700"><span>Total</span><span>{total.toLocaleString()} UGX</span></div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {['cash', 'momo', 'card', 'room'].map(m => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`p-4 rounded-xl border-2 font-bold uppercase ${method === m ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-600'}`}
              >
                {m === 'momo' ? 'Mobile Money' : m}
              </button>
            ))}
          </div>

          {method === 'room' && (
            <div>
              <label className="block text-sm font-medium mb-2">Select Room</label>
              {occupiedRooms.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                  <AlertTriangle size={16} className="inline mr-2" />
                  No rooms currently occupied. Check in a guest first via Front Office.
                </div>
              ) : (
                <select
                  className="w-full p-3 border rounded-lg"
                  value={selectedRoom || ''}
                  onChange={e => setSelectedRoom(e.target.value)}
                >
                  <option value="">-- Select Room ({occupiedRooms.length} occupied) --</option>
                  {occupiedRooms.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.number} - {r.guest?.name || 'Guest'}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="flex gap-4 mt-6">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button
              variant="success"
              className="flex-1"
              onClick={handlePay}
              disabled={method === 'room' && (occupiedRooms.length === 0 || !selectedRoom)}
            >
              Complete & Print
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Invoice Preview (Screen) ---
const InvoicePreview = ({ invoice }) => (
  <div className="text-sm">
    <div className="text-center mb-4 pb-4 border-b">
      <h2 className="text-xl font-bold text-slate-800">{HOTEL_INFO.name}</h2>
      <p className="text-slate-500">{HOTEL_INFO.address}</p>
      <p className="text-slate-500">{HOTEL_INFO.phone}</p>
    </div>

    <div className="flex justify-between mb-4 text-slate-600">
      <div><strong>Invoice:</strong> {invoice.invoiceNo}</div>
      <div><strong>Date:</strong> {invoice.date.toLocaleDateString()}</div>
    </div>

    {invoice.guestName && (
      <div className="mb-4 p-2 bg-slate-50 rounded">
        <strong>Guest:</strong> {invoice.guestName} {invoice.roomNumber && `(Room ${invoice.roomNumber})`}
      </div>
    )}

    <table className="w-full mb-4">
      <thead className="border-b">
        <tr className="text-left text-slate-500">
          <th className="pb-2">Item</th>
          <th className="pb-2 text-center">Qty</th>
          <th className="pb-2 text-right">Price</th>
          <th className="pb-2 text-right">Amount</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {invoice.items.map((item, i) => (
          <tr key={i}>
            <td className="py-2">{item.name}</td>
            <td className="py-2 text-center">{item.qty}</td>
            <td className="py-2 text-right">{item.price.toLocaleString()}</td>
            <td className="py-2 text-right">{(item.price * item.qty).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>

    <div className="border-t pt-3 space-y-1">
      <div className="flex justify-between"><span>Subtotal</span><span>{invoice.subtotal.toLocaleString()} UGX</span></div>
      <div className="flex justify-between text-slate-600"><span>VAT (18%)</span><span>{invoice.vatAmount.toLocaleString()} UGX</span></div>
      <div className="flex justify-between font-bold text-lg pt-2 border-t"><span>TOTAL</span><span>{invoice.total.toLocaleString()} UGX</span></div>
    </div>

    <div className="mt-4 pt-4 border-t text-center text-slate-500 text-xs">
      <p>Payment: {invoice.paymentMethod}</p>
      <p>Served by: {invoice.staffName} | {invoice.department}</p>
      <p className="mt-2">{HOTEL_INFO.tin}</p>
      <p className="mt-2 italic">{HOTEL_INFO.motto}</p>
    </div>
  </div>
);

// --- Printable Invoice (Print only) ---
const PrintableInvoice = ({ invoice }) => (
  <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', maxWidth: '300px', margin: '0 auto' }}>
    <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #000', paddingBottom: '15px' }}>
      <h1 style={{ fontSize: '18px', margin: '0 0 5px 0', fontWeight: 'bold' }}>{HOTEL_INFO.name}</h1>
      <p style={{ margin: '2px 0', fontSize: '12px' }}>{HOTEL_INFO.address}</p>
      <p style={{ margin: '2px 0', fontSize: '12px' }}>{HOTEL_INFO.phone}</p>
      <p style={{ margin: '2px 0', fontSize: '12px' }}>{HOTEL_INFO.email}</p>
    </div>

    <div style={{ marginBottom: '15px', fontSize: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span><strong>Invoice #:</strong> {invoice.invoiceNo}</span>
      </div>
      <div><strong>Date:</strong> {invoice.date.toLocaleString()}</div>
      {invoice.guestName && <div><strong>Guest:</strong> {invoice.guestName}</div>}
      {invoice.roomNumber && <div><strong>Room:</strong> {invoice.roomNumber}</div>}
    </div>

    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px', fontSize: '12px' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid #000' }}>
          <th style={{ textAlign: 'left', padding: '5px 0' }}>Item</th>
          <th style={{ textAlign: 'center', padding: '5px 0' }}>Qty</th>
          <th style={{ textAlign: 'right', padding: '5px 0' }}>Amt</th>
        </tr>
      </thead>
      <tbody>
        {invoice.items.map((item, i) => (
          <tr key={i} style={{ borderBottom: '1px dotted #ccc' }}>
            <td style={{ padding: '5px 0' }}>{item.name}</td>
            <td style={{ textAlign: 'center', padding: '5px 0' }}>{item.qty}</td>
            <td style={{ textAlign: 'right', padding: '5px 0' }}>{(item.price * item.qty).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>

    <div style={{ borderTop: '1px solid #000', paddingTop: '10px', fontSize: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
        <span>Net Amount:</span><span>{invoice.subtotal.toLocaleString()} UGX</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
        <span>VAT (18%):</span><span>{invoice.vatAmount.toLocaleString()} UGX</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', borderTop: '1px solid #000', paddingTop: '5px', marginTop: '5px' }}>
        <span>TOTAL:</span><span>{invoice.total.toLocaleString()} UGX</span>
      </div>
    </div>

    <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px dashed #000', textAlign: 'center', fontSize: '10px' }}>
      <p style={{ margin: '3px 0' }}>Payment Method: {invoice.paymentMethod}</p>
      <p style={{ margin: '3px 0' }}>Served by: {invoice.staffName}</p>
      <p style={{ margin: '3px 0' }}>{invoice.department}</p>
      <p style={{ margin: '10px 0 3px 0' }}>{HOTEL_INFO.tin}</p>
      <p style={{ margin: '10px 0', fontStyle: 'italic' }}>"{HOTEL_INFO.motto}"</p>
      <p style={{ margin: '10px 0' }}>Thank you for dining with us!</p>
    </div>
  </div>
);

// --- Stock Sheet ---
const StockSheet = ({ menu }) => {
  const barItems = menu.filter(m => m.type === 'bar');
  const [localEdits, setLocalEdits] = useState({});
  const debounceTimers = React.useRef({});

  const updateStock = (itemId, field, val) => {
    const key = `${itemId}_${field}`;
    const numVal = parseInt(val) || 0;

    setLocalEdits(prev => ({ ...prev, [key]: numVal }));

    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);
    debounceTimers.current[key] = setTimeout(async () => {
      try {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'menuItems', itemId), { [field]: numVal });
        setLocalEdits(prev => { const next = { ...prev }; delete next[key]; return next; });
      } catch (e) {
        console.error("Stock update failed:", e);
        alert(`Failed to save ${field} for item. Will retry.`);
      }
    }, 500);
  };

  const getStockValue = (item, field) => {
    const key = `${item.id}_${field}`;
    return localEdits[key] !== undefined ? localEdits[key] : (item[field] || 0);
  };

  // Calculate grand total of all sold items
  const grandTotal = barItems.reduce((sum, item) => {
    const sold = item.stock_sold || 0;
    return sum + (sold * item.price);
  }, 0);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="bg-white border-b px-8 py-6 shadow-sm flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-3"><ClipboardList className="text-amber-600" /> Bar Stock Sheet</h2>
        <div className="text-right">
          <p className="text-xs text-slate-500 uppercase font-bold">Total Sales Value</p>
          <p className="text-2xl font-bold text-emerald-600">{grandTotal.toLocaleString()} UGX</p>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-8">
        <div className="bg-white rounded-xl shadow border overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-100 text-slate-600 uppercase text-xs font-bold">
              <tr>
                <th className="p-4 border-b">Item</th>
                <th className="p-4 border-b text-center">Price</th>
                <th className="p-4 border-b text-center">Opening</th>
                <th className="p-4 border-b text-center">Added</th>
                <th className="p-4 border-b text-center">Total</th>
                <th className="p-4 border-b text-center">Sold</th>
                <th className="p-4 border-b text-center">Closing</th>
                <th className="p-4 border-b text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {barItems.map(item => {
                const open = getStockValue(item, 'stock_open');
                const added = getStockValue(item, 'stock_added');
                const sold = item.stock_sold || 0;
                const closing = open + added - sold;
                const amount = sold * item.price;

                return (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="p-4 font-medium border-r">{item.name}</td>
                    <td className="p-4 text-center text-slate-500 text-sm">{item.price.toLocaleString()}</td>
                    <td className="p-4 text-center">
                      <input type="number" className="w-20 text-center border rounded" value={open} onChange={e => updateStock(item.id, 'stock_open', e.target.value)} />
                    </td>
                    <td className="p-4 text-center">
                      <input type="number" className="w-20 text-center border rounded font-bold text-green-700" value={added} onChange={e => updateStock(item.id, 'stock_added', e.target.value)} />
                    </td>
                    <td className="p-4 text-center font-bold">{open + added}</td>
                    <td className="p-4 text-center text-red-600 font-bold">-{sold}</td>
                    <td className={`p-4 text-center font-bold ${closing < 5 ? 'text-red-600 bg-red-50' : ''}`}>{closing}</td>
                    <td className="p-4 text-right font-mono font-bold text-emerald-600">{amount.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-800 text-white">
              <tr>
                <td colSpan="7" className="p-4 text-right font-bold uppercase">Grand Total</td>
                <td className="p-4 text-right font-mono font-bold text-xl">{grandTotal.toLocaleString()} UGX</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

// --- Void Reports ---
const VoidReports = () => {
  const [logs, setLogs] = useState([]);
  useEffect(() => { const unsub = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'voids'), orderBy('date', 'desc')), snap => setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })))); return unsub; }, []);
  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="bg-white border-b px-8 py-6 shadow-sm"><h2 className="text-2xl font-bold flex items-center gap-3"><FileWarning className="text-red-600" /> Void Reports</h2></div>
      <div className="flex-1 overflow-auto p-8">
        <div className="bg-white rounded-xl shadow border">
          <table className="w-full text-left text-sm"><thead className="bg-slate-100 text-slate-600 font-bold"><tr><th className="p-4">Time</th><th className="p-4">Item</th><th className="p-4">Qty</th><th className="p-4">Value</th><th className="p-4">Staff</th></tr></thead>
            <tbody className="divide-y">{logs.map(log => <tr key={log.id}><td className="p-4 text-slate-500">{new Date(log.date).toLocaleString()}</td><td className="p-4 font-bold">{log.item}</td><td className="p-4">{log.qty}</td><td className="p-4 text-red-600">{(log.price * log.qty).toLocaleString()}</td><td className="p-4">{log.staff}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// --- Daily Report ---
const DailyReport = ({ rooms }) => {
  const [sales, setSales] = useState([]);
  const [payments, setPayments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  useEffect(() => {
    const today = new Date().toLocaleDateString();
    const unsubSales = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'sales'), orderBy('date', 'desc')), snap => setSales(snap.docs.map(d => d.data()).filter(d => new Date(d.date).toLocaleDateString() === today)));
    const unsubPayments = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'payments'), orderBy('date', 'desc')), snap => setPayments(snap.docs.map(d => d.data()).filter(d => new Date(d.date).toLocaleDateString() === today)));
    const unsubExpenses = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'expenses'), orderBy('date', 'desc')), snap => setExpenses(snap.docs.map(d => d.data()).filter(d => new Date(d.date).toLocaleDateString() === today)));
    return () => { unsubSales(); unsubPayments(); unsubExpenses(); };
  }, []);
  const cashCollected = { pos: sales.filter(s => s.method !== 'room').reduce((a, c) => a + c.total, 0), rooms: payments.reduce((a, c) => a + c.amount, 0) };
  const totalExpenses = expenses.reduce((a, c) => a + c.amount, 0);
  const netCash = cashCollected.pos + cashCollected.rooms - totalExpenses;
  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="bg-white border-b px-8 py-6 shadow-sm flex justify-between items-center">
        <div><h2 className="text-2xl font-bold flex items-center gap-3"><PieChart className="text-emerald-600" /> Daily Report</h2><p className="text-slate-500 text-sm">{new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p></div>
        <div className="text-right"><p className="text-xs text-slate-400 uppercase font-bold">Net Cash</p><p className="text-3xl font-bold text-emerald-600">{netCash.toLocaleString()} UGX</p></div>
      </div>
      <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-y-auto">
        <div className="bg-white p-6 rounded-xl shadow-sm border"><h3 className="font-bold mb-4 flex items-center gap-2"><DollarSign size={18} /> Cash Flow</h3>
          <div className="space-y-3">
            <div className="flex justify-between p-3 bg-emerald-50 text-emerald-900 rounded-lg"><span>POS Collected</span><span className="font-bold">{cashCollected.pos.toLocaleString()}</span></div>
            <div className="flex justify-between p-3 bg-emerald-50 text-emerald-900 rounded-lg"><span>Room Payments</span><span className="font-bold">{cashCollected.rooms.toLocaleString()}</span></div>
            <div className="flex justify-between p-3 bg-red-50 text-red-900 rounded-lg"><span>Expenses</span><span className="font-bold">-{totalExpenses.toLocaleString()}</span></div>
            <div className="border-t pt-2 flex justify-between font-bold text-lg"><span>Net Cash</span><span>{netCash.toLocaleString()}</span></div>
          </div>
        </div>
        <div className="md:col-span-2 bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-4 bg-slate-50 border-b font-bold">Today's Transactions</div>
          <table className="w-full text-left text-sm"><thead className="bg-slate-100 text-slate-500"><tr><th className="p-3">Time</th><th className="p-3">Type</th><th className="p-3">Details</th><th className="p-3 text-right">Amount</th></tr></thead>
            <tbody className="divide-y">{[...sales.map(s => ({ ...s, type: 'POS Sale' })), ...payments.map(p => ({ ...p, type: 'Room Payment' })), ...expenses.map(e => ({ ...e, type: 'Expense', total: -e.amount }))].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10).map((t, i) => <tr key={i}><td className="p-3 text-slate-400">{new Date(t.date).toLocaleTimeString()}</td><td className={`p-3 font-medium ${t.type === 'Expense' ? 'text-red-600' : ''}`}>{t.type}</td><td className="p-3 text-slate-600">{t.staff || t.description || `Room ${t.roomNumber}`}</td><td className={`p-3 text-right font-mono font-bold ${t.type === 'Expense' ? 'text-red-600' : 'text-emerald-600'}`}>{(t.total || t.amount).toLocaleString()}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// --- Expenses Module ---
const EXPENSE_CATEGORIES = [
  'Food & Beverages', 'Utilities', 'Maintenance & Repairs', 'Cleaning Supplies',
  'Office Supplies', 'Fuel & Transport', 'Staff Welfare', 'Marketing',
  'Equipment', 'Rent', 'Licenses & Permits', 'Security', 'Laundry',
  'Guest Amenities', 'Miscellaneous'
];
const PAYMENT_METHODS = ['Cash', 'Mobile Money', 'Bank Transfer', 'Cheque', 'Credit'];
const EXPENSE_DEPARTMENTS = ['Front Office', 'Bar - River', 'Bar - Poolside', 'Kitchen', 'Housekeeping', 'Admin', 'Maintenance', 'Security'];

const ExpensesModule = ({ staffName }) => {
  const [expenses, setExpenses] = useState([]);
  const [pendingExpenses, setPendingExpenses] = useState(() => {
    try { const saved = localStorage.getItem('sourcegarden_pending_expenses'); return saved ? JSON.parse(saved) : []; } catch { return []; }
  });
  const [showForm, setShowForm] = useState(false);

  // Form fields
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplier, setSupplier] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [reference, setReference] = useState('');
  const [department, setDepartment] = useState('');
  const [notes, setNotes] = useState('');

  // Calculated total
  const totalAmount = (parseFloat(quantity) || 0) * (parseFloat(unitCost) || 0);

  useEffect(() => { localStorage.setItem('sourcegarden_pending_expenses', JSON.stringify(pendingExpenses)); }, [pendingExpenses]);

  useEffect(() => { const unsub = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'expenses'), orderBy('date', 'desc')), snap => setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })))); return unsub; }, []);

  useEffect(() => {
    const syncPending = async () => {
      for (const exp of pendingExpenses) {
        try {
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'expenses', exp.id), { ...exp, synced: true });
          setPendingExpenses(prev => prev.filter(e => e.id !== exp.id));
        } catch (e) { break; }
      }
    };
    syncPending();
    window.addEventListener('online', syncPending);
    return () => window.removeEventListener('online', syncPending);
  }, [pendingExpenses]);

  const resetForm = () => {
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setSupplier('');
    setCategory('');
    setDescription('');
    setQuantity('1');
    setUnitCost('');
    setPaymentMethod('Cash');
    setReference('');
    setDepartment('');
    setNotes('');
    setShowForm(false);
  };

  const handleAdd = async () => {
    if (!supplier || !category || !description || !unitCost || !department) {
      alert('Please fill in all required fields: Supplier, Category, Description, Unit Cost, and Department');
      return;
    }

    const expenseId = `EXP-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const expenseData = {
      id: expenseId,
      date: new Date(expenseDate).toISOString(),
      supplier,
      category,
      description,
      quantity: parseFloat(quantity) || 1,
      unitCost: parseFloat(unitCost) || 0,
      amount: totalAmount,
      paymentMethod,
      reference: reference || null,
      department,
      recordedBy: staffName || 'Admin',
      notes: notes || null,
      createdAt: new Date().toISOString()
    };

    setPendingExpenses(prev => [...prev, expenseData]);
    resetForm();

    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'expenses', expenseId), { ...expenseData, synced: true });
      setPendingExpenses(prev => prev.filter(e => e.id !== expenseId));
    } catch (e) {
      console.error("Expense queued offline:", e);
      alert("Expense saved locally. Will sync when online.");
    }
  };

  const [selectedExpense, setSelectedExpense] = useState(null);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="bg-white border-b px-8 py-6 shadow-sm flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-3"><TrendingDown className="text-rose-600" /> Expenses Log</h2>
        <Button variant="danger" onClick={() => setShowForm(true)}>+ Record New Expense</Button>
      </div>

      <div className="p-8 flex-1 overflow-auto">
        {pendingExpenses.length > 0 && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
            ⏳ {pendingExpenses.length} expense(s) pending sync...
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600 font-bold">
              <tr>
                <th className="p-4">Date</th>
                <th className="p-4">Supplier</th>
                <th className="p-4">Category</th>
                <th className="p-4">Description</th>
                <th className="p-4">Department</th>
                <th className="p-4">Payment</th>
                <th className="p-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {expenses.map(ex => (
                <tr key={ex.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedExpense(ex)}>
                  <td className="p-4 text-slate-500">{new Date(ex.date).toLocaleDateString()}</td>
                  <td className="p-4 font-medium">{ex.supplier || '-'}</td>
                  <td className="p-4"><span className="bg-slate-200 px-2 py-1 rounded text-xs">{ex.category || 'N/A'}</span></td>
                  <td className="p-4 text-slate-600">{ex.description}</td>
                  <td className="p-4 text-slate-500">{ex.department || '-'}</td>
                  <td className="p-4 text-slate-500">{ex.paymentMethod || 'Cash'}</td>
                  <td className="p-4 text-right font-mono font-bold text-rose-600">-{(ex.amount || 0).toLocaleString()}</td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr><td colSpan="7" className="p-8 text-center text-slate-400">No expenses recorded yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record New Expense Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="bg-rose-600 text-white px-6 py-4 rounded-t-2xl">
              <h3 className="text-xl font-bold">Record New Expense</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                  <input
                    type="date"
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                    value={expenseDate}
                    onChange={e => setExpenseDate(e.target.value)}
                  />
                </div>

                {/* Supplier / Payee */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Supplier / Payee *</label>
                  <input
                    type="text"
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                    placeholder="e.g., Kampala Suppliers Ltd"
                    value={supplier}
                    onChange={e => setSupplier(e.target.value)}
                  />
                </div>

                {/* Expense Category */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Expense Category *</label>
                  <select
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                  >
                    <option value="">Select Category</option>
                    {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>

                {/* Department / Outlet */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Department / Outlet *</label>
                  <select
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white"
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                  >
                    <option value="">Select Department</option>
                    {EXPENSE_DEPARTMENTS.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                  </select>
                </div>
              </div>

              {/* Item Description - Full Width */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Item Description *</label>
                <input
                  type="text"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  placeholder="e.g., 50kg Rice for kitchen"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                {/* Quantity */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                    placeholder="1"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                  />
                </div>

                {/* Unit Cost */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Unit Cost (UGX) *</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                    placeholder="0"
                    value={unitCost}
                    onChange={e => setUnitCost(e.target.value)}
                  />
                </div>

                {/* Total Amount - Calculated */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Total Amount</label>
                  <div className="w-full p-3 bg-slate-100 border rounded-lg font-mono font-bold text-rose-600">
                    {totalAmount.toLocaleString()} UGX
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Payment Method */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
                  <select
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white"
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                  >
                    {PAYMENT_METHODS.map(method => <option key={method} value={method}>{method}</option>)}
                  </select>
                </div>

                {/* Reference / Receipt / Transaction ID */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Reference / Receipt / Transaction ID</label>
                  <input
                    type="text"
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                    placeholder="e.g., RCP-001234 or MM-TXN-789"
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                  />
                </div>
              </div>

              {/* Recorded By - Auto-filled */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Recorded By</label>
                <div className="w-full p-3 bg-slate-100 border rounded-lg text-slate-600">
                  {staffName || 'Admin'}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 resize-none"
                  rows="2"
                  placeholder="Any additional notes or remarks..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="border-t px-6 py-4 bg-slate-50 rounded-b-2xl flex justify-end gap-3">
              <Button variant="secondary" onClick={resetForm}>Cancel</Button>
              <Button variant="danger" onClick={handleAdd} disabled={!supplier || !category || !description || !unitCost || !department}>
                Record Expense
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Expense Detail Modal */}
      {selectedExpense && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedExpense(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="bg-slate-800 text-white px-6 py-4 rounded-t-2xl flex justify-between items-center">
              <h3 className="text-xl font-bold">Expense Details</h3>
              <button onClick={() => setSelectedExpense(null)} className="text-white/70 hover:text-white">✕</button>
            </div>
            <div className="p-6 space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b"><span className="text-slate-500">Date</span><span className="font-medium">{new Date(selectedExpense.date).toLocaleDateString()}</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-slate-500">Supplier / Payee</span><span className="font-medium">{selectedExpense.supplier || '-'}</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-slate-500">Category</span><span className="font-medium">{selectedExpense.category || 'N/A'}</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-slate-500">Description</span><span className="font-medium">{selectedExpense.description}</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-slate-500">Quantity</span><span className="font-medium">{selectedExpense.quantity || 1}</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-slate-500">Unit Cost</span><span className="font-medium">{(selectedExpense.unitCost || selectedExpense.amount || 0).toLocaleString()} UGX</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-slate-500">Total Amount</span><span className="font-mono font-bold text-rose-600">{(selectedExpense.amount || 0).toLocaleString()} UGX</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-slate-500">Payment Method</span><span className="font-medium">{selectedExpense.paymentMethod || 'Cash'}</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-slate-500">Reference</span><span className="font-medium">{selectedExpense.reference || '-'}</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-slate-500">Department</span><span className="font-medium">{selectedExpense.department || '-'}</span></div>
              <div className="flex justify-between py-2 border-b"><span className="text-slate-500">Recorded By</span><span className="font-medium">{selectedExpense.recordedBy || selectedExpense.staff || 'Admin'}</span></div>
              {selectedExpense.notes && <div className="py-2"><span className="text-slate-500 block mb-1">Notes</span><span className="text-slate-700">{selectedExpense.notes}</span></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- WORK PERIOD RESTRICTIONS REMOVED ---
// ShiftControl component has been removed as part of the "Always Open" mode implementation.
// The system now operates continuously without shift-based restrictions.
// Staff logins provide attribution and security without blocking POS operations.
// For cash reconciliation, users can rely on the Finance Dashboard and Daily Reports.

// --- Bookings Calendar (with Events) ---
const BookingsCalendar = ({ rooms }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [events, setEvents] = useState([]);
  const [viewMode, setViewMode] = useState('all'); // 'all', 'rooms', 'events'

  // Load events from Firestore
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'artifacts', appId, 'public', 'data', 'events'), orderBy('eventDate', 'asc')),
      snap => setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('Events load error:', err)
    );
    return unsub;
  }, []);

  // Get all active bookings from occupied rooms
  const bookings = rooms
    .filter(r => r.status === 'occupied' && r.guest)
    .map(r => ({
      type: 'room',
      roomId: r.id,
      roomNumber: r.number,
      roomType: r.type,
      guestName: r.guest.name,
      guestPhone: r.guest.phone,
      checkIn: new Date(r.guest.checkIn),
      checkOut: new Date(r.guest.checkOut),
      nights: r.guest.nights,
      adults: r.guest.adults,
      children: r.guest.children
    }));

  // Generate calendar days
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  };

  const days = getDaysInMonth(currentMonth);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Get bookings for a specific date
  const getBookingsForDate = (date) => {
    if (!date) return [];
    const targetDate = new Date(date).setHours(0, 0, 0, 0);
    return bookings.filter(b => {
      const checkIn = new Date(b.checkIn).setHours(0, 0, 0, 0);
      const checkOut = new Date(b.checkOut).setHours(0, 0, 0, 0);
      return targetDate >= checkIn && targetDate < checkOut;
    });
  };

  // Get events for a specific date
  const getEventsForDate = (date) => {
    if (!date) return [];
    const targetDateStr = date.toISOString().split('T')[0];
    return events.filter(e => e.eventDate === targetDateStr && e.status !== 'Cancelled');
  };

  // Get all items for a date based on view mode
  const getItemsForDate = (date) => {
    if (!date) return { bookings: [], events: [] };
    const dateBookings = viewMode === 'events' ? [] : getBookingsForDate(date);
    const dateEvents = viewMode === 'rooms' ? [] : getEventsForDate(date);
    return { bookings: dateBookings, events: dateEvents };
  };

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  const goToToday = () => setCurrentMonth(new Date());

  const isToday = (date) => date && new Date().toDateString() === date.toDateString();

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="bg-white border-b px-8 py-6 shadow-sm flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3"><Calendar className="text-indigo-600" /> Bookings & Events Calendar</h2>
          <p className="text-slate-500 text-sm mt-1">View all room reservations and events</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button onClick={() => setViewMode('all')} className={`px-3 py-1 rounded text-sm font-medium ${viewMode === 'all' ? 'bg-white shadow' : ''}`}>All</button>
            <button onClick={() => setViewMode('rooms')} className={`px-3 py-1 rounded text-sm font-medium ${viewMode === 'rooms' ? 'bg-white shadow' : ''}`}>Rooms</button>
            <button onClick={() => setViewMode('events')} className={`px-3 py-1 rounded text-sm font-medium ${viewMode === 'events' ? 'bg-white shadow' : ''}`}>Events</button>
          </div>
          <button onClick={goToToday} className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg font-medium hover:bg-indigo-200">Today</button>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white border-b px-8 py-2 flex gap-6 text-sm">
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-emerald-500"></div> Room Booking</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-purple-500"></div> Event</div>
      </div>

      <div className="p-8 flex-1 overflow-auto">
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden max-w-5xl mx-auto">
          {/* Month Navigation */}
          <div className="flex items-center justify-between p-4 bg-indigo-600 text-white">
            <button onClick={prevMonth} className="p-2 hover:bg-indigo-700 rounded-lg">←</button>
            <h3 className="text-xl font-bold">{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</h3>
            <button onClick={nextMonth} className="p-2 hover:bg-indigo-700 rounded-lg">→</button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7">
            {/* Day Headers */}
            {dayNames.map(day => (
              <div key={day} className="p-3 text-center font-bold text-slate-600 bg-slate-100 border-b">{day}</div>
            ))}

            {/* Calendar Days */}
            {days.map((day, idx) => {
              const { bookings: dayBookings, events: dayEvents } = getItemsForDate(day ? new Date(day) : null);
              const totalItems = dayBookings.length + dayEvents.length;
              return (
                <div
                  key={idx}
                  className={`min-h-[100px] p-2 border-b border-r ${day ? 'hover:bg-slate-50 cursor-pointer' : 'bg-slate-50'} ${isToday(day) ? 'bg-indigo-50' : ''}`}
                  onClick={() => day && setSelectedDate(day)}
                >
                  {day && (
                    <>
                      <div className={`text-sm font-medium ${isToday(day) ? 'bg-indigo-600 text-white w-7 h-7 rounded-full flex items-center justify-center' : 'text-slate-600'}`}>
                        {day.getDate()}
                      </div>
                      <div className="mt-1 space-y-1">
                        {/* Show events first */}
                        {dayEvents.slice(0, 2).map((e, i) => (
                          <div key={`evt-${i}`} className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded truncate" title={e.eventName}>
                            🎉 {e.eventName}
                          </div>
                        ))}
                        {/* Then room bookings */}
                        {dayBookings.slice(0, 2 - Math.min(dayEvents.length, 2)).map((b, i) => (
                          <div key={`rm-${i}`} className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded truncate" title={`${b.guestName} - Room ${b.roomNumber}`}>
                            🛏 {b.roomNumber}: {b.guestName?.split(' ')[0]}
                          </div>
                        ))}
                        {totalItems > 2 && (
                          <div className="text-xs text-slate-500">+{totalItems - 2} more</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bookings Summary */}
        <div className="mt-6 bg-white rounded-xl shadow-sm border p-6 max-w-5xl mx-auto">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><BedDouble size={20} className="text-indigo-600" /> Current Reservations ({bookings.length})</h3>
          {bookings.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No active reservations</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-3 text-left">Room</th>
                    <th className="p-3 text-left">Guest</th>
                    <th className="p-3 text-left">Phone</th>
                    <th className="p-3 text-left">Check-In</th>
                    <th className="p-3 text-left">Check-Out</th>
                    <th className="p-3 text-center">Nights</th>
                    <th className="p-3 text-center">Guests</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {bookings.map((b, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-3 font-bold">{b.roomNumber}</td>
                      <td className="p-3">{b.guestName}</td>
                      <td className="p-3 text-slate-500">{b.guestPhone || '-'}</td>
                      <td className="p-3 text-emerald-600">{b.checkIn.toLocaleDateString()}</td>
                      <td className="p-3 text-red-600">{b.checkOut.toLocaleDateString()}</td>
                      <td className="p-3 text-center">{b.nights}</td>
                      <td className="p-3 text-center">{b.adults + b.children}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Selected Date Modal */}
      {selectedDate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedDate(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="bg-indigo-600 text-white px-6 py-4 rounded-t-2xl flex justify-between items-center sticky top-0">
              <h3 className="text-xl font-bold">{selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
              <button onClick={() => setSelectedDate(null)} className="text-white/70 hover:text-white"><X size={24} /></button>
            </div>
            <div className="p-6">
              {/* Events for this date */}
              {getEventsForDate(selectedDate).length > 0 && (
                <div className="mb-6">
                  <h4 className="font-bold text-purple-700 mb-3 flex items-center gap-2"><PartyPopper size={18} /> Events ({getEventsForDate(selectedDate).length})</h4>
                  <div className="space-y-3">
                    {getEventsForDate(selectedDate).map((e, idx) => (
                      <div key={idx} className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-bold text-purple-800">{e.eventName}</div>
                            <div className="text-sm text-purple-600">{e.eventType} • {e.venue}</div>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded font-medium ${e.status === 'Confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{e.status}</span>
                        </div>
                        <div className="mt-2 text-sm text-slate-600 flex items-center gap-4">
                          <span><Clock size={14} className="inline mr-1" />{e.startTime} - {e.endTime}</span>
                          <span><Users size={14} className="inline mr-1" />{e.expectedGuests} guests</span>
                        </div>
                        {e.contactName && <div className="mt-1 text-xs text-slate-500">Contact: {e.contactName}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Room bookings for this date */}
              {getBookingsForDate(selectedDate).length > 0 && (
                <div>
                  <h4 className="font-bold text-emerald-700 mb-3 flex items-center gap-2"><BedDouble size={18} /> Room Bookings ({getBookingsForDate(selectedDate).length})</h4>
                  <div className="space-y-3">
                    {getBookingsForDate(selectedDate).map((b, idx) => (
                      <div key={idx} className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-bold text-emerald-800">{b.guestName}</div>
                            <div className="text-sm text-emerald-600">Room {b.roomNumber} • {b.roomType}</div>
                          </div>
                          <div className="text-right text-sm">
                            <div className="text-slate-500">{b.nights} nights</div>
                            <div className="text-slate-400">{b.adults}A + {b.children}C</div>
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          {b.checkIn.toLocaleDateString()} → {b.checkOut.toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No items */}
              {getEventsForDate(selectedDate).length === 0 && getBookingsForDate(selectedDate).length === 0 && (
                <p className="text-center text-slate-400 py-8">No events or bookings for this date</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Events Module with Payments ---
const EVENT_TYPES = ['Conference', 'Wedding', 'Birthday Party', 'Corporate Meeting', 'Workshop', 'Retreat', 'Gala Dinner', 'Private Function', 'Other'];
const EVENT_VENUES = ['Main Hall', 'Conference Room A', 'Conference Room B', 'Garden Area', 'Poolside', 'Restaurant', 'Rooftop'];
const EVENT_STATUS = ['Confirmed', 'Tentative', 'Cancelled', 'Completed'];
const PAYMENT_METHODS_EVENT = ['Cash', 'Mobile Money', 'Bank Transfer', 'Cheque'];

const EventsModule = ({ staffName }) => {
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [filter, setFilter] = useState('upcoming');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showInvoice, setShowInvoice] = useState(null);

  // Form fields
  const [eventName, setEventName] = useState('');
  const [eventType, setEventType] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [venue, setVenue] = useState('');
  const [expectedGuests, setExpectedGuests] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [status, setStatus] = useState('Confirmed');
  const [notes, setNotes] = useState('');
  const [totalAmount, setTotalAmount] = useState('');

  // Payment form fields
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Load events from Firestore
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'artifacts', appId, 'public', 'data', 'events'), orderBy('eventDate', 'asc')),
      snap => setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('Events load error:', err)
    );
    return unsub;
  }, []);

  const resetForm = () => {
    setEventName(''); setEventType(''); setEventDate(new Date().toISOString().split('T')[0]);
    setStartTime('09:00'); setEndTime('17:00'); setVenue(''); setExpectedGuests('');
    setContactName(''); setContactPhone(''); setContactEmail(''); setStatus('Confirmed');
    setNotes(''); setTotalAmount(''); setShowForm(false);
  };

  const resetPaymentForm = () => {
    setPaymentAmount(''); setPaymentMethod('Cash'); setPaymentReference(''); setPaymentNotes('');
    setShowPaymentModal(false);
  };

  // Calculate VAT (18%) - Prices are Inclusive
  const calculateVAT = (amount) => {
    const exclusive = Math.round(amount / 1.18);
    return amount - exclusive;
  };
  // Total is already gross/inclusive in this model
  const calculateGrossTotal = (amount) => amount;

  // Get payment status
  const getPaymentStatus = (event) => {
    const totalPaid = (event.payments || []).reduce((sum, p) => sum + p.amount, 0);
    const grossTotal = event.totalAmount || 0; // Total amount entered is already inclusive
    if (totalPaid === 0) return { status: 'Unpaid', color: 'red', paid: 0, balance: grossTotal };
    if (totalPaid >= grossTotal) return { status: 'Paid', color: 'emerald', paid: totalPaid, balance: 0 };
    return { status: 'Partial', color: 'amber', paid: totalPaid, balance: grossTotal - totalPaid };
  };

  const handleSaveEvent = async () => {
    if (!eventName || !eventType || !eventDate || !venue || !totalAmount) {
      alert('Please fill in all required fields: Event Name, Type, Date, Venue, and Total Amount');
      return;
    }

    const eventId = `EVT-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    const eventData = {
      id: eventId,
      eventName, eventType, eventDate, startTime, endTime, venue,
      expectedGuests: parseInt(expectedGuests) || 0,
      contactName, contactPhone, contactEmail, status, notes,
      totalAmount: parseFloat(totalAmount) || 0,
      vatAmount: calculateVAT(parseFloat(totalAmount) || 0),
      grossTotal: calculateGrossTotal(parseFloat(totalAmount) || 0),
      payments: [],
      createdBy: staffName || 'Admin',
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'events', eventId), eventData);
      resetForm();
      alert('✓ Event created successfully!');
    } catch (e) {
      alert('Failed to save event: ' + e.message);
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    const paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    const payment = {
      id: paymentId,
      amount: parseFloat(paymentAmount),
      method: paymentMethod,
      reference: paymentReference || null,
      notes: paymentNotes || null,
      date: new Date().toISOString(),
      recordedBy: staffName || 'Admin'
    };

    const updatedPayments = [...(selectedEvent.payments || []), payment];

    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'events', selectedEvent.id), {
        payments: updatedPayments
      });
      setSelectedEvent({ ...selectedEvent, payments: updatedPayments });
      resetPaymentForm();

      // Show invoice option
      if (window.confirm('Payment recorded! Would you like to print a receipt?')) {
        setShowInvoice({ event: selectedEvent, payment });
      }
    } catch (e) {
      alert('Failed to record payment: ' + e.message);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'events', eventId));
      setSelectedEvent(null);
    } catch (e) {
      alert('Failed to delete event: ' + e.message);
    }
  };

  // Filter events
  const today = new Date().toISOString().split('T')[0];
  const filteredEvents = events.filter(e => {
    if (filter === 'upcoming') return e.eventDate >= today && e.status !== 'Cancelled';
    if (filter === 'past') return e.eventDate < today;
    if (filter === 'cancelled') return e.status === 'Cancelled';
    if (filter === 'unpaid') return getPaymentStatus(e).status !== 'Paid';
    return true;
  });

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="bg-white border-b px-8 py-6 shadow-sm flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3"><PartyPopper className="text-purple-600" /> Events Management</h2>
          <p className="text-slate-500 text-sm mt-1">Manage conferences, functions, and payments</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm(true)} className="flex items-center gap-2">
          <Plus size={18} /> New Event
        </Button>
      </div>

      <div className="p-8 flex-1 overflow-auto">
        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { id: 'upcoming', label: 'Upcoming', count: events.filter(e => e.eventDate >= today && e.status !== 'Cancelled').length },
            { id: 'unpaid', label: 'Unpaid/Partial', count: events.filter(e => getPaymentStatus(e).status !== 'Paid').length },
            { id: 'past', label: 'Past', count: events.filter(e => e.eventDate < today).length },
            { id: 'all', label: 'All', count: events.length }
          ].map(tab => (
            <button key={tab.id} onClick={() => setFilter(tab.id)}
              className={`px-4 py-2 rounded-lg font-medium ${filter === tab.id ? 'bg-purple-600 text-white' : 'bg-white border hover:bg-slate-50'}`}>
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Events Grid */}
        {filteredEvents.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border">
            <PartyPopper size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-400">No events found</p>
            <Button variant="primary" onClick={() => setShowForm(true)} className="mt-4">Create First Event</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map(event => {
              const payStatus = getPaymentStatus(event);
              return (
                <div key={event.id} className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
                  onClick={() => setSelectedEvent(event)}>
                  <div className={`h-2 ${event.status === 'Confirmed' ? 'bg-emerald-500' : event.status === 'Tentative' ? 'bg-amber-500' : event.status === 'Cancelled' ? 'bg-red-500' : 'bg-slate-400'}`} />
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-3">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded font-medium">{event.eventType}</span>
                      <span className={`px-2 py-1 text-xs rounded font-medium bg-${payStatus.color}-100 text-${payStatus.color}-700`}>{payStatus.status}</span>
                    </div>
                    <h3 className="font-bold text-lg text-slate-800 mb-2">{event.eventName}</h3>
                    <div className="space-y-1 text-sm text-slate-500">
                      <div className="flex items-center gap-2"><Calendar size={14} /> {new Date(event.eventDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                      <div className="flex items-center gap-2"><MapPin size={14} /> {event.venue}</div>
                      <div className="flex items-center gap-2"><Users size={14} /> {event.expectedGuests} guests</div>
                    </div>
                    <div className="mt-3 pt-3 border-t flex justify-between items-center">
                      <span className="text-slate-500 text-sm">Total (incl. VAT)</span>
                      <span className="font-bold text-lg">{(event.grossTotal || 0).toLocaleString()} UGX</span>
                    </div>
                    {payStatus.balance > 0 && (
                      <div className="text-sm text-amber-600 font-medium mt-1">Balance: {payStatus.balance.toLocaleString()} UGX</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Event Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="bg-purple-600 text-white px-6 py-4 rounded-t-2xl flex justify-between items-center">
              <h3 className="text-xl font-bold">Create New Event</h3>
              <button onClick={resetForm} className="text-white/70 hover:text-white"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Event Name *</label>
                  <input type="text" className="w-full p-3 border rounded-lg" placeholder="e.g., Annual Corporate Retreat" value={eventName} onChange={e => setEventName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Event Type *</label>
                  <select className="w-full p-3 border rounded-lg bg-white" value={eventType} onChange={e => setEventType(e.target.value)}>
                    <option value="">Select Type</option>
                    {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Venue *</label>
                  <select className="w-full p-3 border rounded-lg bg-white" value={venue} onChange={e => setVenue(e.target.value)}>
                    <option value="">Select Venue</option>
                    {EVENT_VENUES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Event Date *</label>
                  <input type="date" className="w-full p-3 border rounded-lg" value={eventDate} onChange={e => setEventDate(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
                    <input type="time" className="w-full p-3 border rounded-lg" value={startTime} onChange={e => setStartTime(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
                    <input type="time" className="w-full p-3 border rounded-lg" value={endTime} onChange={e => setEndTime(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Expected Guests</label>
                  <input type="number" className="w-full p-3 border rounded-lg" placeholder="0" value={expectedGuests} onChange={e => setExpectedGuests(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Total Amount (excl. VAT) *</label>
                  <input type="number" className="w-full p-3 border rounded-lg" placeholder="0" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} />
                </div>
                {totalAmount && (
                  <div className="col-span-2 bg-slate-100 p-4 rounded-lg">
                    <div className="flex justify-between text-sm"><span>Subtotal</span><span>{parseFloat(totalAmount || 0).toLocaleString()} UGX</span></div>
                    <div className="flex justify-between text-sm"><span>VAT (18%)</span><span>{calculateVAT(parseFloat(totalAmount || 0)).toLocaleString()} UGX</span></div>
                    <div className="flex justify-between font-bold text-lg border-t mt-2 pt-2"><span>Gross Total</span><span>{calculateGrossTotal(parseFloat(totalAmount || 0)).toLocaleString()} UGX</span></div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contact Name</label>
                  <input type="text" className="w-full p-3 border rounded-lg" placeholder="Event organizer" value={contactName} onChange={e => setContactName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contact Phone</label>
                  <input type="tel" className="w-full p-3 border rounded-lg" placeholder="+256..." value={contactPhone} onChange={e => setContactPhone(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contact Email</label>
                  <input type="email" className="w-full p-3 border rounded-lg" placeholder="email@example.com" value={contactEmail} onChange={e => setContactEmail(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select className="w-full p-3 border rounded-lg bg-white" value={status} onChange={e => setStatus(e.target.value)}>
                    {EVENT_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                  <textarea className="w-full p-3 border rounded-lg" rows="2" placeholder="Additional details..." value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="border-t px-6 py-4 bg-slate-50 rounded-b-2xl flex justify-end gap-3">
              <Button variant="secondary" onClick={resetForm}>Cancel</Button>
              <Button variant="primary" onClick={handleSaveEvent}>Create Event</Button>
            </div>
          </div>
        </div>
      )}

      {/* Event Detail Modal with Payments */}
      {selectedEvent && !showPaymentModal && !showInvoice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedEvent(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className={`h-2 rounded-t-2xl ${selectedEvent.status === 'Confirmed' ? 'bg-emerald-500' : selectedEvent.status === 'Tentative' ? 'bg-amber-500' : selectedEvent.status === 'Cancelled' ? 'bg-red-500' : 'bg-slate-400'}`} />
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded font-medium">{selectedEvent.eventType}</span>
                  <h3 className="text-2xl font-bold mt-2">{selectedEvent.eventName}</h3>
                </div>
                <button onClick={() => setSelectedEvent(null)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
              </div>

              {/* Event Details */}
              <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                <div className="p-3 bg-slate-50 rounded-lg"><span className="text-slate-500 block">Date</span><span className="font-medium">{new Date(selectedEvent.eventDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span></div>
                <div className="p-3 bg-slate-50 rounded-lg"><span className="text-slate-500 block">Time</span><span className="font-medium">{selectedEvent.startTime} - {selectedEvent.endTime}</span></div>
                <div className="p-3 bg-slate-50 rounded-lg"><span className="text-slate-500 block">Venue</span><span className="font-medium">{selectedEvent.venue}</span></div>
                <div className="p-3 bg-slate-50 rounded-lg"><span className="text-slate-500 block">Guests</span><span className="font-medium">{selectedEvent.expectedGuests}</span></div>
                {selectedEvent.contactName && <div className="p-3 bg-slate-50 rounded-lg"><span className="text-slate-500 block">Contact</span><span className="font-medium">{selectedEvent.contactName}</span></div>}
                {selectedEvent.contactPhone && <div className="p-3 bg-slate-50 rounded-lg"><span className="text-slate-500 block">Phone</span><span className="font-medium">{selectedEvent.contactPhone}</span></div>}
              </div>

              {/* Financial Summary */}
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6">
                <h4 className="font-bold text-purple-800 mb-3">Financial Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Subtotal</span><span>{(selectedEvent.totalAmount || 0).toLocaleString()} UGX</span></div>
                  <div className="flex justify-between"><span>VAT (18%)</span><span>{(selectedEvent.vatAmount || 0).toLocaleString()} UGX</span></div>
                  <div className="flex justify-between font-bold text-lg border-t border-purple-200 pt-2 mt-2"><span>Gross Total</span><span>{(selectedEvent.grossTotal || 0).toLocaleString()} UGX</span></div>
                  <div className="flex justify-between text-emerald-600"><span>Total Paid</span><span>{getPaymentStatus(selectedEvent).paid.toLocaleString()} UGX</span></div>
                  <div className={`flex justify-between font-bold ${getPaymentStatus(selectedEvent).balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    <span>Balance Due</span><span>{getPaymentStatus(selectedEvent).balance.toLocaleString()} UGX</span>
                  </div>
                </div>
              </div>

              {/* Payment History */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold">Payment History</h4>
                  {getPaymentStatus(selectedEvent).balance > 0 && (
                    <Button variant="success" size="sm" onClick={() => setShowPaymentModal(true)} className="flex items-center gap-1">
                      <Plus size={16} /> Record Payment
                    </Button>
                  )}
                </div>
                {(selectedEvent.payments || []).length === 0 ? (
                  <p className="text-slate-400 text-center py-4 bg-slate-50 rounded-lg">No payments recorded yet</p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100">
                        <tr><th className="p-3 text-left">Date</th><th className="p-3 text-left">Method</th><th className="p-3 text-left">Reference</th><th className="p-3 text-right">Amount</th><th className="p-3"></th></tr>
                      </thead>
                      <tbody className="divide-y">
                        {(selectedEvent.payments || []).map((p, idx) => (
                          <tr key={idx}>
                            <td className="p-3">{new Date(p.date).toLocaleDateString()}</td>
                            <td className="p-3">{p.method}</td>
                            <td className="p-3 text-slate-500">{p.reference || '-'}</td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-600">{p.amount.toLocaleString()}</td>
                            <td className="p-3">
                              <button onClick={() => setShowInvoice({ event: selectedEvent, payment: p })} className="text-blue-600 hover:text-blue-800">
                                <Printer size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setShowInvoice({ event: selectedEvent, payment: null })} className="flex items-center gap-2"><Printer size={16} /> Print Invoice</Button>
                <Button variant="danger" onClick={() => handleDeleteEvent(selectedEvent.id)}>Delete Event</Button>
                <Button variant="secondary" onClick={() => setSelectedEvent(null)} className="ml-auto">Close</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="bg-emerald-600 text-white px-6 py-4 rounded-t-2xl">
              <h3 className="text-xl font-bold">Record Payment</h3>
              <p className="text-emerald-100 text-sm">{selectedEvent.eventName}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-100 p-4 rounded-lg text-center">
                <span className="text-slate-500 text-sm">Balance Due</span>
                <div className="text-2xl font-bold text-red-600">{getPaymentStatus(selectedEvent).balance.toLocaleString()} UGX</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Amount (UGX) *</label>
                <input type="number" className="w-full p-3 border rounded-lg text-lg font-mono" placeholder="0" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
                <select className="w-full p-3 border rounded-lg bg-white" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                  {PAYMENT_METHODS_EVENT.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reference / Receipt No.</label>
                <input type="text" className="w-full p-3 border rounded-lg" placeholder="e.g., TXN-12345" value={paymentReference} onChange={e => setPaymentReference(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <input type="text" className="w-full p-3 border rounded-lg" placeholder="e.g., Deposit payment" value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} />
              </div>
            </div>
            <div className="border-t px-6 py-4 bg-slate-50 rounded-b-2xl flex justify-end gap-3">
              <Button variant="secondary" onClick={resetPaymentForm}>Cancel</Button>
              <Button variant="success" onClick={handleRecordPayment}>Record Payment</Button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice/Receipt Modal */}
      {showInvoice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto">
            {/* Print-only version */}
            <div className="print:block hidden">
              <EventInvoicePrint event={showInvoice.event} payment={showInvoice.payment} />
            </div>

            {/* Screen preview */}
            <div className="print:hidden">
              <div className="bg-slate-800 text-white px-6 py-4 rounded-t-2xl flex justify-between items-center">
                <h3 className="text-xl font-bold">{showInvoice.payment ? 'Payment Receipt' : 'Event Invoice'}</h3>
                <button onClick={() => setShowInvoice(null)} className="text-white/70 hover:text-white"><X size={24} /></button>
              </div>
              <div className="p-6">
                <EventInvoicePreview event={showInvoice.event} payment={showInvoice.payment} />
              </div>
              <div className="border-t px-6 py-4 bg-slate-50 rounded-b-2xl flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setShowInvoice(null)}>Close</Button>
                <Button variant="primary" onClick={() => window.print()} className="flex items-center gap-2"><Printer size={16} /> Print</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Event Invoice Preview ---
const EventInvoicePreview = ({ event, payment }) => {
  const payStatus = event ? {
    paid: (event.payments || []).reduce((sum, p) => sum + p.amount, 0),
    balance: (event.grossTotal || 0) - (event.payments || []).reduce((sum, p) => sum + p.amount, 0)
  } : { paid: 0, balance: 0 };

  return (
    <div className="text-sm">
      <div className="text-center mb-6 pb-4 border-b">
        <h2 className="text-xl font-bold text-slate-800">{HOTEL_INFO.name}</h2>
        <p className="text-slate-500">{HOTEL_INFO.address}</p>
        <p className="text-slate-500">{HOTEL_INFO.phone}</p>
        <p className="text-slate-500">{HOTEL_INFO.email}</p>
        <p className="text-slate-400 text-xs mt-1">{HOTEL_INFO.tin}</p>
      </div>

      <div className="text-center mb-4">
        <h3 className="text-lg font-bold uppercase">{payment ? 'Payment Receipt' : 'Tax Invoice'}</h3>
        <p className="text-slate-500">#{payment ? payment.id : event.id}</p>
        <p className="text-slate-500">{new Date(payment?.date || event.createdAt).toLocaleDateString()}</p>
      </div>

      <div className="bg-slate-50 p-4 rounded-lg mb-4">
        <div className="font-bold mb-2">Event Details</div>
        <div className="space-y-1">
          <div><strong>Event:</strong> {event.eventName}</div>
          <div><strong>Type:</strong> {event.eventType}</div>
          <div><strong>Date:</strong> {new Date(event.eventDate).toLocaleDateString()}</div>
          <div><strong>Venue:</strong> {event.venue}</div>
          {event.contactName && <div><strong>Client:</strong> {event.contactName}</div>}
          {event.contactPhone && <div><strong>Phone:</strong> {event.contactPhone}</div>}
        </div>
      </div>

      {!payment && (
        <div className="border rounded-lg overflow-hidden mb-4">
          <table className="w-full">
            <thead className="bg-slate-100"><tr><th className="p-2 text-left">Description</th><th className="p-2 text-right">Amount</th></tr></thead>
            <tbody>
              <tr className="border-b"><td className="p-2">Event Services - {event.eventType}</td><td className="p-2 text-right">{(event.totalAmount || 0).toLocaleString()}</td></tr>
              <tr className="border-b"><td className="p-2">VAT (18%)</td><td className="p-2 text-right">{(event.vatAmount || 0).toLocaleString()}</td></tr>
              <tr className="font-bold"><td className="p-2">TOTAL</td><td className="p-2 text-right">{(event.grossTotal || 0).toLocaleString()} UGX</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {payment && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
          <div className="text-center">
            <div className="text-slate-500 mb-1">Amount Received</div>
            <div className="text-3xl font-bold text-emerald-600">{payment.amount.toLocaleString()} UGX</div>
            <div className="text-sm text-slate-500 mt-2">
              <div>Method: {payment.method}</div>
              {payment.reference && <div>Ref: {payment.reference}</div>}
            </div>
          </div>
        </div>
      )}

      <div className="border-t pt-4 space-y-1 text-sm">
        <div className="flex justify-between"><span>Total Invoice Amount</span><span>{(event.grossTotal || 0).toLocaleString()} UGX</span></div>
        <div className="flex justify-between text-emerald-600"><span>Total Paid</span><span>{payStatus.paid.toLocaleString()} UGX</span></div>
        <div className={`flex justify-between font-bold ${payStatus.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
          <span>Balance Due</span><span>{payStatus.balance.toLocaleString()} UGX</span>
        </div>
      </div>

      <div className="text-center mt-6 pt-4 border-t text-xs text-slate-400">
        <p>Recorded by: {payment?.recordedBy || event.createdBy}</p>
        <p className="mt-2 italic">"{HOTEL_INFO.motto}"</p>
        <p className="mt-2">Thank you for choosing {HOTEL_INFO.name}!</p>
      </div>
    </div>
  );
};

// --- Event Invoice Print Version ---
const EventInvoicePrint = ({ event, payment }) => {
  const payStatus = event ? {
    paid: (event.payments || []).reduce((sum, p) => sum + p.amount, 0),
    balance: (event.totalAmount || 0) - (event.payments || []).reduce((sum, p) => sum + p.amount, 0)
  } : { paid: 0, balance: 0 };

  const calculateVAT = (amount) => {
    const exclusive = Math.round(amount / 1.18);
    return amount - exclusive;
  };
  const calculateExclusive = (amount) => Math.round(amount / 1.18);

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', maxWidth: '400px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #000', paddingBottom: '15px' }}>
        <h1 style={{ fontSize: '18px', margin: '0 0 5px 0', fontWeight: 'bold' }}>{HOTEL_INFO.name}</h1>
        <p style={{ margin: '2px 0', fontSize: '12px' }}>{HOTEL_INFO.address}</p>
        <p style={{ margin: '2px 0', fontSize: '12px' }}>{HOTEL_INFO.phone} | {HOTEL_INFO.email}</p>
        <p style={{ margin: '5px 0', fontSize: '10px' }}>{HOTEL_INFO.tin}</p>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '15px' }}>
        <h2 style={{ fontSize: '14px', margin: '0', fontWeight: 'bold', textTransform: 'uppercase' }}>{payment ? 'Payment Receipt' : 'Tax Invoice'}</h2>
        <p style={{ margin: '5px 0', fontSize: '12px' }}>#{payment ? payment.id : event.id}</p>
        <p style={{ margin: '5px 0', fontSize: '12px' }}>{new Date(payment?.date || event.createdAt).toLocaleString()}</p>
      </div>

      <div style={{ marginBottom: '15px', fontSize: '12px', borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '10px 0' }}>
        <p style={{ margin: '3px 0' }}><strong>Event:</strong> {event.eventName}</p>
        <p style={{ margin: '3px 0' }}><strong>Type:</strong> {event.eventType}</p>
        <p style={{ margin: '3px 0' }}><strong>Date:</strong> {new Date(event.eventDate).toLocaleDateString()}</p>
        <p style={{ margin: '3px 0' }}><strong>Venue:</strong> {event.venue}</p>
        {event.contactName && <p style={{ margin: '3px 0' }}><strong>Client:</strong> {event.contactName}</p>}
      </div>

      {payment ? (
        <div style={{ textAlign: 'center', padding: '15px', border: '2px solid #000', marginBottom: '15px' }}>
          <p style={{ margin: '0', fontSize: '12px' }}>Amount Received</p>
          <p style={{ margin: '5px 0', fontSize: '24px', fontWeight: 'bold' }}>{payment.amount.toLocaleString()} UGX</p>
          <p style={{ margin: '5px 0', fontSize: '11px' }}>Method: {payment.method}</p>
          {payment.reference && <p style={{ margin: '5px 0', fontSize: '11px' }}>Ref: {payment.reference}</p>}
        </div>
      ) : (
        <table style={{ width: '100%', marginBottom: '15px', fontSize: '12px', borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #ccc' }}><td style={{ padding: '5px 0' }}>Event Services (Net)</td><td style={{ padding: '5px 0', textAlign: 'right' }}>{calculateExclusive(event.totalAmount || 0).toLocaleString()}</td></tr>
            <tr style={{ borderBottom: '1px solid #ccc' }}><td style={{ padding: '5px 0' }}>VAT (18%)</td><td style={{ padding: '5px 0', textAlign: 'right' }}>{calculateVAT(event.totalAmount || 0).toLocaleString()}</td></tr>
            <tr style={{ fontWeight: 'bold' }}><td style={{ padding: '5px 0' }}>TOTAL</td><td style={{ padding: '5px 0', textAlign: 'right' }}>{(event.totalAmount || 0).toLocaleString()} UGX</td></tr>
          </tbody>
        </table>
      )}

      <div style={{ borderTop: '1px solid #000', paddingTop: '10px', fontSize: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}><span>Invoice Total:</span><span>{(event.totalAmount || 0).toLocaleString()} UGX</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}><span>Paid:</span><span>{payStatus.paid.toLocaleString()} UGX</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}><span>Balance:</span><span>{payStatus.balance.toLocaleString()} UGX</span></div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '15px', borderTop: '1px dashed #000', fontSize: '10px' }}>
        <p style={{ margin: '3px 0' }}>Recorded by: {payment?.recordedBy || event.createdBy}</p>
        <p style={{ margin: '10px 0', fontStyle: 'italic' }}>"{HOTEL_INFO.motto}"</p>
        <p style={{ margin: '5px 0' }}>Thank you for choosing {HOTEL_INFO.name}!</p>
      </div>
    </div>
  );
};

// ============================================================================
// OPERATIONS MANAGEMENT ADDITIONS
// ============================================================================

// --- 3-Tier Stock Management System ---
const StockManagement = ({ menu, staffName, userRole }) => {
  const [activeTab, setActiveTab] = useState('main_store');
  const [selectedCenter, setSelectedCenter] = useState(SERVICE_CENTERS[0]?.id);
  const [mainStoreStock, setMainStoreStock] = useState([]);
  const [serviceCenterStock, setServiceCenterStock] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [supplier, setSupplier] = useState('');

  // Load main store stock
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'mainStoreStock'),
      (snap) => setMainStoreStock(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    );
    return unsub;
  }, []);

  // Load selected service center stock
  useEffect(() => {
    if (!selectedCenter) return;
    const unsub = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'serviceCenterStock', selectedCenter, 'items'),
      (snap) => setServiceCenterStock(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    );
    return unsub;
  }, [selectedCenter]);

  // Load recent transactions
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'artifacts', appId, 'public', 'data', 'stockTransactions'), orderBy('date', 'desc')),
      (snap) => setTransactions(snap.docs.slice(0, 50).map(d => ({ id: d.id, ...d.data() }))),
    );
    return unsub;
  }, []);

  // Receive stock to main store
  const handleReceive = async () => {
    if (!selectedItem || !quantity || !supplier) return;
    const txId = `RCV-${Date.now()}`;
    // No need to calculate newQty manually from local state
    // const currentStock = mainStoreStock.find(s => s.id === selectedItem.id);
    // const newQty = (currentStock?.quantity || 0) + parseInt(quantity);

    try {
      // Atomic increment for Main Store
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'mainStoreStock', selectedItem.id), {
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        category: selectedItem.category,
        type: selectedItem.type || 'stock',
        quantity: increment(parseInt(quantity)), // ATOMIC INCREMENT
        unit: selectedItem.unit || 'pcs',
        lastUpdated: new Date().toISOString(),
        minThreshold: 10,
      }, { merge: true });

      // Log transaction
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'stockTransactions', txId), {
        id: txId,
        type: 'receive',
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        quantity: parseInt(quantity),
        fromLocation: supplier,
        toLocation: 'main_store',
        receivedBy: staffName,
        date: new Date().toISOString(),
      });

      alert(`✓ Received ${quantity} x ${selectedItem.name} from ${supplier}`);
      setShowReceiveModal(false);
      setSelectedItem(null);
      setQuantity('');
      setSupplier('');
    } catch (e) {
      console.error("Stock Receive Error:", e);
      alert('Error receiving stock: ' + e.message);
    }
  };

  // Issue stock from main store to service center
  const handleIssue = async () => {
    if (!selectedItem || !quantity || !selectedCenter) return;
    const currentStock = mainStoreStock.find(s => s.id === selectedItem.id);
    const currentQty = currentStock?.quantity || 0;
    const issueQty = parseInt(quantity);

    if (currentQty < issueQty) {
      alert(`Insufficient stock. Only ${currentQty} available.`);
      return;
    }

    const txId = `ISS-${Date.now()}`;
    const destinationName = SERVICE_CENTERS.find(c => c.id === selectedCenter)?.name || 'Service Center';

    try {
      // 1. Decrease main store (Atomic)
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'mainStoreStock', selectedItem.id), {
        quantity: increment(-issueQty),
        lastUpdated: new Date().toISOString(),
      });

      // 2. Increase service center (Atomic & Safe against stale state)
      // Uses setDoc with merge: true to create if missing OR update if exists
      // Uses increment() to safely add to existing stock without reading it first
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'serviceCenterStock', selectedCenter, 'items', selectedItem.id), {
        itemId: selectedItem.id,
        itemName: selectedItem.itemName || selectedItem.name || 'Unknown Item',
        category: selectedItem.category || 'Uncategorized',
        quantity: increment(issueQty), // ATOMIC INCREMENT
        lastReceived: new Date().toISOString(),
        receivedBy: staffName,
      }, { merge: true });

      // 3. Log transaction
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'stockTransactions', txId), {
        id: txId,
        type: 'issue',
        itemId: selectedItem.id,
        itemName: selectedItem.itemName || selectedItem.name || 'Unknown Item',
        quantity: issueQty,
        fromLocation: 'main_store',
        toLocation: selectedCenter,
        destinationName,
        issuedBy: staffName,
        date: new Date().toISOString(),
      });

      alert(`✓ Issued ${quantity} x ${selectedItem.itemName || selectedItem.name || 'Unknown Item'} to ${destinationName}`);
      setShowIssueModal(false);
      setSelectedItem(null);
      setQuantity('');
    } catch (e) {
      console.error("Stock Issue Error:", e);
      alert('Error issuing stock: ' + e.message);
    }
  };

  // Get low stock alerts
  const lowStockItems = mainStoreStock.filter(s => s.quantity < (s.minThreshold || 10));

  // Group items by category for display
  const barItems = menu.filter(m => m.type === 'bar');
  const kitchenItems = menu.filter(m => m.type === 'kitchen');

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="bg-white border-b px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3"><Package className="text-teal-600" /> Stock Management</h2>
            <p className="text-slate-500 text-sm">3-tier inventory: Main Store → Service Centers → Sales</p>
          </div>
          {lowStockItems.length > 0 && (
            <div className="flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-lg">
              <AlertCircle size={20} />
              <span className="font-bold">{lowStockItems.length} items low in stock</span>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b flex">
        <button onClick={() => setActiveTab('main_store')} className={`px-6 py-3 font-medium border-b-2 transition-colors ${activeTab === 'main_store' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <Warehouse className="inline mr-2" size={18} /> Main Store
        </button>
        <button onClick={() => setActiveTab('service_centers')} className={`px-6 py-3 font-medium border-b-2 transition-colors ${activeTab === 'service_centers' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <Package className="inline mr-2" size={18} /> Service Centers
        </button>
        <button onClick={() => setActiveTab('transactions')} className={`px-6 py-3 font-medium border-b-2 transition-colors ${activeTab === 'transactions' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <ArrowRightLeft className="inline mr-2" size={18} /> Transactions
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* Main Store Tab */}
        {activeTab === 'main_store' && (
          <div>
            <div className="flex gap-3 mb-6">
              <Button onClick={() => setShowReceiveModal(true)} icon={Plus}>Receive Stock</Button>
              <Button onClick={() => setShowIssueModal(true)} variant="secondary" icon={Send}>Issue to Center</Button>
            </div>

            <div className="bg-white rounded-xl shadow border overflow-hidden">
              <div className="bg-teal-50 px-4 py-3 border-b font-bold text-teal-800">Main Store Inventory</div>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600 uppercase text-xs font-bold">
                  <tr>
                    <th className="p-3">Item</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-center">Quantity</th>
                    <th className="p-3 text-center">Min Level</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {mainStoreStock.length === 0 ? (
                    <tr><td colSpan="6" className="p-8 text-center text-slate-400">No stock records. Receive items to get started.</td></tr>
                  ) : mainStoreStock.map(item => (
                    <tr key={item.id} className={`hover:bg-slate-50 ${item.quantity < (item.minThreshold || 10) ? 'bg-red-50' : ''}`}>
                      <td className="p-3 font-medium">{item.itemName}</td>
                      <td className="p-3 text-slate-500">{item.category}</td>
                      <td className="p-3 text-center font-bold text-lg">{item.quantity}</td>
                      <td className="p-3 text-center text-slate-500">{item.minThreshold || 10}</td>
                      <td className="p-3">
                        {item.quantity < (item.minThreshold || 10)
                          ? <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">LOW</span>
                          : <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold">OK</span>}
                      </td>
                      <td className="p-3 text-slate-400 text-xs">{item.lastUpdated ? new Date(item.lastUpdated).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Service Centers Tab */}
        {activeTab === 'service_centers' && (
          <div>
            <div className="flex gap-2 mb-6">
              {SERVICE_CENTERS.map(center => (
                <button key={center.id} onClick={() => setSelectedCenter(center.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${selectedCenter === center.id ? 'bg-teal-600 text-white' : 'bg-white border hover:bg-slate-50'}`}>
                  {center.name}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-xl shadow border overflow-hidden">
              <div className="bg-blue-50 px-4 py-3 border-b font-bold text-blue-800">
                {SERVICE_CENTERS.find(c => c.id === selectedCenter)?.name} Stock
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600 uppercase text-xs font-bold">
                  <tr>
                    <th className="p-3">Item</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-center">Quantity</th>
                    <th className="p-3">Last Received</th>
                    <th className="p-3">Received By</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {serviceCenterStock.length === 0 ? (
                    <tr><td colSpan="5" className="p-8 text-center text-slate-400">No stock in this center yet</td></tr>
                  ) : serviceCenterStock.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-3 font-medium">{item.itemName}</td>
                      <td className="p-3 text-slate-500">{item.category}</td>
                      <td className="p-3 text-center font-bold text-lg">{item.quantity}</td>
                      <td className="p-3 text-slate-400 text-xs">{item.lastReceived ? new Date(item.lastReceived).toLocaleDateString() : '-'}</td>
                      <td className="p-3 text-slate-500">{item.receivedBy || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div className="bg-white rounded-xl shadow border overflow-hidden">
            <div className="bg-violet-50 px-4 py-3 border-b font-bold text-violet-800">Stock Movement History</div>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600 uppercase text-xs font-bold">
                <tr>
                  <th className="p-3">Date/Time</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Item</th>
                  <th className="p-3 text-center">Qty</th>
                  <th className="p-3">From</th>
                  <th className="p-3">To</th>
                  <th className="p-3">By</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-500 text-xs">{new Date(tx.date).toLocaleString()}</td>
                    <td className="p-3">
                      {tx.type === 'receive' && <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold">RECEIVE</span>}
                      {tx.type === 'issue' && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">ISSUE</span>}
                    </td>
                    <td className="p-3 font-medium">{tx.itemName}</td>
                    <td className="p-3 text-center font-bold">{tx.quantity}</td>
                    <td className="p-3 text-slate-500">{tx.fromLocation === 'main_store' ? 'Main Store' : tx.fromLocation}</td>
                    <td className="p-3 text-slate-500">{SERVICE_CENTERS.find(c => c.id === tx.toLocation)?.name || tx.toLocation}</td>
                    <td className="p-3 text-slate-500">{tx.receivedBy || tx.issuedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Receive Stock Modal */}
      {showReceiveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="bg-teal-600 text-white px-6 py-4 rounded-t-2xl flex justify-between items-center">
              <h3 className="text-xl font-bold">Receive Stock to Main Store</h3>
              <button onClick={() => setShowReceiveModal(false)} className="text-white/70 hover:text-white"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Item</label>
                <select className="w-full p-3 border rounded-lg" value={selectedItem?.id || ''} onChange={e => setSelectedItem([...barItems, ...kitchenItems, ...KITCHEN_STOCK_ITEMS].find(i => i.id === e.target.value))}>
                  <option value="">-- Select Item --</option>
                  <optgroup label="Bar Items">
                    {barItems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </optgroup>
                  <optgroup label="Kitchen Items (Menu)">
                    {kitchenItems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </optgroup>
                  <optgroup label="Kitchen Raw Materials">
                    {KITCHEN_STOCK_ITEMS.map(item => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                <input type="number" className="w-full p-3 border rounded-lg" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Enter quantity" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Supplier</label>
                <input type="text" className="w-full p-3 border rounded-lg" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Supplier name" />
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="secondary" className="flex-1" onClick={() => setShowReceiveModal(false)}>Cancel</Button>
                <Button className="flex-1" onClick={handleReceive} disabled={!selectedItem || !quantity || !supplier}>Receive Stock</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Issue Stock Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="bg-blue-600 text-white px-6 py-4 rounded-t-2xl flex justify-between items-center">
              <h3 className="text-xl font-bold">Issue Stock to Service Center</h3>
              <button onClick={() => setShowIssueModal(false)} className="text-white/70 hover:text-white"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Item (from Main Store)</label>
                <select className="w-full p-3 border rounded-lg" value={selectedItem?.id || ''} onChange={e => {
                  const stock = mainStoreStock.find(s => s.id === e.target.value);
                  setSelectedItem(stock);
                }}>
                  <option value="">-- Select Item --</option>
                  {mainStoreStock.map(item => <option key={item.id} value={item.id}>{item.itemName} (Qty: {item.quantity})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Issue To</label>
                <select className="w-full p-3 border rounded-lg" value={selectedCenter} onChange={e => setSelectedCenter(e.target.value)}>
                  {SERVICE_CENTERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                <input type="number" className="w-full p-3 border rounded-lg" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Enter quantity" />
                {selectedItem && <p className="text-xs text-slate-500 mt-1">Available: {selectedItem.quantity}</p>}
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="secondary" className="flex-1" onClick={() => setShowIssueModal(false)}>Cancel</Button>
                <Button className="flex-1" onClick={handleIssue} disabled={!selectedItem || !quantity}>Issue Stock</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Digital Requisition Module ---
const RequisitionModule = ({ staffName, userRole, serviceCenter }) => {
  const [requisitions, setRequisitions] = useState([]);
  const [mainStoreStock, setMainStoreStock] = useState([]);
  const [showNewReq, setShowNewReq] = useState(false);
  const [reqItems, setReqItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [filter, setFilter] = useState('all');

  const isApprover = ['admin', 'supervisor'].includes(userRole);

  // Load requisitions
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'artifacts', appId, 'public', 'data', 'requisitions'), orderBy('createdAt', 'desc')),
      (snap) => setRequisitions(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    );
    return unsub;
  }, []);

  // Load main store stock for requisition
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'mainStoreStock'),
      (snap) => setMainStoreStock(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    );
    return unsub;
  }, []);

  // Filter requisitions
  const filteredReqs = requisitions.filter(r => {
    if (filter === 'all') return isApprover ? true : r.serviceCenter === serviceCenter;
    if (filter === 'pending') return r.status === 'pending';
    if (filter === 'approved') return r.status === 'approved';
    if (filter === 'mine') return r.serviceCenter === serviceCenter;
    return true;
  });

  // Create requisition
  const handleCreateReq = async () => {
    if (reqItems.length === 0) { alert('Add at least one item'); return; }

    const reqId = `REQ-${Date.now()}`;
    const reqData = {
      id: reqId,
      serviceCenter: serviceCenter,
      serviceCenterName: SERVICE_CENTERS.find(c => c.id === serviceCenter)?.name || serviceCenter,
      requestedBy: staffName,
      items: reqItems.map(i => ({ itemId: i.id, itemName: i.itemName, quantity: parseInt(i.requestQty), unit: 'pcs' })),
      status: 'pending',
      notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'requisitions', reqId), reqData);
      alert('✓ Requisition submitted');
      setShowNewReq(false);
      setReqItems([]);
      setNotes('');
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  // Approve requisition
  const handleApprove = async (req) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'requisitions', req.id), {
        status: 'approved',
        approvedBy: staffName,
        approvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      alert('✓ Requisition approved');
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  // Reject requisition
  const handleReject = async (req) => {
    const reason = window.prompt('Rejection reason:');
    if (!reason) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'requisitions', req.id), {
        status: 'rejected',
        rejectedBy: staffName,
        rejectedAt: new Date().toISOString(),
        rejectionReason: reason,
        updatedAt: new Date().toISOString(),
      });
      alert('✓ Requisition rejected');
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  // Fulfill requisition (issue stock)
  const handleFulfill = async (req) => {
    try {
      // Issue stock for each item
      for (const item of req.items) {
        const stockItem = mainStoreStock.find(s => s.id === item.itemId);
        if (!stockItem || stockItem.quantity < item.quantity) {
          alert(`Insufficient stock for ${item.itemName}`);
          return;
        }

        // Decrease main store
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'mainStoreStock', item.itemId), {
          quantity: increment(-item.quantity),
          lastUpdated: new Date().toISOString(),
        });

        // Increase service center
        const centerDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'serviceCenterStock', req.serviceCenter, 'items', item.itemId));
        const currentQty = centerDoc.exists() ? centerDoc.data().quantity : 0;
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'serviceCenterStock', req.serviceCenter, 'items', item.itemId), {
          itemId: item.itemId,
          itemName: item.itemName || 'Unknown Item',
          quantity: currentQty + item.quantity,
          lastReceived: new Date().toISOString(),
          receivedBy: staffName,
        });

        // Log transaction
        const txId = `ISS-REQ-${Date.now()}-${item.itemId}`;
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'stockTransactions', txId), {
          id: txId,
          type: 'issue',
          itemId: item.itemId,
          itemName: item.itemName || 'Unknown Item',
          quantity: item.quantity,
          fromLocation: 'main_store',
          toLocation: req.serviceCenter,
          issuedBy: staffName,
          requisitionId: req.id,
          date: new Date().toISOString(),
        });
      }

      // Update requisition status
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'requisitions', req.id), {
        status: 'fulfilled',
        issuedBy: staffName,
        issuedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      alert('✓ Requisition fulfilled and stock issued');
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const addItemToReq = (stockItem) => {
    if (reqItems.find(i => i.id === stockItem.id)) return;
    setReqItems([...reqItems, { ...stockItem, requestQty: 1 }]);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="bg-white border-b px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3"><Send className="text-orange-600" /> Digital Requisitions</h2>
            <p className="text-slate-500 text-sm">Request stock from main store with approval workflow</p>
          </div>
          {serviceCenter && (
            <Button onClick={() => setShowNewReq(true)} icon={Plus}>New Requisition</Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-6 py-3 flex gap-2">
        {['all', 'pending', 'approved', 'mine'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${filter === f ? 'bg-orange-500 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>
            {f === 'all' ? 'All' : f === 'pending' ? 'Pending' : f === 'approved' ? 'Approved' : 'My Requests'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-4">
          {filteredReqs.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center text-slate-400">
              No requisitions found
            </div>
          ) : filteredReqs.map(req => (
            <div key={req.id} className="bg-white rounded-xl shadow border overflow-hidden">
              <div className={`px-4 py-3 border-b flex items-center justify-between ${req.status === 'pending' ? 'bg-amber-50' :
                req.status === 'approved' ? 'bg-blue-50' :
                  req.status === 'fulfilled' ? 'bg-emerald-50' :
                    'bg-red-50'
                }`}>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-slate-500">#{req.id}</span>
                  <span className="font-bold">{req.serviceCenterName}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${req.status === 'pending' ? 'bg-amber-200 text-amber-800' :
                    req.status === 'approved' ? 'bg-blue-200 text-blue-800' :
                      req.status === 'fulfilled' ? 'bg-emerald-200 text-emerald-800' :
                        'bg-red-200 text-red-800'
                    }`}>{req.status.toUpperCase()}</span>
                </div>
                <span className="text-sm text-slate-500">{new Date(req.createdAt).toLocaleString()}</span>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div><span className="text-slate-500">Requested by:</span> <span className="font-medium">{req.requestedBy}</span></div>
                  {req.approvedBy && <div><span className="text-slate-500">Approved by:</span> <span className="font-medium">{req.approvedBy}</span></div>}
                  {req.issuedBy && <div><span className="text-slate-500">Issued by:</span> <span className="font-medium">{req.issuedBy}</span></div>}
                  {req.rejectedBy && <div><span className="text-slate-500">Rejected by:</span> <span className="font-medium text-red-600">{req.rejectedBy}</span></div>}
                </div>
                <table className="w-full text-sm mb-4">
                  <thead className="bg-slate-100"><tr><th className="p-2 text-left">Item</th><th className="p-2 text-center">Qty</th></tr></thead>
                  <tbody>
                    {req.items.map((item, idx) => (
                      <tr key={idx} className="border-b"><td className="p-2">{item.itemName}</td><td className="p-2 text-center font-bold">{item.quantity}</td></tr>
                    ))}
                  </tbody>
                </table>
                {req.notes && <p className="text-sm text-slate-600 bg-slate-50 p-2 rounded mb-4"><strong>Notes:</strong> {req.notes}</p>}
                {req.rejectionReason && <p className="text-sm text-red-600 bg-red-50 p-2 rounded mb-4"><strong>Rejection reason:</strong> {req.rejectionReason}</p>}

                {/* Action Buttons */}
                {isApprover && req.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button variant="success" onClick={() => handleApprove(req)} icon={CheckCircle}>Approve</Button>
                    <Button variant="danger" onClick={() => handleReject(req)} icon={XCircle}>Reject</Button>
                  </div>
                )}
                {isApprover && req.status === 'approved' && (
                  <Button onClick={() => handleFulfill(req)} icon={Package}>Fulfill & Issue Stock</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New Requisition Modal */}
      {showNewReq && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="bg-orange-600 text-white px-6 py-4 rounded-t-2xl flex justify-between items-center sticky top-0">
              <h3 className="text-xl font-bold">New Requisition</h3>
              <button onClick={() => setShowNewReq(false)} className="text-white/70 hover:text-white"><X size={24} /></button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">Select Items from Main Store</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-lg p-2">
                  {mainStoreStock.filter(s => s.quantity > 0).map(item => (
                    <button key={item.id} onClick={() => addItemToReq(item)}
                      className={`p-2 text-left text-sm rounded border transition-all ${reqItems.find(i => i.id === item.id) ? 'bg-orange-100 border-orange-300' : 'hover:bg-slate-50'}`}>
                      <div className="font-medium">{item.itemName}</div>
                      <div className="text-xs text-slate-500">Available: {item.quantity}</div>
                    </button>
                  ))}
                </div>
              </div>

              {reqItems.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Requested Items</label>
                  <table className="w-full text-sm border rounded-lg overflow-hidden">
                    <thead className="bg-slate-100"><tr><th className="p-2 text-left">Item</th><th className="p-2 text-center">Qty</th><th className="p-2"></th></tr></thead>
                    <tbody>
                      {reqItems.map((item, idx) => (
                        <tr key={item.id} className="border-b">
                          <td className="p-2">{item.itemName}</td>
                          <td className="p-2 text-center">
                            <input type="number" className="w-20 p-1 border rounded text-center" min="1" max={item.quantity}
                              value={item.requestQty} onChange={e => {
                                const updated = [...reqItems];
                                updated[idx].requestQty = e.target.value;
                                setReqItems(updated);
                              }} />
                          </td>
                          <td className="p-2 text-center">
                            <button onClick={() => setReqItems(reqItems.filter(i => i.id !== item.id))} className="text-red-500 hover:text-red-700"><X size={16} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
                <textarea className="w-full p-3 border rounded-lg" rows="2" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any special instructions..." />
              </div>

              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setShowNewReq(false)}>Cancel</Button>
                <Button className="flex-1" onClick={handleCreateReq} disabled={reqItems.length === 0}>Submit Requisition</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Performance Tracking Module ---
const PerformanceModule = ({ staffName, userRole }) => {
  const [staffPerformance, setStaffPerformance] = useState([]);
  const [salesTargets, setSalesTargets] = useState([]);
  const [activeShifts, setActiveShifts] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetStaff, setTargetStaff] = useState('');
  const [targetAmount, setTargetAmount] = useState('');

  const isAdmin = ['admin', 'supervisor'].includes(userRole);

  // Load performance data
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'staffPerformance'),
      (snap) => setStaffPerformance(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.month === selectedMonth)),
    );
    return unsub;
  }, [selectedMonth]);

  // Load sales targets
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'salesTargets'),
      (snap) => setSalesTargets(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    );
    return unsub;
  }, []);

  // Load active shifts
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'staffShifts'),
      (snap) => setActiveShifts(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    );
    return unsub;
  }, []);

  // Set sales target
  const handleSetTarget = async () => {
    if (!targetStaff || !targetAmount) return;
    const targetId = `${targetStaff}_${selectedMonth}`;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'salesTargets', targetId), {
        staffId: targetStaff,
        staffName: STAFF_SEEDS.find(s => s.email === targetStaff)?.name || targetStaff,
        month: selectedMonth,
        target: parseInt(targetAmount),
        setBy: staffName,
        setAt: new Date().toISOString(),
      });
      alert('✓ Target set');
      setShowTargetModal(false);
      setTargetStaff('');
      setTargetAmount('');
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  // Get target for staff
  const getTarget = (staffId) => {
    return salesTargets.find(t => t.staffId === staffId && t.month === selectedMonth);
  };

  // Calculate achievement percentage
  const getAchievement = (perf) => {
    const target = getTarget(perf.staffId);
    if (!target || target.target === 0) return null;
    return Math.round((perf.totalSales / target.target) * 100);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="bg-white border-b px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3"><Target className="text-violet-600" /> Performance Tracking</h2>
            <p className="text-slate-500 text-sm">Staff sales, targets, and productivity metrics</p>
          </div>
          <div className="flex items-center gap-3">
            <input type="month" className="p-2 border rounded-lg" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
            {isAdmin && <Button onClick={() => setShowTargetModal(true)} icon={Target}>Set Target</Button>}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* Active Shifts */}
        <div className="mb-6">
          <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><UserCheck className="text-emerald-600" /> Currently On Shift</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {activeShifts.length === 0 ? (
              <div className="col-span-full bg-white rounded-xl p-4 text-center text-slate-400">No active shifts</div>
            ) : activeShifts.map(shift => (
              <div key={shift.id} className="bg-white rounded-xl p-4 border border-emerald-200 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="font-bold">{shift.staffName}</span>
                </div>
                <div className="text-sm text-slate-500">{SERVICE_CENTERS.find(c => c.id === shift.serviceCenter)?.name || shift.serviceCenter}</div>
                <div className="text-xs text-slate-400 mt-1">Since {new Date(shift.loginTime).toLocaleTimeString()}</div>
                <div className="mt-2 pt-2 border-t grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-slate-500">Orders:</span> <span className="font-bold">{shift.ordersCount || 0}</span></div>
                  <div><span className="text-slate-500">Sales:</span> <span className="font-bold text-emerald-600">{(shift.totalSales || 0).toLocaleString()}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Performance Table */}
        <div className="bg-white rounded-xl shadow border overflow-hidden">
          <div className="bg-violet-50 px-4 py-3 border-b font-bold text-violet-800 flex items-center gap-2">
            <BarChart3 size={18} /> Monthly Performance - {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600 uppercase text-xs font-bold">
              <tr>
                <th className="p-3">Staff</th>
                <th className="p-3">Service Center</th>
                <th className="p-3 text-center">Orders</th>
                <th className="p-3 text-center">Items Sold</th>
                <th className="p-3 text-right">Total Sales</th>
                <th className="p-3 text-right">Target</th>
                <th className="p-3 text-center">Achievement</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {staffPerformance.length === 0 ? (
                <tr><td colSpan="7" className="p-8 text-center text-slate-400">No performance data for this month</td></tr>
              ) : staffPerformance.map(perf => {
                const target = getTarget(perf.staffId);
                const achievement = getAchievement(perf);
                return (
                  <tr key={perf.id} className="hover:bg-slate-50">
                    <td className="p-3 font-medium">{perf.staffName || perf.staffId}</td>
                    <td className="p-3 text-slate-500">{SERVICE_CENTERS.find(c => c.id === perf.serviceCenter)?.name || perf.serviceCenter}</td>
                    <td className="p-3 text-center">{perf.ordersCount || 0}</td>
                    <td className="p-3 text-center">{perf.itemsSold || 0}</td>
                    <td className="p-3 text-right font-bold text-emerald-600">{(perf.totalSales || 0).toLocaleString()} UGX</td>
                    <td className="p-3 text-right text-slate-500">{target ? target.target.toLocaleString() : '-'}</td>
                    <td className="p-3 text-center">
                      {achievement !== null ? (
                        <span className={`px-2 py-1 rounded text-xs font-bold ${achievement >= 100 ? 'bg-emerald-100 text-emerald-700' :
                          achievement >= 75 ? 'bg-blue-100 text-blue-700' :
                            achievement >= 50 ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                          }`}>{achievement}%</span>
                      ) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Top Performers */}
        {staffPerformance.length > 0 && (
          <div className="mt-6">
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Award className="text-amber-500" /> Top Performers</h3>
            <div className="grid grid-cols-3 gap-4">
              {staffPerformance.sort((a, b) => (b.totalSales || 0) - (a.totalSales || 0)).slice(0, 3).map((perf, idx) => (
                <div key={perf.id} className={`rounded-xl p-4 text-center ${idx === 0 ? 'bg-amber-100 border-2 border-amber-300' : 'bg-white border'}`}>
                  <div className={`text-3xl mb-2 ${idx === 0 ? '' : 'grayscale opacity-50'}`}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</div>
                  <div className="font-bold">{perf.staffName || perf.staffId}</div>
                  <div className="text-sm text-slate-500">{SERVICE_CENTERS.find(c => c.id === perf.serviceCenter)?.name}</div>
                  <div className="text-lg font-bold text-emerald-600 mt-2">{(perf.totalSales || 0).toLocaleString()} UGX</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Set Target Modal */}
      {showTargetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="bg-violet-600 text-white px-6 py-4 rounded-t-2xl flex justify-between items-center">
              <h3 className="text-xl font-bold">Set Sales Target</h3>
              <button onClick={() => setShowTargetModal(false)} className="text-white/70 hover:text-white"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Staff Member</label>
                <select className="w-full p-3 border rounded-lg" value={targetStaff} onChange={e => setTargetStaff(e.target.value)}>
                  <option value="">-- Select Staff --</option>
                  {STAFF_SEEDS.filter(s => ['barperson', 'service_staff'].includes(s.role)).map(staff => (
                    <option key={staff.email} value={staff.email}>{staff.name} ({staff.serviceCenter})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Target (UGX)</label>
                <input type="number" className="w-full p-3 border rounded-lg" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} placeholder="e.g. 5000000" />
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="secondary" className="flex-1" onClick={() => setShowTargetModal(false)}>Cancel</Button>
                <Button className="flex-1" onClick={handleSetTarget} disabled={!targetStaff || !targetAmount}>Set Target</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Supervisor Dashboard ---
const SupervisorDashboard = ({ staffName }) => {
  const [activeShifts, setActiveShifts] = useState([]);
  const [todaySales, setTodaySales] = useState([]);
  const [todayVoids, setTodayVoids] = useState([]);
  const [requisitions, setRequisitions] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => setRefreshKey(k => k + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  // Load active shifts
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'staffShifts'),
      (snap) => setActiveShifts(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    );
    return unsub;
  }, []);

  // Load today's sales
  useEffect(() => {
    const today = new Date().toLocaleDateString();
    const unsub = onSnapshot(
      query(collection(db, 'artifacts', appId, 'public', 'data', 'sales'), orderBy('date', 'desc')),
      (snap) => setTodaySales(snap.docs.map(d => d.data()).filter(s => new Date(s.date).toLocaleDateString() === today)),
    );
    return unsub;
  }, [refreshKey]);

  // Load today's voids
  useEffect(() => {
    const today = new Date().toLocaleDateString();
    const unsub = onSnapshot(
      query(collection(db, 'artifacts', appId, 'public', 'data', 'voids'), orderBy('date', 'desc')),
      (snap) => setTodayVoids(snap.docs.map(d => d.data()).filter(v => new Date(v.date).toLocaleDateString() === today)),
    );
    return unsub;
  }, [refreshKey]);

  // Load pending requisitions
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'artifacts', appId, 'public', 'data', 'requisitions'), orderBy('createdAt', 'desc')),
      (snap) => setRequisitions(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.status === 'pending')),
    );
    return unsub;
  }, []);

  // Load low stock items
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'mainStoreStock'),
      (snap) => setLowStockItems(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.quantity < (s.minThreshold || 10))),
    );
    return unsub;
  }, []);

  // Calculate metrics
  const totalSales = todaySales.reduce((sum, s) => sum + s.total, 0);
  const totalVoids = todayVoids.reduce((sum, v) => sum + (v.price * v.qty), 0);
  const salesByDept = SERVICE_CENTERS.map(center => ({
    ...center,
    sales: todaySales.filter(s => s.department === center.name).reduce((sum, s) => sum + s.total, 0),
    orders: todaySales.filter(s => s.department === center.name).length,
  }));

  return (
    <div className="h-full flex flex-col bg-slate-900 text-white">
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3"><UserCheck className="text-fuchsia-400" /> Supervisor Dashboard</h2>
            <p className="text-slate-400 text-sm">Real-time operations visibility</p>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setRefreshKey(k => k + 1)} className="p-2 bg-slate-700 rounded-lg hover:bg-slate-600">
              <RefreshCw size={20} />
            </button>
            <div className="text-right">
              <div className="text-xs text-slate-400">Last updated</div>
              <div className="text-sm font-mono">{new Date().toLocaleTimeString()}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl p-4">
            <div className="text-emerald-100 text-sm">Today's Sales</div>
            <div className="text-3xl font-bold">{totalSales.toLocaleString()}</div>
            <div className="text-emerald-200 text-sm">{todaySales.length} transactions</div>
          </div>
          <div className="bg-gradient-to-br from-red-500 to-red-700 rounded-xl p-4">
            <div className="text-red-100 text-sm">Today's Voids</div>
            <div className="text-3xl font-bold">{totalVoids.toLocaleString()}</div>
            <div className="text-red-200 text-sm">{todayVoids.length} items voided</div>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl p-4">
            <div className="text-blue-100 text-sm">Active Staff</div>
            <div className="text-3xl font-bold">{activeShifts.length}</div>
            <div className="text-blue-200 text-sm">currently on shift</div>
          </div>
          <div className="bg-gradient-to-br from-amber-500 to-amber-700 rounded-xl p-4">
            <div className="text-amber-100 text-sm">Pending Requisitions</div>
            <div className="text-3xl font-bold">{requisitions.length}</div>
            <div className="text-amber-200 text-sm">awaiting approval</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales by Department */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 font-bold flex items-center gap-2">
              <BarChart3 size={18} className="text-emerald-400" /> Sales by Service Center
            </div>
            <div className="p-4 space-y-3">
              {salesByDept.map(dept => (
                <div key={dept.id} className="flex items-center gap-3">
                  <div className="w-32 text-sm text-slate-300">{dept.name}</div>
                  <div className="flex-1 bg-slate-700 rounded-full h-6 overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${totalSales > 0 ? (dept.sales / totalSales) * 100 : 0}%` }}></div>
                  </div>
                  <div className="w-24 text-right font-mono text-sm">{dept.sales.toLocaleString()}</div>
                  <div className="w-16 text-right text-xs text-slate-400">{dept.orders} orders</div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Shifts */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 font-bold flex items-center gap-2">
              <UserCheck size={18} className="text-blue-400" /> Active Shifts
            </div>
            <div className="divide-y divide-slate-700 max-h-64 overflow-y-auto">
              {activeShifts.length === 0 ? (
                <div className="p-4 text-center text-slate-500">No active shifts</div>
              ) : activeShifts.map(shift => (
                <div key={shift.id} className="p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                      {shift.staffName}
                    </div>
                    <div className="text-xs text-slate-400">{SERVICE_CENTERS.find(c => c.id === shift.serviceCenter)?.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-emerald-400">{(shift.totalSales || 0).toLocaleString()} UGX</div>
                    <div className="text-xs text-slate-400">{shift.ordersCount || 0} orders</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Low Stock Alerts */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 font-bold flex items-center gap-2">
              <AlertCircle size={18} className="text-amber-400" /> Low Stock Alerts
            </div>
            <div className="divide-y divide-slate-700 max-h-64 overflow-y-auto">
              {lowStockItems.length === 0 ? (
                <div className="p-4 text-center text-slate-500">No low stock items</div>
              ) : lowStockItems.map(item => (
                <div key={item.id} className="p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{item.itemName}</div>
                    <div className="text-xs text-slate-400">{item.category}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-red-400">{item.quantity} left</div>
                    <div className="text-xs text-slate-400">min: {item.minThreshold || 10}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Requisitions */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 font-bold flex items-center gap-2">
              <Send size={18} className="text-orange-400" /> Pending Requisitions
            </div>
            <div className="divide-y divide-slate-700 max-h-64 overflow-y-auto">
              {requisitions.length === 0 ? (
                <div className="p-4 text-center text-slate-500">No pending requisitions</div>
              ) : requisitions.map(req => (
                <div key={req.id} className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-medium">{req.serviceCenterName}</div>
                    <div className="text-xs text-slate-400">{new Date(req.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="text-sm text-slate-400">{req.items.length} items requested by {req.requestedBy}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="mt-6 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 font-bold flex items-center gap-2">
            <ShoppingCart size={18} className="text-emerald-400" /> Recent Transactions
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-700/50 text-slate-400 uppercase text-xs">
              <tr>
                <th className="p-3 text-left">Time</th>
                <th className="p-3 text-left">Staff</th>
                <th className="p-3 text-left">Department</th>
                <th className="p-3 text-center">Items</th>
                <th className="p-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {todaySales.slice(0, 10).map(sale => (
                <tr key={sale.id} className="hover:bg-slate-700/50">
                  <td className="p-3 text-slate-400 text-xs">{new Date(sale.date).toLocaleTimeString()}</td>
                  <td className="p-3 font-medium">{sale.staff}</td>
                  <td className="p-3 text-slate-400">{sale.department}</td>
                  <td className="p-3 text-center">{sale.items?.length || 0}</td>
                  <td className="p-3 text-right font-mono text-emerald-400">{sale.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
