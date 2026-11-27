import type { Evaluation, LegView, TimeWindow, WhenHint } from "@/lib/types";
import { formatClock, parseHHMM, roundKm, roundMinutes } from "@/lib/time";

export interface OptimizeStop {
  name: string;
  address: string;
  when: WhenHint;
  window?: TimeWindow;
}

export interface OptimizeInput {
  durationsMin: number[][];
  distancesKm: number[][];
  stops: OptimizeStop[];
  departureMinutes: number;
  dwellMinutes: number;
}

type WindowMode = "all" | "deadline" | "none";

export function groupRank(when: WhenHint): number {
  if (when === "early") return 0;
  if (when === "late") return 2;
  return 1;
}

export function optimize(input: OptimizeInput): { order: number[]; solver: "exact" | "heuristic" } {
  const count = input.stops.length;
  if (count === 0) return { order: [], solver: "exact" };
  if (count === 1) return { order: [0], solver: "exact" };
  if (count <= 15) return { order: solveExact(input), solver: "exact" };
  return { order: solveHeuristic(input), solver: "heuristic" };
}

export function bruteForceOrder(input: OptimizeInput): number[] {
  for (const mode of ["all", "deadline", "none"] as const) {
    const found = bruteMode(input, mode);
    if (found) return found;
  }
  return input.stops.map((_, index) => index);
}

export function tourDrive(durationsMin: number[][], order: number[]): number {
  const end = durationsMin.length - 1;
  let prev = 0;
  let drive = 0;
  for (const index of order) {
    drive += durationsMin[prev][index + 1];
    prev = index + 1;
  }
  return drive + durationsMin[prev][end];
}

export function isPrecedence(order: number[], stops: { when: WhenHint }[]): boolean {
  let last = -1;
  for (const index of order) {
    const rank = groupRank(stops[index].when);
    if (rank < last) return false;
    last = rank;
  }
  return true;
}

