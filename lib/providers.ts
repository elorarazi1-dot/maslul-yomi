export type VisionName = "anthropic" | "openai" | "gemini";

export function configuredVision(): VisionName | null {
  const forced = process.env.VISION_PROVIDER?.trim().toLowerCase();
  const anthropic = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const openai = Boolean(process.env.OPENAI_API_KEY?.trim());
  const gemini = Boolean(
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim(),
  );
  if (forced === "none") return null;
  if (forced === "gemini") return gemini ? "gemini" : null;
  if (forced === "anthropic") return anthropic ? "anthropic" : null;
  if (forced === "openai") return openai ? "openai" : null;
  if (gemini) return "gemini";
  if (anthropic) return "anthropic";
  if (openai) return "openai";
  return null;
}

export function routingMode(): "openrouteservice" | "estimate" {
  return process.env.ORS_API_KEY?.trim() ? "openrouteservice" : "estimate";
}

export function geocoderMode(): "google" | "nominatim" {
  return process.env.GOOGLE_MAPS_API_KEY?.trim() ? "google" : "nominatim";
}

export function geminiKey(): string {
  return process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() || "";
}
