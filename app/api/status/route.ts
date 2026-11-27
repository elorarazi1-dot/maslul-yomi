import { passwordIsDefault } from "@/lib/auth";
import { configuredVision, geocoderMode, routingMode } from "@/lib/providers";

export async function GET() {
  const vision = configuredVision();
  return Response.json({
    vision: Boolean(vision),
    visionProvider: vision,
    geocoder: geocoderMode(),
    routing: routingMode(),
    passwordIsDefault: passwordIsDefault(),
  });
}
