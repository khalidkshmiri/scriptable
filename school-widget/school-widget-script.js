// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: magic;
// ─────────────────────────────────────────
//  SCHOOL WIDGET — Magister schedule + deadlines
//  Scriptable • Large widget recommended
//  v5: Deep Ocean · two-column grid · slim cards
// ─────────────────────────────────────────

const ICAL_URL     = "https://calendar.magister.net/api/icalendar/feeds/2aaf8a33-f54d-4915-b6ea-6aa0ecdabd1a"
const CAL_NAME     = "School"
const TAP_URL      = "magister://"
const CACHE_FOLDER = "Cache"
const CACHE_FILE   = "school_ical.json"

const SETTINGS = {
  refreshMinutes:    10,
  maxLaterLessons:   6,   // increased — two-column grid fits more
  maxDeadlines:      5,   // increased — compact rows
  pastDays:          30,
  futureDays:        30,
  breakThresholdMin: 10,
  nextDayLookAhead:  30,
}

// Widget slot budget.
// Large widget ≈ 22 slots total with the new slimmer card sizes.
const WIDGET_SLOTS      = 22
const DEADLINE_OVERHEAD = 2
const DEADLINE_SLOTS    = 1   // compact deadline rows cost 1 slot each

const SUBJECT_NAMES = {
  netl: "Nederlands",
  ellh: "Engels",
  el:   "Engels",
  econ: "Economie",
  wisb: "Wiskunde",
  wisa: "Wiskunde A",
  wis:  "Wiskunde",
  fatl: "Frans",
  ges:  "Geschiedenis",
  beco: "Beco",
  pe:   "PE",
  natk: "Natuurkunde",
  nat:  "Natuurkunde",
  bi:   "Biologie",
  biol: "Biologie",
  sk:   "Scheikunde",
  schk: "Scheikunde",
  ak:   "Aardrijkskunde",
  gpo:  "GPO",
  cbb:  "CBB",
}

function parseSummary(summary) {
  if (!summary) return { subject: summary, teacher: null, period: null, isTest: false, testBadge: null, isCancelled: false }
  const lower       = summary.toLowerCase()
  const isCancelled = /\b(uitval|vervallen|vrij)\b/.test(lower)
  const testBadge   = /\bse\b/.test(lower) ? "SE" : /\b(pw|toets|proefwerk)\b/.test(lower) ? "PW" : null
  const isTest      = testBadge !== null
  // Support " - ", " — " (em-dash), and "(teacher)" patterns
  const parenMatch  = summary.match(/^(.*?)\s*\(([^)]+)\)\s*$/)
  const dashIdx     = summary.indexOf(" - ") >= 0 ? summary.indexOf(" - ")
                    : summary.indexOf(" — ") >= 0 ? summary.indexOf(" — ")
                    : -1
  let teacher, subjectPart
  if (dashIdx >= 0) {
    teacher     = summary.slice(dashIdx + 3).trim()
    subjectPart = summary.slice(0, dashIdx).trim()
  } else if (parenMatch) {
    teacher     = parenMatch[2].trim()
    subjectPart = parenMatch[1].trim()
  } else {
    teacher     = null
    subjectPart = summary.trim()
  }
  const words   = subjectPart.split(/\s+/)
  const numWord = words.find(w => !isNaN(w) && w !== "")
  const abbrev  = words.find(w => isNaN(w)) ?? words[0]
  return {
    subject:    SUBJECT_NAMES[abbrev.toLowerCase()] ?? abbrev,
    teacher:    teacher ? teacher.toLowerCase() : null,
    period:     numWord ? parseInt(numWord, 10) : null,
    isTest,
    testBadge,
    isCancelled,
  }
}

function expandSubject(summary) {
  return parseSummary(summary).subject
}

// ─────────────────────────────────────────
//  THEME — Deep Ocean
//  Near-black navy base. Cyan for NOW/active.
//  Emerald for breaks. Indigo for next day.
//  Rose for tests/urgent. Amber for warnings.
// ─────────────────────────────────────────

