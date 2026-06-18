# School Widget

A Scriptable widget for iOS that shows your school schedule and upcoming deadlines/reminders on the home screen. Reads from an iCal feed plus iOS Calendar and Reminders.

## Quick start

1. Copy `Config/school-widget-config.example.json` → `Config/school-widget-config.json` in your Scriptable iCloud folder (`iCloud Drive/Scriptable/`).
2. Paste your iCal feed URL into `icalUrl`.
3. Copy the contents of `school-widget-script.js` into a new Scriptable script named **School Widget**. Place it as a Large widget.

## Widget sizes

- **Large** (iPhone) — single column: the active/next lesson, the rest of the day as a
  two-up lesson grid, then the **Due** section. On light lesson days the Due section
  automatically grows to fill the empty space.
- **Extra-large** (iPad) — two columns: the full timetable on the left (one lesson per row,
  plus a *Tomorrow* preview), and the **Due** section on the right. Column widths are a
  starting estimate (`XL_LEFT_W` / `XL_COL_GAP` near the top of the script) — nudge them if
  the split looks off on your iPad.

## Config fields

All fields except `icalUrl` are optional and fall back to the defaults shown below.

| Field | Default | Description |
|-------|---------|-------------|
| `icalUrl` | *(required)* | Your school's iCal feed URL |
| `calendarName` | `"School"` | iOS Calendar name to pull deadlines (all-day events) from |
| `remindersName` | same as `calendarName` | iOS Reminders list name to pull todos from |
| `tapUrl` | `"magister://"` | URL scheme to open when tapping the widget |

**Example** — if your calendar is called "Homework" and reminders are in "School Tasks":

```json
{
  "icalUrl": "https://...",
  "calendarName": "Homework",
  "remindersName": "School Tasks"
}
```

## Customizing subject names

Near the top of `school-widget-script.js` there is a `SUBJECT_NAMES` object (~line 32) that maps short abbreviation codes to full display names. These are the codes your school's iCal feed uses in event titles. Edit this map to match your own subjects:

```js
const SUBJECT_NAMES = {
  netl: "Nederlands",
  ellh: "Engels",
  // add your own …
}
```

If an abbreviation has no entry in the map, the raw code from the iCal feed is shown as-is.

## Notes for non-Magister users

The script has a few Magister/Dutch-specific assumptions. If your school uses a different system:

- **Cancellation detection** (`school-widget-script.js` ~line 58): the regex `/(uitval|vervallen|vrij)/` marks lessons as cancelled. Add or replace keywords to match your system's wording.
- **Hidden location** (~line 316): `"verborgen"` (Dutch for "hidden") is treated as a missing classroom. Change this string if your system uses a different placeholder.
- **Timezone** (~line 155): dates without a `Z` suffix are parsed as local `Europe/Amsterdam` time using `new Date(y, mo, d, h, mi)`. If your device is in a different timezone, adjust the `parseIcal` function accordingly.
- **`tapUrl`**: set this in your config to the URL scheme for your school app, e.g. `"somtoday://"` or `"zermelo://"`.
