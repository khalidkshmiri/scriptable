# Changelog

All notable changes to this repo are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/). Dates are YYYY-MM-DD.

## [Unreleased]

### Added
- morning-summary: configurable `calendars` list via config (#2).
- Repo: root `CLAUDE.md` overview + per-module `CLAUDE.md` files; `CHANGELOG.md` (#21).

### Changed
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
