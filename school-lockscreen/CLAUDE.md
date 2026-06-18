# CLAUDE.md — school-lockscreen

Module-specific guidance. See the repo-root `CLAUDE.md` for shared conventions.

## What this is

A single-file **Scriptable** script (`school-lockscreen-script.js`) rendering an
`accessoryRectangular` lock-screen widget: the current lesson (or break countdown) on line 1 and
the next lesson on line 2. Same Magister iCal source as `school-widget`.

## Architecture

- `loadConfig()` — reads `Config/school-lockscreen-config.json` (`icalUrl`).
- `fetchIcal` → `parseIcal` with a `Cache/school-lockscreen-cache.json` fallback on network failure.
- `getSchedule(events, now)` returns `{ current, next, nextFuture, todayLessons }`.
- `parseSummary` maps Magister abbreviations (`SUBJECT_NAMES`) and flags cancelled/test lessons.
- `widget.refreshAfterDate` is set to the next lesson start/end boundary (capped at `REFRESH_MINS`)
  so the widget flips exactly on transitions.

## Constraints

- Background is transparent (`new Color("#000000", 0)`) so iOS vibrant tint renders it.
- Lock-screen widgets are monochrome/tinted — colour is largely ignored by iOS; keep contrast in
  text content, not colour.
- Renders via `presentAccessoryRectangular()` when run directly, `Script.setWidget` in a widget.
