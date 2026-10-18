import { toast } from 'sonner';

export interface ProductCardData {
  id?: string;
  fireId?: string;
  name?: string;
  price?: number | string;
  sellingPrice?: number | string;
  wholesalePrice?: number | string;
  category?: string;
  sku?: string;
  type?: string;
  description?: string;
  image?: string;
  images?: string[];
}

/**
 * Generates an 800px high-resolution composite Product Card image on HTML5 Canvas.
 * Combines the product photo with the Product Name, Price badge, Category, SKU, and full Description.
 * When pasted in WhatsApp, Discord, or any photo-receiving app, the recipient sees both the photo
 * AND the complete product details right on the image!
 */
export const createProductCardBlob = async (prod: ProductCardData): Promise<Blob> => {
  const mainImage = (prod.images && prod.images.length > 0) ? prod.images[0] : (prod.image || '');
  const name = prod.name ? String(prod.name).trim() : 'Product';
  const sellPrice = Number(prod.price ?? prod.sellingPrice) || 0;
  const category = (prod.category && prod.category !== 'Unassigned') ? String(prod.category).trim() : '';
  const sku = prod.sku ? String(prod.sku).trim() : '';
  const type = prod.type ? String(prod.type).trim() : '';
  const rawDescription = typeof prod.description === 'string' ? prod.description.trim() : '';

  // 1. Attempt to load the product image
  let img: HTMLImageElement | null = null;
  if (mainImage) {
    try {
      img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        if (mainImage.startsWith('http://') || mainImage.startsWith('https://')) {
          image.crossOrigin = 'anonymous';
        }
        image.onload = () => resolve(image);
        image.onerror = (err) => reject(err);
        image.src = mainImage;
      });
    } catch (e) {
      console.warn("Could not load image for product card:", e);
    }
  }

  // 2. Set canvas dimensions
  const cardWidth = 800;
  let imgHeight = 0;
  if (img) {
    const naturalW = img.naturalWidth || img.width || 800;
    const naturalH = img.naturalHeight || img.height || 600;
    imgHeight = Math.round(cardWidth * (naturalH / naturalW));
    if (imgHeight > 650) imgHeight = 650;
    if (imgHeight < 320) imgHeight = 320;
  } else {
    imgHeight = 180;
  }

  // 3. Helper to wrap text cleanly
  const testCanvas = document.createElement('canvas');
  const testCtx = testCanvas.getContext('2d')!;

  const wrapText = (text: string, maxWidth: number, font: string): string[] => {
    testCtx.font = font;
    const lines: string[] = [];
    const paragraphs = text.split('\n');
    for (const para of paragraphs) {
      if (!para.trim()) {
        lines.push('');
        continue;
      }
      const words = para.split(/\s+/);
      let currentLine = words[0];
      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = testCtx.measureText(currentLine + ' ' + word).width;
        if (width < maxWidth) {
          currentLine += ' ' + word;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      lines.push(currentLine);
    }
    return lines;
  };

  // Wrap description
  const descLines = rawDescription ? wrapText(rawDescription, cardWidth - 84, '15px system-ui, -apple-system, sans-serif') : [];
  const displayedDescLines = descLines.slice(0, 8);
  if (descLines.length > 8 && displayedDescLines.length > 0) {
    displayedDescLines[displayedDescLines.length - 1] += '...';
  }

  const padding = 32;
  const headerHeight = 52;
  const metaHeight = (category || sku || type) ? 36 : 0;
  const descHeight = displayedDescLines.length > 0 ? (displayedDescLines.length * 24 + 36) : 0;
  const footerHeight = 44;
  const detailsHeight = padding + headerHeight + metaHeight + descHeight + footerHeight + padding;

  const totalHeight = imgHeight + detailsHeight;

  const canvas = document.createElement('canvas');
  canvas.width = cardWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // 4. Background
  ctx.fillStyle = '#0b1329';
  ctx.fillRect(0, 0, cardWidth, totalHeight);

  // 5. Draw Image
  if (img) {
    ctx.fillStyle = '#060d1f';
    ctx.fillRect(0, 0, cardWidth, imgHeight);

    try {
      const naturalW = img.naturalWidth || img.width;
      const naturalH = img.naturalHeight || img.height;
      const hRatio = cardWidth / naturalW;
      const vRatio = imgHeight / naturalH;
      const ratio = Math.min(hRatio, vRatio);
      const drawW = naturalW * ratio;
      const drawH = naturalH * ratio;
      const drawX = (cardWidth - drawW) / 2;
      const drawY = (imgHeight - drawH) / 2;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
    } catch (taintErr) {
      console.warn("Could not draw image due to CORS/taint:", taintErr);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, cardWidth, imgHeight);
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(name, cardWidth / 2, imgHeight / 2);
      ctx.textAlign = 'left';
    }
  } else {
    ctx.fillStyle = '#131e3a';
    ctx.fillRect(0, 0, cardWidth, imgHeight);
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎁 ' + name, cardWidth / 2, imgHeight / 2);
    ctx.textAlign = 'left';
  }

  // 6. Gradient accent line between photo and details
  const gradient = ctx.createLinearGradient(0, imgHeight, cardWidth, imgHeight);
  gradient.addColorStop(0, '#3b82f6');
  gradient.addColorStop(0.5, '#8b5cf6');
  gradient.addColorStop(1, '#ec4899');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, imgHeight - 3, cardWidth, 4);

  // 7. Details Section
  let currentY = imgHeight + padding + 6;

  // Title & Price Badge
  ctx.textAlign = 'left';
  const priceText = sellPrice > 0 ? `₹${sellPrice.toLocaleString()}` : '';
  ctx.font = 'bold 22px system-ui, sans-serif';
  const priceBadgeWidth = priceText ? ctx.measureText(priceText).width + 36 : 0;

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  let title = name;
  const maxTitleWidth = cardWidth - padding * 2 - priceBadgeWidth - 20;
  while (ctx.measureText(title).width > maxTitleWidth && title.length > 5) {
    title = title.slice(0, -1);
  }
  if (title.length < name.length) title += '...';
  ctx.fillText(title, padding, currentY);

  // Price Badge (Emerald Green pill)
  if (priceText) {
    const badgeX = cardWidth - padding - priceBadgeWidth;
    const badgeY = currentY - 26;
    const badgeH = 34;

    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, priceBadgeWidth, badgeH, 8);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(priceText, badgeX + priceBadgeWidth / 2, badgeY + 24);
    ctx.textAlign = 'left';
  }

  currentY += 34;

  // Meta pills: Category, SKU, Type
  if (category || sku || type) {
    let pillX = padding;
    const pills = [
      category ? { icon: '📂', label: category, bg: '#1e293b', text: '#38bdf8' } : null,
      sku ? { icon: '🏷️', label: `SKU: ${sku}`, bg: '#1e293b', text: '#cbd5e1' } : null,
      type ? { icon: '📦', label: type, bg: '#1e293b', text: '#a78bfa' } : null
    ].filter(Boolean) as { icon: string; label: string; bg: string; text: string }[];

    ctx.font = '600 13px system-ui, sans-serif';
    for (const pill of pills) {
      const fullText = `${pill.icon} ${pill.label}`;
      const textW = ctx.measureText(fullText).width;
      const pillW = textW + 20;
      const pillH = 26;

      ctx.fillStyle = pill.bg;
      ctx.beginPath();
      ctx.roundRect(pillX, currentY - 18, pillW, pillH, 6);
      ctx.fill();

      ctx.fillStyle = pill.text;
      ctx.fillText(fullText, pillX + 10, currentY);

      pillX += pillW + 10;
    }
    currentY += 28;
  }

  // Description Box
  if (displayedDescLines.length > 0) {
    currentY += 8;
    const boxY = currentY - 14;
    const boxH = displayedDescLines.length * 24 + 18;

    // Dark sleek container
    ctx.fillStyle = '#131e36';
    ctx.beginPath();
    ctx.roundRect(padding, boxY, cardWidth - padding * 2, boxH, 10);
    ctx.fill();

    // Blue left accent bar
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.roundRect(padding, boxY, 4, boxH, [10, 0, 0, 10]);
    ctx.fill();

    // Render description lines
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '15px system-ui, -apple-system, sans-serif';
    let lineY = boxY + 24;
    for (const line of displayedDescLines) {
      ctx.fillText(line, padding + 18, lineY);
      lineY += 24;
    }
    currentY = boxY + boxH + 18;
  }

  // Footer / Branding
  currentY += 12;
  ctx.fillStyle = '#475569';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('✨ Sabi Return Gifts Catalog', padding, currentY);

  ctx.textAlign = 'right';
  ctx.fillText('Ready for Customization & Orders', cardWidth - padding, currentY);

  // Return PNG Blob
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to create canvas blob'));
    }, 'image/png');
  });
};

