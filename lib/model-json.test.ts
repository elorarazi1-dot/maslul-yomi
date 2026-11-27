import { describe, expect, it } from "vitest";
import { parseModelStops } from "@/lib/model-json";

describe("vision JSON", () => {
  it("derives time windows from the note and drops a bare printed time", () => {
    const stops = parseModelStops(`\`\`\`json
{"stops":[
  {"name":"א","address":"ויצמן 1, כפר סבא","note":"08:30","contact":"","phone":""},
  {"name":"ב","address":"הרצל 2, נתניה","note":"רק אחרי 12:00","contact":"דנה","phone":"052-1112233"}
]}
\`\`\``);
    expect(stops).toHaveLength(2);
    expect(stops[0].note).toBe("");
    expect(stops[0].when).toBe("");
    expect(stops[1].when).toBe("late");
    expect(stops[1].window).toEqual({ from: "12:00" });
    expect(stops[1].note).toBe("רק אחרי 12:00");
  });
});
