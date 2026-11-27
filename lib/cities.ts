/** Longer names first so "פתח תקווה" wins over shorter fragments. */
export const ISRAELI_CITIES = [
  "מודיעין-מכבים-רעות",
  "מודיעין מכבים רעות",
  "תל אביב-יפו",
  "הרצליה פיתוח",
  "קרית מוצקין",
  "קריית מוצקין",
  "קרית ביאליק",
  "קריית ביאליק",
  "קרית שמונה",
  "קריית שמונה",
  "ראשון לציון",
  "פתח תקווה",
  "פתח-תקווה",
  "גבעת שמואל",
  "אור יהודה",
  "הוד השרון",
  "רמת השרון",
  "כפר סבא",
  "כפר יונה",
  "ראש העין",
  "בני ברק",
  "נס ציונה",
  "באר שבע",
  "תל אביב",
  "רמת גן",
  "גבעתיים",
  "קרית אונו",
  "קריית אונו",
  "קרית גת",
  "קריית גת",
  "קרית אתא",
  "קריית אתא",
  "קרית ים",
  "קריית ים",
  "רעננה",
  "הרצליה",
  "נתניה",
  "ירושלים",
  "אשקלון",
  "רחובות",
  "חדרה",
  "חיפה",
  "חולון",
  "בת ים",
  "אשדוד",
  "מודיעין",
  "רמלה",
  "יהוד",
  "לוד",
  "אילת",
  "טבריה",
  "עפולה",
  "נצרת",
].sort((a, b) => b.length - a.length);

export function cityOf(address: string): string {
  const haystack = address.replace(/[-–]/g, " ");
  for (const city of ISRAELI_CITIES) {
    if (haystack.includes(city)) return city;
  }
  return "";
}

export function containsCity(text: string): boolean {
  return cityOf(text) !== "";
}
