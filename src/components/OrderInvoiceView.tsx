 import React, { useRef, useMemo, useState } from 'react';
import { X, Download, Copy, CheckCircle2, ClipboardCheck } from "lucide-react";
import html2canvas from 'html2canvas';

export default function OrderInvoiceView({ order, onClose }: { order: any; onClose: () => void }) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [isCopied, setIsCopied] = useState(false);

  if (!order) return null;

  const refreshKey = useMemo(() => Date.now(), []);

  // Pricing Logic matching Dashboard
  const discountAmount = Number(order.discount) || 0;
  const finalTotal = Number(order.totalOrderPrice || order.totalPrice) || 0;
  const totalQty = Number(order.count) || 1;
  const advancePaid = Number(order.advanceAmount) || 0;
  const pendingBalance = finalTotal - advancePaid;

  // Reconstruct prices per item
  const items = String(order.chocolate || 'Gift Item').split(',').map(item => item.trim()).filter(Boolean);
  const itemCount = items.length;

  // Calculate subtotal and unit prices
  // In Dashboard, totalPrice = (unitPrice * qty) + delivery - discount
  // We'll assume delivery is 0 for simplicity in the item list, or included in the first item
  const subTotal = finalTotal + discountAmount;
  const avgRateAfterDiscount = finalTotal / totalQty;
  const avgRateBeforeDiscount = subTotal / totalQty;

  const numberToWords = (num: number) => {
    if (num === 0) return 'INR Zero Only';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

    const convertLessThanThousand = (n: number): string => {
      if (n === 0) return '';
      let res = '';
      if (n >= 100) {
        res += ones[Math.floor(n / 100)] + ' Hundred ';
        n %= 100;
      }
      if (n >= 10 && n <= 19) {
        res += teens[n - 10];
      } else {
        if (n >= 20) {
          res += tens[Math.floor(n / 10)] + ' ';
          n %= 10;
        }
        if (n > 0) {
          res += ones[n];
        }
      }
      return res.trim();
    };

    let n = Math.floor(num);
    let res = '';
    if (n >= 10000000) { res += convertLessThanThousand(Math.floor(n / 10000000)) + ' Crore '; n %= 10000000; }
    if (n >= 100000) { res += convertLessThanThousand(Math.floor(n / 100000)) + ' Lakh '; n %= 100000; }
    if (n >= 1000) { res += convertLessThanThousand(Math.floor(n / 1000)) + ' Thousand '; n %= 1000; }
    res += convertLessThanThousand(n);
    return `INR ${res.trim()} Rupees Only.`;
  };

  const handleDownload = async () => {
    if (invoiceRef.current) {
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 800,
        scrollX: 0,
        scrollY: 0
      });
      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Invoice_${order.name || 'Customer'}.png`;
      link.href = imgData;
      link.click();
    }
  };

  const handleCopyAsImage = async () => {
    if (invoiceRef.current) {
      try {
        const canvas = await html2canvas(invoiceRef.current, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 800,
          scrollX: 0,
          scrollY: 0
        });
        canvas.toBlob(async (blob) => {
          if (blob) {
            try {
              const item = new ClipboardItem({ "image/png": blob });
              await navigator.clipboard.write([item]);
              setIsCopied(true);
              setTimeout(() => setIsCopied(false), 2000);
            } catch (err) {
              console.error(err);
              alert("Browser block clipboad. Use Download.");
            }
          }
        }, "image/png");
      } catch (err) {
        console.error(err);
      }
    }
  };

  const getInvoiceNumber = () => {
    const rawId = order.serialNo || order.serialNumber || order.orderId || order.fireId || order.id || "001";
    let id = String(rawId).toUpperCase();
    if (id.length > 15) id = id.slice(-5);
    return id.startsWith("INV-") ? id : `INV-${id}`;
  };

  const invoiceNumber = getInvoiceNumber();
  const currentDate = order.deliveryDate || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });


  const upiData = `upi://pay?pa=8220638753@upi&pn=SUBASH%20G&am=${finalTotal.toFixed(2)}&cu=INR`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiData)}`;

  return (
    <div className="bg-white rounded-xl shadow-2xl overflow-hidden w-full max-w-[850px] mx-auto border border-gray-300 font-sans text-black">

      {/* Top Action Bar */}
      <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center print:hidden">
        <div className="flex gap-2">
          <button onClick={handleDownload} className="flex items-center gap-2 bg-[#1a365d] text-white px-5 py-2 rounded-lg font-bold hover:bg-[#2c5282] transition-all text-sm">
            <Download size={16} /> Download Invoice
          </button>
          <button onClick={handleCopyAsImage} className={`flex items-center gap-2 px-5 py-2 rounded-lg font-bold transition-all text-sm ${isCopied ? 'bg-green-600 text-white' : 'bg-gray-800 text-white hover:bg-black'}`}>
            {isCopied ? <ClipboardCheck size={16} /> : <Copy size={16} />}
            {isCopied ? 'Copied!' : 'Copy Image'}
          </button>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-all text-gray-700">
          <X size={24} />
        </button>
      </div>

      {/* Invoice Main Content */}
      <div ref={invoiceRef} className="pl-10 pt-10 pb-10 pr-4 bg-white text-black select-text text-[13px] leading-tight font-sans w-[800px] min-w-[800px]">

        {/* Header Section */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1">
            <h2 className="text-[#3182ce] font-bold tracking-widest uppercase text-lg mb-4">INVOICE</h2>
            <h1 className="text-2xl font-black text-black mb-1">Sabi return gifts</h1>
            <div className="text-[13px] font-bold space-y-0.5">
              <p>PAN <span className="font-extrabold uppercase">FTZPS7678B</span></p>
              <p>2/35, 57th Street, 10th Sector</p>
              <p>Ayyavupuram, west K.K.Nagar</p>
              <p>Chennai City South, TAMIL NADU, 600078</p>
              <p>
                Mobile <span className="font-extrabold">+91 9345260698, 8220638753</span> <span className="ml-2">Email sabireturngifts@gmail.com</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end ml-auto">
            <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mb-3 text-right">ORIGINAL FOR RECIPIENT</p>
            <div className="w-[420px] h-[180px] bg-white flex items-center justify-end">
              <img
                src={`/sabi-logo.png?v=${refreshKey}`}
                alt="Logo"
                style={{
                  maxWidth: '400px',
                  maxHeight: '160px',
                  width: 'auto',
                  height: 'auto'
                }}
                className="block"
                crossOrigin="anonymous"
              />
            </div>
          </div>
        </div>

        {/* Meta Row */}
        <div className="flex justify-between items-center mb-8 border-y border-gray-100 py-3 font-bold text-[13px]">
          <div>Invoice #: <span className="font-black">{invoiceNumber}</span></div>
          <div>Invoice Date: <span className="font-black">{currentDate}</span></div>
          <div>Due Date: <span className="font-black">{currentDate}</span></div>
        </div>

        {/* Customer Details */}
        <div className="mb-6">
          <p className="font-bold text-gray-500 mb-1">Customer Details:</p>
          <p className="font-black text-lg leading-none mb-1">{order.name}</p>
          <p className="font-bold">Ph: {order.phone}</p>
        </div>

        {/* Items Table */}
        <table className="w-full border-collapse mb-1">
          <thead>
            <tr className="border-y-2 border-[#3182ce] text-left text-[11px] uppercase tracking-wider">
              <th className="py-2 px-1 font-black w-8">#</th>
              <th className="py-2 px-1 font-black">Item</th>
              <th className="py-2 px-1 font-black text-right w-48">Rate / Item</th>
              <th className="py-2 px-1 font-black text-center w-24">Qty</th>
              <th className="py-2 px-1 font-black text-right w-36">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              // Logic to distribute prices:
              // For now, we assume the first item takes the total and the others are part of the set
              // OR we split the total equally. Equal split is safer for "Kitkat" style lists.
              const itemRate = avgRateAfterDiscount;
              const itemRateBefore = avgRateBeforeDiscount;
              const itemQty = index === 0 ? totalQty : 0; // The total qty is usually for the whole "order line"
              const itemAmount = itemRate * (index === 0 ? totalQty : 0);

              if (index > 0 && !order.chocolate.includes(',')) return null; // Safety check

              return (
                <tr key={index} className={index === items.length - 1 ? 'border-b-2 border-black' : 'border-b border-gray-100'}>
                  <td className="py-5 px-1 align-top font-bold">{index + 1}</td>
                  <td className="py-5 px-1 align-top">
                    <p className="font-black text-[14px]">{item}</p>
                  </td>
                  <td className="py-5 px-1 align-top text-right">
                    <p className="font-black text-[14px]">{itemRate.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    {discountAmount > 0 && index === 0 && (
                      <p className="text-gray-500 text-[11px] font-bold mt-1">
                        {itemRateBefore.toFixed(2)} (-{((discountAmount / subTotal) * 100).toFixed(2)}%)
                      </p>
                    )}
                  </td>
                  <td className="py-5 px-1 align-top text-center font-black text-[14px]">{index === 0 ? totalQty : '-'}</td>
                  <td className="py-5 px-1 align-top text-right font-black text-[14px]">
                    {itemAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Summary Area */}
        <div className="flex justify-between items-start mb-6 pt-2">
          <div className="text-gray-500 font-bold text-[12px]">
            Total Items / Qty : {itemCount} / {totalQty}
          </div>
          <div className="w-[55%] text-right">
            <div className="flex justify-between py-1 border-t-2 border-black items-center">
              <span className="font-black text-[20px]">Total</span>
              <span className="font-black text-[24px]">₹{finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between py-1 font-black text-[14px]">
              <span>Total Discount</span>
              <span>₹{discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            {advancePaid > 0 && (
              <div className="flex justify-between py-1 font-black text-[14px] text-green-700">
                <span>Advance Paid</span>
                <span>₹{advancePaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            {pendingBalance > 0 && (
              <div className="flex justify-between py-1 font-black text-[14px] text-red-600 border-t border-gray-200 mt-1">
                <span>Pending Balance</span>
                <span>₹{pendingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="text-[11px] mt-2 text-gray-800 font-bold border-t border-gray-200 pt-2 tracking-tight">
              Total amount (in words): {numberToWords(finalTotal)}
            </div>
            <div className={`flex justify-end items-center gap-1.5 font-black text-[13px] mt-2 uppercase ${order.paymentStatus === 'Full Paid' ? 'text-[#38a169]' : 'text-orange-600'}`}>
              <CheckCircle2 size={16} className={`fill-current text-white`} />
              {order.paymentStatus || 'Payment Pending'}
            </div>
          </div>
        </div>

        {/* UPI & Bank Details Row */}
        <div className="grid grid-cols-[1fr_1.2fr_1fr] gap-8 border-t border-gray-300 pt-8 mb-10">
          <div>
            <p className="font-black mb-3 uppercase text-[12px]">Pay using UPI:</p>
            <div className="w-32 h-32 bg-white border border-gray-100 p-1">
              <img src={qrCodeUrl} alt="QR" className="w-full h-full object-contain" crossOrigin="anonymous" />
            </div>
          </div>

          <div>
            <p className="font-black mb-3 uppercase text-[12px]">Bank Details:</p>
            <div className="grid grid-cols-[100px_1fr] gap-y-1 font-bold text-[11px] leading-tight">
              <span className="text-gray-500">Bank:</span><span className="font-black uppercase">HDFC Bank</span>
              <span className="text-gray-500">Account Holder:</span><span className="font-black uppercase">Sabi return gifts</span>
              <span className="text-gray-500">Account #:</span><span className="font-black">50100712876632</span>
              <span className="text-gray-500">IFSC Code:</span><span className="font-black uppercase">HDFC0000500</span>
              <span className="text-gray-500">Branch:</span><span className="font-black uppercase">KOTTIVAKKAM</span>
              <span className="text-gray-500"></span><span className="font-black text-[10px]">Subash G</span>
            </div>
          </div>

          <div className="text-right flex flex-col items-end">
            <p className="mb-4 text-sm text-gray-500 font-bold italic">For Sabi return gifts</p>
            <img
              src={`/signature.png?v=${refreshKey}`}
              alt="Sign"
              className="mb-1 w-64 h-32 object-contain grayscale contrast-150"
              crossOrigin="anonymous"
            />
            <p className="text-[12px] text-black font-black pt-1 border-t-2 border-gray-200 w-64 text-center uppercase tracking-tighter">Authorized Signatory</p>
          </div>
        </div>

        {/* Terms and Conditions Section */}
        <div className="text-[10px] leading-relaxed text-gray-600 border-t border-gray-100 pt-6 font-bold">
          <p className="font-black text-[11px] mb-2 text-black uppercase underline">Terms and Conditions:</p>
          <ul className="list-none space-y-1">
            <li>* Order Confirmation: Orders will be confirmed only after the payment is received.</li>
            <li>* Customized products cannot be cancelled, returned, or refunded once production has started.</li>
            <li>* Customization Approval: Customers must verify and approve all customization details (name, photo, spelling, design, quantity) before production. Sabi Return Gifts will not be responsible for errors approved by the customer.</li>
            <li>* Delivery & Dispatch: Delivery timelines depend on order quantity and customization requirements. Sabi Return Gifts will not be responsible for delays caused by courier or third-party delivery services.</li>
            <li>* All India Delivery: Delivery is available across Chennai and all over India. Shipping charges may apply depending on location and order size.</li>
            <li>* Damage During Transit: Any issues must be reported within 24 hours of delivery with photo proof.</li>
            <li>* Sabi Return Gifts is not responsible for courier delays or transit damages.</li>
            <li>* For orders with advance payment, the balance amount must be paid before delivery or dispatch.</li>
          </ul>
        </div>

      </div>
    </div>
  );
}
