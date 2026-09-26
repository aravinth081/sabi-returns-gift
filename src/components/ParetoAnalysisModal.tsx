import React, { useState, useMemo } from 'react';
import {
  X,
  TrendingUp,
  Calendar,
  Filter,
  BarChart3,
  Award,
  Layers,
  ChevronDown,
  Download,
  Printer,
  Sparkles,
  PieChart as PieChartIcon,
  HelpCircle,
  FileSpreadsheet,
  Info
} from 'lucide-react';
import {
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ReferenceLine,
  Cell
} from 'recharts';

export interface ParetoAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: any[];
  initialDateType?: string;
  customPricesMap?: Record<string, number>;
  managedChocPricesMap?: Record<string, { retail: number; wholesale: number }>;
}

// Helper to normalize date strings to YYYY-MM-DD
const parseToYYYYMMDD = (dateStr: any): string => {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  const currentYear = new Date().getFullYear();
  const d = new Date(`${str} ${currentYear}`);
  if (!isNaN(d.getTime())) {
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  }
  return '';
};

// Formatter for Currency
const formatINR = (val: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(val || 0);
};

export const ParetoAnalysisModal: React.FC<ParetoAnalysisModalProps> = ({
  isOpen,
  onClose,
  orders,
  initialDateType = 'Dispatch Date',
  customPricesMap = {},
  managedChocPricesMap = {}
}) => {
  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState<'pareto' | 'weekly' | 'overview'>('pareto');

  // Filter 1: Date basis dropdown (Order Date, Dispatch Date, Function Date)
  const [dateType, setDateType] = useState<string>(
    ['Order Date', 'Dispatch Date', 'Function Date'].includes(initialDateType)
      ? initialDateType
      : 'Dispatch Date'
  );

  // Filter 2: Year dropdown (Extracted from orders or default to current year)
  const currentSystemYear = new Date().getFullYear();
  const availableYears = useMemo(() => {
    const set = new Set<string>();
    set.add(String(currentSystemYear));
    set.add(String(currentSystemYear - 1));
    orders.forEach(o => {
      const dt = parseToYYYYMMDD(o.deliveryDate || o.orderDate || o.functionDate);
      if (dt) {
        const y = dt.split('-')[0];
        if (y && y.length === 4) set.add(y);
      }
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [orders, currentSystemYear]);

  const [selectedYear, setSelectedYear] = useState<string>(String(currentSystemYear));

  // Filter 3: Month dropdown (Both separately as requested)
  const currentMonthNum = String(new Date().getMonth() + 1).padStart(2, '0');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthNum);

  // Filter 4: Week-wise dropdown (week 1, week 2, week 3, week 4, all weeks)
  const [selectedWeek, setSelectedWeek] = useState<string>('all');

  // Filter 5: Date from and to selection
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [isCustomRange, setIsCustomRange] = useState<boolean>(false);

  // Month names dictionary
  const monthsList = [
    { value: '01', name: 'January' },
    { value: '02', name: 'February' },
    { value: '03', name: 'March' },
    { value: '04', name: 'April' },
    { value: '05', name: 'May' },
    { value: '06', name: 'June' },
    { value: '07', name: 'July' },
    { value: '08', name: 'August' },
    { value: '09', name: 'September' },
    { value: '10', name: 'October' },
    { value: '11', name: 'November' },
    { value: '12', name: 'December' }
  ];

  // Helper to compute date range when Year/Month/Week changes
  const updateRangeFromDropdowns = (y: string, m: string, w: string) => {
    if (!y || !m || m === 'all') {
      if (y && m === 'all') {
        setDateRange({
          from: `${y}-01-01`,
          to: `${y}-12-31`
        });
      }
      return;
    }
    const yearInt = parseInt(y, 10);
    const monthInt = parseInt(m, 10);
    const lastDay = new Date(yearInt, monthInt, 0).getDate();

    if (w === 'week1') {
      setDateRange({
        from: `${y}-${m}-01`,
        to: `${y}-${m}-07`
      });
    } else if (w === 'week2') {
      setDateRange({
        from: `${y}-${m}-08`,
        to: `${y}-${m}-14`
      });
    } else if (w === 'week3') {
      setDateRange({
        from: `${y}-${m}-15`,
        to: `${y}-${m}-21`
      });
    } else if (w === 'week4') {
      setDateRange({
        from: `${y}-${m}-22`,
        to: `${y}-${m}-${String(lastDay).padStart(2, '0')}`
      });
    } else {
      // All weeks of the month
      setDateRange({
        from: `${y}-${m}-01`,
        to: `${y}-${m}-${String(lastDay).padStart(2, '0')}`
      });
    }
  };

  // Sync date range whenever Year, Month, or Week dropdown changes
  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    setIsCustomRange(false);
    updateRangeFromDropdowns(year, selectedMonth, selectedWeek);
  };

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    setIsCustomRange(false);
    updateRangeFromDropdowns(selectedYear, month, selectedWeek);
  };

  const handleWeekChange = (week: string) => {
    setSelectedWeek(week);
    setIsCustomRange(false);
    updateRangeFromDropdowns(selectedYear, selectedMonth, week);
  };

  const handleFromDateChange = (val: string) => {
    setIsCustomRange(true);
    setDateRange(prev => ({ ...prev, from: val }));
  };

  const handleToDateChange = (val: string) => {
    setIsCustomRange(true);
    setDateRange(prev => ({ ...prev, to: val }));
  };

  // Initialize date range on mount or when opening
  React.useEffect(() => {
    if (isOpen && !dateRange.from && !dateRange.to) {
      updateRangeFromDropdowns(selectedYear, selectedMonth, selectedWeek);
    }
  }, [isOpen, selectedYear, selectedMonth, selectedWeek]);

  // Extract target date from order based on active dateType
  const getOrderTargetDate = (order: any): string => {
    if (dateType === 'Order Date') return parseToYYYYMMDD(order.orderDate);
    if (dateType === 'Function Date') return parseToYYYYMMDD(order.functionDate);
    // Dispatch Date
    return parseToYYYYMMDD(order.deliveryDate || order.functionDate || order.orderDate);
  };

  // 1. FILTERED ORDERS for the active range
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (order.status === 'Cancelled' || order.orderStatus === 'cancelled') return false;
      const targetDate = getOrderTargetDate(order);
      if (!targetDate) return false;

      if (dateRange.from && targetDate < dateRange.from) return false;
      if (dateRange.to && targetDate > dateRange.to) return false;

      return true;
    });
  }, [orders, dateType, dateRange]);

  // 2. PRODUCT-WISE PARETO ANALYSIS DATA
  const paretoData = useMemo(() => {
    const map: Record<string, { name: string; quantity: number; orderCount: number; totalRevenue: number }> = {};
    let totalQuantityAll = 0;

    filteredOrders.forEach(order => {
      const chocolateStr = String(order.chocolate || order.productName || '').trim();
      if (!chocolateStr) return;

      const chocs = chocolateStr.split(',').map(c => c.trim()).filter(Boolean);
      const countParts = String(order.count || 0).split(',').map(c => Number(c.trim()) || 0);

      chocs.forEach((cName, idx) => {
        const qty = countParts[idx] !== undefined ? countParts[idx] : (countParts[0] || 0);
        if (qty <= 0) return;

        const normalizedName = cName.charAt(0).toUpperCase() + cName.slice(1);
        if (!map[normalizedName]) {
          map[normalizedName] = {
            name: normalizedName,
            quantity: 0,
            orderCount: 0,
            totalRevenue: 0
          };
        }
        map[normalizedName].quantity += qty;
        map[normalizedName].orderCount += 1;
        totalQuantityAll += qty;
      });
    });

    // Sort descending by quantity sold
    const sorted = Object.values(map).sort((a, b) => b.quantity - a.quantity);

    // Compute individual % and cumulative %
    let runningCumulativeQty = 0;
    const classified = sorted.map((item, index) => {
      runningCumulativeQty += item.quantity;
      const percentage = totalQuantityAll > 0 ? (item.quantity / totalQuantityAll) * 100 : 0;
      const cumulativePercentage = totalQuantityAll > 0 ? (runningCumulativeQty / totalQuantityAll) * 100 : 0;

      // Pareto ABC Grouping:
      // Group A: Cumulative % up to 80% (Core Top 80% Sellers)
      // Group B: Cumulative % between 80% and 95% (Moderate Sellers)
      // Group C: Cumulative % > 95% (Remaining 5% Tail)
      let group: 'A' | 'B' | 'C' = 'A';
      const prevCum = cumulativePercentage - percentage;
      if (prevCum >= 80) {
        if (prevCum >= 95) {
          group = 'C';
        } else {
          group = 'B';
        }
      } else {
        group = 'A';
      }

      return {
        ...item,
        rank: index + 1,
        percentage: Number(percentage.toFixed(2)),
        cumulativePercentage: Number(cumulativePercentage.toFixed(2)),
        cumulativeQuantity: runningCumulativeQty,
        group
      };
    });

    const groupA = classified.filter(i => i.group === 'A');
    const groupB = classified.filter(i => i.group === 'B');
    const groupC = classified.filter(i => i.group === 'C');

    const groupAQty = groupA.reduce((s, i) => s + i.quantity, 0);
    const groupBQty = groupB.reduce((s, i) => s + i.quantity, 0);
    const groupCQty = groupC.reduce((s, i) => s + i.quantity, 0);

    return {
      items: classified,
      totalQuantity: totalQuantityAll,
      totalVarieties: classified.length,
      topItem: classified[0] || null,
      groupA: {
        items: groupA,
        count: groupA.length,
        quantity: groupAQty,
        percent: totalQuantityAll > 0 ? Number(((groupAQty / totalQuantityAll) * 100).toFixed(1)) : 0
      },
      groupB: {
        items: groupB,
        count: groupB.length,
        quantity: groupBQty,
        percent: totalQuantityAll > 0 ? Number(((groupBQty / totalQuantityAll) * 100).toFixed(1)) : 0
      },
      groupC: {
        items: groupC,
        count: groupC.length,
        quantity: groupCQty,
        percent: totalQuantityAll > 0 ? Number(((groupCQty / totalQuantityAll) * 100).toFixed(1)) : 0
      }
    };
  }, [filteredOrders]);

  // 3. WEEK-WISE ANALYSIS DATA (Daily breakdown + 4-week comparison)
  const weekWiseData = useMemo(() => {
    const yearInt = parseInt(selectedYear, 10);
    const monthInt = parseInt(selectedMonth, 10);
    const daysInMonth = new Date(yearInt, monthInt, 0).getDate();

    // Determine day range for the current view
    let startDay = 1;
    let endDay = 7;
    let weekLabel = 'Week 1 (Days 1 - 7)';

    if (selectedWeek === 'week1') {
      startDay = 1;
      endDay = 7;
      weekLabel = 'Week 1 (Days 1 - 7)';
    } else if (selectedWeek === 'week2') {
      startDay = 8;
      endDay = 14;
      weekLabel = 'Week 2 (Days 8 - 14)';
    } else if (selectedWeek === 'week3') {
      startDay = 15;
      endDay = 21;
      weekLabel = 'Week 3 (Days 15 - 21)';
    } else if (selectedWeek === 'week4') {
      startDay = 22;
      endDay = daysInMonth;
      weekLabel = `Week 4 (Days 22 - ${daysInMonth})`;
    } else {
      // All weeks: evaluate all days of month
      startDay = 1;
      endDay = daysInMonth;
      weekLabel = `Full Month (Days 1 - ${daysInMonth})`;
    }

    // A. Daily Breakdown Calculation
    const daysReport = [];
    let weekTotalCustomers = 0;
    let weekTotalChocolates = 0;
    let weekTotalSales = 0;

    for (let d = startDay; d <= endDay; d++) {
      const dayNumStr = String(d).padStart(2, '0');
      const dateStr = `${selectedYear}-${selectedMonth}-${dayNumStr}`;
      const dateObj = new Date(yearInt, monthInt - 1, d);
      const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
      const fullDateDisplay = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

      // Find all orders for this day
      const dayOrders = filteredOrders.filter(order => {
        return getOrderTargetDate(order) === dateStr;
      });

      // Calculate customer count: distinct customers (phone/name/id)
      const customerSet = new Set<string>();
      let dayChocolates = 0;
      let dayRevenue = 0;

      dayOrders.forEach(o => {
        const custKey = o.phone ? String(o.phone).trim() : (o.name ? String(o.name).trim().toLowerCase() : o.id);
        customerSet.add(custKey);

        // Sum chocolate count
        const countParts = String(o.count || 0).split(',').map(c => Number(c.trim()) || 0);
        const orderChocTotal = countParts.reduce((acc, val) => acc + val, 0);
        dayChocolates += orderChocTotal;

        // Sales estimate from advance + pending or totalPrice
        const total = Number(o.totalPrice || o.chocolatePrice || 0);
        dayRevenue += total;
      });

      const custCount = customerSet.size;
      weekTotalCustomers += custCount;
      weekTotalChocolates += dayChocolates;
      weekTotalSales += dayRevenue;

      daysReport.push({
        dayNumber: d,
        dayLabel: `Day ${d - startDay + 1}`,
        dateStr,
        dayOfWeek,
        fullDateDisplay,
        customersCount: custCount,
        chocolatesSold: dayChocolates,
        salesAmount: dayRevenue,
        avgChocPerCustomer: custCount > 0 ? Math.round(dayChocolates / custCount) : 0
      });
    }

    // Attach percentage share of the week's total chocolates
    const daysWithPercent = daysReport.map(item => ({
      ...item,
      percentageOfWeek: weekTotalChocolates > 0
        ? Number(((item.chocolatesSold / weekTotalChocolates) * 100).toFixed(1))
        : 0
    }));

    const numDays = endDay - startDay + 1;
    const dailyAvgCustomers = numDays > 0 ? (weekTotalCustomers / numDays).toFixed(1) : '0';
    const dailyAvgChocolates = numDays > 0 ? Math.round(weekTotalChocolates / numDays) : 0;
    const avgChocolatesPerCustomer = weekTotalCustomers > 0 ? Math.round(weekTotalChocolates / weekTotalCustomers) : 0;

    // Peak day
    const peakDay = [...daysWithPercent].sort((a, b) => b.chocolatesSold - a.chocolatesSold)[0] || null;

    // B. Monthly 4-Week Comparison Breakdown
    const getWeekSummary = (wNum: number, s: number, e: number, wName: string) => {
      let wCustSet = new Set<string>();
      let wChocs = 0;
      let wSales = 0;

      for (let day = s; day <= e; day++) {
        const dayStr = `${selectedYear}-${selectedMonth}-${String(day).padStart(2, '0')}`;
        const dayOrders = orders.filter(o => {
          if (o.status === 'Cancelled' || o.orderStatus === 'cancelled') return false;
          return getOrderTargetDate(o) === dayStr;
        });

        dayOrders.forEach(o => {
          const custKey = o.phone ? String(o.phone).trim() : (o.name ? String(o.name).trim().toLowerCase() : o.id);
          wCustSet.add(custKey);
          const countParts = String(o.count || 0).split(',').map(c => Number(c.trim()) || 0);
          wChocs += countParts.reduce((acc, val) => acc + val, 0);
          wSales += Number(o.totalPrice || o.chocolatePrice || 0);
        });
      }

      const totalCust = wCustSet.size;
      const daysCount = e - s + 1;
      return {
        weekNum: wNum,
        weekName: wName,
        daysCount,
        customers: totalCust,
        chocolates: wChocs,
        sales: wSales,
        dailyAvgCust: daysCount > 0 ? (totalCust / daysCount).toFixed(1) : '0',
        dailyAvgChoc: daysCount > 0 ? Math.round(wChocs / daysCount) : 0
      };
    };

    const w1 = getWeekSummary(1, 1, 7, 'Week 1 (Days 1 - 7)');
    const w2 = getWeekSummary(2, 8, 14, 'Week 2 (Days 8 - 14)');
    const w3 = getWeekSummary(3, 15, 21, 'Week 3 (Days 15 - 21)');
    const w4 = getWeekSummary(4, 22, daysInMonth, `Week 4 (Days 22 - ${daysInMonth})`);

    const monthTotalChocolates = w1.chocolates + w2.chocolates + w3.chocolates + w4.chocolates;
    const monthTotalCustomers = w1.customers + w2.customers + w3.customers + w4.customers;
    const monthTotalSales = w1.sales + w2.sales + w3.sales + w4.sales;

    const weeklyComparison = [w1, w2, w3, w4].map(w => ({
      ...w,
      percentOfMonthChocolates: monthTotalChocolates > 0
        ? Number(((w.chocolates / monthTotalChocolates) * 100).toFixed(1))
        : 0,
      percentOfMonthCustomers: monthTotalCustomers > 0
        ? Number(((w.customers / monthTotalCustomers) * 100).toFixed(1))
        : 0
    }));

    return {
      weekLabel,
      days: daysWithPercent,
      weekTotalCustomers,
      weekTotalChocolates,
      weekTotalSales,
      dailyAvgCustomers,
      dailyAvgChocolates,
      avgChocolatesPerCustomer,
      peakDay,
      weeklyComparison,
      monthTotalChocolates,
      monthTotalCustomers,
      monthTotalSales
    };
  }, [filteredOrders, orders, selectedYear, selectedMonth, selectedWeek, dateType]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/85 z-[120] flex items-center justify-center p-2 sm:p-4 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: '#090e1a', color: '#ffffff' }}
        className="bg-[#090e1a] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] w-full max-w-6xl max-h-[92vh] flex flex-col border border-amber-500/30 overflow-hidden transform transition-all animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* ==================== MODAL HEADER ==================== */}
        <div className="bg-gradient-to-r from-[#0d1527] via-[#111c33] to-[#0d1527] px-5 py-4 border-b border-amber-500/25 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-black">
              <TrendingUp size={24} strokeWidth={2.5} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide uppercase">
                  Pareto Analysis
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/40">
                  80 / 20 Intelligence
                </span>
              </div>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">
                Product-wise Pareto Analysis & Week-wise Customer Sales Reporting
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-xl bg-[#162035] hover:bg-[#1f2d4a] text-slate-300 hover:text-white border border-white/10 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Print Analysis"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-[#162035] hover:bg-rose-500/30 text-slate-300 hover:text-rose-300 border border-white/10 flex items-center justify-center transition-all cursor-pointer shadow-sm"
              title="Close modal"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* ==================== CONTROL BAR: ALL REQUIRED DROPDOWNS ==================== */}
        <div className="bg-[#0e162a] px-5 py-3 border-b border-white/10 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 items-end">
            {/* 1. Date Basis Dropdown */}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Filter size={11} className="text-amber-400" /> Date Basis
              </label>
              <div className="relative">
                <select
                  value={dateType}
                  onChange={e => setDateType(e.target.value)}
                  className="w-full bg-[#162035] text-amber-300 font-bold text-xs rounded-xl px-3 py-2 border border-amber-400/40 focus:border-amber-400 outline-none cursor-pointer appearance-none shadow-sm"
                >
                  <option value="Dispatch Date">Dispatch Date</option>
                  <option value="Order Date">Order Date</option>
                  <option value="Function Date">Function Date</option>
                </select>
                <ChevronDown size={14} className="text-amber-400 absolute right-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* 2. Month Dropdown (Separately) */}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Calendar size={11} className="text-cyan-400" /> Month Selection
              </label>
              <div className="relative">
                <select
                  value={selectedMonth}
                  onChange={e => handleMonthChange(e.target.value)}
                  className="w-full bg-[#162035] text-cyan-300 font-bold text-xs rounded-xl px-3 py-2 border border-cyan-400/40 focus:border-cyan-400 outline-none cursor-pointer appearance-none shadow-sm"
                >
                  {monthsList.map(m => (
                    <option key={m.value} value={m.value}>
                      {m.value} - {m.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="text-cyan-400 absolute right-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* 3. Year Dropdown (Separately) */}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Calendar size={11} className="text-purple-400" /> Year Selection
              </label>
              <div className="relative">
                <select
                  value={selectedYear}
                  onChange={e => handleYearChange(e.target.value)}
                  className="w-full bg-[#162035] text-purple-300 font-bold text-xs rounded-xl px-3 py-2 border border-purple-400/40 focus:border-purple-400 outline-none cursor-pointer appearance-none shadow-sm"
                >
                  {availableYears.map(y => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="text-purple-400 absolute right-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* 4. Week-wise Dropdown */}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Layers size={11} className="text-emerald-400" /> Week-wise Selection
              </label>
              <div className="relative">
                <select
                  value={selectedWeek}
                  onChange={e => handleWeekChange(e.target.value)}
                  className="w-full bg-[#162035] text-emerald-300 font-bold text-xs rounded-xl px-3 py-2 border border-emerald-400/40 focus:border-emerald-400 outline-none cursor-pointer appearance-none shadow-sm"
                >
                  <option value="all">All Weeks (Full Month)</option>
                  <option value="week1">Week 1 (Days 1 - 7)</option>
                  <option value="week2">Week 2 (Days 8 - 14)</option>
                  <option value="week3">Week 3 (Days 15 - 21)</option>
                  <option value="week4">Week 4 (Days 22 - End)</option>
                </select>
                <ChevronDown size={14} className="text-emerald-400 absolute right-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* 5. Date Range (From & To) */}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Date (From & To)</span>
                {isCustomRange && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomRange(false);
                      updateRangeFromDropdowns(selectedYear, selectedMonth, selectedWeek);
                    }}
                    className="text-[9px] text-amber-400 hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={e => handleFromDateChange(e.target.value)}
                  className="w-1/2 bg-[#162035] text-white font-mono text-[11px] font-bold rounded-lg px-2 py-1.5 border border-white/20 focus:border-amber-400 outline-none shadow-inner"
                  title="From Date"
                />
                <span className="text-[10px] text-amber-400 font-black">To</span>
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={e => handleToDateChange(e.target.value)}
                  className="w-1/2 bg-[#162035] text-white font-mono text-[11px] font-bold rounded-lg px-2 py-1.5 border border-white/20 focus:border-amber-400 outline-none shadow-inner"
                  title="To Date"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ==================== TABS NAVIGATION ==================== */}
        <div className="bg-[#090e1a] px-5 pt-3 pb-2 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('pareto')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'pareto'
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md shadow-amber-500/20 scale-102'
                  : 'bg-[#162035] text-slate-300 hover:text-white hover:bg-[#1c2a47]'
              }`}
            >
              <Award size={15} />
              <span>Product-wise Pareto</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('weekly')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'weekly'
                  ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/20 scale-102'
                  : 'bg-[#162035] text-slate-300 hover:text-white hover:bg-[#1c2a47]'
              }`}
            >
              <BarChart3 size={15} />
              <span>Week-wise Analysis</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-md shadow-cyan-500/20 scale-102'
                  : 'bg-[#162035] text-slate-300 hover:text-white hover:bg-[#1c2a47]'
              }`}
            >
              <Layers size={15} />
              <span>Summary Overview</span>
            </button>
          </div>

          <div className="text-right hidden sm:block">
            <span className="text-[11px] font-bold text-slate-400">
              Active Range: <span className="text-amber-300 font-mono">{dateRange.from || 'Start'}</span> to{' '}
              <span className="text-amber-300 font-mono">{dateRange.to || 'End'}</span> ({filteredOrders.length} Orders)
            </span>
          </div>
        </div>

        {/* ==================== MODAL CONTENT BODY ==================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* TAB 1: PRODUCT-WISE PARETO ANALYSIS */}
          {activeTab === 'pareto' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Top KPI Cards for Pareto */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-[#111a2e] p-4 rounded-2xl border border-white/10 shadow-lg">
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider block">
                    Total Chocolates Sold
                  </span>
                  <h3 className="text-2xl font-black text-white mt-1">
                    {paretoData.totalQuantity.toLocaleString()}{' '}
                    <span className="text-xs font-bold text-slate-400">Pcs</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">
                    Across {paretoData.totalVarieties} unique varieties
                  </p>
                </div>

                <div className="bg-[#111a2e] p-4 rounded-2xl border border-emerald-500/30 shadow-lg">
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block">
                    #1 Top Seller Chocolate
                  </span>
                  <h3 className="text-xl font-black text-emerald-300 mt-1 truncate" title={paretoData.topItem?.name}>
                    {paretoData.topItem?.name || 'N/A'}
                  </h3>
                  <p className="text-[10px] text-emerald-400/90 font-bold mt-1">
                    {paretoData.topItem?.quantity.toLocaleString()} pcs ({paretoData.topItem?.percentage}%)
                  </p>
                </div>

                <div className="bg-[#111a2e] p-4 rounded-2xl border border-cyan-500/30 shadow-lg">
                  <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider block">
                    Category A (Top 80%)
                  </span>
                  <h3 className="text-2xl font-black text-cyan-300 mt-1">
                    {paretoData.groupA.count}{' '}
                    <span className="text-xs font-bold text-slate-400">Varieties</span>
                  </h3>
                  <p className="text-[10px] text-cyan-400/90 font-bold mt-1">
                    Drives {paretoData.groupA.percent}% of total sales
                  </p>
                </div>

                <div className="bg-[#111a2e] p-4 rounded-2xl border border-purple-500/30 shadow-lg">
                  <span className="text-[10px] font-black text-purple-400 uppercase tracking-wider block">
                    Pareto Efficiency Ratio
                  </span>
                  <h3 className="text-2xl font-black text-purple-300 mt-1">
                    {paretoData.totalVarieties > 0
                      ? Math.round((paretoData.groupA.count / paretoData.totalVarieties) * 100)
                      : 0}
                    %
                  </h3>
                  <p className="text-[10px] text-purple-400/90 font-semibold mt-1">
                    Products driving 80% volume
                  </p>
                </div>
              </div>

              {/* Group Reports Badges */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-[#111a2e]/90 p-4 rounded-2xl border border-emerald-500/40">
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/50">
                      Category A (Core 80%)
                    </span>
                    <span className="text-xs font-black text-emerald-400 font-mono">
                      {paretoData.groupA.percent}% Vol
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-medium mb-2">
                    High volume drivers. Always maintain priority inventory.
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
                    {paretoData.groupA.items.length > 0 ? (
                      paretoData.groupA.items.map(it => (
                        <span
                          key={it.name}
                          className="px-2 py-0.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-[11px] font-bold text-emerald-200"
                        >
                          {it.name} ({it.quantity})
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-500 italic">No items in this range</span>
                    )}
                  </div>
                </div>

                <div className="bg-[#111a2e]/90 p-4 rounded-2xl border border-cyan-500/40">
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/50">
                      Category B (Next 15%)
                    </span>
                    <span className="text-xs font-black text-cyan-400 font-mono">
                      {paretoData.groupB.percent}% Vol
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-medium mb-2">
                    Steady moderate sellers. Regular inventory checks.
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
                    {paretoData.groupB.items.length > 0 ? (
                      paretoData.groupB.items.map(it => (
                        <span
                          key={it.name}
                          className="px-2 py-0.5 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-[11px] font-bold text-cyan-200"
                        >
                          {it.name} ({it.quantity})
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-500 italic">No items in this range</span>
                    )}
                  </div>
                </div>

                <div className="bg-[#111a2e]/90 p-4 rounded-2xl border border-purple-500/40">
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-500/20 text-purple-300 border border-purple-500/50">
                      Category C (Tail 5%)
                    </span>
                    <span className="text-xs font-black text-purple-400 font-mono">
                      {paretoData.groupC.percent}% Vol
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-medium mb-2">
                    Slow-moving or niche chocolates. On-demand stocking.
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
                    {paretoData.groupC.items.length > 0 ? (
                      paretoData.groupC.items.map(it => (
                        <span
                          key={it.name}
                          className="px-2 py-0.5 rounded-lg bg-purple-950/60 border border-purple-500/40 text-[11px] font-bold text-purple-200"
                        >
                          {it.name} ({it.quantity})
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-500 italic">No items in this range</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Pareto Dual-Axis Chart */}
              <div className="bg-[#0e162a] p-4 sm:p-6 rounded-2xl border border-white/10 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                      <Award size={18} className="text-amber-400" />
                      Pareto 80/20 Product Chart
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">
                      Left axis: Chocolates Sold (Bar) | Right axis: Cumulative Share % (Line)
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Cat A (80%)
                    </span>
                    <span className="flex items-center gap-1.5 text-cyan-400">
                      <span className="w-3 h-3 rounded bg-cyan-500 inline-block" /> Cat B (15%)
                    </span>
                    <span className="flex items-center gap-1.5 text-purple-400">
                      <span className="w-3 h-3 rounded bg-purple-500 inline-block" /> Cat C (5%)
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <span className="w-3 h-0.5 bg-amber-400 inline-block" /> Cum % Line
                    </span>
                  </div>
                </div>

                {paretoData.items.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-slate-500">
                    <p className="font-bold text-sm">No chocolate sales recorded in this date range.</p>
                    <p className="text-xs mt-1">Try switching weeks or adjusting the month/year filter.</p>
                  </div>
                ) : (
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={paretoData.items}
                        margin={{ top: 20, right: 30, left: 10, bottom: 40 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2d4a" />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
                          interval={0}
                          angle={-35}
                          textAnchor="end"
                          height={55}
                        />
                        <YAxis
                          yAxisId="left"
                          tick={{ fill: '#94a3b8', fontSize: 11 }}
                          label={{ value: 'Units Sold (Pcs)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          domain={[0, 100]}
                          tick={{ fill: '#f59e0b', fontSize: 11 }}
                          tickFormatter={val => `${val}%`}
                          label={{ value: 'Cumulative %', angle: 90, position: 'insideRight', fill: '#f59e0b', fontSize: 11 }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#090e1a',
                            borderColor: '#f59e0b',
                            borderRadius: '12px',
                            color: '#ffffff',
                            fontWeight: 'bold',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.8)'
                          }}
                          formatter={(value: any, name: string) => {
                            if (name === 'quantity') return [`${value} Pcs`, 'Quantity Sold'];
                            if (name === 'cumulativePercentage') return [`${value}%`, 'Cumulative Share'];
                            return [value, name];
                          }}
                        />
                        <ReferenceLine
                          yAxisId="right"
                          y={80}
                          stroke="#ef4444"
                          strokeDasharray="4 4"
                          strokeWidth={2}
                          label={{ value: '80% Pareto Cutoff', position: 'top', fill: '#ef4444', fontSize: 10, fontWeight: 800 }}
                        />
                        <Bar yAxisId="left" dataKey="quantity" radius={[6, 6, 0, 0]}>
                          {paretoData.items.map((entry, index) => {
                            let color = '#10b981'; // Green Cat A
                            if (entry.group === 'B') color = '#06b6d4'; // Cyan Cat B
                            if (entry.group === 'C') color = '#a855f7'; // Purple Cat C
                            return <Cell key={`cell-${index}`} fill={color} />;
                          })}
                        </Bar>
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="cumulativePercentage"
                          stroke="#f59e0b"
                          strokeWidth={3}
                          dot={{ r: 4, fill: '#f59e0b' }}
                          activeDot={{ r: 6 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Detailed Breakdown Table */}
              <div className="bg-[#0e162a] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
                <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <FileSpreadsheet size={16} className="text-amber-400" />
                    Chocolate Ranking & Percentage Report
                  </h3>
                  <span className="text-xs text-slate-400 font-bold">
                    {paretoData.items.length} Products Evaluated
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#141f36] text-slate-300 uppercase font-black tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-3">Rank</th>
                        <th className="px-4 py-3">Chocolate Name</th>
                        <th className="px-4 py-3">Pareto Category</th>
                        <th className="px-4 py-3 text-right">Quantity Sold (Pcs)</th>
                        <th className="px-4 py-3 text-right">% of Total Sales</th>
                        <th className="px-4 py-3 text-right">Cumulative %</th>
                        <th className="px-4 py-3 text-center">Orders Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-semibold">
                      {paretoData.items.map(item => {
                        let badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
                        let label = 'Category A (Top 80%)';
                        if (item.group === 'B') {
                          badgeColor = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
                          label = 'Category B (Next 15%)';
                        } else if (item.group === 'C') {
                          badgeColor = 'bg-purple-500/20 text-purple-300 border-purple-500/40';
                          label = 'Category C (Tail 5%)';
                        }

                        return (
                          <tr key={item.name} className="hover:bg-white/5 transition-colors">
                            <td className="px-4 py-3 font-mono font-black text-amber-400">
                              #{item.rank}
                            </td>
                            <td className="px-4 py-3 font-bold text-white flex items-center gap-2">
                              {item.name}
                              {item.rank === 1 && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-400 text-slate-950 uppercase">
                                  Top 1
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${badgeColor}`}
                              >
                                {label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-black text-white text-sm">
                              {item.quantity.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right font-mono">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden hidden sm:block">
                                  <div
                                    className="bg-amber-400 h-full rounded-full"
                                    style={{ width: `${Math.min(100, item.percentage)}%` }}
                                  />
                                </div>
                                <span className="font-bold text-amber-300">{item.percentage}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-black text-slate-300">
                              {item.cumulativePercentage}%
                            </td>
                            <td className="px-4 py-3 text-center font-mono text-slate-400">
                              {item.orderCount}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: WEEK-WISE CUSTOMERS & SALES ANALYSIS */}
          {activeTab === 'weekly' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Top Summary Cards for Weekly Analysis */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-[#111a2e] p-4 rounded-2xl border border-white/10 shadow-lg">
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block">
                    Week Total Customers
                  </span>
                  <h3 className="text-2xl font-black text-white mt-1">
                    {weekWiseData.weekTotalCustomers}{' '}
                    <span className="text-xs font-bold text-slate-400">Customers</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">
                    Daily Average: <span className="text-emerald-400 font-bold">{weekWiseData.dailyAvgCustomers}</span> cust/day
                  </p>
                </div>

                <div className="bg-[#111a2e] p-4 rounded-2xl border border-amber-500/30 shadow-lg">
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider block">
                    Week Chocolates Sold
                  </span>
                  <h3 className="text-2xl font-black text-amber-300 mt-1">
                    {weekWiseData.weekTotalChocolates.toLocaleString()}{' '}
                    <span className="text-xs font-bold text-slate-400">Pcs</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">
                    Daily Average: <span className="text-amber-400 font-bold">{weekWiseData.dailyAvgChocolates}</span> pcs/day
                  </p>
                </div>

                <div className="bg-[#111a2e] p-4 rounded-2xl border border-cyan-500/30 shadow-lg">
                  <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider block">
                    Avg Chocs / Customer
                  </span>
                  <h3 className="text-2xl font-black text-cyan-300 mt-1">
                    {weekWiseData.avgChocolatesPerCustomer}{' '}
                    <span className="text-xs font-bold text-slate-400">Pcs / Cust</span>
                  </h3>
                  <p className="text-[10px] text-cyan-400/90 font-semibold mt-1">
                    Order volume per buyer
                  </p>
                </div>

                <div className="bg-[#111a2e] p-4 rounded-2xl border border-purple-500/30 shadow-lg">
                  <span className="text-[10px] font-black text-purple-400 uppercase tracking-wider block">
                    Peak Performance Day
                  </span>
                  <h3 className="text-xl font-black text-purple-300 mt-1 truncate">
                    {weekWiseData.peakDay ? `${weekWiseData.peakDay.dayOfWeek} (${weekWiseData.peakDay.fullDateDisplay})` : 'N/A'}
                  </h3>
                  <p className="text-[10px] text-purple-400/90 font-bold mt-1">
                    {weekWiseData.peakDay?.chocolatesSold.toLocaleString() || 0} pcs &bull; {weekWiseData.peakDay?.customersCount || 0} cust
                  </p>
                </div>
              </div>

              {/* Chart: Day-wise Customer Count & Chocolates Sold */}
              <div className="bg-[#0e162a] p-4 sm:p-6 rounded-2xl border border-white/10 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                      <BarChart3 size={18} className="text-emerald-400" />
                      Daily Breakdown: Customers & Chocolates Sold ({weekWiseData.weekLabel})
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">
                      Left axis: Chocolates Sold (Amber Bars) | Right axis: Customer Count (Cyan Line with Counts)
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold">
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <span className="w-3 h-3 rounded bg-amber-400 inline-block" /> Chocolates Sold
                    </span>
                    <span className="flex items-center gap-1.5 text-cyan-400">
                      <span className="w-3 h-3 rounded bg-cyan-400 inline-block" /> Customer Count
                    </span>
                  </div>
                </div>

                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={weekWiseData.days}
                      margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2d4a" />
                      <XAxis
                        dataKey="dayLabel"
                        tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
                        tickFormatter={(val, idx) => {
                          const item = weekWiseData.days[idx];
                          return item ? `${val} (${item.dayOfWeek})` : val;
                        }}
                      />
                      <YAxis
                        yAxisId="left"
                        tick={{ fill: '#f59e0b', fontSize: 11 }}
                        label={{ value: 'Chocolates Sold', angle: -90, position: 'insideLeft', fill: '#f59e0b', fontSize: 11 }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fill: '#06b6d4', fontSize: 11 }}
                        label={{ value: 'Customers Count', angle: 90, position: 'insideRight', fill: '#06b6d4', fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#090e1a',
                          borderColor: '#10b981',
                          borderRadius: '12px',
                          color: '#ffffff',
                          fontWeight: 'bold',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.8)'
                        }}
                        formatter={(value: any, name: string) => {
                          if (name === 'chocolatesSold') return [`${value} Pcs`, 'Chocolates Sold'];
                          if (name === 'customersCount') return [`${value} Customers`, 'Customers Count'];
                          return [value, name];
                        }}
                        labelFormatter={(label: any, payload: any) => {
                          const item = payload?.[0]?.payload;
                          if (item) return `${label} - ${item.fullDateDisplay} (${item.dayOfWeek})`;
                          return label;
                        }}
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="chocolatesSold"
                        fill="#f59e0b"
                        radius={[6, 6, 0, 0]}
                        name="chocolatesSold"
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="customersCount"
                        stroke="#06b6d4"
                        strokeWidth={3}
                        dot={{ r: 5, fill: '#06b6d4' }}
                        activeDot={{ r: 7 }}
                        name="customersCount"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Exact user requirement: Daily report table with customer count & chocolates count */}
              <div className="bg-[#0e162a] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
                <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <Calendar size={16} className="text-emerald-400" />
                      Daily Customer Footfall & Chocolate Sales ({weekWiseData.weekLabel})
                    </h3>
                    <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                      Breakdown showing each day's exact customer count and chocolates sold
                    </p>
                  </div>
                  <span className="text-xs text-amber-400 font-mono font-black">
                    {weekWiseData.days.length} Days Evaluated
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#141f36] text-slate-300 uppercase font-black tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-3">Day & Date</th>
                        <th className="px-4 py-3">Day of Week</th>
                        <th className="px-4 py-3 text-center">Customers Count</th>
                        <th className="px-4 py-3 text-right">Chocolates Sold (Pcs)</th>
                        <th className="px-4 py-3 text-right">Avg / Customer</th>
                        <th className="px-4 py-3 text-right">Total Sales Amount</th>
                        <th className="px-4 py-3 text-right">% of Week's Chocolates</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-semibold">
                      {weekWiseData.days.map((item, idx) => (
                        <tr key={item.dateStr} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 font-bold text-white">
                            <span className="font-mono text-amber-400 mr-2">{item.dayLabel}</span>
                            <span className="text-slate-300 font-mono">({item.fullDateDisplay})</span>
                          </td>
                          <td className="px-4 py-3 text-slate-300 font-semibold">
                            {item.dayOfWeek}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-3 py-1 rounded-full text-xs font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono">
                              {item.customersCount} Customers
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-black text-amber-300 text-sm">
                            {item.chocolatesSold.toLocaleString()} Pcs
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-300">
                            {item.avgChocPerCustomer} pcs/cust
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                            {formatINR(item.salesAmount)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden hidden sm:block">
                                <div
                                  className="bg-emerald-400 h-full rounded-full"
                                  style={{ width: `${Math.min(100, item.percentageOfWeek)}%` }}
                                />
                              </div>
                              <span className="font-bold text-emerald-300">{item.percentageOfWeek}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-[#141f36]/80 border-t-2 border-white/20 font-black text-white">
                      <tr>
                        <td className="px-4 py-3 uppercase tracking-wider text-amber-400" colSpan={2}>
                          Week Total / Averages
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-cyan-300">
                          {weekWiseData.weekTotalCustomers} Customers (Avg: {weekWiseData.dailyAvgCustomers}/day)
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-amber-300 text-sm">
                          {weekWiseData.weekTotalChocolates.toLocaleString()} Pcs (Avg: {weekWiseData.dailyAvgChocolates}/day)
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-300">
                          {weekWiseData.avgChocolatesPerCustomer} pcs/cust
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-400">
                          {formatINR(weekWiseData.weekTotalSales)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-300">
                          100.0%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Monthly 4-Week Comparison Table */}
              <div className="bg-[#0e162a] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
                <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <Layers size={16} className="text-cyan-400" />
                      Monthly 4-Week Comparison ({monthsList.find(m => m.value === selectedMonth)?.name} {selectedYear})
                    </h3>
                    <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                      Weekly customer footfall and sales share against the full month
                    </p>
                  </div>
                  <span className="text-xs text-cyan-400 font-mono font-bold">
                    Month Total: {weekWiseData.monthTotalChocolates.toLocaleString()} Pcs
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#141f36] text-slate-300 uppercase font-black tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-3">Week Interval</th>
                        <th className="px-4 py-3 text-center">Customers Count</th>
                        <th className="px-4 py-3 text-center">Daily Avg Customers</th>
                        <th className="px-4 py-3 text-right">Chocolates Sold</th>
                        <th className="px-4 py-3 text-center">Daily Avg Chocolates</th>
                        <th className="px-4 py-3 text-right">% of Month Sales</th>
                        <th className="px-4 py-3 text-right">Total Sales</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-semibold">
                      {weekWiseData.weeklyComparison.map(wk => {
                        const isCurrentWeek =
                          (selectedWeek === 'week1' && wk.weekNum === 1) ||
                          (selectedWeek === 'week2' && wk.weekNum === 2) ||
                          (selectedWeek === 'week3' && wk.weekNum === 3) ||
                          (selectedWeek === 'week4' && wk.weekNum === 4);

                        return (
                          <tr
                            key={wk.weekNum}
                            className={`transition-colors ${
                              isCurrentWeek ? 'bg-amber-400/10 border-l-4 border-amber-400' : 'hover:bg-white/5'
                            }`}
                          >
                            <td className="px-4 py-3 font-bold text-white flex items-center gap-2">
                              {wk.weekName}
                              {isCurrentWeek && (
                                <span className="px-2 py-0.5 rounded text-[9px] font-black bg-amber-400 text-slate-950 uppercase">
                                  Selected
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center font-mono font-bold text-cyan-300">
                              {wk.customers} Cust
                            </td>
                            <td className="px-4 py-3 text-center font-mono text-slate-300">
                              {wk.dailyAvgCust} / day
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-black text-amber-300 text-sm">
                              {wk.chocolates.toLocaleString()} Pcs
                            </td>
                            <td className="px-4 py-3 text-center font-mono text-slate-300">
                              {wk.dailyAvgChoc} / day
                            </td>
                            <td className="px-4 py-3 text-right font-mono">
                              <span className="font-bold text-emerald-400">{wk.percentOfMonthChocolates}%</span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-white">
                              {formatINR(wk.sales)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: COMBINED EXECUTIVE OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-gradient-to-br from-[#111c33] via-[#0d1527] to-[#090e1a] p-6 rounded-3xl border border-amber-500/30 shadow-2xl relative overflow-hidden">
                <div className="relative z-10">
                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/40 inline-flex items-center gap-1.5 mb-3">
                    <Sparkles size={13} /> Executive Strategic Summary
                  </span>
                  <h2 className="text-2xl font-black text-white tracking-wide">
                    Pareto 80/20 & Weekly Demand Insights
                  </h2>
                  <p className="text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
                    Based on your selected timeframe ({dateRange.from || 'Start'} to {dateRange.to || 'End'}),
                    your top <strong>{paretoData.groupA.count} chocolate varieties</strong> account for{' '}
                    <strong className="text-amber-400">{paretoData.groupA.percent}% of total volume</strong>.
                    Maintaining optimal stock on these core varieties prevents stock-outs and accelerates order fulfillment.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                    <div className="bg-[#162035]/80 p-4 rounded-2xl border border-white/10">
                      <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider block">
                        Top Chocolate Driver
                      </span>
                      <h4 className="text-lg font-black text-white mt-1">
                        {paretoData.topItem?.name || 'N/A'}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Generated {paretoData.topItem?.quantity.toLocaleString()} pcs ({paretoData.topItem?.percentage}% of sales)
                      </p>
                    </div>

                    <div className="bg-[#162035]/80 p-4 rounded-2xl border border-white/10">
                      <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider block">
                        Average Daily Customer Footfall
                      </span>
                      <h4 className="text-lg font-black text-cyan-300 mt-1">
                        {weekWiseData.dailyAvgCustomers} Customers / Day
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Average {weekWiseData.dailyAvgChocolates} pcs packed & shipped daily
                      </p>
                    </div>

                    <div className="bg-[#162035]/80 p-4 rounded-2xl border border-white/10">
                      <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block">
                        Inventory Action Rule
                      </span>
                      <h4 className="text-lg font-black text-emerald-300 mt-1">
                        Protect Category A Stock
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {paretoData.groupA.count} varieties generate 80% of total volume
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ==================== FOOTER ==================== */}
        <div className="bg-[#0e162a] px-5 py-3 border-t border-white/10 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2 text-slate-400 font-semibold">
            <Info size={14} className="text-amber-400" />
            <span>
              Values automatically update according to Year, Month, Week, Date Range & Date Basis dropdowns.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer"
          >
            Done / Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ParetoAnalysisModal;
