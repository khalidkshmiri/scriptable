// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: magic;
// ─────────────────────────────────────────
//  SCHOOL WIDGET — Magister schedule + deadlines
//  Scriptable • Large widget recommended
//  v4: overflow fix · magister tap
// ─────────────────────────────────────────

const ICAL_URL     = "https://calendar.magister.net/api/icalendar/feeds/2aaf8a33-f54d-4915-b6ea-6aa0ecdabd1a"
const CAL_NAME     = "School"
const TAP_URL      = "magister://"
const CACHE_FOLDER = "Cache"
const CACHE_FILE   = "school_ical.json"

const SETTINGS = {
  refreshMinutes:    10,
  maxLaterLessons:   3,
  maxDeadlines:      4,   // absolute ceiling — dynamic calc may reduce this further
  pastDays:          30,
  futureDays:        30,
  breakThresholdMin: 10,
  nextDayLookAhead:  30,
}

// Widget slot budget. A "slot" ≈ one lesson-row height.
// Large widget ≈ 20 slots total.
// Deadline section header/divider costs 2 slots. Each deadline row costs 2 slots.
const WIDGET_SLOTS      = 20
const DEADLINE_OVERHEAD = 2
const DEADLINE_SLOTS    = 2

const SUBJECT_NAMES = {
  netl: "Nederlands",
  econ: "Economie",
  wisb: "Wiskunde",
  fatl: "Frans",
  ges:  "Geschiedenis",
  beco: "Beco",
  pe:   "PE",
  natk: "Natuurkunde",
  gpo:  "GPO",
  cbb:  "CBB",
}

function expandSubject(summary) {
  if (!summary) return summary
  const key = summary.trim().toLowerCase()
  return SUBJECT_NAMES[key] || summary
}

const C = {
  bg:          new Color("#0f0f0f"),
  card:        new Color("#1a2a4a"),
  breakCard:   new Color("#1a3a2a"),
  nextDayCard: new Color("#2a1a3a"),
  accent:      new Color("#4f8ef7"),
  breakAccent: new Color("#3a9e6a"),
  nextAccent:  new Color("#a070f0"),
  primary:     new Color("#ffffff"),
  secondary:   new Color("#8a8a8a"),
  done:        new Color("#3a9e6a"),
  urgent:      new Color("#e05555"),
  warning:     new Color("#f5a623"),
  error:       new Color("#e05555"),
}

// ─────────────────────────────────────────
//  CACHE
// ─────────────────────────────────────────

function getCachePath() {
  const fm  = FileManager.iCloud()
  const dir = fm.joinPath(fm.documentsDirectory(), CACHE_FOLDER)
  if (!fm.fileExists(dir)) fm.createDirectory(dir)
  return fm.joinPath(dir, CACHE_FILE)
}

function loadCache() {
  try {
    const fm   = FileManager.iCloud()
    const path = getCachePath()
    if (!fm.fileExists(path)) return null
    return JSON.parse(fm.readString(path))
  } catch { return null }
}

function saveCache(icalText) {
  try {
    const fm = FileManager.iCloud()
    fm.writeString(getCachePath(), JSON.stringify({
      icalText,
      fetchedAt: new Date().toISOString(),
    }))
  } catch {}
}

// ─────────────────────────────────────────
//  ICAL FETCH + PARSE
// ─────────────────────────────────────────

async function fetchIcal(url) {
  let icalText  = null
  let fromCache = false
  try {
    const req = new Request(url)
    icalText  = await req.loadString()
    saveCache(icalText)
  } catch {
    const cached = loadCache()
    if (cached?.icalText) {
      icalText  = cached.icalText
      fromCache = true
    }
  }
  if (!icalText) throw new Error("No data and no cache available")
  return { events: parseIcal(icalText), fromCache }
}

function parseIcal(text) {
  const events = []
  const lines  = text
    .replace(/\r\n/g, "\n")
    .replace(/\n /g, "")
    .split("\n")
  let ev = null
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      ev = {}
    } else if (line === "END:VEVENT" && ev) {
      if (ev.start && ev.end && ev.summary) events.push(ev)
      ev = null
    } else if (ev) {
      const sep = line.indexOf(":")
      const key = line.substring(0, sep)
      const val = line.substring(sep + 1).trim()
      if      (key.startsWith("DTSTART")) ev.start    = parseIcalDate(line)
      else if (key.startsWith("DTEND"))   ev.end      = parseIcalDate(line)
      else if (key === "SUMMARY")         ev.summary  = val
      else if (key === "LOCATION")        ev.location = val
    }
  }
  return events
}

