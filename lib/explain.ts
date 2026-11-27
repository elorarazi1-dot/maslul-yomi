import { cityOf } from "@/lib/cities";
import type { DistanceSource, SolverName, WhenHint } from "@/lib/types";

export interface ExplainStop {
  name: string;
  address: string;
  note: string;
  when: WhenHint;
  window?: { from?: string; to?: string };
}

export function buildExplanation(args: {
  orderedStops: ExplainStop[];
  distanceSource: DistanceSource;
  solver: SolverName;
  manual: boolean;
}): string {
  const lines: string[] = [];
  if (args.manual) {
    lines.push("הסדר עודכן ידנית. זמני הקטעים, הסיכום והמפה חושבו מחדש לפי הסדר שבחרתם.");
  } else if (args.solver === "exact") {
    lines.push("הסדר נבחר כך שזמן הנהיגה הכולל יהיה הקצר ביותר: מהמוצא, דרך כל תחנה פעם אחת, ואל היעד.");
  } else {
    lines.push("יש יותר מ-15 תחנות, ולכן הסדר מחושב בקירוב (שכן קרוב ואז שיפור המסלול), עם אותם כללי זמן.");
  }

  const early = args.orderedStops.filter((stop) => stop.when === "early");
  const late = args.orderedStops.filter((stop) => stop.when === "late");
  if (early.length) {
    lines.push(`הוקדמו בגלל הערה כתובה: ${early.map(labelConstraint).join(", ")}.`);
  }
  if (late.length) {
    lines.push(`נדחו לסוף המסלול בגלל הערה כתובה: ${late.map(labelConstraint).join(", ")}.`);
  }
  if (!early.length && !late.length) {
    lines.push("אין הערות שעה שמשנות את הסדר. שעות שמודפסות בצד הדף לא נלקחות בחשבון.");
  } else {
    lines.push("שעות שמודפסות בעמודה צדדית לא קובעות את הסדר — רק מה שנכתב כהערה על התחנה.");
  }

  for (const item of findReturns(args.orderedStops)) {
    const name = item.name || item.address;
    if (item.note) {
      lines.push(`יש חזרה אל ${item.city} בתחנה «${name}» בגלל ההערה: «${item.note}».`);
    } else {
      lines.push(`המסלול חוזר אל ${item.city} כי כך זמן הנהיגה הכולל קצר יותר.`);
    }
  }

  if (args.distanceSource === "estimate") {
    lines.push(
      "המרחקים והזמנים משוערים: אין מפתח OpenRouteService. החישוב הוא מרחק אווירי כפול 1.35, במהירות 30 קמ״ש עד 10 ק״מ, 45 עד 30 ק״מ, ו-70 מעבר לזה (לפי מרחק הכביש המשוער).",
    );
  } else {
    lines.push("זמני הנסיעה לפי רשת הכבישים של OpenRouteService.");
  }

  return lines.join("\n");
}

function labelConstraint(stop: ExplainStop): string {
  const name = stop.name || stop.address;
  if (stop.window?.from && stop.window?.to) return `${name} (בין ${stop.window.from} ל-${stop.window.to})`;
  if (stop.window?.to) return `${name} (עד ${stop.window.to})`;
  if (stop.window?.from) return `${name} (אחרי ${stop.window.from})`;
  if (stop.when === "early") return `${name} (מוקדם)`;
  if (stop.when === "late") return `${name} (מאוחר)`;
  return name;
}

function findReturns(stops: ExplainStop[]): Array<ExplainStop & { city: string }> {
  const seen = new Set<string>();
  let previous = "";
  const returns: Array<ExplainStop & { city: string }> = [];
  for (const stop of stops) {
    const city = cityOf(stop.address);
    if (!city) continue;
    if (city !== previous) {
      if (seen.has(city)) returns.push({ ...stop, city });
      seen.add(city);
      previous = city;
    }
  }
  return returns;
}
