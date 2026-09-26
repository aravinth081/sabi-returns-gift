import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Boxes,
  Package,
  Camera,
  Upload,
  Book,
  Search,
  Check,
  Tag,
  Sparkles,
  Layers,
  ChevronDown,
  Hash,
  ShoppingBag,
  Minus,
  Trash2,
} from 'lucide-react';
import { AddCategoryModal } from './AddCategoryModal';
import { uploadMultipleToCloudinary } from '@/lib/cloudinary';
import { toast } from 'sonner';
export type ProductType = 'Single product' | 'Combo set';
export type ProductStatus = 'Active' | 'Draft' | 'Out of Stock' | 'Inactive';

export interface ComboItem {
  productId: string;
  name: string;
  quantity: number;
  price?: number;
  wholesalePrice?: number;
  image?: string;
  category?: string;
}

export interface ProductFormData {
  name: string;
  productType: ProductType;
  category: string;
  subcategory: string;
  brand: string;
  sku: string;
  description: string;
  price: string;
  discountPrice: string; // Wholesale / Discount price
  stock: string;
  minOrderQuantity: string;
  status: ProductStatus;
  images: string[];
  comboItems: ComboItem[];
}

interface ProductListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingProduct: any | null;
  categories: Array<{ id: string; name: string; description?: string }>;
  onAddCategory: (name: string, description?: string) => Promise<boolean | void>;
  allSingleProducts: any[];
  productSoldCountMap?: Record<string, number>;
  onSave: (productData: any, isDraft?: boolean) => Promise<void>;
  isSaving: boolean;
}

const DEFAULT_FORM_DATA: ProductFormData = {
  name: '',
  productType: 'Single product',
  category: '',
  subcategory: '',
  brand: 'Sabi Return Gifts',
  sku: '',
  description: '',
  price: '',
  discountPrice: '',
  stock: '100',
  minOrderQuantity: '1',
  status: 'Active',
  images: [],
  comboItems: [],
};

