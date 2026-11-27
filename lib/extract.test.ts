import { afterEach, describe, expect, it } from "vitest";
import { MISSING_VISION_MESSAGE } from "@/lib/camera-capture";
import { extractStops } from "@/lib/extract";

const KEYS = ["VISION_PROVIDER", "GEMINI_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"] as const;

describe("photo extraction without a vision key", () => {
  const previous = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

  afterEach(() => {
    for (const key of KEYS) {
      if (previous[key] == null) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });

  function clearVisionKeys() {
    for (const key of KEYS) delete process.env[key];
  }

  it("explains in Hebrew that a photo needs GEMINI_API_KEY", async () => {
    clearVisionKeys();
    await expect(
      extractStops({ imageBase64: "abc123", mediaType: "image/jpeg" }),
    ).rejects.toThrow(MISSING_VISION_MESSAGE);
  });

  it("still parses pasted text when no vision key is configured", async () => {
    clearVisionKeys();
    const result = await extractStops({
      text: "דוד כהן — רחוב ויצמן 45, כפר סבא",
    });
    expect(result.extractor).toBe("heuristic");
    expect(result.stops[0]?.name).toBe("דוד כהן");
    expect(result.warnings).toEqual([]);
  });

  it("keeps pasted text and explains that the photo was not read", async () => {
    clearVisionKeys();
    const result = await extractStops({
      text: "דוד כהן — רחוב ויצמן 45, כפר סבא",
      imageBase64: "abc123",
      mediaType: "image/jpeg",
    });
    expect(result.extractor).toBe("heuristic");
    expect(result.stops[0]?.address).toContain("כפר סבא");
    expect(result.warnings).toEqual([MISSING_VISION_MESSAGE]);
  });
});
