import { describe, expect, it } from "vitest";
import { estimateMatrix } from "@/lib/geo";
import {
  bruteForceOrder,
  evaluateOrder,
  isPrecedence,
  optimize,
  swapNeighbor,
  tourDrive,
  type OptimizeInput,
  type OptimizeStop,
} from "@/lib/optimizer";
import { parseStopSheet } from "@/lib/parser";
import type { WhenHint } from "@/lib/types";

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function instance(seed: number, count: number, withWindows: boolean): OptimizeInput {
  const rand = mulberry32(seed);
  const points = [{ lat: 32.17, lng: 34.9 }];
  for (let index = 0; index < count; index += 1) {
    points.push({ lat: 32.05 + rand() * 0.45, lng: 34.7 + rand() * 0.35 });
  }
  points.push({ lat: 32.18 + rand() * 0.04, lng: 34.88 + rand() * 0.04 });
  const matrix = estimateMatrix(points);
  const stops: OptimizeStop[] = Array.from({ length: count }, (_, index) => {
    const roll = rand();
    const when: WhenHint = roll < 0.25 ? "early" : roll < 0.45 ? "late" : "";
    const window =
      withWindows && rand() < 0.55
        ? { to: minutesToClock(6 * 60 + 40 + Math.floor(rand() * 240)) }
        : undefined;
    return { name: `s${index}`, address: `a${index}`, when, window };
  });
  return {
    durationsMin: matrix.durationsMin,
    distancesKm: matrix.distancesKm,
    stops,
    departureMinutes: 6 * 60,
    dwellMinutes: rand() < 0.5 ? 0 : 5,
  };
}

