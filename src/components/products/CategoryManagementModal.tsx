import React, { useState, useMemo } from 'react';
import {
  X,
  Tag,
  Plus,
  Pencil,
  Trash2,
  Search,
  AlertTriangle,
  Check,
  AlertCircle,
  FolderTree,
  Package,
} from 'lucide-react';

export interface CategoryItem {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
}

interface CategoryManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryItem[];
  products: any[];
  onAddCategory: (name: string, description?: string) => Promise<boolean | void>;
  onEditCategory: (id: string, oldName: string, newName: string, description?: string) => Promise<boolean | void>;
  onDeleteCategory: (id: string, name: string) => Promise<boolean | void>;
}

export const CategoryManagementModal: React.FC<CategoryManagementModalProps> = ({
  isOpen,
  onClose,
  categories,
  products,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [error, setError] = useState('');
  const [deleteConfirmCat, setDeleteConfirmCat] = useState<CategoryItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Map category name (lowercase) to count of active products using it
  const productCountByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach((p) => {
      if (p.category && typeof p.category === 'string') {
        const catKey = p.category.trim().toLowerCase();
        counts[catKey] = (counts[catKey] || 0) + 1;
      }
    });
    return counts;
  }, [products]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase();
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [categories, searchQuery]);

  if (!isOpen) return null;

  const handleStartEdit = (cat: CategoryItem) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditDescription(cat.description || '');
    setError('');
  };

  const handleSaveEdit = async (cat: CategoryItem) => {
    const trimmedName = editName.trim();
    if (!trimmedName) {
      setError('Category name cannot be empty.');
      return;
    }

    // Check duplicate name
    const isDuplicate = categories.some(
      (c) => c.id !== cat.id && c.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      setError(`Another category with name "${trimmedName}" already exists.`);
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      const res = await onEditCategory(cat.id, cat.name, trimmedName, editDescription.trim());
      if (res !== false) {
        setEditingId(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      setError('Category name is required.');
      return;
    }

    const isDuplicate = categories.some(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      setError(`Category "${trimmed}" already exists.`);
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      const res = await onAddCategory(trimmed, newDescription.trim());
      if (res !== false) {
        setNewName('');
        setNewDescription('');
        setIsAdding(false);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePrompt = (cat: CategoryItem) => {
    const usedCount = productCountByCategory[cat.name.trim().toLowerCase()] || 0;
    if (usedCount > 0) {
      setError(
        `This category is currently being used by ${usedCount} listings. Please reassign those listings before deleting this category.`
      );
      return;
    }
    setError('');
    setDeleteConfirmCat(cat);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmCat) return;
    setIsSubmitting(true);
    try {
      await onDeleteCategory(deleteConfirmCat.id, deleteConfirmCat.name);
      setDeleteConfirmCat(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#0c1427] border border-white/20 rounded-[2rem] p-6 md:p-8 text-white shadow-2xl relative max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-900/40">
              <FolderTree size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-wider text-white">
                Category Management
              </h2>
              <p className="text-xs text-slate-400">
                Manage product categories, organize your catalog, and maintain listings
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Action / Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 pb-3 shrink-0">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#151f36] border border-white/15 rounded-xl text-xs font-semibold text-white placeholder:text-slate-500 outline-none focus:border-emerald-400 transition-colors shadow-inner"
            />
          </div>
          {!isAdding && (
            <button
              type="button"
              onClick={() => {
                setIsAdding(true);
                setEditingId(null);
                setError('');
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Plus size={14} />
              <span>+ Add Category</span>
            </button>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-3 p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-rose-300 text-xs shrink-0">
            <AlertCircle size={16} className="shrink-0 text-rose-400" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => setError('')}
              className="text-rose-400 hover:text-rose-200"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Add Category Inline Card */}
        {isAdding && (
          <form
            onSubmit={handleCreateNew}
            className="p-4 mb-3 bg-[#151f36] border border-emerald-500/40 rounded-2xl space-y-3 shrink-0 animate-in fade-in"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Plus size={13} />
                New Category
              </span>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Category Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Wooden Toys, Board Games"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0c1427] border border-white/20 rounded-xl text-xs font-bold text-white placeholder:text-slate-500 outline-none focus:border-emerald-400 shadow-inner"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Description <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Brief description..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0c1427] border border-white/20 rounded-xl text-xs font-medium text-white placeholder:text-slate-500 outline-none focus:border-emerald-400 shadow-inner"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !newName.trim()}
                className="px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Category'}
              </button>
            </div>
          </form>
        )}

        {/* Categories List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
          {filteredCategories.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Tag size={36} className="mx-auto mb-2 text-slate-600 opacity-60" />
              <p className="text-sm font-bold text-slate-400">No categories found</p>
              <p className="text-xs text-slate-500 mt-1">
                {searchQuery ? 'Try a different search term' : 'Click "+ Add Category" to create your first category'}
              </p>
            </div>
          ) : (
            filteredCategories.map((cat) => {
              const isEditingThis = editingId === cat.id;
              const usedCount = productCountByCategory[cat.name.trim().toLowerCase()] || 0;

              if (isEditingThis) {
                return (
                  <div
                    key={cat.id}
                    className="p-4 bg-[#151f36] border border-amber-400/40 rounded-2xl space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Pencil size={12} />
                        Editing: {cat.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-slate-400 hover:text-white"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                          Category Name <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-3 py-2 bg-[#0c1427] border border-white/20 rounded-xl text-xs font-bold text-white outline-none focus:border-amber-400 shadow-inner"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                          Description
                        </label>
                        <input
                          type="text"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="w-full px-3 py-2 bg-[#0c1427] border border-white/20 rounded-xl text-xs font-medium text-white outline-none focus:border-amber-400 shadow-inner"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(cat)}
                        disabled={isSubmitting || !editName.trim()}
                        className="px-4 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-lg disabled:opacity-50 flex items-center gap-1"
                      >
                        <Check size={13} />
                        <span>{isSubmitting ? 'Saving...' : 'Update Category'}</span>
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={cat.id}
                  className="flex items-center justify-between p-3.5 bg-[#121b2f] hover:bg-[#15213b] border border-white/10 hover:border-white/20 rounded-xl transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center border border-blue-500/25 shrink-0">
                      <Tag size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-white text-sm truncate">
                          {cat.name}
                        </span>
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 border shrink-0 ${
                            usedCount > 0
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                              : 'bg-slate-700/40 text-slate-400 border-slate-600/30'
                          }`}
                          title={`${usedCount} product(s) in this category`}
                        >
                          <Package size={10} />
                          {usedCount} {usedCount === 1 ? 'product' : 'products'}
                        </span>
                      </div>
                      {cat.description && (
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          {cat.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(cat)}
                      className="p-2 text-slate-400 hover:text-amber-300 hover:bg-amber-500/15 rounded-lg transition-colors cursor-pointer"
                      title="Edit Category"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePrompt(cat)}
                      className={`p-2 rounded-lg transition-colors cursor-pointer ${
                        usedCount > 0
                          ? 'text-slate-600 hover:text-slate-500 cursor-not-allowed'
                          : 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/15'
                      }`}
                      title={
                        usedCount > 0
                          ? `Cannot delete (used by ${usedCount} product${usedCount > 1 ? 's' : ''})`
                          : 'Delete Category'
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 mt-2 border-t border-white/10 shrink-0 text-xs text-slate-400">
          <span>
            Total: <strong className="text-white">{categories.length}</strong> categories
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl font-bold transition-colors"
          >
            Close
          </button>
        </div>

        {/* Delete Confirmation Modal */}
        {deleteConfirmCat && (
          <div
            className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setDeleteConfirmCat(null)}
          >
            <div
              className="w-full max-w-sm bg-[#0c1427] border border-rose-500/40 rounded-2xl p-6 text-white shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 text-rose-400">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center border border-rose-500/30">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h4 className="font-black text-sm uppercase tracking-wider text-white">
                    Confirm Deletion
                  </h4>
                  <p className="text-[11px] text-rose-300">Permanent action</p>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Are you sure you want to delete category{' '}
                <strong className="text-white font-bold">"{deleteConfirmCat.name}"</strong>?
                This category is not used by any active product.
              </p>
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmCat(null)}
                  className="flex-1 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirmDelete}
                  className="flex-1 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-lg shadow-rose-600/30 disabled:opacity-50"
                >
                  {isSubmitting ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
