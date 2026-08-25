import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { 
  Plus, X, Upload, Pencil, Trash2, Search, Download, 
  ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, Check, FileSpreadsheet, RotateCcw,
  RotateCw, Filter, MoreHorizontal, Copy, Calendar as CalendarIcon, Eye,
  Sparkles, CheckCircle2, Clock, AlertTriangle, XCircle, Hash,
  Layers, PlusCircle, MoveHorizontal, CheckSquare, Square,
  SlidersHorizontal, ListPlus, Tag, Settings, ArrowLeft, ArrowRight,
  ChevronDown, Image as ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import { doc, setDoc, onSnapshot, collection } from 'firebase/firestore';
import { db } from '@/firebase';

// --- TYPES & INTERFACES ---
export interface ColumnDef {
  id: string;
  label: string;
  width?: number;
  type?: 'text' | 'number' | 'date' | 'select';
  options?: string[];
}

export interface SheetRow {
  id: string;
  [key: string]: any;
}

export interface SheetData {
  id: string;
  name: string;
  columns: ColumnDef[];
  rows: SheetRow[];
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: 'date', label: 'Date', width: 130, type: 'date' },
  { id: 'contactNumber', label: 'Contact Number', width: 170, type: 'text' },
  { id: 'count', label: 'Count', width: 100, type: 'text' },
  { id: 'birthday', label: 'Birthday', width: 140, type: 'date' },
  { id: 'dispatch', label: 'Dispatch', width: 130, type: 'date' },
  { id: 'comments', label: 'Comments', width: 220, type: 'text' },
  { 
    id: 'status', 
    label: 'Status', 
    width: 200, 
    type: 'select', 
    options: ['Waiting for Image', 'Image Received', 'Cancel', 'In Progress', 'Completed'] 
  },
  { id: 'cancelReason', label: 'Cancel Reason', width: 200, type: 'text' },
];

// Generate empty rows up to 25 for full initial page
const createEmptyRow = (index: number): SheetRow => ({
  id: `row-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 6)}`,
  date: '',
  contactNumber: '',
  count: '',
  birthday: '',
  dispatch: '',
  comments: '',
  status: '',
  cancelReason: ''
});

const generateInitialRows = (totalCount: number = 25): SheetRow[] => {
  const result: SheetRow[] = [];
  for (let i = 0; i < totalCount; i++) {
    result.push(createEmptyRow(i + 1));
  }
  return result;
};

const DEFAULT_SHEETS: SheetData[] = [
  {
    id: 'sheet-chocolate-price',
    name: 'Chocolate Price',
    columns: [...DEFAULT_COLUMNS],
    rows: generateInitialRows(25)
  },
  {
    id: 'sheet-aug',
    name: 'AUG',
    columns: [...DEFAULT_COLUMNS],
    rows: generateInitialRows(25)
  },
  {
    id: 'sheet-sep',
    name: 'SEP',
    columns: [...DEFAULT_COLUMNS],
    rows: generateInitialRows(25)
  },
  {
    id: 'sheet-oct',
    name: 'OCT',
    columns: [...DEFAULT_COLUMNS],
    rows: generateInitialRows(25)
  },
  {
    id: 'sheet-wholesale-price',
    name: 'Wholesale Price',
    columns: [...DEFAULT_COLUMNS],
    rows: generateInitialRows(25)
  }
];

const LOCAL_STORAGE_KEY = 'sabi_daily_tasks_excel_sheets_v3';
const PAGE_SIZE = 25;