export const ProductListingModal: React.FC<ProductListingModalProps> = ({
  isOpen,
  onClose,
  editingProduct,
  categories,
  onAddCategory,
  allSingleProducts,
  productSoldCountMap = {},
  onSave,
  isSaving,
}) => {
  const [formData, setFormData] = useState<ProductFormData>(DEFAULT_FORM_DATA);
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [comboSearchQuery, setComboSearchQuery] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);

  // Initialize or reset form data
  useEffect(() => {
    if (editingProduct) {
      // Reconstruct comboItems if editing a combo set
      let comboItems: ComboItem[] = [];
      if (editingProduct.comboProducts && Array.isArray(editingProduct.comboProducts)) {
        comboItems = editingProduct.comboProducts.map((ci: any) => ({
          productId: ci.productId || ci.id,
          name: ci.name || 'Product',
          quantity: Number(ci.quantity) || 1,
          price: Number(ci.price) || 0,
          wholesalePrice: Number(ci.wholesalePrice) || 0,
          image: ci.image || (ci.images && ci.images[0]) || '',
          category: ci.category || '',
        }));
      } else if (editingProduct.comboProductIds && Array.isArray(editingProduct.comboProductIds)) {
        comboItems = editingProduct.comboProductIds.map((id: string) => {
          const matched = allSingleProducts.find((p) => p.fireId === id);
          return {
            productId: id,
            name: matched?.name || 'Product',
            quantity: 1,
            price: Number(matched?.price ?? matched?.sellingPrice) || 0,
            wholesalePrice: Number(matched?.wholesalePrice) || 0,
            image: matched?.images?.[0] || '',
            category: matched?.category || '',
          };
        });
      }

      setFormData({
        name: editingProduct.name || '',
        productType: (editingProduct.productType as ProductType) || 'Single product',
        category: editingProduct.category || '',
        subcategory: editingProduct.subcategory || '',
        brand: editingProduct.brand || 'Sabi Return Gifts',
        sku: editingProduct.sku || '',
        description: editingProduct.description || '',
        price: String(editingProduct.price ?? editingProduct.sellingPrice ?? ''),
        discountPrice: String(
          editingProduct.discountPrice ?? editingProduct.wholesalePrice ?? ''
        ),
        stock: String(editingProduct.stock ?? 100),
        minOrderQuantity: String(editingProduct.minOrderQuantity ?? 1),
        status: (editingProduct.status as ProductStatus) || 'Active',
        images: editingProduct.images || [],
        comboItems: comboItems,
      });
      setNewImageFiles([]);
      setShowProductPicker(false);
    } else {
      setFormData({
        ...DEFAULT_FORM_DATA,
        sku: `SKU-${Math.floor(100000 + Math.random() * 900000)}`,
      });
      setNewImageFiles([]);
      setShowProductPicker(false);
    }
  }, [editingProduct, isOpen, allSingleProducts]);

  if (!isOpen) return null;

  const isCombo = formData.productType === 'Combo set';

  // Calculate profit and margin
  const sellPrice = Number(formData.price) || 0;
  const wholesaleOrDiscount = Number(formData.discountPrice) || 0;
  const profit = sellPrice - wholesaleOrDiscount;
  const marginPct =
    wholesaleOrDiscount > 0 ? Math.round((profit / wholesaleOrDiscount) * 100) : 100;

  // Total retail value of selected combo items
  const comboTotalValue = formData.comboItems.reduce((sum, item) => {
    return sum + (item.price || 0) * item.quantity;
  }, 0);

  // Add category handler
  const handleCategorySaved = async (name: string, desc?: string) => {
    const res = await onAddCategory(name, desc);
    if (res !== false) {
      setFormData((prev) => ({ ...prev, category: name }));
      setIsAddCategoryOpen(false);
      toast.success(`Category "${name}" added and selected!`);
    }
  };

  // Generate a random SKU
  const generateSku = () => {
    const prefix = formData.category ? formData.category.slice(0, 3).toUpperCase() : 'SKU';
    const rand = Math.floor(100000 + Math.random() * 900000);
    setFormData((prev) => ({ ...prev, sku: `${prefix}-${rand}` }));
  };

  // Add bullet point to description
  const addBulletPoint = () => {
    const current = formData.description || '';
    const next = current ? (current.endsWith('\n') ? `${current}• ` : `${current}\n• `) : '• ';
    setFormData((prev) => ({ ...prev, description: next }));
  };

  // Combo product selection toggle
  const toggleComboProduct = (prod: any) => {
    const existingIndex = formData.comboItems.findIndex((ci) => ci.productId === prod.fireId);
    if (existingIndex >= 0) {
      setFormData((prev) => ({
        ...prev,
        comboItems: prev.comboItems.filter((ci) => ci.productId !== prod.fireId),
      }));
    } else {
      const newItem: ComboItem = {
        productId: prod.fireId,
        name: prod.name,
        quantity: 1,
        price: Number(prod.price ?? prod.sellingPrice) || 0,
        wholesalePrice: Number(prod.wholesalePrice) || 0,
        image: prod.images?.[0] || '',
        category: prod.category || '',
      };
      setFormData((prev) => ({
        ...prev,
        comboItems: [...prev.comboItems, newItem],
      }));
    }
  };

  // Update combo item quantity
  const updateComboQuantity = (productId: string, delta: number) => {
    setFormData((prev) => ({
      ...prev,
      comboItems: prev.comboItems.map((item) => {
        if (item.productId === productId) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      }),
    }));
  };

  const setComboQuantityDirect = (productId: string, qty: number) => {
    const safeQty = Math.max(1, qty || 1);
    setFormData((prev) => ({
      ...prev,
      comboItems: prev.comboItems.map((item) => {
        if (item.productId === productId) {
          return { ...item, quantity: safeQty };
        }
        return item;
      }),
    }));
  };

  const removeComboItem = (productId: string) => {
    setFormData((prev) => ({
      ...prev,
      comboItems: prev.comboItems.filter((item) => item.productId !== productId),
    }));
  };

  // Form submission
  const handleSubmit = async (e?: React.FormEvent, isDraftAction = false) => {
    if (e) e.preventDefault();

    if (!formData.name.trim()) {
      toast.error(isCombo ? 'Please enter a Combo Set Name' : 'Please enter a Product Name');
      return;
    }

    if (!formData.category) {
      toast.error('Please select a category.');
      return;
    }

    if (isCombo && formData.comboItems.length === 0) {
      toast.error('Please select at least one Single Product for this Combo Set.');
      return;
    }

    try {
      let uploadedUrls: string[] = [];
      if (newImageFiles.length > 0) {
        const toastId = toast.loading(`Uploading ${newImageFiles.length} image(s)...`);
        try {
          uploadedUrls = await uploadMultipleToCloudinary(newImageFiles);
          toast.success(`${uploadedUrls.length} image(s) uploaded!`, { id: toastId });
        } catch (uploadErr: any) {
          toast.error(uploadErr?.message || 'Image upload failed', { id: toastId });
          return;
        }
      }

      const allImages = [...formData.images, ...uploadedUrls];
      const finalStatus: ProductStatus = isDraftAction ? 'Draft' : formData.status;

      const payload: any = {
        name: formData.name.trim(),
        productType: formData.productType,
        category: formData.category,
        subcategory: formData.subcategory.trim(),
        brand: formData.brand.trim() || 'Sabi Return Gifts',
        sku: formData.sku.trim(),
        description: formData.description,
        price: Number(formData.price) || 0,
        sellingPrice: Number(formData.price) || 0,
        wholesalePrice: Number(formData.discountPrice) || 0,
        discountPrice: Number(formData.discountPrice) || 0,
        stock: Number(formData.stock) || 0,
        minOrderQuantity: Number(formData.minOrderQuantity) || 1,
        status: finalStatus,
        images: allImages,
        createdAt: editingProduct?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (isCombo) {
        payload.comboProducts = formData.comboItems.map((ci) => ({
          productId: ci.productId,
          name: ci.name,
          quantity: ci.quantity,
          price: ci.price || 0,
          wholesalePrice: ci.wholesalePrice || 0,
          image: ci.image || '',
          category: ci.category || '',
        }));
        payload.comboProductIds = formData.comboItems.map((ci) => ci.productId);
      }

      await onSave(payload, isDraftAction);
      onClose();
    } catch (err: any) {
      console.error('Error saving listing:', err);
      toast.error(err?.message || 'Failed to save listing');
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          className="w-full max-w-4xl bg-[#0c1427] border border-white/20 rounded-[2rem] text-white shadow-2xl relative max-h-[92vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* POPUP HEADER */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0c1427] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-900/40">
                {isCombo ? <Boxes size={20} /> : <ShoppingBag size={20} />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black uppercase tracking-wider text-white">
                    {editingProduct ? 'Edit Listing' : 'Add New Listing'}
                  </h2>
                  {editingProduct && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-full font-bold">
                      Editing Mode
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  {isCombo
                    ? 'Bundle multiple single products together as a combo set'
                    : 'Create or update individual product listing details'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            >
              <X size={18} />
              <span className="hidden sm:inline">Close</span>
            </button>
          </div>

          {/* POPUP BODY — SCROLLABLE */}
          <form
            id="listing-form"
            onSubmit={(e) => handleSubmit(e, false)}
            className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6"
          >
            {/* 1. PRODUCT TYPE TOGGLE (Single Product vs Combo Set) */}
            <div className="bg-[#121b2f] p-3.5 rounded-2xl border border-white/10">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-2">
                <Layers size={14} className="text-blue-400" />
                Product Type <span className="text-rose-400">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      productType: 'Single product',
                    }))
                  }
                  className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl font-extrabold text-xs transition-all cursor-pointer border ${
                    !isCombo
                      ? 'bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-600/30'
                      : 'bg-[#151f36] text-slate-300 border-white/10 hover:bg-white/5'
                  }`}
                >
                  <Package size={16} />
                  <span>Single Product</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      productType: 'Combo set',
                    }))
                  }
                  className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl font-extrabold text-xs transition-all cursor-pointer border ${
                    isCombo
                      ? 'bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-600/30'
                      : 'bg-[#151f36] text-slate-300 border-white/10 hover:bg-white/5'
                  }`}
                >
                  <Boxes size={16} />
                  <span>Combo Set</span>
                </button>
              </div>
            </div>

            {/* 2. BASIC INFORMATION */}
            <div className="bg-[#121b2f] p-5 rounded-2xl border border-white/10 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-blue-400 border-b border-white/10 pb-2 flex items-center gap-1.5">
                <Tag size={13} />
                Basic Information
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Product / Combo Name */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    {isCombo ? 'Combo Set Name' : 'Product Name / Listing Name'}{' '}
                    <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={
                      isCombo ? 'e.g. Kids Summer Return Gift Combo' : 'e.g. Water Growing Animals'
                    }
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#151f36] border border-white/20 rounded-xl text-sm font-bold text-white placeholder:text-slate-500 outline-none focus:border-blue-400 shadow-inner"
                  />
                </div>

                {/* Category Dropdown with "+ Add Category" option */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Category <span className="text-rose-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsAddCategoryOpen(true)}
                      className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Plus size={12} />
                      <span>+ Add New Category</span>
                    </button>
                  </div>
                  <div className="relative">
                    <select
                      required
                      value={formData.category}
                      onChange={(e) => {
                        if (e.target.value === '__add_new__') {
                          setIsAddCategoryOpen(true);
                        } else {
                          setFormData({ ...formData, category: e.target.value });
                        }
                      }}
                      className="w-full px-3.5 py-2.5 bg-[#151f36] border border-white/20 rounded-xl text-xs font-bold text-white outline-none focus:border-blue-400 shadow-inner cursor-pointer appearance-none pr-9"
                    >
                      <option value="" className="bg-[#151f36] text-slate-400">
                        [ Select Category ▼ ]
                      </option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.name} className="bg-[#151f36] text-white">
                          {cat.name}
                        </option>
                      ))}
                      <option
                        value="__add_new__"
                        className="bg-emerald-950/80 text-emerald-300 font-black"
                      >
                        + Add New Category
                      </option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                      <ChevronDown size={14} />
                    </div>
                  </div>
                </div>

                {/* Subcategory */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Subcategory
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Magic Toys, Educational, DIY"
                    value={formData.subcategory}
                    onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#151f36] border border-white/20 rounded-xl text-xs font-semibold text-white placeholder:text-slate-500 outline-none focus:border-blue-400 shadow-inner"
                  />
                </div>

                {/* SKU & Brand */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1">
                      <Hash size={12} className="text-slate-400" />
                      SKU / Product Code
                    </label>
                    <button
                      type="button"
                      onClick={generateSku}
                      className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles size={11} />
                      <span>Generate</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. TOY-10024"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#151f36] border border-white/20 rounded-xl text-xs font-semibold text-white placeholder:text-slate-500 outline-none focus:border-blue-400 shadow-inner"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Brand
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sabi Return Gifts"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#151f36] border border-white/20 rounded-xl text-xs font-semibold text-white placeholder:text-slate-500 outline-none focus:border-blue-400 shadow-inner"
                  />
                </div>

                {/* Description with bullet point helper */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Book size={12} className="text-blue-400" />
                      Description
                    </label>
                    <button
                      type="button"
                      onClick={addBulletPoint}
                      className="text-[11px] font-bold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 px-2.5 py-0.5 rounded-lg transition-colors cursor-pointer"
                    >
                      + Bullet Point
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    placeholder={"Description\n\n• High quality material\n• Suitable for kids return gifts\n• Safe and non-toxic"}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#151f36] border border-white/20 rounded-xl text-xs font-medium text-white placeholder:text-slate-500 outline-none focus:border-blue-400 shadow-inner resize-y leading-relaxed"
                  />
                </div>
              </div>
            </div>

            {/* 3. COMBO SET: SELECT EXISTING PRODUCTS SECTION */}
            {isCombo && (
              <div className="bg-[#151a30] p-5 rounded-2xl border border-purple-500/30 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-500/20 pb-3">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-purple-300 flex items-center gap-2">
                      <Boxes size={14} className="text-purple-400" />
                      Combo Set Items
                      <span className="text-rose-400">*</span>
                      <span className="text-[10px] bg-purple-500/20 text-purple-200 border border-purple-500/40 px-2 py-0.5 rounded-full font-bold">
                        {formData.comboItems.length} selected
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Select existing single products to build this combo set without duplication
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowProductPicker(!showProductPicker)}
                    className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-purple-600/30 flex items-center gap-1.5 shrink-0 cursor-pointer self-start sm:self-auto"
                  >
                    <Plus size={14} />
                    <span>{showProductPicker ? 'Hide Product Picker' : '+ Select Products'}</span>
                  </button>
                </div>

                {/* Inline Product Picker Drawer */}
                {showProductPicker && (
                  <div className="p-4 bg-[#0c1427] border border-purple-500/30 rounded-2xl space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-300 uppercase tracking-wider">
                        Available Single Products
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {allSingleProducts.length} total single products
                      </span>
                    </div>

                    <div className="relative">
                      <Search
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="text"
                        placeholder="Search existing products by name or category..."
                        value={comboSearchQuery}
                        onChange={(e) => setComboSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-[#151f36] border border-white/20 rounded-xl text-xs font-bold text-white placeholder:text-slate-500 outline-none focus:border-purple-400"
                      />
                    </div>

                    <div className="max-h-56 overflow-y-auto custom-scrollbar bg-[#121b2f] rounded-xl border border-white/10 divide-y divide-white/5">
                      {allSingleProducts
                        .filter(
                          (p) =>
                            !comboSearchQuery.trim() ||
                            p.name?.toLowerCase().includes(comboSearchQuery.toLowerCase()) ||
                            p.category?.toLowerCase().includes(comboSearchQuery.toLowerCase())
                        )
                        .map((prod) => {
                          const isSelected = formData.comboItems.some(
                            (ci) => ci.productId === prod.fireId
                          );
                          const sold =
                            productSoldCountMap[(prod.name || '').trim().toLowerCase()] || 0;
                          return (
                            <div
                              key={prod.fireId}
                              onClick={() => toggleComboProduct(prod)}
                              className={`flex items-center gap-3 px-3.5 py-2.5 cursor-pointer transition-all text-xs ${
                                isSelected
                                  ? 'bg-purple-500/15 border-l-4 border-l-purple-400'
                                  : 'hover:bg-white/5'
                              }`}
                            >
                              <div
                                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                                  isSelected
                                    ? 'bg-purple-500 border-purple-400'
                                    : 'border-white/25'
                                }`}
                              >
                                {isSelected && <Check size={12} className="text-white" />}
                              </div>

                              {prod.images && prod.images.length > 0 ? (
                                <img
                                  src={prod.images[0]}
                                  alt={prod.name}
                                  className="w-8 h-8 rounded-lg object-cover border border-white/20 shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-black text-xs border border-blue-500/30 shrink-0">
                                  {prod.name ? prod.name.charAt(0).toUpperCase() : 'P'}
                                </div>
                              )}

                              <div className="flex-1 min-w-0">
                                <span className="font-extrabold text-white truncate block">
                                  {prod.name}
                                </span>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {prod.category && (
                                    <span className="text-[10px] text-slate-400">
                                      {prod.category}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-amber-400 font-semibold">
                                    Sold: {sold}
                                  </span>
                                </div>
                              </div>

                              {(prod.price || prod.sellingPrice) && (
                                <span className="text-emerald-400 font-bold text-xs shrink-0">
                                  ₹{Number(prod.price ?? prod.sellingPrice).toLocaleString()}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      {allSingleProducts.length === 0 && (
                        <div className="p-4 text-center text-xs text-slate-500">
                          No single products found. Please create single products first.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Selected Products Table: Product | Quantity | Remove */}
                {formData.comboItems.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#0c1427]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#121b2f] border-b border-white/10 text-slate-300 uppercase tracking-wider text-[11px] font-black">
                          <th className="py-2.5 px-3.5">Product</th>
                          <th className="py-2.5 px-3.5 text-center w-36">Quantity</th>
                          <th className="py-2.5 px-3.5 text-right w-24">Price</th>
                          <th className="py-2.5 px-3.5 text-center w-20">Remove</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {formData.comboItems.map((item) => (
                          <tr key={item.productId} className="hover:bg-white/5 transition-colors">
                            <td className="py-2.5 px-3.5">
                              <div className="flex items-center gap-2.5">
                                {item.image ? (
                                  <img
                                    src={item.image}
                                    alt={item.name}
                                    className="w-8 h-8 rounded-lg object-cover border border-white/20 shrink-0"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center font-black text-xs shrink-0">
                                    {item.name ? item.name.charAt(0).toUpperCase() : 'P'}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <span className="font-bold text-white block truncate">
                                    {item.name}
                                  </span>
                                  {item.category && (
                                    <span className="text-[10px] text-slate-400">
                                      {item.category}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Quantity column */}
                            <td className="py-2.5 px-3.5 text-center">
                              <div className="inline-flex items-center gap-1 bg-[#151f36] border border-white/15 rounded-lg p-1">
                                <button
                                  type="button"
                                  onClick={() => updateComboQuantity(item.productId, -1)}
                                  className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
                                >
                                  <Minus size={11} />
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    setComboQuantityDirect(
                                      item.productId,
                                      parseInt(e.target.value) || 1
                                    )
                                  }
                                  className="w-10 text-center font-black bg-transparent text-white text-xs outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateComboQuantity(item.productId, 1)}
                                  className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
                                >
                                  <Plus size={11} />
                                </button>
                              </div>
                            </td>

                            {/* Price */}
                            <td className="py-2.5 px-3.5 text-right font-bold text-emerald-400">
                              ₹{((item.price || 0) * item.quantity).toLocaleString()}
                            </td>

                            {/* Remove button */}
                            <td className="py-2.5 px-3.5 text-center">
                              <button
                                type="button"
                                onClick={() => removeComboItem(item.productId)}
                                className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 rounded-lg transition-colors cursor-pointer"
                                title="Remove product from combo"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-6 text-center border border-dashed border-purple-500/30 rounded-xl bg-[#0c1427]/50 space-y-2">
                    <Boxes size={28} className="mx-auto text-purple-400 opacity-60" />
                    <p className="text-xs font-bold text-slate-300">No products added to this combo yet</p>
                    <p className="text-[11px] text-slate-500">
                      Click <strong>[+ Select Products]</strong> above to choose from existing single products.
                    </p>
                  </div>
                )}

                {comboTotalValue > 0 && (
                  <div className="flex items-center justify-between p-3 bg-[#0c1427] border border-white/10 rounded-xl text-xs">
                    <span className="text-slate-400 font-medium">Total Individual Retail Value:</span>
                    <span className="font-extrabold text-amber-300">
                      ₹{comboTotalValue.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* 4. PRODUCT DETAILS & PRICING */}
            <div className="bg-[#121b2f] p-5 rounded-2xl border border-white/10 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 border-b border-white/10 pb-2 flex items-center gap-1.5">
                <Package size={13} />
                Pricing, Inventory & Status
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Selling Price */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Selling Price (₹) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 199"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#151f36] border border-white/20 rounded-xl text-sm font-black text-emerald-400 placeholder:text-slate-500 outline-none focus:border-emerald-400 shadow-inner"
                  />
                </div>

                {/* Discount / Wholesale Price */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Discount / Wholesale (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 120"
                    value={formData.discountPrice}
                    onChange={(e) => setFormData({ ...formData, discountPrice: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#151f36] border border-white/20 rounded-xl text-sm font-black text-blue-400 placeholder:text-slate-500 outline-none focus:border-blue-400 shadow-inner"
                  />
                </div>

                {/* Stock Quantity */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Stock Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 50"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#151f36] border border-white/20 rounded-xl text-xs font-bold text-white placeholder:text-slate-500 outline-none focus:border-blue-400 shadow-inner"
                  />
                </div>

                {/* Minimum Order Quantity */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Min Order Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 1"
                    value={formData.minOrderQuantity}
                    onChange={(e) => setFormData({ ...formData, minOrderQuantity: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#151f36] border border-white/20 rounded-xl text-xs font-bold text-white placeholder:text-slate-500 outline-none focus:border-blue-400 shadow-inner"
                  />
                </div>
              </div>

              {/* Profit margin live feedback */}
              {(formData.price || formData.discountPrice) && (
                <div className="bg-[#151f36] border border-white/10 rounded-xl p-3 flex items-center justify-between text-xs animate-in fade-in">
                  <span className="text-slate-300 font-semibold">
                    Calculated Margin (Selling - Wholesale):
                  </span>
                  <span
                    className={`font-black text-sm ${
                      profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    ₹{profit.toLocaleString()}{' '}
                    {wholesaleOrDiscount > 0 ? `(${marginPct}% margin)` : ''}
                  </span>
                </div>
              )}

              {/* Product Status */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  Product Status <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['Active', 'Draft', 'Out of Stock', 'Inactive'] as ProductStatus[]).map(
                    (st) => {
                      const isSelected = formData.status === st;
                      let colorClasses = '';
                      if (st === 'Active') {
                        colorClasses = isSelected
                          ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-600/30'
                          : 'bg-[#151f36] text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10';
                      } else if (st === 'Draft') {
                        colorClasses = isSelected
                          ? 'bg-amber-600 border-amber-400 text-white shadow-lg shadow-amber-600/30'
                          : 'bg-[#151f36] text-amber-400 border-amber-500/30 hover:bg-amber-500/10';
                      } else if (st === 'Out of Stock') {
                        colorClasses = isSelected
                          ? 'bg-rose-600 border-rose-400 text-white shadow-lg shadow-rose-600/30'
                          : 'bg-[#151f36] text-rose-400 border-rose-500/30 hover:bg-rose-500/10';
                      } else {
                        colorClasses = isSelected
                          ? 'bg-slate-600 border-slate-400 text-white shadow-lg shadow-slate-600/30'
                          : 'bg-[#151f36] text-slate-400 border-slate-600/30 hover:bg-slate-700/30';
                      }

                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setFormData({ ...formData, status: st })}
                          className={`py-2 px-3 rounded-xl text-xs font-extrabold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${colorClasses}`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              st === 'Active'
                                ? 'bg-emerald-400'
                                : st === 'Draft'
                                ? 'bg-amber-400'
                                : st === 'Out of Stock'
                                ? 'bg-rose-400'
                                : 'bg-slate-400'
                            }`}
                          />
                          <span>{st}</span>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            </div>

            {/* 5. PRODUCT IMAGES */}
            <div className="bg-[#121b2f] p-5 rounded-2xl border border-white/10 space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Camera size={13} />
                  Product Images (Primary & Additional)
                </h3>
                <span className="text-[10px] text-slate-400">
                  {formData.images.length + newImageFiles.length} total photos
                </span>
              </div>

              {/* Previews */}
              {(formData.images.length > 0 || newImageFiles.length > 0) && (
                <div className="flex flex-wrap gap-2.5 p-3 bg-[#0c1427] rounded-xl border border-white/10">
                  {/* Existing Saved Images */}
                  {formData.images.map((url, idx) => (
                    <div
                      key={`saved-${idx}`}
                      className="relative group w-16 h-16 rounded-xl overflow-hidden border border-white/20 shadow-md"
                    >
                      <img src={url} alt="Product" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            images: prev.images.filter((_, i) => i !== idx),
                          }))
                        }
                        className="absolute top-1 right-1 bg-rose-600/90 hover:bg-rose-600 text-white rounded-full p-1 cursor-pointer opacity-80 group-hover:opacity-100 transition-opacity"
                        title="Remove image"
                      >
                        <X size={10} />
                      </button>
                      {idx === 0 && (
                        <span className="absolute bottom-0 inset-x-0 bg-blue-600/90 text-[8px] text-center text-white font-black uppercase tracking-wider">
                          Primary
                        </span>
                      )}
                    </div>
                  ))}

                  {/* New Selected Files */}
                  {newImageFiles.map((file, idx) => (
                    <div
                      key={`new-${idx}`}
                      className="relative group w-16 h-16 rounded-xl overflow-hidden border border-emerald-400/50 shadow-md"
                    >
                      <img
                        src={URL.createObjectURL(file)}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setNewImageFiles((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="absolute top-1 right-1 bg-rose-600/90 hover:bg-rose-600 text-white rounded-full p-1 cursor-pointer opacity-80 group-hover:opacity-100 transition-opacity"
                        title="Remove image"
                      >
                        <X size={10} />
                      </button>
                      <span className="absolute bottom-0 inset-x-0 bg-emerald-600/90 text-[8px] text-center text-white font-black uppercase tracking-wider">
                        Ready
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Drop Area */}
              <label className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed border-white/20 hover:border-amber-400/60 bg-[#151f36]/60 hover:bg-[#151f36] cursor-pointer transition-all text-xs font-bold text-slate-300 hover:text-white">
                <Upload size={20} className="text-amber-400 mb-1.5" />
                <span>Click to select product photos</span>
                <span className="text-[10px] text-slate-400 font-normal mt-0.5">
                  JPG, PNG, WEBP up to 10MB (First image will be used as primary thumbnail)
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      const files = Array.from(e.target.files);
                      setNewImageFiles((prev) => [...prev, ...files]);
                    }
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </form>

          {/* POPUP FOOTER */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-white/10 bg-[#0c1427] shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold border border-white/20 bg-slate-800/80 text-slate-200 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer text-xs"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {/* Save as Draft (Only shown for new listing per Requirement 23) */}
              {!editingProduct && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={(e) => handleSubmit(e, true)}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl font-bold border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition-colors cursor-pointer text-xs disabled:opacity-50"
                >
                  Save as Draft
                </button>
              )}

              {/* Primary Action: Create Listing or Save Changes */}
              <button
                type="button"
                disabled={isSaving}
                onClick={(e) => handleSubmit(e, false)}
                className={`flex-1 sm:flex-initial px-6 py-2.5 rounded-xl font-extrabold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/40 transition-all cursor-pointer text-xs disabled:opacity-60 flex items-center justify-center gap-1.5`}
              >
                {isSaving ? (
                  <span>Saving Listing...</span>
                ) : editingProduct ? (
                  <span>Save Changes</span>
                ) : (
                  <span>Create Listing</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add Category Submodal */}
      <AddCategoryModal
        isOpen={isAddCategoryOpen}
        onClose={() => setIsAddCategoryOpen(false)}
        onSave={handleCategorySaved}
        existingCategories={categories.map((c) => c.name)}
      />
    </>
  );
};