function parseIcalDate(line) {
  const val = line.substring(line.lastIndexOf(":") + 1).trim()
  const y   = parseInt(val.slice(0, 4))
  const mo  = parseInt(val.slice(4, 6)) - 1
  const d   = parseInt(val.slice(6, 8))
  const h   = parseInt(val.slice(9, 11))
  const mi  = parseInt(val.slice(11, 13))
  return val.endsWith("Z")
    ? new Date(Date.UTC(y, mo, d, h, mi))
    : new Date(y, mo, d, h, mi)
}

// ─────────────────────────────────────────
//  CALENDAR DEADLINES + REMINDERS
// ─────────────────────────────────────────

async function fetchDeadlines() {
  const allCals = await Calendar.forEvents()
  const cal     = allCals.find(c => c.title === CAL_NAME)
  if (!cal) return []
  const now    = new Date()
  const past   = new Date(now.getTime() - SETTINGS.pastDays   * 86400000)
  const future = new Date(now.getTime() + SETTINGS.futureDays * 86400000)
  const evts   = await CalendarEvent.between(past, future, [cal])
  return evts
    .filter(e => e.isAllDay)
    .sort((a, b) => a.startDate - b.startDate)
    .slice(0, 5)
}

async function fetchReminders() {
  const allLists = await Calendar.forReminders()
  const list     = allLists.find(c => c.title === CAL_NAME)
  if (!list) return []
  const all = await Reminder.all([list])
  return all
    .filter(r => !r.isCompleted)
    .sort((a, b) => (a.dueDate || new Date(9999, 0, 1)) - (b.dueDate || new Date(9999, 0, 1)))
    .slice(0, 5)
}

// ─────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────

function eventsOnDate(allEvents, date) {
  const from = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const to   = new Date(from.getTime() + 86400000)
  return allEvents
    .filter(e => e.start >= from && e.start < to)
    .sort((a, b) => a.start - b.start)
}

// Scans forward through actual iCal data — skips any day with no lessons,
// regardless of weekends, holidays, or study days.
function nextDayWithLessons(allEvents, from) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  for (let i = 1; i <= SETTINGS.nextDayLookAhead; i++) {
    d.setDate(d.getDate() + 1)
    if (eventsOnDate(allEvents, new Date(d)).length > 0) return new Date(d)
  }
  return null
}

function dayLabel(date) {
  const todayMs    = new Date(new Date().toDateString()).getTime()
  const tomorrowMs = todayMs + 86400000
  const targetMs   = new Date(date.toDateString()).getTime()
  if (targetMs === tomorrowMs) return "TOMORROW"
  return date.toLocaleDateString("en-GB", { weekday: "long" }).toUpperCase()
}

function fmtTime(date) {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
}

