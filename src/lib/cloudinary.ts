// Cloudinary Client Integration for SABI Return Gifts
// Uses unsigned upload preset configured in Cloudinary: "sabi retun gifts"

export const CLOUDINARY_UPLOAD_PRESET = "sabi retun gifts";

// Helper to convert File/Blob to Base64 Data URL
export const fileToBase64 = (file: File | Blob | string): Promise<string> => {
  if (typeof file === 'string') return Promise.resolve(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
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
  // NEVER show window.prompt to the user
  return "";
};

export const setCloudinaryCloudName = (cloudName: string) => {
  if (cloudName && cloudName.trim()) {
    localStorage.setItem("sabi_cloudinary_cloud_name", cloudName.trim());
  }
};

/**
 * Uploads a single image file (File, Blob, or base64) to Cloudinary
 * If Cloudinary is not configured or fails, falls back seamlessly to base64 Data URL (0 popups!)
 */
export const uploadToCloudinary = async (file: File | Blob | string): Promise<string> => {
  const cloudName = getCloudinaryCloudName();
  if (!cloudName) {
    // Seamless base64 fallback so image is saved and displayed immediately with NO popups!
    return fileToBase64(file);
  }

  try {
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      console.warn(`Cloudinary upload returned status ${response.status}, falling back to base64`);
      return fileToBase64(file);
    }

    const data = await response.json();
    return data.secure_url || data.url || (await fileToBase64(file));
  } catch (err) {
    console.warn("Cloudinary upload failed, falling back to base64:", err);
    return fileToBase64(file);
  }
};

/**
 * Uploads multiple image files in parallel
 * Returns an array of secure URLs or base64 data URLs
 */
export const uploadMultipleToCloudinary = async (files: FileList | File[]): Promise<string[]> => {
  const fileArray = Array.from(files);
  const uploadPromises = fileArray.map(file => uploadToCloudinary(file));
  return Promise.all(uploadPromises);
};
