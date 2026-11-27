export const MISSING_VISION_MESSAGE =
  "קריאת צילום או תמונה דורשת GEMINI_API_KEY בשרת (מפתח חינם ב-Google AI Studio). הדבקת טקסט ממשיכה לעבוד כרגיל, בלי מפתח.";

export type CaptureStrategy = "environment-file" | "live-camera" | "file-picker";

export function isMobileCaptureDevice(userAgent: string, coarsePointer: boolean): boolean {
  if (coarsePointer) return true;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
}

/** Phones open the rear camera through a file input. Desktops use a live camera, then a file picker. */
export function selectCaptureStrategy(input: {
  mobile: boolean;
  liveCameraAvailable: boolean;
}): CaptureStrategy {
  if (input.mobile) return "environment-file";
  if (input.liveCameraAvailable) return "live-camera";
  return "file-picker";
}

export interface PhotoPayload {
  base64: string;
  mediaType: string;
}

export function photoExtractRequest(input: {
  text: string;
  photo: PhotoPayload | null;
  startLabel: string;
  endLabel: string;
}) {
  return {
    text: input.text,
    imageBase64: input.photo?.base64,
    mediaType: input.photo?.mediaType,
    startLabel: input.startLabel,
    endLabel: input.endLabel,
  };
}

export function imageFileFromClipboard(
  items: Array<{ type: string; getAsFile: () => File | null }>,
): File | null {
  const image = items.find((item) => item.type.startsWith("image/"));
  return image?.getAsFile() ?? null;
}
