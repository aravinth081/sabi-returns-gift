import React, { useState, useEffect, useMemo } from "react";
import { 
  Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, Eye, User, 
  Search, Filter, CheckCircle2, XCircle, AlertCircle, Plus, Edit2, Save, X, DollarSign, Briefcase, FileText, Image as ImageIcon
} from "lucide-react";
import { toast } from "sonner";
import { db } from "@/firebase";
import { collection, onSnapshot, addDoc, updateDoc, doc, setDoc, deleteDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

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
  status: "Present" | "Leave" | "Half Day" | "Late Attendance";
  remarks: string;
}

export interface EmployeeSalary {
  employeeName: string;
  monthlySalary: number;
  hourlySalary?: number;
  dailyAmount?: number; // for Special Bonus, Overtime, Manual Adjustments
}

// Normalize employee name for robust matching (e.g. Gayathri.s, Gayathri S, Gayathri, kavi, kavilaya)
export const normalizeEmpName = (name: string) => {
  if (!name) return "";
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
};

export const isSameEmployee = (name1: string, name2: string) => {
  if (!name1 || !name2) return false;
  const n1 = normalizeEmpName(name1);
  const n2 = normalizeEmpName(name2);
  if (!n1 || !n2) return false;
  if (n1 === n2) return true;
  if (n1.startsWith(n2) || n2.startsWith(n1)) return true;
  if (n1.includes(n2) || n2.includes(n1)) return true;
  if (n1.length >= 5 && n2.length >= 5 && n1.slice(0, 5) === n2.slice(0, 5)) return true;
  return false;
};