const C = {
  bg:            new Color("#07101c"),   // Near-black, deep ocean
  card:          new Color("#0c1a2e"),   // Featured card: dark navy
  breakCard:     new Color("#081a0f"),   // Break: deep forest
  nextDayCard:   new Color("#0f0b22"),   // Next day: deep indigo
  accent:        new Color("#22d3ee"),   // NOW: bright cyan
  breakAccent:   new Color("#4ade80"),   // Break: emerald
  nextAccent:    new Color("#818cf8"),   // Next day: soft indigo
  primary:       new Color("#dde8f8"),   // Primary text: cool off-white
  secondary:     new Color("#253d58"),   // Secondary: muted steel-blue
  teacherAbbr:   new Color("#1a3048"),   // Teacher abbr: deep muted blue
  done:          new Color("#4ade80"),   // Done: emerald
  urgent:        new Color("#f87171"),   // Tests/urgent: rose-red
  warning:       new Color("#fb923c"),   // Warning: amber
  error:         new Color("#f87171"),   // Error: rose-red
  periodBg:      new Color("#0e2035"),   // Period pill bg: deeper navy
  periodText:    new Color("#38bdf8"),   // Period pill text: sky blue
  tussenuurCard: new Color("#0a1422"),   // Tussenuur: near-bg
  tussenuurText: new Color("#162232"),   // Tussenuur text: very muted
  testCard:      new Color("#1c0e18"),   // Test card: dark rose-plum
  cancelledCard: new Color("#090e16"),   // Cancelled: near-bg
  cancelledText: new Color("#162232"),   // Cancelled text: very muted
  divider:       new Color("#0e2030"),   // Section divider line
  colDivider:    new Color("#112030"),   // Column divider in grid
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

function isHiddenLocation(loc) {
  return !loc || loc === "verborgen" || loc === ""
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

// Inserts tussenuur placeholder objects between events that have a gap in period numbers.
// Only events with a known period participate in gap detection.
function insertTussenuurPlaceholders(events) {
  const result = []
  for (let i = 0; i < events.length; i++) {
    result.push(events[i])
    if (i < events.length - 1) {
      const { period: pA } = parseSummary(events[i].summary)
      const { period: pB } = parseSummary(events[i + 1].summary)
      if (pA !== null && pB !== null && pB > pA + 1) {
        result.push({ isTussenuur: true, fromPeriod: pA + 1, toPeriod: pB - 1 })
      }
    }
  }
  return result
}

function strikeThrough(str) {
  return str.split("").map(c => c + "̶").join("")
}

// Slim card design — uniform 3 slots regardless of content.
function cardSlots(event) {
  return 3
}

// ─────────────────────────────────────────
//  RENDER FUNCTIONS
// ─────────────────────────────────────────

// Fixed width for the left cell in the two-column lesson grid.
// Approximates half the large widget's content area (≈ 311px total - 13px dividers = 298, /2 ≈ 149).
const GRID_CELL_W = 142

// ── Mini lesson cell for the two-column grid.
//    Row 1: [period pill] subject  teacher  [badge]  time
//    Row 2 (optional): location
function renderMiniLessonCell(container, event) {
  const { subject, teacher, period, isTest, testBadge, isCancelled } = parseSummary(event.summary)

  // Single horizontal row: pill · subject · teacher · badge · spacer · time
  const mainRow = container.addStack()
  mainRow.layoutHorizontally()
  mainRow.centerAlignContent()

  // Period pill — left of subject, same row
  if (period !== null) {
    const p = mainRow.addStack()
    p.backgroundColor = C.periodBg
    p.cornerRadius    = 4
    p.setPadding(1, 5, 1, 5)
    const pt = p.addText(String(period))
    pt.font      = Font.boldSystemFont(9)
    pt.textColor = C.periodText
    mainRow.addSpacer(5)
  }

  // Subject
  const displaySubject = isCancelled ? strikeThrough(subject) : subject
  const nm = mainRow.addText(displaySubject)
  nm.font      = Font.boldSystemFont(11)
  nm.textColor = isCancelled ? C.cancelledText : C.primary
  nm.lineLimit = 1

  // Test badge — inline after subject
  if (isTest && testBadge) {
    mainRow.addSpacer(3)
    const badge = mainRow.addStack()
    badge.backgroundColor = C.urgent
    badge.cornerRadius    = 3
    badge.setPadding(1, 3, 1, 3)
    const bt = badge.addText(testBadge)
    bt.font      = Font.boldSystemFont(7)
    bt.textColor = C.primary
  }

  // Push time to the right
  mainRow.addSpacer()
  const time = mainRow.addText(fmtTime(event.start))
  time.font      = Font.systemFont(9)
  time.textColor = isCancelled ? C.cancelledText : C.secondary

  // Sub-row: teacher  ·  classroom  (below subject, left-aligned)
  const isHiddenLoc = isHiddenLocation(event.location)
  const hasTeacher  = teacher && !isCancelled
  if (hasTeacher || !isHiddenLoc) {
    const subRow = container.addStack()
    subRow.layoutHorizontally()
    subRow.centerAlignContent()
    if (period !== null) subRow.addSpacer(24) // indent under pill
    if (hasTeacher) {
      const tc = subRow.addText(teacher)
      tc.font      = Font.systemFont(9)
      tc.textColor = C.secondary
      tc.lineLimit = 1
    }
    if (hasTeacher && !isHiddenLoc) {
      subRow.addSpacer(4)
      const dot = subRow.addText("·")
      dot.font      = Font.boldSystemFont(11)
      dot.textColor = C.secondary
      subRow.addSpacer(4)
    }
    if (!isHiddenLoc) {
      const loc = subRow.addText(event.location)
      loc.font      = Font.systemFont(9)
      loc.textColor = C.secondary
      loc.lineLimit = 1
    }
  }
}

// ── Featured lesson card (NOW / NEXT LESSON / next-day first).
//    Slim two-row layout with a coloured left accent strip.
//    Row 1: label (accent)  ·  countdown (accent)
//    Row 2: period pill  ·  subject  ·  teacher  ·  time range
//    Row 3 (optional): location plain text
function renderLessonCard(w, event, label, accentColor, cardColor, countdown, progress = null) {
  const { subject, teacher, period, isTest, testBadge, isCancelled } = parseSummary(event.summary)

  if (isCancelled) {
    cardColor   = C.cancelledCard
    accentColor = C.secondary
  } else if (isTest) {
    cardColor   = C.testCard
    accentColor = C.urgent
  }

  // Outer card — horizontal so we can place the accent strip on the far left
  const card = w.addStack()
  card.backgroundColor = cardColor
  card.cornerRadius    = 12
  card.layoutHorizontally()
  card.topAlignContent()
  card.setPadding(0, 0, 0, 0)

  // Left accent strip: 4pt wide, stretches to full card height
  const strip = card.addStack()
  strip.backgroundColor = accentColor
  strip.size = new Size(4, 0)

  // Gap between strip and content
  card.addSpacer(10)

  // Content area — vertical stack
  const content = card.addStack()
  content.layoutVertically()
  content.setPadding(8, 0, 8, 12)

  // ── Row 1: label (left) · countdown (right)
  const topRow = content.addStack()
  topRow.layoutHorizontally()
  topRow.centerAlignContent()
  const lbl = topRow.addText(label)
  lbl.font      = Font.boldSystemFont(8)
  lbl.textColor = accentColor
  topRow.addSpacer()
  const ctd = topRow.addText(countdown)
  ctd.font      = Font.systemFont(10)
  ctd.textColor = accentColor

  content.addSpacer(5)

  // ── Row 2: period  ·  subject  ·  [badge]  ·  teacher  ·  spacer  ·  time range
  const mainRow = content.addStack()
  mainRow.layoutHorizontally()
  mainRow.centerAlignContent()

  // Period pill — left-aligned (no leading spacer before pill)
  if (period !== null) {
    const pill = mainRow.addStack()
    pill.backgroundColor = C.periodBg
    pill.cornerRadius    = 5
    pill.setPadding(2, 7, 2, 7)
    const pt = pill.addText(String(period))
    pt.font      = Font.boldSystemFont(12)
    pt.textColor = C.periodText
    mainRow.addSpacer(8)
  }

  // Subject name
  const displaySubject = isCancelled ? strikeThrough(subject) : subject
  const nm = mainRow.addText(displaySubject)
  nm.font      = Font.boldSystemFont(13)
  nm.textColor = isCancelled ? C.cancelledText : C.primary

  // Test badge
  if (isTest && testBadge) {
    mainRow.addSpacer(6)
    const badge = mainRow.addStack()
    badge.backgroundColor = C.urgent
    badge.cornerRadius    = 4
    badge.setPadding(2, 5, 2, 5)
    const bt = badge.addText(testBadge)
    bt.font      = Font.boldSystemFont(8)
    bt.textColor = C.primary
  }

  // Time range — right-aligned, prominent
  mainRow.addSpacer()
  const timeRange = mainRow.addText(`${fmtTime(event.start)}–${fmtTime(event.end)}`)
  timeRange.font      = Font.boldSystemFont(13)
  timeRange.textColor = isCancelled ? C.cancelledText : accentColor

  // ── Row 3: teacher  ·  classroom  (below subject line)
  const isHiddenLoc = isHiddenLocation(event.location)
  const hasTeacher = teacher && !isCancelled
  if (hasTeacher || !isHiddenLoc) {
    content.addSpacer(4)
    const metaRow = content.addStack()
    metaRow.layoutHorizontally()
    metaRow.centerAlignContent()
    if (hasTeacher) {
      const tc = metaRow.addText(teacher)
      tc.font      = Font.systemFont(11)
      tc.textColor = C.secondary
    }
    if (hasTeacher && !isHiddenLoc) {
      metaRow.addSpacer(5)
      const dot = metaRow.addText("·")
      dot.font      = Font.boldSystemFont(13)
      dot.textColor = C.secondary
      metaRow.addSpacer(5)
    }
    if (!isHiddenLoc) {
      const loc = metaRow.addText(event.location)
      loc.font      = Font.systemFont(11)
      loc.textColor = C.secondary
    }
  }

  // ── Progress bar — only for NOW card (progress 0.0–1.0 provided)
  if (progress !== null) {
    content.addSpacer(6)
    const barOuter = content.addStack()
    barOuter.layoutHorizontally()
    barOuter.cornerRadius = 2
    barOuter.size = new Size(0, 3)
    const filledFraction = Math.min(1, Math.max(0, progress))
    // Filled portion — rendered as a proportionally-sized inner stack
    const filled = barOuter.addStack()
    filled.backgroundColor = accentColor
    filled.size = new Size(filledFraction * 280, 3)
    // Remaining portion
    const remaining = barOuter.addStack()
    remaining.backgroundColor = C.secondary
    remaining.size = new Size((1 - filledFraction) * 280, 3)
  }
}

// ── Break card — slim, same accent-strip structure as the featured card.
function renderBreakCard(w, brk) {
  const { subject: nxSubject, teacher: nxTeacher, period: nxPeriod } = parseSummary(brk.next.summary)

  const card = w.addStack()
  card.backgroundColor = C.breakCard
  card.cornerRadius    = 12
  card.layoutHorizontally()
  card.topAlignContent()
  card.setPadding(0, 0, 0, 0)

  // Left accent strip
  const strip = card.addStack()
  strip.backgroundColor = C.breakAccent
  strip.size = new Size(4, 0)

  card.addSpacer(10)

  const content = card.addStack()
  content.layoutVertically()
  content.setPadding(8, 0, 8, 12)

  // Row 1: "BREAK" · total · spacer · remaining
  const topRow = content.addStack()
  topRow.layoutHorizontally()
  topRow.centerAlignContent()
  const lbl = topRow.addText("BREAK")
  lbl.font      = Font.boldSystemFont(8)
  lbl.textColor = C.breakAccent
  topRow.addSpacer(6)
  const dur = topRow.addText(`${brk.total} min total`)
  dur.font      = Font.systemFont(9)
  dur.textColor = C.secondary
  topRow.addSpacer()
  const rem = topRow.addText(`${brk.remaining} min left`)
  rem.font      = Font.mediumSystemFont(10)
  rem.textColor = C.breakAccent

  content.addSpacer(5)

  // Row 2: period · "Next:" subject · teacher · spacer · time range
  const mainRow = content.addStack()
  mainRow.layoutHorizontally()
  mainRow.centerAlignContent()

  if (nxPeriod !== null) {
    const pill = mainRow.addStack()
    pill.backgroundColor = C.periodBg
    pill.cornerRadius    = 5
    pill.setPadding(2, 7, 2, 7)
    const pt = pill.addText(String(nxPeriod))
    pt.font      = Font.boldSystemFont(12)
    pt.textColor = C.periodText
    mainRow.addSpacer(8)
  }

  const next = mainRow.addText("Next: " + nxSubject)
  next.font      = Font.boldSystemFont(13)
  next.textColor = C.primary

  if (nxTeacher) {
    mainRow.addSpacer(6)
    const tc = mainRow.addText(nxTeacher)
    tc.font      = Font.systemFont(10)
    tc.textColor = C.teacherAbbr
  }

  mainRow.addSpacer()
  const timeRange = mainRow.addText(`${fmtTime(brk.next.start)}–${fmtTime(brk.next.end)}`)
  timeRange.font      = Font.systemFont(10)
  timeRange.textColor = C.secondary

  // Location — plain text, no emoji
  const isHiddenLoc = isHiddenLocation(brk.next.location)
  if (!isHiddenLoc) {
    content.addSpacer(3)
    const loc = content.addText(brk.next.location)
    loc.font      = Font.systemFont(9)
    loc.textColor = C.secondary
  }
}

function renderTussenuurRow(w, placeholder) {
  const row = w.addStack()
  row.backgroundColor = C.tussenuurCard
  row.cornerRadius    = 5
  row.setPadding(4, 10, 4, 10)
  row.layoutHorizontally()
  row.centerAlignContent()
  const periodStr = placeholder.fromPeriod === placeholder.toPeriod
    ? `uur ${placeholder.fromPeriod}`
    : `uur ${placeholder.fromPeriod}–${placeholder.toPeriod}`
  const txt = row.addText(`Tussenuur  ·  ${periodStr}`)
  txt.font      = Font.systemFont(10)
  txt.textColor = C.tussenuurText
}

// ── Two-column lesson grid.
//    Pairs lessons side-by-side with a thin vertical divider.
//    Tussenuur placeholders always render full-width.
//    Unpaired lessons (odd count or next to tussenuur) render full-width.
function renderLessonGrid(w, events, sectionHeader) {
  const shown         = Math.min(events.length, SETTINGS.maxLaterLessons)
  const lessonsToShow = events.slice(0, shown)
  const items         = insertTussenuurPlaceholders(lessonsToShow)

  const hdr = w.addText(sectionHeader)
  hdr.font      = Font.boldSystemFont(8)
  hdr.textColor = C.secondary
  w.addSpacer(5)

  let i        = 0
  let rowCount = 0

  while (i < items.length) {
    const a = items[i]

    // Tussenuur — always full width
    if (a.isTussenuur) {
      renderTussenuurRow(w, a)
      w.addSpacer(4)
      i++
      rowCount++
      continue
    }

    // Peek at the next item — only pair if it's a real lesson (not tussenuur)
    const nextItem = i + 1 < items.length ? items[i + 1] : null
    const b        = (nextItem && !nextItem.isTussenuur) ? nextItem : null

    if (b) {
      // ── Two-column row
      const rowStack = w.addStack()
      rowStack.layoutHorizontally()
      rowStack.topAlignContent()

      // Left cell — fixed width for consistent columns
      const leftCell = rowStack.addStack()
      leftCell.layoutVertically()
      leftCell.size = new Size(GRID_CELL_W, 0)
      renderMiniLessonCell(leftCell, a)

      // Thin vertical divider — fixed height approximating row height
      rowStack.addSpacer(6)
      const vdiv = rowStack.addStack()
      vdiv.backgroundColor = C.colDivider
      vdiv.size = new Size(1, 22)
      rowStack.addSpacer(6)

      // Right cell — fills remaining width
      const rightCell = rowStack.addStack()
      rightCell.layoutVertically()
      renderMiniLessonCell(rightCell, b)

      i += 2
    } else {
      // ── Single lesson — full width row
      const fullRow = w.addStack()
      fullRow.layoutVertically()
      renderMiniLessonCell(fullRow, a)

      i++
    }

    w.addSpacer(5)
    rowCount++
  }

  if (events.length > SETTINGS.maxLaterLessons) {
    const more = w.addText(`+${events.length - SETTINGS.maxLaterLessons} more`)
    more.font      = Font.systemFont(9)
    more.textColor = C.secondary
  }

  const tussenuurCount = items.filter(x => x.isTussenuur).length
  return 1 + Math.ceil(shown / 2) + tussenuurCount
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

  w.addSpacer(7)
  const divider = w.addStack()
  divider.backgroundColor = C.divider
  divider.size = new Size(0, 1)
  w.addSpacer(6)

  const hdr = w.addText("DEADLINES & REMINDERS")
  hdr.font      = Font.boldSystemFont(8)
  hdr.textColor = C.secondary
  w.addSpacer(5)

  for (const item of combined) {
    const row = w.addStack()
    row.layoutHorizontally()
    row.centerAlignContent()
    row.setPadding(2, 0, 2, 0)
    row.url = item.url

    const icon = row.addText(item.icon + " ")
    icon.font      = Font.systemFont(12)
    icon.textColor = C.secondary

    const name = row.addText(item.name)
    name.font      = Font.systemFont(12)
    name.textColor = C.primary
    name.lineLimit = 1

    row.addSpacer()

    if (item.days !== null) {
      const { text, color } = deadlineDisplay(item.days, item.rawDate)
      const lbl = row.addText(text)
      lbl.font      = Font.boldSystemFont(11)
      lbl.textColor = color
    } else {
      const lbl = row.addText("No date")
      lbl.font      = Font.systemFont(11)
      lbl.textColor = C.secondary
    }

    w.addSpacer(3)
  }
}

// ─────────────────────────────────────────
//  BUILD WIDGET
// ─────────────────────────────────────────

async function buildWidget() {
  const w = new ListWidget()
  w.setPadding(14, 14, 14, 14)
  w.refreshAfterDate = new Date(Date.now() + SETTINGS.refreshMinutes * 60 * 1000)
  w.url = TAP_URL

  // Background gradient — deep ocean: near-black at top, slightly lighter at bottom
  const grad = new LinearGradient()
  grad.colors    = [new Color("#07101c"), new Color("#091628")]
  grad.locations = [0.0, 1.0]
  w.backgroundGradient = grad

  const now = new Date()

  // ── Fetch (before header so fromCache is known for the sync dot colour)
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

  // ── Header (2 slots)
  let slotsUsed = 2

  w.addSpacer(4)

  // Header row: date (left) · sync indicator (right)
  const header = w.addStack()
  header.layoutHorizontally()
  header.centerAlignContent()

  const dateTxt = header.addText(
    now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
  )
  dateTxt.font      = Font.boldSystemFont(18)
  dateTxt.textColor = C.primary

  header.addSpacer()

  let syncLabel = ""
  try {
    const cached = loadCache()
    if (cached?.fetchedAt) {
      const syncedAt = new Date(cached.fetchedAt)
      syncLabel = syncedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    }
  } catch {}

  const syncDot = header.addText("● ")
  syncDot.font      = Font.systemFont(7)
  syncDot.textColor = fromCache ? C.warning : C.breakAccent
  if (syncLabel) {
    const syncTxt = header.addText(syncLabel)
    syncTxt.font      = Font.systemFont(9)
    syncTxt.textColor = new Color("#152535")
  }

  w.addSpacer(10)

  if (error) {
    const t = w.addText("⚠ Could not load data")
    t.textColor = C.error
    t.font      = Font.systemFont(13)
    return w
  }

  if (fromCache) {
    const offlineTxt = w.addText("Offline — using cached schedule")
    offlineTxt.font      = Font.systemFont(10)
    offlineTxt.textColor = C.warning
    w.addSpacer(6)
    slotsUsed += 1
  }

  // ── Schedule logic
  const todayAll  = eventsOnDate(allEvents, now)
  const current   = todayAll.find(e => now >= e.start && now < e.end)
  const todayDone = todayAll.length > 0 && todayAll.every(e => e.end <= now)
  const noLessons = todayAll.length === 0

  // CASE 1: Currently in a lesson
  if (current) {
    const mins     = Math.round((current.end - now) / 60000)
    const progress = (now - current.start) / (current.end - current.start)
    renderLessonCard(w, current, "NOW", C.accent, C.card, `${mins} min remaining`, progress)
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
      slotsUsed += renderLessonGrid(w, laterToday, "LATER TODAY")
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
        slotsUsed += renderLessonGrid(w, afterBreak, "LATER TODAY")
      }
    } else {
      const next = todayAll.find(e => e.start > now)
      const mins = Math.round((next.start - now) / 60000)
      renderLessonCard(w, next, "NEXT LESSON", C.accent, C.card, `Starts in ${mins} min`)
      slotsUsed += cardSlots(next)
      const rest = todayAll.filter(e => e.start > next.start)
      if (rest.length > 0) {
        w.addSpacer(8)
        slotsUsed += renderLessonGrid(w, rest, "LATER TODAY")
      }
    }

  // CASE 3: Today done or no lessons
  } else {
    if (noLessons) {
      const dow    = now.getDay() // 0 = Sunday, 6 = Saturday
      const label  = (dow === 0 || dow === 6) ? "WEEKEND" : "HOLIDAY"
      const lbl    = w.addText(label)
      lbl.font      = Font.boldSystemFont(13)
      lbl.textColor = C.nextAccent
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
        ""
      )
      slotsUsed += cardSlots(firstLesson)
      const restOfNextDay = nextDayEvts.slice(1)
      if (restOfNextDay.length > 0) {
        w.addSpacer(8)
        slotsUsed += renderLessonGrid(w, restOfNextDay, `${label} — REST OF DAY`)
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