function fmtDate(date) {
  const d = date instanceof Date ? date : new Date(date)
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

function daysUntil(date) {
  const now  = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const d    = date instanceof Date ? date : new Date(date)
  const to   = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((to - from) / 86400000)
}

function deadlineDisplay(days, rawDate) {
  if (days > 3)   return { text: `In ${days} days`,            color: C.secondary }
  if (days === 3) return { text: "In 3 days",                   color: C.warning }
  if (days === 2) return { text: "In 2 days",                   color: C.warning }
  if (days === 1) return { text: "Tomorrow",                    color: C.warning }
  if (days === 0) {
    const d = rawDate instanceof Date ? rawDate : new Date(rawDate)
    const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0
    return { text: hasTime ? fmtTime(d) : "Today",             color: C.urgent }
  }
  if (days >= -3) return { text: `${Math.abs(days)}d overdue`,  color: C.urgent }
  return           { text: fmtDate(rawDate),                    color: C.urgent }
}

function toCalShowTime(date) {
  const d = date instanceof Date ? date : new Date(date)
  return Math.floor(d.getTime() / 1000) - 978307200
}

function detectBreak(todayAll, now) {
  const past   = todayAll.filter(e => e.end   <= now)
  const future = todayAll.filter(e => e.start >  now)
  if (!past.length || !future.length) return null
  const lastDone = past[past.length - 1]
  const nextUp   = future[0]
  const gapMin   = Math.round((nextUp.start - lastDone.end) / 60000)
  if (gapMin < SETTINGS.breakThresholdMin) return null
  return {
    total:     gapMin,
    remaining: Math.round((nextUp.start - now) / 60000),
    next:      nextUp,
  }
}

// How many slots does a lesson card consume?
// Card base = 5. Add 1 if it has a location line.
function cardSlots(event) {
  return event.location ? 6 : 5
}

// ─────────────────────────────────────────
//  RENDER FUNCTIONS
// ─────────────────────────────────────────

function renderLessonCard(w, event, label, accentColor, cardColor, countdown) {
  const card = w.addStack()
  card.backgroundColor = cardColor
  card.cornerRadius    = 10
  card.setPadding(10, 12, 10, 12)
  card.layoutVertically()

  const topRow = card.addStack()
  topRow.layoutHorizontally()
  topRow.centerAlignContent()
  const lbl = topRow.addText(label)
  lbl.font      = Font.boldSystemFont(9)
  lbl.textColor = accentColor
  topRow.addSpacer()
  const range = topRow.addText(`${fmtTime(event.start)} – ${fmtTime(event.end)}`)
  range.font      = Font.systemFont(9)
  range.textColor = C.secondary

  card.addSpacer(5)
  const name = card.addText(expandSubject(event.summary))
  name.font      = Font.boldSystemFont(16)
  name.textColor = C.primary

  if (event.location) {
    card.addSpacer(3)
    const loc = card.addText("📍 " + event.location)
    loc.font      = Font.systemFont(10)
    loc.textColor = C.secondary
  }

  card.addSpacer(4)
  const ctd = card.addText(countdown)
  ctd.font      = Font.mediumSystemFont(10)
  ctd.textColor = accentColor
}

function renderBreakCard(w, brk) {
  const card = w.addStack()
  card.backgroundColor = C.breakCard
  card.cornerRadius    = 10
  card.setPadding(10, 12, 10, 12)
  card.layoutVertically()

  const topRow = card.addStack()
  topRow.layoutHorizontally()
  topRow.centerAlignContent()
  const lbl = topRow.addText("BREAK")
  lbl.font      = Font.boldSystemFont(9)
  lbl.textColor = C.breakAccent
  topRow.addSpacer()
  const dur = topRow.addText(`${brk.total} min total`)
  dur.font      = Font.systemFont(9)
  dur.textColor = C.secondary

  card.addSpacer(5)
  const next = card.addText("Next: " + expandSubject(brk.next.summary))
  next.font      = Font.boldSystemFont(15)
  next.textColor = C.primary

  if (brk.next.location) {
    card.addSpacer(3)
    const loc = card.addText("📍 " + brk.next.location)
    loc.font      = Font.systemFont(10)
    loc.textColor = C.secondary
  }

  card.addSpacer(4)
  const rem = card.addText(`${brk.remaining} min remaining`)
  rem.font      = Font.mediumSystemFont(10)
  rem.textColor = C.breakAccent
}

// Renders a lesson list and returns how many slot units it consumed.
function renderLessonList(w, events, sectionHeader) {
  const shown = Math.min(events.length, SETTINGS.maxLaterLessons)
  const hdr   = w.addText(sectionHeader)
  hdr.font      = Font.boldSystemFont(9)
  hdr.textColor = C.secondary
  w.addSpacer(4)

  for (const ev of events.slice(0, shown)) {
    const row = w.addStack()
    row.layoutHorizontally()
    row.centerAlignContent()
    const dot = row.addText("• ")
    dot.font      = Font.boldSystemFont(13)
    dot.textColor = C.accent
    const name = row.addText(expandSubject(ev.summary))
    name.font      = Font.systemFont(12)
    name.textColor = C.primary
    row.addSpacer()
    const time = row.addText(fmtTime(ev.start))
    time.font      = Font.systemFont(11)
    time.textColor = C.secondary
    w.addSpacer(3)
  }

  if (events.length > SETTINGS.maxLaterLessons) {
    const more = w.addText(`+${events.length - SETTINGS.maxLaterLessons} more`)
    more.font      = Font.systemFont(10)
    more.textColor = C.secondary
  }

  return 1 + shown  // 1 for section header + n rows
}

function renderDeadlines(w, deadlines, reminders, maxItems) {
  const combined = [
    ...deadlines.map(e => ({
      name:    e.title,
      days:    daysUntil(e.startDate),
      rawDate: e.startDate,
      icon:    "📅",
      url:     `calshow://${toCalShowTime(e.startDate)}`,
    })),
    ...reminders.map(r => ({
      name:    r.title,
      days:    r.dueDate ? daysUntil(r.dueDate) : null,
      rawDate: r.dueDate,
      icon:    "☑",
      url:     "x-apple-reminder://",
    })),
  ]
    .sort((a, b) => (a.days ?? 999) - (b.days ?? 999))
    .slice(0, maxItems)

  if (!combined.length) return

  w.addSpacer(10)
  const divider = w.addStack()
  divider.backgroundColor = new Color("#2a2a2a")
  divider.size = new Size(0, 1)
  w.addSpacer(8)

  const hdr = w.addText("DEADLINES & REMINDERS")
  hdr.font      = Font.boldSystemFont(9)
  hdr.textColor = C.secondary
  w.addSpacer(6)

  for (const item of combined) {
    const row = w.addStack()
    row.layoutHorizontally()
    row.centerAlignContent()
    row.setPadding(4, 0, 4, 0)
    row.url = item.url

    const icon = row.addText(item.icon + " ")
    icon.font      = Font.systemFont(14)
    icon.textColor = C.secondary

    const name = row.addText(item.name)
    name.font      = Font.systemFont(14)
    name.textColor = C.primary

    row.addSpacer()

    if (item.days !== null) {
      const { text, color } = deadlineDisplay(item.days, item.rawDate)
      const lbl = row.addText(text)
      lbl.font      = Font.boldSystemFont(12)
      lbl.textColor = color
    } else {
      const lbl = row.addText("No date")
      lbl.font      = Font.systemFont(12)
      lbl.textColor = C.secondary
    }

    w.addSpacer(6)
  }
}

// ─────────────────────────────────────────
//  BUILD WIDGET
// ─────────────────────────────────────────

async function buildWidget() {
  const w = new ListWidget()
  w.backgroundColor = C.bg
  w.setPadding(14, 14, 14, 14)
  w.refreshAfterDate = new Date(Date.now() + SETTINGS.refreshMinutes * 60 * 1000)
  w.url = TAP_URL

  const now = new Date()

  // ── Header (2 slots)
  let slotsUsed = 2
  const header = w.addStack()
  header.layoutHorizontally()
  header.centerAlignContent()
  const dayTxt = header.addText(
    now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })
  )
  dayTxt.font      = Font.mediumSystemFont(11)
  dayTxt.textColor = C.secondary
  header.addSpacer()
  const timeTxt = header.addText(fmtTime(now))
  timeTxt.font      = Font.boldSystemFont(13)
  timeTxt.textColor = C.primary

  w.addSpacer(10)

  // ── Fetch
  let allEvents = [], deadlines = [], reminders = []
  let fromCache = false, error = false

  try {
    const [icalResult, dl, rm] = await Promise.all([
      fetchIcal(ICAL_URL),
      fetchDeadlines(),
      fetchReminders(),
    ])
    allEvents = icalResult.events
    fromCache = icalResult.fromCache
    deadlines = dl
    reminders = rm
  } catch {
    error = true
  }

  if (error) {
    const t = w.addText("⚠ Could not load data")
    t.textColor = C.error
    t.font      = Font.systemFont(13)
    return w
  }

  if (fromCache) {
    slotsUsed += 1
    const note = w.addText("📶 Offline — cached schedule")
    note.font      = Font.systemFont(9)
    note.textColor = C.warning
    w.addSpacer(6)
  }

  // ── Schedule logic
  const todayAll  = eventsOnDate(allEvents, now)
  const current   = todayAll.find(e => now >= e.start && now < e.end)
  const todayDone = todayAll.length > 0 && todayAll.every(e => e.end <= now)
  const noLessons = todayAll.length === 0

  // CASE 1: Currently in a lesson
  if (current) {
    const mins = Math.round((current.end - now) / 60000)
    renderLessonCard(w, current, "NOW", C.accent, C.card, `${mins} min remaining`)
    slotsUsed += cardSlots(current)

    const afterCurrent = todayAll.filter(e => e.start >= current.end)
    if (afterCurrent.length > 0) {
      const gapMin = Math.round((afterCurrent[0].start - current.end) / 60000)
      if (gapMin >= SETTINGS.breakThresholdMin) {
        w.addSpacer(5)
        const breakNote = w.addText(`Break after this: ${gapMin} min`)
        breakNote.font      = Font.systemFont(10)
        breakNote.textColor = C.breakAccent
        slotsUsed += 1
      }
    }

    const laterToday = todayAll.filter(e => e.start > now)
    if (laterToday.length > 0) {
      w.addSpacer(8)
      slotsUsed += renderLessonList(w, laterToday, "LATER TODAY")
    }

  // CASE 2: In a break or before first lesson
  } else if (!current && !todayDone && !noLessons) {
    const brk = detectBreak(todayAll, now)

    if (brk) {
      renderBreakCard(w, brk)
      slotsUsed += cardSlots(brk.next)
      const afterBreak = todayAll.filter(e => e.start > brk.next.start)
      if (afterBreak.length > 0) {
        w.addSpacer(8)
        slotsUsed += renderLessonList(w, afterBreak, "LATER TODAY")
      }
    } else {
      const next = todayAll.find(e => e.start > now)
      const mins = Math.round((next.start - now) / 60000)
      renderLessonCard(w, next, "NEXT LESSON", C.accent, C.card, `Starts in ${mins} min`)
      slotsUsed += cardSlots(next)
      const rest = todayAll.filter(e => e.start > next.start)
      if (rest.length > 0) {
        w.addSpacer(8)
        slotsUsed += renderLessonList(w, rest, "LATER TODAY")
      }
    }

  // CASE 3: Today done or no lessons
  } else {
    if (noLessons) {
      const t = w.addText("🎉 No lessons today")
      t.font      = Font.mediumSystemFont(13)
      t.textColor = C.primary
    } else {
      const t = w.addText("✓ Done for today")
      t.font      = Font.mediumSystemFont(13)
      t.textColor = C.done
    }
    slotsUsed += 1

    const nextDay     = nextDayWithLessons(allEvents, now)
    const nextDayEvts = nextDay ? eventsOnDate(allEvents, nextDay) : []

    if (nextDay && nextDayEvts.length > 0) {
      w.addSpacer(8)
      const label       = dayLabel(nextDay)
      const firstLesson = nextDayEvts[0]
      renderLessonCard(
        w,
        firstLesson,
        label,
        C.nextAccent,
        C.nextDayCard,
        `First lesson at ${fmtTime(firstLesson.start)}`
      )
      slotsUsed += cardSlots(firstLesson)
      const restOfNextDay = nextDayEvts.slice(1)
      if (restOfNextDay.length > 0) {
        w.addSpacer(8)
        slotsUsed += renderLessonList(w, restOfNextDay, `${label} — REST OF DAY`)
      }
    } else {
      w.addSpacer(6)
      const t = w.addText("No upcoming lessons in the next 30 days")
      t.font      = Font.systemFont(11)
      t.textColor = C.secondary
      slotsUsed += 1
    }
  }

  // ── Compute how many deadline items actually fit, then render
  const remainingSlots = WIDGET_SLOTS - slotsUsed - DEADLINE_OVERHEAD
  const maxDeadlines   = Math.min(
    SETTINGS.maxDeadlines,
    Math.max(1, Math.floor(remainingSlots / DEADLINE_SLOTS))
  )

  renderDeadlines(w, deadlines, reminders, maxDeadlines)

  w.addSpacer()
  return w
}

// ─────────────────────────────────────────
//  RUN
// ─────────────────────────────────────────

const widget = await buildWidget()
if (config.runsInWidget) {
  Script.setWidget(widget)
} else {
  await widget.presentLarge()
}
Script.complete()