export default function AttendanceLog({ isAdminOverride = true, onWallpaperChange }: { isAdminOverride?: boolean; onWallpaperChange?: () => void }) {
  const { profile } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'employee' | 'admin'>('employee');
  const activeUser = localStorage.getItem('loggedInName') || profile?.username || "";
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
    toast.success("Attendance Log wallpaper reset!");
    if (onWallpaperChange) onWallpaperChange();
  };

  // Employee State
  const [selectedUser, setSelectedUser] = useState(currentLoggedInUser);
  const [employeeOptions, setEmployeeOptions] = useState<string[]>(currentLoggedInUser ? [currentLoggedInUser] : []);

  // Sync selectedUser if currentLoggedInUser changes
  useEffect(() => {
    if (currentLoggedInUser) {
      setSelectedUser(currentLoggedInUser);
    }
  }, [currentLoggedInUser]);

  // Date Navigation State for Monthly Calendar
  const todayObj = new Date();
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];

  // Attendance Records State
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [employeeSalaries, setEmployeeSalaries] = useState<Record<string, EmployeeSalary>>({});

  // Modals & Forms State
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [selectedDateAction, setSelectedDateAction] = useState<{ dayStr: string; displayDate: string } | null>(null);
  const [leaveEmployee, setLeaveEmployee] = useState(selectedUser);
  const [leaveDate, setLeaveDate] = useState("");
  const [leaveRemark, setLeaveRemark] = useState("");

  useEffect(() => {
    setLeaveEmployee(selectedUser);
  }, [selectedUser, isLeaveModalOpen]);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [editingSalaryUser, setEditingSalaryUser] = useState<string | null>(null);
  const [salaryForm, setSalaryForm] = useState<EmployeeSalary>({ employeeName: "", monthlySalary: 0, hourlySalary: 0, dailyAmount: 0 });

  // Admin Search & Filter States
  const [adminSearch, setAdminSearch] = useState("");
  const [adminMonthFilter, setAdminMonthFilter] = useState(`${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}`);
  const [adminDateFilter, setAdminDateFilter] = useState("");
  const [adminStatusFilter, setAdminStatusFilter] = useState<string>("All");
  const [adminDuplicateFilter, setAdminDuplicateFilter] = useState<string>("All");

  // Fetch Attendance Records from Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "attendance"), (snap) => {
      const records: AttendanceRecord[] = [];
      snap.forEach(docSnap => {
        records.push({ fireId: docSnap.id, ...docSnap.data() } as AttendanceRecord);
      });
      setAttendanceRecords(records);
    }, (error) => {
      console.log("Firestore attendance snapshot error or offline mode", error);
    });
    return () => unsub();
  }, []);

  // Fetch Employee Salaries from Firestore & localStorage fallback
  useEffect(() => {
    const localSaved = localStorage.getItem('sabi_employee_salaries');
    if (localSaved) {
      try {
        setEmployeeSalaries(JSON.parse(localSaved));
      } catch (e) {}
    }

    const unsub = onSnapshot(collection(db, "employee_salaries"), (snap) => {
      const salaries: Record<string, EmployeeSalary> = {};
      snap.forEach(docSnap => {
        salaries[docSnap.id] = docSnap.data() as EmployeeSalary;
      });
      if (Object.keys(salaries).length > 0) {
        setEmployeeSalaries(prev => {
          const next = { ...prev, ...salaries };
          localStorage.setItem('sabi_employee_salaries', JSON.stringify(next));
          return next;
        });
      }
    }, (error) => {
      console.log("Firestore salary snapshot error", error);
    });
    return () => unsub();
  }, []);

  // Fetch Approved Employees from Firestore collection("employees")
  const [approvedEmployees, setApprovedEmployees] = useState<string[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "employees"), (snap) => {
      const namesSet = new Set<string>();
      snap.forEach(docSnap => {
        const data = docSnap.data();
        // Only include registered employees approved by Admin (status === 'Approved')
        if (data.status === "Approved") {
          const empName = (data.username || data.name || data.employeeName || "").trim();
          const lower = empName.toLowerCase();
          if (empName && !lower.includes("hello") && !lower.includes("test")) {
            namesSet.add(empName);
          }
        }
      });
      const namesList = Array.from(namesSet);
      setApprovedEmployees(namesList);
    }, (error) => {
      console.log("Firestore employees snapshot error", error);
    });
    return () => unsub();
  }, []);

  // Sync employeeOptions with approved employees AND employees from attendance records
  useEffect(() => {
    const namesSet = new Set<string>();
    
    // Add approved employees
    approvedEmployees.forEach(emp => {
      if (emp) namesSet.add(emp);
    });

    // Add employees from existing attendance records
    attendanceRecords.forEach(rec => {
      if (rec.employeeName && !rec.employeeName.toLowerCase().includes("hello") && !rec.employeeName.toLowerCase().includes("test")) {
        const existing = Array.from(namesSet).find(e => isSameEmployee(e, rec.employeeName));
        if (!existing) {
          namesSet.add(rec.employeeName);
        }
      }
    });

    if (currentLoggedInUser) {
      const existing = Array.from(namesSet).find(e => isSameEmployee(e, currentLoggedInUser));
      if (!existing) {
        namesSet.add(currentLoggedInUser);
      }
    }

    const allOptions = Array.from(namesSet);
    if (allOptions.length > 0) {
      setEmployeeOptions(allOptions);
      const match = allOptions.find(emp => isSameEmployee(emp, selectedUser || currentLoggedInUser));
      if (match && match !== selectedUser) {
        setSelectedUser(match);
      }
    }
  }, [approvedEmployees, attendanceRecords, currentLoggedInUser]);

  // Filter attendance records for current selected employee
  const userAttendanceRecords = useMemo(() => {
    return attendanceRecords.filter(r => isSameEmployee(r.employeeName, selectedUser));
  }, [attendanceRecords, selectedUser]);

  // Today's date string YYYY-MM-DD
  const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

  // Yesterday's date string YYYY-MM-DD
  const yesterdayObj = new Date(todayObj);
  yesterdayObj.setDate(todayObj.getDate() - 1);
  const yesterdayStr = `${yesterdayObj.getFullYear()}-${String(yesterdayObj.getMonth() + 1).padStart(2, '0')}-${String(yesterdayObj.getDate()).padStart(2, '0')}`;

  // Today's record for selected employee
  const todayRecord = useMemo(() => {
    return userAttendanceRecords.find(r => r.date === todayStr);
  }, [userAttendanceRecords, todayStr]);

  // Yesterday's record for selected employee
  const yesterdayRecord = useMemo(() => {
    return userAttendanceRecords.find(r => r.date === yesterdayStr);
  }, [userAttendanceRecords, yesterdayStr]);

  // Navigate Months
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // --- ATTENDANCE ACTIONS ---

  // Handle Date Actions from Calendar Click
  const handleActionMarkLate = async (targetDate: string) => {
    if (targetDate > todayStr) {
      toast.error("Cannot mark attendance for future date: This is tomorrow's / future attendance!", {
        style: {
          backgroundColor: '#991b1b',
          color: '#ffffff',
          border: '2px solid #f87171',
          fontWeight: '900',
          fontSize: '13px',
          boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.5)'
        },
        duration: 4000
      });
      return;
    }
    const existing = userAttendanceRecords.find(r => r.date === targetDate);
    const newRecord: AttendanceRecord = {
      id: existing?.id || String(Date.now()),
      fireId: existing?.fireId,
      employeeName: selectedUser,
      date: targetDate,
      loginTime: "10:30 AM",
      logoutTime: "06:00 PM",
      workingHours: "7.5 hrs",
      workingHoursNum: 7.5,
      status: "Late Attendance",
      remarks: "Late Attendance Marked"
    };

    const updated = [
      ...attendanceRecords.filter(r => !(isSameEmployee(r.employeeName, selectedUser) && r.date === targetDate)),
      newRecord
    ];
    setAttendanceRecords(updated);
    setSelectedDateAction(null);
    toast.success(`Marked Late Attendance for ${selectedUser} on ${targetDate}!`);

    try {
      if (existing?.fireId) {
        await updateDoc(doc(db, "attendance", existing.fireId), newRecord as any);
      } else {
        await addDoc(collection(db, "attendance"), newRecord);
      }
    } catch (e) {
      console.log("Offline mode");
    }
  };

  const handleActionApplyLeave = async (targetDate: string) => {
    if (targetDate > todayStr) {
      toast.error("Cannot mark attendance for future date: This is tomorrow's / future attendance!", {
        style: {
          backgroundColor: '#991b1b',
          color: '#ffffff',
          border: '2px solid #f87171',
          fontWeight: '900',
          fontSize: '13px',
          boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.5)'
        },
        duration: 4000
      });
      return;
    }
    const existing = userAttendanceRecords.find(r => r.date === targetDate);
    const newRecord: AttendanceRecord = {
      id: existing?.id || String(Date.now()),
      fireId: existing?.fireId,
      employeeName: selectedUser,
      date: targetDate,
      loginTime: "-",
      logoutTime: "-",
      workingHours: "0 hrs",
      workingHoursNum: 0,
      status: "Leave",
      remarks: "Leave Applied"
    };

    const updated = [
      ...attendanceRecords.filter(r => !(isSameEmployee(r.employeeName, selectedUser) && r.date === targetDate)),
      newRecord
    ];
    setAttendanceRecords(updated);
    setSelectedDateAction(null);
    toast.success(`Applied Leave for ${selectedUser} on ${targetDate}!`);

    try {
      if (existing?.fireId) {
        await updateDoc(doc(db, "attendance", existing.fireId), newRecord as any);
      } else {
        await addDoc(collection(db, "attendance"), newRecord);
      }
    } catch (e) {
      console.log("Offline mode");
    }
  };

  const handleActionUnmark = async (targetDate: string) => {
    const existing = userAttendanceRecords.find(r => r.date === targetDate);
    const updated = attendanceRecords.filter(r => !(isSameEmployee(r.employeeName, selectedUser) && r.date === targetDate));
    setAttendanceRecords(updated);
    setSelectedDateAction(null);
    toast.success(`Unmarked attendance for ${selectedUser} on ${targetDate}!`);

    try {
      if (existing?.fireId) {
        await deleteDoc(doc(db, "attendance", existing.fireId));
      }
    } catch (e) {
      console.log("Offline mode");
    }
  };

  const handleActionMarkPresent = async (targetDate: string) => {
    const existing = userAttendanceRecords.find(r => r.date === targetDate);
    const newRecord: AttendanceRecord = {
      id: existing?.id || String(Date.now()),
      fireId: existing?.fireId,
      employeeName: selectedUser,
      date: targetDate,
      loginTime: "09:00 AM",
      logoutTime: "06:00 PM",
      workingHours: "9 hrs",
      workingHoursNum: 9,
      status: "Present",
      remarks: "Marked Present"
    };

    const updated = [
      ...attendanceRecords.filter(r => !(isSameEmployee(r.employeeName, selectedUser) && r.date === targetDate)),
      newRecord
    ];
    setAttendanceRecords(updated);
    setSelectedDateAction(null);
    toast.success(`Marked Present for ${selectedUser} on ${targetDate}!`);

    try {
      if (existing?.fireId) {
        await updateDoc(doc(db, "attendance", existing.fireId), newRecord as any);
      } else {
        await addDoc(collection(db, "attendance"), newRecord);
      }
    } catch (e) {
      console.log("Offline mode");
    }
  };

  const proceedTodayLogin = async () => {
    const now = new Date();
    const loginTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    const newRecord: AttendanceRecord = {
      id: String(Date.now()),
      employeeName: selectedUser,
      date: todayStr,
      loginTime: loginTimeStr,
      logoutTime: "-",
      workingHours: "In Progress",
      workingHoursNum: 0,
      status: "Present",
      remarks: "Logged In"
    };

    const updated = [...attendanceRecords.filter(r => !(isSameEmployee(r.employeeName, selectedUser) && r.date === todayStr)), newRecord];
    setAttendanceRecords(updated);
    toast.success(`Logged In successfully at ${loginTimeStr}! Marked as Present.`);

    try {
      await addDoc(collection(db, "attendance"), newRecord);
    } catch (e) {
      console.log("Offline mode, saved locally");
    }
  };

  const handleLogIn = async () => {
    if (todayRecord) {
      if (todayRecord.status === "Leave") {
        toast.error("Cannot Log In today: Leave is already applied for today.");
        return;
      }
      if (todayRecord.loginTime !== "-") {
        toast.info(`Already logged in today at ${todayRecord.loginTime}`);
        return;
      }
    }

    await proceedTodayLogin();
  };

  const handleLogOut = async () => {
    if (!todayRecord || todayRecord.status !== "Present" || todayRecord.loginTime === "-") {
      toast.error("You must Log In first before logging out!");
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
      (isSameEmployee(r.employeeName, selectedUser) && r.date === todayStr) ? updatedRecord : r
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

    const targetUser = leaveEmployee.trim() || selectedUser;

    // Check if record exists
    const existing = attendanceRecords.find(r => isSameEmployee(r.employeeName, targetUser) && r.date === leaveDate);
    if (existing && existing.status === "Present") {
      toast.error(`Cannot apply leave: Already logged in as Present on ${leaveDate}`);
      return;
    }

    const leaveRecord: AttendanceRecord = {
      id: String(Date.now()),
      employeeName: targetUser,
      date: leaveDate,
      loginTime: "-",
      logoutTime: "-",
      workingHours: "0 hrs",
      workingHoursNum: 0,
      status: "Leave",
      remarks: leaveRemark || "Leave Applied"
    };

    const updated = [...attendanceRecords.filter(r => !(isSameEmployee(r.employeeName, targetUser) && r.date === leaveDate)), leaveRecord];
    setAttendanceRecords(updated);
    setIsLeaveModalOpen(false);
    toast.success(`Leave applied for ${targetUser} on ${leaveDate}! Date marked in Red.`);

    try {
      await addDoc(collection(db, "attendance"), leaveRecord);
    } catch (e) {
      console.log("Offline mode");
    }
  };

  // Salary Edit & Save
  const handleSaveSalary = async (employeeName: string) => {
    const updatedSalary: EmployeeSalary = {
      employeeName,
      monthlySalary: salaryForm.monthlySalary || 0,
      hourlySalary: salaryForm.hourlySalary || 0,
      dailyAmount: salaryForm.dailyAmount || 0
    };

    setEmployeeSalaries(prev => {
      const next = { ...prev, [employeeName]: updatedSalary };
      localStorage.setItem('sabi_employee_salaries', JSON.stringify(next));
      return next;
    });

    toast.success(`Salary updated immediately for ${employeeName}`);
    setEditingSalaryUser(null);

    try {
      await setDoc(doc(db, "employee_salaries", employeeName), updatedSalary);
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

  const duplicateAttendanceMap = useMemo(() => {
    const map = new Map<string, number>();
    attendanceRecords.forEach(r => {
      const key = `${normalizeEmpName(r.employeeName)}_${r.date}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [attendanceRecords]);

  // Admin filtered records with duplicate filter and chronological date sorting
  const adminFilteredRecords = useMemo(() => {
    return attendanceRecords.filter(r => {
      const searchLower = adminSearch.trim().toLowerCase();
      const matchesSearch = !searchLower || 
        r.employeeName.toLowerCase().includes(searchLower) ||
        (r.remarks && r.remarks.toLowerCase().includes(searchLower)) ||
        r.status.toLowerCase().includes(searchLower);

      // If specific date filter is selected, ignore month filter conflict
      const matchesDate = !adminDateFilter || r.date === adminDateFilter;
      const matchesMonth = adminDateFilter ? true : (!adminMonthFilter || r.date.startsWith(adminMonthFilter));
      
      const matchesStatus = adminStatusFilter === "All" || r.status === adminStatusFilter;

      const dupKey = `${normalizeEmpName(r.employeeName)}_${r.date}`;
      const isDup = (duplicateAttendanceMap.get(dupKey) || 0) > 1;
      const matchesDuplicate = 
        adminDuplicateFilter === "All" ||
        (adminDuplicateFilter === "Duplicates Only" && isDup) ||
        (adminDuplicateFilter === "Unique Only" && !isDup);

      return matchesSearch && matchesDate && matchesMonth && matchesStatus && matchesDuplicate;
    }).sort((a, b) => {
      const dateComp = b.date.localeCompare(a.date);
      if (dateComp !== 0) return dateComp;
      return a.employeeName.localeCompare(b.employeeName);
    });
  }, [attendanceRecords, adminSearch, adminMonthFilter, adminDateFilter, adminStatusFilter, adminDuplicateFilter, duplicateAttendanceMap]);

  return (
    <div className="space-y-6 font-sans text-white pb-12">
      {/* Top Section Header & Sub-Tab Switcher */}
      <div style={{ backgroundColor: '#131c2e' }} className="bg-[#131c2e] p-5 md:p-6 rounded-3xl shadow-2xl border border-white/15 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-white">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-amber-400 uppercase tracking-wider flex items-center gap-3">
            <CalendarIcon className="text-amber-400" size={32} /> Attendance Log
          </h1>
          <p className="text-xs md:text-sm font-extrabold text-slate-300 mt-1">
            Employee Attendance & Permanent Log Tracking System
          </p>
        </div>

        {/* View Switcher: Employee View vs Admin Attendance Panel & Wallpaper Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-[#090e1a] p-1.5 rounded-2xl border border-white/10 shadow-inner self-stretch md:self-auto justify-center">
            <button
              onClick={() => setActiveSubTab('employee')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-black transition-all cursor-pointer ${
                activeSubTab === 'employee'
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-lg hover:scale-105'
                  : 'text-slate-300 hover:text-white hover:bg-white/10 font-extrabold'
              }`}
            >
              <User size={16} /> Employee View
            </button>
            {isAdminOverride && (
              <button
                onClick={() => setActiveSubTab('admin')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-black transition-all cursor-pointer ${
                  activeSubTab === 'admin'
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg hover:scale-105'
                    : 'text-slate-300 hover:text-white hover:bg-white/10 font-extrabold'
                }`}
              >
                <Briefcase size={16} /> Admin Attendance & Salary
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => document.getElementById('attendance-wallpaper-upload')?.click()}
              className="flex justify-center items-center w-10 h-10 font-black rounded-xl transition-all border border-white/20 bg-[#162035] text-amber-400 hover:bg-[#1f2b45] cursor-pointer shadow-sm"
              title="Set Background Wallpaper"
            >
              <ImageIcon size={18} className="text-amber-400" />
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
                className="px-3 py-2 text-xs font-black text-rose-400 bg-rose-950/60 hover:bg-rose-900/80 rounded-xl border border-rose-500/30 cursor-pointer transition-colors shadow-sm"
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
          <div style={{ backgroundColor: '#131c2e' }} className="bg-[#131c2e] border border-amber-500/30 p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs font-extrabold text-slate-200 shadow-md">
            <div className="flex items-center gap-2">
              <User size={16} className="text-amber-400" />
              <span className="text-slate-300 font-extrabold">Logged In User:</span>
              <span className="bg-amber-400 text-black px-3 py-0.5 rounded-lg text-sm font-black shadow-sm">{selectedUser}</span>
            </div>
            {isAdminOverride && (
              <div className="flex items-center gap-2">
                <span className="text-slate-300 font-extrabold">Switch Employee View:</span>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  style={{ backgroundColor: '#162035', color: '#fbbf24' }}
                  className="bg-[#162035] border border-white/20 rounded-xl px-3 py-1 text-xs font-black text-amber-400 outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer shadow-inner"
                >
                  {employeeOptions.map(emp => (
                    <option key={emp} value={emp}>{emp}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Mark Attendance Section */}
          <div style={{ backgroundColor: '#131c2e' }} className="bg-[#131c2e] p-6 rounded-3xl shadow-xl border border-white/15 text-white">
            <h2 className="text-xl font-black text-amber-400 uppercase tracking-wide mb-4 flex items-center gap-2 border-b border-white/10 pb-3">
              <Clock className="text-amber-400" size={22} /> Mark Attendance
            </h2>

            {/* Three Primary Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                onClick={handleLogIn}
                className="flex items-center justify-center gap-3 px-6 py-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black rounded-2xl shadow-lg hover:shadow-emerald-500/20 transition-all text-base cursor-pointer"
              >
                <CheckCircle2 size={22} /> Log In
              </button>

              <button
                onClick={handleLogOut}
                className="flex items-center justify-center gap-3 px-6 py-4 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-black rounded-2xl shadow-lg hover:shadow-rose-500/20 transition-all text-base cursor-pointer"
              >
                <XCircle size={22} /> Log Out
              </button>

              <button
                onClick={() => setIsLeaveModalOpen(true)}
                className="flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-95 text-black font-black rounded-2xl shadow-lg hover:shadow-amber-500/20 transition-all text-base cursor-pointer"
              >
                <CalendarIcon size={22} /> Apply Leave
              </button>
            </div>

            {/* Today's Live Status Banner */}
            <div className="mt-5 p-3.5 bg-[#0c1427] rounded-2xl border border-white/10 flex flex-wrap justify-between items-center text-xs font-extrabold text-slate-300 gap-2 shadow-inner">
              <div>
                <span>Today ({todayStr}): </span>
                <span className={`px-2.5 py-0.5 rounded-md font-black ${
                  todayRecord?.status === 'Present' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                  todayRecord?.status === 'Leave' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-slate-700/60 text-slate-300 border border-white/10'
                }`}>
                  {todayRecord?.status || 'Not Marked'}
                </span>
              </div>
              <div className="flex gap-4">
                <span>Login: <strong className="text-emerald-400 font-mono font-black">{todayRecord?.loginTime || '-'}</strong></span>
                <span>Logout: <strong className="text-rose-400 font-mono font-black">{todayRecord?.logoutTime || '-'}</strong></span>
                <span>Working Hours: <strong className="text-amber-300 font-mono font-black">{todayRecord?.workingHours || '-'}</strong></span>
              </div>
            </div>
          </div>

          {/* Monthly Calendar View */}
          <div style={{ backgroundColor: '#131c2e' }} className="bg-[#131c2e] p-6 rounded-3xl shadow-xl border border-white/15 text-white">
            
            {/* Calendar Header with Navigation and Eye Icon */}
            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <button 
                  onClick={prevMonth}
                  className="p-2 hover:bg-[#1f2b45] bg-[#162035] rounded-xl text-amber-400 transition-colors cursor-pointer border border-white/15 shadow-sm"
                  title="Previous Month"
                >
                  <ChevronLeft size={20} />
                </button>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-wide">
                  {monthNames[month]} {year}
                </h2>
                <button 
                  onClick={nextMonth}
                  className="p-2 hover:bg-[#1f2b45] bg-[#162035] rounded-xl text-amber-400 transition-colors cursor-pointer border border-white/15 shadow-sm"
                  title="Next Month"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              {/* Monthly History Eye Icon Button */}
              <button
                onClick={() => setIsHistoryModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black font-black text-xs md:text-sm rounded-xl transition-all shadow-md hover:scale-105 cursor-pointer"
                title="View Monthly History Popup"
              >
                <Eye size={18} className="text-black" /> Monthly History
              </button>
            </div>

            {/* Calendar Grid Header (Weekdays) */}
            <div className="grid grid-cols-7 gap-2 text-center font-black text-xs uppercase tracking-wider mb-3">
              <div className="py-2.5 text-rose-400 bg-rose-950/40 border border-rose-500/30 rounded-xl">Sun</div>
              <div className="py-2.5 text-amber-300 bg-[#162035] border border-white/10 rounded-xl">Mon</div>
              <div className="py-2.5 text-amber-300 bg-[#162035] border border-white/10 rounded-xl">Tue</div>
              <div className="py-2.5 text-amber-300 bg-[#162035] border border-white/10 rounded-xl">Wed</div>
              <div className="py-2.5 text-amber-300 bg-[#162035] border border-white/10 rounded-xl">Thu</div>
              <div className="py-2.5 text-amber-300 bg-[#162035] border border-white/10 rounded-xl">Fri</div>
              <div className="py-2.5 text-rose-400 bg-rose-950/40 border border-rose-500/30 rounded-xl">Sat</div>
            </div>

            {/* Calendar Cells */}
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((d, idx) => {
                if (d === null) {
                  return <div key={`empty-${idx}`} className="h-20 md:h-24 bg-[#0c1427]/40 rounded-2xl border border-dashed border-white/10"></div>;
                }

                const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const rec = userAttendanceRecords.find(r => r.date === dayStr);
                const isToday = dayStr === todayStr;
                const isFuture = dayStr > todayStr;

                let bgClasses = "bg-[#0f172a] border-white/15 text-white hover:border-amber-400 cursor-pointer shadow-sm hover:scale-[1.02]";
                if (isFuture) {
                  bgClasses = "bg-[#0a0f1d] border-white/10 text-slate-400 cursor-pointer hover:border-rose-500/50 shadow-sm";
                } else if (rec?.status === "Present") {
                  bgClasses = "bg-emerald-600 text-white border-emerald-400 shadow-lg cursor-pointer hover:scale-[1.02]";
                } else if (rec?.status === "Late Attendance") {
                  bgClasses = "bg-amber-600 text-white border-amber-400 shadow-lg cursor-pointer hover:scale-[1.02]";
                } else if (rec?.status === "Leave") {
                  bgClasses = "bg-rose-600 text-white border-rose-400 shadow-lg cursor-pointer hover:scale-[1.02]";
                } else if (rec?.status === "Half Day") {
                  bgClasses = "bg-cyan-600 text-white border-cyan-400 shadow-lg cursor-pointer hover:scale-[1.02]";
                }

                return (
                  <div
                    key={d}
                    onClick={() => {
                      if (isFuture) {
                        toast.error("Cannot mark attendance for future date: This is tomorrow's / future attendance!", {
                          style: {
                            backgroundColor: '#991b1b',
                            color: '#ffffff',
                            border: '2px solid #f87171',
                            fontWeight: '900',
                            fontSize: '13px',
                            boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.5)'
                          },
                          duration: 4000
                        });
                        return;
                      }
                      setSelectedDateAction({
                        dayStr,
                        displayDate: `${d} ${monthNames[month]} ${year}`
                      });
                    }}
                    className={`h-20 md:h-24 p-2 rounded-2xl border-2 flex flex-col justify-between transition-all relative group ${bgClasses} ${
                      isToday ? "ring-4 ring-amber-400 ring-offset-2 ring-offset-[#131c2e] font-black" : ""
                    }`}
                    title={isFuture ? "Tomorrow's / Future Attendance" : `Click to manage attendance for ${d} ${monthNames[month]} ${year}`}
                  >
                    <div className="flex justify-between items-start">
                      <span className={`text-xs md:text-sm font-black ${isToday ? "text-amber-300 underline decoration-amber-400 decoration-2" : isFuture ? "text-slate-400" : "text-white"}`}>
                        {d}
                      </span>
                      {isToday && (
                        <span className="text-[9px] bg-amber-400 text-black px-1.5 py-0.5 rounded font-black uppercase shadow-sm">
                          Today
                        </span>
                      )}
                    </div>

                    <div className="text-[10px] font-extrabold truncate">
                      {rec?.status === "Present" && (
                        <div className="text-emerald-100">
                          <div>In: {rec.loginTime}</div>
                          <div>Hrs: {rec.workingHoursNum || rec.workingHours}</div>
                        </div>
                      )}
                      {rec?.status === "Late Attendance" && (
                        <div className="text-amber-100">
                          <div className="font-black text-[11px] uppercase tracking-wide">LATE</div>
                          <div>In: {rec.loginTime || "10:30 AM"}</div>
                        </div>
                      )}
                      {rec?.status === "Leave" && (
                        <div className="uppercase font-black tracking-wider text-[11px] text-center text-rose-100 mt-2">
                          LEAVE
                        </div>
                      )}
                      {rec?.status === "Half Day" && (
                        <div className="uppercase font-black tracking-wider text-[11px] text-center text-cyan-100 mt-2">
                          HALF DAY
                        </div>
                      )}
                      {!rec && (
                        <div className={`font-extrabold text-[10px] text-center mt-2 tracking-wide uppercase ${isFuture ? 'text-slate-400 group-hover:text-rose-400' : 'text-slate-300 group-hover:text-amber-300'}`}>Click to Mark</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Calendar Legend */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs font-extrabold text-slate-300 border-t border-white/10 pt-4">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-md bg-emerald-500 inline-block shadow-sm"></span>
                <span>Green = Logged In (Present)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-md bg-amber-500 inline-block shadow-sm"></span>
                <span>Orange = Late Attendance</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-md bg-rose-500 inline-block shadow-sm"></span>
                <span>Red = Applied Leave</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-md bg-[#0f172a] border border-white/30 inline-block"></span>
                <span className="text-white">Default = Working Day (Click to Mark)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-md bg-[#0f172a] ring-2 ring-amber-400 inline-block"></span>
                <span className="text-amber-300">Yellow Ring = Today</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ------------------- 2. ADMIN ATTENDANCE PANEL ------------------- */}
      {activeSubTab === 'admin' && isAdminOverride && (
        <div className="space-y-6">
          
          {/* Admin Filters */}
          <div style={{ backgroundColor: '#131c2e' }} className="bg-[#131c2e] p-6 rounded-3xl shadow-xl border border-white/15 text-white space-y-4">
            <h2 className="text-xl font-black text-amber-400 uppercase tracking-wide flex items-center gap-2 border-b border-white/10 pb-3">
              <Filter className="text-amber-400" size={22} /> Admin Attendance Panel
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
              {/* Filter by Employee Dropdown */}
              <div>
                <label className="block text-xs font-extrabold text-slate-300 uppercase tracking-wider mb-1">Filter by Employee</label>
                <select
                  value={adminSearch}
                  onChange={e => setAdminSearch(e.target.value)}
                  style={{ backgroundColor: '#162035', color: '#fbbf24' }}
                  className="w-full px-3 py-2 border border-white/20 rounded-xl text-xs font-extrabold text-amber-400 bg-[#162035] outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="">All Employees</option>
                  {employeeOptions.map(emp => (
                    <option key={emp} value={emp}>{emp}</option>
                  ))}
                </select>
              </div>

              {/* Month Filter */}
              <div>
                <label className="block text-xs font-extrabold text-slate-300 uppercase tracking-wider mb-1">Filter by Month</label>
                <input
                  type="month"
                  value={adminMonthFilter}
                  onChange={e => setAdminMonthFilter(e.target.value)}
                  style={{ backgroundColor: '#162035', color: '#ffffff' }}
                  className="w-full px-3 py-2 border border-white/20 rounded-xl text-xs font-bold text-white outline-none focus:border-amber-400 cursor-pointer"
                />
              </div>

              {/* Date Filter */}
              <div>
                <label className="block text-xs font-extrabold text-slate-300 uppercase tracking-wider mb-1">Filter by Date</label>
                <input
                  type="date"
                  value={adminDateFilter}
                  onChange={e => setAdminDateFilter(e.target.value)}
                  style={{ backgroundColor: '#162035', color: '#ffffff' }}
                  className="w-full px-3 py-2 border border-white/20 rounded-xl text-xs font-bold text-white outline-none focus:border-amber-400 cursor-pointer"
                />
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-xs font-extrabold text-slate-300 uppercase tracking-wider mb-1">Filter Status / Leave</label>
                <select
                  value={adminStatusFilter}
                  onChange={e => setAdminStatusFilter(e.target.value)}
                  style={{ backgroundColor: '#162035', color: '#fbbf24' }}
                  className="w-full px-3 py-2 border border-white/20 rounded-xl text-xs font-extrabold text-amber-400 bg-[#162035] outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="All">All Statuses</option>
                  <option value="Present">Present Only</option>
                  <option value="Leave">Leave Only</option>
                </select>
              </div>

              {/* Duplicate Filter */}
              <div>
                <label className="block text-xs font-extrabold text-slate-300 uppercase tracking-wider mb-1">Duplicate Filter</label>
                <select
                  value={adminDuplicateFilter}
                  onChange={e => setAdminDuplicateFilter(e.target.value)}
                  style={{ backgroundColor: '#162035', color: '#fbbf24' }}
                  className="w-full px-3 py-2 border border-white/20 rounded-xl text-xs font-extrabold text-amber-400 bg-[#162035] outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="All">All Records</option>
                  <option value="Duplicates Only">Duplicates Only</option>
                  <option value="Unique Only">Unique Records Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Admin Attendance Table */}
          <div style={{ backgroundColor: '#131c2e' }} className="bg-[#131c2e] rounded-3xl shadow-xl border border-white/15 overflow-hidden text-white">
            <div className="p-4 bg-[#090e1a] border-b border-white/10 flex justify-between items-center">
              <h3 className="font-black text-sm text-amber-400 uppercase tracking-wider">
                All Employee Attendance Records ({adminFilteredRecords.length})
              </h3>
              {(adminSearch || adminDateFilter || adminMonthFilter || adminStatusFilter !== "All" || adminDuplicateFilter !== "All") && (
                <button
                  onClick={() => { setAdminSearch(""); setAdminDateFilter(""); setAdminMonthFilter(""); setAdminStatusFilter("All"); setAdminDuplicateFilter("All"); }}
                  className="text-xs text-rose-400 font-extrabold hover:underline cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[420px] custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10">
                  <tr style={{ backgroundColor: '#162035' }} className="bg-[#162035] text-amber-400 uppercase font-black tracking-wider border-b border-amber-500/30 shadow-sm">
                    <th className="p-3.5 border-r border-white/10 bg-[#162035]">Employee Name</th>
                    <th className="p-3.5 border-r border-white/10 bg-[#162035]">Date</th>
                    <th className="p-3.5 border-r border-white/10 bg-[#162035]">Login Time</th>
                    <th className="p-3.5 border-r border-white/10 bg-[#162035]">Logout Time</th>
                    <th className="p-3.5 border-r border-white/10 bg-[#162035]">Working Hours</th>
                    <th className="p-3.5 border-r border-white/10 bg-[#162035]">Leave Status</th>
                    <th className="p-3.5 text-right bg-[#162035]">Total Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {adminFilteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-amber-400 font-extrabold italic">No attendance records found matching filters.</td>
                    </tr>
                  ) : (
                    adminFilteredRecords.map((r, idx) => (
                      <tr key={r.fireId || r.id || idx} className={`border-b border-white/5 transition-colors ${idx % 2 === 0 ? 'bg-[#0f172a]' : 'bg-[#131c2e]'} hover:bg-[#18243b]`}>
                        <td className="p-3.5 text-white font-extrabold flex items-center gap-2 border-r border-white/5">
                          <div className="w-7 h-7 rounded-full bg-amber-400 text-black font-black flex items-center justify-center text-xs shadow-sm">
                            {r.employeeName[0]}
                          </div>
                          {r.employeeName}
                        </td>
                        <td className="p-3.5 text-slate-300 font-bold border-r border-white/5">{r.date}</td>
                        <td className="p-3.5 text-emerald-300 font-mono font-black border-r border-white/5">{r.loginTime}</td>
                        <td className="p-3.5 text-rose-400 font-mono font-black border-r border-white/5">{r.logoutTime}</td>
                        <td className="p-3.5 text-amber-300 font-extrabold border-r border-white/5">{r.workingHours}</td>
                        <td className="p-3.5 border-r border-white/5">
                          <span className={`px-2.5 py-0.5 rounded font-black text-[10px] ${
                            r.status === "Present" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-black text-white font-mono">{r.workingHoursNum || 0} hrs</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SALARY MANAGEMENT SECTION */}
          <div style={{ backgroundColor: '#131c2e' }} className="bg-[#131c2e] p-6 rounded-3xl shadow-xl border border-white/15 text-white space-y-6">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div>
                <h2 className="text-xl font-black text-amber-400 uppercase tracking-wide flex items-center gap-2">
                  <DollarSign className="text-amber-400" size={24} /> Salary Details & Management
                </h2>
                <p className="text-xs text-slate-300 font-extrabold mt-1">
                  Manage Monthly Salary, Hourly Salary (Optional), and Daily Amount (Special Bonus/Overtime/Adjustments).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(employeeOptions.length > 0 ? employeeOptions : [currentLoggedInUser]).map((emp) => {
                const sal = employeeSalaries[emp] || Object.values(employeeSalaries).find(s => isSameEmployee(s.employeeName, emp)) || { employeeName: emp, monthlySalary: 0, hourlySalary: 0, dailyAmount: 0 };
                const isEditing = editingSalaryUser === emp;

                return (
                  <div key={emp} style={{ backgroundColor: '#0f172a' }} className="bg-[#0f172a] p-5 rounded-2xl border border-white/10 space-y-4 hover:border-amber-400/40 transition-all shadow-md text-white">
                    <div className="flex justify-between items-center border-b border-white/10 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-amber-400 text-black font-black flex items-center justify-center text-sm shadow-sm">
                          {emp[0]}
                        </div>
                        <span className="font-extrabold text-white text-base">{emp}</span>
                      </div>
                      {!isEditing ? (
                        <button
                          onClick={() => {
                            setEditingSalaryUser(emp);
                            setSalaryForm(sal);
                          }}
                          className="flex items-center gap-1 text-xs font-black text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit2 size={13} /> Edit
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSaveSalary(emp)}
                          className="flex items-center gap-1 text-xs font-black text-black bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 px-3 py-1 rounded-lg transition-colors cursor-pointer shadow-md"
                        >
                          <Save size={13} /> Save
                        </button>
                      )}
                    </div>

                    {!isEditing ? (
                      <div className="space-y-2 text-xs font-extrabold text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Monthly Salary:</span>
                          <span className="font-black text-emerald-300 font-mono text-sm">₹{(sal.monthlySalary || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Hourly Salary (Optional):</span>
                          <span className="font-mono text-amber-300">{sal.hourlySalary ? `₹${sal.hourlySalary}/hr` : "N/A"}</span>
                        </div>
                        <div className="flex justify-between border-t border-white/10 pt-2">
                          <span className="text-slate-400">Daily Amount (Bonus/OT):</span>
                          <span className="font-black text-amber-400 font-mono">₹{sal.dailyAmount || 0}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 text-xs">
                        <div>
                          <label className="block font-extrabold text-slate-300 mb-1">Monthly Salary (₹)</label>
                          <input
                            type="number"
                            value={salaryForm.monthlySalary || ""}
                            onChange={e => setSalaryForm({ ...salaryForm, monthlySalary: Number(e.target.value) })}
                            style={{ backgroundColor: '#162035', color: '#ffffff' }}
                            className="w-full px-2.5 py-1.5 border border-white/20 rounded-lg font-bold text-white outline-none focus:border-amber-400"
                          />
                        </div>
                        <div>
                          <label className="block font-extrabold text-slate-300 mb-1">Hourly Salary (Optional ₹)</label>
                          <input
                            type="number"
                            value={salaryForm.hourlySalary || ""}
                            onChange={e => setSalaryForm({ ...salaryForm, hourlySalary: Number(e.target.value) })}
                            placeholder="Optional"
                            style={{ backgroundColor: '#162035', color: '#ffffff' }}
                            className="w-full px-2.5 py-1.5 border border-white/20 rounded-lg font-bold text-white outline-none focus:border-amber-400"
                          />
                        </div>
                        <div>
                          <label className="block font-extrabold text-slate-300 mb-1">Daily Amount (Bonus/OT ₹)</label>
                          <input
                            type="number"
                            value={salaryForm.dailyAmount || ""}
                            onChange={e => setSalaryForm({ ...salaryForm, dailyAmount: Number(e.target.value) })}
                            placeholder="Optional"
                            style={{ backgroundColor: '#162035', color: '#ffffff' }}
                            className="w-full px-2.5 py-1.5 border border-white/20 rounded-lg font-bold text-white outline-none focus:border-amber-400"
                          />
                        </div>
                        <button
                          onClick={() => setEditingSalaryUser(null)}
                          className="w-full py-1 text-center text-slate-400 hover:text-white text-xs font-extrabold cursor-pointer"
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

      {/* ------------------- MODAL: DATE CLICK ATTENDANCE ACTION POPUP ------------------- */}
      {selectedDateAction && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 cursor-pointer animate-in fade-in duration-150"
          onClick={() => setSelectedDateAction(null)}
        >
          <div
            style={{ backgroundColor: '#0c1427', color: '#ffffff' }}
            className="bg-[#0c1427] rounded-3xl shadow-2xl w-full max-w-md p-6 border-2 border-amber-500/50 animate-in zoom-in-95 duration-200 cursor-default space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-start border-b border-white/10 pb-3">
              <div>
                <div className="flex items-center gap-2 text-amber-400 font-black text-lg">
                  <CalendarIcon size={20} />
                  <span>{selectedDateAction.displayDate}</span>
                </div>
                <p className="text-xs font-bold text-slate-300 mt-1">
                  Employee: <span className="text-amber-300 font-extrabold">{selectedUser}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedDateAction(null)}
                className="text-slate-400 hover:text-white p-1 rounded-full cursor-pointer transition-colors"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Current Status Banner */}
            <div className="bg-[#131c2e] p-3 rounded-2xl border border-white/10 flex items-center justify-between text-xs font-extrabold">
              <span className="text-slate-400">Current Status:</span>
              {(() => {
                const currentRec = userAttendanceRecords.find(r => r.date === selectedDateAction.dayStr);
                if (!currentRec) return <span className="bg-slate-700/60 text-slate-300 px-2.5 py-1 rounded-lg">Not Marked</span>;
                if (currentRec.status === "Present") return <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-lg">Present ({currentRec.loginTime})</span>;
                if (currentRec.status === "Late Attendance") return <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-lg">Late Attendance</span>;
                if (currentRec.status === "Leave") return <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-1 rounded-lg">Leave</span>;
                return <span className="bg-slate-700/60 text-slate-300 px-2.5 py-1 rounded-lg">{currentRec.status}</span>;
              })()}
            </div>

            {/* Action Options */}
            <div className="grid grid-cols-1 gap-3 pt-1">
              <button
                onClick={() => handleActionMarkLate(selectedDateAction.dayStr)}
                className="w-full py-3 px-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black font-black text-xs md:text-sm uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2.5 hover:scale-[1.02]"
              >
                <Clock size={18} /> Mark Late Attendance
              </button>

              <button
                onClick={() => handleActionApplyLeave(selectedDateAction.dayStr)}
                className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs md:text-sm uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2.5 hover:scale-[1.02]"
              >
                <XCircle size={18} /> Apply Leave
              </button>

              <button
                onClick={() => handleActionUnmark(selectedDateAction.dayStr)}
                className="w-full py-3 px-4 bg-slate-700 hover:bg-slate-600 text-slate-100 font-black text-xs md:text-sm uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2.5 hover:scale-[1.02]"
              >
                <AlertCircle size={18} /> Unmark Attendance
              </button>

              <button
                onClick={() => handleActionMarkPresent(selectedDateAction.dayStr)}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs md:text-sm uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2.5 hover:scale-[1.02]"
              >
                <CheckCircle2 size={18} /> Mark Present
              </button>
            </div>

            <button
              onClick={() => setSelectedDateAction(null)}
              className="w-full py-1 text-slate-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ------------------- MODAL: APPLY LEAVE POPUP CALENDAR ------------------- */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 cursor-pointer" onClick={() => setIsLeaveModalOpen(false)}>
          <div style={{ backgroundColor: '#0c1427', color: '#ffffff' }} className="bg-[#0c1427] rounded-3xl shadow-2xl w-full max-w-md p-6 border border-white/20 animate-in fade-in zoom-in duration-200 cursor-default" onClick={(e) => e.stopPropagation()}>
            <div style={{ backgroundColor: '#131c2e' }} className="flex justify-between items-center mb-4 p-4 rounded-2xl bg-[#131c2e] border border-white/10">
              <h3 className="text-lg font-black text-amber-400 flex items-center gap-2 uppercase tracking-wide">
                <CalendarIcon className="text-amber-400" size={20} /> Select Leave Date
              </h3>
              <button onClick={() => setIsLeaveModalOpen(false)} className="text-slate-300 hover:text-white p-1 rounded-full cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleApplyLeaveSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-300 uppercase tracking-wider mb-1">Employee Name</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={leaveEmployee}
                    onChange={e => setLeaveEmployee(e.target.value)}
                    placeholder="Enter or select name..."
                    style={{ backgroundColor: '#162035', color: '#fbbf24' }}
                    className="flex-1 p-3 bg-[#162035] border border-white/20 rounded-xl font-black text-amber-400 text-xs outline-none focus:border-amber-400"
                  />
                  <select
                    value={employeeOptions.includes(leaveEmployee) ? leaveEmployee : ""}
                    onChange={e => {
                      if (e.target.value) setLeaveEmployee(e.target.value);
                    }}
                    style={{ backgroundColor: '#162035', color: '#fbbf24' }}
                    className="p-3 bg-[#162035] border border-white/20 rounded-xl font-black text-amber-400 text-xs outline-none focus:border-amber-400 cursor-pointer max-w-[130px]"
                  >
                    <option value="">Select...</option>
                    {employeeOptions.map(emp => (
                      <option key={emp} value={emp}>{emp}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-300 uppercase tracking-wider mb-1">Leave Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between p-3 border border-white/20 rounded-xl font-bold text-white bg-[#162035] outline-none hover:border-amber-400 text-xs cursor-pointer"
                    >
                      <span className={leaveDate ? "text-amber-300 font-mono font-black" : "text-slate-400"}>
                        {leaveDate ? format(new Date(leaveDate), "dd MMM yyyy") : "Select Leave Date..."}
                      </span>
                      <CalendarIcon size={16} className="text-amber-400" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="sabi-calendar-popover p-2 border border-white/20 bg-[#090e1a] text-white shadow-2xl rounded-2xl w-auto z-[100]" align="start">
                    <Calendar
                      mode="single"
                      selected={leaveDate ? new Date(leaveDate) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          setLeaveDate(format(date, "yyyy-MM-dd"));
                        }
                      }}
                      className="rounded-xl border-none"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-300 uppercase tracking-wider mb-1">Remarks / Reason</label>
                <input
                  type="text"
                  value={leaveRemark}
                  onChange={e => setLeaveRemark(e.target.value)}
                  placeholder="e.g. Personal Leave, Sick Leave"
                  style={{ backgroundColor: '#162035', color: '#ffffff' }}
                  className="w-full p-3 border border-white/20 rounded-xl font-bold text-white bg-[#162035] placeholder-slate-400 outline-none focus:border-amber-400 text-xs"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="flex-1 py-3 border border-white/20 rounded-xl font-extrabold text-slate-300 hover:text-white hover:bg-white/10 text-xs cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black font-black uppercase tracking-wider rounded-xl shadow-lg text-xs cursor-pointer transition-all hover:scale-105"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 cursor-pointer" onClick={() => setIsHistoryModalOpen(false)}>
          <div style={{ backgroundColor: '#0c1427', color: '#ffffff' }} className="bg-[#0c1427] rounded-3xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden border border-white/20 animate-in fade-in zoom-in duration-200 cursor-default" onClick={(e) => e.stopPropagation()}>
            
            {/* Header - Fixed */}
            <div style={{ backgroundColor: '#131c2e' }} className="p-6 bg-[#131c2e] border-b border-white/15 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xl font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
                  <Eye size={22} className="text-amber-400" /> Monthly Attendance History
                </h3>
                <p className="text-xs font-extrabold text-slate-300 mt-1">
                  Employee: <span className="text-amber-300 font-bold">{selectedUser}</span> | Period: <span className="text-white font-bold">{monthNames[month]} {year}</span>
                </p>
              </div>
              <button 
                onClick={() => setIsHistoryModalOpen(false)} 
                className="p-1.5 text-slate-300 hover:text-white rounded-full transition-colors cursor-pointer"
              >
                <X size={24} />
              </button>
            </div>

            {/* Attendance Table Container - Contained Scrollable with sticky header */}
            <div className="flex-1 overflow-y-auto max-h-[400px] p-6 bg-[#090e1a] custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10">
                  <tr style={{ backgroundColor: '#162035' }} className="bg-[#162035] text-amber-400 uppercase font-black border-b border-amber-500/30 shadow-sm">
                    <th className="p-3.5 border-r border-white/10 bg-[#162035]">Date</th>
                    <th className="p-3.5 border-r border-white/10 bg-[#162035]">Login Time</th>
                    <th className="p-3.5 border-r border-white/10 bg-[#162035]">Logout Time</th>
                    <th className="p-3.5 border-r border-white/10 bg-[#162035]">Working Hours</th>
                    <th className="p-3.5 border-r border-white/10 bg-[#162035]">Leave Status</th>
                    <th className="p-3.5 bg-[#162035]">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {currentMonthRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-amber-400 font-extrabold italic">
                        No attendance records for {monthNames[month]} {year}.
                      </td>
                    </tr>
                  ) : (
                    currentMonthRecords.map((rec, idx) => (
                      <tr key={rec.id} className={`border-b border-white/5 transition-colors ${idx % 2 === 0 ? 'bg-[#0f172a]' : 'bg-[#131c2e]'} hover:bg-[#18243b]`}>
                        <td className="p-3.5 text-white font-extrabold border-r border-white/5">{rec.date}</td>
                        <td className="p-3.5 text-emerald-300 font-mono font-bold border-r border-white/5">{rec.loginTime}</td>
                        <td className="p-3.5 text-rose-400 font-mono font-bold border-r border-white/5">{rec.logoutTime}</td>
                        <td className="p-3.5 text-amber-300 font-mono font-black border-r border-white/5">{rec.workingHours}</td>
                        <td className="p-3.5 border-r border-white/5">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                            rec.status === "Present" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          }`}>
                            {rec.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-300 font-bold">{rec.remarks}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Summary Stats */}
            <div style={{ backgroundColor: '#131c2e' }} className="p-5 bg-[#131c2e] border-t border-white/15 grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0 text-center font-black">
              <div className="bg-[#090e1a] p-3.5 rounded-2xl border border-amber-500/30 shadow-md">
                <span className="text-xs text-amber-400 uppercase tracking-wider block mb-1">Total Working Hours</span>
                <span className="text-xl text-amber-300 font-mono">{monthlyStats.totalHours} hrs</span>
              </div>
              <div className="bg-[#090e1a] p-3.5 rounded-2xl border border-emerald-500/30 shadow-md">
                <span className="text-xs text-emerald-400 uppercase tracking-wider block mb-1">Total Present Days</span>
                <span className="text-xl text-emerald-300 font-mono">{monthlyStats.presentDays} Days</span>
              </div>
              <div className="bg-[#090e1a] p-3.5 rounded-2xl border border-rose-500/30 shadow-md">
                <span className="text-xs text-rose-400 uppercase tracking-wider block mb-1">Total Leave Days</span>
                <span className="text-xl text-rose-400 font-mono">{monthlyStats.leaveDays} Days</span>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
