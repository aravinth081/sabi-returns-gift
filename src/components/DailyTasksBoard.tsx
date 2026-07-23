import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { 
  Plus, X, Upload, Pencil, Trash2, Phone, Calendar as CalendarIcon, 
  MessageSquare, ClipboardList, ShoppingBag, Trash,
  ArrowUpDown, ArrowUp, ArrowDown, GripVertical, MoreVertical,
  Heart, Camera, FileSpreadsheet, Download
} from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
// --- FIREBASE IMPORTS ---
import { doc, setDoc, getDoc, onSnapshot, arrayUnion, collection, addDoc } from 'firebase/firestore';
import { db } from '@/firebase';

export interface DailyTaskCard {
  id: string;
  title: string;
  phoneNumber: string;
  status: 'Waiting for Image' | 'Image Edit Pending' | 'Order Completed' | 'Cancelled';
  chocolateCount: string;
  birthdayDate: string;
  comments: string;
  favorite?: boolean;
  importedFromFile?: string;
}

export interface DailyTaskList {
  id: string;
  title: string;
  cards: DailyTaskCard[];
}

type SortMode = 'default' | 'asc' | 'desc' | 'favorites';

const normalizePhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
};

const triggerForwardToPrintNotification = async (card: DailyTaskCard) => {
  try {
    const notifyDocRef = doc(db, 'daily_tasks_board', 'notifications');
    
    // Fetch current notifications to prevent duplicate fires within 5 seconds
    const docSnap = await getDoc(notifyDocRef);
    let items = [];
    if (docSnap.exists()) {
      items = docSnap.data().items || [];
    }

    const now = Date.now();
    const isDuplicate = items.some((item: any) => 
      item.cardId === card.id && 
      (now - new Date(item.timestamp).getTime()) < 5000
    );

    if (isDuplicate) {
      console.log('Duplicate notification blocked for card:', card.id);
      return;
    }

    const newNotification = {
      id: `notify-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      cardId: card.id,
      cardTitle: card.title,
      phoneNumber: card.phoneNumber,
      chocolateCount: card.chocolateCount || '',
      birthdayDate: card.birthdayDate || '',
      comments: card.comments || '',
      timestamp: new Date().toISOString(),
      read: false
    };

    items.push(newNotification);
    await setDoc(notifyDocRef, { items }, { merge: true });
    console.log('Notification triggered for', card.phoneNumber);
  } catch (err) {
    console.error('Failed to trigger notification:', err);
  }
};

const DEFAULT_LISTS: DailyTaskList[] = [
  { id: 'list-july', title: 'July', cards: [] },
  { id: 'list-aug', title: 'Aug', cards: [] },
  { id: 'list-image-pending', title: 'Image Edit Pending', cards: [] },
  { id: 'list-image-no-resp', title: 'Image Edited (No Response)', cards: [] },
  { id: 'list-image-not-paid', title: 'Image Edited (Not Paid)', cards: [] },
  { id: 'list-completed', title: 'Order Completed', cards: [] }
];

const formatDateToDDMMYYYY = (dateStr: string) => {
  if (!dateStr) return "";
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  return `${day}-${month}-${year}`;
};

const STORAGE_KEY = 'sabi_daily_tasks_board';
const SORT_STORAGE_KEY = 'sabi_daily_tasks_sort';

export default function DailyTasksBoard({ onWallpaperChange }: { onWallpaperChange?: () => void } = {}) {
  const [lists, setLists] = useState<DailyTaskList[]>([]);
  const [selectedCard, setSelectedCard] = useState<DailyTaskCard | null>(null);
  const [selectedCardListId, setSelectedCardListId] = useState<string | null>(null);
  const [isAddingCardListId, setIsAddingCardListId] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedFilterDate, setSelectedFilterDate] = useState<string>("");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ id: string; name: string; uploadedAt: string; count: number }[]>([]);
  
  // Card Selection State
  const [selectedCardIds, setSelectedCardIds] = useState<Record<string, string[]>>({});
  
  // Last Deleted List State
  const [lastDeletedList, setLastDeletedList] = useState<{ list: DailyTaskList; index: number } | null>(null);
  const lastDeletedListRef = useRef<{ list: DailyTaskList; index: number } | null>(null);

  // List title editing state
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingListTitle, setEditingListTitle] = useState('');
  const listTitleInputRef = useRef<HTMLInputElement>(null);

  // Sort preferences per list
  const [sortPreferences, setSortPreferences] = useState<Record<string, SortMode>>({});
  const [openSortMenuListId, setOpenSortMenuListId] = useState<string | null>(null);
  const [openMoreMenuListId, setOpenMoreMenuListId] = useState<string | null>(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  
  // Add List state
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const newListInputRef = useRef<HTMLInputElement>(null);
  const originalFocusValue = useRef<{ cardId: string; field: string; value: any } | null>(null);

  // Card Drag states
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [draggedSourceListId, setDraggedSourceListId] = useState<string | null>(null);
  const [dragOverListId, setDragOverListId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);

  // List Drag states
  const [draggedListId, setDraggedListId] = useState<string | null>(null);
  const [dragOverListIndex, setDragOverListIndex] = useState<number | null>(null);

  const isCardSelected = (listId: string, cardId: string) => {
    return selectedCardIds[listId]?.includes(cardId) || false;
  };

  const toggleCardSelection = (listId: string, cardId: string) => {
    setSelectedCardIds(prev => {
      const listSelected = prev[listId] || [];
      const newListSelected = listSelected.includes(cardId)
        ? listSelected.filter(id => id !== cardId)
        : [...listSelected, cardId];
      return { ...prev, [listId]: newListSelected };
    });
  };

  const toggleSelectAll = (listId: string, cards: DailyTaskCard[]) => {
    setSelectedCardIds(prev => {
      const listSelected = prev[listId] || [];
      const allCardIds = cards.map(c => c.id);
      const isAllSelected = allCardIds.length > 0 && allCardIds.every(id => listSelected.includes(id));
      return {
        ...prev,
        [listId]: isAllSelected ? [] : allCardIds
      };
    });
  };

  const handleBulkDelete = (listId: string, listTitle: string) => {
    const idsToDelete = selectedCardIds[listId] || [];
    if (idsToDelete.length === 0) return;
    if (confirm(`Are you sure you want to delete the ${idsToDelete.length} selected card(s) from "${listTitle}"?`)) {
      const updated = lists.map(list => {
        if (list.id === listId) {
          return {
            ...list,
            cards: list.cards.filter(card => !idsToDelete.includes(card.id))
          };
        }
        return list;
      });
      saveLists(updated);
      setSelectedCardIds(prev => ({ ...prev, [listId]: [] }));
      toast.success(`${idsToDelete.length} cards deleted`);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<any>(null);
  const [wallpaper, setWallpaper] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const sortMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setOpenSortMenuListId(null);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setOpenMoreMenuListId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleWallpaperClick = () => {
    wallpaperInputRef.current?.click();
  };

  const logActivity = async (action: string) => {
    try {
      const loggedInName = localStorage.getItem('loggedInName') || 'Unknown';
      const role = localStorage.getItem('role') || 'Unknown';
      await addDoc(collection(db, "activity_logs"), {
        action,
        module: 'Daily Tasks',
        performedBy: loggedInName,
        username: loggedInName,
        role: role,
        timestamp: Date.now()
      });
    } catch (e) {
      console.error("logActivity error:", e);
    }
  };

  const handleWallpaperChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1200;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.7);
          setWallpaper(compressed);
          try {
            localStorage.setItem('sabi_daily_tasks_wallpaper', compressed);
            toast.success('Wallpaper updated!');
            onWallpaperChange?.();
          } catch (err) {
            console.error('Failed to save wallpaper:', err);
            toast.error('Failed to save wallpaper: storage quota exceeded.');
          }
        } else {
          setWallpaper(result);
          try {
            localStorage.setItem('sabi_daily_tasks_wallpaper', result);
            toast.success('Wallpaper updated!');
            onWallpaperChange?.();
          } catch (err) {
            console.error('Failed to save wallpaper:', err);
            toast.error('Failed to save wallpaper: storage quota exceeded.');
          }
        }
      };
      img.onerror = () => {
        setWallpaper(result);
        try {
          localStorage.setItem('sabi_daily_tasks_wallpaper', result);
          toast.success('Wallpaper updated!');
          onWallpaperChange?.();
        } catch (err) {
          console.error('Failed to save wallpaper:', err);
          toast.error('Failed to save wallpaper: storage quota exceeded.');
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handleResetWallpaper = () => {
    setWallpaper(null);
    localStorage.removeItem('sabi_daily_tasks_wallpaper');
    toast.success('Wallpaper reset to default');
    onWallpaperChange?.();
  };

  const handleDragOverFile = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingFile(true);
    }
  };

  const handleDragLeaveFile = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  };

  const handleDropFile = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        processExcelFile(file);
      } else {
        toast.error('Please drop a valid Excel file (.xlsx or .xls)');
      }
    }
  };

  // Firestore document reference for the entire board
  const boardDocRef = doc(db, 'daily_tasks_board', 'board_data');
  const isFirestoreUpdate = useRef(false); // Flag to avoid save loops

  // Load from localStorage first (instant), then sync with Firestore (real-time)
  useEffect(() => {
    const savedWallpaper = localStorage.getItem('sabi_daily_tasks_wallpaper');
    if (savedWallpaper) {
      setWallpaper(savedWallpaper);
    }
    
    // Load uploaded files list from cache
    const savedFiles = localStorage.getItem('sabi_daily_tasks_uploaded_files');
    if (savedFiles) {
      try { setUploadedFiles(JSON.parse(savedFiles)); } catch (e) {
        console.error('Failed to parse cached files list', e);
      }
    }

    // 1. Instant load from localStorage cache
    const savedLists = localStorage.getItem(STORAGE_KEY);
    if (savedLists) {
      try { setLists(JSON.parse(savedLists)); } catch (e) {
        console.error('Failed to parse cached board data', e);
        setLists(DEFAULT_LISTS);
      }
    } else {
      setLists(DEFAULT_LISTS);
    }

    const savedSort = localStorage.getItem(SORT_STORAGE_KEY);
    if (savedSort) {
      try { setSortPreferences(JSON.parse(savedSort)); } catch (e) {
        console.error('Failed to parse cached sort preferences', e);
      }
    }

    // 2. Real-time Firestore listener
    const unsubscribe = onSnapshot(boardDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        isFirestoreUpdate.current = true;
        if (data.lists) {
          setLists(data.lists);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data.lists));
        }
        if (data.uploadedFiles) {
          setUploadedFiles(data.uploadedFiles);
          localStorage.setItem('sabi_daily_tasks_uploaded_files', JSON.stringify(data.uploadedFiles));
        } else {
          setUploadedFiles([]);
          localStorage.removeItem('sabi_daily_tasks_uploaded_files');
        }
        if (data.sortPreferences) {
          setSortPreferences(data.sortPreferences);
          localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(data.sortPreferences));
        }
        setTimeout(() => { isFirestoreUpdate.current = false; }, 100);
      } else {
        // First time: save default data to Firestore
        setDoc(boardDocRef, {
          lists: DEFAULT_LISTS,
          uploadedFiles: [],
          sortPreferences: {},
          updatedAt: new Date().toISOString()
        }).catch(err => console.error('Failed to init Firestore board:', err));
      }
    }, (error) => {
      console.error('Firestore listener error:', error);
      toast.error('Database connection error. Using local data.');
    });

    return () => unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Local undo/redo stacks for DailyTasksBoard
  const undoStackRef = useRef<DailyTaskList[][]>([]);
  const redoStackRef = useRef<DailyTaskList[][]>([]);

  // Save to both Firestore and localStorage
  const saveLists = useCallback((updatedLists: DailyTaskList[], isUndoOrRedo = false, newFilesList?: typeof uploadedFiles) => {
    if (!isUndoOrRedo) {
      undoStackRef.current.push(JSON.parse(JSON.stringify(lists)));
      if (undoStackRef.current.length > 20) {
        undoStackRef.current.shift();
      }
      redoStackRef.current = []; // Clear redo stack on new action
    }
    setLists(updatedLists);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLists));

    const filesToSave = newFilesList !== undefined ? newFilesList : uploadedFiles;
    if (newFilesList !== undefined) {
      setUploadedFiles(newFilesList);
      localStorage.setItem('sabi_daily_tasks_uploaded_files', JSON.stringify(newFilesList));
    }

    // Clean any undefined values before saving to Firestore to prevent serialization errors
    const cleanedLists = JSON.parse(JSON.stringify(updatedLists));
    const cleanedFiles = JSON.parse(JSON.stringify(filesToSave));

    // Save to Firestore
    setDoc(boardDocRef, {
      lists: cleanedLists,
      uploadedFiles: cleanedFiles,
      updatedAt: new Date().toISOString()
    }, { merge: true }).catch(err => {
      console.error('Failed to save lists to Firestore:', err);
      toast.error('Failed to sync to database');
    });
  }, [lists, uploadedFiles]);

  const saveSortPreferences = useCallback((prefs: Record<string, SortMode>) => {
    setSortPreferences(prefs);
    localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(prefs));
    // Save to Firestore
    setDoc(boardDocRef, {
      sortPreferences: prefs,
      updatedAt: new Date().toISOString()
    }, { merge: true }).catch(err => {
      console.error('Failed to save sort prefs to Firestore:', err);
      toast.error('Failed to sync to database');
    });
  }, []);

  // Listen to global undo/redo events from Dashboard
  useEffect(() => {
    const handleUndoEvent = () => {
      if (undoStackRef.current.length > 0) {
        const prev = undoStackRef.current.pop();
        if (prev) {
          redoStackRef.current.push(JSON.parse(JSON.stringify(lists)));
          if (redoStackRef.current.length > 20) {
            redoStackRef.current.shift();
          }
          saveLists(prev, true);
          toast.success("Board action undone!");
        }
      } else {
        toast.info("No recent board actions to undo");
      }
    };

    const handleRedoEvent = () => {
      if (redoStackRef.current.length > 0) {
        const next = redoStackRef.current.pop();
        if (next) {
          undoStackRef.current.push(JSON.parse(JSON.stringify(lists)));
          if (undoStackRef.current.length > 20) {
            undoStackRef.current.shift();
          }
          saveLists(next, true);
          toast.success("Board action redone!");
        }
      } else {
        toast.info("No recent board actions to redo");
      }
    };

    window.addEventListener('sabi-daily-tasks-undo', handleUndoEvent);
    window.addEventListener('sabi-daily-tasks-redo', handleRedoEvent);
    return () => {
      window.removeEventListener('sabi-daily-tasks-undo', handleUndoEvent);
      window.removeEventListener('sabi-daily-tasks-redo', handleRedoEvent);
    };
  }, [saveLists, lists]);

  // Sort cards by birthday or favorites
  const getSortedCards = useCallback((cards: DailyTaskCard[], sortMode: SortMode): DailyTaskCard[] => {
    if (sortMode === 'favorites') {
      const favorites = cards.filter(c => c.favorite);
      const nonFavorites = cards.filter(c => !c.favorite);
      return [...favorites, ...nonFavorites];
    }
    if (sortMode === 'default') return cards;
    
    return [...cards].sort((a, b) => {
      const dateA = a.birthdayDate ? new Date(a.birthdayDate).getTime() : 0;
      const dateB = b.birthdayDate ? new Date(b.birthdayDate).getTime() : 0;
      
      if (!a.birthdayDate && !b.birthdayDate) return 0;
      if (!a.birthdayDate) return 1;
      if (!b.birthdayDate) return -1;
      
      return sortMode === 'asc' ? dateA - dateB : dateB - dateA;
    });
  }, []);

  // ==================== LIST ACTIONS ====================

  const handleEditListTitleStart = (listId: string, currentTitle: string) => {
    setEditingListId(listId);
    setEditingListTitle(currentTitle);
    setTimeout(() => {
      if (listTitleInputRef.current) {
        listTitleInputRef.current.focus();
        listTitleInputRef.current.select();
      }
    }, 50);
  };

  const handleSaveListTitle = (listId: string) => {
    if (!editingListTitle.trim()) {
      setEditingListId(null);
      return;
    }
    const oldList = lists.find(list => list.id === listId);
    const oldTitle = oldList ? oldList.title : '';
    const newTitle = editingListTitle.trim();
    const updated = lists.map(list => 
      list.id === listId ? { ...list, title: newTitle } : list
    );
    saveLists(updated);
    if (oldTitle && oldTitle !== newTitle) {
      logActivity(`Renamed Daily Task list from '${oldTitle}' to '${newTitle}'`);
    }
    setEditingListId(null);
  };

  const handleAddList = () => {
    if (!newListTitle.trim()) {
      toast.error('Please enter a list name');
      return;
    }
    const newList: DailyTaskList = {
      id: `list-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: newListTitle.trim(),
      cards: []
    };
    saveLists([...lists, newList]);
    logActivity(`Created new Daily Task list '${newList.title}'`);
    setNewListTitle('');
    setIsAddingList(false);
    toast.success(`List "${newList.title}" created!`);
  };

  const handleDeleteList = (listId: string, listTitle: string) => {
    const list = lists.find(l => l.id === listId);
    const index = lists.findIndex(l => l.id === listId);
    const cardCount = list?.cards.length || 0;
    const msg = cardCount > 0 
      ? `Delete "${listTitle}" and its ${cardCount} card(s)?`
      : `Delete the empty list "${listTitle}"?`;
    
    if (confirm(msg)) {
      if (list) {
        const deletedInfo = { list, index };
        setLastDeletedList(deletedInfo);
        lastDeletedListRef.current = deletedInfo;
      }
      
      const updated = lists.filter(l => l.id !== listId);
      saveLists(updated);
      logActivity(`Deleted Daily Task list '${listTitle}'`);
      const newPrefs = { ...sortPreferences };
      delete newPrefs[listId];
      saveSortPreferences(newPrefs);
      setOpenMoreMenuListId(null);
      
      toast.success(`List "${listTitle}" deleted successfully`, {
        action: {
          label: 'Undo',
          onClick: () => {
            const info = lastDeletedListRef.current;
            if (info) {
              setLists(prev => {
                const restored = [...prev];
                restored.splice(info.index, 0, info.list);
                saveLists(restored);
                logActivity(`Restored Daily Task list '${info.list.title}'`);
                return restored;
              });
              setLastDeletedList(null);
              lastDeletedListRef.current = null;
              toast.success(`List "${info.list.title}" restored`);
            }
          }
        },
        duration: 30000
      });
    }
  };

  // ==================== CARD ACTIONS ====================

  const handleAddCardStart = (listId: string) => {
    setIsAddingCardListId(listId);
    setNewCardTitle('');
  };

  const handleAddCardSubmit = (listId: string) => {
    if (!newCardTitle.trim()) {
      setIsAddingCardListId(null);
      return;
    }

    const phone = newCardTitle.trim();
    const normPhone = normalizePhone(phone);

    let isDuplicate = false;
    if (normPhone) {
      for (const list of lists) {
        for (const card of list.cards) {
          const normExisting = normalizePhone(card.phoneNumber);
          if (card.phoneNumber.trim() === phone || normExisting === normPhone) {
            isDuplicate = true;
            break;
          }
        }
        if (isDuplicate) break;
      }
    }

    if (isDuplicate) {
      toast.error(`Phone Number ${phone} already exists on the board!`);
      return;
    }

    const newCard: DailyTaskCard = {
      id: `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: phone,
      phoneNumber: phone,
      status: 'Waiting for Image',
      chocolateCount: '',
      birthdayDate: '',
      comments: ''
    };

    const updated = lists.map(list => {
      if (list.id === listId) {
        return { ...list, cards: [...list.cards, newCard] };
      }
      return list;
    });

    const targetList = lists.find(l => l.id === listId);
    const listTitle = targetList ? targetList.title : '';

    saveLists(updated);
    if (listTitle.toLowerCase().includes('print')) {
      triggerForwardToPrintNotification(newCard);
    }
    logActivity(`Added lead card for '${phone}' to list '${listTitle}'`);
    setIsAddingCardListId(null);
    setNewCardTitle('');
    toast.success('Card added successfully!');
  };

  const handleDeleteCard = (listId: string, cardId: string) => {
    if (confirm('Are you sure you want to delete this card?')) {
      const targetList = lists.find(l => l.id === listId);
      const listTitle = targetList ? targetList.title : '';
      const card = targetList?.cards.find(c => c.id === cardId);
      const cardTitle = card ? (card.title || card.phoneNumber) : '';

      const updated = lists.map(list => {
        if (list.id === listId) {
          return { ...list, cards: list.cards.filter(c => c.id !== cardId) };
        }
        return list;
      });
      saveLists(updated);
      logActivity(`Deleted Daily Task card '${cardTitle}' from list '${listTitle}'`);
      setSelectedCard(null);
      setSelectedCardIds(prev => ({
        ...prev,
        [listId]: (prev[listId] || []).filter(id => id !== cardId)
      }));
      toast.success('Card deleted');
    }
  };

  const handleCancelCard = (sourceListId: string, cardId: string) => {
    const sourceList = lists.find(l => l.id === sourceListId);
    const card = sourceList?.cards.find(c => c.id === cardId);
    if (!card) return;

    let targetList = lists.find(l => l.title.toLowerCase().trim() === 'cancelled');
    let updatedLists = [...lists];

    if (!targetList) {
      const newListId = `list-cancelled`;
      targetList = {
        id: newListId,
        title: 'Cancelled',
        cards: []
      };
      updatedLists.push(targetList);
    }

    const updatedCard = { ...card, status: 'Cancelled' as const };

    updatedLists = updatedLists.map(list => {
      if (list.id === sourceListId) {
        return { ...list, cards: list.cards.filter(c => c.id !== cardId) };
      }
      if (list.id === targetList!.id) {
        const filtered = list.cards.filter(c => c.id !== cardId);
        return { ...list, cards: [...filtered, updatedCard] };
      }
      return list;
    });

    const cardTitle = card.title || card.phoneNumber;

    saveLists(updatedLists);
    logActivity(`Cancelled Daily Task card '${cardTitle}'`);
    setSelectedCardIds(prev => ({
      ...prev,
      [sourceListId]: (prev[sourceListId] || []).filter(id => id !== cardId)
    }));
    toast.success('Card cancelled and moved to "Cancelled" list');
  };

  const handleCardStatusChange = (listId: string, cardId: string, newStatus: DailyTaskCard['status']) => {
    const targetList = lists.find(l => l.id === listId);
    const card = targetList?.cards.find(c => c.id === cardId);
    const cardTitle = card ? (card.title || card.phoneNumber) : '';

    const updated = lists.map(list => {
      if (list.id === listId) {
        return {
          ...list,
          cards: list.cards.map(card => 
            card.id === cardId ? { ...card, status: newStatus } : card
          )
        };
      }
      return list;
    });
    saveLists(updated);
    logActivity(`Changed status of lead '${cardTitle}' to '${newStatus}'`);
    toast.success('Card status updated');
  };

  const handleInputFocus = (cardId: string, field: keyof DailyTaskCard, value: any) => {
    originalFocusValue.current = { cardId, field, value };
  };

  const handleInputBlur = (listId: string, cardId: string, field: keyof DailyTaskCard, currentValue: any) => {
    const orig = originalFocusValue.current;
    if (orig && orig.cardId === cardId && orig.field === field) {
      if (orig.value !== currentValue) {
        const targetList = lists.find(l => l.id === listId);
        const card = targetList?.cards.find(c => c.id === cardId);
        const cardTitle = card ? (card.title || card.phoneNumber) : '';
        logActivity(`Updated ${field} of lead '${cardTitle}' to '${currentValue}'`);
      }
    }
    originalFocusValue.current = null;
  };

  const handleCardFieldChange = (listId: string, cardId: string, field: keyof DailyTaskCard, value: any) => {
    const targetList = lists.find(l => l.id === listId);
    const card = targetList?.cards.find(c => c.id === cardId);
    const cardTitle = card ? (card.title || card.phoneNumber) : '';

    const updated = lists.map(list => {
      if (list.id === listId) {
        return {
          ...list,
          cards: list.cards.map(card => 
            card.id === cardId ? { ...card, [field]: value } : card
          )
        };
      }
      return list;
    });
    saveLists(updated);
    if (field === 'favorite') {
      logActivity(`${value ? 'Marked' : 'Unmarked'} lead '${cardTitle}' as favorite`);
    } else if (field === 'status') {
      logActivity(`Changed status of lead '${cardTitle}' to '${value}'`);
    }
  };

  const handlePhoneBlur = (listId: string, card: DailyTaskCard, originalPhone: string) => {
    const val = card.phoneNumber.trim();
    if (!val) {
      toast.error("Phone number cannot be empty.");
      handleCardFieldChange(listId, card.id, 'phoneNumber', originalPhone);
      return;
    }
    
    const norm = normalizePhone(val);
    let isDuplicate = false;
    if (norm && val !== originalPhone) {
      for (const list of lists) {
        for (const c of list.cards) {
          if (c.id === card.id) continue;
          if (normalizePhone(c.phoneNumber) === norm) {
            isDuplicate = true;
            break;
          }
        }
        if (isDuplicate) break;
      }
    }
    
    if (isDuplicate) {
      toast.error(`Phone number ${val} already exists!`);
      handleCardFieldChange(listId, card.id, 'phoneNumber', originalPhone);
    } else if (val !== originalPhone) {
      logActivity(`Updated phoneNumber of lead '${card.title || val}' to '${val}'`);
    }
  };

  // ==================== CARD DRAG & DROP ====================

  const handleCardDragStart = (e: React.DragEvent, cardId: string, sourceListId: string) => {
    e.stopPropagation();
    setDraggedCardId(cardId);
    setDraggedSourceListId(sourceListId);
    e.dataTransfer.setData('application/card-drag', JSON.stringify({ cardId, sourceListId }));
    e.dataTransfer.effectAllowed = 'move';
    const target = e.currentTarget as HTMLElement;
    setTimeout(() => { target.style.opacity = '0.4'; }, 0);
  };

  const handleBoardDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!boardContainerRef.current) return;

    const container = boardContainerRef.current;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const scrollThreshold = 100;
    const maxScrollSpeed = 20;

    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }

    if (x < scrollThreshold) {
      const speed = Math.max(2, Math.round(((scrollThreshold - x) / scrollThreshold) * maxScrollSpeed));
      scrollIntervalRef.current = setInterval(() => {
        container.scrollLeft -= speed;
      }, 16);
    } else if (x > width - scrollThreshold) {
      const speed = Math.max(2, Math.round(((x - (width - scrollThreshold)) / scrollThreshold) * maxScrollSpeed));
      scrollIntervalRef.current = setInterval(() => {
        container.scrollLeft += speed;
      }, 16);
    }
  };

  const handleBoardDragLeave = () => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  };

  const handleCardDragEnd = (e: React.DragEvent) => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '1';
    setDraggedCardId(null);
    setDraggedSourceListId(null);
    setDragOverListId(null);
    setDragOverCardId(null);
  };

  const handleDragOverCard = (e: React.DragEvent, cardId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedCardId && draggedCardId !== cardId) {
      setDragOverCardId(cardId);
    }
  };

  const handleDragOverListForCards = (e: React.DragEvent, listId: string) => {
    e.preventDefault();
    if (draggedCardId) {
      setDragOverListId(listId);
    }
  };

  const handleCardDrop = (e: React.DragEvent, targetListId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }

    const sourceCardId = draggedCardId;
    const sourceListId = draggedSourceListId;

    setDraggedCardId(null);
    setDraggedSourceListId(null);
    setDragOverListId(null);
    setDragOverCardId(null);

    if (!sourceCardId || !sourceListId) return;

    const sourceList = lists.find(l => l.id === sourceListId);
    const cardToMove = sourceList?.cards.find(c => c.id === sourceCardId);
    if (!cardToMove) return;

    let updatedLists = [...lists];

    if (sourceListId === targetListId) {
      const targetList = updatedLists.find(l => l.id === targetListId);
      if (!targetList) return;
      const filteredCards = targetList.cards.filter(c => c.id !== sourceCardId);
      let targetIndex = filteredCards.length;
      if (dragOverCardId) {
        targetIndex = filteredCards.findIndex(c => c.id === dragOverCardId);
        if (targetIndex === -1) targetIndex = filteredCards.length;
      }
      filteredCards.splice(targetIndex, 0, cardToMove);
      updatedLists = updatedLists.map(l => 
        l.id === targetListId ? { ...l, cards: filteredCards } : l
      );
      saveLists(updatedLists);
      logActivity(`Reordered card '${cardToMove.title || cardToMove.phoneNumber}' inside list '${sourceList?.title}'`);
    } else {
      const targetList = updatedLists.find(l => l.id === targetListId);
      
      // Determine status update based on target list title
      let newStatus = cardToMove.status;
      const targetTitle = targetList?.title.toLowerCase().trim() || '';
      if (targetTitle.includes('pending')) {
        newStatus = 'Image Edit Pending';
      } else if (targetTitle.includes('completed')) {
        newStatus = 'Order Completed';
      } else if (targetTitle.includes('cancelled')) {
        newStatus = 'Cancelled';
      } else if (targetTitle.includes('july') || targetTitle.includes('aug')) {
        newStatus = 'Waiting for Image';
      }

      const updatedCard = { ...cardToMove, status: newStatus };

      if (targetTitle.includes('print')) {
        updatedCard.timestamp = new Date().toISOString();
        triggerForwardToPrintNotification(updatedCard);
      }

      updatedLists = updatedLists.map(list => {
        if (list.id === sourceListId) {
          return { ...list, cards: list.cards.filter(c => c.id !== sourceCardId) };
        }
        if (list.id === targetListId) {
          const filteredCards = [...list.cards];
          let targetIndex = filteredCards.length;
          if (dragOverCardId) {
            targetIndex = filteredCards.findIndex(c => c.id === dragOverCardId);
            if (targetIndex === -1) targetIndex = filteredCards.length;
          }
          filteredCards.splice(targetIndex, 0, updatedCard);
          return { ...list, cards: filteredCards };
        }
        return list;
      });

      // Update card selection state: transfer selection from source list to target list if selected
      setSelectedCardIds(prev => {
        const sourceSelected = prev[sourceListId] || [];
        if (sourceSelected.includes(sourceCardId)) {
          return {
            ...prev,
            [sourceListId]: sourceSelected.filter(id => id !== sourceCardId),
            [targetListId]: [...(prev[targetListId] || []), sourceCardId]
          };
        }
        return prev;
      });
      saveLists(updatedLists);
      logActivity(`Moved lead card '${cardToMove.title || cardToMove.phoneNumber}' from list '${sourceList?.title}' to '${targetList?.title}'`);
    }
  };

  // ==================== LIST DRAG & DROP ====================

  const handleListDragStart = (e: React.DragEvent, listId: string) => {
    if (draggedCardId) { e.preventDefault(); return; }
    setDraggedListId(listId);
    e.dataTransfer.setData('application/list-drag', listId);
    e.dataTransfer.effectAllowed = 'move';
    const target = e.currentTarget as HTMLElement;
    setTimeout(() => { target.style.opacity = '0.5'; target.style.transform = 'scale(0.97)'; }, 0);
  };

  const handleListDragEnd = (e: React.DragEvent) => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '1';
    target.style.transform = '';
    setDraggedListId(null);
    setDragOverListIndex(null);
  };

  const handleListDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedListId) {
      setDragOverListIndex(index);
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleListDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
    const listId = draggedListId;

    setDraggedListId(null);
    setDragOverListIndex(null);

    if (!listId) return;

    const sourceIndex = lists.findIndex(l => l.id === listId);
    if (sourceIndex === -1 || sourceIndex === targetIndex) {
      return;
    }

    const updatedLists = [...lists];
    const [movedList] = updatedLists.splice(sourceIndex, 1);
    updatedLists.splice(targetIndex, 0, movedList);

    saveLists(updatedLists);
    logActivity(`Reordered list '${movedList.title}' on the board`);
    toast.success('List reordered!');
  };

  // ==================== CARD DETAILS MODAL ====================

  const handleOpenDetailsModal = (card: DailyTaskCard, listId: string) => {
    setSelectedCard({ ...card });
    setSelectedCardListId(listId);
  };

  const handleUpdateCardDetails = () => {
    if (!selectedCard || !selectedCardListId) return;

    const phone = selectedCard.phoneNumber.trim();
    if (!phone) {
      toast.error('Phone Number cannot be empty!');
      return;
    }

    const currentList = lists.find(l => l.id === selectedCardListId);
    const originalCard = currentList?.cards.find(c => c.id === selectedCard.id);
    const isPhoneModified = originalCard?.phoneNumber !== phone;

    if (isPhoneModified) {
      const normPhone = normalizePhone(phone);
      let isDuplicate = false;
      if (normPhone) {
        for (const list of lists) {
          for (const card of list.cards) {
            if (card.id === selectedCard.id) continue;
            const normExisting = normalizePhone(card.phoneNumber);
            if (card.phoneNumber.trim() === phone || normExisting === normPhone) {
              isDuplicate = true;
              break;
            }
          }
          if (isDuplicate) break;
        }
      }

      if (isDuplicate) {
        toast.error(`Phone Number ${phone} already exists on the board!`);
        return;
      }
    }

    const updated = lists.map(list => {
      if (list.id === selectedCardListId) {
        return { ...list, cards: list.cards.map(c => c.id === selectedCard.id ? { ...selectedCard } : c) };
      }
      return list;
    });

    saveLists(updated);
    logActivity(`Updated details of lead '${selectedCard.title || selectedCard.phoneNumber}'`);
    setSelectedCard(null);
    setSelectedCardListId(null);
    toast.success('Card details updated!');
  };

  // ==================== EXCEL IMPORT ====================

  const handleImportClick = () => { fileInputRef.current?.click(); };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processExcelFile(file);
  };

  const processExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

        if (!jsonData || jsonData.length === 0) {
          toast.error('The Excel file is empty.');
          return;
        }

        const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const fileName = file.name;
        const uploadedAt = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        const getPhoneValue = (row: any) => {
          const keys = Object.keys(row);
          for (const key of keys) {
            const norm = key.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (norm === 'phonenumber' || norm === 'phone' || norm === 'mobile' || norm === 'contact' || norm === 'phoneno' || norm === 'contactno') return row[key];
          }
          for (const key of keys) {
            const norm = key.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (norm.includes('phone') || norm.includes('mobile') || norm.includes('contact') || norm.includes('tel')) return row[key];
          }
          return undefined;
        };

        const getLabelValue = (row: any) => {
          const keys = Object.keys(row);
          for (const key of keys) {
            if (key.trim().toLowerCase() === 'labels') return row[key];
          }
          return undefined;
        };

        const cleanLabelText = (label: string): string => {
          if (!label) return '';
          const noEmojis = label.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "");
          return noEmojis.replace(/[^\w\s\(\)\-]/g, '').replace(/\s+/g, ' ').trim();
        };

        let importCount = 0;
        let skipDuplicateCount = 0;
        let skipMissingCount = 0;

        const updatedLists = lists.map(list => ({ ...list, cards: [...list.cards] }));

        jsonData.forEach((row: any) => {
          const rawPhone = getPhoneValue(row);
          const rawLabel = getLabelValue(row);

          if (rawPhone === undefined || rawPhone === null) { skipMissingCount++; return; }

          const phoneStr = String(rawPhone).trim();
          if (!phoneStr) { skipMissingCount++; return; }

          const normImported = normalizePhone(phoneStr);

          // Find if duplicate exists on the board
          let existingCard: DailyTaskCard | null = null;
          let existingListIndex = -1;
          let existingCardIndex = -1;

          if (normImported) {
            for (let li = 0; li < updatedLists.length; li++) {
              const list = updatedLists[li];
              for (let ci = 0; ci < list.cards.length; ci++) {
                const card = list.cards[ci];
                const normExisting = normalizePhone(card.phoneNumber);
                if (card.phoneNumber.trim() === phoneStr || normExisting === normImported) {
                  existingCard = card;
                  existingListIndex = li;
                  existingCardIndex = ci;
                  break;
                }
              }
              if (existingCard) break;
            }
          }

          // Determine target list for this row
          const labelVal = String(rawLabel || '').trim();
          if (!labelVal) {
            skipMissingCount++;
            return;
          }
          
          const isImportant = labelVal.toLowerCase().includes('important');

          const defaultListMappings = [
            { key: 'july', index: 0 },
            { key: 'aug', index: 1 },
            { key: 'imageeditpending', index: 2 },
            { key: 'imageeditednoresponse', index: 3 },
            { key: 'imageeditednotpaid', index: 4 },
            { key: 'ordercompleted', index: 5 }
          ];

          let targetListIndex = -1;

          // 1. Try to match exact list title case-insensitively (trimmed)
          targetListIndex = updatedLists.findIndex(
            list => list.title.trim().toLowerCase() === labelVal.toLowerCase()
          );

          // 2. Try to match list title by cleaning special characters/whitespace
          if (targetListIndex === -1) {
            const cleanedLabelVal = cleanLabelText(labelVal).toLowerCase().replace(/\s+/g, '');
            for (let i = 0; i < updatedLists.length; i++) {
              const listTitleCleaned = cleanLabelText(updatedLists[i].title).toLowerCase().replace(/\s+/g, '');
              if (listTitleCleaned && listTitleCleaned === cleanedLabelVal) {
                targetListIndex = i;
                break;
              }
            }
          }

          // 3. Try to match default list mappings
          if (targetListIndex === -1) {
            const cleanedLabelVal = cleanLabelText(labelVal).toLowerCase().replace(/\s+/g, '');
            const match = defaultListMappings.find(m => cleanedLabelVal === m.key);
            if (match) {
              targetListIndex = match.index;
            }
          }

          // 4. Do NOT fallback to first list if label is specified but invalid
          if (targetListIndex === -1) {
            skipMissingCount++;
            return;
          }

          if (existingCard) {
            // It's a duplicate. Check if target list is different
            if (existingListIndex !== targetListIndex) {
              // Move existing card to target list
              // Determine status update based on target list title
              let newStatus = existingCard.status;
              const targetTitle = updatedLists[targetListIndex].title.toLowerCase().trim();
              if (targetTitle.includes('pending')) {
                newStatus = 'Image Edit Pending';
              } else if (targetTitle.includes('completed')) {
                newStatus = 'Order Completed';
              } else if (targetTitle.includes('cancelled')) {
                newStatus = 'Cancelled';
              } else if (targetTitle.includes('july') || targetTitle.includes('aug')) {
                newStatus = 'Waiting for Image';
              }

              // Remove from old list
              updatedLists[existingListIndex].cards.splice(existingCardIndex, 1);
              
              // Update status, move card, and apply favorite flag if 'Important'
              const movedCard = { 
                ...existingCard, 
                status: newStatus,
                favorite: isImportant ? true : existingCard.favorite
              };
              updatedLists[targetListIndex].cards.push(movedCard);
              importCount++;

              // Trigger notification if target list is "Forward to Print"
              if (targetTitle === 'forward to print') {
                triggerForwardToPrintNotification(movedCard);
              }
            } else {
              // Same list, update favorite if needed
              if (isImportant && !existingCard.favorite) {
                updatedLists[existingListIndex].cards[existingCardIndex].favorite = true;
                importCount++;
              } else {
                skipDuplicateCount++;
              }
            }
            return;
          }

          // Create new card
          const newCard: DailyTaskCard = {
            id: `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: phoneStr,
            phoneNumber: phoneStr,
            status: 'Waiting for Image',
            chocolateCount: '',
            birthdayDate: '',
            comments: '',
            favorite: isImportant ? true : undefined,
            importedFromFile: fileId
          };

          const targetTitle = updatedLists[targetListIndex].title.toLowerCase().trim();
          if (targetTitle.includes('pending')) {
            newCard.status = 'Image Edit Pending';
          } else if (targetTitle.includes('completed')) {
            newCard.status = 'Order Completed';
          } else if (targetTitle.includes('cancelled')) {
            newCard.status = 'Cancelled';
          }

          updatedLists[targetListIndex].cards.push(newCard);
          importCount++;

          // Trigger notification if target list is "Forward to Print"
          if (targetTitle === 'forward to print') {
            triggerForwardToPrintNotification(newCard);
          }
        });

        const newFileEntry = {
          id: fileId,
          name: fileName,
          uploadedAt,
          count: importCount
        };
        const updatedFilesList = [...uploadedFiles, newFileEntry];

        saveLists(updatedLists, false, updatedFilesList);
        logActivity(`Uploaded Excel file to Daily Tasks board, added/moved ${importCount} cards`);
        toast.success(`Import complete: Added/Moved ${importCount} cards! (Skipped ${skipDuplicateCount} duplicates in same lists, ${skipMissingCount} invalid numbers)`);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        console.error('Error importing Excel:', err);
        toast.error('Failed to parse Excel file. Ensure it is formatted correctly.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExportExcel = () => {
    try {
      const exportRows: any[] = [];
      lists.forEach(list => {
        const sortMode = sortPreferences[list.id] || 'default';
        let displayCards = getSortedCards(list.cards, sortMode);
        if (selectedFilterDate) {
          displayCards = displayCards.filter(card => card.birthdayDate === selectedFilterDate);
        }
        displayCards.forEach(card => {
          exportRows.push({
            "List Name": list.title,
            "Phone Number": normalizePhone(card.phoneNumber),
            "Status": card.status || "Waiting for Image",
            "Birthday Date": card.birthdayDate || "",
            "Chocolate Count": card.chocolateCount || "",
            "Comments": card.comments || "",
            "Important": card.favorite ? "Yes" : "No"
          });
        });
      });

      if (exportRows.length === 0) {
        toast.error("No Daily Task data available to export.");
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Daily_Tasks");
      XLSX.writeFile(workbook, `Daily_Tasks_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(`Successfully exported ${exportRows.length} Daily Task cards to Excel!`);
    } catch (err) {
      console.error("Daily Task Export Error:", err);
      toast.error("Failed to export Daily Task data to Excel.");
    }
  };


  const handleDeleteUploadedFile = (fileId: string) => {
    if (window.confirm("Are you sure you want to delete this file and all new cards imported from it?")) {
      const updatedFilesList = uploadedFiles.filter(f => f.id !== fileId);
      const updatedLists = lists.map(list => ({
        ...list,
        cards: list.cards.filter((card: any) => card.importedFromFile !== fileId)
      }));
      saveLists(updatedLists, false, updatedFilesList);
      toast.success("Uploaded file and its imported cards deleted!");
    }
  };

  // ==================== HELPERS ====================

  const getStatusStyle = (status: DailyTaskCard['status']) => {
    switch (status) {
      case 'Waiting for Image': return 'bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border-amber-200';
      case 'Image Edit Pending': return 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border-blue-200';
      case 'Order Completed': return 'bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 border-emerald-200';
      case 'Cancelled': return 'bg-gradient-to-r from-rose-50 to-red-50 text-rose-700 border-rose-200';
      default: return 'bg-gradient-to-r from-slate-50 to-gray-50 text-slate-700 border-slate-200';
    }
  };

  const getSortIcon = (mode: SortMode) => {
    switch (mode) {
      case 'asc': return <ArrowUp size={13} />;
      case 'desc': return <ArrowDown size={13} />;
      case 'favorites': return <Heart size={13} className="fill-rose-500 text-rose-500" />;
      default: return <ArrowUpDown size={13} />;
    }
  };

  const getSortLabel = (mode: SortMode) => {
    switch (mode) {
      case 'asc': return 'Birthday \u2191';
      case 'desc': return 'Birthday \u2193';
      case 'favorites': return 'Favorites';
      default: return 'Default';
    }
  };

  // ==================== RENDER ====================

  return (
    <div 
      className="flex flex-col h-full w-full select-none relative p-6 rounded-3xl overflow-hidden min-h-[80vh]" 
      style={{ 
        backgroundImage: wallpaper ? `url(${wallpaper})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif"
      }}
      onDragOver={handleDragOverFile}
      onDragLeave={handleDragLeaveFile}
      onDrop={handleDropFile}
    >
      {/* Semi-transparent dark overlay for wallpaper readability */}
      {wallpaper && (
        <div className="absolute inset-0 bg-slate-950/60 z-0 pointer-events-none" />
      )}

      {/* File Drag and Drop Overlay */}
      {isDraggingFile && (
        <div className="absolute inset-0 bg-blue-950/85 z-[150] rounded-3xl flex flex-col items-center justify-center border-4 border-dashed border-blue-400 m-2 backdrop-blur-sm pointer-events-none">
          <Upload size={48} className="text-blue-300 animate-bounce mb-3" />
          <p className="text-xl font-black text-white">Drop Excel file here to Upload</p>
          <p className="text-xs text-blue-200 mt-1">Supports .xlsx and .xls formats</p>
        </div>
      )}

      <div className="relative z-10 flex flex-col h-full w-full">
        {/* Board Controls */}
        <div className="flex justify-between items-center mb-5 shrink-0 print:hidden flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2.5 tracking-wide">
              <div className="p-1.5 bg-blue-500/20 rounded-lg backdrop-blur-sm">
                <ClipboardList className="text-blue-300" size={22} />
              </div>
              Daily Tasks Board
            </h2>
            <p className="text-xs text-blue-200/50 font-medium mt-1 ml-10">Manage tasks and import leads dynamically.</p>
          </div>

          <div className="flex items-center gap-2.5">
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <button 
                  onClick={() => setIsCalendarOpen(true)}
                  className="flex items-center bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-xl border border-white/20 hover:border-white/40 transition-all shadow-lg px-4 py-2 gap-2.5 h-[42px] shrink-0 select-none outline-none focus:ring-2 focus:ring-emerald-400/50 cursor-pointer"
                >
                  <CalendarIcon size={16} className={`${selectedFilterDate ? 'text-emerald-400' : 'text-slate-300'} shrink-0 transition-colors`} />
                  <span className={`text-[13px] font-semibold tracking-wide ${selectedFilterDate ? 'text-emerald-400 font-bold' : 'text-slate-200'}`}>
                    {selectedFilterDate ? formatDateToDDMMYYYY(selectedFilterDate) : "Filter Date"}
                  </span>
                  {selectedFilterDate && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFilterDate('');
                      }}
                      className="ml-0.5 p-0.5 hover:bg-white/25 rounded-full text-emerald-400/80 hover:text-emerald-400 transition-all flex items-center justify-center shrink-0"
                      title="Clear Date Filter"
                    >
                      <X size={12} strokeWidth={2.5} />
                    </button>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-white border border-slate-200 text-slate-900 shadow-xl rounded-xl z-[1000] sabi-calendar-popover" align="end">
                <CalendarComponent
                  mode="single"
                  selected={selectedFilterDate ? new Date(selectedFilterDate + 'T00:00:00') : undefined}
                  onSelect={(date) => {
                    if (date) {
                      const yyyy = date.getFullYear();
                      const mm = String(date.getMonth() + 1).padStart(2, '0');
                      const dd = String(date.getDate()).padStart(2, '0');
                      setSelectedFilterDate(`${yyyy}-${mm}-${dd}`);
                    } else {
                      setSelectedFilterDate('');
                    }
                    setIsCalendarOpen(false);
                  }}
                  className="rounded-xl border-none p-3 bg-white"
                  classNames={{
                    months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                    month: "space-y-4",
                    caption: "flex justify-center pt-1 relative items-center mb-2",
                    caption_label: "text-sm font-bold text-slate-800 tracking-wide",
                    nav: "space-x-1 flex items-center",
                    nav_button: "h-7 w-7 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg flex items-center justify-center transition-colors cursor-pointer",
                    nav_button_previous: "absolute left-1",
                    nav_button_next: "absolute right-1",
                    table: "w-full border-collapse space-y-1",
                    head_row: "flex mb-1",
                    head_cell: "text-slate-500 font-bold text-[0.7rem] uppercase tracking-wider text-center py-1.5 w-8",
                    row: "flex w-full mt-1.5",
                    cell: "h-8 w-8 text-center text-xs p-0 relative focus-within:relative focus-within:z-20",
                    day: "h-8 w-8 p-0 font-semibold hover:bg-slate-100 rounded-lg transition-all text-slate-800 text-center flex items-center justify-center cursor-pointer",
                    day_selected: "bg-slate-900 text-white hover:bg-slate-800 hover:text-white focus:bg-slate-900 focus:text-white font-bold rounded-lg shadow-md",
                    day_today: "bg-slate-100 text-slate-900 font-bold border border-slate-300 rounded-lg",
                    day_outside: "day-outside text-slate-400 opacity-40 hover:bg-transparent cursor-pointer",
                    day_disabled: "text-slate-300 opacity-30 cursor-not-allowed",
                    day_hidden: "invisible",
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Add List Button */}
            {isAddingList ? (
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-xl p-1.5 border border-white/20">
                <input
                  ref={newListInputRef}
                  type="text"
                  value={newListTitle}
                  onChange={(e) => setNewListTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddList();
                    if (e.key === 'Escape') { setIsAddingList(false); setNewListTitle(''); }
                  }}
                  placeholder="List name..."
                  className="bg-white/90 border-0 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 w-40 placeholder:text-slate-400"
                  autoFocus
                />
                <button
                  onClick={handleAddList}
                  className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold text-xs transition-colors shadow-sm"
                >
                  Add
                </button>
                <button
                  onClick={() => { setIsAddingList(false); setNewListTitle(''); }}
                  className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setIsAddingList(true); setNewListTitle(''); setTimeout(() => newListInputRef.current?.focus(), 50); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-xl border border-white/20 hover:border-white/40 font-bold text-sm transition-all hover:-translate-y-0.5 active:translate-y-0 shadow-lg"
              >
                <Plus size={16} className="stroke-[2.5]" /> Add List
              </button>
            )}

            {/* More Options Popover Menu */}
            <Popover open={isMoreMenuOpen} onOpenChange={setIsMoreMenuOpen}>
              <PopoverTrigger asChild>
                <button
                  className="flex items-center gap-2 px-3 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-xl border border-white/20 hover:border-white/40 font-bold text-sm transition-all hover:-translate-y-0.5 active:translate-y-0 shadow-lg cursor-pointer"
                  title="More Options"
                >
                  <MoreVertical size={18} />
                  <span className="hidden sm:inline">Options</span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-48 p-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
                <button
                  onClick={() => { setIsMoreMenuOpen(false); handleImportClick(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-left"
                >
                  <Upload size={16} className="text-blue-500" />
                  <span>📥 Import Excel</span>
                </button>
                <button
                  onClick={() => { setIsMoreMenuOpen(false); handleExportExcel(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg transition-colors text-left border-t border-slate-100 mt-1 pt-2"
                >
                  <Download size={16} className="text-emerald-500" />
                  <span>📤 Export Excel</span>
                </button>
              </PopoverContent>
            </Popover>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".xlsx,.xls" 
              className="hidden" 
            />


            {/* Wallpaper Controls */}
            <button 
              onClick={handleWallpaperClick}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-xl border border-white/20 hover:border-white/40 font-bold text-sm transition-all hover:-translate-y-0.5 active:translate-y-0 shadow-lg"
              title="Upload Daily Tasks Wallpaper"
            >
              <Camera size={16} /> Wallpaper
            </button>
            {wallpaper && (
              <button 
                onClick={handleResetWallpaper}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-rose-600/30 hover:bg-rose-600/55 text-white rounded-xl border border-rose-500/35 hover:border-rose-400 font-bold text-xs transition-all shadow-md"
                title="Reset to default background"
              >
                Reset
              </button>
            )}
            <input 
              type="file" 
              ref={wallpaperInputRef} 
              onChange={handleWallpaperChange} 
              accept="image/*" 
              className="hidden" 
            />

             {/* Global Favorites Filter */}
             <button 
               onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
               className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-sm transition-all hover:-translate-y-0.5 active:translate-y-0 shadow-lg ${
                 showFavoritesOnly 
                   ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-500 hover:border-rose-600' 
                   : 'bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border-white/20 hover:border-white/40'
               }`}
               title={showFavoritesOnly ? "Show All Cards" : "Filter Favorites"}
             >
               <Heart size={16} fill={showFavoritesOnly ? "currentColor" : "none"} className={showFavoritesOnly ? "text-white" : "text-white/60"} />
               <span>Favorites</span>
             </button>
        </div>
      </div>


      {/* Trello Columns Horizontal Scroll */}
      <div 
        ref={boardContainerRef}
        onDragOver={handleBoardDragOver}
        onDragLeave={handleBoardDragLeave}
        className="flex-1 overflow-x-auto overflow-y-hidden pb-4 flex gap-4 items-start custom-scrollbar h-full min-h-[500px]"
      >
        {lists.map((list, listIndex) => {
          const sortMode = sortPreferences[list.id] || 'default';
          let displayCards = getSortedCards(list.cards, sortMode);
          if (selectedFilterDate) {
            displayCards = displayCards.filter(card => card.birthdayDate === selectedFilterDate);
          }

          return (
            <div
              key={list.id}
              draggable
              onDragStart={(e) => handleListDragStart(e, list.id)}
              onDragEnd={handleListDragEnd}
              onDragOver={(e) => {
                handleListDragOver(e, listIndex);
                handleDragOverListForCards(e, list.id);
              }}
              onDrop={(e) => {
                if (e.dataTransfer.types.includes('application/list-drag')) {
                  handleListDrop(e, listIndex);
                } else {
                  handleCardDrop(e, list.id);
                }
              }}
              className={`w-72 max-h-[73vh] flex-shrink-0 flex flex-col rounded-2xl overflow-hidden transition-all duration-300 ${
                draggedListId === list.id
                  ? 'opacity-50 scale-[0.97]'
                  : dragOverListIndex === listIndex && draggedListId
                  ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-transparent scale-[1.01]'
                  : ''
              } ${
                dragOverListId === list.id && draggedCardId 
                  ? 'ring-2 ring-blue-400/60' 
                  : ''
              }`}
              style={{
                background: 'rgba(255,255,255,0.08)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: dragOverListIndex === listIndex && draggedListId
                  ? '1.5px solid rgba(96,165,250,0.6)'
                  : '1px solid rgba(255,255,255,0.15)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              {/* List Header */}
              <div className="px-4 pt-4 pb-2.5 shrink-0"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%)',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div className="flex justify-between items-center gap-1.5">
                  {/* Drag Handle */}
                  <div 
                    className="cursor-grab active:cursor-grabbing p-1 text-white/30 hover:text-white/60 transition-colors shrink-0 rounded hover:bg-white/10"
                    title="Drag to reorder list"
                  >
                    <GripVertical size={14} />
                  </div>

                  {/* Title */}
                  {editingListId === list.id ? (
                    <input
                      ref={listTitleInputRef}
                      type="text"
                      value={editingListTitle}
                      onChange={(e) => setEditingListTitle(e.target.value)}
                      onBlur={() => handleSaveListTitle(list.id)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveListTitle(list.id)}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="flex-1 bg-white/90 border-0 rounded-lg px-2 py-1 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  ) : (
                    <h3 
                      onClick={() => handleEditListTitleStart(list.id, list.title)}
                      className="font-bold text-white/90 text-sm cursor-pointer hover:bg-white/10 px-2 py-1 rounded-lg flex items-center gap-1.5 transition-colors group flex-1 truncate uppercase tracking-wider"
                      title="Click to rename"
                    >
                      {list.title} 
                      <span className="text-[10px] text-blue-300/60 font-semibold normal-case tracking-normal">({displayCards.length})</span>
                      <Pencil size={11} className="text-white/30 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                    </h3>
                  )}

                  {/* Sort Menu */}
                  <div className="relative shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenSortMenuListId(openSortMenuListId === list.id ? null : list.id);
                        setOpenMoreMenuListId(null);
                      }}
                      className={`p-1.5 rounded-lg transition-all text-white/40 hover:text-white/80 hover:bg-white/10 ${
                        sortMode !== 'default' ? 'text-blue-300 bg-blue-500/20' : ''
                      }`}
                      title={`Sort: ${getSortLabel(sortMode)}`}
                    >
                      {getSortIcon(sortMode)}
                    </button>

                    {openSortMenuListId === list.id && (
                      <div 
                        ref={sortMenuRef}
                        className="absolute right-0 top-8 z-50 w-48 rounded-xl overflow-hidden shadow-2xl border border-white/20 animate-in fade-in slide-in-from-top-2 duration-150"
                        style={{
                          background: 'rgba(15, 23, 42, 0.95)',
                          backdropFilter: 'blur(20px)',
                        }}
                      >
                        <div className="p-1">
                          <div className="px-3 py-2 text-[10px] font-bold text-blue-300/60 uppercase tracking-widest">Sort Options</div>
                          {([
                            ['favorites', 'Sort Favorites'],
                            ['asc', 'Birthday (Ascending)'],
                            ['desc', 'Birthday (Descending)'],
                            ['default', 'Default (Manual Order)']
                          ] as [SortMode, string][]).map(([mode, label]) => (
                            <button
                              key={mode}
                              onClick={() => {
                                const newPrefs = { ...sortPreferences, [list.id]: mode };
                                saveSortPreferences(newPrefs);
                                setOpenSortMenuListId(null);
                                toast.success(`Sorting: ${label}`);
                              }}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                                sortMode === mode 
                                  ? 'bg-blue-500/20 text-blue-300' 
                                  : 'text-white/70 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              {mode === 'asc' ? <ArrowUp size={13} /> : mode === 'desc' ? <ArrowDown size={13} /> : mode === 'favorites' ? <Heart size={13} className="fill-rose-500 text-rose-500" /> : <ArrowUpDown size={13} />}
                              {label}
                              {sortMode === mode && <span className="ml-auto text-blue-400">{'\u2713'}</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>


                  {/* More Menu (Delete List) */}
                  <div className="relative shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMoreMenuListId(openMoreMenuListId === list.id ? null : list.id);
                        setOpenSortMenuListId(null);
                      }}
                      className="p-1.5 rounded-lg transition-all text-white/30 hover:text-white/70 hover:bg-white/10"
                      title="List options"
                    >
                      <MoreVertical size={14} />
                    </button>

                    {openMoreMenuListId === list.id && (
                      <div 
                        ref={moreMenuRef}
                        className="absolute right-0 top-8 z-50 w-44 rounded-xl overflow-hidden shadow-2xl border border-white/20 animate-in fade-in slide-in-from-top-2 duration-150"
                        style={{
                          background: 'rgba(15, 23, 42, 0.95)',
                          backdropFilter: 'blur(20px)',
                        }}
                      >
                        <div className="p-1">
                          <button
                            onClick={() => { handleEditListTitleStart(list.id, list.title); setOpenMoreMenuListId(null); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white rounded-lg transition-colors"
                          >
                            <Pencil size={13} /> Rename List
                          </button>
                          <button
                            onClick={() => handleDeleteList(list.id, list.title)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/15 hover:text-rose-300 rounded-lg transition-colors"
                          >
                            <Trash2 size={13} /> Delete List
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bulk Actions Panel */}
              {displayCards.length > 0 && (
                <div className="px-4 py-2 flex items-center justify-between bg-white/5 border-b border-white/5 text-[11px] font-semibold select-none shrink-0">
                   <label className="flex items-center gap-1.5 text-white/70 hover:text-white cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={(selectedCardIds[list.id] || []).length === displayCards.length}
                      onChange={() => toggleSelectAll(list.id, displayCards)}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="w-3.5 h-3.5 rounded border-white/20 bg-slate-900 text-blue-500 focus:ring-blue-400 cursor-pointer accent-blue-500"
                    />
                    <span>Select All ({displayCards.length})</span>
                  </label>
                  
                  {(selectedCardIds[list.id] || []).length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-blue-300 font-bold">{(selectedCardIds[list.id] || []).length} selected</span>
                      <button
                        onClick={() => handleBulkDelete(list.id, list.title)}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 hover:text-rose-200 transition-all font-bold cursor-pointer"
                      >
                        <Trash size={11} />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* List Cards Content */}
              <div className="flex-1 overflow-y-auto space-y-2.5 px-3 py-3 custom-scrollbar min-h-[100px]">
                {displayCards.length === 0 ? (
                  <div className="h-24 border-2 border-dashed border-white/15 rounded-xl flex items-center justify-center text-xs text-white/25 italic font-medium">
                    Drag cards here
                  </div>
                ) : (
                  displayCards.map((card) => (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={(e) => handleCardDragStart(e, card.id, list.id)}
                      onDragEnd={handleCardDragEnd}
                      onDragOver={(e) => handleDragOverCard(e, card.id)}
                      className={`rounded-2xl p-4 cursor-grab active:cursor-grabbing transition-all duration-300 hover:-translate-y-1 hover:shadow-lg group/card relative ${
                        dragOverCardId === card.id && draggedCardId 
                          ? 'ring-2 ring-blue-400' 
                          : ''
                      } ${
                        showFavoritesOnly && !card.favorite 
                          ? 'blur-[1.5px] opacity-40 select-none pointer-events-none' 
                          : ''
                      }`}
                      style={{
                        borderLeft: `4px solid ${
                          card.status === 'Waiting for Image' ? '#f59e0b' :
                          card.status === 'Image Edit Pending' ? '#3b82f6' :
                          card.status === 'Cancelled' ? '#ef4444' :
                          card.status === 'Order Completed' ? '#10b981' : '#64748b'
                        }`,
                        background: '#ffffff',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                      }}
                      onClick={() => handleOpenDetailsModal(card, list.id)}
                    >
                      <div className="flex flex-col gap-2.5">
                        {/* Header Row: Title input, Favorite button, Actions stack */}
                        <div className="flex justify-between items-start gap-2">
                          <input
                            type="text"
                            value={card.title}
                            onChange={(e) => handleCardFieldChange(list.id, card.id, 'title', e.target.value)}
                            onFocus={() => handleInputFocus(card.id, 'title', card.title)}
                            onBlur={() => handleInputBlur(list.id, card.id, 'title', card.title)}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="text-xs font-black text-slate-800 tracking-wide bg-transparent border-b border-transparent hover:border-slate-350 focus:border-blue-500 focus:bg-slate-50 px-1 py-0.5 rounded focus:outline-none transition-all flex-1 truncate uppercase"
                            title="Click to edit title"
                          />
                          
                          <div className="flex items-center gap-1 shrink-0">
                            {/* Favorite Button (Heart) */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCardFieldChange(list.id, card.id, 'favorite', !card.favorite);
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              className={`p-1.5 rounded transition-all cursor-pointer ${
                                card.favorite ? 'text-red-500 bg-red-50' : 'text-slate-400 hover:text-red-500 hover:bg-red-50/50'
                              }`}
                              title={card.favorite ? "Unmark Favorite" : "Mark Favorite"}
                            >
                              <Heart size={16} fill={card.favorite ? "currentColor" : "none"} className="stroke-[2.5]" />
                            </button>

                            {/* Action Buttons Stack (Delete & Cancel) */}
                            <div className="flex flex-col gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteCard(list.id, card.id); }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-0.5 rounded transition-colors"
                                title="Delete card"
                              >
                                <Trash size={12} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleCancelCard(list.id, card.id); }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="text-slate-400 hover:text-amber-500 hover:bg-amber-50 p-0.5 rounded transition-colors"
                                title="Cancel card"
                              >
                                <X size={12} className="stroke-[3]" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Phone Number Input */}
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-semibold" onClick={(e) => e.stopPropagation()}>
                          <Phone size={10} className="text-blue-400 shrink-0" />
                          <input
                            type="text"
                            value={card.phoneNumber}
                            onChange={(e) => handleCardFieldChange(list.id, card.id, 'phoneNumber', e.target.value)}
                            onFocus={() => handleInputFocus(card.id, 'phoneNumber', card.phoneNumber)}
                            onBlur={() => handlePhoneBlur(list.id, card, originalFocusValue.current?.value || card.phoneNumber)}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white px-1 py-0.5 rounded text-[11px] font-semibold text-slate-700 focus:outline-none transition-all w-full select-all"
                            placeholder="Phone number"
                          />
                        </div>

                        {/* Date & Count Row */}
                        <div className="flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                          {/* Birthday Date Input */}
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium flex-1 min-w-0">
                            <CalendarIcon size={10} className="text-emerald-400 shrink-0" />
                            <input
                              type="date"
                              value={card.birthdayDate || ''}
                              onChange={(e) => handleCardFieldChange(list.id, card.id, 'birthdayDate', e.target.value)}
                              onFocus={() => handleInputFocus(card.id, 'birthdayDate', card.birthdayDate)}
                              onBlur={() => handleInputBlur(list.id, card.id, 'birthdayDate', card.birthdayDate)}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white px-0.5 py-0.5 rounded text-[10px] text-slate-600 focus:outline-none transition-all w-full cursor-pointer"
                            />
                          </div>

                          {/* Count Input (Inline, editable) */}
                          <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-600 shrink-0">
                            <ShoppingBag size={10} className="text-purple-400 shrink-0" />
                            <span className="text-slate-500 text-[10px]">Count:</span>
                            <input
                              type="number"
                              value={card.chocolateCount || ''}
                              onChange={(e) => handleCardFieldChange(list.id, card.id, 'chocolateCount', e.target.value)}
                              onFocus={() => handleInputFocus(card.id, 'chocolateCount', card.chocolateCount)}
                              onBlur={() => handleInputBlur(list.id, card.id, 'chocolateCount', card.chocolateCount)}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="w-10 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white px-0.5 py-0.5 rounded text-[11px] font-bold text-slate-800 focus:outline-none transition-all"
                              placeholder="0"
                            />
                          </div>
                        </div>

                        {/* Status Badge */}
                        {card.status !== 'Waiting for Image' && card.status !== 'Order Completed' && card.status !== 'Image Edit Pending' && (
                          <div className="flex items-center shrink-0 mt-0.5">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${getStatusStyle(card.status)}`}>
                              {card.status}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* List Footer "Add Card" Option */}
              <div className="px-3 pb-3 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="pt-3">
                  {isAddingCardListId === list.id ? (
                    <div className="space-y-2">
                       <textarea
                        placeholder="Enter Phone Number / Title..."
                        value={newCardTitle}
                        onChange={(e) => setNewCardTitle(e.target.value)}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="w-full text-xs font-semibold bg-white/90 border border-slate-200 focus:border-blue-400 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400/30 shadow-inner text-slate-800 placeholder:text-slate-400"
                        rows={2}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddCardSubmit(list.id); }
                        }}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setIsAddingCardListId(null)}
                          className="px-2.5 py-1.5 text-xs font-semibold text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleAddCardSubmit(list.id)}
                          className="px-3.5 py-1.5 text-xs text-white bg-blue-500 hover:bg-blue-600 rounded-lg font-bold shadow transition-colors"
                        >
                          Add Card
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAddCardStart(list.id)}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs text-white/40 hover:text-white/80 hover:bg-white/10 border border-dashed border-white/15 hover:border-white/30 rounded-xl font-bold transition-all uppercase tracking-wider"
                    >
                      <Plus size={14} className="stroke-[2.5]" /> Add a Card
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      </div>

      {/* Card Details Modal popup */}
      {selectedCard && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-md" onClick={() => { setSelectedCard(null); setSelectedCardListId(null); }}>
          <div 
            className="w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
            style={{
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(20px)',
              borderRadius: '1.5rem',
              border: '1px solid rgba(255,255,255,0.3)',
              boxShadow: '0 25px 60px rgba(0,0,0,0.3), 0 10px 20px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-5 flex justify-between items-center" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', borderBottom: '1px solid #e2e8f0' }}>
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-500/10 rounded-lg">
                  <ClipboardList className="text-blue-600" size={20} />
                </div>
                <h3 className="text-lg font-extrabold text-slate-800 uppercase tracking-wider">Card Detail Editor</h3>
              </div>
              <button 
                onClick={() => { setSelectedCard(null); setSelectedCardListId(null); }}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh] text-sm">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Card Title</label>
                <input
                  type="text"
                  value={selectedCard.title}
                  onChange={(e) => setSelectedCard({ ...selectedCard, title: e.target.value })}
                  className="w-full bg-white border border-slate-200 focus:border-blue-400 rounded-xl px-3 py-2.5 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
                  placeholder="Card Title"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 text-slate-400" size={16} />
                  <input
                    type="text"
                    value={selectedCard.phoneNumber}
                    onChange={(e) => setSelectedCard({ ...selectedCard, phoneNumber: e.target.value })}
                    className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 focus:border-blue-400 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400/30 select-all"
                    placeholder="Phone Number"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Card Status</label>
                <select
                  value={selectedCard.status}
                  onChange={(e) => setSelectedCard({ ...selectedCard, status: e.target.value as any })}
                  className="w-full bg-white border border-slate-200 focus:border-blue-400 rounded-xl px-3 py-2.5 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400/30 cursor-pointer"
                >
                  <option value="Waiting for Image">Waiting for Image</option>
                  <option value="Image Edit Pending">Image Edit Pending</option>
                  <option value="Order Completed">Order Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Chocolate Count</label>
                <div className="relative">
                  <ShoppingBag className="absolute left-3.5 top-3 text-slate-400" size={16} />
                  <input
                    type="number"
                    value={selectedCard.chocolateCount}
                    onChange={(e) => setSelectedCard({ ...selectedCard, chocolateCount: e.target.value })}
                    className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 focus:border-blue-400 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
                    placeholder="Chocolate Count"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Birthday Date</label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3.5 top-3 text-slate-400" size={16} />
                  <input
                    type="date"
                    value={selectedCard.birthdayDate}
                    onChange={(e) => setSelectedCard({ ...selectedCard, birthdayDate: e.target.value })}
                    className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 focus:border-blue-400 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Comments</label>
                <div className="relative">
                  <MessageSquare className="absolute left-3.5 top-3 text-slate-400" size={16} />
                  <textarea
                    value={selectedCard.comments}
                    onChange={(e) => setSelectedCard({ ...selectedCard, comments: e.target.value })}
                    className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 focus:border-blue-400 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
                    rows={3}
                    placeholder="Comments..."
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 flex justify-between items-center shrink-0" style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
              <button
                onClick={() => {
                  if (selectedCardListId) handleDeleteCard(selectedCardListId, selectedCard.id);
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border border-red-200 rounded-xl font-bold transition-all active:scale-95 text-xs"
              >
                <Trash2 size={14} /> Delete
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => { setSelectedCard(null); setSelectedCardListId(null); }}
                  className="px-4 py-2.5 font-bold hover:bg-slate-100 text-slate-600 rounded-xl transition-colors text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateCardDetails}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors shadow-md text-xs"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