function minutesToClock(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function square(rows: number[][]): number[][] {
  return rows.map((row) => row.slice());
}

describe("exact optimizer", () => {
  it("matches brute force on random instances up to 8 stops", () => {
    const cases = [
      ...[4, 5, 6, 7].flatMap((count) =>
        [1, 2, 3, 4].map((seed) => instance(seed * 17 + count, count, false)),
      ),
      ...[5, 6, 7, 8].map((count) => instance(100 + count, count, true)),
      instance(8, 8, false),
      instance(9, 8, true),
    ];
    for (const input of cases) {
      const exact = optimize(input);
      const brute = bruteForceOrder(input);
      expect(exact.solver).toBe("exact");
      expect(isPrecedence(exact.order, input.stops)).toBe(true);
      expect(tourDrive(input.durationsMin, exact.order)).toBeCloseTo(
        tourDrive(input.durationsMin, brute),
        6,
      );
    }
  });

  it("keeps early stops before others and late stops after all", () => {
    const durations = square([
      [0, 20, 10, 3, 15],
      [20, 0, 12, 18, 22],
      [10, 12, 0, 8, 11],
      [3, 18, 8, 0, 6],
      [15, 22, 11, 6, 0],
    ]);
    const input: OptimizeInput = {
      durationsMin: durations,
      distancesKm: durations,
      stops: [
        { name: "מוקדם", address: "a", when: "early" },
        { name: "רגיל", address: "b", when: "" },
        { name: "מאוחר", address: "c", when: "late" },
      ],
      departureMinutes: 6 * 60,
      dwellMinutes: 0,
    };
    expect(optimize(input).order).toEqual([0, 1, 2]);
  });

  it("meets a deadline even when that tour is longer", () => {
    const input: OptimizeInput = {
      durationsMin: square([
        [0, 10, 4, 30],
        [10, 0, 10, 4],
        [4, 10, 0, 4],
        [30, 4, 4, 0],
      ]),
      distancesKm: square([
        [0, 5, 2, 12],
        [5, 0, 5, 2],
        [2, 5, 0, 2],
        [12, 2, 2, 0],
      ]),
      stops: [
        { name: "א", address: "a", when: "", window: { to: "00:12" } },
        { name: "ב", address: "b", when: "" },
      ],
      departureMinutes: 0,
      dwellMinutes: 0,
    };
    expect(optimize(input).order).toEqual([0, 1]);
    expect(tourDrive(input.durationsMin, [0, 1])).toBe(24);
    expect(tourDrive(input.durationsMin, [1, 0])).toBe(18);
  });

  it("puts a stop with אחרי 12:00 at the end and warns if the clock is missed", () => {
    const input: OptimizeInput = {
      durationsMin: square([
        [0, 8, 4, 6],
        [8, 0, 5, 7],
        [4, 5, 0, 3],
        [6, 7, 3, 0],
      ]),
      distancesKm: square([
        [0, 3, 1, 2],
        [3, 0, 2, 3],
        [1, 2, 0, 1],
        [2, 3, 1, 0],
      ]),
      stops: [
        { name: "רגיל", address: "כפר סבא", when: "" },
        { name: "מאוחר", address: "כפר סבא", when: "late", window: { from: "12:00" } },
      ],
      departureMinutes: 6 * 60,
      dwellMinutes: 0,
    };
    const order = optimize(input).order;
    expect(order[order.length - 1]).toBe(1);
    const evaluation = evaluateOrder({ ...input, order });
    const lateLeg = evaluation.legs[order.indexOf(1)];
    expect(lateLeg.waitMinutes).toBeGreaterThan(0);
    expect(lateLeg.eta).toBe("12:00");
    expect(evaluation.warnings.some((warning) => warning.includes("מוקדמת"))).toBe(false);
  });

  it("waits until a note window opens and still warns when a deadline is missed", () => {
    const input: OptimizeInput = {
      durationsMin: square([
        [0, 10, 30, 10],
        [10, 0, 20, 15],
        [30, 20, 0, 12],
        [10, 15, 12, 0],
      ]),
      distancesKm: square([
        [0, 4, 12, 5],
        [4, 0, 8, 6],
        [12, 8, 0, 5],
        [5, 6, 5, 0],
      ]),
      stops: [
        { name: "אחרי הצהריים", address: "א", when: "late", window: { from: "12:00" } },
        { name: "עד עשר", address: "ב", when: "early", window: { to: "10:00" } },
      ],
      departureMinutes: 6 * 60,
      dwellMinutes: 0,
    };
    const waited = evaluateOrder({ ...input, order: [0, 1] });
    expect(waited.legs[0].waitMinutes).toBe(12 * 60 - (6 * 60 + 10));
    expect(waited.legs[0].eta).toBe("12:00");
    expect(waited.warnings.some((warning) => warning.includes("עד עשר"))).toBe(true);
    expect(waited.warnings.some((warning) => warning.includes("מוקדמת"))).toBe(false);

    const onTime = evaluateOrder({
      ...input,
      stops: [{ name: "מוקדם", address: "א", when: "early", window: { to: "07:00" } }],
      order: [0],
    });
    expect(onTime.warnings).toEqual([]);
    expect(onTime.legs[0].waitMinutes).toBe(0);
  });

  it("does not zigzag between two distant clusters", () => {
    const start = { lat: 32, lng: 34 };
    const end = { lat: 32.2, lng: 34.2 };
    const clusterA = [
      { lat: 32.01, lng: 34.01 },
      { lat: 32.012, lng: 34.008 },
      { lat: 32.008, lng: 34.014 },
    ];
    const clusterB = [
      { lat: 32.19, lng: 34.19 },
      { lat: 32.192, lng: 34.188 },
      { lat: 32.188, lng: 34.194 },
    ];
    const points = [start, ...clusterA, ...clusterB, end];
    const matrix = estimateMatrix(points);
    const input: OptimizeInput = {
      durationsMin: matrix.durationsMin,
      distancesKm: matrix.distancesKm,
      stops: points.slice(1, -1).map((_, index) => ({
        name: index < 3 ? `a${index}` : `b${index}`,
        address: index < 3 ? "א" : "ב",
        when: "" as const,
      })),
      departureMinutes: 6 * 60,
      dwellMinutes: 0,
    };
    const order = optimize(input).order;
    const clusters = order.map((index) => (index < 3 ? "A" : "B"));
    const switches = clusters.slice(1).filter((cluster, index) => cluster !== clusters[index]).length;
    expect(switches).toBe(1);
    expect(tourDrive(input.durationsMin, order)).toBeCloseTo(
      tourDrive(input.durationsMin, bruteForceOrder(input)),
      6,
    );
  });

  it("respects a custom end that is far from the start", () => {
    const input: OptimizeInput = {
      durationsMin: square([
        [0, 5, 30, 40],
        [5, 0, 28, 38],
        [30, 28, 0, 4],
        [40, 38, 4, 0],
      ]),
      distancesKm: square([
        [0, 2, 20, 28],
        [2, 0, 18, 26],
        [20, 18, 0, 2],
        [28, 26, 2, 0],
      ]),
      stops: [
        { name: "קרוב למוצא", address: "כפר סבא", when: "" },
        { name: "קרוב ליעד", address: "נתניה", when: "" },
      ],
      departureMinutes: 6 * 60,
      dwellMinutes: 0,
    };
    expect(optimize(input).order).toEqual([0, 1]);
  });

  it("recomputes legs immediately after a neighbor swap", () => {
    const input: OptimizeInput = {
      durationsMin: square([
        [0, 10, 4, 8, 12],
        [10, 0, 6, 9, 7],
        [4, 6, 0, 5, 11],
        [8, 9, 5, 0, 3],
        [12, 7, 11, 3, 0],
      ]),
      distancesKm: square([
        [0, 6, 2, 5, 8],
        [6, 0, 3, 4, 4],
        [2, 3, 0, 2,5, 6],
        [5, 4, 2.5, 0, 1.5],
        [8, 4, 6, 1.5, 0],
      ]),
      stops: [
        { name: "א", address: "a", when: "" },
        { name: "ב", address: "b", when: "" },
        { name: "ג", address: "c", when: "" },
      ],
      departureMinutes: 6 * 60,
      dwellMinutes: 0,
    };
    const order = optimize(input).order;
    const swapped = swapNeighbor(order, 0, 1);
    const before = evaluateOrder({ ...input, order });
    const after = evaluateOrder({ ...input, order: swapped, manual: true });
    expect(swapped).not.toEqual(order);
    expect(after.legs).not.toEqual(before.legs);
    expect(after.totalMinutes).not.toBe(before.totalMinutes);
    expect(after.legs.reduce((sum, leg) => sum + leg.minutes, 0)).toBe(after.totalMinutes);
  });

  it("adds dwell to the finish time without changing driving minutes", () => {
    const input: OptimizeInput = {
      durationsMin: square([
        [0, 10, 12],
        [10, 0, 8],
        [12, 8, 0],
      ]),
      distancesKm: square([
        [0, 4, 5],
        [4, 0, 3],
        [5, 3, 0],
      ]),
      stops: [{ name: "א", address: "a", when: "" }],
      departureMinutes: 6 * 60,
      dwellMinutes: 0,
    };
    const still = evaluateOrder({ ...input, order: [0] });
    const withDwell = evaluateOrder({ ...input, order: [0], dwellMinutes: 15 });
    expect(withDwell.totalMinutes).toBe(still.totalMinutes);
    expect(withDwell.finishMinutes - still.finishMinutes).toBeCloseTo(15, 5);
  });

  it("solves 15 stops well under the time budget", () => {
    const input = instance(42, 15, true);
    const started = performance.now();
    const result = optimize(input);
    expect(performance.now() - started).toBeLessThan(5000);
    expect(result.order).toHaveLength(15);
    expect(isPrecedence(result.order, input.stops)).toBe(true);
    expect(result.solver).toBe("exact");
  });

  it("uses the heuristic above 15 stops and still respects early and late", () => {
    const input = instance(3, 16, false);
    input.stops[0].when = "early";
    input.stops[1].when = "late";
    const result = optimize(input);
    expect(result.solver).toBe("heuristic");
    expect(isPrecedence(result.order, input.stops)).toBe(true);
    expect(result.order.indexOf(0)).toBeLessThan(result.order.indexOf(1));
  });
});

describe("notes decide order, printed times do not", () => {
  it("puts עד 10:00 near the start and אחרי 12:00 near the end", () => {
    const stops = parseStopSheet(`
10:00  יוסי לוי, סוקולוב 5, הרצליה, עד 10:00
07:00  שרה לוי, ויצמן 5, כפר סבא, רק אחרי 12:00
08:00  דוד כהן, הרצל 10, נתניה
`);
    expect(stops.map((stop) => stop.when)).toEqual(["early", "late", ""]);
    expect(stops[0].window?.to).toBe("10:00");
    expect(stops[1].window?.from).toBe("12:00");
    expect(stops[2].window).toBeUndefined();
    expect(stops[0].note).toBe("עד 10:00");
    expect(stops[1].note).toContain("אחרי 12:00");
    expect(stops[2].note).not.toMatch(/\d{1,2}:\d{2}/);

    const points = [
      { lat: 32.177, lng: 34.907 },
      { lat: 32.167, lng: 34.841 },
      { lat: 32.176, lng: 34.908 },
      { lat: 32.328, lng: 34.86 },
      { lat: 32.178, lng: 34.91 },
    ];
    const matrix = estimateMatrix(points);
    const input: OptimizeInput = {
      durationsMin: matrix.durationsMin,
      distancesKm: matrix.distancesKm,
      stops,
      departureMinutes: 6 * 60,
      dwellMinutes: 0,
    };
    const order = optimize(input).order;
    expect(order[0]).toBe(0);
    expect(order[order.length - 1]).toBe(1);
    expect(order).not.toEqual([1, 2, 0]);
  });
});
