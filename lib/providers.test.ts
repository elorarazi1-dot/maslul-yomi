import { afterEach, describe, expect, it } from "vitest";
import { configuredVision } from "@/lib/providers";

const KEYS = ["VISION_PROVIDER", "GEMINI_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"] as const;

describe("vision provider", () => {
  const previous = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

  afterEach(() => {
    for (const key of KEYS) {
      if (previous[key] == null) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });

  it("prefers Gemini when GEMINI_API_KEY is set", () => {
    delete process.env.VISION_PROVIDER;
    process.env.GEMINI_API_KEY = "gemini";
    process.env.ANTHROPIC_API_KEY = "anthropic";
    process.env.OPENAI_API_KEY = "openai";
    expect(configuredVision()).toBe("gemini");
  });

  it("uses another provider only when Gemini is not configured", () => {
    delete process.env.VISION_PROVIDER;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    process.env.ANTHROPIC_API_KEY = "anthropic";
    process.env.OPENAI_API_KEY = "openai";
    expect(configuredVision()).toBe("anthropic");
  });
});