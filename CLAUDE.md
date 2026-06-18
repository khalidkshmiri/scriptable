# CLAUDE.md — repo overview

Guidance for Claude Code (claude.ai/code) working anywhere in this repo. Each module also
has its own `CLAUDE.md` with module-specific detail — read that too when working in a module.

## What this repo is

A collection of single-file **Scriptable** scripts (iOS, JavaScript). There is **no build
system, no package manager, and no test runner** — each script is pasted directly into the
Scriptable app, whose files live in **iCloud Drive → Scriptable**. Code here is the source of
truth; deployment copies it into that iCloud folder.

## Modules

| Folder | Script | What it is |
|---|---|---|
| `morning-summary/` | `morning-summary-script.js` | Wake-time visual card (weather + calendar + reminders + advice) rendered with DrawContext and sent to Telegram. See `morning-summary/CLAUDE.md`. |
| `school-widget/` | `school-widget-script.js` | Large/extra-large home-screen widget: Magister timetable + deadlines. See `school-widget/CLAUDE.md`. |
| `school-lockscreen/` | `school-lockscreen-script.js` | `accessoryRectangular` lock-screen widget: current + next lesson. See `school-lockscreen/CLAUDE.md`. |

## Shared conventions

### Config (`Config/` at repo root)
All modules load their settings at runtime from `Scriptable/Config/<module>-config.json` in
iCloud Drive. **The repo keeps one canonical `Config/` directory at the root** holding the
`*-config.example.json` templates — do not reintroduce per-module `Config/` folders. To set up
a module, copy its `*.example.json` to `<name>.json` (drop `.example`) in the Scriptable
`Config/` folder and fill in values. Real config files are git-ignored; only `*.example.json`
templates are tracked.

### iCloud JSON cache convention
Widgets that depend on a network feed cache the raw response under
`Scriptable/Cache/<name>.json` via `FileManager.iCloud()` and fall back to it silently on
network failure. Cross-script data (gym/barber/study logs) is shared as plain JSON files in the
Scriptable documents directory — never committed.

### Scriptable gotchas (apply everywhere)
- `Script.complete()` — capital S; lowercase `script` is undefined in automation context.
- All Scriptable APIs (`DrawContext`, `ListWidget`, `Calendar`, `Reminder`, `Location`,
  `Device`, `Request`, `FileManager`, `Notification`, `Script`, `config`) are globals — no imports.
- Font names are PostScript names (e.g. `HoeflerText-Black`); unavailable fonts fall back silently.
- Magister iCal feeds use `TZID=Europe/Amsterdam`; the device is on Amsterdam time, so
  `new Date(y, mo, d, h, mi)` for non-`Z` timestamps is correct.

## Deployment
After any code change, run the `/deploy-scriptable` skill to copy the updated script(s) into the
iCloud `Documents/Scriptable` directory. There is no other deploy step.

## Verification
On-device behaviour cannot be tested from here. The practical check is
`node --check --input-type=module < <file>.js` for syntax, plus logic review. State clearly when
behaviour is unverified on-device.
