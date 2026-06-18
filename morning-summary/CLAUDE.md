# CLAUDE.md — morning-summary

Module-specific guidance. See the repo-root `CLAUDE.md` for shared conventions.

## What this is

A single-file **Scriptable** script (`morning-summary-script.js`) that runs on iPhone at wake
time. It fetches weather, calendar events, and reminders, renders a visual PNG using
DrawContext, and sends it to a Telegram chat. No build system, no tests — pasted directly into
the Scriptable app (iCloud Drive → Scriptable).

## Architecture

```
main()
├── loadConfig()                         ← reads Config/morning-summary-config.json
├── Promise.all([getWeather(), getCalendar(), getReminders()])
├── getDeparture(calendar, loc)
├── buildAdvice(weather, calendar, departure)
├── runLayout(null, data)                ← pass 1: measure total height
├── runLayout(dc, data)                  ← pass 2: draw to DrawContext
└── sendPhoto(image, caption)            → Telegram bot sendPhoto (multipart)
```

`runLayout` calls section renderers in order: `renderHeader` → `renderWeather` →
`renderDeparture` → `renderCalendar` → `renderReminders` → `renderAdvice`. Each renderer returns
the new `y`. When `dc` is `null`, only height calculations run (no draw calls).

## Key constraints

- **`SCALE = 1` + `dc.respectScreenScale = true`** — renders at native device resolution. Do not
  set `SCALE=2` with `respectScreenScale=false` (produces a blurry upscaled bitmap).
- **`TOP_INSET = 62`** — Dynamic Island safe area in points. Gradient starts at y=0 (bleeds behind
  the island intentionally); text starts at `y + TOP_INSET`.
- Font names are PostScript names (`HoeflerText-Black`, `AvenirNext-Medium`, `Menlo-Bold`).

## Config block

`CFG` holds defaults; `loadConfig()` overrides from `Config/morning-summary-config.json`:
`token`, `chatId` (required), plus optional `homeKeyword`, `schoolAddress`, `roosterBuffer`, and
`calendars` (array, display order — keep `"Rooster"` for the timetable grouping). `thresh`
(wind/cold/warm/uv) stays inline.

**Calendar display order** matches the `calendars` array. Events are grouped by calendar, then
sorted by earliest start within each group. Adaptive cap: 7 events if only 1 calendar has events,
4 per calendar if 2+.

**Rooster grouping** — the school timetable is dozens of back-to-back lessons. `groupRoosterSessions`
collapses them into contiguous blocks for display, and `logicalEventCount` collapses them for the
heavy/light-day advice so a normal school day isn't counted as many events (issue #3).

## Design system ("Daybreak Ledger")

- Palette tokens in `C` — warm espresso background, single gold accent (`#E2B262`), distinct dark
  tint per card.
- Font tokens in `F` — editorial three-font system (Hoefler Text, Menlo, Avenir Next).
- Spacing/sizing tokens in `S` — values pre-scaled via `sc(n)`.
- `trk(s)` inserts hair spaces (U+200A) for tracked-uppercase section labels.
- `lerpColor` fakes a gradient with 2pt horizontal strips (DrawContext has no native gradient API).

## Data sources

- **Weather:** Open-Meteo (no key). Current conditions, daily summary, hourly precip probability,
  sunrise/sunset. Air-quality (AQI) uses Open-Meteo's keyless air-quality API.
- **Calendar:** `CalendarEvent.between(start, end, allowedCals)` over the configured calendars.
- **Reminders:** `Reminder.allIncomplete()` filtered to overdue / today / upcoming (≤3 days);
  reminders without a `dueDate` are never shown.
- **Location:** `Location.current()` with `setAccuracyToHundredMeters()` — weather coords + city.

## Error handling pattern

Each fetch returns `{ ok: false }` on failure; sections are skipped in layout when `ok` is false
— no crash, no error UI. If `sendPhoto` fails, a local `Notification` is scheduled.

## Companion: Departure Alert (Shortcuts)

A separate Shortcut runs before MorningSummary; it computes "leave by" travel time. That logic is
in Shortcuts, not this file. (The script also has an in-JS `getDeparture` path used for the
DEPARTURE card.)
