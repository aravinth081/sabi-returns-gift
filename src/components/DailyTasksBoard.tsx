import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  Plus, X, Upload, Pencil, Trash2, Phone, Calendar, 
  MessageSquare, ClipboardList, ShoppingBag, Trash
} from 'lucide-react';
import { toast } from 'sonner';

export interface DailyTaskCard {
  id: string;
  title: string;
  phoneNumber: string;
  status: 'Waiting for Image' | 'Image Edit Pending' | 'Order Completed' | 'Cancelled';
  chocolateCount: string;
  birthdayDate: string;
  comments: string;
}

export interface DailyTaskList {
  id: string;
  title: string;
  cards: DailyTaskCard[];
}

const normalizePhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
};

const DEFAULT_LISTS: DailyTaskList[] = [
  { id: 'list-july', title: 'July', cards: [] },
  { id: 'list-aug', title: 'Aug', cards: [] },
  { id: 'list-image-pending', title: 'Image Edit Pending', cards: [] },
  { id: 'list-image-no-resp', title: 'Image Edited (No Response)', cards: [] },
  { id: 'list-image-not-paid', title: 'Image Edited (Not Paid)', cards: [] },
  { id: 'list-completed', title: 'Order Completed', cards: [] }
];

export default function DailyTasksBoard() {
  const [lists, setLists] = useState<DailyTaskList[]>([]);
  const [selectedCard, setSelectedCard] = useState<DailyTaskCard | null>(null);
  const [selectedCardListId, setSelectedCardListId] = useState<string | null>(null);
  const [isAddingCardListId, setIsAddingCardListId] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  
  // List title editing state
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingListTitle, setEditingListTitle] = useState('');
  const listTitleInputRef = useRef<HTMLInputElement>(null);

  // Drag states
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [draggedSourceListId, setDraggedSourceListId] = useState<string | null>(null);
  const [dragOverListId, setDragOverListId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sabi_daily_tasks_board');
    if (saved) {
      try {
        setLists(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse board data, resetting to default', e);
        setLists(DEFAULT_LISTS);
      }
    } else {
      setLists(DEFAULT_LISTS);
    }
  }, []);

  // Save to localStorage helper
  const saveLists = (updatedLists: DailyTaskList[]) => {
    setLists(updatedLists);
    localStorage.setItem('sabi_daily_tasks_board', JSON.stringify(updatedLists));
  };

  // List Actions
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

  // Card Actions
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

    // Duplicate Prevention check
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
      title: phone, // Default title to Phone Number
      phoneNumber: phone,
      status: 'Waiting for Image',
      chocolateCount: '',
      birthdayDate: '',
      comments: ''
    };

    const updated = lists.map(list => {
      if (list.id === listId) {
        return {
          ...list,
          cards: [...list.cards, newCard]
        };
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
          return {
            ...list,
            cards: list.cards.filter(c => c.id !== cardId)
          };
        }
        return list;
      });
      saveLists(updated);
      setSelectedCard(null);
      toast.success('Card deleted');
    }
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

  // Drag and Drop implementation
  const handleDragStart = (e: React.DragEvent, cardId: string, sourceListId: string) => {
    setDraggedCardId(cardId);
    setDraggedSourceListId(sourceListId);
    e.dataTransfer.setData('text/plain', JSON.stringify({ cardId, sourceListId }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOverCard = (e: React.DragEvent, cardId: string) => {
    e.preventDefault();
    if (draggedCardId !== cardId) {
      setDragOverCardId(cardId);
    }
  };

  const handleDragOverList = (e: React.DragEvent, listId: string) => {
    e.preventDefault();
    setDragOverListId(listId);
  };

  const handleDrop = (e: React.DragEvent, targetListId: string) => {
    e.preventDefault();
    const sourceCardId = draggedCardId;
    const sourceListId = draggedSourceListId;

    setDraggedCardId(null);
    setDraggedSourceListId(null);
    setDragOverListId(null);
    setDragOverCardId(null);

    if (!sourceCardId || !sourceListId) return;

    // Find the card being dragged
    const sourceList = lists.find(l => l.id === sourceListId);
    const cardToMove = sourceList?.cards.find(c => c.id === sourceCardId);
    if (!cardToMove) return;

    let updatedLists = [...lists];

    if (sourceListId === targetListId) {
      // Reordering within the same list
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
      // Moving to a different list
      updatedLists = updatedLists.map(list => {
        if (list.id === sourceListId) {
          return {
            ...list,
            cards: list.cards.filter(c => c.id !== sourceCardId)
          };
        }
        if (list.id === targetListId) {
          const filteredCards = [...list.cards];
          
          let targetIndex = filteredCards.length;
          if (dragOverCardId) {
            targetIndex = filteredCards.findIndex(c => c.id === dragOverCardId);
            if (targetIndex === -1) targetIndex = filteredCards.length;
          }

          filteredCards.splice(targetIndex, 0, cardToMove);
          return {
            ...list,
            cards: filteredCards
          };
        }
        return list;
      });
    }

    saveLists(updatedLists);
  };

  // Card Popup detail changes
  const handleOpenDetailsModal = (card: DailyTaskCard, listId: string) => {
    setSelectedCard({ ...card });
    setSelectedCardListId(listId);
  };

  const handleUpdateCardDetails = () => {
    if (!selectedCard || !selectedCardListId) return;

    // Save title changes (if user wants to customize card name)
    const phone = selectedCard.phoneNumber.trim();
    if (!phone) {
      toast.error('Phone Number cannot be empty!');
      return;
    }

    // Duplicate Check only if phone number was modified
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
        return {
          ...list,
          cards: list.cards.map(c => c.id === selectedCard.id ? { ...selectedCard } : c)
        };
      }
      return list;
    });

    saveLists(updated);
    setSelectedCard(null);
    setSelectedCardListId(null);
    toast.success('Card details updated!');
  };

  // Excel Import Logic
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

        // Dynamic search for phone and label keys
        const getPhoneValue = (row: any) => {
          const keys = Object.keys(row);
          // Try exact match first
          for (const key of keys) {
            const norm = key.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (norm === 'phonenumber' || norm === 'phone' || norm === 'mobile' || norm === 'contact' || norm === 'phoneno' || norm === 'contactno') {
              return row[key];
            }
          }
          // Substring matches
          for (const key of keys) {
            const norm = key.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (norm.includes('phone') || norm.includes('mobile') || norm.includes('contact') || norm.includes('tel')) {
              return row[key];
            }
          }
          return undefined;
        };

        const getLabelValue = (row: any) => {
          const keys = Object.keys(row);
          // Try exact match first
          for (const key of keys) {
            const norm = key.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (norm === 'labels' || norm === 'label' || norm === 'tag' || norm === 'tags' || norm === 'list' || norm === 'board') {
              return row[key];
            }
          }
          // Substring matches
          for (const key of keys) {
            const norm = key.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (norm.includes('label') || norm.includes('tag') || norm.includes('status') || norm.includes('list')) {
              return row[key];
            }
          }
          return undefined;
        };

        let importCount = 0;
        let skipDuplicateCount = 0;
        let skipMissingCount = 0;

        const updatedLists = lists.map(list => ({
          ...list,
          cards: [...list.cards]
        }));

        jsonData.forEach((row: any) => {
          const rawPhone = getPhoneValue(row);
          const rawLabel = getLabelValue(row);

          if (rawPhone === undefined || rawPhone === null) {
            skipMissingCount++;
            return;
          }

          const phoneStr = String(rawPhone).trim();
          if (!phoneStr) {
            skipMissingCount++;
            return;
          }

          // Check if duplicate anywhere on the updatedLists board
          const normImported = normalizePhone(phoneStr);
          let isDup = false;
          if (normImported) {
            for (const list of updatedLists) {
              for (const card of list.cards) {
                const normExisting = normalizePhone(card.phoneNumber);
                if (card.phoneNumber.trim() === phoneStr || normExisting === normImported) {
                  isDup = true;
                  break;
                }
              }
              if (isDup) break;
            }
          }

          if (isDup) {
            skipDuplicateCount++;
            return;
          }

          // Clean Label name
          const cleanLabelText = (label: string): string => {
            if (!label) return '';
            // Remove Emojis: matches general emojis and miscellaneous symbols
            const noEmojis = label.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "");
            // Match letters, numbers, spaces, parentheses, hyphens, and clean up spaces
            return noEmojis.replace(/[^\w\s\(\)\-]/g, '').replace(/\s+/g, ' ').trim();
          };

          const labelVal = String(rawLabel || '').trim();
          const cleanedLabel = cleanLabelText(labelVal);

          // Standard Board headings mapping check
          const defaultListMappings = [
            { key: 'july', index: 0 },
            { key: 'aug', index: 1 },
            { key: 'imageeditpending', index: 2 },
            { key: 'imageeditednoresponse', index: 3 },
            { key: 'imageeditednotpaid', index: 4 },
            { key: 'ordercompleted', index: 5 }
          ];

          let targetListIndex = 0; // Default to July
          let foundMatch = false;

          // 1. Try to match the active list title in UI first
          const cleanedLabelLower = cleanedLabel.toLowerCase().replace(/\s+/g, '');
          for (let i = 0; i < updatedLists.length; i++) {
            const listTitleCleaned = updatedLists[i].title.toLowerCase().replace(/[^\w\s\(\)\-]/g, '').replace(/\s+/g, '');
            if (listTitleCleaned && listTitleCleaned === cleanedLabelLower) {
              targetListIndex = i;
              foundMatch = true;
              break;
            }
          }

          // 2. Fall back to matching standard default values (July, Aug, Image Edit Pending...)
          if (!foundMatch) {
            const match = defaultListMappings.find(m => cleanedLabelLower === m.key);
            if (match) {
              targetListIndex = match.index;
            }
          }

          // Add card
          const newCard: DailyTaskCard = {
            id: `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: phoneStr,
            phoneNumber: phoneStr,
            status: 'Waiting for Image',
            chocolateCount: '',
            birthdayDate: '',
            comments: ''
          };

          updatedLists[targetListIndex].cards.push(newCard);
          importCount++;
        });

        saveLists(updatedLists);
        toast.success(`Import complete: Added ${importCount} new cards! (Skipped ${skipDuplicateCount} duplicates, ${skipMissingCount} invalid numbers)`);
        
        // Reset file input value
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        console.error('Error importing Excel:', err);
        toast.error('Failed to parse Excel file. Ensure it is formatted correctly.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Helper colors for statuses
  const getStatusStyle = (status: DailyTaskCard['status']) => {
    switch (status) {
      case 'Waiting for Image':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Image Edit Pending':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Order Completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Cancelled':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <div className="flex flex-col h-full w-full select-none text-slate-800">
      {/* Board Controls */}
      <div className="flex justify-between items-center mb-6 shrink-0 print:hidden">
        <div>
          <h2 className="text-xl font-black text-amber-50 flex items-center gap-2 tracking-wide" style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.3)" }}>
            <ClipboardList className="text-amber-400 drop-shadow" size={24} /> Daily Tasks Board
          </h2>
          <p className="text-xs text-amber-200/60 font-semibold mt-0.5">Manage tasks and import leads dynamically.</p>
        </div>

        <div>
          <button 
            onClick={handleImportClick}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-xl shadow-md hover:shadow-lg font-bold text-sm transition-all hover:-translate-y-0.5 active:translate-y-0"
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
        </div>
      </div>

      {/* Trello Columns Horizontal Scroll */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4 flex gap-4 items-start custom-scrollbar h-full min-h-[500px] mt-2">
        {lists.map((list) => (
          <div 
            key={list.id}
            onDragOver={(e) => handleDragOverList(e, list.id)}
            onDrop={(e) => handleDrop(e, list.id)}
            className={`w-72 max-h-[70vh] flex-shrink-0 flex flex-col rounded-3xl p-4 bg-[#ebe6df] border-2 border-white/40 shadow-[6px_6px_12px_rgba(0,0,0,0.15)] transition-all duration-200 ${
              dragOverListId === list.id ? 'bg-amber-50/80 border-amber-500 ring-4 ring-amber-500/20 scale-[1.01]' : ''
            }`}
          >
            {/* List Heading */}
            <div className="flex justify-between items-center mb-3 shrink-0 px-1">
              {editingListId === list.id ? (
                <input
                  ref={listTitleInputRef}
                  type="text"
                  value={editingListTitle}
                  onChange={(e) => setEditingListTitle(e.target.value)}
                  onBlur={() => handleSaveListTitle(list.id)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveListTitle(list.id)}
                  className="w-full bg-white border-2 border-amber-400 rounded-lg px-2 py-1 text-sm font-bold text-amber-950 focus:outline-none"
                />
              ) : (
                <h3 
                  onClick={() => handleEditListTitleStart(list.id, list.title)}
                  className="font-black text-[#3e2723] text-sm cursor-pointer hover:bg-amber-900/5 px-2 py-1 rounded-lg flex items-center gap-1.5 transition-colors group flex-1 truncate uppercase tracking-wider"
                  title="Click to rename"
                >
                  {list.title} 
                  <span className="text-[10px] text-amber-800/60 font-bold">({list.cards.length})</span>
                  <Pencil size={12} className="text-amber-800/50 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                </h3>
              )}
            </div>

            {/* List Cards Content */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar min-h-[100px] mt-1">
              {list.cards.length === 0 ? (
                <div className="h-24 border-2 border-dashed border-[#c2b4a3] rounded-2xl flex items-center justify-center text-xs text-amber-900/40 italic font-bold">
                  Drag cards here
                </div>
              ) : (
                list.cards.map((card) => (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, card.id, list.id)}
                    onDragOver={(e) => handleDragOverCard(e, card.id)}
                    className={`bg-[#fffdfa] rounded-2xl p-3 border-2 border-white/60 shadow-[3px_3px_6px_rgba(0,0,0,0.06)] hover:shadow-md cursor-grab active:cursor-grabbing transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-200/50 ${
                      dragOverCardId === card.id ? 'border-t-4 border-t-amber-600 bg-amber-50/50' : ''
                    }`}
                    onClick={() => handleOpenDetailsModal(card, list.id)}
                  >
                    {/* Card Body */}
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-start gap-2">
                        <p className="text-xs font-black text-amber-950 tracking-wide truncate flex-1">{card.title}</p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCard(list.id, card.id);
                          }}
                          className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1 rounded-lg transition-colors shrink-0"
                          title="Delete card"
                        >
                          <Trash size={12} />
                        </button>
                      </div>

                      {/* Phone Display */}
                      <div className="flex items-center gap-1.5 text-xs text-[#8d6e63] font-bold select-all">
                        <Phone size={11} className="text-amber-800/70" />
                        <span>{card.phoneNumber}</span>
                      </div>

                      {/* Dropdown status & display */}
                      <div className="flex items-center gap-1 justify-between shrink-0 mt-1" onClick={(e) => e.stopPropagation()}>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider shadow-inner ${getStatusStyle(card.status)}`}>
                          {card.status}
                        </span>
                        
                        <select
                          value={card.status}
                          onChange={(e) => handleCardStatusChange(list.id, card.id, e.target.value as any)}
                          className="text-[9px] bg-white border border-[#d7ccc8] rounded-lg p-1 font-extrabold text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer shadow-sm hover:bg-[#faeedb]/50"
                        >
                          <option value="Waiting for Image">Waiting</option>
                          <option value="Image Edit Pending">Pending</option>
                          <option value="Order Completed">Completed</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* List Footer "Add Card" Option */}
            <div className="mt-3 shrink-0 border-t border-amber-900/10 pt-3">
              {isAddingCardListId === list.id ? (
                <div className="space-y-2">
                  <textarea
                    placeholder="Enter Phone Number / Title..."
                    value={newCardTitle}
                    onChange={(e) => setNewCardTitle(e.target.value)}
                    className="w-full text-xs font-bold bg-white border-2 border-[#d7ccc8] focus:border-[#8d6e63] rounded-xl p-2 focus:outline-none shadow-inner"
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAddCardSubmit(list.id);
                      }
                    }}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setIsAddingCardListId(null)}
                      className="px-2.5 py-1.5 text-xs font-bold border border-[#d7ccc8] text-amber-950 hover:bg-amber-900/5 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleAddCardSubmit(list.id)}
                      className="px-3 py-1.5 text-xs text-white bg-[#4a2c1d] hover:bg-[#3e2316] rounded-lg font-bold shadow transition-colors"
                    >
                      Add Card
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => handleAddCardStart(list.id)}
                  className="w-full flex items-center justify-center gap-1 py-2 text-xs text-amber-900/70 hover:text-amber-950 hover:bg-amber-900/5 border border-dashed border-amber-900/20 rounded-xl font-black transition-all uppercase tracking-wider"
                >
                  <Plus size={14} className="stroke-[3]" /> Add a Card
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Card Details Modal popup */}
      {selectedCard && (
        <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#fffdfa] rounded-[2.5rem] shadow-2xl w-full max-w-lg border-4 border-amber-100/80 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-[#f2eee6] border-b-2 border-dashed border-amber-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ClipboardList className="text-amber-800" size={22} />
                <h3 className="text-lg font-black text-[#5d4037] uppercase tracking-wider">Card Detail Editor</h3>
              </div>
              <button 
                onClick={() => { setSelectedCard(null); setSelectedCardListId(null); }}
                className="text-amber-700 hover:text-red-500 p-1.5 rounded-full transition-colors"
              >
                <X size={22} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh] text-sm">
              {/* Editable Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-amber-800 uppercase">Card Title</label>
                <input
                  type="text"
                  value={selectedCard.title}
                  onChange={(e) => setSelectedCard({ ...selectedCard, title: e.target.value })}
                  className="w-full bg-white border-2 border-[#d7ccc8] focus:border-[#8d6e63] rounded-xl px-3 py-2.5 font-bold text-amber-950 focus:outline-none shadow-inner"
                  placeholder="Card Title"
                />
              </div>

              {/* Editable Phone Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-amber-800 uppercase">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                  <input
                    type="text"
                    value={selectedCard.phoneNumber}
                    onChange={(e) => setSelectedCard({ ...selectedCard, phoneNumber: e.target.value })}
                    className="w-full pl-10 pr-3 py-2.5 bg-white border-2 border-[#d7ccc8] focus:border-[#8d6e63] rounded-xl font-bold text-amber-950 focus:outline-none shadow-inner select-all"
                    placeholder="Phone Number"
                  />
                </div>
              </div>

              {/* Status Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-amber-800 uppercase">Card Status</label>
                <select
                  value={selectedCard.status}
                  onChange={(e) => setSelectedCard({ ...selectedCard, status: e.target.value as any })}
                  className="w-full bg-white border-2 border-[#d7ccc8] focus:border-[#8d6e63] rounded-xl px-3 py-2.5 font-bold text-amber-950 focus:outline-none cursor-pointer shadow-sm"
                >
                  <option value="Waiting for Image">Waiting for Image</option>
                  <option value="Image Edit Pending">Image Edit Pending</option>
                  <option value="Order Completed">Order Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              {/* Chocolate Count */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-amber-800 uppercase">Chocolate Count</label>
                <div className="relative">
                  <ShoppingBag className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                  <input
                    type="number"
                    value={selectedCard.chocolateCount}
                    onChange={(e) => setSelectedCard({ ...selectedCard, chocolateCount: e.target.value })}
                    className="w-full pl-10 pr-3 py-2.5 bg-white border-2 border-[#d7ccc8] focus:border-[#8d6e63] rounded-xl font-bold text-amber-950 focus:outline-none shadow-inner"
                    placeholder="Chocolate Count"
                  />
                </div>
              </div>

              {/* Birthday Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-amber-800 uppercase">Birthday Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                  <input
                    type="date"
                    value={selectedCard.birthdayDate}
                    onChange={(e) => setSelectedCard({ ...selectedCard, birthdayDate: e.target.value })}
                    className="w-full pl-10 pr-3 py-2.5 bg-white border-2 border-[#d7ccc8] focus:border-[#8d6e63] rounded-xl font-bold text-amber-950 focus:outline-none shadow-inner"
                  />
                </div>
              </div>

              {/* Comments */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-amber-800 uppercase">Comments</label>
                <div className="relative">
                  <MessageSquare className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                  <textarea
                    value={selectedCard.comments}
                    onChange={(e) => setSelectedCard({ ...selectedCard, comments: e.target.value })}
                    className="w-full pl-10 pr-3 py-2.5 bg-white border-2 border-[#d7ccc8] focus:border-[#8d6e63] rounded-xl font-bold text-amber-950 focus:outline-none shadow-inner"
                    rows={3}
                    placeholder="Comments..."
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-amber-50/40 border-t-2 border-[#d7ccc8] flex justify-between items-center shrink-0">
              <button
                onClick={() => {
                  if (selectedCardListId) {
                    handleDeleteCard(selectedCardListId, selectedCard.id);
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border border-red-200 rounded-xl font-bold transition-all active:scale-95 text-xs"
              >
                <Trash2 size={14} /> Delete
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => { setSelectedCard(null); setSelectedCardListId(null); }}
                  className="px-4 py-2.5 font-bold hover:bg-amber-900/5 text-amber-900 rounded-xl transition-colors text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateCardDetails}
                  className="px-5 py-2.5 bg-[#3e2316] hover:bg-[#2d1b14] text-amber-100 rounded-xl font-black transition-colors shadow text-xs"
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