export function swapNeighbor(order: number[], index: number, direction: -1 | 1): number[] {
  const target = index + direction;
  if (target < 0 || target >= order.length) return order.slice();
  const next = order.slice();
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function evaluateOrder(args: {
  stops: OptimizeStop[];
  order: number[];
  durationsMin: number[][];
  distancesKm: number[][];
  departureMinutes: number;
  dwellMinutes: number;
  manual?: boolean;
}): Evaluation {
  const { stops, order, durationsMin, distancesKm, departureMinutes, dwellMinutes } = args;
  const end = durationsMin.length - 1;
  const legs: LegView[] = [];
  const arrivals: number[] = [];
  let prev = 0;
  let clock = departureMinutes;
  let totalMinutes = 0;
  let totalKmTenths = 0;
  let finishMinutes = departureMinutes;

  for (let hop = 0; hop <= order.length; hop += 1) {
    const isEnd = hop === order.length;
    const nextIndex = isEnd ? end : order[hop] + 1;
    const legMinutes = durationsMin[prev][nextIndex] ?? 0;
    const legKm = distancesKm[prev][nextIndex] ?? 0;
    const arrival = clock + legMinutes;
    let wait = 0;
    let ready = arrival;
    if (!isEnd) {
      const from = stops[order[hop]].window?.from ? parseHHMM(stops[order[hop]].window?.from) : null;
      if (from != null && arrival < from) {
        wait = from - arrival;
        ready = from;
      }
      arrivals.push(ready);
      clock = ready + dwellMinutes;
    } else {
      finishMinutes = arrival;
    }
    const shownMinutes = roundMinutes(legMinutes);
    const shownKm = roundKm(legKm);
    totalMinutes += shownMinutes;
    totalKmTenths += Math.round(shownKm * 10);
    legs.push({
      minutes: shownMinutes,
      km: shownKm,
      eta: formatClock(isEnd ? arrival : ready),
      waitMinutes: roundWait(wait),
    });
    prev = nextIndex;
  }

  const warnings: string[] = [];
  if (args.manual && !isPrecedence(order, stops)) {
    warnings.push(
      "הסדר שונה ידנית, ולכן תחנה עם הערת מוקדם או מאוחר לא נמצאת במקום שההערה ביקשה.",
    );
  }
  order.forEach((stopIndex, visit) => {
    const stop = stops[stopIndex];
    const ready = arrivals[visit];
    const to = stop.window?.to ? parseHHMM(stop.window.to) : null;
    const who = stop.name || stop.address || `תחנה ${visit + 1}`;
    if (to != null && ready > to) {
      warnings.push(
        `לא ניתן לעמוד בחלון «עד ${stop.window?.to}» בתחנה ${who}. ההגעה המשוערת ${formatClock(ready)} מאוחרת מדי.`,
      );
    }
  });

  return {
    legs,
    totalMinutes,
    totalKm: totalKmTenths / 10,
    finishEta: legs.length ? legs[legs.length - 1].eta : formatClock(departureMinutes),
    finishMinutes,
    arrivals,
    warnings,
  };
}

function solveExact(input: OptimizeInput): number[] {
  for (const mode of ["all", "deadline", "none"] as const) {
    const order = heldKarp(input, mode);
    if (order) return order;
  }
  return input.stops.map((_, index) => index);
}

function solveHeuristic(input: OptimizeInput): number[] {
  for (const mode of ["all", "deadline", "none"] as const) {
    const seed = nearestNeighbor(input, mode);
    if (!seed) continue;
    return twoOpt(input, seed, mode);
  }
  return input.stops.map((_, index) => index);
}

function heldKarp(input: OptimizeInput, mode: WindowMode): number[] | null {
  const count = input.stops.length;
  const groups = input.stops.map((stop) => groupRank(stop.when));
  const required = groups.map((group) => {
    let mask = 0;
    for (let index = 0; index < count; index += 1) {
      if (groups[index] < group) mask |= 1 << index;
    }
    return mask;
  });
  const full = (1 << count) - 1;
  const durations = input.durationsMin;
  const end = count + 1;
  const dp = Array.from({ length: full + 1 }, () => {
    const row = new Float64Array(count);
    row.fill(Number.POSITIVE_INFINITY);
    return row;
  });
  const parent = Array.from({ length: full + 1 }, () => {
    const row = new Int16Array(count);
    row.fill(-1);
    return row;
  });

  const canVisit = (mask: number, index: number) => (mask & required[index]) === required[index];

  for (let index = 0; index < count; index += 1) {
    if (!canVisit(0, index)) continue;
    const drive = durations[0][index + 1];
    const arrival = input.departureMinutes + drive;
    if (!fits(arrival, input.stops[index].window, mode)) continue;
    dp[1 << index][index] = drive;
  }

  for (let mask = 1; mask <= full; mask += 1) {
    const visited = popcount(mask);
    for (let last = 0; last < count; last += 1) {
      const base = dp[mask][last];
      if (!Number.isFinite(base) || (mask & (1 << last)) === 0) continue;
      for (let next = 0; next < count; next += 1) {
        if (mask & (1 << next)) continue;
        if (!canVisit(mask, next)) continue;
        const drive = base + durations[last + 1][next + 1];
        const arrival = input.departureMinutes + drive + input.dwellMinutes * visited;
        if (!fits(arrival, input.stops[next].window, mode)) continue;
        const nextMask = mask | (1 << next);
        if (drive < dp[nextMask][next]) {
          dp[nextMask][next] = drive;
          parent[nextMask][next] = last;
        }
      }
    }
  }

  let best = Number.POSITIVE_INFINITY;
  let bestLast = -1;
  for (let last = 0; last < count; last += 1) {
    const drive = dp[full][last] + durations[last + 1][end];
    if (drive < best) {
      best = drive;
      bestLast = last;
    }
  }
  if (!Number.isFinite(best) || bestLast < 0) return null;

  const order: number[] = [];
  let mask = full;
  let current = bestLast;
  while (current !== -1) {
    order.push(current);
    const previous = parent[mask][current];
    mask &= ~(1 << current);
    current = previous;
  }
  order.reverse();
  return order.length === count ? order : null;
}

function bruteMode(input: OptimizeInput, mode: WindowMode): number[] | null {
  const count = input.stops.length;
  const groups = input.stops.map((stop) => groupRank(stop.when));
  const durations = input.durationsMin;
  const current: number[] = [];
  const used = new Array<boolean>(count).fill(false);
  let bestCost = Number.POSITIVE_INFINITY;
  let bestOrder: number[] | null = null;

  const missingLower = (group: number) => {
    for (let index = 0; index < count; index += 1) {
      if (groups[index] < group && !used[index]) return true;
    }
    return false;
  };

  const walk = (prevIndex: number, drive: number) => {
    if (drive >= bestCost) return;
    if (current.length === count) {
      const total = drive + durations[prevIndex][count + 1];
      if (total < bestCost) {
        bestCost = total;
        bestOrder = current.slice();
      }
      return;
    }
    for (let index = 0; index < count; index += 1) {
      if (used[index] || missingLower(groups[index])) continue;
      const nextDrive = drive + durations[prevIndex][index + 1];
      const arrival = input.departureMinutes + nextDrive + input.dwellMinutes * current.length;
      if (!fits(arrival, input.stops[index].window, mode)) continue;
      used[index] = true;
      current.push(index);
      walk(index + 1, nextDrive);
      current.pop();
      used[index] = false;
    }
  };

  walk(0, 0);
  return bestOrder;
}

function nearestNeighbor(input: OptimizeInput, mode: WindowMode): number[] | null {
  const count = input.stops.length;
  const groups = input.stops.map((stop) => groupRank(stop.when));
  const used = new Array<boolean>(count).fill(false);
  const order: number[] = [];
  let prev = 0;
  let drive = 0;
  for (let step = 0; step < count; step += 1) {
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < count; index += 1) {
      if (used[index]) continue;
      if (groups.some((group, other) => group < groups[index] && !used[other])) continue;
      const distance = input.durationsMin[prev][index + 1];
      const arrival = input.departureMinutes + drive + distance + input.dwellMinutes * step;
      if (!fits(arrival, input.stops[index].window, mode)) continue;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    if (bestIndex < 0) return null;
    used[bestIndex] = true;
    order.push(bestIndex);
    drive += bestDistance;
    prev = bestIndex + 1;
  }
  return order;
}

function twoOpt(input: OptimizeInput, seed: number[], mode: WindowMode): number[] {
  let best = seed.slice();
  let bestCost = score(input, best, mode);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i += 1) {
      for (let k = i + 1; k < best.length; k += 1) {
        const next = best.slice();
        reverseRange(next, i, k);
        if (!isPrecedence(next, input.stops)) continue;
        const cost = score(input, next, mode);
        if (cost + 1e-9 < bestCost) {
          best = next;
          bestCost = cost;
          improved = true;
        }
      }
    }
  }
  return best;
}

