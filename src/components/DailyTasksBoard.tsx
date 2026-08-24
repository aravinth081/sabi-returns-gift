import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { 
  Plus, X, Upload, Pencil, Trash2, Search, Download, 
  ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, Check, FileSpreadsheet, RotateCcw,
  RotateCw, Filter, MoreHorizontal, Copy, Calendar, Eye,
  Sparkles, CheckCircle2, Clock, AlertTriangle, XCircle, Hash,
  Layers, PlusCircle, MoveHorizontal, CheckSquare, Square,
  MessageCircle, Phone, HelpCircle, FileText, ArrowRight, CornerDownLeft,
  Image as ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
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
  { id: 'date', label: 'Date', width: 130, type: 'text' },
  { id: 'contactNumber', label: 'Contact Number', width: 180, type: 'text' },
  { id: 'count', label: 'Count', width: 110, type: 'text' },
  { id: 'birthday', label: 'Birthday', width: 140, type: 'text' },
  { id: 'dispatch', label: 'Dispatch', width: 130, type: 'text' },
  { id: 'comments', label: 'Comments', width: 230, type: 'text' },
  { 
    id: 'status', 
    label: 'Status', 
    width: 210, 
    type: 'select', 
    options: ['Waiting for Image', 'Image Received', 'Cancel', 'In Progress', 'Completed'] 
  },
  { id: 'cancelReason', label: 'Cancel Reason', width: 200, type: 'text' },
];

