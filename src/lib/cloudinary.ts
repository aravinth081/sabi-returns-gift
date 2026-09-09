// Cloudinary Client Integration for SABI Return Gifts
// Uses unsigned upload preset configured in Cloudinary: "sabi retun gifts"

export const CLOUDINARY_UPLOAD_PRESET = "sabi retun gifts";
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

/**
 * Validates file type and size before any processing or upload
 */
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
    return { valid: false, error: "Only JPG, PNG, and WEBP formats are supported." };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: `File "${file.name}" exceeds the maximum allowed size of 10MB.` };
  }
  return { valid: true };
};

/**
 * Compresses and scales down an image on an offscreen canvas.
 * Keeps memory usage extremely low and caps fallback base64 payload under ~150KB,
 * completely preventing Firestore 1MB document limit exhaustion.
 */
export const compressImageForUpload = (
  file: File | Blob,
  maxDimension: number = 1200,
  quality: number = 0.8
): Promise<File | Blob> => {
  return new Promise((resolve) => {
    // If running in non-browser environment or file is not image, return as-is
    if (typeof window === "undefined" || !file.type.startsWith("image/")) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const fileName = file instanceof File ? file.name : "compressed-image.jpg";
              const compressedFile = new File([blob], fileName, {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};

// Helper to convert File/Blob to Base64 Data URL
export const fileToBase64 = async (file: File | Blob | string): Promise<string> => {
  if (typeof file === "string") return Promise.resolve(file);

  // Compress first so base64 data string remains tiny and safe for Firestore
  const compressed = await compressImageForUpload(file, 1000, 0.75);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(compressed);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

// Cloud Name can be set in .env as VITE_CLOUDINARY_CLOUD_NAME or saved in localStorage
export const getCloudinaryCloudName = (): string => {
  const envCloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  if (envCloudName && envCloudName.trim()) {
    return envCloudName.trim();
  }
  const saved = typeof window !== "undefined" ? localStorage.getItem("sabi_cloudinary_cloud_name") : null;
  if (saved && saved.trim()) {
    return saved.trim();
  }
  return "";
};

export const setCloudinaryCloudName = (cloudName: string) => {
  if (cloudName && cloudName.trim()) {
    localStorage.setItem("sabi_cloudinary_cloud_name", cloudName.trim());
  }
};

/**
 * Uploads a single image file (File, Blob, or base64) directly from browser to Cloudinary.
 * Validates, compresses, and handles network fallback with zero UI popups.
 */
export const uploadToCloudinary = async (file: File | Blob | string): Promise<string> => {
  if (file instanceof File) {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
  }

  const cloudName = getCloudinaryCloudName();
  if (!cloudName) {
    // Seamless compressed base64 fallback so image is saved and displayed immediately with NO popups!
    return fileToBase64(file);
  }

  try {
    const fileToUpload = file instanceof File || file instanceof Blob ? await compressImageForUpload(file) : file;

    const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    const formData = new FormData();
    formData.append("file", fileToUpload);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      console.warn(`Cloudinary upload returned status ${response.status}, falling back to compressed base64`);
      return fileToBase64(file);
    }

    const data = await response.json();
    return data.secure_url || data.url || (await fileToBase64(file));
  } catch (err) {
    console.warn("Cloudinary upload failed, falling back to compressed base64:", err);
    return fileToBase64(file);
  }
};

/**
 * Uploads multiple image files in parallel with validation and compression
 */
export const uploadMultipleToCloudinary = async (files: FileList | File[]): Promise<string[]> => {
  const fileArray = Array.from(files);
  const uploadPromises = fileArray.map((file) => uploadToCloudinary(file));
  return Promise.all(uploadPromises);
};