/**
 * Build clean formatted text for plain text copying (WhatsApp, SMS, Notes)
 */
export const buildProductCleanText = (prod: ProductCardData): string => {
  const sellPrice = Number(prod.price ?? prod.sellingPrice) || 0;
  const category = (prod.category && prod.category !== 'Unassigned') ? String(prod.category).trim() : '';
  const sku = prod.sku ? String(prod.sku).trim() : '';
  const type = prod.type ? String(prod.type).trim() : '';
  const rawDescription = typeof prod.description === 'string' ? prod.description.trim() : '';
  const mainImage = (prod.images && prod.images.length > 0) ? prod.images[0] : (prod.image || '');

  return [
    prod.name ? `*${prod.name}*` : '',
    sellPrice ? `💰 Price: ₹${sellPrice}` : '',
    category ? `📂 Category: ${category}` : '',
    sku ? `🏷️ SKU: ${sku}` : '',
    type ? `📦 Type: ${type}` : '',
    rawDescription ? `📝 Description:\n${rawDescription}` : '',
    mainImage && (mainImage.startsWith('http://') || mainImage.startsWith('https://')) ? `🖼️ Image: ${mainImage}` : ''
  ].filter(Boolean).join('\n\n');
};

/**
 * 1. Copies the high-resolution Product Card image (Photo + Name + Price + Description on the card)
 *    along with rich HTML and formatted plain text.
 */
