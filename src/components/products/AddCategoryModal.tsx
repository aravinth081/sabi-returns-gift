import React, { useState } from 'react';
import { X, Tag, Plus, AlertCircle } from 'lucide-react';

interface AddCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description?: string) => Promise<boolean | void>;
  existingCategories: string[];
}

export const AddCategoryModal: React.FC<AddCategoryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  existingCategories,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Category name is required.');
      return;
    }

    const isDuplicate = existingCategories.some(
      (cat) => cat.toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      setError(`Category "${trimmed}" already exists.`);
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      const result = await onSave(trimmed, description.trim());
      if (result !== false) {
        setName('');
        setDescription('');
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to save category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#0c1427] border border-white/20 rounded-2xl p-6 text-white shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Tag size={16} />
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-wider text-white">
                Add Category
              </h3>
              <p className="text-[11px] text-slate-400">Create a new category for products</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-2.5 bg-rose-500/15 border border-rose-500/30 rounded-xl flex items-center gap-2 text-rose-300 text-xs">
            <AlertCircle size={15} className="shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Category Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Board Games, Wooden Toys"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              className="w-full px-3.5 py-2.5 bg-[#151f36] border border-white/20 rounded-xl text-sm font-semibold text-white placeholder:text-slate-500 outline-none focus:border-emerald-400 transition-colors shadow-inner"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Description <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              placeholder="Brief description of this category..."
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#151f36] border border-white/20 rounded-xl text-xs font-medium text-white placeholder:text-slate-500 outline-none focus:border-emerald-400 transition-colors resize-none shadow-inner"
            />
          </div>

          <div className="flex items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-1.5"
            >
              <Plus size={14} />
              <span>{isSubmitting ? 'Saving...' : 'Save Category'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
