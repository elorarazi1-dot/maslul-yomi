# מסלול יומי

תכנון מסלול נהיגה יומי לבעל עסק שנוסע בין הרבה תחנות, ולמזכירה שלו. הממשק בעברית, מימין לשמאל, מותאם לטלפון ולמחשב.

הסדר נקבע בקוד לפי זמן נהיגה, לא לפי שעות שמודפסות בצד הדף. הערה כתובה כמו «עד 10:00» או «רק אחרי 12:00» כן משנה את הסדר. אם מגיעים לפני שחלון ההערה נפתח, המסלול ממתין עד השעה ורושם «המתנה X דק׳». איחור אחרי «עד 10:00» עדיין מוצג כאזהרה.

# Daily route planner

A Hebrew, right-to-left route planner for an Israeli business owner and the secretary who prepares the day. Phone first, comfortable on a desktop.

The visit order is computed in code from driving time. Clock times printed in a margin are ignored. A written note such as «עד 10:00» or «רק אחרי 12:00» does change the order. If the driver arrives before a note window opens, the route waits until that time and shows «המתנה X דק׳». A missed deadline such as «עד 10:00» is still a warning.

## הרצה מקומית / Run locally

```bash
npm install
npm run dev
```

האתר עולה על [http://127.0.0.1:3847](http://127.0.0.1:3847).

בלי משתני סביבה סיסמת ההדגמה היא `demo`. טקסט מודבק מפוענח במפרש עברי מקומי, כתובות עוברות דרך Nominatim, ומרחקים מסומנים כאומדן. צילום דף בלי מפתח מודל מציג הודעה בעברית ומבקש להדביק טקסט.

Without environment variables the demo password is `demo`. Pasted text uses the local Hebrew parser, addresses use Nominatim, and distances are labelled as estimates. A photo without a vision key shows a Hebrew message and asks for pasted text.

בדיקות:

```bash
npm test
npm run lint
```

## משתני סביבה / Environment

העתיקו את `.env.example` אל `.env.local`. המפתחות נשארים בשרת בלבד.

| משתנה | תפקיד |
| --- | --- |
| `APP_ACCESS_PASSWORD` | קוד גישה משותף לבעל העסק ולמזכירה |
| `GEMINI_API_KEY` | מודל ראייה מועדף לצילום הדף. חינם ב-AI Studio |
| `ANTHROPIC_API_KEY` | חלופה בתשלום |
| `OPENAI_API_KEY` | חלופה בתשלום |
| `VISION_PROVIDER` | `gemini`, `anthropic`, `openai` או `none` |
| `ORS_API_KEY` | זמני נסיעה וקו המסלול על הכביש |
| `GOOGLE_MAPS_API_KEY` | גיאוקודינג. בלי המפתח משתמשים ב-Nominatim |

## אילו מפתחות להוציא / Which keys to get

אפשר לעבוד בלי אף מפתח. כדי שצילום דף, כתובות עבריות וזמני כביש יהיו מדויקים:

1. **OpenRouteService** — זמני נהיגה אמיתיים. הרשמה חינם ב-[account.heigit.org](https://account.heigit.org/). במסלול Standard (0€) המכסה היומית היא בערך 500 בקשות Matrix ו-2,000 בקשות Directions. בדקו את המספרים ב-[עמוד התוכניות](https://account.heigit.org/info/plans). הקריאות יוצאות אל `api.heigit.org`.
2. **Google Geocoding** — מומלץ לכתובות בעברית. [יצירת מפתח](https://console.cloud.google.com/google/maps-apis/credentials) אחרי הפעלת Geocoding API וחשבון חיוב. יש 10,000 בקשות Geocoding חינם בחודש ([מחירון](https://developers.google.com/maps/billing-and-pricing/pricing)).
3. **Nominatim** — ברירת המחדל, בלי מפתח. לכל היותר בקשה בשנייה, עם User-Agent מזהה, ורק לישראל. [מדיניות השימוש](https://operations.osmfoundation.org/policies/nominatim/). הוא חלש על מספר בית בעברית.
4. **Gemini** — המועדף לזיהוי צילום, ובחינם. [aistudio.google.com/apikey](https://aistudio.google.com/apikey). ברירת המחדל `gemini-3.5-flash-lite`, שמקבל תמונה. אם המפתח מוגדר הוא נבחר לפני Anthropic ו-OpenAI.
5. **Anthropic** — [console.anthropic.com](https://console.anthropic.com/). תשלום לפי שימוש. המודל ב-`ANTHROPIC_MODEL`.
6. **OpenAI** — [platform.openai.com/api-keys](https://platform.openai.com/api-keys). תשלום לפי שימוש. ברירת המחדל `gpt-4o`.

## פריסה ב-Render בחינם / Free Render deploy

השרת חסר מצב: אין דיסק ואין מסד. ההיסטוריה נשמרת ב-`localStorage` של הדפדפן, לכל מכשיר, ל-30 יום. מטמון הגיאוקודינג חי רק בזיכרון התהליך, ובנוסף יש מאגר כתובות סטטי לדוגמה. `npm start` מאזין על `0.0.0.0` ועל `process.env.PORT` (ברירת מחדל 3847).

The server is stateless: no disk and no database. History stays in the browser’s `localStorage`, per device, for 30 days. The geocode cache lives only in process memory, plus a static verified list for the sample addresses. `npm start` binds to `0.0.0.0` and `process.env.PORT` (default 3847).

1. דחפו את הריפו ל-GitHub.
2. ב-[Render](https://render.com) בחרו **New → Blueprint** והצביעו על הריפו. Render קורא את `render.yaml` (תוכנית `free`, Node, בדיקת בריאות `/api/health`).
3. במסך משתני הסביבה מלאו את הסודות. כולם מסומנים `sync: false`, אז Render לא שומר אותם בקובץ:
   - `APP_ACCESS_PASSWORD` — חובה לפני שימוש אמיתי
   - `GEMINI_API_KEY` — מומלץ, חינם
   - `ORS_API_KEY`, `GOOGLE_MAPS_API_KEY` — אופציונלי
   - `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` — אופציונלי
4. אשרו את הפריסה. השירות החינמי נרדם אחרי חוסר פעילות, והבקשה הראשונה אחרי שינה איטית. המסלולים שנשמרו בדפדפן לא נעלמים.

Push the repo to GitHub, then in Render choose **New → Blueprint**. Fill the secrets in the dashboard. The free web service sleeps after idle; the first request after sleep is slow. Routes saved in the browser are not lost.

בדיקת הבריאות: `GET /api/health` מחזיר `{ "ok": true }`.

## פרטיות / Privacy

השרת לא כותב שמות, כתובות או טלפונים לדיסק. מטמון כתובות נשאר רק בזיכרון התהליך עד אתחול. ההיסטוריה נשארת בדפדפן, ואפשר למחוק כל מסלול. רשומות ישנות מ-30 יום נמחקות מקומית. הכניסה עדיין מוגנת בקוד גישה. אין אנליטיקה. החוצה יוצא רק מה שנדרש לחישוב: מודל הראייה אם הועלה צילום ויש מפתח, גיאוקודינג, ומטריצת דרכים אם יש מפתח.

## איך המסלול נבנה / Pipeline

`extractStops` → `locateStops` → `buildRoute` ב-`lib/pipeline.ts`. עבודה מתוזמנת בשלב 2 יכולה לקרוא לאותן פונקציות בלי הממשק.

- עד 15 תחנות: Held-Karp עם מוצא ויעד קבועים, קבוצות מוקדם/רגיל/מאוחר, וחלון «עד שעה» כשיש מסלול חוקי.
- יותר מ-15: שכן קרוב ואז 2-opt.
- בלי ORS: מרחק אווירי × 1.35, מהירות 30 / 45 / 70 קמ״ש לפי מרחק הכביש המשוער.
- זמן עצירה בכל תחנה מתחיל ב-0 ונכנס לשעת ההגעה, לא לזמן הנהיגה.
- הגעה לפני פתיחת חלון הערה מוסיפה המתנה עד השעה. איחור אחרי «עד שעה» נשאר אזהרה.
- ▲▼ מחליף עם השכן ומחשב מחדש קטעים, סיכום, מפה והיסטוריה בדפדפן.
- «הורד תמונת מפה» בונה PNG של המפה החיה (אריחי OSM/CARTO) עם מספרי התחנות. `POST /api/map-image` מחזיר את אותו קובץ, כדי ששלב 2 יוכל לשלוח אותו.

דוגמה של חמש תחנות (כפר סבא, רעננה, הרצליה, פתח תקווה, נתניה) נטענת מכפתור «טען דוגמה». המקור ב-`lib/sample.ts`.
