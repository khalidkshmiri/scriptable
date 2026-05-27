# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-file **Scriptable** script (`morning-summary-script.js`) that runs on iPhone at wake time. It fetches weather, calendar events, and reminders, renders a visual PNG using DrawContext, and sends it to a Telegram chat. There is no build system, no package manager, and no tests — the script is pasted directly into the Scriptable app (stored in iCloud Drive → Scriptable).

## Deployment

Editing the file on Mac (via VS Code or any editor) syncs to Scriptable automatically via iCloud Drive. If the app shows a stale version, reopen Scriptable or pull to refresh. The script runs via a Shortcuts wake automation — not manually.

## Architecture

```
main()
├── Promise.all([getWeather(), getCalendar(), getReminders()])
├── buildAdvice(weather, calendar)
├── runLayout(null, data)     ← pass 1: measure total height
├── runLayout(dc, data)       ← pass 2: draw to DrawContext
└── sendPhoto(image, caption) → Telegram bot sendPhoto (multipart)
```

`runLayout` calls section renderers in order: `renderHeader` → `renderWeather` → `renderCalendar` → `renderReminders` → `renderAdvice`. Each renderer returns the new `y` position. When `dc` is `null`, only height calculations run (no draw calls).

## Key constraints

- **`Script.complete()`** — capital S, Scriptable global. `script` (lowercase) is undefined and throws `ReferenceError` in automation context.
- **`SCALE = 1` + `dc.respectScreenScale = true`** — renders at native device resolution (3× on iPhone 15/16 = 1170px). Do not set `SCALE=2` with `respectScreenScale=false` — produces a 780px bitmap that gets upscaled and looks blurry.
- **`TOP_INSET = 62`** — Dynamic Island safe area in points. Gradient starts at y=0 (bleeds behind Dynamic Island intentionally). Text starts at `y + TOP_INSET`.
- All Scriptable APIs (`DrawContext`, `CalendarEvent`, `Reminder`, `Location`, `Device`, `Notification`, `Script`) are globals — no imports needed.
- Font names are PostScript names (e.g. `HoeflerText-Black`, `AvenirNext-Medium`, `Menlo-Bold`). Unavailable fonts fall back silently.

## Config block

```javascript
const CFG = {
  token:     "BOT_TOKEN",     // Telegram bot token — live credential, treat carefully
  chatId:    "CHAT_ID",
  calendars: ["Events","Family","Rooster","School","Personal","Barber Appointments","Admin","Other"],
  thresh:    { wind: 25, cold: 3, warm: 25, uv: 6 }
}
```

**Calendar display order** matches the `CFG.calendars` array. Events grouped by calendar, then sorted by earliest start within each group. Adaptive cap: 7 events if only 1 calendar has events, 4 per calendar if 2 or more.

## Design system ("Daybreak Ledger")

- Palette tokens in `C` object — warm espresso background, single gold accent (`#E2B262`), distinct dark tint per card
- Font tokens in `F` object — editorial three-font system (Hoefler Text, Menlo, Avenir Next)
- Spacing/sizing tokens in `S` object — all values pre-scaled via `sc(n)`
- `trk(s)` — inserts hair spaces (U+200A) between characters for tracked-uppercase section labels
- `lerpColor` — fakes gradient with 2pt horizontal strips (DrawContext has no native gradient API)

## Data sources

- **Weather:** Open-Meteo API — no API key. Single request for current conditions, daily summary, hourly precipitation probability, sunrise/sunset.
- **Calendar:** `CalendarEvent.between(start, end, allowedCals)` — 8 named calendars from CFG
- **Reminders:** `Reminder.allIncomplete()` — filters to overdue / today / upcoming (within 3 days); reminders without a `dueDate` are never shown
- **Location:** `Location.current()` with `setAccuracyToHundredMeters()` — used for weather coords and city name via `reverseGeocode`

## Error handling pattern

Each data fetch returns `{ ok: false }` on failure. Sections are skipped in layout when `ok` is false — no crash, no error UI. If `sendPhoto` fails, a local `Notification` is scheduled.

## Companion: Departure Alert (Shortcuts)

Separate Shortcut that runs *before* MorningSummary in the wake automation. Finds the first calendar event with a location not matching "Straatweg" (home street), reads a `#drive`/`#walk`/`#bike`/`#transit` tag from the event's Notes field, gets Apple Maps travel time, and sends a Telegram text: `Leave by 08:15 for Dentist — 23 min by public transport`. This logic is entirely in Shortcuts, not in this JS file.

## Pending features (not yet implemented)

- Tomorrow's agenda preview
- Monday week preview (event/client count for the week, Mondays only)
- Back-to-back event warning (tight gaps given travel time)
- NS disruption alerts (Dutch rail, free API)
