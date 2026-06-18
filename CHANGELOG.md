# Changelog

All notable changes to this repo are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/). Dates are YYYY-MM-DD.

## [Unreleased]

### Added
- morning-summary: configurable `calendars` list via config (#2).
- morning-summary: first-lesson line, smart workout suggestion, key-date countdowns,
  per-weekday masthead theming (#11); quote-of-the-day footer + gym-streak line (#12);
  air-quality (AQI) flag via keyless Open-Meteo (#10).
- Repo: root `CLAUDE.md` overview + per-module `CLAUDE.md` files; `CHANGELOG.md` (#21).

### Deferred (need external credentials)
- morning-summary: TrainMore gym capacity + barber-bookings endpoint (#10), NS disruption
  alert (#12) — left out pending API keys/endpoints.

### Changed
- school-widget: extra-large (iPad) now uses a true two-column layout — timetable on the
  left, Due on the right (#1).
- school-widget: the Due section grows to fill empty space on light lesson days instead of
  being hard-capped at 3 items (#8).
- Repo: standardised on a single root `Config/` directory for all module config templates;
  removed per-module `Config/` folders (#21).

### Fixed
- morning-summary: "Heavy day — N events" advice no longer counts each school lesson separately;
  the Rooster timetable now collapses into grouped sessions before counting (#3).

## Milestones (backfilled)

- **2026-06** — Extra-large (iPad) widget support added to school-widget.
- **2026-06** — `school-lockscreen` module added: `accessoryRectangular` current/next lesson.
- **2026-06** — `school-widget` v5 "Deep Ocean": two-column lesson grid, tussenuur detection,
  break/test cards, deadline section with slot budgeting.
- **2026-05** — `morning-summary` v1: Daybreak Ledger card (weather + calendar + reminders +
  advice + departure) rendered with DrawContext and delivered via Telegram.