export const copyProductCard = async (prod: ProductCardData) => {
  if (!prod) return;
  const cleanText = buildProductCleanText(prod);

  try {
    const cardBlob = await createProductCardBlob(prod);
    let copied = false;

    if (navigator.clipboard && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': cardBlob,
            'text/plain': new Blob([cleanText], { type: 'text/plain' })
          })
        ]);
        copied = true;
      } catch (err) {
        console.warn("Direct multi-mime card write failed, trying fallback:", err);
      }
    }

    if (!copied && navigator.clipboard && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': cardBlob })
        ]);
        copied = true;
      } catch (e) {}
    }

    if (!copied) {
      await navigator.clipboard.writeText(cleanText);
    }

    toast.success("Product Card copied! (Photo with Name, Price & Description)");
  } catch (err) {
    console.error("Card copy failed:", err);
    try {
      await navigator.clipboard.writeText(cleanText);
      toast.success("Product details copied as text!");
    } catch {
      toast.error("Failed to copy product.");
    }
  }
};

/**
 * 2. Copies clean formatted text (Name, Price, SKU, Description, Image URL)
 *    Ideal for sending as a text message directly into WhatsApp chat.
 */
export const copyProductText = async (prod: ProductCardData) => {
  if (!prod) return;
  const cleanText = buildProductCleanText(prod);

  try {
    await navigator.clipboard.writeText(cleanText);
    toast.success("Product details copied as text! (Ready to paste in WhatsApp chat)");
  } catch (err) {
    console.error("Text copy failed:", err);
    toast.error("Failed to copy text.");
  }
};

/**
 * 3. Copies original raw photo only (without card overlay).
 */
export const copyProductRawImage = async (imageUrl: string) => {
  if (!imageUrl) {
    toast.error("No image available to copy.");
    return;
  }

  try {
    const img = new Image();
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }

    const blob = await new Promise<Blob>((resolve, reject) => {
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width || 400;
          canvas.height = img.naturalHeight || img.height || 400;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas context failed'));
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((b) => {
            if (b) resolve(b);
            else reject(new Error('Canvas toBlob failed'));
          }, 'image/png');
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageUrl;
    });

    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast.success("Raw photo copied to clipboard!");
    } else {
      await navigator.clipboard.writeText(imageUrl);
      toast.success("Photo URL copied!");
    }
  } catch (err) {
    console.error("Raw image copy failed:", err);
    try {
      await navigator.clipboard.writeText(imageUrl);
      toast.success("Photo URL copied!");
    } catch {
      toast.error("Failed to copy photo.");
    }
  }
};
