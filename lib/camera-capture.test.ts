import { describe, expect, it } from "vitest";
import {
  imageFileFromClipboard,
  isMobileCaptureDevice,
  photoExtractRequest,
  selectCaptureStrategy,
} from "@/lib/camera-capture";

describe("camera capture", () => {
  it("opens the rear camera file input on a phone", () => {
    expect(isMobileCaptureDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", false)).toBe(true);
    expect(selectCaptureStrategy({ mobile: true, liveCameraAvailable: true })).toBe("environment-file");
    expect(selectCaptureStrategy({ mobile: true, liveCameraAvailable: false })).toBe("environment-file");
  });

  it("uses a live camera on desktop and a file picker when no camera exists", () => {
    expect(isMobileCaptureDevice("Mozilla/5.0 (X11; Linux x86_64)", false)).toBe(false);
    expect(isMobileCaptureDevice("Mozilla/5.0 (X11; Linux x86_64)", true)).toBe(true);
    expect(selectCaptureStrategy({ mobile: false, liveCameraAvailable: true })).toBe("live-camera");
    expect(selectCaptureStrategy({ mobile: false, liveCameraAvailable: false })).toBe("file-picker");
  });

  it("submits a captured photo into the extraction request", () => {
    const body = photoExtractRequest({
      text: "",
      photo: { base64: "abc123", mediaType: "image/jpeg" },
      startLabel: "כפר סבא",
      endLabel: "כפר סבא",
    });
    expect(body).toEqual({
      text: "",
      imageBase64: "abc123",
      mediaType: "image/jpeg",
      startLabel: "כפר סבא",
      endLabel: "כפר סבא",
    });
  });

  it("reads an image from a clipboard paste and ignores plain text", () => {
    const photo = new File(["bytes"], "sheet.jpg", { type: "image/jpeg" });
    const file = imageFileFromClipboard([
      { type: "text/plain", getAsFile: () => null },
      { type: "image/jpeg", getAsFile: () => photo },
    ]);
    expect(file).toBe(photo);
    expect(imageFileFromClipboard([{ type: "text/plain", getAsFile: () => null }])).toBeNull();
  });
});
