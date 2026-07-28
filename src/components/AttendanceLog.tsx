import React, { useState, useEffect, useMemo } from "react";
import { 
  Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, Eye, User, 
  Search, Filter, CheckCircle2, XCircle, AlertCircle, Plus, Edit2, Save, X, DollarSign, Briefcase, FileText, Image as ImageIcon
} from "lucide-react";
import { toast } from "sonner";
import { db } from "@/firebase";
import { collection, onSnapshot, addDoc, updateDoc, doc, setDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";

export interface AttendanceRecord {
  id: string;
  fireId?: string;
  userId?: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  loginTime: string; // e.g. "09:15 AM"
  logoutTime: string; // e.g. "05:45 PM"
  workingHours: string; // e.g. "8.5 hrs"
  workingHoursNum: number; // e.g. 8.5
  status: "Present" | "Leave" | "Half Day";
  remarks: string;
}

export interface EmployeeSalary {
  employeeName: string;
  monthlySalary: number;
  hourlySalary?: number;
  dailyAmount?: number; // for Special Bonus, Overtime, Manual Adjustments
}

const DEFAULT_EMPLOYEES = ["Aravinth", "Gayathiri", "Subash", "Kumar", "Suresh"];

export default function AttendanceLog({ isAdminOverride = true, onWallpaperChange }: { isAdminOverride?: boolean; onWallpaperChange?: () => void }) {
  const { profile } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'employee' | 'admin'>('employee');
  const activeUser = profile?.username || localStorage.getItem('loggedInName') || "";
  const currentLoggedInUser = activeUser || "Gayathiri";

  // Helper to retrieve user-specific or global wallpaper
  const getAttendanceWallpaper = (username?: string) => {
    const keyUser = username || activeUser;
    if (keyUser) {
      const userWp = localStorage.getItem(`sabi_wallpaper_attendance_${keyUser}`);
      if (userWp) return userWp;
    }
    return localStorage.getItem('sabi_wallpaper_attendance') || "";
  };
  
  // Wallpaper State for Attendance Log
  const [attendanceWallpaper, setAttendanceWallpaper] = useState(() => getAttendanceWallpaper(currentLoggedInUser));

  // Sync wallpaper when user profile changes
  useEffect(() => {
    const wp = getAttendanceWallpaper(profile?.username || localStorage.getItem('loggedInName') || undefined);
    setAttendanceWallpaper(wp);
  }, [profile?.username]);

  const handleAttendanceWallpaperUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        setAttendanceWallpaper(compressedBase64);
        localStorage.setItem('sabi_wallpaper_attendance', compressedBase64);
        if (activeUser) {
          localStorage.setItem(`sabi_wallpaper_attendance_${activeUser}`, compressedBase64);
        }
        toast.success("Attendance Log wallpaper updated!");
        if (onWallpaperChange) onWallpaperChange();
      };
    };
    reader.readAsDataURL(file);
  };

  const handleClearAttendanceWallpaper = () => {
    setAttendanceWallpaper("");
    localStorage.removeItem('sabi_wallpaper_attendance');
    if (activeUser) {
      localStorage.removeItem(`sabi_wallpaper_attendance_${activeUser}`);
    }
    toast.success("Attendance Log wallpaper cleared!");
    if (onWallpaperChange) onWallpaperChange();
  };

  // Selected employee for employee view
  const [selectedUser, setSelectedUser] = useState<string>(currentLoggedInUser);

  // Sync selected user whenever profile loads or changes (overrides stale default)
  useEffect(() => {
    const userToSet = profile?.username || localStorage.getItem('loggedInName');
    if (userToSet) {
      setSelectedUser(prev => {
        if (!prev || !isAdminOverride || prev === "Gayathiri" || prev !== userToSet) {
          return userToSet;
        }
        return prev;
      });
    }
  }, [profile?.username, isAdminOverride]);

  // Dynamic employee list including active logged-in user
  const employeeOptions = useMemo(() => {
    const list = [...DEFAULT_EMPLOYEES];
    const currentUser = profile?.username || localStorage.getItem('loggedInName');
    if (currentUser && !list.some(e => e.toLowerCase() === currentUser.toLowerCase())) {
      list.unshift(currentUser);
    }
    return Array.from(new Set(list));
  }, [profile?.username]);

  // Attendance Records State
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem("sabii_attendance_log");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [
      { id: "1", employeeName: "Gayathiri", date: "2026-07-20", loginTime: "09:00 AM", logoutTime: "05:30 PM", workingHours: "8.5 hrs", workingHoursNum: 8.5, status: "Present", remarks: "Regular Work" },
      { id: "2", employeeName: "Gayathiri", date: "2026-07-21", loginTime: "09:15 AM", logoutTime: "06:00 PM", workingHours: "8.75 hrs", workingHoursNum: 8.75, status: "Present", remarks: "Regular Work" },
      { id: "3", employeeName: "Gayathiri", date: "2026-07-22", loginTime: "-", logoutTime: "-", workingHours: "0 hrs", workingHoursNum: 0, status: "Leave", remarks: "Casual Leave" },
      { id: "4", employeeName: "Subash", date: "2026-07-20", loginTime: "09:30 AM", logoutTime: "06:30 PM", workingHours: "9 hrs", workingHoursNum: 9, status: "Present", remarks: "Overtime" },
      { id: "5", employeeName: "Aravinth", date: "2026-07-24", loginTime: "09:00 AM", logoutTime: "05:00 PM", workingHours: "8 hrs", workingHoursNum: 8, status: "Present", remarks: "On Duty" }
    ];
  });

  // Salaries State
  const [employeeSalaries, setEmployeeSalaries] = useState<Record<string, EmployeeSalary>>(() => {
    const saved = localStorage.getItem("sabii_employee_salaries");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return {
      "Aravinth": { employeeName: "Aravinth", monthlySalary: 35000, hourlySalary: 200, dailyAmount: 500 },
      "Gayathiri": { employeeName: "Gayathiri", monthlySalary: 28000, hourlySalary: 150, dailyAmount: 300 },
      "Subash": { employeeName: "Subash", monthlySalary: 25000, hourlySalary: 140, dailyAmount: 250 },
      "Kumar": { employeeName: "Kumar", monthlySalary: 22000, hourlySalary: 120, dailyAmount: 200 },
      "Suresh": { employeeName: "Suresh", monthlySalary: 20000, hourlySalary: 110, dailyAmount: 150 },
    };
  });

  // Listen to Firebase firestore for live sync
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "attendance"), (snapshot) => {
      if (!snapshot.empty) {
        const list: AttendanceRecord[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ fireId: docSnap.id, ...(docSnap.data() as any) });
        });
        setAttendanceRecords(list);
        localStorage.setItem("sabii_attendance_log", JSON.stringify(list));
      }
    }, (err) => console.log("Firebase attendance sync fallback to local", err));

    const unsubSalaries = onSnapshot(collection(db, "employee_salaries"), (snapshot) => {
      if (!snapshot.empty) {
        const salariesMap: Record<string, EmployeeSalary> = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as EmployeeSalary;
          if (data.employeeName) {
            salariesMap[data.employeeName] = data;
          }
        });
        setEmployeeSalaries(prev => ({ ...prev, ...salariesMap }));
        localStorage.setItem("sabii_employee_salaries", JSON.stringify(salariesMap));
      }
    }, (err) => console.log("Firebase salaries sync fallback to local", err));

    return () => { unsub(); unsubSalaries(); };
  }, []);

  // Save to local storage on change
  useEffect(() => {
    localStorage.setItem("sabii_attendance_log", JSON.stringify(attendanceRecords));
  }, [attendanceRecords]);

  useEffect(() => {
    localStorage.setItem("sabii_employee_salaries", JSON.stringify(employeeSalaries));
  }, [employeeSalaries]);

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-11

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Modals state
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveDate, setLeaveDate] = useState(new Date().toISOString().split('T')[0]);
  const [leaveRemark, setLeaveRemark] = useState("Personal Leave");

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [editingSalaryUser, setEditingSalaryUser] = useState<string | null>(null);
  const [salaryForm, setSalaryForm] = useState<EmployeeSalary>({ employeeName: "", monthlySalary: 0 });

  // Filter state for Admin Panel
  const [adminSearch, setAdminSearch] = useState("");
  const [adminMonthFilter, setAdminMonthFilter] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [adminDateFilter, setAdminDateFilter] = useState("");
  const [adminStatusFilter, setAdminStatusFilter] = useState("All");

  // Today string YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];

  // User-specific attendance records
  const userAttendanceRecords = useMemo(() => {
    return attendanceRecords.filter(r => r.employeeName.toLowerCase() === selectedUser.toLowerCase());
  }, [attendanceRecords, selectedUser]);

  // Today's attendance status for selected user
  const todayRecord = useMemo(() => {
    return userAttendanceRecords.find(r => r.date === todayStr);
  }, [userAttendanceRecords, todayStr]);

  // --- ATTENDANCE ACTIONS ---
  const handleLogIn = async () => {
    if (todayRecord && todayRecord.loginTime !== "-") {
      toast.warning(`You have already logged in today at ${todayRecord.loginTime}`);
      return;
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    const newRecord: AttendanceRecord = {
      id: String(Date.now()),
      employeeName: selectedUser,
      date: todayStr,
      loginTime: timeStr,
      logoutTime: "-",
      workingHours: "In Progress",
      workingHoursNum: 0,
      status: "Present",
      remarks: "Logged In"
    };

    const updated = [...attendanceRecords.filter(r => !(r.employeeName.toLowerCase() === selectedUser.toLowerCase() && r.date === todayStr)), newRecord];
    setAttendanceRecords(updated);
    toast.success(`Logged In successfully at ${timeStr}`);

    try {
      await addDoc(collection(db, "attendance"), newRecord);
    } catch (e) {
      console.log("Offline mode, saved locally");
    }
  };

  const handleLogOut = async () => {
    if (!todayRecord || todayRecord.loginTime === "-") {
      toast.error("Please Log In first before Logging Out!");
      return;
    }

    if (todayRecord.logoutTime !== "-") {
      toast.warning(`Already logged out today at ${todayRecord.logoutTime}`);
      return;
    }

    const now = new Date();
    const logoutTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    // Calculate working hours automatically
    let hoursFormatted = "8 hrs";
    let hoursNum = 8;

    try {
      const loginParts = todayRecord.loginTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (loginParts) {
        let h = parseInt(loginParts[1]);
        const m = parseInt(loginParts[2]);
        const ampm = loginParts[3].toUpperCase();
        if (ampm === "PM" && h < 12) h += 12;
        if (ampm === "AM" && h === 12) h = 0;

        const loginDateObj = new Date();
        loginDateObj.setHours(h, m, 0, 0);

        const diffMs = now.getTime() - loginDateObj.getTime();
        const diffHrs = Math.max(0.1, diffMs / (1000 * 60 * 60));
        hoursNum = Number(diffHrs.toFixed(2));
        
        const fullHours = Math.floor(diffHrs);
        const mins = Math.round((diffHrs - fullHours) * 60);
        hoursFormatted = `${fullHours} hrs ${mins} mins`;
      }
    } catch (e) {
      console.error("Error calculating hours", e);
    }

    const updatedRecord: AttendanceRecord = {
      ...todayRecord,
      logoutTime: logoutTimeStr,
      workingHours: hoursFormatted,
      workingHoursNum: hoursNum,
      remarks: "Shift Completed"
    };

    const updated = attendanceRecords.map(r => 
      (r.employeeName.toLowerCase() === selectedUser.toLowerCase() && r.date === todayStr) ? updatedRecord : r
    );

    setAttendanceRecords(updated);
    toast.success(`Logged Out successfully! Working Hours: ${hoursFormatted}`);

    try {
      if (todayRecord.fireId) {
        await updateDoc(doc(db, "attendance", todayRecord.fireId), updatedRecord as any);
      } else {
        await addDoc(collection(db, "attendance"), updatedRecord as any);
      }
    } catch (e) {
      console.log("Offline update");
    }
  };

  const handleApplyLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveDate) return;

    // Check if record exists
    const existing = attendanceRecords.find(r => r.employeeName.toLowerCase() === selectedUser.toLowerCase() && r.date === leaveDate);
    if (existing && existing.status === "Present") {
      toast.error(`Cannot apply leave: Already logged in as Present on ${leaveDate}`);
      return;
    }

    const leaveRecord: AttendanceRecord = {
      id: String(Date.now()),
      employeeName: selectedUser,
      date: leaveDate,
      loginTime: "-",
      logoutTime: "-",
      workingHours: "0 hrs",
      workingHoursNum: 0,
      status: "Leave",
      remarks: leaveRemark || "Leave Applied"
    };

    const updated = [...attendanceRecords.filter(r => !(r.employeeName.toLowerCase() === selectedUser.toLowerCase() && r.date === leaveDate)), leaveRecord];
    setAttendanceRecords(updated);
    setIsLeaveModalOpen(false);
    toast.success(`Leave applied for ${leaveDate}! Date marked in Red.`);

    try {
      await addDoc(collection(db, "attendance"), leaveRecord);
    } catch (e) {
      console.log("Offline mode");
    }
  };

  // Salary Edit & Save
  const handleSaveSalary = async (employeeName: string) => {
    setEmployeeSalaries(prev => ({
      ...prev,
      [employeeName]: salaryForm
    }));

    toast.success(`Salary updated immediately for ${employeeName}`);
    setEditingSalaryUser(null);

    try {
      await setDoc(doc(db, "employee_salaries", employeeName), salaryForm);
    } catch (e) {
      console.log("Offline salary update");
    }
  };

  // Calendar Day Computation
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(d);
    }
    return days;
  }, [year, month]);

  // Current month's records for employee view
  const currentMonthRecords = useMemo(() => {
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return userAttendanceRecords.filter(r => r.date.startsWith(monthPrefix));
  }, [userAttendanceRecords, year, month]);

  // History stats
  const monthlyStats = useMemo(() => {
    let totalHours = 0;
    let presentDays = 0;
    let leaveDays = 0;

    currentMonthRecords.forEach(r => {
      if (r.status === "Present") {
        presentDays++;
        totalHours += r.workingHoursNum || 0;
      } else if (r.status === "Leave") {
        leaveDays++;
      }
    });

    return {
      totalHours: totalHours.toFixed(1),
      presentDays,
      leaveDays
    };
  }, [currentMonthRecords]);

  // Admin filtered records
  const adminFilteredRecords = useMemo(() => {
    return attendanceRecords.filter(r => {
      const matchesSearch = !adminSearch || r.employeeName.toLowerCase().includes(adminSearch.toLowerCase());
      const matchesMonth = !adminMonthFilter || r.date.startsWith(adminMonthFilter);
      const matchesDate = !adminDateFilter || r.date === adminDateFilter;
      const matchesStatus = adminStatusFilter === "All" || r.status === adminStatusFilter;
      return matchesSearch && matchesMonth && matchesDate && matchesStatus;
    });
  }, [attendanceRecords, adminSearch, adminMonthFilter, adminDateFilter, adminStatusFilter]);

  return (
    <div className="space-y-6 font-sans text-slate-800 pb-12">
      {/* Top Section Header & Sub-Tab Switcher */}
      <div className="bg-[#ebe6df] p-4 md:p-6 rounded-[2rem] shadow-[6px_6px_12px_rgba(0,0,0,0.1),-6px_-6px_12px_rgba(255,255,255,0.8)] border-2 border-white/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-[#3e2723] uppercase tracking-wider flex items-center gap-3">
            <CalendarIcon className="text-amber-700" size={32} /> Attendance Log
          </h1>
          <p className="text-xs md:text-sm font-bold text-[#5d4037] mt-1">
            Employee Attendance & Permanent Log Tracking System
          </p>
        </div>

        {/* View Switcher: Employee View vs Admin Attendance Panel & Wallpaper Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white/70 p-1.5 rounded-2xl border-2 border-white shadow-inner self-stretch md:self-auto justify-center">
            <button
              onClick={() => setActiveSubTab('employee')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-black transition-all cursor-pointer ${
                activeSubTab === 'employee'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-[#5d4037] hover:bg-white/50'
              }`}
            >
              <User size={16} /> Employee View
            </button>
            {isAdminOverride && (
              <button
                onClick={() => setActiveSubTab('admin')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-black transition-all cursor-pointer ${
                  activeSubTab === 'admin'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-[#5d4037] hover:bg-white/50'
                }`}
              >
                <Briefcase size={16} /> Admin Attendance & Salary
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => document.getElementById('attendance-wallpaper-upload')?.click()}
              className="flex justify-center items-center w-10 h-10 font-bold rounded-xl transition-all border bg-white/80 text-amber-900 border-white hover:bg-white cursor-pointer shadow-sm"
              title="Set Background Wallpaper"
            >
              <ImageIcon size={18} className="text-amber-700" />
            </button>
            <input
              type="file"
              id="attendance-wallpaper-upload"
              accept="image/*"
              className="hidden"
              onChange={handleAttendanceWallpaperUpload}
            />
            {attendanceWallpaper && (
              <button
                onClick={handleClearAttendanceWallpaper}
                className="px-3 py-2 text-xs font-black text-red-600 bg-red-50 hover:bg-red-100 rounded-xl border border-red-200 cursor-pointer transition-colors shadow-sm"
                title="Remove Wallpaper"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ------------------- 1. EMPLOYEE VIEW ------------------- */}
      {activeSubTab === 'employee' && (
        <div className="space-y-6">
          
          {/* User selector bar for preview / testing */}
          <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-amber-900">
            <div className="flex items-center gap-2">
              <User size={16} className="text-amber-700" />
              <span>Logged In User:</span>
              <span className="bg-amber-600 text-white px-2.5 py-0.5 rounded-md text-sm font-black">{selectedUser}</span>
            </div>
            {isAdminOverride && (
              <div className="flex items-center gap-2">
                <span>Switch Employee View:</span>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="bg-white border border-amber-300 rounded-lg px-2 py-1 text-xs font-bold text-amber-950 outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  {employeeOptions.map(emp => (
                    <option key={emp} value={emp}>{emp}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Mark Attendance Section */}
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-wide mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Clock className="text-amber-600" size={22} /> Mark Attendance
            </h2>

            {/* Three Primary Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                onClick={handleLogIn}
                className="flex items-center justify-center gap-3 px-6 py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black rounded-2xl shadow-md hover:shadow-lg transition-all text-base cursor-pointer"
              >
                <CheckCircle2 size={22} /> Log In
              </button>

              <button
                onClick={handleLogOut}
                className="flex items-center justify-center gap-3 px-6 py-4 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black rounded-2xl shadow-md hover:shadow-lg transition-all text-base cursor-pointer"
              >
                <XCircle size={22} /> Log Out
              </button>

              <button
                onClick={() => setIsLeaveModalOpen(true)}
                className="flex items-center justify-center gap-3 px-6 py-4 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-black rounded-2xl shadow-md hover:shadow-lg transition-all text-base cursor-pointer"
              >
                <CalendarIcon size={22} /> Apply Leave
              </button>
            </div>

            {/* Today's Live Status Banner */}
            <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap justify-between items-center text-xs font-bold text-slate-700 gap-2">
              <div>
                <span>Today ({todayStr}): </span>
                <span className={`px-2 py-0.5 rounded font-black ${
                  todayRecord?.status === 'Present' ? 'bg-emerald-100 text-emerald-700' :
                  todayRecord?.status === 'Leave' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'
                }`}>
                  {todayRecord?.status || 'Not Marked'}
                </span>
              </div>
              <div className="flex gap-4">
                <span>Login: <strong className="text-emerald-700">{todayRecord?.loginTime || '-'}</strong></span>
                <span>Logout: <strong className="text-rose-700">{todayRecord?.logoutTime || '-'}</strong></span>
                <span>Working Hours: <strong className="text-amber-800">{todayRecord?.workingHours || '-'}</strong></span>
              </div>
            </div>
          </div>

          {/* Monthly Calendar View */}
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
            
            {/* Calendar Header with Navigation and Eye Icon */}
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <button 
                  onClick={prevMonth}
                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors cursor-pointer border border-slate-200"
                  title="Previous Month"
                >
                  <ChevronLeft size={20} />
                </button>
                <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-wide">
                  {monthNames[month]} {year}
                </h2>
                <button 
                  onClick={nextMonth}
                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors cursor-pointer border border-slate-200"
                  title="Next Month"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              {/* Monthly History Eye Icon Button */}
              <button
                onClick={() => setIsHistoryModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-xs md:text-sm rounded-xl transition-all shadow-sm cursor-pointer"
                title="View Monthly History Popup"
              >
                <Eye size={18} className="text-amber-700" /> Monthly History
              </button>
            </div>

            {/* Calendar Grid Header (Weekdays) */}
            <div className="grid grid-cols-7 gap-2 text-center font-black text-xs uppercase tracking-wider text-slate-500 mb-2">
              <div className="py-2 text-rose-500 bg-rose-50/50 rounded-lg">Sun</div>
              <div className="py-2 bg-slate-50 rounded-lg">Mon</div>
              <div className="py-2 bg-slate-50 rounded-lg">Tue</div>
              <div className="py-2 bg-slate-50 rounded-lg">Wed</div>
              <div className="py-2 bg-slate-50 rounded-lg">Thu</div>
              <div className="py-2 bg-slate-50 rounded-lg">Fri</div>
              <div className="py-2 text-rose-500 bg-rose-50/50 rounded-lg">Sat</div>
            </div>

            {/* Calendar Cells */}
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((d, idx) => {
                if (d === null) {
                  return <div key={`empty-${idx}`} className="h-20 md:h-24 bg-slate-50/40 rounded-2xl border border-dashed border-slate-150"></div>;
                }

                const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const rec = userAttendanceRecords.find(r => r.date === dayStr);
                const isToday = dayStr === todayStr;

                let bgClasses = "bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-350";
                if (rec?.status === "Present") {
                  // Green for Logged In Present
                  bgClasses = "bg-emerald-500 text-white border-emerald-600 shadow-md";
                } else if (rec?.status === "Leave") {
                  // Red for Leave
                  bgClasses = "bg-rose-500 text-white border-rose-600 shadow-md";
                }

                return (
                  <div
                    key={d}
                    className={`h-20 md:h-24 p-2 rounded-2xl border-2 flex flex-col justify-between transition-all relative ${bgClasses} ${
                      isToday ? "ring-4 ring-amber-400 ring-offset-2 font-black" : ""
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className={`text-xs md:text-sm font-black ${isToday ? "underline decoration-amber-300 decoration-2" : ""}`}>
                        {d}
                      </span>
                      {isToday && (
                        <span className="text-[9px] bg-amber-300 text-amber-950 px-1.5 py-0.5 rounded font-black uppercase">
                          Today
                        </span>
                      )}
                    </div>

                    <div className="text-[10px] font-extrabold truncate">
                      {rec?.status === "Present" && (
                        <div>
                          <div>In: {rec.loginTime}</div>
                          <div>Hrs: {rec.workingHoursNum || rec.workingHours}</div>
                        </div>
                      )}
                      {rec?.status === "Leave" && (
                        <div className="uppercase font-black tracking-wider text-[11px] text-center mt-2">
                          LEAVE
                        </div>
                      )}
                      {!rec && (
                        <div className="opacity-40 text-[9px] italic text-center mt-2">Regular Day</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Calendar Legend */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs font-bold text-slate-600 border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-md bg-emerald-500 inline-block shadow-sm"></span>
                <span>Green = Logged In (Present)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-md bg-rose-500 inline-block shadow-sm"></span>
                <span>Red = Applied Leave</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-md bg-slate-100 border-2 border-slate-300 inline-block"></span>
                <span>Default = Working Day</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-md bg-slate-100 ring-2 ring-amber-400 inline-block"></span>
                <span>Yellow Ring = Today</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ------------------- 2. ADMIN ATTENDANCE PANEL ------------------- */}
      {activeSubTab === 'admin' && isAdminOverride && (
        <div className="space-y-6">
          
          {/* Admin Filters */}
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-wide flex items-center gap-2 border-b border-slate-100 pb-3">
              <Filter className="text-emerald-600" size={22} /> Admin Attendance Panel
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {/* Employee Search */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Search Employee</label>
                <div className="relative">
                  <input
                    type="text"
                    value={adminSearch}
                    onChange={e => setAdminSearch(e.target.value)}
                    placeholder="Enter name..."
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <Search size={14} className="absolute left-2.5 top-3 text-slate-400" />
                </div>
              </div>

              {/* Month Filter */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Filter by Month</label>
                <input
                  type="month"
                  value={adminMonthFilter}
                  onChange={e => setAdminMonthFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Date Filter */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Filter by Date</label>
                <input
                  type="date"
                  value={adminDateFilter}
                  onChange={e => setAdminDateFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Filter Status / Leave</label>
                <select
                  value={adminStatusFilter}
                  onChange={e => setAdminStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="All">All Statuses</option>
                  <option value="Present">Present Only</option>
                  <option value="Leave">Leave Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Admin Attendance Table */}
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-extrabold text-sm text-slate-800">
                All Employee Attendance Records ({adminFilteredRecords.length})
              </h3>
              {(adminSearch || adminDateFilter || adminStatusFilter !== "All") && (
                <button
                  onClick={() => { setAdminSearch(""); setAdminDateFilter(""); setAdminStatusFilter("All"); }}
                  className="text-xs text-rose-600 font-bold hover:underline"
                >
                  Clear Filters
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 uppercase font-black tracking-wider border-b border-slate-200">
                    <th className="p-3">Employee Name</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Login Time</th>
                    <th className="p-3">Logout Time</th>
                    <th className="p-3">Working Hours</th>
                    <th className="p-3">Leave Status</th>
                    <th className="p-3 text-right">Total Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold">
                  {adminFilteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 italic">No attendance records found matching filters.</td>
                    </tr>
                  ) : (
                    adminFilteredRecords.map((r, idx) => (
                      <tr key={r.fireId || r.id || idx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 text-slate-900 font-black flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-black flex items-center justify-center text-xs">
                            {r.employeeName[0]}
                          </div>
                          {r.employeeName}
                        </td>
                        <td className="p-3 text-slate-700">{r.date}</td>
                        <td className="p-3 text-emerald-700 font-extrabold">{r.loginTime}</td>
                        <td className="p-3 text-rose-700 font-extrabold">{r.logoutTime}</td>
                        <td className="p-3 text-amber-900">{r.workingHours}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded font-black text-[10px] ${
                            r.status === "Present" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="p-3 text-right font-black text-slate-900">{r.workingHoursNum || 0} hrs</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SALARY MANAGEMENT SECTION */}
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <DollarSign className="text-emerald-600" size={24} /> Salary Details & Management
                </h2>
                <p className="text-xs text-slate-500 font-bold mt-1">
                  Manage Monthly Salary, Hourly Salary (Optional), and Daily Amount (Special Bonus/Overtime/Adjustments).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {DEFAULT_EMPLOYEES.map((emp) => {
                const sal = employeeSalaries[emp] || { employeeName: emp, monthlySalary: 25000, hourlySalary: 150, dailyAmount: 300 };
                const isEditing = editingSalaryUser === emp;

                return (
                  <div key={emp} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4 hover:shadow-md transition-all">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-sm">
                          {emp[0]}
                        </div>
                        <span className="font-black text-slate-900 text-base">{emp}</span>
                      </div>
                      {!isEditing ? (
                        <button
                          onClick={() => {
                            setEditingSalaryUser(emp);
                            setSalaryForm(sal);
                          }}
                          className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit2 size={13} /> Edit
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSaveSalary(emp)}
                          className="flex items-center gap-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1 rounded-lg transition-colors cursor-pointer shadow-sm"
                        >
                          <Save size={13} /> Save
                        </button>
                      )}
                    </div>

                    {!isEditing ? (
                      <div className="space-y-2 text-xs font-bold text-slate-700">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Monthly Salary:</span>
                          <span className="font-black text-emerald-700 text-sm">₹{(sal.monthlySalary || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Hourly Salary (Optional):</span>
                          <span>{sal.hourlySalary ? `₹${sal.hourlySalary}/hr` : "N/A"}</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200/60 pt-1.5">
                          <span className="text-slate-500">Daily Amount (Bonus/OT):</span>
                          <span className="font-black text-amber-800">₹{sal.dailyAmount || 0}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 text-xs">
                        <div>
                          <label className="block font-bold text-slate-600 mb-1">Monthly Salary (₹)</label>
                          <input
                            type="number"
                            value={salaryForm.monthlySalary || ""}
                            onChange={e => setSalaryForm({ ...salaryForm, monthlySalary: Number(e.target.value) })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-600 mb-1">Hourly Salary (Optional ₹)</label>
                          <input
                            type="number"
                            value={salaryForm.hourlySalary || ""}
                            onChange={e => setSalaryForm({ ...salaryForm, hourlySalary: Number(e.target.value) })}
                            placeholder="Optional"
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-600 mb-1">Daily Amount (Bonus/OT ₹)</label>
                          <input
                            type="number"
                            value={salaryForm.dailyAmount || ""}
                            onChange={e => setSalaryForm({ ...salaryForm, dailyAmount: Number(e.target.value) })}
                            placeholder="Optional"
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        <button
                          onClick={() => setEditingSalaryUser(null)}
                          className="w-full py-1 text-center text-slate-500 hover:text-slate-700 text-xs font-bold"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* ------------------- MODAL: APPLY LEAVE POPUP CALENDAR ------------------- */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <CalendarIcon className="text-amber-600" size={20} /> Select Leave Date
              </h3>
              <button onClick={() => setIsLeaveModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleApplyLeaveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Employee</label>
                <input type="text" readOnly value={selectedUser} className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none text-xs" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Leave Date</label>
                <input
                  type="date"
                  required
                  value={leaveDate}
                  onChange={e => setLeaveDate(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 text-xs cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Remarks / Reason</label>
                <input
                  type="text"
                  value={leaveRemark}
                  onChange={e => setLeaveRemark(e.target.value)}
                  placeholder="e.g. Personal Leave, Sick Leave"
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl shadow-md text-xs cursor-pointer"
                >
                  Submit Leave
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------- MODAL: MONTHLY HISTORY POPUP (EYE ICON CLICK) ------------------- */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            
            {/* Header */}
            <div className="p-6 bg-amber-600 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xl font-black flex items-center gap-2">
                  <Eye size={22} /> Monthly Attendance History
                </h3>
                <p className="text-xs font-bold opacity-90 mt-0.5">
                  Employee: {selectedUser} | Period: {monthNames[month]} {year}
                </p>
              </div>
              <button 
                onClick={() => setIsHistoryModalOpen(false)} 
                className="p-1.5 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
              >
                <X size={24} />
              </button>
            </div>

            {/* Attendance Table */}
            <div className="flex-1 overflow-y-auto p-6">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 uppercase font-black border-b border-slate-200">
                    <th className="p-3">Date</th>
                    <th className="p-3">Login Time</th>
                    <th className="p-3">Logout Time</th>
                    <th className="p-3">Working Hours</th>
                    <th className="p-3">Leave Status</th>
                    <th className="p-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold">
                  {currentMonthRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                        No attendance records for {monthNames[month]} {year}.
                      </td>
                    </tr>
                  ) : (
                    currentMonthRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-amber-50/50 transition-colors">
                        <td className="p-3 text-slate-900 font-black">{rec.date}</td>
                        <td className="p-3 text-emerald-700">{rec.loginTime}</td>
                        <td className="p-3 text-rose-700">{rec.logoutTime}</td>
                        <td className="p-3 text-amber-900 font-black">{rec.workingHours}</td>
                        <td className="p-3">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                            rec.status === "Present" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-rose-100 text-rose-800 border border-rose-200"
                          }`}>
                            {rec.status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{rec.remarks}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Summary Stats */}
            <div className="p-5 bg-slate-100 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0 text-center font-black">
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs text-slate-500 uppercase block mb-1">Total Working Hours</span>
                <span className="text-xl text-amber-800">{monthlyStats.totalHours} hrs</span>
              </div>
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs text-slate-500 uppercase block mb-1">Total Present Days</span>
                <span className="text-xl text-emerald-700">{monthlyStats.presentDays} Days</span>
              </div>
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs text-slate-500 uppercase block mb-1">Total Leave Days</span>
                <span className="text-xl text-rose-700">{monthlyStats.leaveDays} Days</span>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