export default function DailyTasksBoard({ onWallpaperChange }: { onWallpaperChange?: () => void } = {}) {
  // Sheets State
  const [sheets, setSheets] = useState<SheetData[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to parse local sheets data:', e);
    }
    return DEFAULT_SHEETS;
  });

  const [activeSheetId, setActiveSheetId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const aug = parsed.find(s => s.name === 'AUG');
          return aug ? aug.id : parsed[0].id;
        }
      }
    } catch (e) {}
    return 'sheet-aug';
  });

  // Wallpaper State for Daily Tasks section
  const [dailyTasksWallpaper, setDailyTasksWallpaper] = useState<string>(() => {
    return localStorage.getItem('sabi_daily_tasks_wallpaper') || '';
  });
  const wallpaperFileInputRef = useRef<HTMLInputElement>(null);

  const handleWallpaperUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1920;
        const MAX_HEIGHT = 1080;
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

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
        setDailyTasksWallpaper(compressedBase64);
        localStorage.setItem('sabi_daily_tasks_wallpaper', compressedBase64);
        toast.success("Daily Tasks wallpaper updated!");
        if (onWallpaperChange) onWallpaperChange();
      };
    };
    reader.readAsDataURL(file);
  };

  const handleClearWallpaper = () => {
    setDailyTasksWallpaper('');
    localStorage.removeItem('sabi_daily_tasks_wallpaper');
    toast.success("Daily Tasks wallpaper removed!");
    if (onWallpaperChange) onWallpaperChange();
  };

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Selected Row IDs for multi-action
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);

  // Cell Editing & Selection State
  const [selectedCell, setSelectedCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [cellEditValue, setCellEditValue] = useState<string>('');

  // Date Suggestion / Picker State
  const [datePickerCell, setDatePickerCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [datePreferredFormat, setDatePreferredFormat] = useState<'dot' | 'dash' | 'text'>('dot');

  // Header & Dropdown Manager Modal State
  const [isHeaderManagerOpen, setIsHeaderManagerOpen] = useState<boolean>(false);
  const [headerManagerTab, setHeaderManagerTab] = useState<'add' | 'manage'>('add');

  // New Header Form State
  const [newColLabel, setNewColLabel] = useState<string>('');
  const [newColType, setNewColType] = useState<'text' | 'number' | 'date' | 'select'>('select');
  const [newColWidth, setNewColWidth] = useState<number>(160);
  const [newColOptions, setNewColOptions] = useState<string[]>(['Waiting for Image', 'Image Received', 'In Progress', 'Completed', 'Cancel']);
  const [newColOptionInput, setNewColOptionInput] = useState<string>('');

  // Quick Option Input for Existing Columns
  const [quickOptionInputs, setQuickOptionInputs] = useState<Record<string, string>>({});

  // Preset Templates for Quick Dropdown Setup
  const DROPDOWN_PRESETS = [
    {
      name: 'Order Status',
      options: ['Waiting for Image', 'Image Received', 'Cancel', 'In Progress', 'Completed']
    },
    {
      name: 'Payment Status',
      options: ['Unpaid', 'Advance Paid', 'Full Paid', 'Pending', 'Refunded']
    },
    {
      name: 'Courier Partner',
      options: ['ST Courier', 'Professional Courier', 'DTDC', 'Speed Post', 'Hand Delivery']
    },
    {
      name: 'Priority / Urgency',
      options: ['Normal', 'High Priority', 'Urgent', 'VIP']
    },
    {
      name: 'Approval / Yes-No',
      options: ['Yes', 'No', 'Pending']
    }
  ];

  // Dynamic Dropdown Option Badge Style Helper (High-contrast, crystal clear text across themes)
  const getDropdownOptionBadgeStyle = (optionVal: string) => {
    const s = (optionVal || '').trim().toLowerCase();
    
    if (s === 'waiting for image' || s.includes('waiting') || s.includes('pending') || s.includes('advance') || s.includes('unpaid')) {
      return 'bg-amber-500/25 !text-amber-300 border border-amber-500/50 shadow-sm font-black tracking-wide';
    }
    if (s === 'image received' || s.includes('received') || s.includes('full paid') || s.includes('paid') || s.includes('yes') || s.includes('completed') || s.includes('delivered') || s.includes('success')) {
      return 'bg-emerald-500/25 !text-emerald-300 border border-emerald-500/50 shadow-sm font-black tracking-wide';
    }
    if (s === 'cancel' || s.includes('cancel') || s.includes('refund') || s.includes('no') || s.includes('rejected') || s.includes('urgent') || s.includes('vip')) {
      return 'bg-rose-500/25 !text-rose-300 border border-rose-500/50 shadow-sm font-black tracking-wide';
    }
    if (s === 'in progress' || s.includes('progress') || s.includes('courier') || s.includes('dtdc') || s.includes('st courier') || s.includes('speed post')) {
      return 'bg-sky-500/25 !text-sky-300 border border-sky-500/50 shadow-sm font-black tracking-wide';
    }
    if (s.includes('high') || s.includes('medium') || s.includes('priority')) {
      return 'bg-yellow-500/25 !text-yellow-300 border border-yellow-500/50 shadow-sm font-black tracking-wide';
    }
    return 'bg-purple-500/25 !text-purple-300 border border-purple-500/50 shadow-sm font-black tracking-wide';
  };

  // Add Option to New Column Form
  const handleAddNewColOption = (opt?: string) => {
    const val = (opt || newColOptionInput).trim();
    if (!val) return;
    if (newColOptions.includes(val)) {
      toast.info(`Option "${val}" is already in the list`);
      return;
    }
    setNewColOptions(prev => [...prev, val]);
    setNewColOptionInput('');
  };

  const handleRemoveNewColOption = (index: number) => {
    setNewColOptions(prev => prev.filter((_, i) => i !== index));
  };

  // Create New Header / Column
  const handleCreateHeader = () => {
    if (!newColLabel.trim()) {
      toast.error('Please enter a column title');
      return;
    }

    const colKey = `col_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newCol: ColumnDef = {
      id: colKey,
      label: newColLabel.trim(),
      width: newColWidth || 160,
      type: newColType,
      options: newColType === 'select' ? (newColOptions.length > 0 ? newColOptions : ['Option 1', 'Option 2']) : undefined
    };

    const updatedSheets = sheets.map(sheet => {
      if (sheet.id !== currentSheet.id) return sheet;
      return {
        ...sheet,
        columns: [...sheet.columns, newCol]
      };
    });

    saveSheets(updatedSheets);
    setNewColLabel('');
    setNewColOptions(['Option 1', 'Option 2', 'Option 3']);
    setIsHeaderManagerOpen(false);
    toast.success(`Column "${newCol.label}" created successfully`);
  };

  // Add Option to an Existing Column
  const handleAddOptionToExistingColumn = (colId: string, customVal?: string) => {
    const val = (customVal || quickOptionInputs[colId] || '').trim();
    if (!val) return;

    const updatedSheets = sheets.map(sheet => {
      if (sheet.id !== currentSheet.id) return sheet;
      const updatedCols = sheet.columns.map(col => {
        if (col.id !== colId) return col;
        const currentOpts = col.options || ['Waiting for Image', 'Image Received', 'Cancel', 'In Progress', 'Completed'];
        if (currentOpts.includes(val)) {
          toast.info(`Option "${val}" already exists in ${col.label}`);
          return col;
        }
        return {
          ...col,
          type: 'select' as const,
          options: [...currentOpts, val]
        };
      });
      return { ...sheet, columns: updatedCols };
    });

    saveSheets(updatedSheets);
    setQuickOptionInputs(prev => ({ ...prev, [colId]: '' }));
    toast.success(`Added "${val}" to column options`);
  };

  // Remove Option from Existing Column
  const handleRemoveOptionFromExistingColumn = (colId: string, optionIndex: number) => {
    const updatedSheets = sheets.map(sheet => {
      if (sheet.id !== currentSheet.id) return sheet;
      const updatedCols = sheet.columns.map(col => {
        if (col.id !== colId) return col;
        const currentOpts = col.options || [];
        return {
          ...col,
          options: currentOpts.filter((_, idx) => idx !== optionIndex)
        };
      });
      return { ...sheet, columns: updatedCols };
    });

    saveSheets(updatedSheets);
    toast.success('Option removed');
  };

  // Reorder Column (Move Left / Right)
  const handleMoveColumn = (colId: string, direction: 'left' | 'right') => {
    const colIndex = currentSheet.columns.findIndex(c => c.id === colId);
    if (colIndex === -1) return;
    if (direction === 'left' && colIndex === 0) return;
    if (direction === 'right' && colIndex === currentSheet.columns.length - 1) return;

    const targetIndex = direction === 'left' ? colIndex - 1 : colIndex + 1;
    const newColumns = [...currentSheet.columns];
    const [movedCol] = newColumns.splice(colIndex, 1);
    newColumns.splice(targetIndex, 0, movedCol);

    const updatedSheets = sheets.map(sheet => {
      if (sheet.id !== currentSheet.id) return sheet;
      return { ...sheet, columns: newColumns };
    });

    saveSheets(updatedSheets);
    toast.success(`Moved column "${movedCol.label}"`);
  };

  // Date Formatting Utilities
  const formatDateToString = (d: Date, formatType: 'dot' | 'dash' | 'text' = 'dot'): string => {
    if (!d || isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    if (formatType === 'dash') {
      return `${day}-${month}-${year}`;
    }
    if (formatType === 'text') {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${day} ${monthNames[d.getMonth()]} ${year}`;
    }
    return `${day}.${month}.${year}`;
  };

  const getTodayFormatted = (formatType: 'dot' | 'dash' | 'text' = 'dot'): string => {
    return formatDateToString(new Date(), formatType);
  };

  const getOffsetDateFormatted = (days: number, formatType: 'dot' | 'dash' | 'text' = 'dot'): string => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return formatDateToString(d, formatType);
  };

  const parseCellDateToDate = (val: any): Date | undefined => {
    if (!val) return undefined;
    const str = String(val).trim();

    // Match DD.MM.YYYY
    if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(str)) {
      const [d, m, y] = str.split('.').map(Number);
      const date = new Date(y, m - 1, d);
      if (!isNaN(date.getTime())) return date;
    }
    // Match DD-MM-YYYY
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(str)) {
      const [d, m, y] = str.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      if (!isNaN(date.getTime())) return date;
    }
    // Match YYYY-MM-DD
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) {
      const [y, m, d] = str.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      if (!isNaN(date.getTime())) return date;
    }
    // Standard parse
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) return parsed;
    return undefined;
  };

  // Column Header Editing
  const [editingHeaderColId, setEditingHeaderColId] = useState<string | null>(null);
  const [headerEditTitle, setHeaderEditTitle] = useState<string>('');

  // Dropdown Popover Cell State
  const [openDropdownCell, setOpenDropdownCell] = useState<{ rowId: string; colId: string } | null>(null);

  // Add Column Modal / Popover
  const [isAddColumnOpen, setIsAddColumnOpen] = useState<boolean>(false);
  const [newColumnName, setNewColumnName] = useState<string>('');
  const [newColumnType, setNewColumnType] = useState<'text' | 'number' | 'date' | 'select'>('text');

  // Sheet Tab Renaming
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [sheetRenameValue, setSheetRenameValue] = useState<string>('');

  // Undo / Redo History
  const historyRef = useRef<{ past: SheetData[][]; future: SheetData[][] }>({
    past: [],
    future: []
  });

  const isSyncingFromRemoteRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cellInputRef = useRef<HTMLInputElement>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);

  // Active Sheet Object
  const currentSheet = useMemo(() => {
    return sheets.find(s => s.id === activeSheetId) || sheets[0] || DEFAULT_SHEETS[0];
  }, [sheets, activeSheetId]);

  // Push state to Undo History
  const pushHistory = useCallback((newSheets: SheetData[]) => {
    historyRef.current.past.push(JSON.parse(JSON.stringify(sheets)));
    if (historyRef.current.past.length > 30) {
      historyRef.current.past.shift();
    }
    historyRef.current.future = [];
  }, [sheets]);

  // Save to LocalStorage and Firestore
  const saveSheets = useCallback((updatedSheets: SheetData[], recordHistory: boolean = true) => {
    if (recordHistory) {
      pushHistory(sheets);
    }
    setSheets(updatedSheets);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedSheets));
    } catch (e) {
      console.error('Error saving to localStorage:', e);
    }

    // Sync to Firestore (Master doc and individual sheets for 100% data persistence)
    try {
      const sheetDocRef = doc(db, 'daily_tasks_board', 'sheet_data');
      setDoc(sheetDocRef, {
        sheets: updatedSheets,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(err => {
        console.warn('Firestore master sheet sync note:', err);
      });

      // Also persist each sheet into daily_tasks_sheets collection
      updatedSheets.forEach(sheet => {
        const indDocRef = doc(db, 'daily_tasks_sheets', sheet.id);
        setDoc(indDocRef, {
          ...sheet,
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(() => {});
      });
    } catch (err) {
      console.warn('Firestore sync failed:', err);
    }
  }, [sheets, pushHistory]);

  // Firestore Real-time Listener (both master doc and collection)
  useEffect(() => {
    let unsubscribeMaster: (() => void) | null = null;
    let unsubscribeCollection: (() => void) | null = null;

    try {
      const sheetDocRef = doc(db, 'daily_tasks_board', 'sheet_data');
      unsubscribeMaster = onSnapshot(sheetDocRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data && Array.isArray(data.sheets) && data.sheets.length > 0) {
            isSyncingFromRemoteRef.current = true;
            setSheets(data.sheets);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data.sheets));
            setTimeout(() => {
              isSyncingFromRemoteRef.current = false;
            }, 100);
          }
        }
      }, (error) => {
        console.warn('Firestore real-time subscription error:', error);
      });
    } catch (e) {
      console.warn('Could not set up master Firestore listener:', e);
    }

    try {
      unsubscribeCollection = onSnapshot(collection(db, 'daily_tasks_sheets'), (snapshot) => {
        if (!snapshot.empty) {
          const remoteSheets: SheetData[] = [];
          snapshot.forEach(docSnap => {
            const d = docSnap.data() as SheetData;
            if (d && d.id && d.name) {
              remoteSheets.push(d);
            }
          });
          if (remoteSheets.length > 0) {
            setSheets(prev => {
              const map = new Map<string, SheetData>();
              prev.forEach(s => map.set(s.id, s));
              remoteSheets.forEach(s => map.set(s.id, s));
              const merged = Array.from(map.values());
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
              return merged;
            });
          }
        }
      }, (error) => {
        console.warn('Firestore collection listener note:', error);
      });
    } catch (e) {}

    return () => {
      if (unsubscribeMaster) unsubscribeMaster();
      if (unsubscribeCollection) unsubscribeCollection();
    };
  }, []);

  // Keyboard Shortcuts for Undo/Redo & Custom Events from Dashboard
  const handleUndo = useCallback(() => {
    if (historyRef.current.past.length === 0) {
      toast.info('No more actions to undo');
      return;
    }
    const previous = historyRef.current.past.pop()!;
    historyRef.current.future.push(JSON.parse(JSON.stringify(sheets)));
    setSheets(previous);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(previous));
    toast.success('Undone last action');
  }, [sheets]);

  const handleRedo = useCallback(() => {
    if (historyRef.current.future.length === 0) {
      toast.info('No more actions to redo');
      return;
    }
    const next = historyRef.current.future.pop()!;
    historyRef.current.past.push(JSON.parse(JSON.stringify(sheets)));
    setSheets(next);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
    toast.success('Redone action');
  }, [sheets]);

  useEffect(() => {
    const onUndoEvent = () => handleUndo();
    const onRedoEvent = () => handleRedo();

    window.addEventListener('sabi-daily-tasks-undo', onUndoEvent);
    window.addEventListener('sabi-daily-tasks-redo', onRedoEvent);

    const onKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (isCtrlOrCmd && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if (isCtrlOrCmd && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('sabi-daily-tasks-undo', onUndoEvent);
      window.removeEventListener('sabi-daily-tasks-redo', onRedoEvent);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [handleUndo, handleRedo]);

  // Focus cell input when editing starts
  useEffect(() => {
    if (editingCell && cellInputRef.current) {
      cellInputRef.current.focus();
      cellInputRef.current.select();
    }
  }, [editingCell]);

  // Focus header input when header editing starts
  useEffect(() => {
    if (editingHeaderColId && headerInputRef.current) {
      headerInputRef.current.focus();
      headerInputRef.current.select();
    }
  }, [editingHeaderColId]);

  // Filtered and Searched Rows
  const filteredRows = useMemo(() => {
    if (!currentSheet || !currentSheet.rows) return [];
    let rows = currentSheet.rows;

    // Search query across all fields
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      rows = rows.filter(row => {
        return Object.entries(row).some(([key, val]) => {
          if (key === 'id') return false;
          return String(val || '').toLowerCase().includes(q);
        });
      });
    }

    // Status filter
    if (statusFilter !== 'All') {
      rows = rows.filter(row => row.status === statusFilter);
    }

    return rows;
  }, [currentSheet, searchQuery, statusFilter]);

  // Pagination calculation
  const totalRows = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, currentPage]);

  // Summary Metrics
  const summaryStats = useMemo(() => {
    const allRows = currentSheet?.rows || [];
    const filledRows = allRows.filter(r => 
      (r.contactNumber && r.contactNumber.trim()) || 
      (r.comments && r.comments.trim()) || 
      (r.count && r.count.trim()) || 
      (r.status && r.status.trim())
    );

    const waitingCount = allRows.filter(r => r.status === 'Waiting for Image').length;
    const receivedCount = allRows.filter(r => r.status === 'Image Received').length;
    const cancelCount = allRows.filter(r => r.status === 'Cancel').length;
    const completedCount = allRows.filter(r => r.status === 'Completed').length;

    let totalQuantity = 0;
    allRows.forEach(r => {
      const val = parseInt(String(r.count || '').replace(/\D/g, ''), 10);
      if (!isNaN(val)) totalQuantity += val;
    });

    return {
      totalRows: allRows.length,
      filledRows: filledRows.length,
      waitingCount,
      receivedCount,
      cancelCount,
      completedCount,
      totalQuantity
    };
  }, [currentSheet]);

  // --- ACTIONS & HANDLERS ---

  // Cell Edit Handlers
  const startEditingCell = (rowId: string, colId: string, initialValue: any) => {
    setSelectedCell({ rowId, colId });
    setEditingCell({ rowId, colId });
    setCellEditValue(initialValue !== undefined && initialValue !== null ? String(initialValue) : '');
  };

  const commitCellEdit = () => {
    if (!editingCell) return;
    const { rowId, colId } = editingCell;

    const updatedSheets = sheets.map(sheet => {
      if (sheet.id !== currentSheet.id) return sheet;
      const updatedRows = sheet.rows.map(row => {
        if (row.id !== rowId) return row;
        return {
          ...row,
          [colId]: cellEditValue
        };
      });
      return { ...sheet, rows: updatedRows };
    });

    saveSheets(updatedSheets);
    setEditingCell(null);
  };

  const cancelCellEdit = () => {
    setEditingCell(null);
  };

  const handleCellStatusChange = (rowId: string, colIdOrStatus: string, newStatusOptional?: string) => {
    const colId = newStatusOptional !== undefined ? colIdOrStatus : 'status';
    const newStatus = newStatusOptional !== undefined ? newStatusOptional : colIdOrStatus;

    const updatedSheets = sheets.map(sheet => {
      if (sheet.id !== currentSheet.id) return sheet;
      const updatedRows = sheet.rows.map(row => {
        if (row.id !== rowId) return row;
        return {
          ...row,
          [colId]: newStatus
        };
      });
      return { ...sheet, rows: updatedRows };
    });
    saveSheets(updatedSheets);
    setOpenDropdownCell(null);
    if (newStatus) {
      toast.success(`Updated to "${newStatus}"`);
    } else {
      toast.info('Cleared');
    }
  };

  const handleApplyDate = (rowId: string, colId: string, dateStr: string) => {
    const updatedSheets = sheets.map(sheet => {
      if (sheet.id !== currentSheet.id) return sheet;
      const updatedRows = sheet.rows.map(row => {
        if (row.id !== rowId) return row;
        return {
          ...row,
          [colId]: dateStr
        };
      });
      return { ...sheet, rows: updatedRows };
    });

    saveSheets(updatedSheets);
    setDatePickerCell(null);
    if (dateStr) {
      toast.success(`Date set to "${dateStr}"`);
    } else {
      toast.info('Date cleared');
    }
  };

  // Keyboard navigation between cells
  const handleCellKeyDown = (e: React.KeyboardEvent, rowId: string, colId: string) => {
    if (editingCell) {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitCellEdit();
        // Move to row below if available
        const currentIndex = paginatedRows.findIndex(r => r.id === rowId);
        if (currentIndex < paginatedRows.length - 1) {
          const nextRow = paginatedRows[currentIndex + 1];
          setSelectedCell({ rowId: nextRow.id, colId });
          setDatePickerCell(null);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelCellEdit();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        commitCellEdit();
        const colIndex = currentSheet.columns.findIndex(c => c.id === colId);
        if (e.shiftKey) {
          if (colIndex > 0) {
            const prevCol = currentSheet.columns[colIndex - 1];
            setSelectedCell({ rowId, colId: prevCol.id });
            setDatePickerCell(null);
          }
        } else {
          if (colIndex < currentSheet.columns.length - 1) {
            const nextCol = currentSheet.columns[colIndex + 1];
            setSelectedCell({ rowId, colId: nextCol.id });
            setDatePickerCell(null);
          }
        }
      }
    } else {
      // Cell selected but not in edit mode
      if (e.key === 'Enter') {
        e.preventDefault();
        const row = currentSheet.rows.find(r => r.id === rowId);
        const col = currentSheet.columns.find(c => c.id === colId);
        if (row && col) {
          if (col.type === 'date' || col.id === 'date' || col.id === 'birthday' || col.id === 'dispatch') {
            setDatePickerCell({ rowId, colId });
          } else if (col.id !== 'status' && col.type !== 'select') {
            startEditingCell(rowId, colId, row[colId]);
          }
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const updatedSheets = sheets.map(sheet => {
          if (sheet.id !== currentSheet.id) return sheet;
          const updatedRows = sheet.rows.map(row => {
            if (row.id !== rowId) return row;
            return { ...row, [colId]: '' };
          });
          return { ...sheet, rows: updatedRows };
        });
        saveSheets(updatedSheets);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const colIndex = currentSheet.columns.findIndex(c => c.id === colId);
        setDatePickerCell(null);
        if (e.shiftKey) {
          if (colIndex > 0) {
            setSelectedCell({ rowId, colId: currentSheet.columns[colIndex - 1].id });
          } else {
            const currRowIdx = paginatedRows.findIndex(r => r.id === rowId);
            if (currRowIdx > 0) {
              setSelectedCell({ 
                rowId: paginatedRows[currRowIdx - 1].id, 
                colId: currentSheet.columns[currentSheet.columns.length - 1].id 
              });
            }
          }
        } else {
          if (colIndex < currentSheet.columns.length - 1) {
            setSelectedCell({ rowId, colId: currentSheet.columns[colIndex + 1].id });
          } else {
            const currRowIdx = paginatedRows.findIndex(r => r.id === rowId);
            if (currRowIdx < paginatedRows.length - 1) {
              setSelectedCell({ 
                rowId: paginatedRows[currRowIdx + 1].id, 
                colId: currentSheet.columns[0].id 
              });
            }
          }
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setDatePickerCell(null);
        const currIdx = paginatedRows.findIndex(r => r.id === rowId);
        if (currIdx < paginatedRows.length - 1) {
          setSelectedCell({ rowId: paginatedRows[currIdx + 1].id, colId });
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setDatePickerCell(null);
        const currIdx = paginatedRows.findIndex(r => r.id === rowId);
        if (currIdx > 0) {
          setSelectedCell({ rowId: paginatedRows[currIdx - 1].id, colId });
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setDatePickerCell(null);
        const colIndex = currentSheet.columns.findIndex(c => c.id === colId);
        if (colIndex < currentSheet.columns.length - 1) {
          setSelectedCell({ rowId, colId: currentSheet.columns[colIndex + 1].id });
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setDatePickerCell(null);
        const colIndex = currentSheet.columns.findIndex(c => c.id === colId);
        if (colIndex > 0) {
          setSelectedCell({ rowId, colId: currentSheet.columns[colIndex - 1].id });
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const col = currentSheet.columns.find(c => c.id === colId);
        if (col && col.id !== 'status' && col.type !== 'select') {
          setDatePickerCell(null);
          setSelectedCell({ rowId, colId });
          setEditingCell({ rowId, colId });
          setCellEditValue(e.key);
        }
      }
    }
  };

  // Global Keyboard listener for arrow keys and grid navigation
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if header manager modal is open or no cell selected or currently editing
      if (!selectedCell || editingCell || isHeaderManagerOpen) return;
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      
      const { rowId, colId } = selectedCell;
      const currRowIdx = paginatedRows.findIndex(r => r.id === rowId);
      const currColIdx = currentSheet.columns.findIndex(c => c.id === colId);
      if (currRowIdx === -1 || currColIdx === -1) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setDatePickerCell(null);
        if (currRowIdx < paginatedRows.length - 1) {
          setSelectedCell({ rowId: paginatedRows[currRowIdx + 1].id, colId });
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setDatePickerCell(null);
        if (currRowIdx > 0) {
          setSelectedCell({ rowId: paginatedRows[currRowIdx - 1].id, colId });
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setDatePickerCell(null);
        if (currColIdx < currentSheet.columns.length - 1) {
          setSelectedCell({ rowId, colId: currentSheet.columns[currColIdx + 1].id });
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setDatePickerCell(null);
        if (currColIdx > 0) {
          setSelectedCell({ rowId, colId: currentSheet.columns[currColIdx - 1].id });
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        setDatePickerCell(null);
        if (e.shiftKey) {
          if (currColIdx > 0) {
            setSelectedCell({ rowId, colId: currentSheet.columns[currColIdx - 1].id });
          } else if (currRowIdx > 0) {
            setSelectedCell({ 
              rowId: paginatedRows[currRowIdx - 1].id, 
              colId: currentSheet.columns[currentSheet.columns.length - 1].id 
            });
          }
        } else {
          if (currColIdx < currentSheet.columns.length - 1) {
            setSelectedCell({ rowId, colId: currentSheet.columns[currColIdx + 1].id });
          } else if (currRowIdx < paginatedRows.length - 1) {
            setSelectedCell({ 
              rowId: paginatedRows[currRowIdx + 1].id, 
              colId: currentSheet.columns[0].id 
            });
          }
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const row = currentSheet.rows.find(r => r.id === rowId);
        const col = currentSheet.columns[currColIdx];
        if (row) {
          if (col.type === 'date' || col.id === 'date' || col.id === 'birthday' || col.id === 'dispatch') {
            setDatePickerCell({ rowId, colId });
          } else if (col.id !== 'status' && col.type !== 'select') {
            startEditingCell(rowId, colId, row[colId]);
          }
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const updatedSheets = sheets.map(sheet => {
          if (sheet.id !== currentSheet.id) return sheet;
          const updatedRows = sheet.rows.map(row => {
            if (row.id !== rowId) return row;
            return { ...row, [colId]: '' };
          });
          return { ...sheet, rows: updatedRows };
        });
        saveSheets(updatedSheets);
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const col = currentSheet.columns[currColIdx];
        if (col && col.id !== 'status' && col.type !== 'select') {
          e.preventDefault();
          setDatePickerCell(null);
          startEditingCell(rowId, colId, e.key);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selectedCell, editingCell, paginatedRows, currentSheet, isHeaderManagerOpen, sheets]);

  // Auto-scroll and DOM focus on selected cell
  useEffect(() => {
    if (selectedCell && !editingCell && !openDropdownCell && !datePickerCell) {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.closest('[data-radix-popper-content-wrapper]') || activeEl.closest('[role="dialog"]'))) {
        return;
      }
      const cellEl = document.querySelector(`[data-cell-id="${selectedCell.rowId}-${selectedCell.colId}"]`) as HTMLElement;
      if (cellEl && cellEl !== activeEl) {
        cellEl.focus({ preventScroll: true });
        cellEl.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      }
    }
  }, [selectedCell, editingCell, openDropdownCell, datePickerCell]);

  // Add Row Handler
  const handleAddRow = (insertAtIndex?: number) => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const formattedDate = `${day}.${month}.${year}`;

    const newRow = createEmptyRow(currentSheet.rows.length + 1, formattedDate);

    const updatedSheets = sheets.map(sheet => {
      if (sheet.id !== currentSheet.id) return sheet;
      const newRows = [...sheet.rows];
      if (typeof insertAtIndex === 'number' && insertAtIndex >= 0 && insertAtIndex <= newRows.length) {
        newRows.splice(insertAtIndex, 0, newRow);
      } else {
        newRows.push(newRow);
      }
      return { ...sheet, rows: newRows };
    });

    saveSheets(updatedSheets);

    // If added at the end, navigate to that page
    if (typeof insertAtIndex !== 'number') {
      const newTotal = currentSheet.rows.length + 1;
      const targetPage = Math.ceil(newTotal / PAGE_SIZE);
      setCurrentPage(targetPage);
    }

    toast.success('New row added');
  };

  // Delete Row Handler
  const handleDeleteRow = (rowId: string) => {
    const updatedSheets = sheets.map(sheet => {
      if (sheet.id !== currentSheet.id) return sheet;
      return {
        ...sheet,
        rows: sheet.rows.filter(r => r.id !== rowId)
      };
    });

    saveSheets(updatedSheets);
    setSelectedRowIds(prev => prev.filter(id => id !== rowId));
    toast.success('Row deleted');
  };

  // Bulk Delete Selected Rows
  const handleBulkDelete = () => {
    if (selectedRowIds.length === 0) return;
    const count = selectedRowIds.length;

    const updatedSheets = sheets.map(sheet => {
      if (sheet.id !== currentSheet.id) return sheet;
      return {
        ...sheet,
        rows: sheet.rows.filter(r => !selectedRowIds.includes(r.id))
      };
    });

    saveSheets(updatedSheets);
    setSelectedRowIds([]);
    toast.success(`Deleted ${count} selected rows`);
  };

  // Duplicate Row
  const handleDuplicateRow = (rowId: string) => {
    const targetRow = currentSheet.rows.find(r => r.id === rowId);
    if (!targetRow) return;

    const targetIdx = currentSheet.rows.findIndex(r => r.id === rowId);
    const duplicatedRow: SheetRow = {
      ...targetRow,
      id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
    };

    const updatedSheets = sheets.map(sheet => {
      if (sheet.id !== currentSheet.id) return sheet;
      const newRows = [...sheet.rows];
      newRows.splice(targetIdx + 1, 0, duplicatedRow);
      return { ...sheet, rows: newRows };
    });

    saveSheets(updatedSheets);
    toast.success('Row duplicated');
  };

  // Clear Row Contents
  const handleClearRow = (rowId: string) => {
    const updatedSheets = sheets.map(sheet => {
      if (sheet.id !== currentSheet.id) return sheet;
      const updatedRows = sheet.rows.map(r => {
        if (r.id !== rowId) return r;
        const cleared: SheetRow = { id: r.id };
        currentSheet.columns.forEach(col => {
          cleared[col.id] = col.id === 'date' ? r.date || '' : '';
        });
        return cleared;
      });
      return { ...sheet, rows: updatedRows };
    });
    saveSheets(updatedSheets);
    toast.success('Row cleared');
  };

  // Header Renaming
  const startEditingHeader = (col: ColumnDef) => {
    setEditingHeaderColId(col.id);
    setHeaderEditTitle(col.label);
  };

  const commitHeaderEdit = () => {
    if (!editingHeaderColId || !headerEditTitle.trim()) {
      setEditingHeaderColId(null);
      return;
    }

    const updatedSheets = sheets.map(sheet => {
      if (sheet.id !== currentSheet.id) return sheet;
      const updatedCols = sheet.columns.map(col => {
        if (col.id !== editingHeaderColId) return col;
        return { ...col, label: headerEditTitle.trim() };
      });
      return { ...sheet, columns: updatedCols };
    });

    saveSheets(updatedSheets);
    setEditingHeaderColId(null);
    toast.success('Column header updated');
  };

  // Add New Column
  const handleAddColumn = () => {
    if (!newColumnName.trim()) {
      toast.error('Please enter a column title');
      return;
    }

    const colKey = `col_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newCol: ColumnDef = {
      id: colKey,
      label: newColumnName.trim(),
      width: 160,
      type: newColumnType
    };

    const updatedSheets = sheets.map(sheet => {
      if (sheet.id !== currentSheet.id) return sheet;
      return {
        ...sheet,
        columns: [...sheet.columns, newCol]
      };
    });

    saveSheets(updatedSheets);
    setNewColumnName('');
    setIsAddColumnOpen(false);
    toast.success(`Column "${newCol.label}" added successfully`);
  };

  // Delete Column
  const handleDeleteColumn = (colId: string) => {
    if (currentSheet.columns.length <= 1) {
      toast.error('A sheet must have at least one column');
      return;
    }

    const colToDelete = currentSheet.columns.find(c => c.id === colId);
    const updatedSheets = sheets.map(sheet => {
      if (sheet.id !== currentSheet.id) return sheet;
      return {
        ...sheet,
        columns: sheet.columns.filter(c => c.id !== colId)
      };
    });

    saveSheets(updatedSheets);
    toast.success(`Column "${colToDelete?.label || ''}" deleted`);
  };

  // Sheet Tabs Actions
  const handleAddSheet = () => {
    const newSheetNumber = sheets.length + 1;
    const newSheet: SheetData = {
      id: `sheet-${Date.now()}`,
      name: `Sheet ${newSheetNumber}`,
      columns: [...DEFAULT_COLUMNS],
      rows: generateInitialRows(25)
    };

    const updated = [...sheets, newSheet];
    saveSheets(updated);
    setActiveSheetId(newSheet.id);
    setCurrentPage(1);
    toast.success(`Created "${newSheet.name}"`);
  };

  const handleClearEntireSheet = (sheetId: string) => {
    const targetSheet = sheets.find(s => s.id === sheetId);
    const updated = sheets.map(s => {
      if (s.id !== sheetId) return s;
      return {
        ...s,
        rows: generateInitialRows(25)
      };
    });
    saveSheets(updated);
    setSelectedRowIds([]);
    toast.success(`Cleared all data in "${targetSheet?.name || 'sheet'}"`);
  };

  const handleRenameSheet = (sheetId: string) => {
    if (!sheetRenameValue.trim()) {
      setEditingSheetId(null);
      return;
    }

    const updated = sheets.map(s => {
      if (s.id !== sheetId) return s;
      return { ...s, name: sheetRenameValue.trim() };
    });

    saveSheets(updated);
    setEditingSheetId(null);
    toast.success('Sheet renamed');
  };

  const handleDeleteSheet = (sheetId: string) => {
    if (sheets.length <= 1) {
      toast.error('You cannot delete the only sheet');
      return;
    }

    const sheetToDelete = sheets.find(s => s.id === sheetId);
    const updated = sheets.filter(s => s.id !== sheetId);
    saveSheets(updated);

    if (activeSheetId === sheetId) {
      setActiveSheetId(updated[0].id);
      setCurrentPage(1);
    }

    toast.success(`Deleted sheet "${sheetToDelete?.name || ''}"`);
  };

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Export all sheets or active sheet
      sheets.forEach(sheet => {
        const headers = sheet.columns.map(c => c.label);
        const dataRows = sheet.rows.map(row => {
          return sheet.columns.map(c => row[c.id] || '');
        });

        const sheetData = [headers, ...dataRows];
        const ws = XLSX.utils.aoa_to_sheet(sheetData);

        // Auto width
        const colWidths = sheet.columns.map(c => ({ wch: Math.max(12, (c.label || '').length + 4) }));
        ws['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, sheet.name.substring(0, 31));
      });

      const todayStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `Daily_Tasks_${todayStr}.xlsx`);
      toast.success('Excel workbook exported successfully!');
    } catch (e) {
      console.error('Export error:', e);
      toast.error('Failed to export Excel file');
    }
  };

  // Import from Excel (.xlsx/.csv)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawJson: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (!rawJson || rawJson.length === 0) {
          toast.error('Uploaded file is empty');
          return;
        }

        const headerRow = rawJson[0] as string[];
        const dataRows = rawJson.slice(1);

        // Build columns
        const importedColumns: ColumnDef[] = headerRow.map((h, i) => {
          const colLabel = String(h || `Column ${i + 1}`).trim();
          const colId = colLabel.toLowerCase().replace(/[^a-zA-Z0-9]/g, '') || `col_${i}`;
          return {
            id: colId,
            label: colLabel,
            width: 160,
            type: colLabel.toLowerCase().includes('status') ? 'select' : 'text',
            options: colLabel.toLowerCase().includes('status') 
              ? ['Waiting for Image', 'Image Received', 'Cancel', 'In Progress', 'Completed'] 
              : undefined
          };
        });

        // Build rows
        const importedRows: SheetRow[] = dataRows.map((rowArr, rowIdx) => {
          const rowObj: SheetRow = { id: `row-imported-${Date.now()}-${rowIdx}` };
          importedColumns.forEach((col, colIdx) => {
            rowObj[col.id] = rowArr[colIdx] !== undefined ? String(rowArr[colIdx]) : '';
          });
          return rowObj;
        });

        // Make sure at least 25 rows exist
        const finalRows = generateInitialRows(importedRows, Math.max(25, importedRows.length));

        const newSheetName = file.name.replace(/\.[^/.]+$/, '').substring(0, 31);
        const newSheet: SheetData = {
          id: `sheet-imp-${Date.now()}`,
          name: newSheetName || 'Imported Sheet',
          columns: importedColumns.length > 0 ? importedColumns : [...DEFAULT_COLUMNS],
          rows: finalRows
        };

        const updatedSheets = [...sheets, newSheet];
        saveSheets(updatedSheets);
        setActiveSheetId(newSheet.id);
        setCurrentPage(1);

        toast.success(`Imported ${importedRows.length} rows into new sheet "${newSheet.name}"`);
      } catch (err) {
        console.error('File import error:', err);
        toast.error('Failed to parse Excel file');
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Select all rows on current page
  const handleSelectAllOnPage = (checked: boolean) => {
    if (checked) {
      const pageIds = paginatedRows.map(r => r.id);
      setSelectedRowIds(prev => Array.from(new Set([...prev, ...pageIds])));
    } else {
      const pageIds = new Set(paginatedRows.map(r => r.id));
      setSelectedRowIds(prev => prev.filter(id => !pageIds.has(id)));
    }
  };

  const isAllPageSelected = paginatedRows.length > 0 && paginatedRows.every(r => selectedRowIds.includes(r.id));
  const isSomePageSelected = paginatedRows.some(r => selectedRowIds.includes(r.id)) && !isAllPageSelected;

  // Status Badge Colors mapping to match 2nd image
  const getStatusBadgeStyle = (statusVal: string) => {
    return getDropdownOptionBadgeStyle(statusVal);
  };

  // Column Letters (A, B, C, D, E, ...)
  const getColumnLetter = (index: number) => {
    let letter = '';
    while (index >= 0) {
      letter = String.fromCharCode((index % 26) + 65) + letter;
      index = Math.floor(index / 26) - 1;
    }
    return letter;
  };

  return (
    <div 
      className={`w-full h-full flex flex-col space-y-4 pb-6 select-none font-sans relative rounded-2xl ${dailyTasksWallpaper ? 'wallpaper-active' : ''}`}
    >
      {/* Hidden File Input for Excel Import */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept=".xlsx,.xls,.csv" 
        className="hidden" 
      />

      {/* TOP CONTROL PANEL / HERO BAR */}
      <div className={`backdrop-blur-xl border rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden transition-all duration-300 daily-tasks-panel ${dailyTasksWallpaper ? 'bg-[#0b1329]/45 border-cyan-500/30' : 'bg-[#0b1329]/95 border-cyan-500/20'}`}>
        {/* Subtle glowing ambient lights */}
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          {/* Header Title & Tab Indicator */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-white/20">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  Daily Tasks Spreadsheet
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  {currentSheet.name}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 font-medium">
                Live interactive data grid &bull; 25 rows per page &bull; Editable headers & cells
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Wallpaper Selector Button immediately to left of Total Rows */}
            <div className="relative group">
              <input 
                type="file" 
                ref={wallpaperFileInputRef} 
                onChange={handleWallpaperUpload} 
                accept="image/*" 
                className="hidden" 
              />
              <div className={`daily-tasks-metric border border-cyan-500/40 hover:border-cyan-400 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-sm transition-all ${dailyTasksWallpaper ? 'bg-[#131d38]/50 backdrop-blur-md' : 'bg-[#131d38]'}`}>
                <button
                  type="button"
                  onClick={() => wallpaperFileInputRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs font-black text-cyan-300 hover:text-white transition-colors cursor-pointer"
                  title="Upload Wallpaper Image for Daily Tasks Section"
                >
                  <ImageIcon className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                  <span className="uppercase tracking-wider text-[10px]">Wallpaper</span>
                </button>

                {dailyTasksWallpaper && (
                  <button
                    type="button"
                    onClick={handleClearWallpaper}
                    className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer ml-0.5"
                    title="Remove Wallpaper"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className={`daily-tasks-metric border border-slate-700/60 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-sm ${dailyTasksWallpaper ? 'bg-[#131d38]/50 backdrop-blur-md' : 'bg-[#131d38]'}`}>
              <Layers className="w-4 h-4 text-cyan-400" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Rows</div>
                <div className="text-sm font-extrabold text-white">{summaryStats.totalRows}</div>
              </div>
            </div>

            <div className={`daily-tasks-metric border border-orange-500/30 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-sm ${dailyTasksWallpaper ? 'bg-[#131d38]/50 backdrop-blur-md' : 'bg-[#131d38]'}`}>
              <Clock className="w-4 h-4 text-orange-400" />
              <div>
                <div className="text-[10px] text-orange-300 uppercase font-bold tracking-wider">Waiting Image</div>
                <div className="text-sm font-extrabold text-orange-400">{summaryStats.waitingCount}</div>
              </div>
            </div>

            <div className={`daily-tasks-metric border border-emerald-500/30 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-sm ${dailyTasksWallpaper ? 'bg-[#131d38]/50 backdrop-blur-md' : 'bg-[#131d38]'}`}>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <div>
                <div className="text-[10px] text-emerald-300 uppercase font-bold tracking-wider">Image Received</div>
                <div className="text-sm font-extrabold text-emerald-400">{summaryStats.receivedCount}</div>
              </div>
            </div>

            <div className={`daily-tasks-metric border border-rose-500/30 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-sm ${dailyTasksWallpaper ? 'bg-[#131d38]/50 backdrop-blur-md' : 'bg-[#131d38]'}`}>
              <XCircle className="w-4 h-4 text-rose-400" />
              <div>
                <div className="text-[10px] text-rose-300 uppercase font-bold tracking-wider">Cancelled</div>
                <div className="text-sm font-extrabold text-rose-400">{summaryStats.cancelCount}</div>
              </div>
            </div>

            {summaryStats.totalQuantity > 0 && (
              <div className={`daily-tasks-metric border border-blue-500/30 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-sm ${dailyTasksWallpaper ? 'bg-[#131d38]/50 backdrop-blur-md' : 'bg-[#131d38]'}`}>
                <Hash className="w-4 h-4 text-blue-400" />
                <div>
                  <div className="text-[10px] text-blue-300 uppercase font-bold tracking-wider">Total Count</div>
                  <div className="text-sm font-extrabold text-blue-400">{summaryStats.totalQuantity}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* TOOLBAR & SEARCH SECTION */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box & Status Filter */}
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search anything in sheet (phone, comments, count, date...)"
                className="w-full bg-[#131d38] text-slate-100 placeholder-slate-500 text-xs sm:text-sm pl-10 pr-9 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-cyan-400 transition-colors shadow-inner"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Status Filter Pill Dropdown */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-[#131d38] text-slate-200 text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-cyan-400 cursor-pointer font-medium"
              >
                <option value="All">All Statuses</option>
                <option value="Waiting for Image">Waiting for Image</option>
                <option value="Image Received">Image Received</option>
                <option value="Cancel">Cancel</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Undo / Redo */}
            <div className="flex items-center bg-[#131d38] rounded-xl border border-slate-700 p-0.5">
              <button 
                onClick={handleUndo}
                title="Undo (Ctrl+Z)"
                className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button 
                onClick={handleRedo}
                title="Redo (Ctrl+Y)"
                className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>

            {/* ✨ MANAGE HEADERS & DROPDOWNS BUTTON (Placed directly to the left of Add Row) */}
            <button 
              onClick={() => setIsHeaderManagerOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-lg shadow-indigo-500/25 border border-indigo-400/30 transition-all active:scale-95 group"
              title="Manage Column Headers & Custom Dropdown Options"
            >
              <SlidersHorizontal className="w-4 h-4 text-indigo-200 group-hover:rotate-90 transition-transform duration-300" />
              <span>Manage Headers & Dropdowns</span>
            </button>

            {/* Add Row Button */}
            <button 
              onClick={() => handleAddRow()}
              className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-cyan-500/20 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Row</span>
            </button>

            {/* Add Column Popover */}
            <Popover open={isAddColumnOpen} onOpenChange={setIsAddColumnOpen}>
              <PopoverTrigger asChild>
                <button 
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#131d38] hover:bg-[#1a274c] text-cyan-300 border border-cyan-500/30 text-xs sm:text-sm font-bold rounded-xl transition-colors shadow-sm"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Add Column</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 bg-[#0d162d] border border-cyan-500/30 text-slate-100 p-4 rounded-xl shadow-2xl">
                <div className="space-y-3">
                  <h3 className="font-bold text-sm text-cyan-300 flex items-center gap-1.5">
                    <PlusCircle className="w-4 h-4" /> Add New Column
                  </h3>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Column Header Name</label>
                    <input 
                      type="text" 
                      value={newColumnName}
                      onChange={(e) => setNewColumnName(e.target.value)}
                      placeholder="e.g. Courier Tracking No."
                      className="w-full bg-[#172344] border border-slate-700 text-white text-xs sm:text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-cyan-400"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddColumn();
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Column Type</label>
                    <select 
                      value={newColumnType}
                      onChange={(e) => setNewColumnType(e.target.value as any)}
                      className="w-full bg-[#172344] border border-slate-700 text-white text-xs sm:text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-cyan-400"
                    >
                      <option value="text">Text / General</option>
                      <option value="number">Number / Quantity</option>
                      <option value="date">Date</option>
                      <option value="select">Status Dropdown</option>
                    </select>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button 
                      onClick={() => setIsAddColumnOpen(false)}
                      className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleAddColumn}
                      className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded-lg transition-colors shadow-sm"
                    >
                      Create Column
                    </button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Excel Export */}
            <button 
              onClick={handleExportExcel}
              title="Export all sheets to Excel (.xlsx)"
              className="flex items-center gap-1.5 px-3 py-2 bg-[#131d38] hover:bg-[#1a274c] text-emerald-400 border border-emerald-500/30 text-xs sm:text-sm font-bold rounded-xl transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span> Excel
            </button>

            {/* Excel Import */}
            <button 
              onClick={() => fileInputRef.current?.click()}
              title="Import Excel file (.xlsx, .csv)"
              className="flex items-center gap-1.5 px-3 py-2 bg-[#131d38] hover:bg-[#1a274c] text-indigo-300 border border-indigo-500/30 text-xs sm:text-sm font-bold rounded-xl transition-colors shadow-sm"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Import</span> Excel
            </button>

            {/* Bulk Delete Button if items selected */}
            {selectedRowIds.length > 0 && (
              <button 
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs sm:text-sm font-bold rounded-xl transition-all animate-pulse"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete ({selectedRowIds.length})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SEARCH / FILTER ACTIVE INDICATOR BANNER */}
      {(searchQuery.trim() || statusFilter !== 'All') && (
        <div className="bg-cyan-950/40 border border-cyan-500/30 px-4 py-2 rounded-xl flex items-center justify-between text-xs sm:text-sm text-cyan-300">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-cyan-400" />
            <span>
              Showing <strong>{filteredRows.length}</strong> matching records 
              {searchQuery && <> for query "<strong>{searchQuery}</strong>"</>}
              {statusFilter !== 'All' && <> with status "<strong>{statusFilter}</strong>"</>}
            </span>
          </div>
          <button 
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('All');
            }}
            className="text-xs font-bold text-cyan-400 hover:text-cyan-200 underline"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* EXCEL SPREADSHEET MAIN CONTAINER */}
      <div className={`daily-tasks-table-container border rounded-2xl shadow-2xl flex-1 flex flex-col overflow-hidden relative transition-all ${dailyTasksWallpaper ? 'bg-[#0b1329]/35 backdrop-blur-xl border-white/15' : 'bg-[#0b1329] border-slate-800'}`}>
        {/* SPREADSHEET TABLE GRID (Scrollable) */}
        <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar border-b border-slate-800 max-h-[600px] min-h-[420px]">
          <table className="w-full border-collapse text-left text-xs sm:text-sm select-none">
            {/* TABLE HEADER (Cyan Excel Style like 2nd image) */}
            <thead className="sticky top-0 z-20 shadow-md">
              {/* Top Row: Excel Column Letters (A, B, C, D...) */}
              <tr className={`text-slate-400 font-mono text-[10px] uppercase border-b ${dailyTasksWallpaper ? 'bg-slate-950/40 backdrop-blur-md border-white/10 text-cyan-200' : 'bg-[#070e1f] border-slate-800'}`}>
                <th className={`w-12 text-center py-1 border-r ${dailyTasksWallpaper ? 'border-white/10 bg-slate-950/30' : 'border-slate-800/80 bg-[#060b18]'}`}>
                  #
                </th>
                {currentSheet.columns.map((col, idx) => (
                  <th 
                    key={`letter-${col.id}`} 
                    className={`py-1 px-3 border-r text-center tracking-wider ${dailyTasksWallpaper ? 'border-white/10' : 'border-slate-800/80'}`}
                    style={{ width: col.width ? `${col.width}px` : 'auto' }}
                  >
                    {getColumnLetter(idx)}
                  </th>
                ))}
                <th className={`w-14 text-center py-1 ${dailyTasksWallpaper ? 'bg-slate-950/30' : 'bg-[#060b18]'}`}>Actions</th>
              </tr>

              {/* Main Header Row (Vibrant Cyan background as in reference image) */}
              <tr className={`font-black tracking-tight border-b-2 ${dailyTasksWallpaper ? 'bg-gradient-to-r from-cyan-600/80 via-blue-600/80 to-cyan-600/80 backdrop-blur-md text-white border-cyan-400/50 shadow-md' : 'bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-400 text-slate-950 border-cyan-600'}`}>
                {/* Checkbox select all */}
                <th className={`w-12 py-3 px-2 text-center border-r ${dailyTasksWallpaper ? 'border-white/15 bg-cyan-600/60' : 'border-cyan-500/60 bg-cyan-400/95'}`}>
                  <div className="flex items-center justify-center">
                    <input 
                      type="checkbox"
                      checked={isAllPageSelected}
                      ref={el => {
                        if (el) el.indeterminate = isSomePageSelected;
                      }}
                      onChange={(e) => handleSelectAllOnPage(e.target.checked)}
                      className="w-4 h-4 rounded text-cyan-600 bg-white border-slate-600 focus:ring-0 cursor-pointer"
                    />
                  </div>
                </th>

                {/* Column Headers with Edit & Menu */}
                {currentSheet.columns.map((col, idx) => {
                  const isEditing = editingHeaderColId === col.id;

                  return (
                    <th 
                      key={col.id}
                      className={`py-2.5 px-3 border-r group relative ${dailyTasksWallpaper ? 'border-white/15 text-white' : 'border-cyan-500/60 text-slate-950 font-bold'}`}
                      style={{ width: col.width ? `${col.width}px` : 'auto' }}
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input 
                            ref={headerInputRef}
                            type="text"
                            value={headerEditTitle}
                            onChange={(e) => setHeaderEditTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitHeaderEdit();
                              if (e.key === 'Escape') setEditingHeaderColId(null);
                            }}
                            onBlur={commitHeaderEdit}
                            className="w-full bg-white text-slate-900 px-2 py-1 rounded text-xs font-bold border border-cyan-700 focus:outline-none"
                          />
                          <button 
                            onClick={commitHeaderEdit}
                            className="p-1 bg-cyan-700 text-white rounded hover:bg-cyan-800"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-1.5">
                          <span 
                            onDoubleClick={() => startEditingHeader(col)}
                            title="Double-click to rename header"
                            className="truncate cursor-pointer hover:underline flex-1"
                          >
                            {col.label}
                          </span>

                          {/* Column Header Dropdown Menu */}
                          <Popover>
                            <PopoverTrigger asChild>
                              <button 
                                className="opacity-60 group-hover:opacity-100 hover:bg-cyan-500/40 p-1 rounded transition-opacity"
                                title="Column options"
                              >
                                <MoreHorizontal className="w-3.5 h-3.5 text-slate-900" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 bg-[#0d162d] border border-cyan-500/40 text-slate-100 p-1 rounded-xl shadow-2xl z-50">
                              <div className="space-y-0.5 text-xs">
                                <button 
                                  onClick={() => startEditingHeader(col)}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[#19274e] rounded-lg text-slate-200"
                                >
                                  <Pencil className="w-3.5 h-3.5 text-cyan-400" /> Rename Header
                                </button>
                                <button 
                                  onClick={() => {
                                    // Sort ascending
                                    const updatedSheets = sheets.map(s => {
                                      if (s.id !== currentSheet.id) return s;
                                      const sortedRows = [...s.rows].sort((a, b) => 
                                        String(a[col.id] || '').localeCompare(String(b[col.id] || ''))
                                      );
                                      return { ...s, rows: sortedRows };
                                    });
                                    saveSheets(updatedSheets);
                                    toast.success(`Sorted by "${col.label}" (A-Z)`);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[#19274e] rounded-lg text-slate-200"
                                >
                                  <ArrowUp className="w-3.5 h-3.5 text-cyan-400" /> Sort (A to Z)
                                </button>
                                <button 
                                  onClick={() => {
                                    // Sort descending
                                    const updatedSheets = sheets.map(s => {
                                      if (s.id !== currentSheet.id) return s;
                                      const sortedRows = [...s.rows].sort((a, b) => 
                                        String(b[col.id] || '').localeCompare(String(a[col.id] || ''))
                                      );
                                      return { ...s, rows: sortedRows };
                                    });
                                    saveSheets(updatedSheets);
                                    toast.success(`Sorted by "${col.label}" (Z-A)`);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[#19274e] rounded-lg text-slate-200"
                                >
                                  <ArrowDown className="w-3.5 h-3.5 text-cyan-400" /> Sort (Z to A)
                                </button>
                                <div className="border-t border-slate-700/60 my-1" />
                                <button 
                                  onClick={() => handleDeleteColumn(col.id)}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-rose-500/20 text-rose-400 rounded-lg"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Delete Column
                                </button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      )}
                    </th>
                  );
                })}

                {/* Header Action spacer */}
                <th className={`w-14 py-2.5 px-2 text-center font-bold ${dailyTasksWallpaper ? 'bg-cyan-600/60 text-white' : 'bg-cyan-400/95 text-slate-950'}`}>
                  Edit
                </th>
              </tr>
            </thead>

            {/* TABLE BODY (Rows & Cells) */}
            <tbody className={`daily-tasks-table-body divide-y divide-slate-800/60 ${dailyTasksWallpaper ? 'bg-transparent' : 'bg-[#091024]'}`}>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td 
                    colSpan={currentSheet.columns.length + 2} 
                    className="text-center py-12 text-slate-400"
                  >
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <FileSpreadsheet className="w-8 h-8 text-slate-600" />
                      <p className="font-semibold text-sm">No records found matching your filters</p>
                      <button 
                        onClick={() => handleAddRow()}
                        className="mt-2 text-xs text-cyan-400 font-bold hover:underline"
                      >
                        + Add a new row to this sheet
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, rowIdx) => {
                  const globalRowIndex = (currentPage - 1) * PAGE_SIZE + rowIdx + 1;
                  const isRowSelected = selectedRowIds.includes(row.id);

                  return (
                    <tr 
                      key={row.id}
                      className={`group transition-colors ${
                        isRowSelected 
                          ? 'bg-cyan-950/50 border-l-4 border-l-cyan-400' 
                          : rowIdx % 2 === 0 
                            ? (dailyTasksWallpaper ? 'daily-tasks-row-even bg-[#0b132a]/35 hover:bg-[#111c3d]/60 backdrop-blur-xs' : 'bg-[#0b132a] hover:bg-[#111c3d]') 
                            : (dailyTasksWallpaper ? 'daily-tasks-row-odd bg-[#080e21]/20 hover:bg-[#111c3d]/60 backdrop-blur-xs' : 'bg-[#080e21] hover:bg-[#111c3d]')
                      }`}
                    >
                      {/* Row Index & Checkbox */}
                      <td className={`w-12 py-2 px-2 text-center border-r border-slate-800 text-slate-400 font-mono text-xs ${dailyTasksWallpaper ? 'bg-[#060b18]/25' : 'bg-[#060b18]/60'} group-hover:bg-[#080f26]`}>
                        <div className="flex items-center justify-center gap-1">
                          <input 
                            type="checkbox"
                            checked={isRowSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRowIds(prev => [...prev, row.id]);
                              } else {
                                setSelectedRowIds(prev => prev.filter(id => id !== row.id));
                              }
                            }}
                            className="w-3.5 h-3.5 rounded text-cyan-600 bg-slate-800 border-slate-700 focus:ring-0 cursor-pointer"
                          />
                          <span className="text-[11px] font-bold text-slate-400">{globalRowIndex}</span>
                        </div>
                      </td>

                      {/* Dynamic Columns Data Cells */}
                      {currentSheet.columns.map((col) => {
                        const cellValue = row[col.id] !== undefined ? row[col.id] : '';
                        const isCellSelected = selectedCell?.rowId === row.id && selectedCell?.colId === col.id;
                        const isCellEditing = editingCell?.rowId === row.id && editingCell?.colId === col.id;

                        const isDateColumn = col.id === 'date' || col.type === 'date' || col.id === 'birthday' || col.id === 'dispatch' || col.label.toLowerCase().includes('date') || col.label.toLowerCase().includes('birthday') || col.label.toLowerCase().includes('dispatch');

                        // Check if this is a Dropdown / Select Column
                        if (col.id === 'status' || col.type === 'select') {
                          const optionsList = (col.options && col.options.length > 0)
                            ? col.options
                            : ['Waiting for Image', 'Image Received', 'Cancel', 'In Progress', 'Completed'];

                          const isDropdownOpen = openDropdownCell?.rowId === row.id && openDropdownCell?.colId === col.id;

                          return (
                            <td 
                              key={`${row.id}-${col.id}`}
                              data-cell-id={`${row.id}-${col.id}`}
                              tabIndex={0}
                              onClick={() => {
                                setSelectedCell({ rowId: row.id, colId: col.id });
                              }}
                              onFocus={() => setSelectedCell({ rowId: row.id, colId: col.id })}
                              onKeyDown={(e) => handleCellKeyDown(e, row.id, col.id)}
                              className={`py-1.5 px-3 border-r border-slate-800/80 relative transition-all cursor-pointer ${
                                isCellSelected ? 'ring-2 ring-cyan-400 ring-inset z-10 bg-cyan-950/30' : ''
                              }`}
                            >
                              <Popover 
                                open={isDropdownOpen}
                                onOpenChange={(open) => {
                                  if (open) {
                                    setSelectedCell({ rowId: row.id, colId: col.id });
                                    setOpenDropdownCell({ rowId: row.id, colId: col.id });
                                  } else {
                                    setOpenDropdownCell(null);
                                  }
                                }}
                              >
                                <PopoverTrigger asChild>
                                  <div 
                                    className="cursor-pointer flex items-center justify-between w-full min-h-[22px]"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedCell({ rowId: row.id, colId: col.id });
                                      setOpenDropdownCell(prev => (prev?.rowId === row.id && prev?.colId === col.id ? null : { rowId: row.id, colId: col.id }));
                                    }}
                                  >
                                    {cellValue ? (
                                      <span className={`status-badge inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold transition-transform group-hover:scale-[1.02] ${getDropdownOptionBadgeStyle(cellValue)}`}>
                                        {cellValue}
                                      </span>
                                    ) : (
                                      <span className="text-slate-500/80 italic text-xs flex items-center gap-1 hover:text-slate-300">
                                        <Plus className="w-3 h-3" /> Select {col.label.toLowerCase()}
                                      </span>
                                    )}
                                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity ml-1 shrink-0" />
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent 
                                  className="w-64 bg-[#0d162d] border-2 border-indigo-500/40 text-slate-100 p-2.5 rounded-xl shadow-2xl z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
                                  align="start"
                                  sideOffset={6}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="space-y-2 text-xs">
                                    <div className="flex items-center justify-between px-1 border-b border-slate-700/60 pb-1.5">
                                      <span className="text-[11px] text-cyan-300 font-bold uppercase tracking-wider flex items-center gap-1">
                                        <Tag className="w-3 h-3 text-cyan-400" /> {col.label}
                                      </span>
                                      <div className="flex items-center gap-1.5">
                                        <button 
                                          onClick={() => setIsHeaderManagerOpen(true)}
                                          className="text-[10px] text-indigo-300 hover:text-white flex items-center gap-0.5 hover:underline mr-1"
                                          title="Configure options in Header Manager"
                                        >
                                          <Settings className="w-2.5 h-2.5" /> Setup
                                        </button>
                                        <button 
                                          onClick={() => setOpenDropdownCell(null)}
                                          className="p-0.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                                          title="Close (Esc)"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Options list */}
                                    <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                                      {optionsList.map(statusOpt => (
                                        <button 
                                          key={statusOpt}
                                          onClick={() => handleCellStatusChange(row.id, col.id, statusOpt)}
                                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left font-medium hover:bg-[#1a274d] transition-colors ${
                                            cellValue === statusOpt ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-200'
                                          }`}
                                        >
                                          <span className={`status-badge px-2 py-0.5 rounded-full text-[11px] ${getDropdownOptionBadgeStyle(statusOpt)}`}>
                                            {statusOpt}
                                          </span>
                                          {cellValue === statusOpt && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                                        </button>
                                      ))}
                                    </div>

                                    {/* Quick inline option adder */}
                                    <div className="pt-1.5 border-t border-slate-700/60">
                                      <div className="flex items-center gap-1">
                                        <input 
                                          type="text"
                                          placeholder="+ Add new choice..."
                                          value={quickOptionInputs[col.id] || ''}
                                          onChange={(e) => setQuickOptionInputs(prev => ({ ...prev, [col.id]: e.target.value }))}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              handleAddOptionToExistingColumn(col.id);
                                            }
                                          }}
                                          className="w-full bg-[#172344] text-white px-2 py-1 rounded text-[11px] border border-slate-700 focus:outline-none focus:border-indigo-400"
                                        />
                                        <button 
                                          onClick={() => handleAddOptionToExistingColumn(col.id)}
                                          className="p-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-bold shrink-0 px-2"
                                        >
                                          Add
                                        </button>
                                      </div>
                                    </div>

                                    {/* Bottom controls: Clear & Cancel */}
                                    <div className="border-t border-slate-700/60 pt-1.5 flex items-center justify-between">
                                      <button 
                                        onClick={() => handleCellStatusChange(row.id, col.id, '')}
                                        className="text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 px-2 py-0.5 rounded flex items-center gap-1 text-[11px]"
                                      >
                                        <Trash2 className="w-3 h-3" /> Clear
                                      </button>
                                      <button 
                                        onClick={() => setOpenDropdownCell(null)}
                                        className="px-2.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[11px] font-semibold border border-slate-700"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </td>
                          );
                        }

                        // Check if this is a Date Column (Smart Recommendation Popover & Quick Apply)
                        if (isDateColumn) {
                          const isDateOpen = datePickerCell?.rowId === row.id && datePickerCell?.colId === col.id;

                          return (
                            <td 
                              key={`${row.id}-${col.id}`}
                              data-cell-id={`${row.id}-${col.id}`}
                              tabIndex={0}
                              onClick={() => {
                                setSelectedCell({ rowId: row.id, colId: col.id });
                                setDatePickerCell(null);
                              }}
                              onDoubleClick={() => {
                                setDatePickerCell(null);
                                startEditingCell(row.id, col.id, cellValue);
                              }}
                              onKeyDown={(e) => handleCellKeyDown(e, row.id, col.id)}
                              className={`py-2 px-3 border-r border-slate-800/80 text-slate-200 text-xs sm:text-sm font-medium relative focus:outline-none transition-all cursor-pointer ${
                                isCellSelected 
                                  ? 'ring-2 ring-cyan-400 ring-inset bg-cyan-950/30 z-10' 
                                  : 'hover:bg-[#142144]'
                              }`}
                            >
                              {isCellEditing ? (
                                <input 
                                  ref={cellInputRef}
                                  type="text"
                                  value={cellEditValue}
                                  onChange={(e) => setCellEditValue(e.target.value)}
                                  onBlur={commitCellEdit}
                                  onKeyDown={(e) => handleCellKeyDown(e, row.id, col.id)}
                                  className="w-full bg-[#18264e] text-white px-2 py-1 rounded text-xs sm:text-sm border border-cyan-400 focus:outline-none shadow-inner"
                                />
                              ) : (
                                <Popover 
                                  open={isDateOpen} 
                                  onOpenChange={(open) => {
                                    if (open) {
                                      setSelectedCell({ rowId: row.id, colId: col.id });
                                      setDatePickerCell({ rowId: row.id, colId: col.id });
                                    } else {
                                      setDatePickerCell(null);
                                    }
                                  }}
                                >
                                  <div className="flex items-center justify-between w-full min-h-[20px] group/date">
                                    <div className="truncate flex items-center gap-1.5 flex-1 min-h-[20px]">
                                      {cellValue ? (
                                        <span className="font-semibold text-cyan-200">
                                          {cellValue}
                                        </span>
                                      ) : null}
                                    </div>
                                    <PopoverTrigger asChild>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedCell({ rowId: row.id, colId: col.id });
                                          setDatePickerCell({ rowId: row.id, colId: col.id });
                                        }}
                                        className="p-0.5 text-cyan-400/60 hover:text-cyan-300 opacity-0 group-hover/date:opacity-100 transition-opacity ml-1 shrink-0 rounded hover:bg-cyan-500/20"
                                        title="Open Date Recommendation"
                                      >
                                        <CalendarIcon className="w-3.5 h-3.5" />
                                      </button>
                                    </PopoverTrigger>
                                  </div>

                                  <PopoverContent 
                                    className="w-80 sm:w-84 bg-[#0b1328] border-2 border-cyan-500/40 text-slate-100 p-3 rounded-2xl shadow-2xl z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
                                    align="start"
                                    sideOffset={6}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="space-y-3">
                                      {/* Popover Header */}
                                      <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                                        <div className="flex items-center gap-1.5 text-cyan-300 font-bold text-xs">
                                          <CalendarIcon className="w-4 h-4 text-cyan-400" />
                                          <span>Date Recommendation</span>
                                        </div>
                                        <button 
                                          onClick={() => setDatePickerCell(null)}
                                          className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors"
                                          title="Decline / Close (Esc)"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>

                                      {/* Primary Auto Recommendation Box */}
                                      <div className="bg-gradient-to-br from-cyan-950/80 via-[#0e1f3d] to-blue-950/80 border border-cyan-500/50 rounded-xl p-2.5 shadow-lg relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 bg-cyan-500/20 text-cyan-300 text-[10px] font-extrabold px-2 py-0.5 rounded-bl-lg border-b border-l border-cyan-500/30 flex items-center gap-1">
                                          <Sparkles className="w-3 h-3 text-cyan-400" /> Today
                                        </div>
                                        
                                        <div className="text-[11px] text-slate-400 mb-0.5 flex items-center gap-1">
                                          <span>Automatic Date:</span>
                                          <span className="text-slate-200 font-medium">
                                            {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                                          </span>
                                        </div>
                                        
                                        <div className="text-base font-black text-cyan-300 tracking-wider mb-2.5 font-mono">
                                          {getTodayFormatted(datePreferredFormat)}
                                        </div>

                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() => handleApplyDate(row.id, col.id, getTodayFormatted(datePreferredFormat))}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-xs rounded-lg shadow-md shadow-cyan-500/20 active:scale-95 transition-all"
                                          >
                                            <Check className="w-4 h-4 stroke-[3]" />
                                            <span>Apply Today</span>
                                          </button>

                                          <button
                                            onClick={() => setDatePickerCell(null)}
                                            className="py-1.5 px-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs rounded-lg border border-slate-700 transition-colors"
                                            title="Decline suggestion"
                                          >
                                            Decline
                                          </button>
                                        </div>
                                      </div>

                                      {/* Quick Chips: Yesterday, Today, Tomorrow */}
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          onClick={() => handleApplyDate(row.id, col.id, getOffsetDateFormatted(-1, datePreferredFormat))}
                                          className="flex-1 py-1 px-1 bg-[#131e3d] hover:bg-[#1a2a54] text-slate-300 hover:text-cyan-300 border border-slate-700/80 hover:border-cyan-500/40 rounded-lg text-[10px] font-semibold text-center transition-all"
                                        >
                                          <span className="block text-[9px] text-slate-400">Yesterday</span>
                                          <span className="font-mono text-cyan-300 font-bold">{getOffsetDateFormatted(-1, datePreferredFormat)}</span>
                                        </button>

                                        <button
                                          onClick={() => handleApplyDate(row.id, col.id, getTodayFormatted(datePreferredFormat))}
                                          className="flex-1 py-1 px-1 bg-cyan-950/40 hover:bg-cyan-900/50 text-cyan-300 border border-cyan-500/40 rounded-lg text-[10px] font-semibold text-center transition-all shadow-sm"
                                        >
                                          <span className="block text-[9px] text-cyan-400 font-bold">Today</span>
                                          <span className="font-mono font-black">{getTodayFormatted(datePreferredFormat)}</span>
                                        </button>

                                        <button
                                          onClick={() => handleApplyDate(row.id, col.id, getOffsetDateFormatted(1, datePreferredFormat))}
                                          className="flex-1 py-1 px-1 bg-[#131e3d] hover:bg-[#1a2a54] text-slate-300 hover:text-cyan-300 border border-slate-700/80 hover:border-cyan-500/40 rounded-lg text-[10px] font-semibold text-center transition-all"
                                        >
                                          <span className="block text-[9px] text-slate-400">Tomorrow</span>
                                          <span className="font-mono text-cyan-300 font-bold">{getOffsetDateFormatted(1, datePreferredFormat)}</span>
                                        </button>
                                      </div>

                                      {/* Mini Interactive Calendar Picker */}
                                      <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#070d1e] p-1 flex justify-center">
                                        <CalendarUI
                                          mode="single"
                                          selected={parseCellDateToDate(cellValue)}
                                          onSelect={(selectedDate) => {
                                            if (selectedDate) {
                                              handleApplyDate(row.id, col.id, formatDateToString(selectedDate, datePreferredFormat));
                                            }
                                          }}
                                          className="rounded-lg border-0 p-1 scale-90 origin-center"
                                        />
                                      </div>

                                      {/* Bottom Controls: Format Switcher & Actions */}
                                      <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
                                        <div className="flex items-center gap-1">
                                          <span className="text-slate-400 text-[10px]">Format:</span>
                                          <button
                                            onClick={() => setDatePreferredFormat('dot')}
                                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                              datePreferredFormat === 'dot' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
                                            }`}
                                            title="DD.MM.YYYY"
                                          >
                                            .
                                          </button>
                                          <button
                                            onClick={() => setDatePreferredFormat('dash')}
                                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                              datePreferredFormat === 'dash' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
                                            }`}
                                            title="DD-MM-YYYY"
                                          >
                                            -
                                          </button>
                                          <button
                                            onClick={() => setDatePreferredFormat('text')}
                                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                              datePreferredFormat === 'text' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
                                            }`}
                                            title="DD Mon YYYY"
                                          >
                                            Abc
                                          </button>
                                        </div>

                                        <div className="flex items-center gap-1">
                                          {cellValue && (
                                            <button
                                              onClick={() => handleApplyDate(row.id, col.id, '')}
                                              className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-2 py-0.5 rounded flex items-center gap-1"
                                              title="Clear date"
                                            >
                                              <Trash2 className="w-3 h-3" /> Clear
                                            </button>
                                          )}
                                          <button
                                            onClick={() => {
                                              setDatePickerCell(null);
                                              startEditingCell(row.id, col.id, cellValue);
                                            }}
                                            className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 px-2 py-0.5 rounded flex items-center gap-1"
                                            title="Type custom date manually"
                                          >
                                            <Pencil className="w-3 h-3" /> Type
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              )}

                              {/* Excel-style active cell corner marker */}
                              {isCellSelected && !isCellEditing && (
                                <div className="absolute right-0 bottom-0 w-2 h-2 bg-cyan-400 pointer-events-none" />
                              )}
                            </td>
                          );
                        }

                        // Regular Editable Cell
                        return (
                          <td 
                            key={`${row.id}-${col.id}`}
                            data-cell-id={`${row.id}-${col.id}`}
                            tabIndex={0}
                            onClick={() => setSelectedCell({ rowId: row.id, colId: col.id })}
                            onDoubleClick={() => startEditingCell(row.id, col.id, cellValue)}
                            onKeyDown={(e) => handleCellKeyDown(e, row.id, col.id)}
                            className={`py-2 px-3 border-r border-slate-800/80 text-slate-200 text-xs sm:text-sm font-medium relative focus:outline-none transition-all cursor-pointer ${
                              isCellSelected 
                                ? 'ring-2 ring-cyan-400 ring-inset bg-cyan-950/30 z-10' 
                                : 'hover:bg-[#142144]'
                            }`}
                          >
                            {isCellEditing ? (
                              <input 
                                ref={cellInputRef}
                                type={col.type === 'number' ? 'number' : 'text'}
                                value={cellEditValue}
                                onChange={(e) => setCellEditValue(e.target.value)}
                                onBlur={commitCellEdit}
                                onKeyDown={(e) => handleCellKeyDown(e, row.id, col.id)}
                                className="w-full bg-[#18264e] text-white px-2 py-1 rounded text-xs sm:text-sm border border-cyan-400 focus:outline-none shadow-inner"
                              />
                            ) : (
                              <div className="truncate min-h-[20px] flex items-center">
                                {cellValue ? (
                                  <span className={col.id === 'count' ? 'font-bold text-cyan-300' : ''}>
                                    {cellValue}
                                  </span>
                                ) : null}
                              </div>
                            )}

                            {/* Excel-style active cell corner marker */}
                            {isCellSelected && !isCellEditing && (
                              <div className="absolute right-0 bottom-0 w-2 h-2 bg-cyan-400 pointer-events-none" />
                            )}
                          </td>
                        );
                      })}

                      {/* Row Action Menu */}
                      <td className="w-14 py-1.5 px-2 text-center">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button 
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                              title="Row options"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-44 bg-[#0d162d] border border-cyan-500/40 text-slate-100 p-1 rounded-xl shadow-2xl z-50">
                            <div className="space-y-0.5 text-xs">
                              <button 
                                onClick={() => handleAddRow(globalRowIndex)}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[#19274e] rounded-lg text-slate-200"
                              >
                                <Plus className="w-3.5 h-3.5 text-cyan-400" /> Insert Row Below
                              </button>
                              <button 
                                onClick={() => handleDuplicateRow(row.id)}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[#19274e] rounded-lg text-slate-200"
                              >
                                <Copy className="w-3.5 h-3.5 text-blue-400" /> Duplicate Row
                              </button>
                              <button 
                                onClick={() => handleClearRow(row.id)}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[#19274e] rounded-lg text-slate-200"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-amber-400" /> Clear Row Data
                              </button>
                              <div className="border-t border-slate-700/60 my-1" />
                              <button 
                                onClick={() => handleDeleteRow(row.id)}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-rose-500/20 text-rose-400 rounded-lg"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete Row
                              </button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* BOTTOM PAGINATION BAR (25 details per page requirement) */}
        <div className={`daily-tasks-footer-bar px-4 py-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-slate-300 ${dailyTasksWallpaper ? 'bg-[#080f24]/50 backdrop-blur-md border-white/10' : 'bg-[#080f24]'}`}>
          {/* Row Counter info */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">
              Showing <strong>{totalRows === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}</strong> to{' '}
              <strong>{Math.min(currentPage * PAGE_SIZE, totalRows)}</strong> of <strong>{totalRows}</strong> details (25 per page)
            </span>
          </div>

          {/* Page Navigation Buttons */}
          <div className="flex items-center gap-1.5">
            {/* First Page */}
            <button 
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg bg-[#131d38] border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="First Page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>

            {/* Previous Page */}
            <button 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#131d38] border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            {/* Page number indicators */}
            <div className="flex items-center gap-1 mx-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .map((pageNum, idx, arr) => {
                  const showEllipsis = idx > 0 && pageNum - arr[idx - 1] > 1;
                  return (
                    <React.Fragment key={pageNum}>
                      {showEllipsis && <span className="text-slate-600 px-1 font-bold">...</span>}
                      <button 
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                          currentPage === pageNum 
                            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20' 
                            : 'bg-[#131d38] text-slate-300 hover:bg-slate-800 border border-slate-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    </React.Fragment>
                  );
                })}
            </div>

            {/* Next Page */}
            <button 
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#131d38] border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Last Page */}
            <button 
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg bg-[#131d38] border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Last Page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* BOTTOM MULTI-SHEET TABS BAR (as in Image 2: Chocolate Price, AUG, SEP, OCT, Wholesale Price...) */}
        <div className={`daily-tasks-tabs-bar px-4 py-2 border-t border-slate-800/90 flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar ${dailyTasksWallpaper ? 'bg-[#050914]/50 backdrop-blur-md border-white/10' : 'bg-[#050914]'}`}>
          <div className="flex items-center gap-1.5">
            {/* Add New Sheet (+) Button */}
            <button 
              onClick={handleAddSheet}
              title="Add New Sheet"
              className="p-2 rounded-lg bg-[#101a35] hover:bg-cyan-500/20 text-cyan-400 border border-slate-800 hover:border-cyan-500/40 transition-all flex items-center justify-center active:scale-95"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Sheet Tabs List */}
            {sheets.map(sheet => {
              const isActive = sheet.id === activeSheetId;
              const isRenaming = editingSheetId === sheet.id;

              return (
                <div 
                  key={sheet.id}
                  className={`group relative flex items-center rounded-xl transition-all ${
                    isActive 
                      ? 'bg-gradient-to-r from-blue-600/30 to-cyan-500/30 border border-cyan-400 text-white font-extrabold shadow-lg shadow-cyan-950/50' 
                      : 'bg-[#0f172e] hover:bg-[#162244] border border-slate-800 text-slate-400 hover:text-slate-200 font-semibold'
                  }`}
                >
                  {isRenaming ? (
                    <div className="flex items-center px-2 py-1 gap-1">
                      <input 
                        type="text"
                        value={sheetRenameValue}
                        onChange={(e) => setSheetRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameSheet(sheet.id);
                          if (e.key === 'Escape') setEditingSheetId(null);
                        }}
                        onBlur={() => handleRenameSheet(sheet.id)}
                        autoFocus
                        className="bg-[#172344] text-white text-xs px-2 py-0.5 rounded border border-cyan-400 focus:outline-none w-28"
                      />
                      <button 
                        onClick={() => handleRenameSheet(sheet.id)}
                        className="p-1 text-cyan-400"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => {
                        setActiveSheetId(sheet.id);
                        setCurrentPage(1);
                      }}
                      onDoubleClick={() => {
                        setEditingSheetId(sheet.id);
                        setSheetRenameValue(sheet.name);
                      }}
                      className="px-3.5 py-1.5 text-xs sm:text-sm tracking-wide flex items-center gap-1.5"
                    >
                      <span>{sheet.name}</span>
                      <span className="text-[10px] opacity-60 font-mono">({sheet.rows.length})</span>
                    </button>
                  )}

                  {/* Sheet Tab Menu */}
                  {!isRenaming && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button 
                          className={`pr-2 py-1.5 opacity-0 group-hover:opacity-100 hover:text-cyan-300 transition-opacity ${
                            isActive ? 'opacity-100 text-cyan-300' : 'text-slate-400'
                          }`}
                          title="Sheet settings"
                        >
                          <MoreHorizontal className="w-3 h-3" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-40 bg-[#0d162d] border border-cyan-500/40 text-slate-100 p-1 rounded-xl shadow-2xl z-50">
                        <div className="space-y-0.5 text-xs">
                          <button 
                            onClick={() => {
                              setEditingSheetId(sheet.id);
                              setSheetRenameValue(sheet.name);
                            }}
                            className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-[#19274e] rounded-lg text-slate-200"
                          >
                            <Pencil className="w-3 h-3 text-cyan-400" /> Rename Sheet
                          </button>
                          <button 
                            onClick={() => {
                              const dupSheet: SheetData = {
                                ...sheet,
                                id: `sheet-${Date.now()}`,
                                name: `${sheet.name} (Copy)`,
                                rows: JSON.parse(JSON.stringify(sheet.rows))
                              };
                              const updated = [...sheets, dupSheet];
                              saveSheets(updated);
                              setActiveSheetId(dupSheet.id);
                              toast.success('Sheet duplicated');
                            }}
                            className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-[#19274e] rounded-lg text-slate-200"
                          >
                            <Copy className="w-3 h-3 text-blue-400" /> Duplicate Sheet
                          </button>
                          <button 
                            onClick={() => handleClearEntireSheet(sheet.id)}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[#19274e] rounded-lg text-amber-400"
                          >
                            <RotateCcw className="w-3 h-3 text-amber-400" /> Clear Sheet Data
                          </button>
                          {sheets.length > 1 && (
                            <>
                              <div className="border-t border-slate-700/60 my-1" />
                              <button 
                                onClick={() => handleDeleteSheet(sheet.id)}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-rose-500/20 text-rose-400 rounded-lg"
                              >
                                <Trash2 className="w-3 h-3" /> Delete Sheet
                              </button>
                            </>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              );
            })}
          </div>

          <div className="text-[11px] text-slate-500 whitespace-nowrap hidden md:block">
            Double-click any cell or header to edit &bull; Press Enter / Tab to navigate
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 🎛️ COMPREHENSIVE HEADER & DROPDOWN MANAGER DIALOG MODAL */}
      {/* ========================================================================= */}
      <Dialog open={isHeaderManagerOpen} onOpenChange={setIsHeaderManagerOpen}>
        <DialogContent className="max-w-2xl bg-[#091024] border-2 border-indigo-500/40 text-slate-100 p-6 rounded-3xl shadow-2xl backdrop-blur-2xl max-h-[85vh] overflow-y-auto custom-scrollbar">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-xl font-black text-white flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <SlidersHorizontal className="w-4 h-4 text-white" />
              </div>
              <span>Header & Dropdown Manager</span>
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Add custom column headers, build dropdown choices with color tags, reorder columns, or configure existing headers.
            </DialogDescription>
          </DialogHeader>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 p-1 bg-[#101a38] rounded-xl border border-slate-700/80 my-2">
            <button
              onClick={() => setHeaderManagerTab('add')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                headerManagerTab === 'add'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Plus className="w-4 h-4" /> Add New Header
            </button>

            <button
              onClick={() => setHeaderManagerTab('manage')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                headerManagerTab === 'manage'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Settings className="w-4 h-4" /> Manage Existing Headers ({currentSheet.columns.length})
            </button>
          </div>

          {/* TAB 1: ADD NEW HEADER */}
          {headerManagerTab === 'add' && (
            <div className="space-y-4 pt-1">
              {/* Header Title */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Header Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={newColLabel}
                  onChange={(e) => setNewColLabel(e.target.value)}
                  placeholder="e.g. Courier Partner, Payment Status, Priority..."
                  className="w-full bg-[#131d3b] border border-slate-700 text-white text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-indigo-400 transition-colors shadow-inner"
                />
              </div>

              {/* Column Type Selector */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Column Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { type: 'select', label: 'Dropdown / Select', icon: Tag, desc: 'Choice list with colored badges' },
                    { type: 'text', label: 'Text / General', icon: ListPlus, desc: 'Free text notes' },
                    { type: 'date', label: 'Date Picker', icon: CalendarIcon, desc: 'Auto-today & calendar' },
                    { type: 'number', label: 'Number / Qty', icon: Hash, desc: 'Numeric values' }
                  ].map(t => (
                    <button
                      key={t.type}
                      type="button"
                      onClick={() => setNewColType(t.type as any)}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1 ${
                        newColType === t.type
                          ? 'bg-indigo-950/60 border-indigo-400 text-white shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-400'
                          : 'bg-[#131d3b] border-slate-700/80 text-slate-400 hover:text-slate-200 hover:bg-[#19274e]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <t.icon className={`w-4 h-4 ${newColType === t.type ? 'text-indigo-300' : 'text-slate-400'}`} />
                        <span>{t.label}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dropdown Options Builder (If select type) */}
              {newColType === 'select' && (
                <div className="bg-[#101a38] border border-indigo-500/30 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-indigo-400" /> Configure Dropdown Choices
                    </span>
                    <span className="text-[10px] text-slate-400">{newColOptions.length} choices added</span>
                  </div>

                  {/* Quick 1-Click Templates */}
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">Quick Templates (1-Click Fill):</span>
                    <div className="flex flex-wrap gap-1.5">
                      {DROPDOWN_PRESETS.map(preset => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => {
                            setNewColOptions([...preset.options]);
                            if (!newColLabel) setNewColLabel(preset.name);
                            toast.success(`Loaded "${preset.name}" preset choices`);
                          }}
                          className="px-2.5 py-1 bg-[#18264e] hover:bg-indigo-600/30 text-indigo-200 hover:text-white text-[11px] font-semibold rounded-lg border border-indigo-500/30 transition-colors"
                        >
                          ⚡ {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Add Custom Option Input */}
                  <div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newColOptionInput}
                        onChange={(e) => setNewColOptionInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddNewColOption();
                          }
                        }}
                        placeholder="Type a new dropdown choice and press Enter..."
                        className="flex-1 bg-[#172344] border border-slate-700 text-white text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-indigo-400"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddNewColOption()}
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-sm"
                      >
                        + Add Choice
                      </button>
                    </div>
                  </div>

                  {/* Options Tag Badges List */}
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto custom-scrollbar p-1">
                    {newColOptions.map((opt, idx) => (
                      <span
                        key={`${opt}-${idx}`}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${getDropdownOptionBadgeStyle(opt)}`}
                      >
                        <span>{opt}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveNewColOption(idx)}
                          className="text-slate-400 hover:text-rose-400 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Column Width Selector */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Column Width: <span className="text-indigo-300 font-mono">{newColWidth}px</span>
                </label>
                <div className="flex items-center gap-2">
                  {[120, 160, 200, 250].map(w => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setNewColWidth(w)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                        newColWidth === w
                          ? 'bg-indigo-600 text-white border-indigo-400'
                          : 'bg-[#131d3b] text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      {w === 120 ? 'Compact' : w === 160 ? 'Standard' : w === 200 ? 'Wide' : 'Extra Wide'} ({w}px)
                    </button>
                  ))}
                </div>
              </div>

              {/* Create Button */}
              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsHeaderManagerOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateHeader}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-indigo-500/25 active:scale-95 transition-all"
                >
                  ✨ Create Header & Add to Table
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: MANAGE EXISTING HEADERS */}
          {headerManagerTab === 'manage' && (
            <div className="space-y-3 pt-1">
              <div className="text-xs text-slate-400 mb-2">
                All active columns in this sheet. You can reorder, delete, edit header names, and add/remove dropdown choices for any column:
              </div>

              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
                {currentSheet.columns.map((col, idx) => {
                  const isDropdown = col.id === 'status' || col.type === 'select';
                  const options = col.options || (col.id === 'status' ? ['Waiting for Image', 'Image Received', 'Cancel', 'In Progress', 'Completed'] : []);

                  return (
                    <div
                      key={col.id}
                      className="bg-[#101a38] border border-slate-800 hover:border-indigo-500/40 rounded-xl p-3 space-y-2 transition-all shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="w-6 h-6 rounded-lg bg-[#18264e] text-indigo-300 font-mono text-xs font-black flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <input
                            type="text"
                            value={col.label}
                            onChange={(e) => {
                              const newLabel = e.target.value;
                              const updatedSheets = sheets.map(s => {
                                if (s.id !== currentSheet.id) return s;
                                return {
                                  ...s,
                                  columns: s.columns.map(c => c.id === col.id ? { ...c, label: newLabel } : c)
                                };
                              });
                              saveSheets(updatedSheets, false);
                            }}
                            className="bg-[#172344] text-white text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-400 flex-1 max-w-[200px]"
                          />
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            isDropdown 
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                              : col.type === 'date' || col.id === 'date' || col.id === 'birthday' || col.id === 'dispatch'
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                : 'bg-slate-700/50 text-slate-300 border border-slate-700'
                          }`}>
                            {isDropdown ? 'Dropdown' : col.type === 'date' || col.id === 'date' || col.id === 'birthday' || col.id === 'dispatch' ? 'Date' : 'Text'}
                          </span>
                        </div>

                        {/* Actions: Move left, Move right, Delete */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleMoveColumn(col.id, 'left')}
                            disabled={idx === 0}
                            className="p-1 text-slate-400 hover:text-white bg-[#172344] disabled:opacity-30 disabled:cursor-not-allowed rounded-lg"
                            title="Move Left"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleMoveColumn(col.id, 'right')}
                            disabled={idx === currentSheet.columns.length - 1}
                            className="p-1 text-slate-400 hover:text-white bg-[#172344] disabled:opacity-30 disabled:cursor-not-allowed rounded-lg"
                            title="Move Right"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteColumn(col.id)}
                            className="p-1 text-rose-400 hover:bg-rose-500/20 rounded-lg ml-1"
                            title="Delete Column"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* If Dropdown column: Display and add/remove options */}
                      {isDropdown && (
                        <div className="bg-[#0b1227] p-2.5 rounded-lg border border-indigo-500/20 space-y-2">
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span>Dropdown choices ({options.length}):</span>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {options.map((opt, optIdx) => (
                              <span
                                key={`${opt}-${optIdx}`}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${getDropdownOptionBadgeStyle(opt)}`}
                              >
                                <span>{opt}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveOptionFromExistingColumn(col.id, optIdx)}
                                  className="text-slate-400 hover:text-rose-400 ml-0.5"
                                  title="Remove choice"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </span>
                            ))}
                          </div>

                          {/* Add choice input */}
                          <div className="flex items-center gap-1.5 pt-1">
                            <input
                              type="text"
                              placeholder={`+ Add choice to ${col.label}...`}
                              value={quickOptionInputs[col.id] || ''}
                              onChange={(e) => setQuickOptionInputs(prev => ({ ...prev, [col.id]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddOptionToExistingColumn(col.id);
                                }
                              }}
                              className="flex-1 bg-[#131d3b] text-white text-xs px-2.5 py-1 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-400"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddOptionToExistingColumn(col.id)}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow-sm"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
                <button
                  onClick={() => setHeaderManagerTab('add')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" /> Add another new column
                </button>
                <button
                  onClick={() => setIsHeaderManagerOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
