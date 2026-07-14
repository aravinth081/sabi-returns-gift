import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { 
  Plus, X, Upload, Pencil, Trash2, Phone, Calendar, 
  MessageSquare, ClipboardList, ShoppingBag, Trash,
  ArrowUpDown, ArrowUp, ArrowDown, GripVertical, MoreVertical,
  Heart, Camera
} from 'lucide-react';
import { toast } from 'sonner';
// --- FIREBASE IMPORTS ---
import { doc, setDoc, onSnapshot, arrayUnion } from 'firebase/firestore';
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
}

export interface DailyTaskList {
  id: string;
  title: string;
  cards: DailyTaskCard[];
}

type SortMode = 'default' | 'asc' | 'desc';

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
    const newNotification = {
      id: `notify-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      cardId: card.id,
      cardTitle: card.title,
      phoneNumber: card.phoneNumber,
      timestamp: new Date().toISOString(),
      read: false
    };
    await setDoc(notifyDocRef, {
      items: arrayUnion(newNotification)
    }, { merge: true });
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

const STORAGE_KEY = 'sabi_daily_tasks_board';
const SORT_STORAGE_KEY = 'sabi_daily_tasks_sort';

export default function DailyTasksBoard() {
  const [lists, setLists] = useState<DailyTaskList[]>([]);
  const [selectedCard, setSelectedCard] = useState<DailyTaskCard | null>(null);
  const [selectedCardListId, setSelectedCardListId] = useState<string | null>(null);
  const [isAddingCardListId, setIsAddingCardListId] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  
  // List title editing state
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingListTitle, setEditingListTitle] = useState('');
  const listTitleInputRef = useRef<HTMLInputElement>(null);

  // Sort preferences per list
  const [sortPreferences, setSortPreferences] = useState<Record<string, SortMode>>({});
  const [openSortMenuListId, setOpenSortMenuListId] = useState<string | null>(null);
  const [openMoreMenuListId, setOpenMoreMenuListId] = useState<string | null>(null);
  
  // Add List state
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const newListInputRef = useRef<HTMLInputElement>(null);

  // Card Drag states
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [draggedSourceListId, setDraggedSourceListId] = useState<string | null>(null);
  const [dragOverListId, setDragOverListId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);

  // List Drag states
  const [draggedListId, setDraggedListId] = useState<string | null>(null);
  const [dragOverListIndex, setDragOverListIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);
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

  const handleWallpaperChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setWallpaper(result);
      localStorage.setItem('sabi_daily_tasks_wallpaper', result);
      toast.success('Wallpaper updated!');
    };
    reader.readAsDataURL(file);
  };

  const handleResetWallpaper = () => {
    setWallpaper(null);
    localStorage.removeItem('sabi_daily_tasks_wallpaper');
    toast.success('Wallpaper reset to default');
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
        if (data.sortPreferences) {
          setSortPreferences(data.sortPreferences);
          localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(data.sortPreferences));
        }
        setTimeout(() => { isFirestoreUpdate.current = false; }, 100);
      } else {
        // First time: save default data to Firestore
        setDoc(boardDocRef, {
          lists: DEFAULT_LISTS,
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

  // Save to both Firestore and localStorage
  const saveLists = useCallback((updatedLists: DailyTaskList[]) => {
    setLists(updatedLists);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLists));
    // Save to Firestore
    if (!isFirestoreUpdate.current) {
      setDoc(boardDocRef, {
        lists: updatedLists,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(err => {
        console.error('Failed to save lists to Firestore:', err);
        toast.error('Failed to sync to database');
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveSortPreferences = useCallback((prefs: Record<string, SortMode>) => {
    setSortPreferences(prefs);
    localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(prefs));
    // Save to Firestore
    if (!isFirestoreUpdate.current) {
      setDoc(boardDocRef, {
        sortPreferences: prefs,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(err => {
        console.error('Failed to save sort prefs to Firestore:', err);
        toast.error('Failed to sync to database');
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sort cards by birthday
  const getSortedCards = useCallback((cards: DailyTaskCard[], sortMode: SortMode): DailyTaskCard[] => {
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
    const updated = lists.map(list => 
      list.id === listId ? { ...list, title: editingListTitle.trim() } : list
    );
    saveLists(updated);
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
    setNewListTitle('');
    setIsAddingList(false);
    toast.success(`List "${newList.title}" created!`);
  };

  const handleDeleteList = (listId: string, listTitle: string) => {
    const list = lists.find(l => l.id === listId);
    const cardCount = list?.cards.length || 0;
    const msg = cardCount > 0 
      ? `Delete "${listTitle}" and its ${cardCount} card(s)? This cannot be undone.`
      : `Delete the empty list "${listTitle}"?`;
    
    if (confirm(msg)) {
      const updated = lists.filter(l => l.id !== listId);
      saveLists(updated);
      const newPrefs = { ...sortPreferences };
      delete newPrefs[listId];
      saveSortPreferences(newPrefs);
      setOpenMoreMenuListId(null);
      toast.success(`List "${listTitle}" deleted`);
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

    saveLists(updated);
    setIsAddingCardListId(null);
    setNewCardTitle('');
    toast.success('Card added successfully!');
  };

  const handleDeleteCard = (listId: string, cardId: string) => {
    if (confirm('Are you sure you want to delete this card?')) {
      const updated = lists.map(list => {
        if (list.id === listId) {
          return { ...list, cards: list.cards.filter(c => c.id !== cardId) };
        }
        return list;
      });
      saveLists(updated);
      setSelectedCard(null);
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

    saveLists(updatedLists);
    toast.success('Card cancelled and moved to "Cancelled" list');
  };

  const handleCardStatusChange = (listId: string, cardId: string, newStatus: DailyTaskCard['status']) => {
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
    toast.success('Card status updated');
  };

  const handleCardFieldChange = (listId: string, cardId: string, field: keyof DailyTaskCard, value: any) => {
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

  const handleCardDragEnd = (e: React.DragEvent) => {
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

    const cardData = e.dataTransfer.getData('application/card-drag');
    if (!cardData) return;

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
    } else {
      const targetList = updatedLists.find(l => l.id === targetListId);
      if (targetList && targetList.title.toLowerCase().trim() === 'forward to print') {
        triggerForwardToPrintNotification(cardToMove);
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
          filteredCards.splice(targetIndex, 0, cardToMove);
          return { ...list, cards: filteredCards };
        }
        return list;
      });
    }

    saveLists(updatedLists);
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
    const listId = e.dataTransfer.getData('application/list-drag');
    if (!listId) return;

    const sourceIndex = lists.findIndex(l => l.id === listId);
    if (sourceIndex === -1 || sourceIndex === targetIndex) {
      setDraggedListId(null);
      setDragOverListIndex(null);
      return;
    }

    const updatedLists = [...lists];
    const [movedList] = updatedLists.splice(sourceIndex, 1);
    updatedLists.splice(targetIndex, 0, movedList);

    saveLists(updatedLists);
    setDraggedListId(null);
    setDragOverListIndex(null);
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
            const norm = key.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (norm === 'labels' || norm === 'label' || norm === 'tag' || norm === 'tags' || norm === 'list' || norm === 'board') return row[key];
          }
          for (const key of keys) {
            const norm = key.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (norm.includes('label') || norm.includes('tag') || norm.includes('status') || norm.includes('list')) return row[key];
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
          const cleanedLabel = cleanLabelText(labelVal);

          const defaultListMappings = [
            { key: 'july', index: 0 },
            { key: 'aug', index: 1 },
            { key: 'imageeditpending', index: 2 },
            { key: 'imageeditednoresponse', index: 3 },
            { key: 'imageeditednotpaid', index: 4 },
            { key: 'ordercompleted', index: 5 }
          ];

          let targetListIndex = 0;
          let foundMatch = false;

          const cleanedLabelLower = cleanedLabel.toLowerCase().replace(/\s+/g, '');
          for (let i = 0; i < updatedLists.length; i++) {
            const listTitleCleaned = updatedLists[i].title.toLowerCase().replace(/[^\w\s\(\)\-]/g, '').replace(/\s+/g, '');
            if (listTitleCleaned && listTitleCleaned === cleanedLabelLower) {
              targetListIndex = i;
              foundMatch = true;
              break;
            }
          }

          if (!foundMatch) {
            const match = defaultListMappings.find(m => cleanedLabelLower === m.key);
            if (match) targetListIndex = match.index;
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
              
              // Update status and move card
              const movedCard = { ...existingCard, status: newStatus };
              updatedLists[targetListIndex].cards.push(movedCard);
              importCount++;

              // Trigger notification if target list is "Forward to Print"
              if (targetTitle === 'forward to print') {
                triggerForwardToPrintNotification(movedCard);
              }
            } else {
              skipDuplicateCount++;
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
            comments: ''
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

        saveLists(updatedLists);
        toast.success(`Import complete: Added/Moved ${importCount} cards! (Skipped ${skipDuplicateCount} duplicates in same lists, ${skipMissingCount} invalid numbers)`);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        console.error('Error importing Excel:', err);
        toast.error('Failed to parse Excel file. Ensure it is formatted correctly.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ==================== HELPERS ====================

  const getStatusStyle = (status: DailyTaskCard['status']) => {
    switch (status) {
      case 'Waiting for Image': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Image Edit Pending': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Order Completed': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Cancelled': return 'bg-rose-100 text-rose-800 border-rose-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const getSortIcon = (mode: SortMode) => {
    switch (mode) {
      case 'asc': return <ArrowUp size={13} />;
      case 'desc': return <ArrowDown size={13} />;
      default: return <ArrowUpDown size={13} />;
    }
  };

  const getSortLabel = (mode: SortMode) => {
    switch (mode) {
      case 'asc': return 'Birthday \u2191';
      case 'desc': return 'Birthday \u2193';
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
        <div className="absolute inset-0 bg-slate-950/50 z-0 pointer-events-none" />
      )}

      {/* File Drag and Drop Overlay */}
      {isDraggingFile && (
        <div className="absolute inset-0 bg-blue-950/85 z-[150] rounded-3xl flex flex-col items-center justify-center border-4 border-dashed border-blue-400 m-2 backdrop-blur-sm pointer-events-none">
          <Upload size={48} className="text-blue-300 animate-bounce mb-3" />
          <p className="text-xl font-black text-white">Drop Excel file here to Import</p>
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

            {/* Import Excel */}
            <button 
              onClick={handleImportClick}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl shadow-lg hover:shadow-xl font-bold text-sm transition-all hover:-translate-y-0.5 active:translate-y-0 border border-blue-500/50"
            >
              <Upload size={16} /> Import Excel
            </button>
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
      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4 flex gap-4 items-start custom-scrollbar h-full min-h-[500px]">
        {lists.map((list, listIndex) => {
          const sortMode = sortPreferences[list.id] || 'default';
          let displayCards = getSortedCards(list.cards, sortMode);
          if (showFavoritesOnly) {
            displayCards = displayCards.filter(c => c.favorite);
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
                      className="flex-1 bg-white/90 border-0 rounded-lg px-2 py-1 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  ) : (
                    <h3 
                      onClick={() => handleEditListTitleStart(list.id, list.title)}
                      className="font-bold text-white/90 text-sm cursor-pointer hover:bg-white/10 px-2 py-1 rounded-lg flex items-center gap-1.5 transition-colors group flex-1 truncate uppercase tracking-wider"
                      title="Click to rename"
                    >
                      {list.title} 
                      <span className="text-[10px] text-blue-300/60 font-semibold normal-case tracking-normal">({list.cards.length})</span>
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
                          <div className="px-3 py-2 text-[10px] font-bold text-blue-300/60 uppercase tracking-widest">Sort by Birthday</div>
                          {([
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
                              {mode === 'asc' ? <ArrowUp size={13} /> : mode === 'desc' ? <ArrowDown size={13} /> : <ArrowUpDown size={13} />}
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
                      className={`rounded-xl p-3 cursor-grab active:cursor-grabbing transition-all duration-200 hover:-translate-y-0.5 group/card ${
                        dragOverCardId === card.id && draggedCardId 
                          ? 'border-t-[3px] border-t-blue-400' 
                          : ''
                      }`}
                      style={{
                        background: 'rgba(255,255,255,0.92)',
                        border: dragOverCardId === card.id && draggedCardId 
                          ? '1px solid rgba(96,165,250,0.5)' 
                          : '1px solid rgba(255,255,255,0.3)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
                      }}
                      onClick={() => handleOpenDetailsModal(card, list.id)}
                    >
                      <div className="flex flex-col gap-2">
                        {/* Header Row: Title input, Favorite button, Actions stack */}
                        <div className="flex justify-between items-start gap-2">
                          <input
                            type="text"
                            value={card.title}
                            onChange={(e) => handleCardFieldChange(list.id, card.id, 'title', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs font-bold text-slate-800 tracking-wide bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white px-1 py-0.5 rounded focus:outline-none transition-all flex-1 truncate uppercase"
                            title="Click to edit title"
                          />
                          
                          <div className="flex items-center gap-1 shrink-0">
                            {/* Favorite Button (Heart) */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCardFieldChange(list.id, card.id, 'favorite', !card.favorite);
                              }}
                              className={`p-1.5 rounded transition-all cursor-pointer ${
                                card.favorite ? 'text-rose-600 bg-rose-50' : 'text-slate-300 hover:text-rose-600 hover:bg-rose-50/50'
                              }`}
                              title={card.favorite ? "Unmark Favorite" : "Mark Favorite"}
                            >
                              <Heart size={13} fill={card.favorite ? "currentColor" : "none"} />
                            </button>

                            {/* Action Buttons Stack (Delete & Cancel) */}
                            <div className="flex flex-col gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteCard(list.id, card.id); }}
                                className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-0.5 rounded transition-colors"
                                title="Delete card"
                              >
                                <Trash size={12} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleCancelCard(list.id, card.id); }}
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
                            onBlur={() => handlePhoneBlur(list.id, card, card.phoneNumber)}
                            className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white px-1 py-0.5 rounded text-[11px] font-semibold text-slate-700 focus:outline-none transition-all w-full select-all"
                            placeholder="Phone number"
                          />
                        </div>

                        {/* Birthday Date Input */}
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium" onClick={(e) => e.stopPropagation()}>
                          <Calendar size={10} className="text-emerald-400 shrink-0" />
                          <input
                            type="date"
                            value={card.birthdayDate || ''}
                            onChange={(e) => handleCardFieldChange(list.id, card.id, 'birthdayDate', e.target.value)}
                            className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white px-1 py-0.5 rounded text-[10px] text-slate-600 focus:outline-none transition-all w-full cursor-pointer"
                          />
                        </div>

                        {/* Count Input (Inline, editable) */}
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600" onClick={(e) => e.stopPropagation()}>
                          <ShoppingBag size={10} className="text-purple-400 shrink-0" />
                          <span className="text-slate-500">Count:</span>
                          <input
                            type="number"
                            value={card.chocolateCount || ''}
                            onChange={(e) => handleCardFieldChange(list.id, card.id, 'chocolateCount', e.target.value)}
                            className="w-16 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white px-1 py-0.5 rounded text-[11px] font-bold text-slate-800 focus:outline-none transition-all"
                            placeholder="0"
                          />
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center shrink-0 mt-0.5">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${getStatusStyle(card.status)}`}>
                            {card.status}
                          </span>
                        </div>
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
                  <Calendar className="absolute left-3.5 top-3 text-slate-400" size={16} />
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
