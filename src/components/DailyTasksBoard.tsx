import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { 
  Plus, X, Upload, Pencil, Trash2, Search, Download, 
  ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, Check, FileSpreadsheet, RotateCcw,
  RotateCw, Filter, MoreHorizontal, Copy, Calendar, Eye,
  Sparkles, CheckCircle2, Clock, AlertTriangle, XCircle, Hash,
  Layers, PlusCircle, MoveHorizontal, CheckSquare, Square
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
  { id: 'contactNumber', label: 'Contact Number', width: 170, type: 'text' },
  { id: 'count', label: 'Count', width: 100, type: 'text' },
  { id: 'birthday', label: 'Birthday', width: 140, type: 'text' },
  { id: 'dispatch', label: 'Dispatch', width: 130, type: 'text' },
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

  // Column Header Editing
  const [editingHeaderColId, setEditingHeaderColId] = useState<string | null>(null);
  const [headerEditTitle, setHeaderEditTitle] = useState<string>('');

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

  // Firestore Real-time Listener
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
    toast.success(`Status updated to "${newStatus || 'None'}"`);
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
      // Cell selected but not in edit mode
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
        // Direct typing replaces cell content
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
    const s = (statusVal || '').trim();
    if (s === 'Waiting for Image') {
      // Peach / Orange badge as seen in 2nd image
      return 'bg-[#ffedd5] text-[#c2410c] dark:bg-[#7c2d12]/50 dark:text-[#fdba74] border border-orange-300 dark:border-orange-600/60 shadow-sm font-semibold';
    }
    if (s === 'Image Received') {
      // Light Green badge as seen in 2nd image
      return 'bg-[#dcfce7] text-[#15803d] dark:bg-[#14532d]/50 dark:text-[#86efac] border border-emerald-300 dark:border-emerald-600/60 shadow-sm font-semibold';
    }
    if (s === 'Cancel' || s === 'Cancelled') {
      // Dark Crimson / Red badge as seen in 2nd image
      return 'bg-[#ffe4e6] text-[#be123c] dark:bg-[#881337]/60 dark:text-[#fda4af] border border-rose-300 dark:border-rose-600/60 shadow-sm font-semibold';
    }
    if (s === 'In Progress') {
      return 'bg-[#e0f2fe] text-[#0369a1] dark:bg-[#0c4a6e]/50 dark:text-[#7dd3fc] border border-sky-300 dark:border-sky-600/60 shadow-sm font-semibold';
    }
    if (s === 'Completed') {
      return 'bg-[#ecfdf5] text-[#047857] dark:bg-[#064e3b]/50 dark:text-[#6ee7b7] border border-teal-300 dark:border-teal-600/60 shadow-sm font-semibold';
    }
    return 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300 border border-slate-300 dark:border-slate-700/60';
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
    <div className="w-full h-full flex flex-col space-y-4 pb-6 select-none font-sans">
      {/* Hidden File Input for Excel Import */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept=".xlsx,.xls,.csv" 
        className="hidden" 
      />

      {/* TOP CONTROL PANEL / HERO BAR */}
      <div className="bg-[#0b1329]/95 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden transition-all duration-300">
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
            <div className="bg-[#131d38] border border-slate-700/60 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-sm">
              <Layers className="w-4 h-4 text-cyan-400" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Rows</div>
                <div className="text-sm font-extrabold text-white">{summaryStats.totalRows}</div>
              </div>
            </div>

            <div className="bg-[#131d38] border border-orange-500/30 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-sm">
              <Clock className="w-4 h-4 text-orange-400" />
              <div>
                <div className="text-[10px] text-orange-300 uppercase font-bold tracking-wider">Waiting Image</div>
                <div className="text-sm font-extrabold text-orange-400">{summaryStats.waitingCount}</div>
              </div>
            </div>

            <div className="bg-[#131d38] border border-emerald-500/30 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <div>
                <div className="text-[10px] text-emerald-300 uppercase font-bold tracking-wider">Image Received</div>
                <div className="text-sm font-extrabold text-emerald-400">{summaryStats.receivedCount}</div>
              </div>
            </div>

            <div className="bg-[#131d38] border border-rose-500/30 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-sm">
              <XCircle className="w-4 h-4 text-rose-400" />
              <div>
                <div className="text-[10px] text-rose-300 uppercase font-bold tracking-wider">Cancelled</div>
                <div className="text-sm font-extrabold text-rose-400">{summaryStats.cancelCount}</div>
              </div>
            </div>

            {summaryStats.totalQuantity > 0 && (
              <div className="bg-[#131d38] border border-blue-500/30 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-sm">
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
      <div className="bg-[#0b1329] border border-slate-800 rounded-2xl shadow-2xl flex-1 flex flex-col overflow-hidden relative">
        {/* SPREADSHEET TABLE GRID (Scrollable) */}
        <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar border-b border-slate-800 max-h-[600px] min-h-[420px]">
          <table className="w-full border-collapse text-left text-xs sm:text-sm select-none">
            {/* TABLE HEADER (Cyan Excel Style like 2nd image) */}
            <thead className="sticky top-0 z-20 shadow-md">
              {/* Top Row: Excel Column Letters (A, B, C, D...) */}
              <tr className="bg-[#070e1f] text-slate-500 font-mono text-[10px] uppercase border-b border-slate-800">
                <th className="w-12 text-center py-1 border-r border-slate-800/80 bg-[#060b18]">
                  #
                </th>
                {currentSheet.columns.map((col, idx) => (
                  <th 
                    key={`letter-${col.id}`} 
                    className="py-1 px-3 border-r border-slate-800/80 text-center tracking-wider"
                    style={{ width: col.width ? `${col.width}px` : 'auto' }}
                  >
                    {getColumnLetter(idx)}
                  </th>
                ))}
                <th className="w-14 text-center py-1 bg-[#060b18]">Actions</th>
              </tr>

              {/* Main Header Row (Vibrant Cyan background as in reference image) */}
              <tr className="bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-400 text-slate-950 font-black tracking-tight border-b-2 border-cyan-600">
                {/* Checkbox select all */}
                <th className="w-12 py-3 px-2 text-center border-r border-cyan-500/60 bg-cyan-400/95">
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
                      className="py-2.5 px-3 border-r border-cyan-500/60 text-slate-950 font-bold group relative"
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
                <th className="w-14 py-2.5 px-2 text-center bg-cyan-400/95 text-slate-950 font-bold">
                  Edit
                </th>
              </tr>
            </thead>

            {/* TABLE BODY (Rows & Cells) */}
            <tbody className="divide-y divide-slate-800/60 bg-[#091024]">
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
                          ? 'bg-cyan-950/40 border-l-4 border-l-cyan-400' 
                          : rowIdx % 2 === 0 
                            ? 'bg-[#0b132a] hover:bg-[#111c3d]' 
                            : 'bg-[#080e21] hover:bg-[#111c3d]'
                      }`}
                    >
                      {/* Row Index & Checkbox */}
                      <td className="w-12 py-2 px-2 text-center border-r border-slate-800 text-slate-400 font-mono text-xs bg-[#060b18]/60 group-hover:bg-[#080f26]">
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

                        // Check if this is the Status Column (Special Dropdown Badge)
                        if (col.id === 'status' || col.type === 'select') {
                          return (
                            <td 
                              key={`${row.id}-${col.id}`}
                              tabIndex={0}
                              onFocus={() => setSelectedCell({ rowId: row.id, colId: col.id })}
                              onKeyDown={(e) => handleCellKeyDown(e, row.id, col.id)}
                              className={`py-1.5 px-3 border-r border-slate-800/80 relative transition-all ${
                                isCellSelected ? 'ring-2 ring-cyan-400 ring-inset z-10 bg-cyan-950/30' : ''
                              }`}
                            >
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div 
                                    className="cursor-pointer flex items-center justify-between w-full"
                                    onClick={() => setSelectedCell({ rowId: row.id, colId: col.id })}
                                  >
                                    {cellValue ? (
                                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold transition-transform group-hover:scale-[1.02] ${getStatusBadgeStyle(cellValue)}`}>
                                        {cellValue}
                                      </span>
                                    ) : (
                                      <span className="text-slate-600 italic text-xs flex items-center gap-1 hover:text-slate-400">
                                        <Plus className="w-3 h-3" /> Select status
                                      </span>
                                    )}
                                    <MoreHorizontal className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-56 bg-[#0d162d] border border-cyan-500/40 text-slate-100 p-1.5 rounded-xl shadow-2xl z-50">
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
                                        <span className={`px-2 py-0.5 rounded-full text-[11px] ${getStatusBadgeStyle(statusOpt)}`}>
                                          {statusOpt}
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
                            className={`py-2 px-3 border-r border-slate-800/80 text-slate-200 text-xs sm:text-sm font-medium relative focus:outline-none transition-all ${
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
                                ) : (
                                  <span className="text-slate-600/40 select-none">&mdash;</span>
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
        <div className="bg-[#080f24] px-4 py-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-slate-300">
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
                        className={`min-w-[32px] h-8 rounded-lg font-bold text-xs transition-all ${
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
        <div className="bg-[#050914] px-4 py-2 border-t border-slate-800/90 flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar">
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
    </div>
  );
}
