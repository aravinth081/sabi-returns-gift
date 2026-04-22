 import React, { useRef, useMemo } from 'react';
import { X, Download, Copy, CheckCircle2 } from "lucide-react";
import html2canvas from 'html2canvas';

export default function OrderInvoiceView({ order, onClose }: { order: any; onClose: () => void }) {
  const invoiceRef = useRef<HTMLDivElement>(null);

  if (!order) return null;

  // 1. FORCE REFRESH KEY (To bypass Vercel/Browser Cache)
  const refreshKey = useMemo(() => Date.now(), []);

  const discountAmount = Number(order.discount) || 0;
  const finalTotal = Number(order.totalPrice) || 0; 
  const subTotal = finalTotal + discountAmount;     

  const itemCount = order.count || 1;
  const unitPrice = subTotal / itemCount;

  const numberToWords = (num: number) => {
    return `INR ${num.toLocaleString('en-IN')} Only`;
  };

  const handleCopyAsImage = async () => {
    if (invoiceRef.current) {
      try {
        const canvas = await html2canvas(invoiceRef.current, { scale: 2, useCORS: true });
        canvas.toBlob(async (blob) => {
          if (blob) {
            try {
              const item = new ClipboardItem({ "image/png": blob });
              await navigator.clipboard.write([item]);
              alert("Copied successfully");
            } catch (err) {
              console.error(err);
              alert("Clipboard error. Use download button instead.");
            }
          }
        }, "image/png");
      } catch (err) {
        console.error("Failed to copy image: ", err);
      }
    }
  };

  const handleDownload = async () => {
    if (invoiceRef.current) {
      const canvas = await html2canvas(invoiceRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Invoice_${order.name || 'Customer'}.png`;
      link.href = imgData;
      link.click();
    }
  };

  // 2. STRICT DYNAMIC SERIAL NUMBER LOGIC
  const getInvoiceNumber = () => {
    const rawId = order.serialNo || order.serialNumber || order.orderId || order.fireId || order.id || "001";
    let id = String(rawId).toUpperCase();
    
    // Firebase long ID handling
    if (id.length > 15) {
      id = id.slice(-5);
    }

    return id.startsWith("INV-") ? id : `INV-${id}`;
  };

  const invoiceNumber = getInvoiceNumber();
  const currentDate = order.functionDate || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  const upiData = `upi://pay?pa=50100712876632@HDFC0000500.ifsc.npci&pn=Sabi return gifts&cu=INR&am=${finalTotal.toFixed(2)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiData)}`;

  return (
    <div className="bg-white rounded-xl shadow-2xl overflow-hidden w-full max-w-[900px] mx-auto border border-gray-300 font-sans text-black">
      
      {/* Top Action Bar */}
      <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center print:hidden">
        <div className="flex gap-3">
          <button onClick={handleDownload} className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-blue-700 transition-all text-sm">
            <Download size={16} /> Download
          </button>
          <button onClick={handleCopyAsImage} className="flex items-center gap-2 bg-gray-800 text-white px-5 py-2 rounded-lg font-bold hover:bg-black transition-all text-sm">
            <Copy size={16} /> Copy
          </button>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-300 rounded-full transition-all text-gray-700">
          <X size={24} />
        </button>
      </div>

      {/* Invoice Main Content */}
      <div ref={invoiceRef} className="p-10 bg-white text-black select-text text-[13px] leading-snug tracking-wide">
        
        <div className="flex justify-between items-start mb-8">
          <div>
            <h2 className="text-blue-600 font-bold tracking-[0.2em] uppercase text-lg mb-4">INVOICE</h2>
            <h1 className="text-3xl font-extrabold text-black mb-1 leading-tight">Sabi return gifts</h1>
            <p className="font-bold text-sm mb-0.5">PAN <span className="font-extrabold">FTZPS7678B</span></p>
            <p className="text-sm">2/35, 57th Street, 10th Sector, Ayyavupuram, west K.K.Nagar</p>
            <p className="text-sm mb-2">Chennai City South, TAMIL NADU, 600078</p>
            <p className="text-sm">
              <span className="font-bold">Mobile</span> +91 9345260698, 8220638753 <span className="font-bold ml-3">Email</span> sabireturngifts@gmail.com
            </p>
          </div>
          
          {/* Logo with Strict Center Alignment and Cache Breaker */}
          <div className="flex flex-col items-center pt-2 ml-auto">
            <p className="text-gray-600 font-bold uppercase text-[11px] tracking-widest mb-1 text-center font-sans">ORIGINAL FOR RECIPIENT</p>
            <img 
              src={`/sabi-logo.png?v=${refreshKey}`} 
              alt="Logo" 
              className="w-60 h-36 object-contain mix-blend-darken"
              crossOrigin="anonymous" 
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6 font-bold text-sm border-y border-gray-100 py-4">
          <div>Invoice #: <span className="font-normal">{invoiceNumber}</span></div>
          <div>Invoice Date: <span className="font-normal">{currentDate}</span></div>
          <div>Due Date: <span className="font-normal">{currentDate}</span></div>
        </div>

        <div className="mb-8 text-sm">
          <p className="font-extrabold mb-1 uppercase tracking-tighter text-gray-500">Customer Details:</p>
          <p className="font-extrabold text-lg">{order.name}</p>
          <p className="font-bold">Ph: {order.phone}</p>
        </div>

        {/* Items Table */}
        <table className="w-full border-collapse mb-2">
          <thead>
            <tr className="border-y-[3px] border-blue-500 text-left bg-blue-50/30">
              <th className="py-3 px-2 font-bold w-10">#</th>
              <th className="py-3 px-2 font-bold uppercase text-[11px]">Item</th>
              <th className="py-3 px-2 font-bold text-right w-32 uppercase text-[11px]">Rate / Item</th>
              <th className="py-3 px-2 font-bold text-center w-24 uppercase text-[11px]">Qty</th>
              <th className="py-3 px-2 font-bold text-right w-36 uppercase text-[11px]">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b-[3px] border-black">
              <td className="py-5 px-2 align-top text-sm font-bold">1</td>
              <td className="py-5 px-2 align-top">
                <p className="font-extrabold text-base mb-1 uppercase text-black leading-none">{order.category || 'Surprise Package'}</p>
                <p className="text-gray-500 text-[12px] font-bold">{order.chocolate ? `Type: ${order.chocolate}` : 'Custom Gift Package'}</p>
              </td>
              <td className="py-5 px-2 align-top text-right text-sm">{unitPrice.toFixed(2)}</td>
              <td className="py-5 px-2 align-top text-center text-sm font-bold">{itemCount}</td>
              <td className="py-5 px-2 align-top text-right text-sm font-black">{(subTotal).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        {/* Calculation Summary */}
        <div className="flex justify-between items-start mb-10 pt-4">
          <div className="text-gray-400 mt-6 text-sm italic font-bold">
            Total Items / Qty : 1 / {itemCount}
          </div>
          <div className="w-[45%]">
            <div className="flex justify-between py-2 font-bold text-lg border-b border-gray-50">
              <span>Sub-Total</span>
              <span>₹{(subTotal).toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between py-2 font-bold text-sm mb-2 text-red-600">
              <span>Total Discount</span>
              <span>- ₹{(discountAmount).toFixed(2)}</span>
            </div>

            <div className="text-right text-[11px] mb-3 text-gray-500 font-bold italic">
              Total amount (in words): {numberToWords(finalTotal)}
            </div>
            <div className="flex justify-end items-center gap-1.5 text-green-600 font-black text-xl">
              <CheckCircle2 size={20} className="fill-green-600 text-white" /> 
              Amount Paid: ₹{(finalTotal).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Bank & Signature Section */}
        <div className="flex justify-between items-start border-t border-gray-300 pt-8 mb-12">
          <div className="w-[20%]">
            <p className="font-extrabold mb-3 text-[11px] uppercase tracking-widest text-blue-600">Pay using UPI:</p>
            <div className="w-28 h-28 bg-white rounded-xl p-2 border-2 border-gray-100 shadow-inner">
              <img src={qrCodeUrl} alt="QR" className="w-full h-full object-contain" crossOrigin="anonymous" />
            </div>
          </div>
          <div className="w-[45%]">
            <p className="font-extrabold mb-3 text-[11px] uppercase tracking-widest text-blue-600">Bank Details:</p>
            <div className="grid grid-cols-[110px_1fr] gap-y-1 text-[12px] font-bold">
              <span className="text-gray-400">Bank:</span><span className="text-black uppercase">HDFC Bank</span>
              <span className="text-gray-400">Account:</span><span className="text-black uppercase text-[11px]">Sabi return gifts</span>
              <span className="text-gray-400">A/C No:</span><span className="text-black">50100712876632</span>
              <span className="text-gray-400">IFSC:</span><span className="text-black">HDFC0000500</span>
              <span className="text-gray-400">Branch:</span><span className="text-black uppercase text-[11px]">KoTTIVAKKAM (Subash G)</span>
            </div>
          </div>
          <div className="w-[30%] text-right flex flex-col items-end pt-2">
            <p className="mb-2 text-sm text-gray-400 font-bold italic">For Sabi return gifts</p>
            
            {/* Signature with Cache Breaker and Proper Size */}
            <img 
              src={`/signature.png?v=${refreshKey}`} 
              alt="Sign" 
              className="mb-2 w-44 h-24 object-contain mix-blend-darken grayscale contrast-125"
              crossOrigin="anonymous"
            />
            
            <p className="text-[12px] text-black font-black pt-1 border-t-2 border-gray-200 w-44 text-center uppercase tracking-tighter">Authorized Signatory</p>
          </div>
        </div>

        {/* Terms and Conditions */}
        <div className="text-[10px] leading-relaxed text-gray-500 border-t border-gray-100 pt-6 font-medium italic">
          <p className="font-black text-[11px] mb-2 text-black uppercase not-italic underline">Terms and Conditions:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Order Confirmation: Orders will be confirmed only after the payment is received.</li>
            <li>Customized products cannot be cancelled, returned, or refunded once production has started.</li>
            <li>Damage During Transit: Any issues must be reported within 24 hours of delivery with photo proof.</li>
          </ul>
        </div>

      </div>
    </div>
  );
}
