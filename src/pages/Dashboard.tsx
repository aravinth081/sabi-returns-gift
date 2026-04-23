   // ==========================================
// 5 STEPS INTEGRATION
// Step 1: Ensure dependencies are installed -> `npm install firebase lucide-react recharts xlsx html2canvas`
// Step 2: Verify Firebase config credentials match your Firebase Console.
// Step 3: Update Firestore database rules to allow read/write during development.
// Step 4: Ensure TailwindCSS is fully set up in your tailwind.config.js for styling.
// Step 5: Start the application using `npm start` or `npm run dev`.
// ==========================================

import React, { useState, useMemo, useRef, useEffect } from "react";
// --- FIREBASE IMPORTS ADDED ---
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy 
} from "firebase/firestore";
// ------------------------------

import { 
  Home, User, Plus, Download, Eye, EyeOff, Pencil, Trash2, Calendar, CheckCircle, Clock, ShoppingBag, Search, TrendingUp, Package, MapPin, X, IndianRupee, Menu, Filter, Camera, Power, Lock, MessageSquare, Upload, MoreVertical, Truck, ChevronDown, Archive, Book, Receipt
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
// Removed: import sabiLogo from "../assets/sabi-logo.png";
import OrderInvoiceView from "@/components/OrderInvoiceView";
// --- FIREBASE SETUP ---
const firebaseConfig = {
  apiKey: "AIzaSyA2zPg2iKK5oTYqctmqQt3N5wUNOoZ8Kp8",
  authDomain: "sabireturngifts-4d5ae.firebaseapp.com",
  projectId: "sabireturngifts-4d5ae",
  storageBucket: "sabireturngifts-4d5ae.firebasestorage.app",
  messagingSenderId: "414247562076",
  appId: "1:414247562076:web:cca1d1ce00849d851cef99"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
// ----------------------

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ffc658', '#ff7300'];

const CHOCOLATE_PRICES_MAP: Record<string, number> = {
  "kitkat": 20, "dairy milk": 15, "dairymilk": 15, "peanut candy": 17, "5 star": 15,
  "10 rs dairy milk": 20, "dairymilk shots": 10, "10 rs 5 star": 22, "1 rs chocolate": 8,
  "milky bar": 10, "snickers": 20, "bounty": 20, "munch": 10, "perk": 10,
  "ferrero rocher": 50, "toblerone": 50, "kinder joy": 40, "hershey's": 30, "gems": 10,
};

const CHOCOLATE_PURCHASE_MAP: Record<string, number> = {
  "dairymilk": 4.5, "dairy milk": 4.5, "5 star": 4.5, "kitkat": 9.5,
  "10 rs dairy milk": 9.5, "dairymilk shots": 1.5, "peanut candy": 4.5,
  "milky bar": 4.5, "10 rs 5 star": 9.5, "1 rs chocolate": 0.5,
  "snickers": 10, "bounty": 10, "munch": 5, "perk": 5
};

const TRACKED_INVENTORY = [
  "Kitkat", "Dairy Milk", "Peanut Candy", "5 Star", 
  "10 rs Dairy Milk", "Dairymilk Shots", "10 rs 5 Star", "Milky Bar"
];

const normalizeChocName = (name: string) => {
  const lower = name.trim().toLowerCase();
  if(lower === 'dairymilk') return 'Dairy Milk';
  if(lower === 'dairy milk') return 'Dairy Milk';
  if(lower === '10 rs dairymilk') return '10 rs Dairy Milk';
  if(lower === '10 rs dairy milk') return '10 rs Dairy Milk';
  const found = TRACKED_INVENTORY.find(t => t.toLowerCase() === lower);
  return found || name.trim();
};

const calculatePriceInfo = (chocolateString: string, count: number | string, discountValue: number | string = 0, isDeliveryFree: boolean = false, paymentStatus: string = "Full Paid", category: string = "chocolate", customPricesMap: Record<string, number> = {}, manualDeliveryFee: number | string = 0, orderStatus: string = "") => {
  const quantity = Number(count) || 0;
  if (!chocolateString || quantity === 0) return { unitPrice: 0, chocolatePrice: 0, deliveryCharge: 0, discount: 0, totalPrice: 0, revenue: 0, fullChocolatePrice: 0, fullDeliveryCharge: 0, fullTotalPrice: 0 };
  
  const chocs = String(chocolateString).split(',').map(c => c.trim()).filter(Boolean); 
  let sumPrice = 0;
  chocs.forEach(c => { 
      if (category === 'product') {
          sumPrice += (customPricesMap[c.toLowerCase()] || 0);
      } else {
          sumPrice += (CHOCOLATE_PRICES_MAP[c.toLowerCase()] || 0); 
      }
  });

  let unitPrice = 0;
  if (chocs.length > 0) unitPrice = sumPrice / chocs.length;

  const baseChocolatePrice = Number((unitPrice * quantity).toFixed(2));
  
  let baseDeliveryCharge = 0;
  if (category === 'product') {
      baseDeliveryCharge = isDeliveryFree ? 0 : Number(manualDeliveryFee) || 0;
  } else {
      baseDeliveryCharge = isDeliveryFree ? 0 : (quantity > 99 ? 200 : 150);
  }

  const baseDiscountAmt = Number(discountValue) || 0;
  
  let rawTotal = baseChocolatePrice + baseDeliveryCharge - baseDiscountAmt;
  if (rawTotal < 0) rawTotal = 0;

  // Multiplier logic for perfectly scaling the prices up/down based on payment and status
  let multiplier = 1;
  if (paymentStatus === 'Partially Paid') multiplier = 0.5;
  else if (paymentStatus === 'Pending') multiplier = 0;

  if (orderStatus === 'cancelled') multiplier = 0;

  const chocolatePrice = Math.round(baseChocolatePrice * multiplier);
  const deliveryCharge = Math.round(baseDeliveryCharge * multiplier);
  const discount = Math.round(baseDiscountAmt * multiplier);
  const finalTotal = Math.round(rawTotal * multiplier);

  return { 
    unitPrice: Number(unitPrice.toFixed(2)), 
    chocolatePrice, 
    deliveryCharge, 
    discount, 
    totalPrice: finalTotal, 
    revenue: finalTotal,
    fullChocolatePrice: Math.round(baseChocolatePrice),
    fullDeliveryCharge: Math.round(baseDeliveryCharge),
    fullTotalPrice: Math.round(rawTotal)
  };
};

const parseDateToYYYYMMDD = (displayDate: string) => {
  if (!displayDate) return "";
  if (String(displayDate).includes("-")) return displayDate; 
  const currentYear = new Date().getFullYear();
  const d = new Date(`${displayDate} ${currentYear}`);
  if (isNaN(d.getTime())) return ""; 
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
};

const formatToDisplayDate = (dateStr: any) => {
  if (!dateStr) return "";
  if (typeof dateStr === 'number') {
    const date = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
  if (typeof dateStr === 'string') {
    const str = dateStr.trim();
    if (/^\d{1,2}\s+[a-zA-Z]{3}$/.test(str)) return str;
    if (!str.includes("-") && !str.includes("/")) return str;
    const date = new Date(str);
    if (!isNaN(date.getTime())) return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
  return String(dateStr);
};

const PREDEFINED_CHOCOLATES = [
  "Kitkat", "Dairy Milk", "Peanut Candy", "5 Star", "10 rs Dairy Milk", 
  "Dairymilk Shots", "10 rs 5 Star", "1 rs Chocolate",
  "Milky Bar", 
];

const ChocolateMultiSelect = ({ value, onChange, suggestions, pricesMap, placeholderText = "Select chocolates..." }: { value: string, onChange: (val: string) => void, suggestions: string[], pricesMap?: Record<string, number>, placeholderText?: string }) => {
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selected = value ? String(value).split(',').map(s => s.trim()).filter(Boolean) : [];

  const filteredSuggestions = suggestions.filter(
    s => s.toLowerCase().includes(input.toLowerCase()) && !selected.some(sel => sel.toLowerCase() === s.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAdd = (choc: string) => {
    if (!choc) return;
    if (!selected.some(s => s.toLowerCase() === choc.toLowerCase())) onChange([...selected, choc].join(', '));
    setInput("");
    inputRef.current?.focus(); 
  };

  const handleRemove = (chocToRemove: string) => onChange(selected.filter(c => c !== chocToRemove).join(', '));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (input.trim()) {
        const exactMatch = filteredSuggestions.find(s => s.toLowerCase() === input.trim().toLowerCase());
        if (exactMatch) handleAdd(exactMatch);
        else if (filteredSuggestions.length > 0) handleAdd(filteredSuggestions[0]); 
        else handleAdd(input.trim()); 
      }
    } else if (e.key === 'Backspace' && !input && selected.length > 0) handleRemove(selected[selected.length - 1]);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div onClick={() => inputRef.current?.focus()} className={`flex flex-wrap gap-2 p-2 border rounded-lg bg-white focus-within:ring-2 focus-within:ring-amber-500 border-amber-200 min-h-[46px] max-h-[100px] overflow-y-auto items-center cursor-text`}>
        {selected.map((choc, idx) => (
          <span key={idx} className="flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-1 rounded-md text-sm font-bold">
            {choc}
            <button type="button" onClick={(e) => { e.stopPropagation(); handleRemove(choc); }} className="text-amber-600 hover:text-red-500 rounded-full focus:outline-none"><X size={14} /></button>
          </span>
        ))}
        <input ref={inputRef} type="text" value={input} onChange={(e) => { setInput(e.target.value); setIsOpen(true); }} onKeyDown={handleKeyDown} onFocus={() => setIsOpen(true)} className="flex-1 min-w-[120px] outline-none bg-transparent text-amber-950 font-medium placeholder-amber-400 text-sm" placeholder={selected.length === 0 ? placeholderText : ""} />
      </div>
      {isOpen && filteredSuggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-amber-200 rounded-lg shadow-lg max-h-48 overflow-y-auto py-1">
          {filteredSuggestions.map((s, i) => (
            <div key={i} className="px-4 py-2 cursor-pointer hover:bg-amber-50 text-amber-900 text-sm font-medium flex justify-between items-center" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAdd(s); }}>
              <span>{s}</span>
              {pricesMap ? (
                 pricesMap[s.toLowerCase()] !== undefined && (<span className="text-xs text-amber-500 font-bold">₹{pricesMap[s.toLowerCase()]}</span>)
              ) : (
                 CHOCOLATE_PRICES_MAP[s.toLowerCase()] && (<span className="text-xs text-amber-500 font-bold">₹{CHOCOLATE_PRICES_MAP[s.toLowerCase()]}</span>)
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function Dashboard() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('isLoggedIn') === 'true');
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showPassword, setShowPassword] = useState(false); 
  const [loggedInName, setLoggedInName] = useState(() => localStorage.getItem('loggedInName') || ""); 
  const [role, setRole] = useState<'Admin' | 'Employee'>(() => (localStorage.getItem('role') as any) || 'Admin');
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<any>(null);
  
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [adminDateType, setAdminDateType] = useState<string>('Delivery Date');
  const [adminDateRange, setAdminDateRange] = useState({ from: "", to: "" });
  
  // 🟢 NEW STATES FOR ADMIN REPORT VIEW
  const [adminReportDash, setAdminReportDash] = useState<'None' | 'Dashboard 1' | 'Dashboard 2'>('None');
  const [adminReportMenuOpen, setAdminReportMenuOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<any[]>([]);
  
  const [customProducts, setCustomProducts] = useState<any[]>([]);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [newProductForm, setNewProductForm] = useState({ name: "", price: "" });
  const [editProductId, setEditProductId] = useState<string | null>(null);

  useEffect(() => {
    const unsubOrders = onSnapshot(collection(db, "orders"), (snapshot) => {
      const ordersList = snapshot.docs.map(doc => ({ fireId: doc.id, ...doc.data() }));
      ordersList.sort((a: any, b: any) => b.id - a.id); 
      setOrders(ordersList);
    });
    const unsubEmployees = onSnapshot(collection(db, "employees"), (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ fireId: doc.id, ...doc.data() })));
    });
    const unsubInventory = onSnapshot(collection(db, "inventory"), (snapshot) => {
      const invList = snapshot.docs.map(doc => ({ fireId: doc.id, ...doc.data() }));
      invList.sort((a: any, b: any) => b.timestamp - a.timestamp); 
      setInventoryLogs(invList);
    });
    const unsubProducts = onSnapshot(collection(db, "products"), (snapshot) => {
      setCustomProducts(snapshot.docs.map(doc => ({ fireId: doc.id, ...doc.data() })));
    });

    return () => { unsubOrders(); unsubEmployees(); unsubInventory(); unsubProducts(); };
  }, []);

  const [regData, setRegData] = useState({ name: "", username: "", password: "" });
  const [showApprovalPanel, setShowApprovalPanel] = useState(false);
  const [openActionId, setOpenActionId] = useState<number | null>(null);
  
  const [activeTab, setActiveTab] = useState<'dashboard1' | 'dashboard2' | 'tracking' | 'reports' | 'inventories'>(
    (localStorage.getItem('activeTab') as any) || 'dashboard1'
  );

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [paymentFilter, setPaymentFilter] = useState<'All' | 'Full Paid' | 'Partially Paid' | 'Pending'>('All');
  const [deliveryFilter, setDeliveryFilter] = useState<'All' | 'Delivered' | 'In Process'>('All');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('All');
  const [tableTypeFilter, setTableTypeFilter] = useState<string>('All'); 
  
  const [revenueDateType, setRevenueDateType] = useState<string>('Delivery Date');
  const [dateFilter, setDateFilter] = useState({ from: "", to: "" });
  const [reportDateRange, setReportDateRange] = useState({ start: "", end: "" });
  const [reportDashboardFilter, setReportDashboardFilter] = useState("All");

  const [isAdminAuthModalOpen, setIsAdminAuthModalOpen] = useState(false);
  const [adminCreds, setAdminCreds] = useState({ username: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [isInvModalOpen, setIsInvModalOpen] = useState(false);
  const [invForm, setInvForm] = useState({
    date: new Date().toISOString().split('T')[0],
    chocolate: "Kitkat",
    boxCount: "",
    itemsPerBox: ""
  });

  const [salesTrackerChoc, setSalesTrackerChoc] = useState("All");
  const [salesTrackerFrom, setSalesTrackerFrom] = useState("");
  const [salesTrackerTo, setSalesTrackerTo] = useState("");

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminCreds.password === "4567") {
      setIsAuthenticated(true);
      setIsAdminAuthModalOpen(false);
      setAuthError("");
      setAdminCreds({ username: "", password: "" });
      setActiveTab('admin_panel' as any); 
    } else {
      setAuthError("Invalid Password!");
    }
  };
  
  const [functionDates, setFunctionDates] = useState<string[]>([]);
  const [deliveryDates, setDeliveryDates] = useState<string[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isExportPreviewOpen, setIsExportPreviewOpen] = useState(false);
  const [isReportPreviewOpen, setIsReportPreviewOpen] = useState(false);
  const [isShippingOpen, setIsShippingOpen] = useState(false);
  const [shippingOrder, setShippingOrder] = useState<any>(null);

  const [formData, setFormData] = useState({ id: null as any, fireId: null as any, name: "", phone: "", orderDate: "", functionDate: "", deliveryDate: "", chocolate: "", count: "", address: "", status: "In Process", paymentStatus: "Pending", discount: 0, isDeliveryFree: false, orderType: "Others", orderStatus: "image edit (pending)", category: "chocolate", manualDeliveryFee: "", advanceAmount: "" });
  const [previewData, setPreviewData] = useState<any>(null);

  const [dashboardSearch, setDashboardSearch] = useState("");
  const [trackingSearch, setTrackingSearch] = useState("");

  const [countFilter, setCountFilter] = useState<string>('All');
  const uniqueCounts = useMemo(() => Array.from(new Set(orders.map(o => Number(o.count)))).sort((a, b) => a - b), [orders]);

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const uniqueNames = useMemo(() => Array.from(new Set(orders.map(o => o.name))), [orders]);
  const uniquePhones = useMemo(() => Array.from(new Set(orders.map(o => o.phone))), [orders]);

  // Sequential serial number map: oldest order = SR001, next = SR002, etc.
  const orderSerialMap = useMemo(() => {
    const sorted = [...orders].sort((a, b) => a.id - b.id);
    const map: Record<number, number> = {};
    sorted.forEach((order, index) => { map[order.id] = index + 1; });
    return map;
  }, [orders]);
  const getSerial = (id: number) => `SR${String(orderSerialMap[id] || id).padStart(3, '0')}`;
  const uniqueChocolates = useMemo(() => {
    const allChocs = new Set<string>(PREDEFINED_CHOCOLATES); 
    orders.forEach(o => {
      if (o.chocolate) { String(o.chocolate).split(',').forEach(c => allChocs.add(c.trim())); }
    });
    return Array.from(allChocs).filter(Boolean);
  }, [orders]);

  const customPricesMap = useMemo(() => {
    const map: Record<string, number> = {};
    customProducts.forEach(p => map[p.name.toLowerCase()] = Number(p.price));
    return map;
  }, [customProducts]);

  const inventoryBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    TRACKED_INVENTORY.forEach(c => balances[c] = 0);

    inventoryLogs.forEach(log => {
       const key = normalizeChocName(String(log.chocolate));
       if (balances[key] !== undefined) {
          const qty = Number(log.boxCount || 0) * Number(log.itemsPerBox || 0);
          balances[key] += qty; 
       }
    });

    orders.forEach(order => {
       if (order.orderStatus === 'cancelled') return; 
       if (!order.chocolate) return;

       const orderChocs = String(order.chocolate).split(',');
       const orderQty = Number(order.count || 0);

       orderChocs.forEach(c => {
          const key = normalizeChocName(c);
          if (balances[key] !== undefined) {
             balances[key] -= orderQty; 
          }
       });
    });

    return balances;
  }, [inventoryLogs, orders]);

  const trackedSalesResult = useMemo(() => {
    if (!salesTrackerChoc) return { count: 0, revenue: 0 };
    let count = 0;
    let revenue = 0;
    
    orders.forEach(order => {
      if (order.orderStatus === 'cancelled') return; 
      
      const orderDateStr = parseDateToYYYYMMDD(order.deliveryDate || order.orderDate);
      if (salesTrackerFrom || salesTrackerTo) {
         if (!orderDateStr) return;
         const oTime = new Date(orderDateStr).getTime();
         const fTime = salesTrackerFrom ? new Date(salesTrackerFrom).getTime() : 0;
         const tTime = salesTrackerTo ? new Date(salesTrackerTo).getTime() : Infinity;
         if (oTime < fTime || oTime > tTime) return;
      }

      if (order.chocolate) {
         const chocs = String(order.chocolate).split(',').map(c => normalizeChocName(c.trim()));
         
         if (salesTrackerChoc === 'All') {
            if (order.category !== 'product') {
               const orderQty = Number(order.count || 0);
               count += orderQty;
               const priceInfo = calculatePriceInfo(order.chocolate, order.count, order.discount, order.isDeliveryFree, order.paymentStatus, order.category, customPricesMap, order.manualDeliveryFee, order.orderStatus);
               revenue += priceInfo.chocolatePrice;
            }
         } else {
            const targetChoc = normalizeChocName(salesTrackerChoc);
            if (chocs.includes(targetChoc) && order.category !== 'product') {
               const orderQty = Number(order.count || 0);
               count += orderQty;
               
               let multiplier = 1;
               if (order.paymentStatus === 'Partially Paid') multiplier = 0.5;
               else if (order.paymentStatus === 'Pending') multiplier = 0;
               
               const basePrice = CHOCOLATE_PRICES_MAP[targetChoc.toLowerCase()] || 0;
               revenue += (orderQty * basePrice * multiplier);
            }
         }
      }
    });
    return { count, revenue: Math.round(revenue) };
  }, [orders, salesTrackerChoc, salesTrackerFrom, salesTrackerTo, customPricesMap]);

  const filteredDashboardOrders = useMemo(() => {
    return orders.filter(order => {
      const pMatch = paymentFilter === 'All' || order.paymentStatus === paymentFilter;
      const dMatch = deliveryFilter === 'All' || order.status === deliveryFilter;
      const osMatch = orderStatusFilter === 'All' || (order.orderStatus || "image edited (not paid)") === orderStatusFilter;
      
      let rangeMatch = true;
      if (dateFilter.from || dateFilter.to) {
        let targetDateStr = "";
        if (revenueDateType === 'Serial No') targetDateStr = parseDateToYYYYMMDD(order.orderDate);
        else if (revenueDateType === 'Order Date') targetDateStr = parseDateToYYYYMMDD(order.orderDate);
        else if (revenueDateType === 'Function Date') targetDateStr = parseDateToYYYYMMDD(order.functionDate);
        else targetDateStr = parseDateToYYYYMMDD(order.deliveryDate); 

        if (targetDateStr) {
          const orderTime = new Date(targetDateStr).getTime();
          const fromTime = dateFilter.from ? new Date(dateFilter.from).getTime() : 0;
          const toTime = dateFilter.to ? new Date(dateFilter.to).getTime() : Infinity;
          rangeMatch = orderTime >= fromTime && orderTime <= toTime;
        }
      }

      let fDateMatch = true;
      if (functionDates.length > 0) {
        const orderFDate = parseDateToYYYYMMDD(order.functionDate);
        fDateMatch = functionDates.includes(orderFDate);
      }

      let tDelDateMatch = true;
      if (deliveryDates.length > 0) {
        const orderDDate = parseDateToYYYYMMDD(order.deliveryDate);
        tDelDateMatch = deliveryDates.includes(orderDDate);
      }

      let searchMatch = true;
      if (dashboardSearch.trim()) {
        const query = dashboardSearch.toLowerCase().trim();
        searchMatch = order.name.toLowerCase().includes(query) || order.phone.includes(query);
      }

      const countMatch = countFilter === 'All' || order.count.toString() === countFilter;
      const typeMatch = tableTypeFilter === 'All' || (order.orderType || "Others") === tableTypeFilter; 

      const isProduct = order.category === 'product';
      const categoryMatch = activeTab === 'dashboard2' ? isProduct : !isProduct;

      return pMatch && dMatch && osMatch && rangeMatch && fDateMatch && tDelDateMatch && searchMatch && countMatch && typeMatch && categoryMatch; 
    });
  }, [activeTab, orders, paymentFilter, deliveryFilter, orderStatusFilter, dateFilter, functionDates, deliveryDates, dashboardSearch, countFilter, revenueDateType, tableTypeFilter]); 

  const { totalOrders, deliveredCount, inProcessCount, totalItems, topChocolates, totalRevenue, totalDeliveryCharge } = useMemo(() => {
    const total = filteredDashboardOrders.length;
    const delivered = filteredDashboardOrders.filter(o => o.status === "Delivered").length;
    const inProcess = filteredDashboardOrders.filter(o => o.status === "In Process").length;
    const items = filteredDashboardOrders.reduce((sum, o) => sum + Number(o.count || 0), 0);

    const chocolateCounts: Record<string, number> = {};
    let netRevenue = 0; 
    let totalDelivery = 0; 

    filteredDashboardOrders.forEach(o => {
      const priceInfo = calculatePriceInfo(o.chocolate, o.count, o.discount, o.isDeliveryFree, o.paymentStatus, o.category, customPricesMap, o.manualDeliveryFee, o.orderStatus);
      
      netRevenue += priceInfo.revenue; 
      if (o.paymentStatus !== 'Pending') {
        totalDelivery += priceInfo.deliveryCharge;
      }

      if (o.chocolate) {
        String(o.chocolate).split(',').map((c: string) => c.trim()).filter(Boolean).forEach((key: string) => { 
          chocolateCounts[key] = (chocolateCounts[key] || 0) + Number(o.count || 0); 
        });
      }
    });
    
    const top = Object.entries(chocolateCounts).sort((a, b) => b[1] - a[1]);
    return { 
      totalOrders: total, 
      deliveredCount: delivered, 
      inProcessCount: inProcess, 
      totalItems: items, 
      topChocolates: top, 
      totalRevenue: netRevenue,
      totalDeliveryCharge: totalDelivery
    };
  }, [filteredDashboardOrders, customPricesMap]);

  const costAnalyticsData = useMemo(() => {
    let baseOrders = orders.filter(order => order.status === "Delivered" || order.status === "In Process");

    if (adminDateRange.from || adminDateRange.to) {
      baseOrders = baseOrders.filter(order => {
        let targetDateStr = "";
        if (adminDateType === 'Order Date') targetDateStr = parseDateToYYYYMMDD(order.orderDate);
        else if (adminDateType === 'Function Date') targetDateStr = parseDateToYYYYMMDD(order.functionDate);
        else targetDateStr = parseDateToYYYYMMDD(order.deliveryDate);

        if (!targetDateStr) return false;

        const orderTime = new Date(targetDateStr).getTime();
        const fromTime = adminDateRange.from ? new Date(adminDateRange.from).getTime() : 0;
        const toTime = adminDateRange.to ? new Date(adminDateRange.to).getTime() : Infinity;

        return orderTime >= fromTime && orderTime <= toTime;
      });
    }

    const rows = baseOrders.map(order => {
       const serialNo = getSerial(order.id);
       const deliveryDate = order.deliveryDate || "-"; 
       const chocolateName = order.chocolate || "N/A";
       const count = Number(order.count) || 0;
       
       const chocs = String(chocolateName).split(',').map(c => c.trim()).filter(Boolean);
       let sumPurchase = 0;
       chocs.forEach(c => {
          sumPurchase += (CHOCOLATE_PURCHASE_MAP[c.toLowerCase()] || 0);
       });
       const purchasePricePerItem = chocs.length > 0 ? sumPurchase / chocs.length : 0;

       const stickerCost = count * 1.5;
       const labourCost = count * 1;
       const totalPurchase = purchasePricePerItem * count;
       const finalCost = stickerCost + labourCost + totalPurchase;

       return { serialNo, deliveryDate, chocolateName, purchasePricePerItem, count, stickerCost, labourCost, totalPurchase, finalCost };
    });

    rows.sort((a, b) => b.finalCost - a.finalCost);

    const grandTotals = rows.reduce((acc, row) => {
       acc.count += row.count;
       acc.stickerCost += row.stickerCost;
       acc.labourCost += row.labourCost;
       acc.totalPurchase += row.totalPurchase;
       acc.finalCost += row.finalCost;
       return acc;
    }, { count: 0, stickerCost: 0, labourCost: 0, totalPurchase: 0, finalCost: 0 });

    return { rows, grandTotals };
  }, [orders, adminDateRange, adminDateType]); 

  // 🟢 NEW: Calculated Report Data exclusively for the Admin Panel Dropdown
  const adminReportData = useMemo(() => {
    if (adminReportDash === 'None') return null;

    let baseOrders = orders.filter(order => order.status === "Delivered" || order.status === "In Process");

    if (adminDateRange.from || adminDateRange.to) {
      baseOrders = baseOrders.filter(order => {
        let targetDateStr = "";
        if (adminDateType === 'Order Date') targetDateStr = parseDateToYYYYMMDD(order.orderDate);
        else if (adminDateType === 'Function Date') targetDateStr = parseDateToYYYYMMDD(order.functionDate);
        else targetDateStr = parseDateToYYYYMMDD(order.deliveryDate);

        if (!targetDateStr) return false;

        const orderTime = new Date(targetDateStr).getTime();
        const fromTime = adminDateRange.from ? new Date(adminDateRange.from).getTime() : 0;
        const toTime = adminDateRange.to ? new Date(adminDateRange.to).getTime() : Infinity;

        return orderTime >= fromTime && orderTime <= toTime;
      });
    }

    if (adminReportDash === 'Dashboard 1') {
      baseOrders = baseOrders.filter(o => o.category !== 'product');
    } else if (adminReportDash === 'Dashboard 2') {
      baseOrders = baseOrders.filter(o => o.category === 'product');
    }

    const itemCounts: Record<string, number> = {};
    let totalRev = 0;
    let totalItems = 0;
    let totalDelivery = 0;

    baseOrders.forEach(order => {
      const priceInfo = calculatePriceInfo(order.chocolate, order.count, order.discount, order.isDeliveryFree, order.paymentStatus, order.category, customPricesMap, order.manualDeliveryFee, order.orderStatus);
      totalRev += priceInfo.revenue;
      totalItems += Number(order.count || 0);
      totalDelivery += priceInfo.deliveryCharge;

      if (order.chocolate) {
        String(order.chocolate).split(',').map((c: string) => c.trim()).filter(Boolean).forEach((key: string) => {
          itemCounts[key] = (itemCounts[key] || 0) + Number(order.count || 0);
        });
      }
    });

    const topChocs = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]);
    const chartData = topChocs.slice(0, 8).map(([name, count]) => ({ name, count }));

    return { filteredOrders: baseOrders, topChocs, chartData, totalRev, totalItems, totalDeliveryCharge: totalDelivery };
  }, [orders, adminDateRange, adminDateType, adminReportDash, customPricesMap]);

  const trackingSearchResults = useMemo(() => {
    let result = orders;
    
    if (paymentFilter !== 'All') {
      result = result.filter(o => o.paymentStatus === paymentFilter);
    }
    if (deliveryFilter !== 'All') {
      result = result.filter(o => o.status === deliveryFilter);
    }
    if (orderStatusFilter !== 'All') {
      result = result.filter(o => (o.orderStatus || "image edited (not paid)") === orderStatusFilter);
    }

    if (trackingSearch.trim()) {
      const lowerSearch = trackingSearch.toLowerCase().trim();
      result = result.filter(o => o.name.toLowerCase().includes(lowerSearch) || o.phone.includes(lowerSearch));
    }

    return result;
  }, [orders, trackingSearch, paymentFilter, deliveryFilter, orderStatusFilter]); 

  const sortedDashboardOrders = useMemo(() => {
    let sortable = [...filteredDashboardOrders];
    if (sortConfig !== null) {
      sortable.sort((a, b) => {
        if (sortConfig.key === 'id') {
          return sortConfig.direction === 'asc' ? a.id - b.id : b.id - a.id;
        }
        if (sortConfig.key === 'orderDate') {
          const dateA = new Date(parseDateToYYYYMMDD(a.orderDate) || 0).getTime();
          const dateB = new Date(parseDateToYYYYMMDD(b.orderDate) || 0).getTime();
          return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
        }
        return 0;
      });
    }
    return sortable;
  }, [filteredDashboardOrders, sortConfig]);

  const reportData = useMemo(() => {
    let filtered = orders;
    
    if (reportDateRange.start || reportDateRange.end) {
      filtered = filtered.filter(order => {
        const orderDateStr = parseDateToYYYYMMDD(order.deliveryDate);
        const orderTime = orderDateStr ? new Date(orderDateStr).getTime() : 0;
        const startTime = reportDateRange.start ? new Date(reportDateRange.start).getTime() : 0;
        const endTime = reportDateRange.end ? new Date(reportDateRange.end).getTime() : Infinity;
        return orderTime >= startTime && orderTime <= endTime;
      });
    }

    if (reportDashboardFilter !== "All") {
      filtered = filtered.filter(order => {
        const isProduct = order.category === 'product';
        if (reportDashboardFilter === "Dashboard 1") return !isProduct;
        if (reportDashboardFilter === "Dashboard 2") return isProduct;
        return true;
      });
    }

    const chocolateCounts: Record<string, number> = {};
    let totalRev = 0;
    let totalItems = 0;
    let totalDelivery = 0;

    filtered.forEach(order => {
      if(order.status === "Delivered" || order.status === "In Process") { 
         const priceInfo = calculatePriceInfo(order.chocolate, order.count, order.discount, order.isDeliveryFree, order.paymentStatus, order.category, customPricesMap, order.manualDeliveryFee, order.orderStatus);
         totalRev += priceInfo.revenue;
         totalItems += Number(order.count || 0);
         totalDelivery += priceInfo.deliveryCharge;

         if (order.chocolate) {
           String(order.chocolate).split(',').map((c: string) => c.trim()).filter(Boolean).forEach((key: string) => {
             chocolateCounts[key] = (chocolateCounts[key] || 0) + Number(order.count || 0);
           });
         }
      }
    });

    const topChocs = Object.entries(chocolateCounts).sort((a, b) => b[1] - a[1]);
    const chartData = topChocs.slice(0, 8).map(([name, count]) => ({ name, count }));

    return { filteredOrders: filtered, topChocs, chartData, totalRev, totalItems, totalDeliveryCharge: totalDelivery };
  }, [orders, reportDateRange, customPricesMap, reportDashboardFilter]);

  const displayRevenue = useMemo(() => {
    return filteredDashboardOrders.reduce((sum, o) => {
      const priceInfo = calculatePriceInfo(o.chocolate, o.count, o.discount, o.isDeliveryFree, o.paymentStatus, o.category, customPricesMap, o.manualDeliveryFee, o.orderStatus);
      return sum + priceInfo.totalPrice; 
    }, 0);
  }, [filteredDashboardOrders, customPricesMap]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const visibleIds = filteredDashboardOrders.map(o => o.id);
      setSelectedOrders([...new Set([...selectedOrders, ...visibleIds])]);
    } else {
      const visibleIds = filteredDashboardOrders.map(o => o.id);
      setSelectedOrders(selectedOrders.filter(id => !visibleIds.includes(id)));
    }
  };

  const handleSelectOrder = (id: number) => {
    if (selectedOrders.includes(id)) {
      setSelectedOrders(selectedOrders.filter(orderId => orderId !== id));
    } else {
      setSelectedOrders([...selectedOrders, id]);
    }
  };

  const visibleIds = filteredDashboardOrders.map(o => o.id);
  const isAllSelected = visibleIds.length > 0 && visibleIds.every(id => selectedOrders.includes(id));

  const handleBulkAction = async (actionType: string) => {
    try {
      const selectedFireOrders = orders.filter(o => selectedOrders.includes(o.id));
      
      for (const order of selectedFireOrders) {
        const orderRef = doc(db, "orders", order.fireId);
        let updatedOrder = { ...order };
        
        if (actionType === "Delivered" || actionType === "In Process") {
           updatedOrder.status = actionType;
        } else {
           updatedOrder.paymentStatus = actionType;
        }
        
        const priceData = calculatePriceInfo(updatedOrder.chocolate, updatedOrder.count, updatedOrder.discount, updatedOrder.isDeliveryFree, updatedOrder.paymentStatus, updatedOrder.category, customPricesMap, updatedOrder.manualDeliveryFee, updatedOrder.orderStatus);
        
        await updateDoc(orderRef, { 
           status: updatedOrder.status, 
           paymentStatus: updatedOrder.paymentStatus,
           totalOrderPrice: priceData.totalPrice, 
           itemSubtotal: priceData.chocolatePrice, 
           calculatedDeliveryFee: priceData.deliveryCharge 
        });
      }
      setSelectedOrders([]);
    } catch (err) { console.error("Bulk action failed:", err); }
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`Are you sure you want to delete ${selectedOrders.length} records?`)) {
      try {
        const selectedFireOrders = orders.filter(o => selectedOrders.includes(o.id));
        for (const order of selectedFireOrders) {
          await deleteDoc(doc(db, "orders", order.fireId));
        }
        setSelectedOrders([]);
      } catch (err) { console.error("Bulk delete failed:", err); }
    }
  };

  const handleDiscountUpdate = async (id: number, fireId: string, value: string) => {
    const numValue = Number(value) || 0;
    const orderToUpdate = orders.find(o => o.id === id);
    if(!orderToUpdate) return;
    
    const updatedOrder = { ...orderToUpdate, discount: numValue };
    const priceData = calculatePriceInfo(updatedOrder.chocolate, updatedOrder.count, updatedOrder.discount, updatedOrder.isDeliveryFree, updatedOrder.paymentStatus, updatedOrder.category, customPricesMap, updatedOrder.manualDeliveryFee, updatedOrder.orderStatus);

    setOrders(prev => prev.map(o => o.id === id ? { ...o, discount: numValue, totalOrderPrice: priceData.totalPrice, itemSubtotal: priceData.chocolatePrice, calculatedDeliveryFee: priceData.deliveryCharge } : o));
    if (fireId) {
      try { await updateDoc(doc(db, "orders", fireId), { discount: numValue, totalOrderPrice: priceData.totalPrice, itemSubtotal: priceData.chocolatePrice, calculatedDeliveryFee: priceData.deliveryCharge }); } catch (e) {}
    }
  };

  const handlePaymentStatusUpdate = async (id: any, fireId: string, newPaymentStatus: string) => {
    const orderToUpdate = orders.find(o => o.id === id);
    if(!orderToUpdate) return;

    const updatedOrder = { ...orderToUpdate, paymentStatus: newPaymentStatus };
    const priceData = calculatePriceInfo(updatedOrder.chocolate, updatedOrder.count, updatedOrder.discount, updatedOrder.isDeliveryFree, updatedOrder.paymentStatus, updatedOrder.category, customPricesMap, updatedOrder.manualDeliveryFee, updatedOrder.orderStatus);

    setOrders(prev => prev.map(o => o.id === id ? { ...o, paymentStatus: newPaymentStatus, totalOrderPrice: priceData.totalPrice, itemSubtotal: priceData.chocolatePrice, calculatedDeliveryFee: priceData.deliveryCharge } : o));
    if (fireId) {
      try { await updateDoc(doc(db, "orders", fireId), { paymentStatus: newPaymentStatus, totalOrderPrice: priceData.totalPrice, itemSubtotal: priceData.chocolatePrice, calculatedDeliveryFee: priceData.deliveryCharge }); } catch (e) {}
    }
  };

  const handleDeliveryStatusUpdate = async (id: any, fireId: string, newStatus: string) => {
    const orderToUpdate = orders.find(o => o.id === id);
    if(!orderToUpdate) return;

    const updatedOrder = { ...orderToUpdate, status: newStatus };
    const priceData = calculatePriceInfo(updatedOrder.chocolate, updatedOrder.count, updatedOrder.discount, updatedOrder.isDeliveryFree, updatedOrder.paymentStatus, updatedOrder.category, customPricesMap, updatedOrder.manualDeliveryFee, updatedOrder.orderStatus);

    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus, totalOrderPrice: priceData.totalPrice, itemSubtotal: priceData.chocolatePrice, calculatedDeliveryFee: priceData.deliveryCharge } : o));
    if (fireId) {
      try { await updateDoc(doc(db, "orders", fireId), { status: newStatus, totalOrderPrice: priceData.totalPrice, itemSubtotal: priceData.chocolatePrice, calculatedDeliveryFee: priceData.deliveryCharge }); } catch (e) {}
    }
  };

  const handleOrderStatusUpdate = async (id: any, fireId: string, newOrderStatus: string) => {
    const orderToUpdate = orders.find(o => o.id === id);
    if(!orderToUpdate) return;

    const updatedOrder = { ...orderToUpdate, orderStatus: newOrderStatus };
    const priceData = calculatePriceInfo(updatedOrder.chocolate, updatedOrder.count, updatedOrder.discount, updatedOrder.isDeliveryFree, updatedOrder.paymentStatus, updatedOrder.category, customPricesMap, updatedOrder.manualDeliveryFee, updatedOrder.orderStatus);

    setOrders(prev => prev.map(o => o.id === id ? { ...o, orderStatus: newOrderStatus, totalOrderPrice: priceData.totalPrice, itemSubtotal: priceData.chocolatePrice, calculatedDeliveryFee: priceData.deliveryCharge } : o));
    if (fireId) {
      try { await updateDoc(doc(db, "orders", fireId), { orderStatus: newOrderStatus, totalOrderPrice: priceData.totalPrice, itemSubtotal: priceData.chocolatePrice, calculatedDeliveryFee: priceData.deliveryCharge }); } catch (e) {}
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddClick = () => {
    const today = new Date().toISOString().split('T')[0];
    setFormData({ id: null, fireId: null, name: "", phone: "", orderDate: today, functionDate: today, deliveryDate: today, chocolate: "", count: "", address: "", status: "In Process", paymentStatus: "Pending", discount: 0, isDeliveryFree: false, orderType: "Others", orderStatus: "image edit (pending)", category: activeTab === 'dashboard2' ? 'product' : 'chocolate', manualDeliveryFee: "", advanceAmount: "" });
    setIsModalOpen(true);
  };

     const handleEditClick = (order: any) => {
    setFormData({ 
      ...order, 
      fireId: order.fireId, // 🟢 IMPORTANT: Ithu thaan edit aaga use aagum
      id: order.id,         
      orderDate: order.orderDate ? parseDateToYYYYMMDD(order.orderDate) : parseDateToYYYYMMDD(order.functionDate), 
      functionDate: parseDateToYYYYMMDD(order.functionDate),
      deliveryDate: parseDateToYYYYMMDD(order.deliveryDate),
      address: order.address || "",
      discount: order.discount || 0,
      isDeliveryFree: order.isDeliveryFree || false,
      isChennai: order.isChennai || false, 
      orderType: order.orderType || "Others",
      orderStatus: order.orderStatus || "image edit (pending)",
      category: order.category || (activeTab === 'dashboard2' ? 'product' : 'chocolate'),
      manualDeliveryFee: order.manualDeliveryFee || "",
      advanceAmount: order.advanceAmount || ""
    });
    setIsModalOpen(true);
  };

  const handlePreviewClick = (order: any) => {
    setPreviewData({ ...order, orderDate: order.orderDate || order.functionDate });
    setIsPreviewOpen(true);
  };

  const handleDeleteClick = async (id: any) => {
    if (window.confirm("Are you sure you want to delete this record?")) {
      const order = orders.find(o => o.id === id);
      if (order) {
        await deleteDoc(doc(db, "orders", order.fireId));
        setSelectedOrders(selectedOrders.filter(selectedId => selectedId !== id));
      }
    }
  };

 const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const priceData = calculatePriceInfo(formData.chocolate, formData.count, formData.discount, formData.isDeliveryFree || formData.isChennai, formData.paymentStatus, formData.category, customPricesMap, formData.manualDeliveryFee, formData.orderStatus);

    const formattedOrder: any = { 
      ...formData, 
      orderDate: formatToDisplayDate(formData.orderDate) || "",
      functionDate: formatToDisplayDate(formData.functionDate) || "",
      deliveryDate: formatToDisplayDate(formData.deliveryDate) || "",
      discount: Number(formData.discount) || 0,
      manualDeliveryFee: Number(formData.manualDeliveryFee) || 0,
      advanceAmount: Number(formData.advanceAmount) || 0,
      isDeliveryFree: Boolean(formData.isDeliveryFree || formData.isChennai), 
      isChennai: Boolean(formData.isChennai),
      totalOrderPrice: priceData.fullTotalPrice || 0,
      itemSubtotal: priceData.fullChocolatePrice || 0,
      calculatedDeliveryFee: priceData.fullDeliveryCharge || 0
    };
    
    try {
      if (formData.fireId) {
        const { fireId, ...dataToUpdate } = formattedOrder;
        
        // 🛠️ Automatic-a undefined error-a thadukkum code
        Object.keys(dataToUpdate).forEach(key => dataToUpdate[key] === undefined && delete dataToUpdate[key]);
        
        await updateDoc(doc(db, "orders", formData.fireId), dataToUpdate);
      } else {
        const nextId = orders.length > 0 ? Math.max(...orders.map(o => Number(o.id) || 0)) + 1 : 1;
        formattedOrder.id = nextId;
        delete formattedOrder.fireId; 
        
        // 🛠️ Automatic-a undefined error-a thadukkum code
        Object.keys(formattedOrder).forEach(key => formattedOrder[key] === undefined && delete formattedOrder[key]);
        
        await addDoc(collection(db, "orders"), formattedOrder);
      }
      
      setIsModalOpen(false);
      
      const today = new Date().toISOString().split('T')[0];
      setFormData({ id: null as any, fireId: null as any, name: "", phone: "", orderDate: today, functionDate: today, deliveryDate: today, chocolate: "", count: "", address: "", status: "In Process", paymentStatus: "Pending", discount: 0, isDeliveryFree: false, isChennai: false, orderType: "Others", orderStatus: "image edit (pending)", category: activeTab === 'dashboard2' ? 'product' : 'chocolate', manualDeliveryFee: "", advanceAmount: "" });
      
    } catch (err) { 
      console.error("Error saving:", err); 
      alert("Failed to save order. Please check console.");
    }
  };

  const handleAddInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invForm.boxCount || !invForm.itemsPerBox) return alert("Please fill all fields");
    
    const newEntry = {
      ...invForm,
      boxCount: Number(invForm.boxCount),
      itemsPerBox: Number(invForm.itemsPerBox),
      totalChocolates: Number(invForm.boxCount) * Number(invForm.itemsPerBox),
      type: "Purchase", 
      timestamp: Date.now()
    };

    setInventoryLogs(prev => [{ fireId: Date.now().toString(), ...newEntry }, ...prev]);

    try {
      await addDoc(collection(db, "inventory"), newEntry);
      setInvForm(prev => ({...prev, boxCount: "", itemsPerBox: ""}));
      setIsInvModalOpen(false);
    } catch(err) { console.error(err); }
  };

  const handleDeleteInventory = async (fireId: string) => {
    if(window.confirm("Delete this inventory entry?")) {
      setInventoryLogs(prev => prev.filter(log => log.fireId !== fireId));
      try { await deleteDoc(doc(db, "inventory", fireId)); } catch(e) {}
    }
  };

  const handleAddCustomProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductForm.name || !newProductForm.price) return;
    try {
       if (editProductId) {
         await updateDoc(doc(db, "products", editProductId), {
           name: newProductForm.name,
           price: Number(newProductForm.price)
         });
       } else {
         await addDoc(collection(db, "products"), {
           name: newProductForm.name,
           price: Number(newProductForm.price),
           createdAt: new Date().toISOString()
         });
       }
       setIsAddProductModalOpen(false);
       setNewProductForm({name: "", price: ""});
       setEditProductId(null);
    } catch(err) { console.error("Error saving product:", err); }
  };

  const handleEditProductClick = (prod: any) => {
     setNewProductForm({ name: prod.name, price: String(prod.price) });
     setEditProductId(prod.fireId);
     setIsAddProductModalOpen(true);
  };

  const handleDeleteProductClick = async (fireId: string) => {
     if(window.confirm("Are you sure you want to delete this product?")) {
        try { await deleteDoc(doc(db, "products", fireId)); } catch(e) {}
     }
  };

  const handleExportExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const exportData = filteredDashboardOrders.map(order => {
        const priceData = calculatePriceInfo(order.chocolate, order.count, order.discount, order.isDeliveryFree, order.paymentStatus, order.category, customPricesMap, order.manualDeliveryFee, order.orderStatus);
        return {
          "Order ID": getSerial(order.id),
          "Order Date": order.orderDate || order.functionDate,
          "Name": order.name,
          "Contact Number": order.phone,
          "Function Date": order.functionDate,
          "Delivery Date": order.deliveryDate,
          "Chocolate Name": order.chocolate,
          "Count": order.count,
          "Chocolate Price": priceData.chocolatePrice,
          "Delivery Charge": order.isDeliveryFree ? 'Free' : priceData.deliveryCharge,
          "Discount": order.discount,
          "Total Price": priceData.totalPrice,
          "Payment": order.paymentStatus || "Pending",
          "Status": order.status
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");
      XLSX.writeFile(workbook, "Order_Records.xlsx");
    } catch (err) {
      alert("❌ Error exporting file. Please try running 'npm install xlsx' in your terminal.");
    }
  };

  const handleImportClick = () => { fileInputRef.current?.click(); };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const XLSX = await import("xlsx");
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const bstr = event.target?.result;
          const workbook = XLSX.read(bstr, { type: 'binary' });
          const worksheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[worksheetName];
          const data = XLSX.utils.sheet_to_json(worksheet);
          
          if (data && data.length > 0) {
            for(const row of (data as any[])) {
              const orderObj = {
                id: Date.now() + Math.random(),
                orderDate: formatToDisplayDate(row['Order Date'] || row.orderDate || row['Function Date'] || ""),
                name: row.Name || row.name || "",
                phone: String(row['Contact Number'] || row.Phone || row.phone || ""),
                deliveryDate: formatToDisplayDate(row['Delivery Date'] || row.deliveryDate || ""),
                functionDate: formatToDisplayDate(row['Function Date'] || row.functionDate || row['Delivery Date'] || row.deliveryDate || ""),
                chocolate: row['Chocolate Name'] || row.Chocolate || row.chocolate || "",
                count: Number(row.Count || row.count) || 0,
                status: row.Status || row.status || "In Process",
                paymentStatus: row.Payment || row['Payment Status'] || row.paymentStatus || "Pending",
                address: row.Address || row.address || "",
                discount: Number(row.Discount || row.discount) || 0,
                isDeliveryFree: row['Delivery Charge'] === 'Free' || false,
                orderStatus: row['Order Status'] || row.orderStatus || "image edit (pending)",
                category: row.Category || row.category || "chocolate",
                orderType: row['Order Type'] || row.orderType || "Others",
                manualDeliveryFee: Number(row['Delivery Fee'] || row.manualDeliveryFee) || 0,
                advanceAmount: Number(row['Advance Amount'] || row.advanceAmount) || 0,
              };
              const priceData = calculatePriceInfo(orderObj.chocolate, orderObj.count, orderObj.discount, orderObj.isDeliveryFree, orderObj.paymentStatus, orderObj.category, customPricesMap, orderObj.manualDeliveryFee, orderObj.orderStatus);
              const finalOrderObj = {
                  ...orderObj,
                  totalOrderPrice: priceData.fullTotalPrice || 0,
                  itemSubtotal: priceData.fullChocolatePrice || 0,
                  calculatedDeliveryFee: priceData.fullDeliveryCharge || 0
              };
              await addDoc(collection(db, "orders"), finalOrderObj);
            }
            alert(`✅ Successfully imported ${data.length} orders to Database!`);
          } else {
            alert("⚠️ The uploaded file is empty or missing data.");
          }
        } catch (err) {
          alert("❌ Error parsing the Excel file contents. Ensure it matches the template.");
        }
      };
      
      reader.readAsBinaryString(file);
    } catch (err) {
      alert("❌ Error importing file. Please try running 'npm install xlsx' in your terminal.");
    }
    if (e.target) e.target.value = '';
  };

  const handleSendSMS = (order: any) => {
    const priceData = calculatePriceInfo(order.chocolate, order.count, order.discount, order.isDeliveryFree, order.paymentStatus, order.category, customPricesMap, order.manualDeliveryFee, order.orderStatus);
    const message = `Hello ${order.name},\nThank you for your order with SABI Return Gifts!\n\nTotal Items: ${order.count}\nTotal Amount: Rs.${priceData.totalPrice.toLocaleString()}\nDelivery Date: ${order.deliveryDate}\nPayment Status: ${order.paymentStatus || 'Pending'}\n\nThank you!`;
    const smsUrl = `sms:+91${order.phone}?body=${encodeURIComponent(message)}`;
    window.open(smsUrl, '_self');
  };

  const handleCapturePreview = async () => {
    const element = document.getElementById("preview-modal-content");
    if (element) {
      try {
        let html2canvasObj;
        try {
          const module = await import("html2canvas");
          html2canvasObj = module.default;
        } catch (err) {
          alert("Error: 'html2canvas' package is missing!\nPlease run 'npm install html2canvas' in your terminal.");
          return;
        }

        const canvas = await html2canvasObj(element, { 
          backgroundColor: "#fffbeb",
          scale: 2, 
          useCORS: true 
        });

        canvas.toBlob(async (blob) => {
          if (blob) {
            try {
              const item = new ClipboardItem({ "image/png": blob });
              await navigator.clipboard.write([item]);
              alert("✅ Receipt Copied to Clipboard!");
            } catch (clipboardErr) {
              console.error("Clipboard copy failed: ", clipboardErr);
              alert("❌ Failed to copy image. Please check browser permissions.");
            }
          }
        }, "image/png");

      } catch (error) {
        console.error("Error generating receipt image:", error);
      }
    }
  };
  const handleDownloadShipping = async () => {
    const element = document.getElementById("shipping-label-content");
    if (element) {
      try {
        const html2canvas = (await import("html2canvas")).default;
        const canvas = await html2canvas(element, { backgroundColor: "#ffffff", scale: 3, useCORS: true });
        const dataUrl = canvas.toDataURL("image/jpeg", 1.0);
        const link = document.createElement("a");
        link.download = `Shipping_Label_${getSerial(shippingOrder.id)}.jpg`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        alert("Error downloading shipping label.");
      }
    }
  };

  const renderChocolateBadges = (chocString: string) => {
    if (!chocString) return null;
    return (
      <div className="flex flex-wrap gap-1">
        {String(chocString).split(',').map((c, i) => ( 
          <span key={i} className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap">
            {c.trim()}
          </span>
        ))}
      </div>
    );
  };

  const liveFormPrice = calculatePriceInfo(formData.chocolate, formData.count, formData.discount, formData.isDeliveryFree, formData.paymentStatus, formData.category, customPricesMap, formData.manualDeliveryFee, formData.orderStatus);
  const profilePicUrl = "/logo.jpeg";

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!regData.name || !regData.username || !regData.password) return alert("Fill all fields");
    try {
      await addDoc(collection(db, "employees"), { 
        ...regData, 
        status: 'Pending',
        createdAt: new Date().toISOString()
      });
      alert("Registration Request Sent! Account must be approved before login.");
      setShowRegisterModal(false);
      setRegData({ name: "", username: "", password: "" });
    } catch(err) { alert("Error connecting to Database!"); }
  };

   const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    const inputUser = username.trim().toLowerCase();
    const inputPass = password.trim();

    // 🛠️ FIX: "Subash G" ku bathila "subash g" nu mathunga
    if (inputUser === "subash g" && inputPass === "561997") {
      setRole('Admin'); 
      setLoggedInName('Subash');
      setIsLoggedIn(true);
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('loggedInName', 'Subash');
      localStorage.setItem('role', 'Admin');
      setLoginError("");
      return; 
    }
    // ... bakki code ...

    const emp = employees.find(
      (emp) => emp.username.toLowerCase() === inputUser && emp.password === inputPass
    );

    if (emp) {
      if (emp.status === 'Approved') {
        setRole('Employee'); 
        setLoggedInName(emp.name);
        setIsLoggedIn(true);
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('loggedInName', emp.name);
        localStorage.setItem('role', 'Employee');
        setLoginError("");
      } else {
        setLoginError("Your account is still pending approval or declined.");
      }
    } else {
      setLoginError("Invalid Username or Password!");
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsername("");
    setPassword("");
    setLoggedInName("");
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('loggedInName');
    localStorage.removeItem('role');
  };

  if (!isLoggedIn) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#2d1b14] relative overflow-hidden">
         <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#5e3827] via-[#2d1b14] to-[#1a0f0b] opacity-80"></div>
         <div className="relative z-10 w-full max-w-sm bg-[#fffdf7] rounded-[2rem] shadow-2xl p-8 border-4 border-[#e8dccb]">
            <div className="flex flex-col items-center mb-8">
               <div className="flex gap-2 text-[#7c4d36] mb-4">
                  <User size={32} />
                  <User size={40} className="relative -top-2" />
                  <User size={32} />
               </div>
               <h2 className="text-2xl font-black text-[#8b5a3e] tracking-widest uppercase">Login</h2>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
               {loginError && <div className="text-red-500 text-center text-sm font-bold bg-red-50 p-2 rounded-lg border border-red-200">{loginError}</div>}
               
               <div className="relative flex items-center">
                  <div className="absolute left-0 w-14 h-14 bg-[#4a2c1d] rounded-l-xl flex items-center justify-center text-amber-100 shadow-[inset_-2px_0_5px_rgba(0,0,0,0.5)]">
                     <User size={24} />
                  </div>
                  <input 
                     type="text" 
                     placeholder="Username" 
                     value={username}
                     onChange={(e) => setUsername(e.target.value)}
                     className="w-full pl-16 pr-4 h-14 bg-[#faeedb] border-2 border-transparent focus:border-[#4a2c1d] rounded-xl text-[#4a2c1d] font-bold outline-none shadow-inner"
                  />
               </div>

               <div className="relative flex items-center">
                  <div className="absolute left-0 w-14 h-14 bg-[#4a2c1d] rounded-l-xl flex items-center justify-center text-amber-100 shadow-[inset_-2px_0_5px_rgba(0,0,0,0.5)]">
                     <Lock size={20} />
                  </div>
                  <input 
                     type={showPassword ? "text" : "password"} 
                     placeholder="Password" 
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                     className="w-full pl-16 pr-12 h-14 bg-[#faeedb] border-2 border-transparent focus:border-[#4a2c1d] rounded-xl text-[#4a2c1d] font-bold outline-none shadow-inner"
                  />
                  <div 
                     className="absolute right-4 text-[#8b5a3e] cursor-pointer hover:text-[#4a2c1d]"
                     onClick={() => setShowPassword(!showPassword)}
                  >
                     {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </div>
               </div>

               <button type="submit" className="w-full h-14 mt-4 bg-[#3e2316] hover:bg-[#2d1b14] text-amber-100 font-black text-xl rounded-2xl shadow-[0_5px_15px_rgba(0,0,0,0.3)] transition-colors tracking-widest border-b-4 border-[#1a0f0b] active:border-b-0 active:translate-y-1">
                  Login
               </button>

               <div className="flex items-center justify-between pt-2 px-2">
                  <div className="flex items-center gap-2">
                     <input type="checkbox" id="remember" className="w-5 h-5 rounded bg-[#4a2c1d] border-none accent-[#4a2c1d] cursor-pointer" />
                     <label htmlFor="remember" className="text-sm font-bold text-[#8b5a3e] cursor-pointer">Remember me?</label>
                  </div>
                  <button type="button" onClick={() => setShowRegisterModal(true)} className="text-sm font-black text-[#8b5a3e] underline hover:text-[#4a2c1d]">Register</button>
               </div>
            </form>
         </div>

         {showRegisterModal && (
          <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
             <div className="bg-[#fffdf7] rounded-[2rem] shadow-2xl w-full max-w-sm border-4 border-[#e8dccb] p-8 relative">
                <button type="button" onClick={() => setShowRegisterModal(false)} className="absolute top-4 right-4 text-[#7c4d36] hover:text-[#4a2c1d]"><X size={24} /></button>
                <h2 className="text-2xl font-black text-[#8b5a3e] tracking-widest uppercase text-center mb-6">Register</h2>
                <form onSubmit={handleRegister} className="space-y-4">
                   <div className="relative flex items-center">
                      <input type="text" placeholder="Full Name" required value={regData.name} onChange={(e) => setRegData({...regData, name: e.target.value})} className="w-full px-4 h-14 bg-[#faeedb] border-2 border-transparent focus:border-[#4a2c1d] rounded-xl text-[#4a2c1d] font-bold outline-none shadow-inner" />
                   </div>
                   <div className="relative flex items-center">
                      <input type="text" placeholder="Username" required value={regData.username} onChange={(e) => setRegData({...regData, username: e.target.value})} className="w-full px-4 h-14 bg-[#faeedb] border-2 border-transparent focus:border-[#4a2c1d] rounded-xl text-[#4a2c1d] font-bold outline-none shadow-inner" />
                   </div>
                   <div className="relative flex items-center">
                      <input type="password" placeholder="Password" required value={regData.password} onChange={(e) => setRegData({...regData, password: e.target.value})} className="w-full px-4 h-14 bg-[#faeedb] border-2 border-transparent focus:border-[#4a2c1d] rounded-xl text-[#4a2c1d] font-bold outline-none shadow-inner" />
                   </div>
                   <button type="submit" className="w-full h-14 mt-4 bg-[#3e2316] hover:bg-[#2d1b14] text-amber-100 font-black text-xl rounded-2xl shadow-[0_5px_15px_rgba(0,0,0,0.3)] transition-colors tracking-widest border-b-4 border-[#1a0f0b]">
                      Create Account
                   </button>
                </form>
             </div>
          </div>
         )}
      </div>
    );
  }

  return (
    <div className={`flex h-screen font-sans bg-[#3f4144] text-amber-950 relative ${isExportPreviewOpen || isReportPreviewOpen ? 'print:hidden' : ''}`}>
      
      <datalist id="discount-suggestions">
        <option value="0" />
        <option value="50" />
        <option value="100" />
        <option value="150" />
        <option value="200" />
        <option value="500" />
      </datalist>

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/20 z-20 md:hidden print:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`bg-slate-50 border-r border-blue-100 transition-all duration-300 ease-in-out print:hidden flex-shrink-0 absolute md:relative z-30 h-full overflow-hidden ${isSidebarOpen ? 'w-64' : 'w-0 border-none'}`}>
        <div className="w-64 h-full flex flex-col justify-between">
          <div>
            <div className={`p-8 flex flex-col items-center border-b border-blue-200 relative`}>
              <button onClick={() => setIsSidebarOpen(false)} className="absolute top-4 right-4 md:hidden p-1 text-blue-600 hover:bg-blue-50 rounded-lg">
                <X size={20} />
              </button>
              <div className="relative w-28 h-28 mb-4 rounded-full p-1.5 bg-gradient-to-br from-blue-400 via-blue-600 to-blue-900 shadow-[0_8px_20px_rgba(30,58,138,0.4)] flex items-center justify-center">
                <div className="w-full h-full rounded-full border-[3px] border-white overflow-hidden bg-blue-50 shadow-inner">
                  <img src={profilePicUrl} alt="Profile" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
                </div>
              </div>
              
              <h2 className={`font-black text-3xl text-blue-900 tracking-wide`} style={{ textShadow: "2px 2px 4px rgba(0,0,0,0.3), -1px -1px 2px rgba(255,255,255,1)" }}>
                {loggedInName}
              </h2>
              
              {role === 'Admin' && (
                <span className={`text-xs text-white font-black px-5 py-1.5 rounded-full mt-2 border border-blue-400 bg-gradient-to-r from-blue-500 to-blue-700 shadow-[0_4px_6px_rgba(0,0,0,0.2),inset_0_2px_4px_rgba(255,255,255,0.3)]`} style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.6)" }}>
                  Admin
                </span>
              )}
            </div>

            <nav className="p-4 space-y-3 mt-4">
              <button 
                onClick={() => { setActiveTab('dashboard1'); if(window.innerWidth < 768) setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl transition-all duration-300 ${activeTab === 'dashboard1' ? 'bg-gradient-to-br from-[#ffffff99] to-[#ffffff44] backdrop-blur-md text-blue-900 font-black shadow-[5px_5px_15px_rgba(0,0,0,0.1),-2px_-2px_10px_rgba(255,255,255,0.8)] border border-white/50 scale-[1.02] border-l-4 border-l-blue-600' : 'text-slate-600 hover:bg-white/60 font-bold'}`}>
                <Home size={20} className={activeTab === 'dashboard1' ? 'drop-shadow-md' : ''} /> 
                <span style={activeTab === 'dashboard1' ? { textShadow: "1px 1px 2px rgba(0,0,0,0.2), -1px -1px 1px rgba(255,255,255,1)" } : {}}>Dashboard 1</span>
              </button>
              
              <button 
                onClick={() => { setActiveTab('dashboard2'); if(window.innerWidth < 768) setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl transition-all duration-300 ${activeTab === 'dashboard2' ? 'bg-gradient-to-br from-[#ffffff99] to-[#ffffff44] backdrop-blur-md text-blue-900 font-black shadow-[5px_5px_15px_rgba(0,0,0,0.1),-2px_-2px_10px_rgba(255,255,255,0.8)] border border-white/50 scale-[1.02] border-l-4 border-l-blue-600' : 'text-slate-600 hover:bg-white/60 font-bold'}`}>
                <Package size={20} className={activeTab === 'dashboard2' ? 'drop-shadow-md' : ''} /> 
                <span style={activeTab === 'dashboard2' ? { textShadow: "1px 1px 2px rgba(0,0,0,0.2), -1px -1px 1px rgba(255,255,255,1)" } : {}}>Dashboard 2</span>
              </button>

              <button 
                onClick={() => { setActiveTab('inventories'); if(window.innerWidth < 768) setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl transition-all duration-300 ${activeTab === 'inventories' ? 'bg-gradient-to-br from-[#ffffff99] to-[#ffffff44] backdrop-blur-md text-blue-900 font-black shadow-[5px_5px_15px_rgba(0,0,0,0.1),-2px_-2px_10px_rgba(255,255,255,0.8)] border border-white/50 scale-[1.02] border-l-4 border-l-blue-600' : 'text-slate-600 hover:bg-white/60 font-bold'}`}>
                <Archive size={20} className={activeTab === 'inventories' ? 'drop-shadow-md' : ''} /> 
                <span style={activeTab === 'inventories' ? { textShadow: "1px 1px 2px rgba(0,0,0,0.2), -1px -1px 1px rgba(255,255,255,1)" } : {}}>Inventories</span>
              </button>

              <button 
                onClick={() => { setActiveTab('tracking'); if(window.innerWidth < 768) setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl transition-all duration-300 ${activeTab === 'tracking' ? 'bg-gradient-to-br from-[#ffffff99] to-[#ffffff44] backdrop-blur-md text-blue-900 font-black shadow-[5px_5px_15px_rgba(0,0,0,0.1),-2px_-2px_10px_rgba(255,255,255,0.8)] border border-white/50 scale-[1.02] border-l-4 border-l-blue-600' : 'text-slate-600 hover:bg-white/60 font-bold'}`}>
                <MapPin size={20} className={activeTab === 'tracking' ? 'drop-shadow-md' : ''} /> 
                <span style={activeTab === 'tracking' ? { textShadow: "1px 1px 2px rgba(0,0,0,0.2), -1px -1px 1px rgba(255,255,255,1)" } : {}}>Orders Tracking</span>
              </button>
              <button 
                onClick={() => { setActiveTab('reports'); if(window.innerWidth < 768) setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl transition-all duration-300 ${activeTab === 'reports' ? 'bg-gradient-to-br from-[#ffffff99] to-[#ffffff44] backdrop-blur-md text-blue-900 font-black shadow-[5px_5px_15px_rgba(0,0,0,0.1),-2px_-2px_10px_rgba(255,255,255,0.8)] border border-white/50 scale-[1.02] border-l-4 border-l-blue-600' : 'text-slate-600 hover:bg-white/60 font-bold'}`}>
                <TrendingUp size={20} className={activeTab === 'reports' ? 'drop-shadow-md' : ''} /> 
                <span style={activeTab === 'reports' ? { textShadow: "1px 1px 2px rgba(0,0,0,0.2), -1px -1px 1px rgba(255,255,255,1)" } : {}}>Reports</span>
              </button>
            </nav>
          </div>
          
          <div className="p-4 border-t border-blue-200">
             <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-red-600 bg-white shadow-[inset_2px_2px_5px_rgba(255,255,255,1),5px_5px_10px_rgba(0,0,0,0.05)] hover:shadow-[inset_2px_2px_5px_rgba(255,255,255,1),2px_2px_5px_rgba(0,0,0,0.1)] active:scale-95 font-black transition-all" style={{ textShadow: "1px 1px 1px rgba(255,0,0,0.2)" }}>
               <Power size={20} className="drop-shadow-sm" /> Logout
             </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full w-full overflow-hidden print:overflow-visible bg-gradient-to-br from-[#3e2723] via-[#2d1b14] to-[#1a0f0b] shadow-[inset_0_5px_20px_rgba(0,0,0,0.6)]">
        
        <header className={`bg-white border-b px-4 md:px-8 py-4 flex justify-between items-center shadow-sm z-10 print:hidden border-amber-100`}>
          <div className="flex items-center gap-3 md:gap-5">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors border border-amber-200" title="Toggle Menu">
              <Menu size={24} />
            </button>
            <div>
              <h1 className={`text-2xl md:text-3xl font-bold text-amber-950`}>
                {activeTab === 'dashboard1' && 'Order Management (Chocolates)'}
                {activeTab === 'dashboard2' && 'Order Management (Products)'}
                {activeTab === 'tracking' && 'Orders Tracking Center'}
                {activeTab === 'reports' && 'Analytics & Reports'}
                {activeTab === 'inventories' && 'Inventory Management'}
              </h1>
              <p className={`hidden md:block text-sm text-amber-700`}>
                {(activeTab === 'dashboard1' || activeTab === 'dashboard2') && 'Track your deliveries and statuses securely.'}
                {activeTab === 'tracking' && 'Search and trace live order statuses.'}
                {activeTab === 'reports' && 'View your sales and item statistics.'}
                {activeTab === 'inventories' && 'Track live chocolate stock & manual entries.'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-2xl font-black text-amber-900 tracking-wide uppercase">Sabi</p>
              <p className="text-sm font-bold text-amber-600 tracking-widest uppercase">return Gifts</p>
            </div>
            <button 
              onClick={() => setIsAdminAuthModalOpen(true)}
              className="w-14 h-14 rounded-full p-1 bg-gradient-to-br from-[#d4a373] to-[#3e2723] shadow-md flex items-center justify-center hover:scale-105 transition-transform cursor-pointer"
            >
               <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-amber-50 shadow-inner">
                 <img src={profilePicUrl} alt="Profile" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
               </div>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 print:p-0 print:overflow-visible">

          {activeTab === 'inventories' && (
            <div className="space-y-6 print:hidden animate-in fade-in duration-300">
               
               <div className="bg-gradient-to-br from-red-600 to-red-800 p-6 rounded-[2rem] shadow-[6px_6px_12px_rgba(0,0,0,0.3),-6px_-6px_12px_rgba(255,255,255,0.1)] border-4 border-red-500/50">
                  <h2 className="text-2xl font-black text-white mb-6 text-center tracking-widest uppercase" style={{textShadow: "2px 2px 4px rgba(0,0,0,0.5)"}}>Live Stock Balance</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                     {TRACKED_INVENTORY.map((choc, i) => {
                        const bal = inventoryBalances[choc] || 0;
                        return (
                           <div key={i} className="bg-[#fffdf7] p-3 rounded-xl shadow-inner text-center border-2 border-transparent flex flex-col justify-center items-center transform hover:scale-105 transition-transform">
                              <span className="text-[10px] font-extrabold text-red-900 uppercase leading-tight mb-2 h-8 flex items-center justify-center">{choc}</span>
                              <span className={`text-2xl font-black ${bal < 0 ? 'text-red-600' : 'text-green-600'}`}>{bal}</span>
                           </div>
                        )
                     })}
                  </div>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                 
                  <div className="flex flex-col h-full">
                     
                     <div className="bg-[#ebe6df] p-6 rounded-[2rem] shadow-[6px_6px_12px_rgba(0,0,0,0.1),-6px_-6px_12px_rgba(255,255,255,0.8)] border-2 border-white/40 flex flex-col h-full">
                        <h3 className="text-lg font-black text-[#3e2723] mb-4 border-b-2 border-[#d7ccc8] pb-2 flex items-center gap-2"><TrendingUp size={18}/> Sales Tracker</h3>
                        
                        <div className="space-y-4">
                           <div className="relative">
                              <Search className="absolute left-3 top-2.5 text-amber-600" size={16} />
                              <select 
                                 value={salesTrackerChoc} 
                                 onChange={(e) => setSalesTrackerChoc(e.target.value)}
                                 className="w-full pl-9 pr-4 py-2 font-bold rounded-xl outline-none border-2 border-[#d7ccc8] focus:border-[#8d6e63] bg-white text-amber-950 shadow-inner appearance-none cursor-pointer"
                              >
                                 <option value="All">All Chocolates</option>
                                 {TRACKED_INVENTORY.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                           </div>

                           <div className="flex items-center gap-2">
                              <div className="flex-1 relative">
                                 <span className="text-[10px] font-bold text-amber-800 absolute -top-2 left-2 bg-[#ebe6df] px-1">From</span>
                                 <input 
                                    type="date" 
                                    value={salesTrackerFrom}
                                    onChange={(e) => setSalesTrackerFrom(e.target.value)}
                                    className="w-full text-xs font-bold rounded-xl p-2.5 outline-none border-2 border-[#d7ccc8] bg-white text-amber-950 shadow-inner"
                                 />
                              </div>
                              <div className="flex-1 relative">
                                 <span className="text-[10px] font-bold text-amber-800 absolute -top-2 left-2 bg-[#ebe6df] px-1">To</span>
                                 <input 
                                    type="date" 
                                    value={salesTrackerTo}
                                    onChange={(e) => setSalesTrackerTo(e.target.value)}
                                    className="w-full text-xs font-bold rounded-xl p-2.5 outline-none border-2 border-[#d7ccc8] bg-white text-amber-950 shadow-inner"
                                 />
                              </div>
                           </div>

                           <div className="flex gap-4">
                              <div className="bg-[#fff8e1] border border-[#ffe082] p-4 rounded-xl text-center shadow-sm flex-1">
                                 <p className="text-[10px] font-bold text-[#8d6e63] uppercase tracking-wider mb-1">Total Items Sold</p>
                                 <p className="text-3xl font-black text-[#d35400]">{trackedSalesResult.count}</p>
                              </div>
                              <div className="bg-[#e6f7ec] border border-[#9fe2bf] p-4 rounded-xl text-center shadow-sm flex-1">
                                 <p className="text-[10px] font-bold text-[#047857] uppercase tracking-wider mb-1">Sales Amount</p>
                                 <p className="text-3xl font-black text-[#047857]">₹{trackedSalesResult.revenue.toLocaleString()}</p>
                              </div>
                           </div>

                        </div>
                     </div>

                  </div>

                  <div className="lg:col-span-2 bg-[#ebe6df] p-6 rounded-[2rem] shadow-[6px_6px_12px_rgba(0,0,0,0.1),-6px_-6px_12px_rgba(255,255,255,0.8)] border-2 border-white/40 overflow-hidden flex flex-col h-full min-h-[500px]">
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-black text-[#3e2723]">Inventory Log</h3>
                        <button onClick={() => setIsInvModalOpen(true)} className="bg-[#d35400] text-white px-4 py-2 rounded-xl font-black text-sm uppercase tracking-widest shadow-md hover:bg-[#a04000] hover:-translate-y-1 transition-all flex items-center gap-2">
                           <Plus size={16}/> Add Entry
                        </button>
                     </div>
                     <div className="overflow-auto flex-1 custom-scrollbar bg-white rounded-xl border border-[#d7ccc8] shadow-inner">
                        <table className="w-full text-left border-collapse min-w-[600px]">
                           <thead className="sticky top-0 bg-[#fff59d] z-10 shadow-sm border-b-2 border-[#fbc02d]">
                              <tr className="text-xs uppercase tracking-widest text-[#5d4037]">
                                 <th className="p-4 font-black border-r border-[#fff176]">Date</th>
                                 <th className="p-4 font-black border-r border-[#fff176]">Chocolate Name</th>
                                 <th className="p-4 font-black text-center border-r border-[#fff176]">Boxes</th>
                                 <th className="p-4 font-black text-center border-r border-[#fff176]">Count</th>
                                 <th className="p-4 font-black text-center border-r border-[#fff176]">Total Added</th>
                                 <th className="p-4 font-black text-center">Action</th>
                              </tr>
                           </thead>
                           <tbody>
                              {inventoryLogs.length === 0 ? (
                                 <tr><td colSpan={6} className="p-8 text-center text-amber-700 font-bold">No manual inventory entries found.</td></tr>
                              ) : (
                                 inventoryLogs.map(log => (
                                    <tr key={log.fireId} className="border-b border-[#f5f5f5] text-sm hover:bg-[#fffde7] transition-colors">
                                       <td className="p-4 font-bold text-amber-900">{formatToDisplayDate(log.date)}</td>
                                       <td className="p-4 font-bold text-amber-950">{log.chocolate}</td>
                                       <td className="p-4 text-center font-bold text-amber-800">{log.boxCount}</td>
                                       <td className="p-4 text-center font-bold text-amber-800">{log.itemsPerBox}</td>
                                       <td className="p-4 text-center font-black text-[#3e2723] bg-amber-50/50">+{log.totalChocolates}</td>
                                       <td className="p-4 text-center">
                                          <button onClick={() => handleDeleteInventory(log.fireId)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={18}/></button>
                                       </td>
                                    </tr>
                                 ))
                              )}
                           </tbody>
                        </table>
                     </div>
                     <p className="text-[10px] font-bold text-amber-600 mt-3 text-center shrink-0">* Note: Dashboard orders are automatically deducted from the Live Stock Balance (Not shown in this manual entry table).</p>
                  </div>
               </div>
            </div>
          )}

          {(activeTab === 'dashboard1' || activeTab === 'dashboard2') && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5 md:gap-6 mb-8 print:hidden mt-2">
                
                <div className="relative bg-[#ebe6df] p-4 rounded-[1.5rem] shadow-[6px_6px_12px_rgba(0,0,0,0.1),-6px_-6px_12px_rgba(255,255,255,0.8)] border-2 border-white/40 flex flex-col justify-between hover:-translate-y-1 transition-all duration-300">
                  <div className="flex justify-between items-start mb-2 relative z-10">
                    <p className="text-sm font-black text-[#c2410c] tracking-wide">Filtered Orders</p>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center bg-amber-100 text-amber-600 shadow-inner"><ShoppingBag size={18} /></div>
                  </div>
                  <h3 className="text-4xl font-black text-[#3e2723] relative z-10">{filteredDashboardOrders.length}</h3>
                </div>

                <div className="relative bg-[#ebe6df] p-4 rounded-[1.5rem] shadow-[6px_6px_12px_rgba(0,0,0,0.1),-6px_-6px_12px_rgba(255,255,255,0.8)] border-2 border-white/40 flex flex-col justify-between hover:-translate-y-1 transition-all duration-300">
                  <div className="flex justify-between items-start mb-3 relative z-10">
                    <p className="text-sm font-black text-[#c2410c] tracking-wide">Payment Filter</p>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-100 text-blue-600 shadow-inner"><IndianRupee size={16} /></div>
                  </div>
                  <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value as any)} className="w-full p-2.5 border-2 border-white rounded-xl text-xs font-bold text-amber-950 outline-none focus:ring-2 focus:ring-blue-400 bg-white/70 cursor-pointer shadow-[inset_2px_2px_5px_rgba(0,0,0,0.05)] relative z-10">
                    <option value="All">All Payments</option>
                    <option value="Full Paid">Full Paid</option>
                    <option value="Partially Paid">Partially Paid</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>

                <div className="relative bg-[#ebe6df] p-4 rounded-[1.5rem] shadow-[6px_6px_12px_rgba(0,0,0,0.1),-6px_-6px_12px_rgba(255,255,255,0.8)] border-2 border-white/40 flex flex-col justify-between hover:-translate-y-1 transition-all duration-300">
                  <div className="flex justify-between items-start mb-3 relative z-10">
                    <p className="text-sm font-black text-[#c2410c] tracking-wide">Delivery Filter</p>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-100 text-green-600 shadow-inner"><Package size={16} /></div>
                  </div>
                  <select value={deliveryFilter} onChange={(e) => setDeliveryFilter(e.target.value as any)} className="w-full p-2.5 border-2 border-white rounded-xl text-xs font-bold text-amber-950 outline-none focus:ring-2 focus:ring-green-400 bg-white/70 cursor-pointer shadow-[inset_2px_2px_5px_rgba(0,0,0,0.05)] relative z-10">
                    <option value="All">All Deliveries</option>
                    <option value="Delivered">Delivered</option>
                    <option value="In Process">In Process</option>
                  </select>
                </div>

                {activeTab === 'dashboard1' ? (
                  <div className="relative bg-[#ebe6df] p-4 rounded-[1.5rem] shadow-[6px_6px_12px_rgba(0,0,0,0.1),-6px_-6px_12px_rgba(255,255,255,0.8)] border-2 border-white/40 flex flex-col justify-between hover:-translate-y-1 transition-all duration-300">
                    <div className="flex justify-between items-start mb-3 relative z-10">
                      <div className="flex items-center gap-1 group relative">
                        <p className="text-sm font-black text-[#c2410c] tracking-wide">Order Status</p>
                        <div className="relative inline-block">
                          <ChevronDown size={14} className="text-[#c2410c] cursor-pointer hover:scale-125 transition-transform" />
                          <select
                            value={tableTypeFilter}
                            onChange={(e) => setTableTypeFilter(e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            title="Filter by Order Type"
                          >
                            <option value="All">All Types</option>
                            <option value="Self">Self</option>
                            <option value="Others">Others</option>
                          </select>
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-purple-100 text-purple-600 shadow-inner"><Package size={16} /></div>
                    </div>

                    {tableTypeFilter !== 'All' && (
                      <p className="text-[9px] font-extrabold text-purple-600 uppercase tracking-wider -mt-2 mb-1 z-10 relative">
                        Type: {tableTypeFilter}
                      </p>
                    )}

                    <select value={orderStatusFilter} onChange={(e) => setOrderStatusFilter(e.target.value)} className="w-full p-2.5 border-2 border-white rounded-xl text-xs font-bold text-amber-950 outline-none focus:ring-2 focus:ring-purple-400 bg-white/70 cursor-pointer shadow-[inset_2px_2px_5px_rgba(0,0,0,0.05)] uppercase tracking-wider relative z-10">
                      <option value="All">All Statuses</option>
                      <option value="image edit (pending)">Image Edit (Pending)</option>
                      <option value="image edited (not paid)">Image Edited (Not Paid)</option>
                      <option value="forward to print (paid)">Forward to Print (Paid)</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                ) : (
                  <div className="relative bg-[#ebe6df] p-4 rounded-[1.5rem] shadow-[6px_6px_12px_rgba(0,0,0,0.1),-6px_-6px_12px_rgba(255,255,255,0.8)] border-2 border-white/40 flex flex-col hover:-translate-y-1 transition-all duration-300">
                    <div className="flex justify-between items-start mb-2 relative z-10 shrink-0">
                      <p className="text-sm font-black text-[#c2410c] tracking-wide">Product Listing</p>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-purple-100 text-purple-600 shadow-inner"><Package size={16} /></div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2 relative z-10 text-xs font-bold max-h-[75px]">
                       {customProducts.length === 0 ? (
                         <p className="text-amber-700/60 text-center mt-2 italic">No products added.</p>
                       ) : (
                         customProducts.map(prod => (
                           <div key={prod.fireId} className="flex justify-between items-center bg-white/60 px-2 py-1.5 rounded-lg border border-white shadow-[inset_1px_1px_3px_rgba(0,0,0,0.05)] hover:bg-white transition-colors">
                             <span className="text-amber-950 truncate flex-1 pr-2" title={prod.name}>{prod.name} - ₹{prod.price}</span>
                             <div className="flex items-center gap-1 shrink-0">
                               <button onClick={() => handleEditProductClick(prod)} className="text-blue-600 hover:bg-blue-100 p-1 rounded transition-colors" title="Edit"><Pencil size={12}/></button>
                               <button onClick={() => handleDeleteProductClick(prod.fireId)} className="text-red-500 hover:bg-red-100 p-1 rounded transition-colors" title="Delete"><Trash2 size={12}/></button>
                             </div>
                           </div>
                         ))
                       )}
                    </div>
                  </div>
                )}

                <div className="relative bg-[#ebe6df] p-4 rounded-[1.5rem] shadow-[6px_6px_12px_rgba(0,0,0,0.1),-6px_-6px_12px_rgba(255,255,255,0.8)] border-2 border-white/40 flex flex-col justify-between hover:-translate-y-1 transition-all duration-300">
                  <div className="flex justify-between items-start w-full mb-1 relative z-10">
                    <div className="flex items-center gap-1 group relative">
                      <p className="text-[11px] font-black text-[#c2410c] tracking-wide leading-tight">Revenue <br/>Filter</p>
                      
                      <div className="relative inline-block">
                        <ChevronDown size={14} className="text-[#c2410c] cursor-pointer hover:scale-125 transition-transform" />
                        <select 
                          value={revenueDateType}
                          onChange={(e) => setRevenueDateType(e.target.value)}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          title="Select Filter Basis"
                        >
                          <option value="Serial No">Serial No</option>
                          <option value="Order Date">Order Date</option>
                          <option value="Function Date">Function Date</option>
                          <option value="Delivery Date">Delivery Date</option>
                        </select>
                      </div>
                    </div>
                    <h3 className="text-xl font-black text-green-700 mt-1">₹{displayRevenue.toLocaleString()}</h3>
                  </div>
                  
                  <p className="text-[8px] font-bold text-gray-500 uppercase tracking-tighter -mt-1 mb-1 z-10 relative">
                    Based on: {revenueDateType}
                  </p>
                  
                  <div className="flex items-center gap-1 mt-auto relative z-10 w-full">
                    <input 
                      type="date" 
                      value={dateFilter.from} 
                      onChange={e => setDateFilter({...dateFilter, from: e.target.value})} 
                      className="flex-1 w-full min-w-0 px-1 py-1.5 border-2 border-white rounded-md text-[9px] font-bold text-purple-950 outline-none focus:ring-1 focus:ring-purple-400 bg-white/70 cursor-pointer shadow-[inset_2px_2px_5px_rgba(0,0,0,0.05)] tracking-tighter" 
                      title="From Date" 
                    />
                    
                    <span className="text-[10px] font-black text-purple-700 shrink-0">To</span>
                    
                    <input 
                      type="date" 
                      value={dateFilter.to} 
                      onChange={e => setDateFilter({...dateFilter, to: e.target.value})} 
                      className="flex-1 w-full min-w-0 px-1 py-1.5 border-2 border-white rounded-md text-[9px] font-bold text-purple-950 outline-none focus:ring-1 focus:ring-purple-400 bg-white/70 cursor-pointer shadow-[inset_2px_2px_5px_rgba(0,0,0,0.05)] tracking-tighter" 
                      title="To Date" 
                    />
                    
                    {(dateFilter.from || dateFilter.to) && (
                      <button 
                        onClick={() => setDateFilter({from: "", to: ""})} 
                        className="text-white hover:bg-red-600 bg-red-500 p-1 rounded-full shrink-0 shadow-sm transition-colors" 
                        title="Clear Date Filter"
                      >
                        <X size={12} strokeWidth={3}/>
                      </button>
                    )}
                  </div>
                </div>

              </div>

              <div className={`bg-[#ebe6df] rounded-2xl shadow-[6px_6px_12px_rgba(0,0,0,0.1),-6px_-6px_12px_rgba(255,255,255,0.8)] border-2 border-white/40 overflow-hidden print:border-none print:shadow-none`}>
                <div className={`p-4 md:p-6 border-b flex flex-col md:flex-row justify-between items-center gap-4 border-amber-100 print:hidden`}>
                  
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <h2 className={`text-2xl font-bold text-amber-950 whitespace-nowrap hidden md:block`}>Order Records</h2>
                    <div className="relative w-full md:w-64">
                      <Search className="absolute left-3 top-2.5 text-amber-400" size={18} />
                      <input 
                        type="text" 
                        placeholder="Search Name or Phone..." 
                        value={dashboardSearch}
                        onChange={(e) => setDashboardSearch(e.target.value)}
                        className="pl-9 pr-4 py-2 bg-white border-amber-200 rounded-lg text-amber-950 font-bold placeholder-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm w-full shadow-sm"
                      />
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto print:hidden">
                    {selectedOrders.length > 0 && (
                      <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 animate-in fade-in zoom-in duration-200">
                        <span className="text-sm font-bold text-amber-800 hidden sm:inline">{selectedOrders.length} Selected:</span>
                        <select onChange={(e) => { if (e.target.value) handleBulkAction(e.target.value); e.target.value = ''; }} className="text-sm font-bold p-1.5 rounded border border-amber-300 bg-white text-amber-900 outline-none cursor-pointer">
                          <option value="">Change Status...</option>
                          <optgroup label="Delivery"><option value="Delivered">Mark Delivered</option><option value="In Process">Mark In Process</option></optgroup>
                          <optgroup label="Payment"><option value="Full Paid">Mark Full Paid</option><option value="Partially Paid">Mark Partially Paid</option><option value="Pending">Mark Pending</option></optgroup>
                        </select>
                        <button onClick={handleBulkDelete} className="text-red-500 hover:bg-red-100 p-1.5 rounded transition-colors" title="Delete Selected"><Trash2 size={18} /></button>
                      </div>
                    )}

                    <input 
                      type="file" 
                      accept=".xlsx, .xls" 
                      ref={fileInputRef} 
                      onChange={handleFileImport} 
                      className="hidden" 
                    />
                    <button onClick={handleImportClick} className={`flex-1 sm:flex-none flex justify-center items-center gap-2 px-4 py-2 font-medium rounded-lg transition-colors border bg-white text-amber-900 border-amber-200 hover:bg-amber-50`}>
                      <Upload size={18} /> <span className="hidden sm:inline">Import</span> Excel
                    </button>

                    <button onClick={() => setIsExportPreviewOpen(true)} className={`flex-1 sm:flex-none flex justify-center items-center gap-2 px-4 py-2 font-medium rounded-lg transition-colors border bg-white text-amber-900 border-amber-200 hover:bg-amber-50`}>
                      <Download size={18} /> <span className="hidden sm:inline">Export</span> Excel
                    </button>
                    
                    {activeTab === 'dashboard2' && (
                      <button onClick={() => setIsAddProductModalOpen(true)} className={`flex-1 sm:flex-none flex justify-center items-center gap-2 px-4 py-2 font-medium rounded-lg transition-colors shadow-sm bg-blue-600 text-white hover:bg-blue-700`}>
                        <Plus size={18} /> Add Product
                      </button>
                    )}

                    <button onClick={handleAddClick} className={`flex-1 sm:flex-none flex justify-center items-center gap-2 px-4 py-2 font-medium rounded-lg transition-colors shadow-sm bg-amber-600 text-white hover:bg-amber-700`}>
                      <Plus size={18} /> Add Order
                    </button>
                  </div>
                </div>

                <div className="w-full overflow-x-auto shadow-inner bg-white/50 rounded-lg custom-scrollbar">
                  <table className="w-full text-left border-collapse min-w-[1450px] print:min-w-0 print:w-full relative">
                    <thead className="sticky top-0 z-20 shadow-sm bg-amber-50 print:static">
                      <tr className={`text-sm border-b uppercase tracking-wider bg-amber-50 text-amber-800 border-amber-200 print:bg-gray-100 print:text-black`}>
                        <th className="p-4 w-12 text-center print:hidden align-top">
                          <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} className="w-4 h-4 cursor-pointer accent-amber-600 rounded"/>
                        </th>
                        <th className="p-4 font-bold align-top">
                          <div className="flex items-center gap-1 group">
                            <span>Serial No</span>
                            <div className="relative inline-flex items-center justify-center w-5 h-5 rounded-md cursor-pointer transition-colors" title="Sort Serial No">
                              <ChevronDown size={14} className="text-amber-800/30 group-hover:text-amber-800 transition-opacity" />
                              <select 
                                value={sortConfig?.key === 'id' ? sortConfig.direction : ""}
                                onChange={(e) => {
                                  if (!e.target.value) setSortConfig(null);
                                  else setSortConfig({ key: 'id', direction: e.target.value as 'asc' | 'desc' });
                                }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              >
                                <option value="">Sort...</option>
                                <option value="asc">new  to old</option>
                                <option value="desc">old to new </option>
                              </select>
                            </div>
                          </div>
                        </th>
                        <th className="p-4 font-bold align-top min-w-[140px]">
                          <div className="flex items-center gap-1 group">
                            <span>Order Date</span>
                            <div className="relative inline-flex items-center justify-center w-5 h-5 rounded-md cursor-pointer transition-colors" title="Sort Order Date">
                              <ChevronDown size={14} className="text-amber-800/30 group-hover:text-amber-800 transition-opacity" />
                              <select 
                                value={sortConfig?.key === 'orderDate' ? sortConfig.direction : ""}
                                onChange={(e) => {
                                  if (!e.target.value) setSortConfig(null);
                                  else setSortConfig({ key: 'orderDate', direction: e.target.value as 'asc' | 'desc' });
                                }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              >
                                <option value="">Sort...</option>
                                <option value="asc">new to Old</option>
                                <option value="desc">old to new </option>
                              </select>
                            </div>
                          </div>
                        </th>
                        <th className="p-4 font-bold align-top">Name</th>
                        <th className="p-4 font-bold align-top">Contact Number</th>
                        
                        <th className="p-4 font-bold align-top min-w-[140px]">
                          <div className="flex flex-col gap-2">
                             <div className="flex items-center gap-2">
                                <span>Function Date</span>
                                <div className="relative inline-flex items-center justify-center w-7 h-7 hover:bg-amber-200 rounded-md cursor-pointer transition-colors" title="Select Dates">
                                   <Calendar size={16} className="text-amber-700 pointer-events-none" />
                                   <input 
                                     type="date" 
                                     value=""
                                     onChange={(e) => {
                                       if (e.target.value && !functionDates.includes(e.target.value)) {
                                         setFunctionDates([...functionDates, e.target.value]);
                                       }
                                     }}
                                     className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                   />
                                </div>
                             </div>
                             {functionDates.length > 0 && (
                               <div className="flex flex-wrap gap-1">
                                 {functionDates.map(d => (
                                   <span key={d} className="flex items-center gap-1 bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                     {formatToDisplayDate(d)}
                                     <X size={12} className="cursor-pointer hover:text-red-500" onClick={() => setFunctionDates(functionDates.filter(fd => fd !== d))} />
                                   </span>
                                 ))}
                               </div>
                             )}
                          </div>
                        </th>

                        <th className="p-4 font-extrabold text-[#d35400] bg-orange-100/80 rounded-t-lg shadow-sm border border-orange-200 print:bg-transparent print:border-none print:shadow-none print:text-black align-top min-w-[140px]">
                          <div className="flex flex-col gap-2">
                             <div className="flex items-center gap-2">
                                <span>Delivery Date</span>
                                <div className="relative inline-flex items-center justify-center w-7 h-7 hover:bg-orange-200 rounded-md cursor-pointer transition-colors" title="Select Dates">
                                   <Calendar size={16} className="text-orange-700 pointer-events-none" />
                                   <input 
                                     type="date" 
                                     value=""
                                     onChange={(e) => {
                                       if (e.target.value && !deliveryDates.includes(e.target.value)) {
                                         setDeliveryDates([...deliveryDates, e.target.value]);
                                       }
                                     }}
                                     className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                   />
                                </div>
                             </div>
                             {deliveryDates.length > 0 && (
                               <div className="flex flex-wrap gap-1 mt-1">
                                 {deliveryDates.map(d => (
                                   <span key={d} className="flex items-center gap-1 bg-white text-orange-800 border border-orange-300 px-1.5 py-0.5 rounded text-[10px] font-bold shadow-sm">
                                     {formatToDisplayDate(d)}
                                     <X size={12} className="cursor-pointer hover:text-red-500" onClick={() => setDeliveryDates(deliveryDates.filter(dd => dd !== d))} />
                                   </span>
                                 ))}
                               </div>
                             )}
                          </div>
                        </th>
                        
                        {/* 🟢 CONDITIONALLY HIDE ORDER STATUS FOR DASHBOARD 2 */}
                        {activeTab === 'dashboard1' && (
                          <th className="p-4 font-bold align-top min-w-[150px]">
                            <div className="flex items-center gap-1 group">
                              <span>Order Status</span>
                              <div className="relative inline-flex items-center justify-center w-5 h-5 rounded-md cursor-pointer transition-colors" title="Filter by Type (Self/Others)">
                                <ChevronDown size={14} className={tableTypeFilter !== 'All' ? 'text-amber-800' : 'text-amber-800/30 group-hover:text-amber-800 transition-opacity'} />
                                <select 
                                  value={tableTypeFilter} 
                                  onChange={(e) => setTableTypeFilter(e.target.value)}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                >
                                  <option value="All">All Types</option>
                                  <option value="Self">Self</option>
                                  <option value="Others">Others</option>
                                </select>
                              </div>
                            </div>
                          </th>
                        )}

                        <th className="p-4 font-bold align-top">{activeTab === 'dashboard2' ? 'Product Name' : 'Chocolate Name'}</th>
                        <th className="p-4 font-bold text-center align-top min-w-[100px]">
                          <div className="flex items-center justify-center gap-1">
                            <span>Count</span>
                            <div className="relative inline-flex items-center justify-center w-5 h-5 hover:bg-amber-200 rounded-md cursor-pointer transition-colors" title="Filter by Count">
                              <Filter size={14} className={countFilter !== 'All' ? 'text-amber-800' : 'text-amber-400'} />
                              <select 
                                value={countFilter} 
                                onChange={(e) => setCountFilter(e.target.value)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              >
                                <option value="All">All</option>
                                {uniqueCounts.map(c => (
                                  <option key={c} value={c.toString()}>{c}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </th>
                        
                        <th className="p-4 font-bold text-right align-top">{activeTab === 'dashboard2' ? 'Prod. Price' : 'Choc. Price'}</th>
                        <th className="p-4 font-bold text-right align-top">Delivery Charge</th>
                        <th className="p-4 font-bold text-center align-top print:hidden">Discount</th>

                        <th className="p-4 font-bold text-right align-top">Total Price</th>
                        <th className="p-4 font-bold text-center align-top">Payment</th>
                        <th className="p-4 font-bold text-center align-top">Delivery Status</th>

                        <th className="p-4 font-bold text-center print:hidden align-top">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedDashboardOrders.length === 0 ? (
                        <tr><td colSpan={15} className={`p-8 text-center text-amber-700 font-bold`}>No records found for the selected filters.</td></tr>
                      ) : (
                        sortedDashboardOrders.map((order) => {
                          const priceData = calculatePriceInfo(order.chocolate, order.count, order.discount, order.isDeliveryFree, order.paymentStatus, order.category, customPricesMap, order.manualDeliveryFee, order.orderStatus);
                          const isSelected = selectedOrders.includes(order.id);
                          
                          return (
                            <tr key={order.fireId || order.id} className={`border-b transition-colors border-amber-50 hover:bg-orange-50/50 print:border-gray-200 ${isSelected ? 'bg-amber-50/80 print:bg-transparent' : ''}`}>
                              <td className="p-4 text-center print:hidden align-middle">
                                <input type="checkbox" checked={isSelected} onChange={() => { if(selectedOrders.includes(order.id)) setSelectedOrders(selectedOrders.filter(x=>x!==order.id)); else setSelectedOrders([...selectedOrders, order.id]); }} className="w-4 h-4 cursor-pointer accent-amber-600 rounded"/>
                              </td>
                              <td className="p-4 font-extrabold text-amber-900 print:text-black align-middle whitespace-nowrap">{getSerial(order.id)}</td>
                              <td className="p-4 font-medium text-[#5d4037] align-middle">{order.orderDate}</td>
                              
                              <td className={`p-4 font-bold text-amber-950 print:text-black align-middle`}>{order.name}</td>
                              <td className={`p-4 font-medium text-amber-800 print:text-gray-800 align-middle`}>{order.phone}</td>
                              <td className={`p-4 font-medium text-amber-800 print:text-gray-800 align-middle`}>{order.functionDate}</td>
                              <td className={`p-4 font-bold text-orange-900 print:text-black align-middle`}>{order.deliveryDate}</td>
                              
                              {/* 🟢 CONDITIONALLY HIDE ORDER STATUS FOR DASHBOARD 2 */}
                              {activeTab === 'dashboard1' && (
                                <td className="p-4 text-center align-middle">
                                  <div className="print:hidden">
                                    <select 
                                      value={order.orderStatus || "image edited (not paid)"}
                                      onChange={(e) => handleOrderStatusUpdate(order.id, order.fireId, e.target.value)}
                                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black border-2 outline-none cursor-pointer transition-colors shadow-sm uppercase tracking-wider ${
                                        order.orderStatus === 'image edit (pending)' ? 'bg-[#fef3c7] text-[#b45309] border-[#fde68a]' : 
                                        order.orderStatus === 'forward to print (paid)' ? 'bg-[#e6f7ec] text-[#047857] border-[#9fe2bf]' : 
                                        order.orderStatus === 'cancelled' ? 'bg-[#fee2e2] text-[#b91c1c] border-[#fca5a5]' :
                                        order.orderStatus === 'delivered' ? 'bg-[#e0f2fe] text-[#0369a1] border-[#7dd3fc]' :
                                        'bg-[#ffe4e6] text-[#be123c] border-[#fda4af]'
                                      }`}
                                    >
                                      <option value="image edit (pending)">Image Edit (Pending)</option>
                                      <option value="image edited (not paid)">Image Edited (Not Paid)</option>
                                      <option value="forward to print (paid)">Forward to Print (Paid)</option>
                                      <option value="delivered">Delivered</option>
                                      <option value="cancelled">Cancelled</option>
                                    </select>
                                  </div>
                                  <span className="hidden print:inline text-[10px] font-bold text-black uppercase">{order.orderStatus || "image edited (not paid)"}</span>
                                </td>
                              )}

                              <td className={`p-4 print:text-gray-800 align-middle`}>
                                {renderChocolateBadges(order.chocolate)}
                              </td>
                              
                              <td className={`p-4 text-center font-bold text-amber-950 print:text-black align-middle`}>
                                 {order.count}
                              </td>
                              
                               <td className="p-3 text-right border-r border-amber-100 print:border-gray-400 print:text-black align-middle">
                                 <div className="font-medium text-amber-900">₹{priceData.chocolatePrice.toLocaleString()}</div>
                              </td>
                              
                              <td className={`p-4 text-right font-medium text-amber-900 align-middle`}>
                                 {order.isDeliveryFree ? <span className="text-green-600 font-black">Free</span> : `₹${priceData.fullDeliveryCharge.toLocaleString()}`}
                              </td>
                              
                              <td className="p-4 text-center print:hidden align-middle">
                                <input 
                                  type="number"
                                  list="discount-suggestions"
                                  placeholder="0"
                                  value={order.discount || ''}
                                  onChange={(e) => handleDiscountUpdate(order.id, order.fireId, e.target.value)}
                                  className="w-20 p-1.5 border border-amber-300 rounded text-center text-sm font-bold text-amber-950 bg-white outline-none focus:ring-2 focus:ring-amber-500"
                                />
                              </td>

                              <td className={`p-4 text-right align-middle`}>
                                <div className="font-bold text-amber-950 text-base print:text-black">₹{priceData.fullTotalPrice.toLocaleString()}</div>
                                {order.paymentStatus === 'Pending' && (
                                   <div className="text-[11px] font-bold text-red-600 leading-tight mt-0.5">Pending: ₹{priceData.fullTotalPrice.toLocaleString()}</div>
                                )}
                                {order.paymentStatus === 'Partially Paid' && (
                                  <>
                                   <div className="text-[11px] font-bold text-green-700 leading-tight mt-0.5">Paid: ₹{Number(order.advanceAmount || 0).toLocaleString()}</div>
                                   <div className="text-[11px] font-bold text-red-600 leading-tight">Pending: ₹{(priceData.fullTotalPrice - Number(order.advanceAmount || 0)).toLocaleString()}</div>
                                  </>
                                )}
                              </td>

                              <td className="p-4 text-center align-middle">
                                <div className="print:hidden">
                                  <select 
                                    value={order.paymentStatus || "Pending"}
                                    onChange={(e) => handlePaymentStatusUpdate(order.id, order.fireId, e.target.value)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 outline-none cursor-pointer transition-colors shadow-sm ${
                                      order.paymentStatus === 'Full Paid' 
                                        ? 'bg-[#e6f7ec] text-[#047857] border-[#9fe2bf] hover:bg-[#d1fae5] focus:ring-2 focus:ring-[#34d399]' 
                                        : order.paymentStatus === 'Partially Paid'
                                        ? 'bg-[#fff7ed] text-[#d35400] border-[#fdba74] hover:bg-[#ffedd5] focus:ring-2 focus:ring-[#fb923c]'
                                        : 'bg-[#fee2e2] text-[#b91c1c] border-[#fca5a5] hover:bg-[#fecaca] focus:ring-2 focus:ring-[#f87171]'
                                    }`}
                                  >
                                    <option value="Full Paid" className="font-bold text-[#047857] bg-white">Full Paid</option>
                                    <option value="Partially Paid" className="font-bold text-[#d35400] bg-white">Partially Paid</option>
                                    <option value="Pending" className="font-bold text-[#b91c1c] bg-white">Pending</option>
                                  </select>
                                </div>
                                <span className="hidden print:inline text-sm font-bold text-black">{order.paymentStatus || 'Pending'}</span>
                              </td>

                              <td className="p-4 text-center align-middle">
                                <div className="print:hidden">
                                  <select 
                                    value={order.status}
                                    onChange={(e) => handleDeliveryStatusUpdate(order.id, order.fireId, e.target.value)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border outline-none cursor-pointer transition-colors shadow-sm ${
                                      order.status === 'Delivered' 
                                        ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 focus:ring-2 focus:ring-green-400' 
                                        : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 focus:ring-2 focus:ring-amber-400'
                                    }`}
                                  >
                                    <option value="Delivered" className="font-bold text-green-700">Delivered</option>
                                    <option value="In Process" className="font-bold text-amber-700">In Process</option>
                                  </select>
                                </div>
                                <span className="hidden print:inline text-sm font-bold text-black">{order.status}</span>
                              </td>

                              <td className="p-4 print:hidden align-middle text-center relative">
                                <button 
                                  onClick={() => setOpenActionId(openActionId === order.id ? null : order.id)} 
                                  className="p-2 text-amber-700 hover:bg-amber-100 rounded-full transition-colors"
                                  title="Actions Menu"
                                >
                                  <MoreVertical size={20} />
                                </button>
                                
                                {openActionId === order.id && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={() => setOpenActionId(null)}></div>
                                    
                                    <div className="absolute right-14 top-2 z-50 bg-white/90 backdrop-blur-md border border-white/40 shadow-[0_20px_50px_rgba(0,0,0,0.2)] rounded-[1.5rem] p-2.5 flex gap-2 animate-in slide-in-from-right-5 duration-200">
                                      <button onClick={() => { handleSendSMS(order); setOpenActionId(null); }} className="text-blue-600 hover:-translate-y-1 p-2 rounded-lg transition-transform" title="Send SMS Bill"><MessageSquare size={20} /></button>
                                      <button onClick={() => { setShippingOrder(order); setIsShippingOpen(true); setOpenActionId(null); }} className="text-purple-600 hover:-translate-y-1 p-2 rounded-lg transition-transform" title="Shipping"><Truck size={20} /></button>
                                      <button onClick={() => { handlePreviewClick(order); setOpenActionId(null); }} className="text-amber-700 hover:-translate-y-1 p-2 rounded-lg transition-transform" title="View Preview"><Eye size={20} /></button>
                                      <button onClick={() => { handleEditClick(order); setOpenActionId(null); }} className="text-emerald-600 hover:-translate-y-1 p-2 rounded-lg transition-transform" title="Edit Order"><Pencil size={20} /></button>
                                      <button onClick={() => { handleDeleteClick(order.id); setOpenActionId(null); }} className="text-red-500 hover:-translate-y-1 p-2 rounded-lg transition-transform" title="Delete Order"><Trash2 size={20} /></button>
                                      {/* 👇 PUDHU RECEIPT BUTTON INGA ADD PANNIRUKKEN 👇 */}
                                      <button onClick={() => { setSelectedOrderForInvoice(order); setIsInvoiceOpen(true); setOpenActionId(null); }} className="text-blue-700 hover:-translate-y-1 p-2 rounded-lg transition-transform" title="View Invoice"><Receipt size={20} /></button>
                                    </div>
                                  </>
                                )}
                              </td>

                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab === 'tracking' && (
            <div className="w-full px-2 print:hidden">
              <div className="bg-[#ebe6df] p-6 rounded-[2rem] shadow-[6px_6px_12px_rgba(0,0,0,0.1),-6px_-6px_12px_rgba(255,255,255,0.8)] border-2 border-white/40 mb-6">
                <div className="flex flex-col md:flex-row gap-4 items-center">
                  <div className="relative w-full md:w-2/5">
                    <Search className="absolute left-4 top-3.5 text-amber-500" size={20} />
                    <input 
                      type="text" 
                      placeholder="Search Customer..." 
                      value={trackingSearch}
                      onChange={(e) => setTrackingSearch(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-white/70 border-2 border-white rounded-xl text-amber-950 font-bold placeholder-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.05)] text-sm"
                    />
                  </div>
                  
                  <div className="flex flex-wrap flex-1 gap-3 w-full justify-end">
                    <select value={orderStatusFilter} onChange={(e) => setOrderStatusFilter(e.target.value)} className="flex-1 md:flex-none px-3 py-3 border-2 border-white rounded-xl text-xs font-bold text-amber-950 outline-none focus:ring-2 focus:ring-purple-400 bg-white/70 cursor-pointer shadow-[inset_2px_2px_5px_rgba(0,0,0,0.05)] uppercase tracking-wider">
                      <option value="All">All Statuses</option>
                      <option value="image edit (pending)">Image Edit (Pending)</option>
                      <option value="image edited (not paid)">Image Edited (Not Paid)</option>
                      <option value="forward to print (paid)">Forward to Print (Paid)</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>

                    <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value as any)} className="flex-1 md:flex-none px-3 py-3 border-2 border-white rounded-xl text-sm font-bold text-amber-950 outline-none focus:ring-2 focus:ring-blue-400 bg-white/70 cursor-pointer shadow-[inset_2px_2px_5px_rgba(0,0,0,0.05)]">
                      <option value="All">All Payments</option>
                      <option value="Full Paid">Full Paid</option>
                      <option value="Partially Paid">Partially Paid</option>
                      <option value="Pending">Pending</option>
                    </select>
                    
                    <select value={deliveryFilter} onChange={(e) => setDeliveryFilter(e.target.value as any)} className="flex-1 md:flex-none px-3 py-3 border-2 border-white rounded-xl text-sm font-bold text-amber-950 outline-none focus:ring-2 focus:ring-green-400 bg-white/70 cursor-pointer shadow-[inset_2px_2px_5px_rgba(0,0,0,0.05)]">
                       <option value="All">All Deliveries</option>
                       <option value="Delivered">Delivered</option>
                       <option value="In Process">In Process</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pb-10">
                {trackingSearchResults.length === 0 ? (
                   <div className="text-center py-10 bg-white rounded-2xl border border-amber-100">
                     <p className="text-amber-700 font-medium">No tracking records found.</p>
                   </div>
                ) : (
                  trackingSearchResults.map(order => {
                    const priceData = calculatePriceInfo(order.chocolate, order.count, order.discount, order.isDeliveryFree, order.paymentStatus, order.category, customPricesMap, order.manualDeliveryFee, order.orderStatus);
                    return (
                      <div key={order.fireId || order.id} className="bg-[#ebe6df] rounded-3xl p-6 shadow-[6px_6px_12px_rgba(0,0,0,0.1),-6px_-6px_12px_rgba(255,255,255,0.8)] border-2 border-white/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 hover:-translate-y-1 transition-all duration-300">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-gradient-to-br from-amber-100 to-amber-200 text-amber-700 rounded-full flex items-center justify-center shrink-0 shadow-inner">
                            <Package size={28} />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-amber-950">{order.name}</h3>
                            <p className="text-sm font-medium text-amber-700 mb-1">
                              {order.phone} • {order.count} Items • <span className="font-bold text-amber-900">₹{priceData.totalPrice}</span>
                            </p>
                            <div className="flex items-center gap-2 mb-1">
                               <span className="text-sm font-medium text-amber-600">Item:</span>
                               {renderChocolateBadges(order.chocolate)}
                            </div>
                            {order.address && String(order.address).trim() !== "" && (
                              <div className="flex items-start gap-1.5 mt-1.5">
                                <span className="text-sm font-medium text-amber-600 mt-0.5">Address:</span>
                                <span className="text-xs font-bold text-amber-900 bg-amber-50/80 px-2 py-1 rounded border border-amber-200/50 break-words max-w-[200px] md:max-w-[280px]">
                                  {order.address}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="w-full md:w-auto flex-1 max-w-md mx-auto md:mx-0">
                          <div className="relative pt-6 pb-2">
                             <div className="flex items-center justify-between relative z-10">
                                <div className="flex flex-col items-center">
                                  <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs border-4 border-white shadow-sm"><CheckCircle size={12}/></div>
                                  <span className="text-xs font-bold text-amber-900 mt-2">Placed</span>
                                </div>
                                <div className={`flex-1 h-1 mx-2 rounded ${order.status === 'Delivered' ? 'bg-amber-500' : 'bg-amber-100'}`}></div>
                                <div className="flex flex-col items-center">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border-4 border-white shadow-sm ${order.status === 'Delivered' ? 'bg-amber-500 text-white' : 'bg-amber-200 text-amber-700'}`}>{order.status === 'Delivered' ? <CheckCircle size={12}/> : <Clock size={12}/>}</div>
                                  <span className={`text-xs font-bold mt-2 ${order.status === 'Delivered' ? 'text-amber-900' : 'text-amber-600'}`}>Delivery</span>
                                </div>
                             </div>
                             <div className="text-center mt-3 text-sm font-bold text-amber-800">
                               Function: <span className="text-amber-950">{order.functionDate}</span> • Est. Delivery: <span className="text-amber-950">{order.deliveryDate}</span>
                             </div>
                          </div>
                        </div>
                        
                        <div className="shrink-0 w-full md:w-auto text-right md:text-left mt-2 md:mt-0 flex flex-col gap-2">
                          <span className={`px-4 py-2 rounded-full text-sm font-bold border inline-block text-center ${order.status === 'Delivered' ? 'bg-[#e6f7ec] text-[#047857] border-[#9fe2bf]' : 'bg-[#fff7ed] text-[#d35400] border-[#fdba74]'}`}>
                            {order.status}
                          </span>
                          <span className={`px-4 py-1.5 rounded-full text-xs font-bold border inline-block text-center ${
                            order.paymentStatus === 'Full Paid' ? 'bg-[#e6f7ec] text-[#047857] border-[#9fe2bf]' : 
                            order.paymentStatus === 'Partially Paid' ? 'bg-[#fff7ed] text-[#d35400] border-[#fdba74]' :
                            'bg-[#fee2e2] text-[#b91c1c] border-[#fca5a5]'
                          }`}>
                            {order.paymentStatus || 'Pending'}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-6 print:hidden">
               <div className="bg-[#ebe6df] p-4 rounded-2xl shadow-[6px_6px_12px_rgba(0,0,0,0.1),-6px_-6px_12px_rgba(255,255,255,0.8)] border-2 border-white/40 flex flex-wrap justify-between items-center gap-4">
                 
                 <div className="flex items-center gap-4">
                   <h2 className="text-xl font-black text-[#3e2723] flex items-center gap-2">
                     <Calendar className="text-amber-700"/> Report Analytics
                   </h2>
                   
                   <div className="relative">
                     <select 
                       value={reportDashboardFilter} 
                       onChange={(e) => setReportDashboardFilter(e.target.value)} 
                       className="pl-3 pr-8 py-1.5 bg-white border border-[#d7ccc8] rounded-xl text-sm font-bold text-[#5d4037] outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-sm appearance-none"
                     >
                       <option value="All">All Dashboards</option>
                       <option value="Dashboard 1">Dashboard 1 (Choc)</option>
                       <option value="Dashboard 2">Dashboard 2 (Prod)</option>
                     </select>
                     <ChevronDown size={14} className="absolute right-3 top-2.5 text-[#a46c3b] pointer-events-none" />
                   </div>
                 </div>

                 <div className="flex items-center gap-3">
                   <div className="flex items-center gap-2 bg-white/70 p-2 rounded-xl border-2 border-white shadow-[inset_2px_2px_5px_rgba(0,0,0,0.05)]">
                     <span className="text-sm font-bold text-amber-800">From:</span>
                     <input type="date" value={reportDateRange.start} onChange={e => setReportDateRange({...reportDateRange, start: e.target.value})} className="text-sm p-1 rounded border-none outline-none font-medium bg-transparent" />
                     <span className="text-sm font-bold text-amber-800">To:</span>
                     <input type="date" value={reportDateRange.end} onChange={e => setReportDateRange({...reportDateRange, end: e.target.value})} className="text-sm p-1 rounded border-none outline-none font-medium bg-transparent" />
                     {(reportDateRange.start || reportDateRange.end) && (
                       <button onClick={() => setReportDateRange({start: "", end: ""})} className="text-red-500 hover:bg-red-100 p-1 rounded-full"><X size={16}/></button>
                     )}
                   </div>
                   <button onClick={() => setIsReportPreviewOpen(true)} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl font-bold shadow-[4px_4px_10px_rgba(0,0,0,0.2)] transition-transform hover:-translate-y-0.5">
                     <Eye size={18}/> Preview Report
                   </button>
                 </div>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                  <div className="lg:col-span-2 space-y-6">

                    <div className="bg-[#ebe6df] p-6 rounded-[2rem] shadow-[6px_6px_12px_rgba(0,0,0,0.1),-6px_-6px_12px_rgba(255,255,255,0.8)] border-2 border-white/40">
                      <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-black text-[#3e2723] flex items-center gap-2">
                          <TrendingUp className="text-amber-700"/> Top Selling {reportDashboardFilter === 'Dashboard 2' ? 'Products' : 'Chocolates'}
                        </h2>
                      </div>
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {reportData.topChocs.length === 0 ? (
                          <p className="text-amber-700 font-medium">No sales data in this date range.</p>
                        ) : (
                          reportData.topChocs.map(([name, count], index) => (
                            <div key={index} className="flex items-center justify-between p-4 bg-white/80 rounded-2xl border border-white shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ffe082] to-[#ffb300] text-amber-900 font-black flex items-center justify-center text-sm shadow-inner">
                                  #{index + 1}
                                </div>
                                <span className="font-bold text-[#5d4037] text-lg">{name}</span>
                              </div>
                              <span className="font-bold text-[#b97a3d] bg-amber-50 px-4 py-1.5 rounded-xl border border-amber-200">
                                {count} Items Sold
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="bg-[#ebe6df] p-6 rounded-[2rem] shadow-[6px_6px_12px_rgba(0,0,0,0.1),-6px_-6px_12px_rgba(255,255,255,0.8)] border-2 border-white/40">
                      <h2 className="text-xl font-black text-[#3e2723] mb-6 flex items-center gap-2">
                        <Package className="text-blue-600"/> Sales Visual Chart
                      </h2>
                      <div className="h-72 w-full">
                        {reportData.chartData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={reportData.chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                              <XAxis dataKey="name" tick={{fontSize: 12, fill: '#5d4037', fontWeight: 'bold'}} />
                              <YAxis tick={{fontSize: 12, fill: '#5d4037', fontWeight: 'bold'}} />
                              <Tooltip cursor={{fill: '#f5f5f5'}} contentStyle={{borderRadius: '12px', fontWeight: 'bold'}} />
                              <Bar 
                                dataKey="count" 
                                radius={[8, 8, 0, 0]}
                                isAnimationActive={true} 
                                animationBegin={0} 
                                animationDuration={1500} 
                                animationEasing="ease-out"
                              >
                                {reportData.chartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex h-full items-center justify-center text-gray-400 font-bold">No Data for Graph</div>
                        )}
                      </div>
                    </div>

                  </div>

                  <div className="h-full flex flex-col">
                    <div className="bg-[#ebe6df] p-7 rounded-[2rem] shadow-[6px_6px_12px_rgba(0,0,0,0.1),-6px_-6px_12px_rgba(255,255,255,0.8)] border-2 border-white/40 flex-1 flex flex-col relative overflow-hidden">
                      
                      <div className="flex items-center gap-4 mb-6 shrink-0 border-b border-[#d7ccc8]/60 pb-4 relative z-10">
                        <button 
                          onClick={() => setIsAdminAuthModalOpen(true)}
                          className="w-12 h-12 rounded-full flex items-center justify-center bg-white border border-[#d7ccc8] text-[#5d4037] hover:scale-105 cursor-pointer shadow-sm shrink-0 transition-transform"
                          title="Click to Login as Admin"
                        >
                          <User size={24} strokeWidth={2.5} />
                        </button>
                        <div>
                          <h2 className="text-xl font-black text-[#3e2723] leading-tight">Summary Stats Overview</h2>
                          <span className="text-[10px] font-extrabold text-[#a46c3b] uppercase tracking-widest bg-white/50 px-3 py-0.5 rounded-full border border-[#d7ccc8]/50 inline-block mt-1">
                            PUBLIC VIEW
                          </span>
                        </div>
                      </div>

                      <div className="flex-1 flex flex-col transition-all duration-500">
                        <ul className="space-y-5 shrink-0">
                          <li className="flex justify-between items-center pb-4 border-b border-[#d7ccc8]/70">
                            <span className="text-[#a46c3b] font-bold">Total Orders</span>
                            <span className="font-black text-[#3e2723] text-2xl">{reportData.filteredOrders.length}</span>
                          </li>
                          <li className="flex justify-between items-center pb-4 border-b border-[#d7ccc8]/70">
                            <span className="text-[#a46c3b] font-bold">Total Items Sold</span>
                            <span className="font-black text-[#3e2723] text-2xl">{reportData.totalItems}</span>
                          </li>
                          <li className="flex justify-between items-center pb-4 border-b border-[#d7ccc8]/70">
                            <span className="text-[#a46c3b] font-bold">Total Delivery Charge</span>
                            <span className="font-black text-[#3e2723] text-2xl">₹{reportData.totalDeliveryCharge.toLocaleString()}</span>
                          </li>
                          <li className="flex justify-between items-center pb-4 border-b border-[#d7ccc8]/70">
                            <span className="text-[#a46c3b] font-bold">Total Revenue</span>
                            <span className="font-black text-[#15803d] text-2xl">₹{reportData.totalRev.toLocaleString()}</span>
                          </li>
                        </ul>

                        <div className="mt-8 flex-1 min-h-[220px] w-full relative flex items-center justify-center">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={[
                                  {name: 'Delivered', value: reportData.filteredOrders.filter(o => o.status === 'Delivered').length},
                                  {name: 'In Process', value: reportData.filteredOrders.filter(o => o.status === 'In Process').length}
                                ]}
                                innerRadius="60%"
                                outerRadius="80%"
                                paddingAngle={5}
                                dataKey="value"
                                isAnimationActive={true}
                                animationBegin={200}
                                animationDuration={1500}
                                animationEasing="ease-out"
                              >
                                <Cell fill="#10b981" />
                                <Cell fill="#f59e0b" />
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                            <span className="text-3xl font-black text-gray-800">{reportData.filteredOrders.length}</span>
                            <span className="text-sm font-bold text-gray-500">Total</span>
                          </div>
                        </div>
                        
                        <div className="flex justify-center gap-5 mt-4 shrink-0">
                          <div className="flex items-center gap-1.5 text-sm font-bold text-gray-700"><div className="w-3.5 h-3.5 rounded-full bg-emerald-500"></div> Delivered</div>
                          <div className="flex items-center gap-1.5 text-sm font-bold text-gray-700"><div className="w-3.5 h-3.5 rounded-full bg-amber-500"></div> Processing</div>
                        </div>
                      </div>

                    </div>
                  </div>
               </div>
            </div>
          )}

          {/* 🟢 ADMIN DASHBOARD VIEW (Cost Calculation Concept) */}
          {(activeTab as any) === 'admin_panel' && (
            <div className="max-w-7xl mx-auto h-full animate-in fade-in duration-500 flex flex-col gap-6 w-full">
               
               {/* 🟢 MODIFIED HEADER: ADDED BOOK DROPDOWN AND SMALLER CLOSE BUTTON */}
               <div className="flex justify-between items-center bg-[#f2eee6] p-4 rounded-2xl shadow-sm border border-[#d7ccc8] shrink-0 z-20 relative">
                 <div>
                    <h2 className="text-xl font-black text-[#3e2723] flex items-center gap-2">
                      <TrendingUp className="text-amber-700"/> {adminReportDash === 'None' ? 'Detailed Cost Analytics' : `Admin Analytics (${adminReportDash})`}
                    </h2>
                    <p className="text-sm font-medium text-amber-700 mt-1">Sticker (₹1.5) | Labour (₹1) | Order wise mapped data.</p>
                 </div>

                 <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-[#d7ccc8] shadow-sm">
                      <select
                        value={adminDateType}
                        onChange={(e) => setAdminDateType(e.target.value)}
                        className="font-bold text-amber-900 bg-transparent outline-none cursor-pointer text-xs"
                      >
                        <option value="Delivery Date">Delivery Date</option>
                        <option value="Order Date">Order Date</option>
                        <option value="Function Date">Function Date</option>
                      </select>
                      <div className="h-4 w-[1px] bg-amber-200 mx-1"></div>
                      <span className="text-xs font-bold text-amber-800">From:</span>
                      <input
                        type="date"
                        value={adminDateRange.from}
                        onChange={(e) => setAdminDateRange({ ...adminDateRange, from: e.target.value })}
                        className="text-xs p-1 rounded outline-none font-medium bg-transparent cursor-pointer text-amber-950"
                      />
                      <span className="text-xs font-bold text-amber-800">To:</span>
                      <input
                        type="date"
                        value={adminDateRange.to}
                        onChange={(e) => setAdminDateRange({ ...adminDateRange, to: e.target.value })}
                        className="text-xs p-1 rounded outline-none font-medium bg-transparent cursor-pointer text-amber-950"
                      />
                      {(adminDateRange.from || adminDateRange.to) && (
                        <button onClick={() => setAdminDateRange({ from: "", to: "" })} className="text-red-500 hover:bg-red-100 p-1 rounded-full transition-colors ml-1">
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {/* 🟢 NEW BOOK DROPDOWN TO TOGGLE ADMIN REPORTS */}
                    <div className="relative">
                       <button 
                          onClick={() => setAdminReportMenuOpen(!adminReportMenuOpen)}
                          className="px-3 py-2 rounded-xl text-sm font-bold border-2 border-[#d7ccc8] text-[#5d4037] hover:bg-amber-50 bg-white shadow-sm transition-all flex items-center gap-1.5"
                       >
                          <Book size={16}/> {adminReportDash === 'None' ? 'Table View' : adminReportDash} <ChevronDown size={14}/>
                       </button>
                       {adminReportMenuOpen && (
                          <div className="absolute right-0 mt-2 w-40 bg-white border border-[#d7ccc8] rounded-xl shadow-lg z-50 overflow-hidden">
                             <button onClick={() => { setAdminReportDash('None'); setAdminReportMenuOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-amber-50 text-sm font-bold text-amber-900 border-b border-[#f5f5f5]">Table View</button>
                             <button onClick={() => { setAdminReportDash('Dashboard 1'); setAdminReportMenuOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-amber-50 text-sm font-bold text-amber-900 border-b border-[#f5f5f5]">Dashboard 1</button>
                             <button onClick={() => { setAdminReportDash('Dashboard 2'); setAdminReportMenuOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-amber-50 text-sm font-bold text-amber-900">Dashboard 2</button>
                          </div>
                       )}
                    </div>

                    <button 
                       onClick={() => setShowApprovalPanel(true)} 
                       className="px-3 py-2 rounded-xl text-sm font-bold border-2 border-[#d7ccc8] text-amber-700 hover:bg-amber-50 bg-white shadow-sm transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
                    >
                       <Lock size={16}/> Approvals ({employees.filter(e => e.status === 'Pending').length})
                    </button>
                    
                    <button 
                       onClick={() => setActiveTab('reports')} 
                       className="px-3 py-2 rounded-xl text-sm font-bold border-2 border-[#d7ccc8] text-[#5d4037] hover:bg-red-50 hover:text-red-700 hover:border-red-200 bg-white shadow-sm transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
                    >
                       <X size={16}/> Close Admin
                    </button>
                 </div>
               </div>

               {/* 🟢 CONDITIONAL RENDER: TABLE VS REPORT VIEW */}
               {adminReportDash === 'None' ? (
                 <div className="bg-white rounded-[2rem] shadow-md border border-[#d7ccc8] overflow-hidden flex-1 flex flex-col">
                   <div className="overflow-auto flex-1 px-6">
                      <table className="w-full text-left border-collapse min-w-[1100px]">
                        <thead className="sticky top-0 bg-amber-50 z-30 shadow-md border-b-2 border-amber-200">
                          <tr className="text-xs uppercase tracking-widest text-[#5d4037]">
                            <th className="p-4 font-black border-r border-amber-200/50">Serial No</th>
                            <th className="p-4 font-black border-r border-amber-200/50">Delivery Date</th>
                            <th className="p-4 font-black">Chocolate Name</th>
                            <th className="p-4 font-black text-right border-l border-amber-200/50">Purch. Cost <br/><span className="text-[9px] font-bold text-amber-600">(Per Item)</span></th>
                            <th className="p-4 font-black text-center border-l border-amber-200/50">Count</th>
                            <th className="p-4 font-black text-right border-l border-amber-200/50">Sticker Cost <br/><span className="text-[9px] font-bold text-amber-600">(Count x 1.5)</span></th>
                            <th className="p-4 font-black text-right">Labour Cost <br/><span className="text-[9px] font-bold text-amber-600">(Count x 1)</span></th>
                            <th className="p-4 font-black text-right">Total Purchase <br/><span className="text-[9px] font-bold text-amber-600">(Cost x Count)</span></th>
                            <th className="p-4 font-black text-right bg-red-50 text-red-800 border-l border-red-200">Final Cost <br/><span className="text-[9px] font-bold text-red-600">(Sticker+Lab+Purch)</span></th>
                          </tr>
                        </thead>
                        <tbody>
                            {costAnalyticsData.rows.length === 0 ? (
                              <tr><td colSpan={9} className="p-8 text-center text-amber-700 font-bold">No records found for the selected date range.</td></tr>
                            ) : (
                              costAnalyticsData.rows.map((row, idx) => (
                                <tr key={idx} className="border-b border-amber-100 text-sm hover:bg-amber-50/30 transition-colors relative z-0">
                                  <td className="p-4 font-extrabold text-amber-900 border-r border-amber-50">{row.serialNo}</td>
                                  <td className="p-4 font-bold text-amber-900 border-r border-amber-50 whitespace-nowrap">{row.deliveryDate}</td>
                                  <td className="p-4 font-bold text-amber-950 border-r border-amber-50 max-w-[200px] truncate" title={row.chocolateName}>{row.chocolateName}</td>
                                  <td className="p-4 text-right font-medium text-amber-800 border-r border-amber-50">₹{row.purchasePricePerItem.toFixed(2)}</td>
                                  <td className="p-4 text-center font-black text-[#4a2c1d] border-r border-amber-50 bg-amber-50/50">{row.count.toLocaleString()}</td>
                                  <td className="p-4 text-right font-medium text-amber-900 border-r border-amber-50">₹{row.stickerCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                  <td className="p-4 text-right font-medium text-amber-900 border-r border-amber-50">₹{row.labourCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                  <td className="p-4 text-right font-medium text-amber-900 border-r border-amber-50">₹{row.totalPurchase.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                  <td className="p-4 text-right font-black text-red-600 bg-red-50/30">₹{row.finalCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                </tr>
                              ))
                            )}
                        </tbody>
                        {costAnalyticsData.rows.length > 0 && (
                          <tfoot className="sticky bottom-0 bg-[#3e2723] text-amber-50 z-30 shadow-[0_-5px_15px_rgba(0,0,0,0.2)]">
                            <tr className="text-sm">
                              <td className="p-4 border-r border-[#5d4037]"></td>
                              <td className="p-4 border-r border-[#5d4037]"></td>
                              <td className="p-4 border-r border-[#5d4037]"></td>
                              <td className="p-4 text-right font-black uppercase tracking-widest border-r border-[#5d4037]">Grand Total:</td>
                              <td className="p-4 text-center font-black border-r border-[#5d4037]">{costAnalyticsData.grandTotals.count.toLocaleString()}</td>
                              <td className="p-4 text-right font-bold border-r border-[#5d4037]">₹{costAnalyticsData.grandTotals.stickerCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                              <td className="p-4 text-right font-bold border-r border-[#5d4037]">₹{costAnalyticsData.grandTotals.labourCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                              <td className="p-4 text-right font-bold border-r border-[#5d4037]">₹{costAnalyticsData.grandTotals.totalPurchase.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                              <td className="p-4 text-right font-black text-[#ffb300] text-lg">₹{costAnalyticsData.grandTotals.finalCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                   </div>
                 </div>
               ) : adminReportData ? (
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch flex-1 overflow-auto custom-scrollbar pr-2 pb-6">
                    <div className="lg:col-span-2 space-y-6">
                      <div className="bg-[#ebe6df] p-6 rounded-[2rem] shadow-[6px_6px_12px_rgba(0,0,0,0.1),-6px_-6px_12px_rgba(255,255,255,0.8)] border-2 border-white/40">
                        <div className="flex justify-between items-center mb-6">
                          <h2 className="text-xl font-black text-[#3e2723] flex items-center gap-2">
                            <TrendingUp className="text-amber-700"/> Top Selling {adminReportDash === 'Dashboard 2' ? 'Products' : 'Chocolates'}
                          </h2>
                        </div>
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                          {adminReportData.topChocs.length === 0 ? (
                            <p className="text-amber-700 font-medium">No sales data in this date range.</p>
                          ) : (
                            adminReportData.topChocs.map(([name, count], index) => (
                              <div key={index} className="flex items-center justify-between p-4 bg-white/80 rounded-2xl border border-white shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-4">
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ffe082] to-[#ffb300] text-amber-900 font-black flex items-center justify-center text-sm shadow-inner">
                                    #{index + 1}
                                  </div>
                                  <span className="font-bold text-[#5d4037] text-lg">{name}</span>
                                </div>
                                <span className="font-bold text-[#b97a3d] bg-amber-50 px-4 py-1.5 rounded-xl border border-amber-200">
                                  {count} Items Sold
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="bg-[#ebe6df] p-6 rounded-[2rem] shadow-[6px_6px_12px_rgba(0,0,0,0.1),-6px_-6px_12px_rgba(255,255,255,0.8)] border-2 border-white/40">
                        <h2 className="text-xl font-black text-[#3e2723] mb-6 flex items-center gap-2">
                          <Package className="text-blue-600"/> Sales Visual Chart
                        </h2>
                        <div className="h-72 w-full">
                          {adminReportData.chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={adminReportData.chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                <XAxis dataKey="name" tick={{fontSize: 12, fill: '#5d4037', fontWeight: 'bold'}} />
                                <YAxis tick={{fontSize: 12, fill: '#5d4037', fontWeight: 'bold'}} />
                                <Tooltip cursor={{fill: '#f5f5f5'}} contentStyle={{borderRadius: '12px', fontWeight: 'bold'}} />
                                <Bar 
                                  dataKey="count" 
                                  radius={[8, 8, 0, 0]}
                                  isAnimationActive={true} 
                                  animationBegin={0} 
                                  animationDuration={1500} 
                                  animationEasing="ease-out"
                                >
                                  {adminReportData.chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="flex h-full items-center justify-center text-gray-400 font-bold">No Data for Graph</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="h-full flex flex-col">
                      <div className="bg-[#ebe6df] p-7 rounded-[2rem] shadow-[6px_6px_12px_rgba(0,0,0,0.1),-6px_-6px_12px_rgba(255,255,255,0.8)] border-2 border-white/40 flex-1 flex flex-col relative overflow-hidden">
                        
                        <div className="flex items-center gap-4 mb-6 shrink-0 border-b border-[#d7ccc8]/60 pb-4 relative z-10">
                          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white border border-[#d7ccc8] text-[#5d4037] shadow-sm shrink-0">
                            <User size={24} strokeWidth={2.5} />
                          </div>
                          <div>
                            <h2 className="text-xl font-black text-[#3e2723] leading-tight">Summary Stats Overview</h2>
                            <span className="text-[10px] font-extrabold text-[#a46c3b] uppercase tracking-widest bg-white/50 px-3 py-0.5 rounded-full border border-[#d7ccc8]/50 inline-block mt-1">
                              ADMIN VIEW
                            </span>
                          </div>
                        </div>

                        <div className="flex-1 flex flex-col transition-all duration-500">
                          <ul className="space-y-5 shrink-0">
                            <li className="flex justify-between items-center pb-4 border-b border-[#d7ccc8]/70">
                              <span className="text-[#a46c3b] font-bold">Total Orders</span>
                              <span className="font-black text-[#3e2723] text-2xl">{adminReportData.filteredOrders.length}</span>
                            </li>
                            <li className="flex justify-between items-center pb-4 border-b border-[#d7ccc8]/70">
                              <span className="text-[#a46c3b] font-bold">Total Items Sold</span>
                              <span className="font-black text-[#3e2723] text-2xl">{adminReportData.totalItems}</span>
                            </li>
                            <li className="flex justify-between items-center pb-4 border-b border-[#d7ccc8]/70">
                              <span className="text-[#a46c3b] font-bold">Total Delivery Charge</span>
                              <span className="font-black text-[#3e2723] text-2xl">₹{adminReportData.totalDeliveryCharge.toLocaleString()}</span>
                            </li>
                            <li className="flex justify-between items-center pb-4 border-b border-[#d7ccc8]/70">
                              <span className="text-[#a46c3b] font-bold">Total Revenue</span>
                              <span className="font-black text-[#15803d] text-2xl">₹{adminReportData.totalRev.toLocaleString()}</span>
                            </li>
                          </ul>

                          <div className="mt-8 flex-1 min-h-[220px] w-full relative flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={[
                                    {name: 'Delivered', value: adminReportData.filteredOrders.filter(o => o.status === 'Delivered').length},
                                    {name: 'In Process', value: adminReportData.filteredOrders.filter(o => o.status === 'In Process').length}
                                  ]}
                                  innerRadius="60%"
                                  outerRadius="80%"
                                  paddingAngle={5}
                                  dataKey="value"
                                  isAnimationActive={true}
                                  animationBegin={200}
                                  animationDuration={1500}
                                  animationEasing="ease-out"
                                >
                                  <Cell fill="#10b981" />
                                  <Cell fill="#f59e0b" />
                                </Pie>
                                <Tooltip />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                              <span className="text-3xl font-black text-gray-800">{adminReportData.filteredOrders.length}</span>
                              <span className="text-sm font-bold text-gray-500">Total</span>
                            </div>
                          </div>
                          
                          <div className="flex justify-center gap-5 mt-4 shrink-0">
                            <div className="flex items-center gap-1.5 text-sm font-bold text-gray-700"><div className="w-3.5 h-3.5 rounded-full bg-emerald-500"></div> Delivered</div>
                            <div className="flex items-center gap-1.5 text-sm font-bold text-gray-700"><div className="w-3.5 h-3.5 rounded-full bg-amber-500"></div> Processing</div>
                          </div>
                        </div>

                      </div>
                    </div>
                 </div>
               ) : null}

            </div>
          )}

        </div>
      </main>

      {/* 🟢 NEW PRODUCT MODAL */}
      {isAddProductModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => { setIsAddProductModalOpen(false); setEditProductId(null); setNewProductForm({name: "", price: ""}); }}>
          <div className="rounded-[2rem] shadow-2xl w-full max-w-sm p-8 bg-[#fffcf9] border border-amber-100" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-extrabold mb-6 text-[#5d4037] text-center tracking-wide border-b-2 border-dashed border-[#d7ccc8] pb-4">
              {editProductId ? "Edit Product" : "Add New Product"}
            </h2>
            <form onSubmit={handleAddCustomProduct} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1 text-[#5d4037]">Product Name</label>
                <input required type="text" value={newProductForm.name} onChange={(e) => setNewProductForm({...newProductForm, name: e.target.value})} className="w-full font-medium rounded-xl p-2.5 outline-none border-2 border-[#d7ccc8] focus:border-[#8d6e63] bg-white text-black shadow-inner" placeholder="Enter Product Name"/>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-[#5d4037]">Price (₹)</label>
                <input required type="number" value={newProductForm.price} onChange={(e) => setNewProductForm({...newProductForm, price: e.target.value})} className="w-full font-medium rounded-xl p-2.5 outline-none border-2 border-[#d7ccc8] focus:border-[#8d6e63] bg-white text-black shadow-inner" placeholder="Enter Price"/>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setIsAddProductModalOpen(false); setEditProductId(null); setNewProductForm({name: "", price: ""}); }} className="flex-1 px-4 py-3 rounded-xl font-bold border-2 border-[#d7ccc8] bg-white text-[#5d4037] hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🟢 NEW: INVENTORY MODAL */}
      {isInvModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsInvModalOpen(false)}>
          <div className="rounded-[2rem] shadow-2xl w-full max-w-md p-8 bg-[#fffcf9] border border-amber-100" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-extrabold mb-6 text-[#5d4037] text-center tracking-wide border-b-2 border-dashed border-[#d7ccc8] pb-4">Add Inventory Entry</h2>
            <form onSubmit={handleAddInventory} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1 text-[#5d4037]">Date</label>
                <input required type="date" value={invForm.date} onChange={(e) => setInvForm({...invForm, date: e.target.value})} className="w-full font-medium rounded-xl p-2.5 outline-none border-2 border-[#d7ccc8] focus:border-[#8d6e63] bg-white text-black shadow-inner" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-[#5d4037]">Chocolate Name</label>
                <select required value={invForm.chocolate} onChange={(e) => setInvForm({...invForm, chocolate: e.target.value})} className="w-full font-medium rounded-xl p-2.5 outline-none border-2 border-[#d7ccc8] focus:border-[#8d6e63] bg-white text-black shadow-inner cursor-pointer">
                   {TRACKED_INVENTORY.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-sm font-bold mb-1 text-[#5d4037]">Boxes</label>
                   <input required type="number" min="1" value={invForm.boxCount} onChange={(e) => setInvForm({...invForm, boxCount: e.target.value})} className="w-full font-medium rounded-xl p-2.5 outline-none border-2 border-[#d7ccc8] focus:border-[#8d6e63] bg-white text-black shadow-inner" placeholder="E.g. 10"/>
                 </div>
                 <div>
                   <label className="block text-sm font-bold mb-1 text-[#5d4037]">Count per Box</label>
                   <input required type="number" min="1" value={invForm.itemsPerBox} onChange={(e) => setInvForm({...invForm, itemsPerBox: e.target.value})} className="w-full font-medium rounded-xl p-2.5 outline-none border-2 border-[#d7ccc8] focus:border-[#8d6e63] bg-white text-black shadow-inner" placeholder="E.g. 50"/>
                 </div>
              </div>
              
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 mt-2 text-center">
                 <p className="text-xs font-bold text-amber-800 uppercase">Total Items to Add</p>
                 <p className="text-2xl font-black text-amber-950">
                    {(Number(invForm.boxCount) || 0) * (Number(invForm.itemsPerBox) || 0)}
                 </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsInvModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl font-bold border-2 border-[#d7ccc8] bg-white text-[#5d4037] hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-xl transition-all">Save Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🟢 EXPORT PREVIEW MODAL */}
      {isExportPreviewOpen && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 print:p-0 print:bg-white print:block">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden print:w-full print:max-w-none print:h-auto print:max-h-none print:shadow-none print:border-none print:rounded-none print:overflow-visible">
            
            <div className="p-6 border-b border-amber-100 flex justify-between items-center bg-amber-50/50 print:bg-white print:border-b-2 print:border-black">
              <div>
                <h2 className="text-2xl font-extrabold text-amber-950 print:text-black">Order Records Report</h2>
                <p className="text-amber-700 text-sm font-medium mt-1 print:text-gray-700">
                  Filters Applied: Payment ({paymentFilter}) | Delivery ({deliveryFilter})
                </p>
              </div>
              <div className="print:hidden">
                <button onClick={() => setIsExportPreviewOpen(false)} className="p-2 text-amber-600 hover:bg-amber-100 hover:text-amber-900 rounded-lg transition-colors">
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-auto flex-1 print:overflow-visible print:p-4">
               <div className="flex flex-wrap gap-6 mb-6 print:mb-8">
                  <div className="bg-white border border-amber-200 p-4 rounded-xl flex-1 min-w-[150px] print:border-gray-400">
                    <p className="text-xs font-bold text-amber-600 uppercase tracking-wider print:text-gray-500">Total Records</p>
                    <h4 className="text-2xl font-black text-amber-950 mt-1 print:text-black">{filteredDashboardOrders.length}</h4>
                  </div>
                  <div className="bg-white border border-amber-200 p-4 rounded-xl flex-1 min-w-[150px] print:border-gray-400">
                    <p className="text-xs font-bold text-amber-600 uppercase tracking-wider print:text-gray-500">Total Items</p>
                    <h4 className="text-2xl font-black text-amber-950 mt-1 print:text-black">
                      {filteredDashboardOrders.reduce((sum, o) => sum + Number(o.count || 0), 0)}
                    </h4>
                  </div>
                  <div className="bg-white border border-amber-200 p-4 rounded-xl flex-1 min-w-[150px] print:border-gray-400">
                    <p className="text-xs font-bold text-amber-600 uppercase tracking-wider print:text-gray-500">Filtered Revenue</p>
                    <h4 className="text-2xl font-black text-green-700 mt-1 print:text-black">₹{displayRevenue.toLocaleString()}</h4>
                  </div>
               </div>

               <table className="w-full text-left border-collapse border border-amber-200 print:border-black">
                 <thead>
                   <tr className="bg-amber-100 text-amber-900 text-sm border-b border-amber-200 print:bg-gray-200 print:text-black print:border-black">
                     <th className="p-3 font-bold border-r border-amber-200 print:border-black">Name</th>
                     <th className="p-3 font-bold border-r border-amber-200 print:border-black">Phone</th>
                     <th className="p-3 font-bold border-r border-amber-200 print:border-black">Delivery Date</th>
                     <th className="p-3 font-bold border-r border-amber-200 print:border-black">Chocolate</th>
                     <th className="p-3 font-bold border-r border-amber-200 print:border-black text-center">Count</th>
                     
                     <th className="p-3 font-bold border-r border-amber-200 print:border-black text-right">Choc. Price</th>
                     <th className="p-3 font-bold border-r border-amber-200 print:border-black text-right">Del. Charge</th>
                     <th className="p-3 font-bold border-r border-amber-200 print:border-black text-right">Discount</th>
                     
                     <th className="p-3 font-bold border-r border-amber-200 print:border-black text-right">Total Price</th>
                     <th className="p-3 font-bold border-r border-amber-200 print:border-black text-center">Payment</th>
                     <th className="p-3 font-bold text-center border-amber-200 print:border-black">Status</th>
                   </tr>
                 </thead>
                 <tbody>
                    {filteredDashboardOrders.map((order, idx) => {
                      const priceData = calculatePriceInfo(order.chocolate, order.count, order.discount, order.isDeliveryFree, order.paymentStatus, order.category, customPricesMap, order.manualDeliveryFee, order.orderStatus);
                      return (
                      <tr key={idx} className="border-b border-amber-100 text-sm print:border-gray-400">
                        <td className="p-3 font-bold text-amber-950 border-r border-amber-100 print:border-gray-400 print:text-black">{order.name}</td>
                        <td className="p-3 text-amber-800 border-r border-amber-100 print:border-gray-400 print:text-black">{order.phone}</td>
                        <td className="p-3 font-medium text-amber-900 border-r border-amber-100 print:border-gray-400 print:text-black">{order.deliveryDate}</td>
                        <td className="p-3 text-amber-800 border-r border-amber-100 print:border-gray-400 print:text-black max-w-[200px] truncate">{order.chocolate}</td>
                        
                        <td className="p-3 text-center font-bold text-amber-950 border-r border-amber-100 print:border-gray-400 print:text-black">
                           {order.count}
                        </td>
                        
                        <td className="p-3 text-right font-medium text-amber-900 border-r border-amber-100 print:border-gray-400 print:text-black">₹{priceData.chocolatePrice.toLocaleString()}</td>
                        <td className="p-3 text-right font-medium text-amber-900 border-r border-amber-100 print:border-gray-400 print:text-black">
                           {order.isDeliveryFree ? 'Free' : `₹${priceData.deliveryCharge.toLocaleString()}`}
                        </td>
                        <td className="p-3 text-right font-medium text-red-600 border-r border-amber-100 print:border-gray-400 print:text-black">-₹{order.discount || 0}</td>
                        
                        <td className="p-3 text-right font-bold text-amber-950 border-r border-amber-100 print:border-gray-400 print:text-black">₹{priceData.totalPrice.toLocaleString()}</td>
                        <td className="p-3 text-center font-bold text-amber-800 border-r border-amber-100 print:border-gray-400 print:text-black">{order.paymentStatus || 'Pending'}</td>
                        <td className="p-3 text-center font-bold text-amber-800 border-amber-100 print:border-gray-400 print:text-black">{order.status}</td>
                      </tr>
                      )
                    })}
                 </tbody>
               </table>
            </div>

            <div className="p-6 border-t border-amber-200 bg-white flex justify-end gap-4 print:hidden shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] z-10">
              <button onClick={() => setIsExportPreviewOpen(false)} className="px-6 py-2.5 rounded-xl font-bold border-2 border-amber-200 text-amber-800 hover:bg-amber-50 hover:border-amber-300 transition-colors">
                Cancel
              </button>
              <button onClick={handleExportExcel} className="px-8 py-2.5 rounded-xl font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-md hover:shadow-lg transition-all flex items-center gap-2">
                <Download size={20}/> Download as Excel
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 🟢 MODALS (ADD/EDIT) */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 print:hidden backdrop-blur-sm"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className={`rounded-[2rem] shadow-2xl w-full max-w-md p-8 bg-[#fffcf9] overflow-y-auto max-h-[90vh] border border-amber-100`}
            onClick={(e) => e.stopPropagation()} 
          >
            <h2 className={`text-3xl font-extrabold mb-8 text-[#5d4037] text-center tracking-wide border-b-2 border-dashed border-[#d7ccc8] pb-4`}>
              {formData.id ? "Edit Order Details" : "Add New Order"}
            </h2>
            
            <datalist id="names-list">{uniqueNames.map((name, i) => <option key={i} value={name} />)}</datalist>
            <datalist id="phones-list">{uniquePhones.map((phone, i) => <option key={i} value={phone} />)}</datalist>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={`block text-sm font-bold mb-1 text-[#5d4037]`}>Order Confirm Date</label>
                  <input required type="date" name="orderDate" value={formData.orderDate} onChange={handleInputChange} className={`w-full font-medium rounded-xl p-2.5 outline-none border-2 border-[#d7ccc8] focus:border-[#8d6e63] bg-white text-black shadow-inner`} />
                </div>
                
                <div className="col-span-2">
                  <label className={`block text-sm font-bold mb-1 text-[#5d4037]`}>Customer Name</label>
                  <input required list="names-list" type="text" name="name" value={formData.name} onChange={handleInputChange} className={`w-full font-medium rounded-xl p-2.5 outline-none border-2 border-[#d7ccc8] focus:border-[#8d6e63] bg-white text-black placeholder-gray-400 shadow-inner`} placeholder="Enter Name"/>
                </div>
                <div className="col-span-2">
                  <label className={`block text-sm font-bold mb-1 text-[#5d4037]`}>Contact Number</label>
                  <input required list="phones-list" type="text" name="phone" value={formData.phone} onChange={handleInputChange} className={`w-full font-medium rounded-xl p-2.5 outline-none border-2 border-[#d7ccc8] focus:border-[#8d6e63] bg-white text-black placeholder-gray-400 shadow-inner`} placeholder="Phone Number"/>
                </div>
                <div>
                  <label className={`block text-sm font-bold mb-1 text-[#5d4037]`}>Function Date</label>
                  <input required type="date" name="functionDate" value={formData.functionDate} onChange={handleInputChange} className={`w-full font-medium rounded-xl p-2.5 outline-none border-2 border-[#d7ccc8] focus:border-[#8d6e63] bg-white text-black shadow-inner`} />
                </div>
                <div>
                  <label className={`block text-sm font-bold mb-1 text-[#5d4037]`}>Delivery Date</label>
                  <input required type="date" name="deliveryDate" value={formData.deliveryDate} onChange={handleInputChange} className={`w-full font-medium rounded-xl p-2.5 outline-none border-2 border-[#d7ccc8] focus:border-[#8d6e63] bg-white text-black shadow-inner`} />
                </div>
                
                <div className="col-span-2">
                  <div className="flex justify-between items-end mb-1">
                    <label className={`block text-sm font-bold text-[#5d4037]`}>{formData.category === 'product' ? 'Product Name' : 'Chocolate Name'}</label>
                  </div>
                  {/* 🟢 EXACTLY SHOWS 'Select products...' FOR DASHBOARD 2 */}
                  <ChocolateMultiSelect 
                    value={formData.chocolate} 
                    onChange={(val) => setFormData({ ...formData, chocolate: val })} 
                    suggestions={formData.category === 'product' ? customProducts.map(p => p.name) : uniqueChocolates} 
                    pricesMap={formData.category === 'product' ? customPricesMap : CHOCOLATE_PRICES_MAP} 
                    placeholderText={formData.category === 'product' ? "Select products..." : "Select  products..."}
                  />
                </div>

                <div className="col-span-2">
                  <label className={`block text-sm font-bold mb-1 text-[#5d4037]`}>Address (Optional)</label>
                  <textarea name="address" value={formData.address} onChange={handleInputChange} className={`w-full font-medium rounded-xl p-2.5 outline-none border-2 border-[#d7ccc8] focus:border-[#8d6e63] bg-white text-black placeholder-gray-400 shadow-inner resize-none`} placeholder="Enter delivery address..." rows={2}/>
                </div>

                {/* 🟢 CONDITIONALLY HIDE ORDER TYPE FOR DASHBOARD 2 */}
                {formData.category !== 'product' && (
                  <div className="col-span-2">
                    <label className={`block text-sm font-bold mb-2 text-[#5d4037]`}>Order Type</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-950 bg-white border-2 border-[#d7ccc8] px-4 py-2 rounded-xl focus-within:border-[#8d6e63] hover:bg-amber-50 transition-colors flex-1 shadow-sm">
                        <input type="radio" name="orderType" value="Self" checked={formData.orderType === "Self"} onChange={handleInputChange} className="w-4 h-4 accent-[#8d6e63]" />
                        Self
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-950 bg-white border-2 border-[#d7ccc8] px-4 py-2 rounded-xl focus-within:border-[#8d6e63] hover:bg-amber-50 transition-colors flex-1 shadow-sm">
                        <input type="radio" name="orderType" value="Others" checked={formData.orderType === "Others"} onChange={handleInputChange} className="w-4 h-4 accent-[#8d6e63]" />
                        Others
                      </label>
                    </div>
                  </div>
                )}

                <div>
                  <label className={`block text-sm font-bold mb-1 text-[#5d4037]`}>Count (Quantity)</label>
                  <input required type="number" name="count" value={formData.count} onChange={handleInputChange} className={`w-full font-medium rounded-xl p-2.5 outline-none border-2 border-[#d7ccc8] focus:border-[#8d6e63] bg-white text-black placeholder-gray-400 shadow-inner`} placeholder="Quantity"/>
                </div>

                <div>
                  <label className={`block text-sm font-bold mb-1 text-[#5d4037]`}>Discount Amount</label>
                  <input type="number" list="discount-suggestions" name="discount" value={formData.discount || ''} onChange={handleInputChange} className={`w-full font-medium rounded-xl p-2.5 outline-none border-2 border-[#d7ccc8] focus:border-[#8d6e63] bg-white text-black placeholder-gray-400 shadow-inner`} placeholder="Eg. 50"/>
                </div>

                {/* 🟢 Dashboards Manual Delivery Fee Field */}
                {formData.category === 'product' && (
                  <div className="col-span-2">
                    <label className={`block text-sm font-bold mb-1 text-[#5d4037]`}>Manual Delivery Fee (₹)</label>
                    <input type="number" name="manualDeliveryFee" value={formData.manualDeliveryFee} onChange={handleInputChange} className={`w-full font-medium rounded-xl p-2.5 outline-none border-2 border-[#d7ccc8] focus:border-[#8d6e63] bg-white text-black shadow-inner`} placeholder="Eg. 100"/>
                  </div>
                )}

                <div>
                  <label className={`block text-sm font-bold mb-1 text-[#5d4037]`}>Payment Status</label>
                  <select required name="paymentStatus" value={formData.paymentStatus} onChange={handleInputChange} className={`w-full font-bold rounded-xl p-2.5 outline-none border-2 border-[#d7ccc8] focus:border-[#8d6e63] bg-white text-black shadow-inner`}>
                    <option value="Pending">Pending</option>
                    <option value="Partially Paid">Partially Paid</option>
                    <option value="Full Paid">Full Paid</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-bold mb-1 text-[#5d4037]`}>Delivery Status</label>
                  <select required name="status" value={formData.status} onChange={handleInputChange} className={`w-full font-bold rounded-xl p-2.5 outline-none border-2 border-[#d7ccc8] focus:border-[#8d6e63] bg-white text-black shadow-inner`}>
                    <option value="In Process">In Process</option>
                    <option value="Delivered">Delivered</option>
                  </select>
                </div>

                {/* 🟢 CONDITIONALLY HIDE DETAILED ORDER STATUS FOR DASHBOARD 2 */}
                {formData.category !== 'product' && (
                  <div className="col-span-2">
                    <label className={`block text-sm font-bold mb-1 text-[#5d4037]`}>Detailed Order Status</label>
                    <select required name="orderStatus" value={formData.orderStatus} onChange={handleInputChange} className={`w-full font-bold rounded-xl p-2.5 outline-none border-2 border-[#d7ccc8] focus:border-[#8d6e63] bg-white text-black shadow-inner`}>
                      <option value="image edit (pending)">Image Edit (Pending)</option>
                      <option value="image edited (not paid)">Image Edited (Not Paid)</option>
                      <option value="forward to print (paid)">Forward to Print (Paid)</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                )}

                <div className="col-span-2">
                  <label className={`block text-sm font-bold mb-1 text-[#5d4037]`}>Advance Amount Paid (₹)</label>
                  <input type="number" name="advanceAmount" value={formData.advanceAmount || ''} onChange={handleInputChange} className={`w-full font-medium rounded-xl p-2.5 outline-none border-2 border-[#d7ccc8] focus:border-[#8d6e63] bg-white text-black placeholder-gray-400 shadow-inner`} placeholder="Enter advance amount paid"/>
                </div>
              </div>

              <div className="bg-[#fff8e1] border-2 border-[#ffecb3] rounded-xl p-4 mt-4 flex flex-col gap-2">
                 <div className="flex justify-between items-center text-sm font-bold text-[#5d4037]">
                   <span>{formData.category === 'product' ? 'Products Price:' : 'Chocolates Price:'}</span>
                   <span>₹{(liveFormPrice.fullChocolatePrice || 0).toLocaleString()}</span>
                 </div>
                 
                 <div className="flex justify-between items-center text-sm font-bold text-[#5d4037] border-b border-[#ffe082] pb-2">
                   <span>Delivery Charge:</span>
                   <span>{formData.isDeliveryFree ? <span className="text-green-600">Free</span> : `₹${(liveFormPrice.fullDeliveryCharge || 0).toLocaleString()}`}</span>
                 </div>
                 <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-[#5d4037]">
                    <input 
                       type="checkbox" 
                       checked={formData.isDeliveryFree || false} 
                       onChange={(e) => setFormData({...formData, isDeliveryFree: e.target.checked})} 
                       className="accent-[#8d6e63] w-4 h-4 cursor-pointer" 
                    />
                    Delivery Free
                 </label>

                 {(Number(formData.discount) || 0) > 0 && (
                   <div className="flex justify-between items-center text-sm font-bold text-red-600 border-b border-[#ffe082] pb-2 mt-1">
                     <span>Discount Applied:</span>
                     <span>-₹{(Number(formData.discount) || 0).toLocaleString()}</span>
                   </div>
                 )}

                 <div className="flex justify-between items-center pt-2 mt-1">
                   <span className="font-extrabold text-[#3e2723]">Total Order Price:</span>
                   <span className="text-2xl font-black text-green-700">₹{(liveFormPrice.fullTotalPrice || 0).toLocaleString()}</span>
                 </div>
                 {Number(formData.advanceAmount) > 0 && (
                   <div className="flex justify-between items-center text-sm font-bold text-blue-700 border-t border-[#ffe082] pt-2">
                     <span>Advance Paid:</span>
                     <span>₹{Number(formData.advanceAmount).toLocaleString()}</span>
                   </div>
                 )}
              </div>

              <div className="flex gap-3 pt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className={`flex-1 px-4 py-3 rounded-xl font-bold border-2 border-[#d7ccc8] bg-white text-[#5d4037] hover:bg-gray-50 transition-colors`}>Cancel</button>
                <button type="submit" className={`flex-1 px-4 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-[#8d6e63] to-[#5d4037] shadow-lg hover:shadow-xl transition-all hover:-translate-y-1`}>Save Order</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🟢 PREVIEW MODAL WITH SCREENSHOT CAPTURE ICON */}
      {isPreviewOpen && previewData && (() => {
        const previewPrice = calculatePriceInfo(previewData.chocolate, previewData.count, previewData.discount, previewData.isDeliveryFree, previewData.paymentStatus, previewData.category, customPricesMap, previewData.manualDeliveryFee, previewData.orderStatus);
        return (
        <div 
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 print:hidden backdrop-blur-sm"
          onClick={() => setIsPreviewOpen(false)}
        >
          <div 
            className={`rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] w-full max-w-sm p-6 text-center bg-[#fffcf9] max-h-[90vh] overflow-y-auto relative border border-amber-100`}
            onClick={(e) => e.stopPropagation()} 
          >
            <button 
               onClick={handleCapturePreview}
               className="absolute top-4 right-4 p-2.5 bg-amber-100 text-amber-800 hover:bg-amber-200 rounded-full transition-transform hover:scale-110 z-20 shadow-sm"
               title="Copy Receipt Screenshot to Clipboard"
            >
               <Camera size={18} />
            </button>

            <div id="preview-modal-content" className="bg-[#fffcf9] p-3 rounded-xl">
              <div className="flex justify-between items-start mb-6 border-b-2 border-dashed border-[#d7ccc8] pb-5 pt-2">
                <div className="text-left flex flex-col justify-center">
                  <div className={`w-16 h-16 rounded-full mb-3 flex items-center justify-center border-[3px] bg-amber-50 border-amber-200 text-amber-600 overflow-hidden shadow-inner`}>
                    <img src={profilePicUrl} alt="Profile" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
                    <User size={28} className="absolute -z-10" />
                  </div>
                  <h2 className={`text-2xl font-black text-[#3e2723]`}>{previewData.name}</h2>
                  <p className={`font-bold text-amber-700 text-sm mb-1`}>{previewData.phone}</p>
                  <span className="inline-block bg-amber-200 text-amber-950 px-2 py-0.5 rounded text-xs font-black tracking-widest border border-amber-300 w-max shadow-sm mb-1">
                    INV: {getSerial(previewData.id)}
                  </span>
                  <span className="text-[11px] font-bold text-amber-800/70 flex items-center gap-1 mt-0.5">
                    <Calendar size={12}/> Order Date: {previewData.orderDate}
                  </span>
                </div>
                
                <div className="shrink-0 flex flex-col items-center bg-white p-2 rounded-xl border-2 border-dashed border-amber-200 shadow-sm mt-2">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=upi://pay?pa=8220638753@upi%26pn=SUBASH%20G%26am=${previewPrice.totalPrice}%26cu=INR&color=78350f&bgcolor=fffcf9`} 
                    alt="Payment QR Code" 
                    className="w-20 h-20 rounded-lg"
                    crossOrigin="anonymous"
                  />
                  <span className="text-[10px] font-bold text-amber-600 mt-1 uppercase tracking-wider">Scan to Pay</span>
                  <span className="text-[10px] font-bold text-amber-800 tracking-wide mt-0.5">SUBASH G</span>
                  <span className="text-[10px] font-bold text-amber-600 tracking-wide mt-0.5">8220638753</span>
                </div>
              </div>

              <div className={`rounded-2xl p-5 text-left space-y-4 mb-4 bg-white border border-[#d7ccc8] shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]`}>
                <div className="flex justify-between items-center border-b border-[#f5f5f5] pb-2"><span className={`font-bold text-[#8d6e63] uppercase text-xs tracking-wider`}>{previewData.category === 'product' ? 'Product' : 'Chocolate'}</span><span className={`font-black text-right w-1/2`}>{renderChocolateBadges(previewData.chocolate)}</span></div>
                
                {/* 🟢 MODAL PREVIEW COUNT WITH BREAKDOWN TEXT */}
                <div className="flex justify-between items-start border-b border-[#f5f5f5] pb-2">
                  <span className={`font-bold text-[#8d6e63] uppercase text-xs tracking-wider mt-1`}>Quantity</span>
                  <div className="flex flex-col items-end">
                    <span className={`font-black text-[#3e2723] text-xl`}>{previewData.count} Items</span>
                    {previewPrice.unitPrice > 0 && Number(previewData.count) > 0 && (
                      <span className="text-[11px] text-[#8d6e63] font-black tracking-widest mt-0.5 bg-[#f5f5f5] px-2 py-0.5 rounded-full border border-[#d7ccc8]">
                        ₹{previewPrice.unitPrice} x {previewData.count}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className={`flex flex-col gap-2`}>
                  <div className="flex justify-between items-center text-sm font-bold"><span className={`text-[#8d6e63]`}>Item Subtotal</span><span className={`text-[#3e2723]`}>₹{(previewPrice.chocolatePrice || 0).toLocaleString()}</span></div>
                  
                  <div className="flex justify-between items-center text-sm font-bold"><span className={`text-[#8d6e63]`}>Delivery Fee</span><span className={`text-[#3e2723]`}>{previewData.isDeliveryFree ? <span className="text-green-600 font-black">Free</span> : `₹${previewPrice.fullDeliveryCharge || 0}`}</span></div>

                  {previewData.discount > 0 && <div className="flex justify-between items-center text-sm font-black text-red-600"><span>Applied Discount</span><span>-₹{previewData.discount}</span></div>}
                  <div className="flex justify-between items-center pt-3 border-t-2 border-dashed border-[#d7ccc8]"><span className={`font-black text-[#5d4037] uppercase tracking-tighter`}>Grand Total</span><span className={`font-black text-3xl text-green-700`}>₹{(previewPrice.fullTotalPrice || 0).toLocaleString()}</span></div>
                  {previewData.paymentStatus === 'Pending' && (
                    <div className="flex justify-between items-center text-sm font-bold text-red-600 border-t border-[#d7ccc8] pt-2 mt-1"><span>Pending Balance</span><span>₹{(previewPrice.fullTotalPrice || 0).toLocaleString()}</span></div>
                  )}
                  {previewData.paymentStatus === 'Partially Paid' && (
                    <>
                      <div className="flex justify-between items-center text-sm font-bold text-green-700 border-t border-[#d7ccc8] pt-2 mt-1"><span>Paid (Advance)</span><span>₹{Number(previewData.advanceAmount || 0).toLocaleString()}</span></div>
                      <div className="flex justify-between items-center text-sm font-bold text-red-600"><span>Pending Balance</span><span>₹{((previewPrice.fullTotalPrice || 0) - Number(previewData.advanceAmount || 0)).toLocaleString()}</span></div>
                    </>
                  )}
                </div>

                <div className="flex justify-between items-center pt-3 text-[13px] font-bold"><span className={`text-[#8d6e63]`}>Function Date</span><span className={`text-[#3e2723] flex items-center gap-1`}><Calendar size={14}/> {previewData.functionDate}</span></div>
                <div className="flex justify-between items-center text-[13px] font-bold"><span className={`text-[#8d6e63]`}>Delivery Date</span><span className={`text-[#3e2723] flex items-center gap-1`}><Calendar size={14}/> {previewData.deliveryDate}</span></div>
                
                {previewData.address && (
                  <div className="flex flex-col pt-3 mt-1 border-t border-[#f5f5f5]">
                    <span className={`font-bold text-[#8d6e63] text-[10px] uppercase tracking-widest mb-1`}>Delivery Address</span>
                    <span className={`font-bold text-xs text-[#3e2723] bg-[#f5f5f5] p-2.5 rounded-lg border border-[#d7ccc8]`}>{previewData.address}</span>
                  </div>
                )}

                <div className={`flex justify-between items-center pt-2 border-t border-amber-100`}>
                  <span className={`font-bold text-amber-800`}>Payment</span>
                  <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                    previewData.paymentStatus === 'Full Paid' ? 'bg-[#e6f7ec] text-[#047857] border-[#9fe2bf]' : 
                    previewData.paymentStatus === 'Partially Paid' ? 'bg-[#fff7ed] text-[#d35400] border-[#fdba74]' :
                    'bg-[#fee2e2] text-[#b91c1c] border-[#fca5a5]'
                  }`}>{previewData.paymentStatus || 'Pending'}</span>
                </div>

                <div className={`flex justify-between items-center pt-2 border-t border-amber-100`}>
                  <span className={`font-bold text-amber-800`}>Delivery Status</span>
                  <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${previewData.status === 'Delivered' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-amber-100 text-amber-700 border-amber-300'}`}>{previewData.status}</span>
                </div>
              </div>

              <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-center">
                  <span className="text-[10px] font-black text-red-600 uppercase leading-none block">Note: Order will be confirmed once the amount paid.</span>
              </div>
              <p className="text-xs font-black text-amber-600 uppercase tracking-tighter mb-2 italic opacity-80">Thank you for your order! ❤️</p>
            </div>

            <button onClick={() => setIsPreviewOpen(false)} className={`w-full py-3.5 mt-2 rounded-xl font-black text-white bg-gradient-to-r from-[#8d6e63] to-[#5d4037] shadow-lg transition-transform hover:-translate-y-1 active:scale-95 uppercase tracking-widest`}>
              Close Preview
            </button>
          </div>
        </div>
        );
      })()}

      {/* 🟢 NEW: SHIPPING LABEL MODAL */}
      {isShippingOpen && shippingOrder && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 print:hidden" onClick={() => setIsShippingOpen(false)}>
          <div className="rounded-3xl shadow-2xl w-full max-w-2xl bg-gray-100 flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            
            <div className="p-4 flex justify-between bg-white border-b border-gray-200 rounded-t-3xl items-center">
              <h2 className="text-xl font-extrabold text-black">Shipping Label Preview</h2>
              <button onClick={() => setIsShippingOpen(false)} className="text-gray-500 hover:text-red-600 transition-colors bg-gray-100 p-2 rounded-full"><X size={20} /></button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 flex justify-center bg-gray-100">
              
              <div id="shipping-label-content" className="bg-white p-8 w-full max-w-xl text-black font-sans shadow-lg border border-gray-200 h-max shrink-0">
                <div className="flex justify-between items-start mb-1 pb-4 border-b-2 border-black">
                  <div className="flex-1 pt-2">
                    <h3 className="text-base font-extrabold text-black tracking-wide mb-3">Shipping Label</h3>
                    <p className="font-extrabold text-[15px] mb-1 text-black">Shipping To:</p>
                    <p className="text-[15px] text-black tracking-wide">{shippingOrder.name}</p>
                    <p className="text-[15px] font-extrabold mt-1 text-black">Phone: {shippingOrder.phone}</p>
                  </div>
                  <div className="flex-shrink-0 ml-4">
                    <img src={"/sabi-logo.png"} alt="Logo" className="w-44 h-44 object-contain" crossOrigin="anonymous" onError={(e) => (e.currentTarget.style.display = "none")} />
                  </div>
                </div>

                <div className="my-4 p-3 bg-amber-50/50 border-l-4 border-amber-600 rounded-r-lg">
                  <p className="text-[11px] font-bold text-amber-900 uppercase tracking-wider mb-1">Instructions:</p>
                  <p className="text-[12px] leading-snug font-medium text-gray-800">
                    Thank you for choosing <span className="font-bold text-black">SABI Return Gifts</span>. To ensure timely delivery, please settle the outstanding amount via GPay to <span className="font-bold text-[#3e2723]">8220638753 (Subash G.)</span>. Please share the payment screenshot with your Invoice Number for verification.
                  </p>
                </div>

                <div className="flex justify-between items-center py-3 border-t-2 border-b-2 border-black">
                  <div>
                    <p className="text-[14px] font-extrabold mb-1 text-black">Invoice #: {getSerial(shippingOrder.id)}</p>
                    <p className="text-[14px] font-extrabold text-black">Invoice Date: {shippingOrder.deliveryDate}</p>
                  </div>
                  <div className="flex flex-col items-center">
                    <img src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${getSerial(shippingOrder.id)}&scale=2&height=10`} alt="Barcode" className="h-12 w-auto mix-blend-multiply" crossOrigin="anonymous"/>
                    <p className="text-[8px] font-extrabold mt-0.5 tracking-wider">{getSerial(shippingOrder.id)}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-[14px] font-extrabold mb-1 text-black">Sender Details:</p>
                  <p className="text-[14px] font-extrabold text-black">Sabi Return Gifts</p>
                  <p className="text-[14px] font-extrabold text-black leading-snug">No.2/35 ayyavupuram, 57th st street, West k.k.nagar, near pondicherry guest house</p>
                  <p className="text-[14px] font-extrabold text-black">Chennai City South, TAMIL NADU</p>
                  <p className="text-[14px] font-extrabold mb-2 text-black">600078</p>
                  <p className="text-[14px] font-extrabold text-black">Phone: 8220638753</p>
                </div>
              </div>

            </div>

            <div className="p-5 bg-white border-t border-gray-200 rounded-b-3xl flex justify-end gap-4 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] z-10">
              <button onClick={() => setIsShippingOpen(false)} className="px-6 py-2.5 rounded-xl font-bold border-2 border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">Close</button>
              <button onClick={handleDownloadShipping} className="px-8 py-2.5 rounded-xl font-extrabold text-white bg-purple-600 hover:bg-purple-700 shadow-md hover:shadow-lg transition-all flex items-center gap-2 tracking-wide">
                <Download size={20}/> Download Label
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 🟢 NEW: REPORT PREVIEW & DOWNLOAD MODAL */}
      {isReportPreviewOpen && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b-2 border-gray-300 flex justify-between items-center bg-gray-100 shadow-sm">
              <h2 className="text-2xl font-extrabold text-gray-900 uppercase tracking-widest">Sales Report Preview</h2>
              <button onClick={() => setIsReportPreviewOpen(false)} className="text-gray-600 hover:bg-gray-200 hover:text-red-600 p-1.5 rounded-full transition-colors"><X size={24} /></button>
            </div>

            <div id="final-report-document" className="p-8 overflow-auto bg-white flex-1 relative">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-black text-amber-900 uppercase tracking-wider">Sabi Return Gifts</h1>
                <h2 className="text-xl font-bold text-gray-600 mt-2">Official Sales & Analytics Report</h2>
                {reportDateRange.start && reportDateRange.end ? (
                  <p className="text-sm font-medium text-gray-500 mt-1">Period: {formatToDisplayDate(reportDateRange.start)} to {formatToDisplayDate(reportDateRange.end)}</p>
                ) : (
                  <p className="text-sm font-medium text-gray-500 mt-1">Period: All Time Overview</p>
                )}
                
                {/* Dashboard Type Subtitle inside Report */}
                {reportDashboardFilter !== 'All' && (
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mt-1">
                     Filter: {reportDashboardFilter === 'Dashboard 1' ? 'Chocolates Only' : 'Products Only'}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="border border-gray-200 p-4 rounded-xl bg-gray-50 text-center shadow-sm">
                  <p className="text-xs font-bold text-gray-500 uppercase">Total Orders</p>
                  <p className="text-2xl font-black text-gray-800">{reportData.filteredOrders.length}</p>
                </div>
                <div className="border border-gray-200 p-4 rounded-xl bg-gray-50 text-center shadow-sm">
                  <p className="text-xs font-bold text-gray-500 uppercase">Items Sold</p>
                  <p className="text-2xl font-black text-gray-800">{reportData.totalItems}</p>
                </div>
                <div className="border border-green-200 p-4 rounded-xl bg-green-50 text-center shadow-sm">
                  <p className="text-xs font-bold text-green-700 uppercase">Total Revenue Generated</p>
                  <p className="text-2xl font-black text-green-700">₹{reportData.totalRev.toLocaleString()}</p>
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-xl font-extrabold text-gray-900 border-b-2 border-gray-300 pb-3 mb-5 tracking-wide uppercase">
                  Top Selling {reportDashboardFilter === 'Dashboard 2' ? 'Products' : 'Chocolates'} Leaderboard
                </h3>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-amber-50 text-amber-900 text-sm">
                      <th className="p-3 border border-amber-100 font-bold w-16 text-center">Rank</th>
                      <th className="p-3 border border-amber-100 font-bold">Item Name</th>
                      <th className="p-3 border border-amber-100 font-bold text-center w-32">Units Sold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.topChocs.map(([name, count], idx) => (
                      <tr key={idx} className="border-b text-sm hover:bg-gray-50">
                        <td className="p-3 border border-gray-100 text-center font-bold text-gray-500">#{idx + 1}</td>
                        <td className="p-3 border border-gray-100 font-medium text-gray-800">{name}</td>
                        <td className="p-3 border border-gray-100 text-center font-bold text-amber-700">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end gap-4 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
              <button onClick={() => setIsReportPreviewOpen(false)} className="px-6 py-2.5 rounded-lg font-bold border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors">Cancel</button>
              <button
                onClick={async () => {
                  const element = document.getElementById("final-report-document");
                  if(element) {
                    const html2canvas = (await import("html2canvas")).default;
                    const canvas = await html2canvas(element, { scale: 2, useCORS: true });
                    const link = document.createElement("a");
                    link.download = `Sabi_Sales_Report_${new Date().getTime()}.png`;
                    link.href = canvas.toDataURL("image/png");
                    link.click();
                  }
                }}
                className="px-6 py-2.5 rounded-lg font-bold text-white bg-amber-600 hover:bg-amber-700 flex items-center gap-2 shadow-md hover:-translate-y-0.5 transition-transform"
              >
                <Download size={18} /> Download Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🟢 NEW: ADMIN AUTHENTICATION MODAL */}
      {isAdminAuthModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-[110] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsAdminAuthModalOpen(false)}>
          <div 
            className="bg-[#fffcf9] rounded-[2rem] shadow-2xl w-full max-w-sm border-2 border-[#d7ccc8] overflow-hidden transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-br from-[#5d4037] to-[#3e2723] p-6 text-center relative border-b-4 border-[#8b5a2b]">
              <button type="button" onClick={() => setIsAdminAuthModalOpen(false)} className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"><X size={20}/></button>
              <div className="w-16 h-16 bg-[#fffcf9] rounded-full mx-auto flex items-center justify-center shadow-inner mb-3">
                <User size={28} className="text-[#8b5a2b]" strokeWidth={2.5} />
              </div>
              <h2 className="text-2xl font-black text-white tracking-wide">Login</h2>
              <p className="text-amber-200/80 text-xs font-bold mt-1 tracking-widest uppercase">Restricted Analytics Area</p>
            </div>
            
            <form onSubmit={handleAdminLogin} className="p-7 space-y-5">
              {authError && (
                <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 text-sm font-bold rounded shadow-sm text-center animate-in zoom-in duration-200">
                  {authError}
                </div>
              )}

              <div>
                <label className="block text-xs font-black text-[#5d4037] uppercase tracking-wider mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 text-[#a46c3b]" size={18} />
                  <input 
                    type="password" 
                    required
                    value={adminCreds.password}
                    onChange={(e) => setAdminCreds({...adminCreds, password: e.target.value})}
                    className="w-full pl-10 pr-4 py-3 bg-white border-2 border-[#eaddcf] rounded-xl outline-none focus:border-[#8b5a2b] font-bold text-[#3e2723] transition-colors"
                    placeholder="Enter Password"
                  />
                </div>
              </div>

              <button type="submit" className="w-full py-4 bg-gradient-to-r from-[#8b5a2b] to-[#5d4037] hover:from-[#5d4037] hover:to-[#3e2723] text-white rounded-xl font-black uppercase tracking-widest shadow-lg hover:shadow-xl transition-all active:scale-95 mt-4 flex items-center justify-center gap-2">
                <Lock size={18} /> Login securely
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 🟢 NEW: EMPLOYEE APPROVAL MODAL */}
      {showApprovalPanel && (
         <div className="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center p-4">
            <div className="bg-[#fffdf7] rounded-[2rem] shadow-2xl w-full max-w-2xl border-4 border-[#e8dccb] overflow-hidden flex flex-col max-h-[80vh]">
               <div className="p-6 border-b-2 border-[#d7ccc8] flex justify-between items-center bg-[#f2eee6]">
                  <h2 className="text-xl font-black text-[#3e2723] flex items-center gap-2"><Lock className="text-amber-700"/> Approvals</h2>
                  <button onClick={() => setShowApprovalPanel(false)} className="text-[#7c4d36] hover:text-[#4a2c1d]"><X size={24} /></button>
               </div>
               <div className="p-6 overflow-y-auto flex-1">
                  {employees.filter(e => e.status === 'Pending').length === 0 ? (
                     <p className="text-center text-amber-700 font-bold py-8">No pending requests.</p>
                  ) : (
                     <div className="space-y-4">
                        {employees.filter(e => e.status === 'Pending').map(emp => (
                           <div key={emp.fireId} className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm flex justify-between items-center">
                              <div>
                                 <p className="font-bold text-amber-950 text-lg">{emp.name}</p>
                                 <p className="text-sm font-medium text-amber-700">Username: <span className="font-bold">{emp.username}</span></p>
                              </div>
                              <div className="flex gap-2">
                                 <button onClick={() => updateDoc(doc(db, "employees", emp.fireId), { status: 'Approved' })} className="px-4 py-1.5 bg-green-100 text-green-700 font-bold rounded-lg hover:bg-green-200 transition-colors border border-green-300">Accept</button>
                                 <button onClick={() => updateDoc(doc(db, "employees", emp.fireId), { status: 'Declined' })} className="px-4 py-1.5 bg-red-100 text-red-700 font-bold rounded-lg hover:bg-red-200 transition-colors border border-red-300">Decline</button>
                              </div>
                           </div>
                        ))}
                     </div>
                  )}
               </div>
            </div>
       </div>
      )}

      {/* 👇 PUDHU INVOICE MODAL (DESIGN RE-FIXED) 👇 */}
      {isInvoiceOpen && selectedOrderForInvoice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
          <div className="relative w-full max-w-4xl my-auto">
            <OrderInvoiceView 
              order={{
                ...selectedOrderForInvoice,
                // Dashboard-la irukka price logic-ai receipt-ku map pandrom
                totalPrice: calculatePriceInfo(
                  selectedOrderForInvoice.chocolate, 
                  selectedOrderForInvoice.count, 
                  selectedOrderForInvoice.discount, 
                  selectedOrderForInvoice.isDeliveryFree, 
                  selectedOrderForInvoice.paymentStatus, 
                  selectedOrderForInvoice.category, 
                  customPricesMap, 
                  selectedOrderForInvoice.manualDeliveryFee, 
                  selectedOrderForInvoice.orderStatus
                ).totalPrice,
                date: selectedOrderForInvoice.functionDate || new Date().toLocaleDateString()
              }} 
              onClose={() => setIsInvoiceOpen(false)} 
            />
          </div>
        </div>
      )}
      {/* 👆 PUDHU INVOICE MODAL 👆 */}

     {/* 👇 PUDHU INVOICE MODAL (EXACT DESIGN) 👇 */}
      {isInvoiceOpen && selectedOrderForInvoice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-xl animate-in fade-in duration-300 overflow-y-auto">
          <div className="relative w-full max-w-4xl my-auto">
            <OrderInvoiceView 
              order={{
                ...selectedOrderForInvoice,
                // Dashboard dynamic price calculation
                totalPrice: calculatePriceInfo(
                  selectedOrderForInvoice.chocolate, 
                  selectedOrderForInvoice.count, 
                  selectedOrderForInvoice.discount, 
                  selectedOrderForInvoice.isDeliveryFree, 
                  selectedOrderForInvoice.paymentStatus, 
                  selectedOrderForInvoice.category, 
                  customPricesMap, 
                  selectedOrderForInvoice.manualDeliveryFee, 
                  selectedOrderForInvoice.orderStatus
                ).totalPrice
              }} 
              onClose={() => setIsInvoiceOpen(false)} 
            />
          </div>
        </div>
      )}
      {/* 👆 PUDHU INVOICE MODAL 👆 */}

     {/* STRICT INVOICE MODAL WITH CLICK OUTSIDE TO CLOSE */}
      {isInvoiceOpen && selectedOrderForInvoice && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-xl animate-in fade-in duration-300 overflow-y-auto"
          onClick={() => setIsInvoiceOpen(false)} 
        >
          <div 
            className="relative w-full max-w-4xl my-auto"
            onClick={(e) => e.stopPropagation()} 
          >
            <OrderInvoiceView 
              order={{
                ...selectedOrderForInvoice,
                totalPrice: calculatePriceInfo(
                  selectedOrderForInvoice.chocolate, 
                  selectedOrderForInvoice.count, 
                  selectedOrderForInvoice.discount, 
                  selectedOrderForInvoice.isDeliveryFree, 
                  selectedOrderForInvoice.paymentStatus, 
                  selectedOrderForInvoice.category, 
                  customPricesMap, 
                  selectedOrderForInvoice.manualDeliveryFee, 
                  selectedOrderForInvoice.orderStatus
                ).totalPrice
              }} 
              onClose={() => setIsInvoiceOpen(false)} 
            />
          </div>
        </div>
      )}

    </div>
  );
}// Dashboard function closing