import { describe, expect, it } from "vitest";
import { addressQueries, classifyResults, lookupKnown, normalizeAddress } from "@/lib/address";
import { estimateLeg } from "@/lib/geo";
import { formatAddressList, googleMapsLinks, wazeLink } from "@/lib/links";
import { phoneToTel } from "@/lib/phone";
import { interpretNote, parseStopSheet, stripMarginTimes } from "@/lib/parser";
import { SAMPLE_SHEET } from "@/lib/sample";

describe("Hebrew stop sheet parser", () => {
  it("parses the demo sheet into five realistic stops", () => {
    const stops = parseStopSheet(SAMPLE_SHEET);
    expect(stops).toHaveLength(5);
    expect(stops.map((stop) => stop.name)).toEqual([
      "מכולת ברק",
      "מרפאת שרון",
      "סטודיו גל",
      "מחסני דן",
      "אלקטרו-שירות",
    ]);
    expect(stops.map((stop) => stop.address)).toEqual([
      "רחוב ויצמן 52, כפר סבא",
      "רחוב אחוזה 126, רעננה",
      "רחוב סוקולוב 18, הרצליה",
      "ז'בוטינסקי 72, פתח תקווה",
      "רחוב הרצל 48, נתניה",
    ]);
    expect(stops[0]).toMatchObject({
      contact: "משה",
      phone: "052-1112233",
      note: "בבוקר, להיכנס מהחניה האחורית",
      when: "early",
    });
    expect(stops[1]).toMatchObject({
      phone: "09-7654321",
      contact: "",
      note: "עד 10:00",
      when: "early",
      window: { to: "10:00" },
    });
    expect(stops[2]).toMatchObject({
      contact: "רונית",
      phone: "054-3332211",
      note: "להתקשר 10 דקות לפני",
      when: "",
    });
    expect(stops[3]).toMatchObject({
      note: "רק אחרי 12:00",
      when: "late",
      window: { from: "12:00" },
    });
    expect(stops[4]).toMatchObject({
      contact: "אבי",
      phone: "053-9998877",
      note: "בסוף היום, קומה 2",
      when: "late",
    });
  });

  it("copies a free-text note verbatim and ignores a side-column time", () => {
    const [stop] = parseStopSheet(`08:30    דוד כהן — רחוב ויצמן 45, כפר סבא
רק אחרי 12:00, לבקש את דוד במחסן`);
    expect(stop.note).toBe("רק אחרי 12:00, לבקש את דוד במחסן");
    expect(stop.when).toBe("late");
    expect(stop.window).toEqual({ from: "12:00" });
    expect(stop.name).toBe("דוד כהן");
    expect(stripMarginTimes("09:15    אחוזה 88, רעננה")).toBe("אחוזה 88, רעננה");
  });

  it("drops a line that is only a printed time", () => {
    const [stop] = parseStopSheet(`08:30
דוד כהן, ויצמן 45, כפר סבא`);
    expect(stop.name).toBe("דוד כהן");
    expect(stop.note).toBe("");
    expect(stop.when).toBe("");
  });

  it("reads explicit windows and day-part hints", () => {
    expect(interpretNote("רק אחרי 12:00")).toEqual({ when: "late", window: { from: "12:00" } });
    expect(interpretNote("עד 10:00")).toEqual({ when: "early", window: { to: "10:00" } });
    expect(interpretNote("בבוקר")).toEqual({ when: "early" });
    expect(interpretNote("בסוף היום")).toEqual({ when: "late" });
    expect(interpretNote("בין 09:00 ל-11:30")).toEqual({
      when: "",
      window: { from: "09:00", to: "11:30" },
    });
    expect(interpretNote("להתקשר 10 דקות לפני").window).toBeUndefined();
  });
});

describe("estimate, links, and phones", () => {
  it("scales haversine by 1.35 and picks speed from the road distance", () => {
    expect(estimateLeg(5).km).toBeCloseTo(6.75);
    expect(estimateLeg(5).minutes).toBeCloseTo((6.75 / 30) * 60);
    expect(estimateLeg(8).km).toBeCloseTo(10.8);
    expect(estimateLeg(8).minutes).toBeCloseTo((10.8 / 45) * 60);
    expect(estimateLeg(30).minutes).toBeCloseTo((40.5 / 70) * 60);
  });

  it("splits Google Maps links above 9 waypoints", () => {
    const points = Array.from({ length: 12 }, (_, index) => ({ lat: 32 + index * 0.01, lng: 34.8 }));
    const links = googleMapsLinks(points);
    expect(links.length).toBe(2);
    expect(links[0]).toContain("travelmode=driving");
    expect(links[0]).toContain("%7C");
    const waypoints = new URL(links[0]).searchParams.get("waypoints") ?? "";
    expect(waypoints.split("|")).toHaveLength(9);
    expect(googleMapsLinks(points.slice(0, 11))).toHaveLength(1);
  });

  it("builds a Waze link and a numbered address list", () => {
    expect(wazeLink({ lat: 32.1, lng: 34.8, address: "ויצמן" })).toBe(
      "https://waze.com/ul?ll=32.1,34.8&navigate=yes",
    );
    expect(wazeLink({ lat: null, lng: null, address: "ויצמן 1, כפר סבא" })).toContain(
      encodeURIComponent("ויצמן 1, כפר סבא"),
    );
    expect(formatAddressList([{ address: "א", name: "x" }, { address: "", name: "ב" }])).toBe(
      "1. א\n2. ב",
    );
  });

  it("keeps only digits and a leading plus in tel links", () => {
    expect(phoneToTel("052-1112233")).toBe("0521112233");
    expect(phoneToTel("+972-52-111-2233")).toBe("+972521112233");
    expect(phoneToTel("052-1112233, 09-7654321")).toBe("0521112233");
  });

  it("normalizes addresses and simplifies Hebrew queries", () => {
    expect(normalizeAddress("  רחוב  ויצמן 52 ,  כפר סבא ")).toBe("רחוב ויצמן 52, כפר סבא");
    expect(addressQueries("רחוב ויצמן 52, כפר סבא")).toEqual([
      "רחוב ויצמן 52, כפר סבא",
      "ויצמן 52, כפר סבא",
      "ויצמן, כפר סבא",
    ]);
    expect(lookupKnown("רחוב ויצמן 52, כפר סבא")?.lat).toBeCloseTo(32.1755, 3);
  });

  it("marks far apart geocoding hits as ambiguous", () => {
    const missing = classifyResults([], () => true, () => 0);
    expect(missing.status).toBe("missing");
    const ambiguous = classifyResults(
      [
        { lat: 32.17, lng: 34.9, label: "כפר סבא", importance: 0.4 },
        { lat: 32.08, lng: 34.78, label: "תל אביב", importance: 0.4 },
      ],
      () => true,
      () => 12,
    );
    expect(ambiguous.status).toBe("ambiguous");
    expect(ambiguous.candidates).toHaveLength(2);
  });
});