const createEmptyRow = (index: number, defaultDate: string = ''): SheetRow => ({
  id: `row-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 6)}`,
  date: defaultDate,
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
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();
  const formattedDate = `${day}.${month}.${year}`;

  for (let i = 0; i < totalCount; i++) {
    result.push(createEmptyRow(i + 1, formattedDate));
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

  // Wallpaper State
  const [wallpaper, setWallpaper] = useState<string>(() => {
    try {
      return localStorage.getItem('sabi_daily_tasks_wallpaper') || "";
    } catch (e) {
      return "";
    }
  });

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Selected Row IDs for multi-action
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);

  // Cell Editing & Selection State
  const [selectedCell, setSelectedCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [cellEditValue, setCellEditValue] = useState<string>('');

  // Column Header Editing
  const [editingHeaderColId, setEditingHeaderColId] = useState<string | null>(null);
  const [headerEditTitle, setHeaderEditTitle] = useState<string>('');

  // Add Column Modal / Popover
  const [isAddColumnOpen, setIsAddColumnOpen] = useState<boolean>(false);
  const [newColumnName, setNewColumnName] = useState<string>('');
  const [newColumnType, setNewColumnType] = useState<'text' | 'number' | 'date' | 'select'>('text');

  // Shortcuts Dialog State
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);

  // Sheet Tab Renaming
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [sheetRenameValue, setSheetRenameValue] = useState<string>('');

  // Sort State
  const [sortState, setSortState] = useState<{ colId: string; direction: 'asc' | 'desc' } | null>(null);

  // Undo / Redo History
  const historyRef = useRef<{ past: SheetData[][]; future: SheetData[][] }>({
    past: [],
    future: []
  });

  const isSyncingFromRemoteRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wallpaperFileInputRef = useRef<HTMLInputElement>(null);
  const cellInputRef = useRef<HTMLInputElement>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

    // Sync to Firestore
    try {
      const sheetDocRef = doc(db, 'daily_tasks_board', 'sheet_data');
      setDoc(sheetDocRef, {
        sheets: updatedSheets,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(err => {
        console.warn('Firestore sheet sync background note:', err);
      });
    } catch (err) {
      console.warn('Firestore sync failed:', err);
    }
  }, [sheets, pushHistory]);

  // Firestore Real-time Listener for Sheets
  useEffect(() => {
    try {
      const sheetDocRef = doc(db, 'daily_tasks_board', 'sheet_data');
      const unsubscribe = onSnapshot(sheetDocRef, (snapshot) => {
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
      return () => unsubscribe();
    } catch (e) {
      console.warn('Could not set up Firestore listener:', e);
    }
  }, []);

  // Firestore Wallpaper Real-time Listener & Local Storage Sync
  useEffect(() => {
    try {
      const wpDocRef = doc(db, 'daily_tasks_board', 'wallpaper_settings');
      const unsubscribe = onSnapshot(wpDocRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data && typeof data.wallpaper === 'string') {
            setWallpaper(data.wallpaper);
            try {
              if (data.wallpaper) {
                localStorage.setItem('sabi_daily_tasks_wallpaper', data.wallpaper);
              } else {
                localStorage.removeItem('sabi_daily_tasks_wallpaper');
              }
            } catch (e) {}
            if (onWallpaperChange) onWallpaperChange();
          }
        }
      }, (error) => {
        console.warn('Firestore wallpaper listener note:', error);
      });
      return () => unsubscribe();
    } catch (e) {}
  }, [onWallpaperChange]);

  useEffect(() => {
    const handleWpEvent = () => {
      const wp = localStorage.getItem('sabi_daily_tasks_wallpaper') || "";
      setWallpaper(wp);
    };
    window.addEventListener('sabi-daily-tasks-wallpaper-changed', handleWpEvent);
    return () => {
      window.removeEventListener('sabi-daily-tasks-wallpaper-changed', handleWpEvent);
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
      } else if (e.key === '/' && !editingCell && !editingHeaderColId && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === '?' && !editingCell && !editingHeaderColId && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        setIsShortcutsOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('sabi-daily-tasks-undo', onUndoEvent);
      window.removeEventListener('sabi-daily-tasks-redo', onRedoEvent);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [handleUndo, handleRedo, editingCell, editingHeaderColId]);

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
    const cancelCount = allRows.filter(r => r.status === 'Cancel' || r.status === 'Cancelled').length;
    const inProgressCount = allRows.filter(r => r.status === 'In Progress').length;
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
      inProgressCount,
      completedCount,
      totalQuantity
    };
  }, [currentSheet]);

  // Filtered, Searched & Sorted Rows
  const filteredRows = useMemo(() => {
    if (!currentSheet || !currentSheet.rows) return [];
    let rows = [...currentSheet.rows];

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

    // Sorting
    if (sortState) {
      rows.sort((a, b) => {
        const valA = String(a[sortState.colId] || '');
        const valB = String(b[sortState.colId] || '');
        return sortState.direction === 'asc' 
          ? valA.localeCompare(valB, undefined, { numeric: true }) 
          : valB.localeCompare(valA, undefined, { numeric: true });
      });
    }

    return rows;
  }, [currentSheet, searchQuery, statusFilter, sortState]);

  // Pagination calculation
  const totalRows = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

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

  const handleCellStatusChange = (rowId: string, newStatus: string) => {
    const updatedSheets = sheets.map(sheet => {
      if (sheet.id !== currentSheet.id) return sheet;
      const updatedRows = sheet.rows.map(row => {
        if (row.id !== rowId) return row;
        return {
          ...row,
          status: newStatus
        };
      });
      return { ...sheet, rows: updatedRows };
    });
    saveSheets(updatedSheets);
    toast.success(`Status set to "${newStatus || 'None'}"`);
  };

  // Keyboard navigation between cells
  const handleCellKeyDown = (e: React.KeyboardEvent, rowId: string, colId: string) => {
    if (editingCell) {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitCellEdit();
        const currentIndex = paginatedRows.findIndex(r => r.id === rowId);
        if (currentIndex < paginatedRows.length - 1) {
          const nextRow = paginatedRows[currentIndex + 1];
          setSelectedCell({ rowId: nextRow.id, colId });
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
          }
        } else {
          if (colIndex < currentSheet.columns.length - 1) {
            const nextCol = currentSheet.columns[colIndex + 1];
            setSelectedCell({ rowId, colId: nextCol.id });
          }
        }
      }
    } else {
      if (e.key === 'Enter') {
        e.preventDefault();
        const row = currentSheet.rows.find(r => r.id === rowId);
        if (row) {
          startEditingCell(rowId, colId, row[colId]);
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
        if (e.shiftKey) {
          if (colIndex > 0) {
            setSelectedCell({ rowId, colId: currentSheet.columns[colIndex - 1].id });
          }
        } else {
          if (colIndex < currentSheet.columns.length - 1) {
            setSelectedCell({ rowId, colId: currentSheet.columns[colIndex + 1].id });
          }
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const currIdx = paginatedRows.findIndex(r => r.id === rowId);
        if (currIdx < paginatedRows.length - 1) {
          setSelectedCell({ rowId: paginatedRows[currIdx + 1].id, colId });
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const currIdx = paginatedRows.findIndex(r => r.id === rowId);
        if (currIdx > 0) {
          setSelectedCell({ rowId: paginatedRows[currIdx - 1].id, colId });
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const colIndex = currentSheet.columns.findIndex(c => c.id === colId);
        if (colIndex < currentSheet.columns.length - 1) {
          setSelectedCell({ rowId, colId: currentSheet.columns[colIndex + 1].id });
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const colIndex = currentSheet.columns.findIndex(c => c.id === colId);
        if (colIndex > 0) {
          setSelectedCell({ rowId, colId: currentSheet.columns[colIndex - 1].id });
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setSelectedCell({ rowId, colId });
        setEditingCell({ rowId, colId });
        setCellEditValue(e.key);
      }
    }
  };

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

    if (typeof insertAtIndex !== 'number') {
      const newTotal = currentSheet.rows.length + 1;
      const targetPage = Math.ceil(newTotal / pageSize);
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

  // Bulk Status Change
  const handleBulkStatusChange = (newStatus: string) => {
    if (selectedRowIds.length === 0) return;
    const count = selectedRowIds.length;

    const updatedSheets = sheets.map(sheet => {
      if (sheet.id !== currentSheet.id) return sheet;
      const updatedRows = sheet.rows.map(row => {
        if (!selectedRowIds.includes(row.id)) return row;
        return {
          ...row,
          status: newStatus
        };
      });
      return { ...sheet, rows: updatedRows };
    });

    saveSheets(updatedSheets);
    toast.success(`Updated status to "${newStatus}" for ${count} rows`);
  };

  // Bulk Duplicate Rows
  const handleBulkDuplicate = () => {
    if (selectedRowIds.length === 0) return;
    const selectedRows = currentSheet.rows.filter(r => selectedRowIds.includes(r.id));
    const duplicates = selectedRows.map(r => ({
      ...r,
      id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
    }));

    const updatedSheets = sheets.map(sheet => {
      if (sheet.id !== currentSheet.id) return sheet;
      return {
        ...sheet,
        rows: [...sheet.rows, ...duplicates]
      };
    });

    saveSheets(updatedSheets);
    toast.success(`Duplicated ${duplicates.length} rows`);
  };

  // Duplicate Single Row
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

  // Sort Toggle
  const handleSortToggle = (colId: string) => {
    if (!sortState || sortState.colId !== colId) {
      setSortState({ colId, direction: 'asc' });
      toast.info(`Sorted ascending by column`);
    } else if (sortState.direction === 'asc') {
      setSortState({ colId, direction: 'desc' });
      toast.info(`Sorted descending by column`);
    } else {
      setSortState(null);
      toast.info('Sorting reset');
    }
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

      sheets.forEach(sheet => {
        const headers = sheet.columns.map(c => c.label);
        const dataRows = sheet.rows.map(row => {
          return sheet.columns.map(c => row[c.id] || '');
        });

        const sheetData = [headers, ...dataRows];
        const ws = XLSX.utils.aoa_to_sheet(sheetData);

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

  // Export CSV
  const handleExportCSV = () => {
    try {
      const headers = currentSheet.columns.map(c => `"${(c.label || '').replace(/"/g, '""')}"`).join(',');
      const rowsCsv = currentSheet.rows.map(row => {
        return currentSheet.columns.map(c => `"${String(row[c.id] || '').replace(/"/g, '""')}"`).join(',');
      }).join('\n');

      const csvContent = "data:text/csv;charset=utf-8," + [headers, rowsCsv].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${currentSheet.name}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Exported ${currentSheet.name} as CSV`);
    } catch (e) {
      toast.error('Failed to export CSV');
    }
  };

  // Copy Table Data as TSV for instant Paste into Excel/Google Sheets
  const handleCopyTableToClipboard = () => {
    try {
      const headers = currentSheet.columns.map(c => c.label).join('\t');
      const rowsTsv = currentSheet.rows.map(row => {
        return currentSheet.columns.map(c => String(row[c.id] || '')).join('\t');
      }).join('\n');

      const fullTsv = `${headers}\n${rowsTsv}`;
      navigator.clipboard.writeText(fullTsv);
      toast.success('Table copied to clipboard (ready to paste into Excel/Sheets)');
    } catch (e) {
      toast.error('Failed to copy table data');
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

        const importedRows: SheetRow[] = dataRows.map((rowArr, rowIdx) => {
          const rowObj: SheetRow = { id: `row-imported-${Date.now()}-${rowIdx}` };
          importedColumns.forEach((col, colIdx) => {
            rowObj[col.id] = rowArr[colIdx] !== undefined ? String(rowArr[colIdx]) : '';
          });
          return rowObj;
        });

        const finalRows = [...importedRows];
        while (finalRows.length < 25) {
          finalRows.push(createEmptyRow(finalRows.length + 1));
        }

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

        toast.success(`Imported ${importedRows.length} records into "${newSheet.name}"`);
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

  // Status Badge Colors mapping with glowing badges
  const getStatusBadgeStyle = (statusVal: string) => {
    const s = (statusVal || '').trim();
    if (s === 'Waiting for Image') {
      return 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm shadow-amber-500/10 font-bold';
    }
    if (s === 'Image Received') {
      return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm shadow-emerald-500/10 font-bold';
    }
    if (s === 'Cancel' || s === 'Cancelled') {
      return 'bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-sm shadow-rose-500/10 font-bold';
    }
    if (s === 'In Progress') {
      return 'bg-sky-500/20 text-sky-300 border border-sky-500/50 shadow-sm shadow-sky-500/10 font-bold';
    }
    if (s === 'Completed') {
      return 'bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-sm shadow-purple-500/10 font-bold';
    }
    return 'bg-slate-800/80 text-slate-300 border border-slate-700 font-medium';
  };

  // Status Icon mapping
  const renderStatusIcon = (statusVal: string) => {
    const s = (statusVal || '').trim();
    if (s === 'Waiting for Image') return <Clock className="w-3 h-3 text-amber-400 shrink-0" />;
    if (s === 'Image Received') return <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />;
    if (s === 'Cancel' || s === 'Cancelled') return <XCircle className="w-3 h-3 text-rose-400 shrink-0" />;
    if (s === 'In Progress') return <Sparkles className="w-3 h-3 text-sky-400 shrink-0" />;
    if (s === 'Completed') return <Check className="w-3 h-3 text-purple-400 shrink-0" />;
    return null;
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

  // WhatsApp click handler
  const handleWhatsAppClick = (phoneNumber: string) => {
    const cleaned = String(phoneNumber || '').replace(/\D/g, '');
    if (!cleaned) {
      toast.error('No phone number provided');
      return;
    }
    const fullNumber = cleaned.length === 10 ? `91${cleaned}` : cleaned;
    window.open(`https://wa.me/${fullNumber}`, '_blank');
  };

  // Wallpaper Upload Handler
  const handleWallpaperUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
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
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
          setWallpaper(compressedBase64);
          try {
            localStorage.setItem('sabi_daily_tasks_wallpaper', compressedBase64);
          } catch (err) {
            console.warn('LocalStorage wallpaper save warning:', err);
          }

          // Sync to Firestore so it stays permanent across devices
          try {
            const wpDocRef = doc(db, 'daily_tasks_board', 'wallpaper_settings');
            setDoc(wpDocRef, {
              wallpaper: compressedBase64,
              updatedAt: new Date().toISOString()
            }, { merge: true }).catch(err => console.warn('Firestore wallpaper note:', err));
          } catch (err) {}

          if (onWallpaperChange) {
            onWallpaperChange();
          }
          window.dispatchEvent(new Event('sabi-daily-tasks-wallpaper-changed'));
          toast.success("Daily tasks wallpaper updated successfully!");
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    if (wallpaperFileInputRef.current) wallpaperFileInputRef.current.value = '';
  };

  // Remove Wallpaper Handler
  const handleRemoveWallpaper = () => {
    setWallpaper('');
    try {
      localStorage.removeItem('sabi_daily_tasks_wallpaper');
    } catch (e) {}

    try {
      const wpDocRef = doc(db, 'daily_tasks_board', 'wallpaper_settings');
      setDoc(wpDocRef, {
        wallpaper: '',
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(err => console.warn('Firestore wallpaper clear note:', err));
    } catch (err) {}

    if (onWallpaperChange) {
      onWallpaperChange();
    }
    window.dispatchEvent(new Event('sabi-daily-tasks-wallpaper-changed'));
    toast.success("Wallpaper removed");
  };

  return (
    <div className={`w-full h-full flex flex-col space-y-4 pb-6 select-none font-sans text-slate-100 transition-all duration-300 ${
      wallpaper ? 'wallpaper-active' : ''
    }`}>
      {/* Hidden File Input for Wallpaper Upload */}
      <input 
        type="file" 
        ref={wallpaperFileInputRef} 
        onChange={handleWallpaperUpload} 
        accept="image/*" 
        className="hidden" 
      />
      {/* Hidden File Input for Excel Import */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept=".xlsx,.xls,.csv" 
        className="hidden" 
      />

      {/* TOP CONTROL PANEL / HERO BAR */}
      <div className={`rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden transition-all duration-300 ${
        wallpaper 
          ? 'bg-slate-950/65 backdrop-blur-2xl border border-white/20 shadow-2xl' 
          : 'bg-[#090f23]/95 backdrop-blur-2xl border border-cyan-500/25'
      }`}>
        {/* Subtle Ambient Radial Lighting */}
        <div className="absolute -top-32 -left-32 w-72 h-72 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-72 h-72 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          {/* Header Title & Active Sheet Indicator */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 via-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 border border-cyan-300/30 shrink-0">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  Daily Tasks Spreadsheet
                </h1>
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-extrabold bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-400/40 shadow-inner">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping inline-block" />
                  <span>{currentSheet.name}</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5 flex items-center gap-2">
                <span>Live interactive data grid</span>
                <span>&bull;</span>
                <span>Editable cells & headers</span>
                <span>&bull;</span>
                <span>Auto-sync enabled</span>
              </p>
            </div>
          </div>

          {/* Interactive Quick Metrics Bar (Click to filter!) */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Wallpaper Selector Button on the LEFT side of Total Rows */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button 
                onClick={() => wallpaperFileInputRef.current?.click()}
                className={`border rounded-xl px-3.5 py-2 flex items-center gap-2.5 shadow-sm transition-all text-left group cursor-pointer ${
                  wallpaper 
                    ? 'bg-gradient-to-br from-cyan-950/80 to-blue-950/80 border-cyan-400 ring-2 ring-cyan-400/30 text-cyan-200 hover:border-cyan-300' 
                    : 'bg-[#101935] hover:bg-[#18264d] border-cyan-500/40 hover:border-cyan-400 text-slate-200'
                }`}
                title={wallpaper ? "Click to change Daily Tasks background wallpaper" : "Click to select and set Daily Tasks background wallpaper"}
              >
                <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 group-hover:scale-110 transition-transform">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Wallpaper</div>
                  <div className="text-xs font-extrabold text-cyan-400 flex items-center gap-1">
                    <span>{wallpaper ? 'Active' : 'Set Image'}</span>
                    {wallpaper && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
                  </div>
                </div>
              </button>

              {wallpaper && (
                <button 
                  onClick={handleRemoveWallpaper}
                  className="p-2 rounded-xl bg-slate-900/80 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/40 transition-all active:scale-95 shadow-sm cursor-pointer"
                  title="Remove Wallpaper"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Total Rows Card */}
            <button 
              onClick={() => {
                setStatusFilter('All');
                setCurrentPage(1);
              }}
              className={`border rounded-xl px-3.5 py-2 flex items-center gap-2.5 shadow-sm transition-all text-left ${
                statusFilter === 'All' 
                  ? 'border-cyan-400 ring-2 ring-cyan-400/30' 
                  : (wallpaper ? 'border-white/15 hover:border-white/30' : 'border-slate-800 hover:border-slate-700')
              } ${wallpaper ? 'bg-slate-900/70 backdrop-blur-md hover:bg-slate-800/80' : 'bg-[#101935] hover:bg-[#162247]'}`}
              title="Click to show all rows"
            >
              <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Rows</div>
                <div className="text-sm font-extrabold text-white">{summaryStats.totalRows}</div>
              </div>
            </button>

            {/* Waiting for Image Card */}
            <button 
              onClick={() => {
                setStatusFilter(statusFilter === 'Waiting for Image' ? 'All' : 'Waiting for Image');
                setCurrentPage(1);
              }}
              className={`border rounded-xl px-3.5 py-2 flex items-center gap-2.5 shadow-sm transition-all text-left ${
                statusFilter === 'Waiting for Image' 
                  ? 'border-amber-400 ring-2 ring-amber-400/40 bg-amber-950/40' 
                  : 'border-amber-500/40 hover:border-amber-400/70'
              } ${wallpaper ? 'bg-slate-900/70 backdrop-blur-md hover:bg-slate-800/80' : 'bg-[#101935] hover:bg-[#162247]'}`}
              title="Click to filter by Waiting for Image"
            >
              <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] text-amber-300 uppercase font-bold tracking-wider flex items-center gap-1">
                  <span>Waiting Image</span>
                  {summaryStats.waitingCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
                </div>
                <div className="text-sm font-extrabold text-amber-400">{summaryStats.waitingCount}</div>
              </div>
            </button>

            {/* Image Received Card */}
            <button 
              onClick={() => {
                setStatusFilter(statusFilter === 'Image Received' ? 'All' : 'Image Received');
                setCurrentPage(1);
              }}
              className={`border rounded-xl px-3.5 py-2 flex items-center gap-2.5 shadow-sm transition-all text-left ${
                statusFilter === 'Image Received' 
                  ? 'border-emerald-400 ring-2 ring-emerald-400/40 bg-emerald-950/40' 
                  : 'border-emerald-500/40 hover:border-emerald-400/70'
              } ${wallpaper ? 'bg-slate-900/70 backdrop-blur-md hover:bg-slate-800/80' : 'bg-[#101935] hover:bg-[#162247]'}`}
              title="Click to filter by Image Received"
            >
              <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] text-emerald-300 uppercase font-bold tracking-wider">Image Received</div>
                <div className="text-sm font-extrabold text-emerald-400">{summaryStats.receivedCount}</div>
              </div>
            </button>

            {/* Cancelled Card */}
            <button 
              onClick={() => {
                setStatusFilter(statusFilter === 'Cancel' ? 'All' : 'Cancel');
                setCurrentPage(1);
              }}
              className={`border rounded-xl px-3.5 py-2 flex items-center gap-2.5 shadow-sm transition-all text-left ${
                statusFilter === 'Cancel' 
                  ? 'border-rose-400 ring-2 ring-rose-400/40 bg-rose-950/40' 
                  : 'border-rose-500/40 hover:border-rose-400/70'
              } ${wallpaper ? 'bg-slate-900/70 backdrop-blur-md hover:bg-slate-800/80' : 'bg-[#101935] hover:bg-[#162247]'}`}
              title="Click to filter by Cancelled"
            >
              <div className="p-1.5 rounded-lg bg-rose-500/15 text-rose-400">
                <XCircle className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] text-rose-300 uppercase font-bold tracking-wider">Cancelled</div>
                <div className="text-sm font-extrabold text-rose-400">{summaryStats.cancelCount}</div>
              </div>
            </button>

            {/* Total Quantity if exists */}
            {summaryStats.totalQuantity > 0 && (
              <div className={`border border-blue-500/40 rounded-xl px-3.5 py-2 flex items-center gap-2.5 shadow-sm ${
                wallpaper ? 'bg-slate-900/70 backdrop-blur-md' : 'bg-[#101935]'
              }`}>
                <div className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400">
                  <Hash className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-blue-300 uppercase font-bold tracking-wider">Total Count</div>
                  <div className="text-sm font-extrabold text-blue-400">{summaryStats.totalQuantity}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* TOOLBAR & SEARCH SECTION */}
        <div className="mt-4 pt-4 border-t border-white/10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box & Quick Status Filter Chips */}
          <div className="flex flex-1 items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="w-4 h-4 text-cyan-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input 
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search anything (phone, comments, date, count...)"
                className={`w-full text-slate-100 placeholder-slate-400 text-xs sm:text-sm pl-10 pr-16 py-2 rounded-xl border focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all shadow-inner ${
                  wallpaper ? 'bg-slate-900/70 backdrop-blur-md border-white/20' : 'bg-[#101935] border-slate-700'
                }`}
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {searchQuery ? (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800 border border-slate-700 rounded shadow-sm">
                    /
                  </kbd>
                )}
              </div>
            </div>

            {/* Status Quick Filter Dropdown */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className={`text-slate-200 text-xs sm:text-sm px-3.5 py-2 rounded-xl border focus:outline-none focus:border-cyan-400 cursor-pointer font-medium shadow-sm transition-colors ${
                  wallpaper ? 'bg-slate-900/75 backdrop-blur-md border-white/20 hover:border-white/30' : 'bg-[#101935] border-slate-700 hover:border-slate-600'
                }`}
              >
                <option value="All">All Statuses ({summaryStats.totalRows})</option>
                <option value="Waiting for Image">Waiting for Image ({summaryStats.waitingCount})</option>
                <option value="Image Received">Image Received ({summaryStats.receivedCount})</option>
                <option value="Cancel">Cancel ({summaryStats.cancelCount})</option>
                <option value="In Progress">In Progress ({summaryStats.inProgressCount})</option>
                <option value="Completed">Completed ({summaryStats.completedCount})</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Undo / Redo */}
            <div className={`flex items-center rounded-xl border p-0.5 shadow-sm ${
              wallpaper ? 'bg-slate-900/70 backdrop-blur-md border-white/20' : 'bg-[#101935] border-slate-700'
            }`}>
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

            {/* Add Row Button */}
            <button 
              onClick={() => handleAddRow()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-cyan-500/20 transition-all active:scale-95 border border-cyan-300/30 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Row</span>
            </button>

            {/* Add Column Popover */}
            <Popover open={isAddColumnOpen} onOpenChange={setIsAddColumnOpen}>
              <PopoverTrigger asChild>
                <button 
                  className={`flex items-center gap-1.5 px-3 py-2 text-cyan-300 border text-xs sm:text-sm font-bold rounded-xl transition-colors shadow-sm cursor-pointer ${
                    wallpaper ? 'bg-slate-900/70 backdrop-blur-md border-white/20 hover:bg-slate-800/80' : 'bg-[#101935] hover:bg-[#172346] border-cyan-500/30'
                  }`}
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Add Column</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 bg-[#0d162d]/95 backdrop-blur-2xl border border-cyan-500/40 text-slate-100 p-4 rounded-xl shadow-2xl z-50">
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

            {/* Export Dropdown Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <button 
                  className={`flex items-center gap-1.5 px-3 py-2 text-emerald-400 border text-xs sm:text-sm font-bold rounded-xl transition-colors shadow-sm cursor-pointer ${
                    wallpaper ? 'bg-slate-900/70 backdrop-blur-md border-white/20 hover:bg-slate-800/80' : 'bg-[#101935] hover:bg-[#172346] border-emerald-500/30'
                  }`}
                  title="Export options"
                >
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 bg-[#0d162d]/95 backdrop-blur-2xl border border-emerald-500/30 text-slate-100 p-1.5 rounded-xl shadow-2xl z-50">
                <div className="space-y-1 text-xs">
                  <div className="px-2 py-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Export Sheet Data
                  </div>
                  <button 
                    onClick={handleExportExcel}
                    className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-[#18264e] rounded-lg text-slate-200"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    <span>Excel Workbook (.xlsx)</span>
                  </button>
                  <button 
                    onClick={handleExportCSV}
                    className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-[#18264e] rounded-lg text-slate-200"
                  >
                    <FileText className="w-4 h-4 text-sky-400" />
                    <span>Current Sheet as CSV</span>
                  </button>
                  <button 
                    onClick={handleCopyTableToClipboard}
                    className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-[#18264e] rounded-lg text-slate-200"
                  >
                    <Copy className="w-4 h-4 text-purple-400" />
                    <span>Copy Table for Excel/Sheets</span>
                  </button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Excel Import */}
            <button 
              onClick={() => fileInputRef.current?.click()}
              title="Import Excel file (.xlsx, .csv)"
              className={`flex items-center gap-1.5 px-3 py-2 text-indigo-300 border text-xs sm:text-sm font-bold rounded-xl transition-colors shadow-sm cursor-pointer ${
                wallpaper ? 'bg-slate-900/70 backdrop-blur-md border-white/20 hover:bg-slate-800/80' : 'bg-[#101935] hover:bg-[#172346] border-indigo-500/30'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Import</span>
            </button>

            {/* Shortcuts Help Popover */}
            <Popover open={isShortcutsOpen} onOpenChange={setIsShortcutsOpen}>
              <PopoverTrigger asChild>
                <button 
                  className={`p-2 border rounded-xl transition-colors shadow-sm cursor-pointer ${
                    wallpaper ? 'bg-slate-900/70 backdrop-blur-md border-white/20 text-slate-300 hover:text-cyan-300' : 'bg-[#101935] hover:bg-[#172346] text-slate-400 hover:text-cyan-300 border-slate-700'
                  }`}
                  title="Keyboard Shortcuts (?)"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 bg-[#0d162d]/95 backdrop-blur-2xl border border-cyan-500/30 text-slate-100 p-4 rounded-xl shadow-2xl z-50">
                <div className="space-y-2.5 text-xs">
                  <h3 className="font-bold text-sm text-cyan-300 flex items-center gap-1.5 pb-1 border-b border-slate-800">
                    <HelpCircle className="w-4 h-4" /> Keyboard Shortcuts
                  </h3>
                  <div className="space-y-1.5 font-mono text-[11px]">
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Edit Cell</span>
                      <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700">Enter / 2x Click</kbd>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Navigate Cells</span>
                      <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700">Arrow Keys</kbd>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Next / Prev Column</span>
                      <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700">Tab / Shift+Tab</kbd>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Undo / Redo</span>
                      <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700">Ctrl+Z / Ctrl+Y</kbd>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Focus Search</span>
                      <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700">/</kbd>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Clear Cell</span>
                      <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700">Delete / Backspace</kbd>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* SEARCH / FILTER ACTIVE INDICATOR BANNER */}
      {(searchQuery.trim() || statusFilter !== 'All') && (
        <div className="bg-cyan-950/50 backdrop-blur-xl border border-cyan-500/40 px-4 py-2.5 rounded-xl flex items-center justify-between text-xs sm:text-sm text-cyan-300 shadow-lg">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-cyan-400" />
            <span>
              Showing <strong className="text-white">{filteredRows.length}</strong> matching records 
              {searchQuery && <> for "<strong>{searchQuery}</strong>"</>}
              {statusFilter !== 'All' && <> with status "<strong className="text-cyan-200">{statusFilter}</strong>"</>}
            </span>
          </div>
          <button 
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('All');
            }}
            className="text-xs font-bold text-cyan-400 hover:text-cyan-200 underline px-2 py-1 rounded hover:bg-cyan-900/30 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* EXCEL SPREADSHEET MAIN CONTAINER */}
      <div className={`rounded-2xl shadow-2xl flex-1 flex flex-col overflow-hidden relative transition-all duration-300 ${
        wallpaper 
          ? 'bg-slate-950/65 backdrop-blur-2xl border border-white/20 shadow-2xl' 
          : 'bg-[#090f23] border border-slate-800'
      }`}>
        {/* SPREADSHEET TABLE GRID (Scrollable) */}
        <div className={`overflow-x-auto overflow-y-auto flex-1 custom-scrollbar border-b max-h-[620px] min-h-[440px] ${
          wallpaper ? 'border-white/10' : 'border-slate-800'
        }`}>
          <table className="w-full border-collapse text-left text-xs sm:text-sm select-none">
            {/* TABLE HEADER */}
            <thead className="sticky top-0 z-20 shadow-md">
              {/* Top Row: Monospace Excel Column Letters (A, B, C, D...) */}
              <tr className={`font-mono text-[10px] uppercase border-b ${
                wallpaper 
                  ? 'bg-slate-950/85 backdrop-blur-md border-white/10 text-slate-400' 
                  : 'bg-[#060b18] border-slate-800 text-slate-500'
              }`}>
                <th className={`w-12 text-center py-1.5 border-r ${
                  wallpaper ? 'border-white/10 bg-slate-950/90' : 'border-slate-800/80 bg-[#050813]'
                }`}>
                  #
                </th>
                {currentSheet.columns.map((col, idx) => (
                  <th 
                    key={`letter-${col.id}`} 
                    className={`py-1.5 px-3 border-r text-center tracking-wider ${
                      wallpaper ? 'border-white/10' : 'border-slate-800/80'
                    }`}
                    style={{ width: col.width ? `${col.width}px` : 'auto' }}
                  >
                    {getColumnLetter(idx)}
                  </th>
                ))}
                <th className={`w-16 text-center py-1.5 ${
                  wallpaper ? 'bg-slate-950/90' : 'bg-[#050813]'
                }`}>Actions</th>
              </tr>

              {/* Main Header Row */}
              <tr className={`font-bold tracking-tight border-b-2 ${
                wallpaper 
                  ? 'bg-slate-900/90 backdrop-blur-md border-cyan-500/50 text-white' 
                  : 'bg-gradient-to-r from-slate-900 via-[#0d1630] to-slate-900 text-slate-100 border-cyan-500/40'
              }`}>
                {/* Checkbox select all */}
                <th className={`w-12 py-3 px-2 text-center border-r ${
                  wallpaper ? 'border-white/10 bg-slate-950/90' : 'border-slate-800 bg-[#070d1e]'
                }`}>
                  <div className="flex items-center justify-center">
                    <input 
                      type="checkbox"
                      checked={isAllPageSelected}
                      ref={el => {
                        if (el) el.indeterminate = isSomePageSelected;
                      }}
                      onChange={(e) => handleSelectAllOnPage(e.target.checked)}
                      className="w-4 h-4 rounded text-cyan-500 bg-[#131e3d] border-slate-600 focus:ring-0 cursor-pointer"
                    />
                  </div>
                </th>

                {/* Column Headers with Inline Renaming & Column Menu */}
                {currentSheet.columns.map((col) => {
                  const isEditing = editingHeaderColId === col.id;
                  const isSorted = sortState?.colId === col.id;

                  return (
                    <th 
                      key={col.id}
                      className={`py-2.5 px-3 border-r font-bold group relative ${
                        wallpaper ? 'border-white/10 text-slate-100' : 'border-slate-800 text-slate-200'
                      }`}
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
                            className="w-full bg-[#18264e] text-white px-2 py-1 rounded text-xs font-bold border border-cyan-400 focus:outline-none"
                          />
                          <button 
                            onClick={commitHeaderEdit}
                            className="p-1 bg-cyan-600 text-white rounded hover:bg-cyan-500"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-1.5">
                          <div 
                            onClick={() => handleSortToggle(col.id)}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              startEditingHeader(col);
                            }}
                            title="Click to sort, double-click to rename"
                            className="truncate cursor-pointer hover:text-cyan-300 flex items-center gap-1.5 flex-1"
                          >
                            <span>{col.label}</span>
                            {isSorted && (
                              sortState.direction === 'asc' 
                                ? <ArrowUp className="w-3.5 h-3.5 text-cyan-400 inline" />
                                : <ArrowDown className="w-3.5 h-3.5 text-cyan-400 inline" />
                            )}
                          </div>

                          {/* Column Header Dropdown Menu */}
                          <Popover>
                            <PopoverTrigger asChild>
                              <button 
                                className="opacity-40 group-hover:opacity-100 hover:bg-slate-800 p-1 rounded transition-opacity"
                                title="Column options"
                              >
                                <MoreHorizontal className="w-3.5 h-3.5 text-slate-300" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 bg-[#0d162d]/95 backdrop-blur-2xl border border-cyan-500/40 text-slate-100 p-1.5 rounded-xl shadow-2xl z-50">
                              <div className="space-y-0.5 text-xs">
                                <button 
                                  onClick={() => startEditingHeader(col)}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[#19274e] rounded-lg text-slate-200"
                                >
                                  <Pencil className="w-3.5 h-3.5 text-cyan-400" /> Rename Header
                                </button>
                                <button 
                                  onClick={() => {
                                    setSortState({ colId: col.id, direction: 'asc' });
                                    toast.success(`Sorted by "${col.label}" (A-Z)`);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[#19274e] rounded-lg text-slate-200"
                                >
                                  <ArrowUp className="w-3.5 h-3.5 text-cyan-400" /> Sort (A to Z)
                                </button>
                                <button 
                                  onClick={() => {
                                    setSortState({ colId: col.id, direction: 'desc' });
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
                <th className={`w-16 py-2.5 px-2 text-center font-bold ${
                  wallpaper ? 'bg-slate-950/90 text-slate-300' : 'bg-[#070d1e] text-slate-400'
                }`}>
                  Edit
                </th>
              </tr>
            </thead>

            {/* TABLE BODY (Rows & Cells) */}
            <tbody className={`divide-y ${wallpaper ? 'divide-white/10 bg-transparent' : 'divide-slate-800/60 bg-[#091024]'}`}>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td 
                    colSpan={currentSheet.columns.length + 2} 
                    className="text-center py-16 text-slate-400"
                  >
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-[#121c38]/80 backdrop-blur-md flex items-center justify-center text-slate-500 border border-slate-800">
                        <FileSpreadsheet className="w-6 h-6" />
                      </div>
                      <p className="font-semibold text-sm text-slate-300">No records found matching your filters</p>
                      <button 
                        onClick={() => handleAddRow()}
                        className="px-4 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold rounded-lg border border-cyan-500/30 transition-all"
                      >
                        + Add a new row to this sheet
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, rowIdx) => {
                  const globalRowIndex = (currentPage - 1) * pageSize + rowIdx + 1;
                  const isRowSelected = selectedRowIds.includes(row.id);

                  return (
                    <tr 
                      key={row.id}
                      className={`group transition-colors ${
                        isRowSelected 
                          ? 'bg-cyan-950/55 border-l-4 border-l-cyan-400' 
                          : (wallpaper 
                              ? (rowIdx % 2 === 0 ? 'bg-slate-950/40 hover:bg-slate-900/70' : 'bg-slate-900/30 hover:bg-slate-900/70')
                              : (rowIdx % 2 === 0 ? 'bg-[#090f23] hover:bg-[#121d3f]' : 'bg-[#060b1b] hover:bg-[#121d3f]')
                            )
                      }`}
                    >
                      {/* Row Index & Checkbox */}
                      <td className={`w-12 py-2 px-2 text-center border-r font-mono text-xs ${
                        wallpaper 
                          ? 'border-white/10 bg-slate-950/50 group-hover:bg-slate-900/70' 
                          : 'border-slate-800/80 bg-[#050917]/80 group-hover:bg-[#0c142c]'
                      }`}>
                        <div className="flex items-center justify-center gap-1.5">
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
                            className="w-3.5 h-3.5 rounded text-cyan-500 bg-[#121d3d] border-slate-700 focus:ring-0 cursor-pointer"
                          />
                          <span className="text-[11px] font-bold text-slate-400 group-hover:text-slate-200">{globalRowIndex}</span>
                        </div>
                      </td>

                      {/* Dynamic Columns Data Cells */}
                      {currentSheet.columns.map((col) => {
                        const cellValue = row[col.id] !== undefined ? row[col.id] : '';
                        const isCellSelected = selectedCell?.rowId === row.id && selectedCell?.colId === col.id;
                        const isCellEditing = editingCell?.rowId === row.id && editingCell?.colId === col.id;

                        // Check if this is the Status Column (Special Dropdown Badge)
                        if (col.id === 'status' || col.type === 'select') {
                          return (
                            <td 
                              key={`${row.id}-${col.id}`}
                              tabIndex={0}
                              onFocus={() => setSelectedCell({ rowId: row.id, colId: col.id })}
                              onKeyDown={(e) => handleCellKeyDown(e, row.id, col.id)}
                              className={`py-1.5 px-3 border-r relative transition-all ${
                                wallpaper ? 'border-white/10' : 'border-slate-800/80'
                              } ${
                                isCellSelected ? 'ring-2 ring-cyan-400 ring-inset z-10 bg-cyan-950/40' : ''
                              }`}
                            >
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div 
                                    className="cursor-pointer flex items-center justify-between w-full"
                                    onClick={() => setSelectedCell({ rowId: row.id, colId: col.id })}
                                  >
                                    {cellValue ? (
                                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-transform group-hover:scale-[1.02] ${getStatusBadgeStyle(cellValue)}`}>
                                        {renderStatusIcon(cellValue)}
                                        <span>{cellValue}</span>
                                      </span>
                                    ) : (
                                      <span className={`border border-dashed px-2 py-0.5 rounded-full text-xs flex items-center gap-1 transition-colors ${
                                        wallpaper ? 'text-slate-400 border-white/20 hover:border-white/40' : 'text-slate-600 border-slate-700/60 hover:border-slate-500 hover:text-slate-400'
                                      }`}>
                                        <Plus className="w-3 h-3" /> Set Status
                                      </span>
                                    )}
                                    <MoreHorizontal className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-56 bg-[#0d162d]/95 backdrop-blur-2xl border border-cyan-500/40 text-slate-100 p-1.5 rounded-xl shadow-2xl z-50">
                                  <div className="space-y-1 text-xs">
                                    <div className="px-2 py-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                      Select Status
                                    </div>
                                    {[
                                      'Waiting for Image',
                                      'Image Received',
                                      'Cancel',
                                      'In Progress',
                                      'Completed'
                                    ].map(statusOpt => (
                                      <button 
                                        key={statusOpt}
                                        onClick={() => handleCellStatusChange(row.id, statusOpt)}
                                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left font-medium hover:bg-[#1a274d] transition-colors ${
                                          cellValue === statusOpt ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-200'
                                        }`}
                                      >
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] ${getStatusBadgeStyle(statusOpt)}`}>
                                          {renderStatusIcon(statusOpt)}
                                          <span>{statusOpt}</span>
                                        </span>
                                        {cellValue === statusOpt && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                                      </button>
                                    ))}
                                    <div className="border-t border-slate-700/60 my-1" />
                                    <button 
                                      onClick={() => handleCellStatusChange(row.id, '')}
                                      className="w-full flex items-center gap-1.5 px-2.5 py-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg"
                                    >
                                      <X className="w-3 h-3" /> Clear Status
                                    </button>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </td>
                          );
                        }

                        // Regular Editable Cell
                        return (
                          <td 
                            key={`${row.id}-${col.id}`}
                            tabIndex={0}
                            onClick={() => setSelectedCell({ rowId: row.id, colId: col.id })}
                            onDoubleClick={() => startEditingCell(row.id, col.id, cellValue)}
                            onKeyDown={(e) => handleCellKeyDown(e, row.id, col.id)}
                            className={`py-2 px-3 border-r text-slate-200 text-xs sm:text-sm font-medium relative focus:outline-none transition-all ${
                              wallpaper ? 'border-white/10 hover:bg-slate-800/40' : 'border-slate-800/80 hover:bg-[#142144]'
                            } ${
                              isCellSelected 
                                ? 'ring-2 ring-cyan-400 ring-inset bg-cyan-950/40 z-10' 
                                : ''
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
                              <div className="truncate min-h-[20px] flex items-center justify-between gap-1">
                                {cellValue ? (
                                  <span className={col.id === 'count' ? 'font-black text-cyan-300' : ''}>
                                    {cellValue}
                                  </span>
                                ) : (
                                  <span className="text-slate-500/40 select-none">&mdash;</span>
                                )}

                                {/* Phone number quick action shortcut */}
                                {col.id === 'contactNumber' && cellValue && (
                                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleWhatsAppClick(cellValue);
                                      }}
                                      title="Open WhatsApp Chat"
                                      className="p-1 hover:bg-emerald-500/20 text-emerald-400 rounded transition-colors"
                                    >
                                      <MessageCircle className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(cellValue);
                                        toast.success('Phone copied');
                                      }}
                                      title="Copy Number"
                                      className="p-1 hover:bg-slate-700 text-slate-300 rounded transition-colors"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
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
                      <td className={`w-16 py-1.5 px-2 text-center ${
                        wallpaper ? 'bg-slate-950/50' : 'bg-[#050917]/60 group-hover:bg-[#0c142c]'
                      }`}>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button 
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                              title="Row options"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-48 bg-[#0d162d]/95 backdrop-blur-2xl border border-cyan-500/40 text-slate-100 p-1.5 rounded-xl shadow-2xl z-50">
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

        {/* FLOATING MULTI-SELECT ACTION BAR (When rows selected) */}
        {selectedRowIds.length > 0 && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-[#0d1630]/95 backdrop-blur-xl border border-cyan-400/60 rounded-2xl px-4 py-2.5 shadow-2xl flex items-center gap-3 z-30 animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div className="flex items-center gap-2 pr-3 border-r border-slate-700 text-xs font-extrabold text-cyan-300">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>{selectedRowIds.length} Selected</span>
            </div>

            {/* Bulk Status Change */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-600 transition-colors">
                  Set Status
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 bg-[#0d162d]/95 backdrop-blur-2xl border border-cyan-500/40 text-slate-100 p-1.5 rounded-xl shadow-2xl z-50">
                <div className="space-y-1 text-xs">
                  {['Waiting for Image', 'Image Received', 'Cancel', 'In Progress', 'Completed'].map(opt => (
                    <button 
                      key={opt}
                      onClick={() => handleBulkStatusChange(opt)}
                      className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#1a274c] text-slate-200"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <button 
              onClick={handleBulkDuplicate}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-600 transition-colors"
            >
              Duplicate
            </button>

            <button 
              onClick={handleBulkDelete}
              className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete ({selectedRowIds.length})
            </button>

            <button 
              onClick={() => setSelectedRowIds([])}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* BOTTOM PAGINATION BAR */}
        <div className={`px-4 py-2.5 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-slate-300 ${
          wallpaper 
            ? 'bg-slate-950/75 backdrop-blur-xl border-white/10' 
            : 'bg-[#060b18] border-slate-800/80'
        }`}>
          {/* Row Counter info & Page Size Selector */}
          <div className="flex items-center gap-3">
            <span className="text-slate-400 font-medium">
              Showing <strong>{totalRows === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> to{' '}
              <strong>{Math.min(currentPage * pageSize, totalRows)}</strong> of <strong>{totalRows}</strong> records
            </span>

            {/* Rows Per Page Selector */}
            <div className="flex items-center gap-1.5 text-slate-400 text-xs">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className={`text-slate-200 text-xs px-2 py-1 rounded-lg border focus:outline-none focus:border-cyan-400 cursor-pointer ${
                  wallpaper ? 'bg-slate-900/80 border-white/20' : 'bg-[#101935] border-slate-700'
                }`}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {/* Page Navigation Buttons */}
          <div className="flex items-center gap-1.5">
            {/* First Page */}
            <button 
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className={`p-1.5 rounded-lg border text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${
                wallpaper ? 'bg-slate-900/80 border-white/20 hover:bg-slate-800' : 'bg-[#101935] border-slate-700 hover:bg-slate-800'
              }`}
              title="First Page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>

            {/* Previous Page */}
            <button 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-semibold text-xs ${
                wallpaper ? 'bg-slate-900/80 border-white/20 hover:bg-slate-800' : 'bg-[#101935] border-slate-700 hover:bg-slate-800'
              }`}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            {/* Page number indicators */}
            <div className="flex items-center gap-1 px-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .map((pageNum, idx, arr) => {
                  const showEllipsis = idx > 0 && pageNum - arr[idx - 1] > 1;
                  return (
                    <React.Fragment key={pageNum}>
                      {showEllipsis && <span className="text-slate-500 px-1">...</span>}
                      <button 
                        onClick={() => setCurrentPage(pageNum)}
                        className={`min-w-[30px] h-7 rounded-lg font-bold text-xs transition-all ${
                          currentPage === pageNum 
                            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20' 
                            : (wallpaper ? 'bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-white/20' : 'bg-[#101935] text-slate-300 hover:bg-slate-800 border border-slate-700')
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
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-semibold text-xs ${
                wallpaper ? 'bg-slate-900/80 border-white/20 hover:bg-slate-800' : 'bg-[#101935] border-slate-700 hover:bg-slate-800'
              }`}
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Last Page */}
            <button 
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className={`p-1.5 rounded-lg border text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${
                wallpaper ? 'bg-slate-900/80 border-white/20 hover:bg-slate-800' : 'bg-[#101935] border-slate-700 hover:bg-slate-800'
              }`}
              title="Last Page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* BOTTOM MULTI-SHEET TABS BAR */}
        <div className={`px-4 py-2 border-t flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar ${
          wallpaper 
            ? 'bg-slate-950/85 backdrop-blur-xl border-white/10' 
            : 'bg-[#050813] border-slate-800/90'
        }`}>
          <div className="flex items-center gap-1.5">
            {/* Add New Sheet (+) Button */}
            <button 
              onClick={handleAddSheet}
              title="Add New Sheet"
              className={`p-2 rounded-xl text-cyan-400 border transition-all flex items-center justify-center active:scale-95 shadow-sm cursor-pointer ${
                wallpaper ? 'bg-slate-900/80 hover:bg-cyan-500/20 border-white/20 hover:border-cyan-500/40' : 'bg-[#101935] hover:bg-cyan-500/20 border-slate-800 hover:border-cyan-500/40'
              }`}
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
                      ? (wallpaper 
                          ? 'bg-cyan-500/30 border border-cyan-400 text-white font-extrabold shadow-lg shadow-cyan-950/50 ring-1 ring-cyan-400/50' 
                          : 'bg-gradient-to-r from-blue-600/30 to-cyan-500/30 border border-cyan-400 text-white font-extrabold shadow-lg shadow-cyan-950/50 ring-1 ring-cyan-400/40'
                        )
                      : (wallpaper 
                          ? 'bg-slate-900/60 hover:bg-slate-800/80 border border-white/10 text-slate-300 font-semibold' 
                          : 'bg-[#0f172e] hover:bg-[#162244] border border-slate-800 text-slate-400 hover:text-slate-200 font-semibold'
                        )
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
                        <Check className="w-3.5 h-3.5" />
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
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-40 bg-[#0d162d]/95 backdrop-blur-2xl border border-cyan-500/40 text-slate-100 p-1 rounded-xl shadow-2xl z-50">
                        <div className="space-y-0.5 text-xs">
                          <button 
                            onClick={() => {
                              setEditingSheetId(sheet.id);
                              setSheetRenameValue(sheet.name);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[#19274e] rounded-lg text-slate-200"
                          >
                            <Pencil className="w-3.5 h-3.5 text-cyan-400" /> Rename Sheet
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
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[#19274e] rounded-lg text-slate-200"
                          >
                            <Copy className="w-3.5 h-3.5 text-blue-400" /> Duplicate Sheet
                          </button>
                          <button 
                            onClick={() => handleClearEntireSheet(sheet.id)}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[#19274e] rounded-lg text-amber-400"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-amber-400" /> Clear Sheet Data
                          </button>
                          {sheets.length > 1 && (
                            <>
                              <div className="border-t border-slate-700/60 my-1" />
                              <button 
                                onClick={() => handleDeleteSheet(sheet.id)}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-rose-500/20 text-rose-400 rounded-lg"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete Sheet
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

          <div className="text-[11px] text-slate-400 whitespace-nowrap hidden md:flex items-center gap-2">
            <span>Double-click to edit cell &bull; Tab/Enter to navigate &bull; Press <kbd className="px-1 py-0.5 bg-slate-800/80 border border-white/15 rounded text-slate-300 font-mono">?</kbd> for help</span>
          </div>
        </div>
      </div>
    </div>
  );
}
