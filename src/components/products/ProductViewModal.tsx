import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Package,
  Boxes,
  Tag,
  Hash,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  Upload,
  Trash2,
  ClipboardList,
  Sparkles,
  Layers,
  FileText,
  Images,
  ExternalLink,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';

interface ProductViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any | null;
  soldCount?: number;
  onEdit?: (product: any) => void;
  onImageUpload?: (productFireId: string, files: FileList | File[]) => Promise<void>;
  onDeleteImage?: (productFireId: string, imageIndex: number) => Promise<void>;
}

export const ProductViewModal: React.FC<ProductViewModalProps> = ({
  isOpen,
  onClose,
  product,
  soldCount = 0,
  onEdit,
  onImageUpload,
  onDeleteImage,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isCopyingDesc, setIsCopyingDesc] = useState(false);
  const [isCopyingImg, setIsCopyingImg] = useState(false);
  const [isCopyingAll, setIsCopyingAll] = useState(false);

  if (!isOpen || !product) return null;

  const images: string[] = product.images || [];
  const currentImage = images[activeIndex] || images[0] || '';
  const isCombo = (product.productType || 'Single product') === 'Combo set';
  const sellPrice = Number(product.price ?? product.sellingPrice) || 0;
  const wholesalePrice = Number(product.wholesalePrice ?? product.discountPrice) || 0;
  const profit = sellPrice - wholesalePrice;
  const marginPct = wholesalePrice > 0 ? Math.round((profit / wholesalePrice) * 100) : 100;

  // 1. Copy Description (Requirement 17)
  const handleCopyDescription = async () => {
    const text = product.description?.trim();
    if (!text) {
      toast.error('No description to copy');
      return;
    }
    try {
      setIsCopyingDesc(true);
      await navigator.clipboard.writeText(text);
      toast.success('Description copied');
    } catch (err) {
      toast.error('Failed to copy description');
    } finally {
      setTimeout(() => setIsCopyingDesc(false), 1500);
    }
  };

  // 2. Copy Current Image (Requirement 17)
  const handleCopyImage = async (imgUrl: string) => {
    if (!imgUrl) {
      toast.error('No image selected to copy');
      return;
    }
    try {
      setIsCopyingImg(true);

      // Attempt DOM image copy first
      const domImg = document.getElementById('view-modal-main-image') as HTMLImageElement;
      if (domImg && domImg.complete && domImg.naturalWidth > 0) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = domImg.naturalWidth;
          canvas.height = domImg.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(domImg, 0, 0);
            const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
            if (blob) {
              await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
              toast.success('Image copied');
              return;
            }
          }
        } catch {
          // Fall through to fetch
        }
      }

      // Fetch fallback
      const resp = await fetch(imgUrl, { cache: 'force-cache' });
      const origBlob = await resp.blob();

      if (origBlob.type === 'image/png') {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': origBlob })]);
        toast.success('Image copied');
      } else {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = imgUrl;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context error');
        ctx.drawImage(img, 0, 0);
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
        if (blob) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          toast.success('Image copied');
        } else {
          throw new Error('Blob creation failed');
        }
      }
    } catch {
      // Fallback: copy URL as text
      try {
        await navigator.clipboard.writeText(imgUrl);
        toast.success('Image copied');
      } catch {
        toast.error('Failed to copy image');
      }
    } finally {
      setTimeout(() => setIsCopyingImg(false), 1500);
    }
  };

  // 3. Copy ALL Images (Requirement 17: Copies ALL images belonging to listing)
  const handleCopyAll = async () => {
    if (images.length === 0) {
      toast.error('No images to copy');
      return;
    }
    try {
      setIsCopyingAll(true);

      // If single image, copy that image directly
      if (images.length === 1) {
        await handleCopyImage(images[0]);
        toast.success('All images copied');
        return;
      }

      // If multiple images: prepare rich HTML with all images + plain text fallback
      const toastId = toast.loading(`Copying ${images.length} images...`);
      try {
        const html = images
          .map(
            (url, i) =>
              `<img src="${url}" alt="Product Image ${i + 1}" style="max-width:100%;display:block;margin-bottom:12px;" />`
          )
          .join('\n');
        const text = images.join('\n');

        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([text], { type: 'text/plain' }),
          }),
        ]);
        toast.success('All images copied', { id: toastId });
      } catch {
        // Fallback write plain URLs
        await navigator.clipboard.writeText(images.join('\n'));
        toast.success('All images copied', { id: toastId });
      }
    } catch {
      toast.error('Failed to copy all images');
    } finally {
      setTimeout(() => setIsCopyingAll(false), 1500);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[150] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-[#0c1427] border border-white/20 rounded-[2rem] text-white shadow-2xl relative max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0c1427] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-900/40 shrink-0">
              {isCombo ? <Boxes size={20} /> : <Package size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg md:text-xl font-black text-white tracking-wide truncate max-w-md">
                  {product.name}
                </h2>
                <span
                  className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                    isCombo
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                      : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  }`}
                >
                  {product.productType || 'Single product'}
                </span>
                {product.status && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      product.status === 'Active'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : product.status === 'Draft'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    }`}
                  >
                    {product.status}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                {product.category && (
                  <span className="flex items-center gap-1 text-slate-300">
                    <Tag size={12} className="text-amber-400" />
                    {product.category}
                  </span>
                )}
                {product.subcategory && (
                  <span className="text-slate-400">/ {product.subcategory}</span>
                )}
                <span className="text-amber-400 font-extrabold flex items-center gap-1">
                  <ShoppingBag size={12} />
                  Sold: {soldCount}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(product);
                }}
                className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Pencil size={13} />
                <span className="hidden sm:inline">Edit Listing</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {/* Main Grid: Images (Left) + Quick Specs (Right) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Gallery Column (7 cols) */}
            <div className="md:col-span-7 space-y-3">
              <div className="relative rounded-2xl overflow-hidden bg-black/50 border border-white/10 flex items-center justify-center h-64 sm:h-80">
                {currentImage ? (
                  <img
                    id="view-modal-main-image"
                    crossOrigin="anonymous"
                    src={currentImage}
                    alt={product.name}
                    className="max-h-full max-w-full object-contain p-2"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-500 text-xs">
                    <Images size={40} className="mb-2 text-slate-600" />
                    <span>No product photos uploaded</span>
                  </div>
                )}

                {/* Left/Right Carousel Controls */}
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
                      }
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/90 text-white p-2 rounded-full cursor-pointer transition-colors"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
                      }
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/90 text-white p-2 rounded-full cursor-pointer transition-colors"
                    >
                      <ChevronRight size={18} />
                    </button>
                    <span className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-black/75 px-3 py-0.5 rounded-full text-[10px] font-bold text-slate-300">
                      {activeIndex + 1} / {images.length}
                    </span>
                  </>
                )}
              </div>

              {/* Thumbnails Strip */}
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveIndex(i)}
                      className={`relative w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                        i === activeIndex
                          ? 'border-blue-500 shadow-md shadow-blue-500/30 scale-105'
                          : 'border-white/10 hover:border-white/30 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* 🟢 IMAGE COPY ACTIONS BAR (Requirement 17) */}
              <div className="bg-[#121b2f] p-3 rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  {/* Copy Image Button */}
                  <button
                    type="button"
                    onClick={() => currentImage && handleCopyImage(currentImage)}
                    disabled={!currentImage || isCopyingImg}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-extrabold text-xs shadow-md shadow-blue-900/30 transition-all flex items-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95"
                    title="Copy currently selected image"
                  >
                    <ClipboardList size={14} />
                    <span>{isCopyingImg ? 'Copied' : 'Copy Image'}</span>
                  </button>

                  {/* Copy All Button (Requirement 17: Copies ALL images) */}
                  <button
                    type="button"
                    onClick={handleCopyAll}
                    disabled={images.length === 0 || isCopyingAll}
                    className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-extrabold text-xs shadow-md shadow-purple-900/30 transition-all flex items-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95"
                    title={`Copy all ${images.length} image(s)`}
                  >
                    <Images size={14} />
                    <span>{isCopyingAll ? 'Copied All' : `Copy All (${images.length})`}</span>
                  </button>
                </div>

                {/* Additional Image Upload & Delete */}
                <div className="flex items-center gap-2">
                  {onImageUpload && (
                    <label className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors">
                      <Upload size={13} />
                      <span className="hidden sm:inline">Add Photo</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            onImageUpload(product.fireId, e.target.files);
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>
                  )}
                  {onDeleteImage && images.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onDeleteImage(product.fireId, activeIndex)}
                      className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-colors cursor-pointer"
                      title="Delete this photo"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Specs & Pricing Column (5 cols) */}
            <div className="md:col-span-5 space-y-4">
              {/* Pricing & Profit Card */}
              <div className="bg-[#121b2f] p-4 rounded-2xl border border-white/10 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider border-b border-white/10 pb-2">
                  <span>Financial Breakdown</span>
                  <span className="text-amber-400">INR (₹)</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-[#15213b] p-3 rounded-xl border border-white/5">
                    <span className="text-slate-400 text-[11px] block">Selling Price</span>
                    <span className="text-base font-black text-emerald-400">
                      ₹{sellPrice.toLocaleString()}
                    </span>
                  </div>
                  <div className="bg-[#15213b] p-3 rounded-xl border border-white/5">
                    <span className="text-slate-400 text-[11px] block">Wholesale Cost</span>
                    <span className="text-base font-black text-blue-400">
                      ₹{wholesalePrice.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Profit & Margin */}
                <div className="bg-[#15213b] p-3 rounded-xl border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Estimated Profit</span>
                    <span
                      className={`text-base font-black ${
                        profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      ₹{profit.toLocaleString()}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-black px-2.5 py-1 rounded-full border ${
                      profit >= 0
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    }`}
                  >
                    {marginPct}% Margin
                  </span>
                </div>
              </div>

              {/* Inventory & Meta Card */}
              <div className="bg-[#121b2f] p-4 rounded-2xl border border-white/10 space-y-2.5 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Actual Units Sold:</span>
                  <strong className="text-amber-400 text-sm font-black">{soldCount} units</strong>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Stock Quantity:</span>
                  <span className="text-white font-bold">{product.stock ?? 100} in stock</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Min Order Quantity:</span>
                  <span className="text-white font-bold">{product.minOrderQuantity ?? 1}</span>
                </div>
                {product.sku && (
                  <div className="flex items-center justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">SKU / Code:</span>
                    <span className="font-mono text-cyan-300 font-bold">{product.sku}</span>
                  </div>
                )}
                {product.brand && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-400">Brand:</span>
                    <span className="text-white font-bold">{product.brand}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Combo Set Bundled Products (Requirement 13 & 14) */}
          {isCombo && product.comboProducts && product.comboProducts.length > 0 && (
            <div className="bg-[#121b2f] p-5 rounded-2xl border border-purple-500/30 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-purple-300 flex items-center gap-2">
                <Boxes size={15} />
                <span>Bundled Combo Set Products ({product.comboProducts.length})</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {product.comboProducts.map((ci: any, idx: number) => (
                  <div
                    key={ci.productId || idx}
                    className="p-3 bg-[#15213b] rounded-xl border border-white/10 flex items-center gap-3"
                  >
                    {ci.image ? (
                      <img
                        src={ci.image}
                        alt={ci.name}
                        className="w-10 h-10 rounded-lg object-cover border border-white/20 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center font-black text-xs shrink-0">
                        {ci.name ? ci.name.charAt(0).toUpperCase() : 'P'}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-white block truncate">{ci.name}</span>
                      <div className="flex items-center justify-between text-[11px] mt-0.5">
                        <span className="text-slate-400">Qty: {ci.quantity || 1}</span>
                        {ci.price && (
                          <span className="text-emerald-400 font-bold">
                            ₹{Number(ci.price).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description Section with Copy Description Button (Requirement 15 & 17) */}
          <div className="bg-[#121b2f] p-5 rounded-2xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <FileText size={15} className="text-blue-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-blue-400">
                  Product Description
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCopyDescription}
                disabled={!product.description || isCopyingDesc}
                className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50"
                title="Copy complete product description"
              >
                {isCopyingDesc ? <Check size={13} /> : <Copy size={13} />}
                <span>{isCopyingDesc ? 'Copied' : 'Copy Description'}</span>
              </button>
            </div>

            {product.description ? (
              <div className="text-xs sm:text-sm text-slate-200 whitespace-pre-wrap leading-relaxed font-normal bg-[#15213b] p-4 rounded-xl border border-white/5">
                {product.description}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic p-2">No description provided for this listing.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-[#0c1427] shrink-0">
          <span className="text-xs text-slate-500">
            Created: {product.createdAt ? new Date(product.createdAt).toLocaleDateString() : 'N/A'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-white/15 transition-colors text-xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