function score(input: OptimizeInput, order: number[], mode: WindowMode): number {
  if (!tourFits(input, order, mode)) return Number.POSITIVE_INFINITY;
  return tourDrive(input.durationsMin, order);
}

function tourFits(input: OptimizeInput, order: number[], mode: WindowMode): boolean {
  let prev = 0;
  let drive = 0;
  for (let visit = 0; visit < order.length; visit += 1) {
    const index = order[visit];
    drive += input.durationsMin[prev][index + 1];
    const arrival = input.departureMinutes + drive + input.dwellMinutes * visit;
    if (!fits(arrival, input.stops[index].window, mode)) return false;
    prev = index + 1;
  }
  return true;
}

function fits(arrival: number, window: TimeWindow | undefined, mode: WindowMode): boolean {
  if (mode === "none" || !window) return true;
  const to = window.to ? parseHHMM(window.to) : null;
  // Arriving before window.from is handled by waiting, so it does not reject a tour.
  if (to != null && arrival - 1e-6 > to) return false;
  return true;
}

function roundWait(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return Math.max(1, Math.round(minutes));
}

function popcount(value: number): number {
  let count = 0;
  let rest = value;
  while (rest) {
    rest &= rest - 1;
    count += 1;
  }
  return count;
}

function reverseRange(values: number[], start: number, end: number) {
  let left = start;
  let right = end;
  while (left < right) {
    [values[left], values[right]] = [values[right], values[left]];
    left += 1;
    right -= 1;
  }
}
