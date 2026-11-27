export async function fileToPayload(file: File): Promise<{ base64: string; mediaType: string }> {
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("התמונה גדולה מדי. בחרו קובץ עד 8MB או הדביקו את הרשימה כטקסט.");
  }
  const isHeic = /heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
  if (isHeic) {
    return { base64: await blobToBase64(file), mediaType: file.type || "image/heic" };
  }
  const compressed = await compress(file);
  return { base64: await blobToBase64(compressed), mediaType: "image/jpeg" };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = () => reject(new Error("לא הצלחנו לקרוא את התמונה. נסו שוב."));
    reader.readAsDataURL(blob);
  });
}

async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const max = 1600;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  return blob ?? file;
}
