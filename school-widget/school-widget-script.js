// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: magic;
// ─────────────────────────────────────────
//  SCHOOL WIDGET — Magister schedule + deadlines
//  Scriptable • Large widget recommended
//  v5: Deep Ocean · two-column grid · slim cards
// ─────────────────────────────────────────

let ICAL_URL            = ""         // loaded from Config/school-widget-config.json
let CAL_NAME_DEADLINES  = "School"   // overridden by config calendarName
let CAL_NAME_REMINDERS  = "School"   // overridden by config remindersName
let TAP_URL             = "magister://" // overridden by config tapUrl
const CACHE_FOLDER = "Cache"
const CACHE_FILE   = "school_ical.json"

const SETTINGS = {
  refreshFallbackMinutes: 30,
  maxLaterLessons:   6,   // increased — two-column grid fits more
  // Ceiling only — the real limiter is the leftover slot budget (see buildWidget),
  // so on light lesson days the Due section grows to fill the empty space (#8).
  maxDeadlines:      8,
  pastDays:          30,
  futureDays:        30,
  nextDayLookAhead:  30,
}

// Widget slot budget.
// Large widget ≈ 22 slots total with the new slimmer card sizes.
let WIDGET_SLOTS        = 20
const DEADLINE_OVERHEAD = 2
const DEADLINE_SLOTS    = 1   // compact deadline rows cost 1 slot each

// ── Extra-large widget (iPad only)
// config.widgetFamily === "extraLarge" when placed as an extra-large iPad widget.
// Patching let-declared constants here before any render code runs.
const IS_EXTRA_LARGE = config.widgetFamily === "extraLarge"
if (IS_EXTRA_LARGE) {
  SETTINGS.maxLaterLessons = 12  // two-column grid, up to ~6 rows
  SETTINGS.maxDeadlines    = 14  // ceiling; right column fills with due items (#8/#1)
  WIDGET_SLOTS             = 42  // ~2× large slot budget
}

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
  let dashIdx = summary.indexOf(" - ")
  if (dashIdx < 0) dashIdx = summary.indexOf(" — ")
  let teacher, subjectPart
  if (dashIdx >= 0) {
    teacher     = summary.slice(dashIdx + 3).trim()
    subjectPart = summary.slice(0, dashIdx).trim()
  } else {
    const parenMatch = summary.match(/^(.*?)\s*\(([^)]+)\)\s*$/)
    if (parenMatch) {
      teacher     = parenMatch[2].trim()
      subjectPart = parenMatch[1].trim()
    } else {
      teacher     = null
      subjectPart = summary.trim()
    }
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
//  THEMES — Deep Ocean (dark) · Morning Fog (light)
// ─────────────────────────────────────────

const DARK_THEME = {
  bg:            new Color("#07101c"),
  bgGradientEnd: new Color("#091628"),
  card:          new Color("#0c1a2e"),
  deadlineCard:  new Color("#0e1f35"),
  breakCard:     new Color("#081a0f"),
  nextDayCard:   new Color("#0f0b22"),
  accent:        new Color("#22d3ee"),
  breakAccent:   new Color("#4ade80"),
  nextAccent:    new Color("#818cf8"),
  primary:       new Color("#dde8f8"),
  secondary:     new Color("#253d58"),
  teacherAbbr:   new Color("#1a3048"),
  done:          new Color("#4ade80"),
  urgent:        new Color("#f87171"),
  warning:       new Color("#fb923c"),
  error:         new Color("#f87171"),
  periodBg:      new Color("#0e2035"),
  periodText:    new Color("#38bdf8"),
  tussenuurCard: new Color("#0a1422"),
  tussenuurText: new Color("#162232"),
  testCard:      new Color("#1c0e18"),
  cancelledCard: new Color("#090e16"),
  cancelledText: new Color("#162232"),
  divider:       new Color("#0e2030"),
  colDivider:    new Color("#112030"),
  sectionLabel:  new Color("#3a5a7a"),
}

const LIGHT_THEME = {
  bg:            new Color("#f0ede8"),
  bgGradientEnd: new Color("#e8e4de"),
  card:          new Color("#ffffff"),
  deadlineCard:  new Color("#f7f5f2"),
  breakCard:     new Color("#f0faf4"),
  nextDayCard:   new Color("#f5f3ff"),
  accent:        new Color("#0891b2"),
  breakAccent:   new Color("#16a34a"),
  nextAccent:    new Color("#6366f1"),
  primary:       new Color("#1a2535"),
  secondary:     new Color("#7a8fa8"),
  teacherAbbr:   new Color("#9ca3af"),
  done:          new Color("#16a34a"),
  urgent:        new Color("#dc2626"),
  warning:       new Color("#d97706"),
  error:         new Color("#dc2626"),
  periodBg:      new Color("#e0f2fe"),
  periodText:    new Color("#0369a1"),
  tussenuurCard: new Color("#f8fafc"),
  tussenuurText: new Color("#cbd5e1"),
  testCard:      new Color("#fff1f2"),
  cancelledCard: new Color("#f8fafc"),
  cancelledText: new Color("#d1d5db"),
  divider:       new Color("#e5e7eb"),
  colDivider:    new Color("#e5e7eb"),
  sectionLabel:  new Color("#9aabbf"),
}

let C = DARK_THEME

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
    const httpUrl = url.replace(/^webcal:\/\//i, "https://")
    const req = new Request(httpUrl)
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
  const cal     = allCals.find(c => c.title === CAL_NAME_DEADLINES)
  if (!cal) return []
  const now    = new Date()
  const past   = new Date(now.getTime() - SETTINGS.pastDays   * 86400000)
  const future = new Date(now.getTime() + SETTINGS.futureDays * 86400000)
  const evts   = await CalendarEvent.between(past, future, [cal])
  return evts
    .filter(e => e.isAllDay)
    .sort((a, b) => a.startDate - b.startDate)
    .slice(0, 14)
}

async function fetchReminders() {
  const allLists = await Calendar.forReminders()
  const list     = allLists.find(c => c.title === CAL_NAME_REMINDERS)
  if (!list) return []
  const all = await Reminder.all([list])
  return all
    .filter(r => !r.isCompleted)
    .sort((a, b) => (a.dueDate || new Date(9999, 0, 1)) - (b.dueDate || new Date(9999, 0, 1)))
    .slice(0, 14)
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
  return !loc || loc === "verborgen"
}

function detectCurrentGap(todayAll, now) {
  const past   = todayAll.filter(e => e.end   <= now)
  const future = todayAll.filter(e => e.start >  now)
  if (!past.length || !future.length) return null
  const lastDone = past[past.length - 1]
  const nextUp   = future[0]
  const totalMin = Math.round((nextUp.start - lastDone.end) / 60000)
  if (totalMin < 1) return null

  const { period: pA } = parseSummary(lastDone.summary)
  const { period: pB } = parseSummary(nextUp.summary)
  const hasPeriodGap   = pA !== null && pB !== null && pB > pA + 1

  return {
    type:       hasPeriodGap ? 'tussenuur' : 'break',
    total:      totalMin,
    remaining:  Math.round((nextUp.start - now) / 60000),
    next:       nextUp,
    fromPeriod: hasPeriodGap ? pA + 1 : null,
    toPeriod:   hasPeriodGap ? pB - 1 : null,
  }
}

// Inserts tussenuur placeholders between events that skip one or more lesuren.
// Breaks (pauze) produce no placeholder — they are invisible in the grid.
function insertGapPlaceholders(events) {
  const result = []
  for (let i = 0; i < events.length; i++) {
    result.push(events[i])
    if (i < events.length - 1) {
      const { period: pA } = parseSummary(events[i].summary)
      const { period: pB } = parseSummary(events[i + 1].summary)
      if (pA !== null && pB !== null && pB > pA + 1) {
        result.push({
          isTussenuur: true,
          start:       events[i].end,
          end:         events[i + 1].start,
          fromPeriod:  pA + 1,
          toPeriod:    pB - 1,
        })
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

// Returns sorted future transition times for today's events: start, midpoint, end per lesson.
function computeTransitions(todayEvents, now) {
  const times = []
  for (const ev of todayEvents) {
    const mid = new Date((ev.start.getTime() + ev.end.getTime()) / 2)
    times.push(ev.start, mid, ev.end)
  }
  return times.filter(t => t > now).sort((a, b) => a - b)
}

// ─────────────────────────────────────────
//  RENDER FUNCTIONS
// ─────────────────────────────────────────

// Fixed width for the left cell in the two-column lesson grid.
// Approximates half the large widget's content area (≈ 311px total - 13px dividers = 298, /2 ≈ 149).
// For extra-large the timetable lives in a left column (XL_LEFT_W wide) and renders one
// lesson per row, so CARD_CONTENT_W (progress bar) tracks that narrower column.
let GRID_CELL_W    = IS_EXTRA_LARGE ? 165 : 142
let CARD_CONTENT_W = IS_EXTRA_LARGE ? 330 : 280

// Extra-large two-column split (iPad). Widths are estimates — fine-tune on device (#1).
const XL_LEFT_W  = 360   // timetable column width in points
const XL_COL_GAP = 16    // gap between timetable and Due columns

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
  } else {
    const p = mainRow.addStack()
    p.backgroundColor = C.periodBg
    p.cornerRadius    = 4
    p.setPadding(1, 5, 1, 5)
    p.size = new Size(19, 13)
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
    subRow.addSpacer(24) // indent under pill
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
  if (countdown) {
    topRow.addSpacer()
    const ctd = topRow.addText(countdown)
    ctd.font      = Font.systemFont(10)
    ctd.textColor = accentColor
  }

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
    filled.size = new Size(filledFraction * CARD_CONTENT_W, 3)
    // Remaining portion
    const remaining = barOuter.addStack()
    remaining.backgroundColor = C.secondary
    remaining.size = new Size((1 - filledFraction) * CARD_CONTENT_W, 3)
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

  // Single lesuur → show block number; multiple → show time span
  const isSingle = placeholder.fromPeriod === placeholder.toPeriod
  const detail   = isSingle
    ? `uur ${placeholder.fromPeriod}`
    : `${fmtTime(placeholder.start)}–${fmtTime(placeholder.end)}`

  const txt = row.addText(`Tussenuur  ·  ${detail}`)
  txt.font      = Font.systemFont(10)
  txt.textColor = C.secondary
}

function renderTussenuurCard(w, gap) {
  const { subject: nxSubject, teacher: nxTeacher, period: nxPeriod } = parseSummary(gap.next.summary)

  const card = w.addStack()
  card.backgroundColor = C.card
  card.cornerRadius    = 12
  card.layoutHorizontally()
  card.topAlignContent()
  card.setPadding(0, 0, 0, 0)

  const strip = card.addStack()
  strip.backgroundColor = C.nextAccent
  strip.size = new Size(4, 0)

  card.addSpacer(10)

  const content = card.addStack()
  content.layoutVertically()
  content.setPadding(8, 0, 8, 12)

  // Row 1: TUSSENUUR · period · spacer · X min left
  const topRow = content.addStack()
  topRow.layoutHorizontally()
  topRow.centerAlignContent()
  const lbl = topRow.addText("TUSSENUUR")
  lbl.font      = Font.boldSystemFont(8)
  lbl.textColor = C.nextAccent

  if (gap.fromPeriod !== null && gap.toPeriod !== null) {
    topRow.addSpacer(6)
    const pStr = gap.fromPeriod === gap.toPeriod
      ? `uur ${gap.fromPeriod}`
      : `uur ${gap.fromPeriod}–${gap.toPeriod}`
    const per = topRow.addText(pStr)
    per.font      = Font.systemFont(9)
    per.textColor = C.secondary
  }

  topRow.addSpacer()
  const rem = topRow.addText(`${gap.remaining} min left`)
  rem.font      = Font.mediumSystemFont(10)
  rem.textColor = C.nextAccent

  content.addSpacer(5)

  // Row 2: period pill · Next: subject · teacher · time range
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
  const timeRange = mainRow.addText(`${fmtTime(gap.next.start)}–${fmtTime(gap.next.end)}`)
  timeRange.font      = Font.systemFont(10)
  timeRange.textColor = C.secondary

  const isHiddenLoc = isHiddenLocation(gap.next.location)
  if (!isHiddenLoc) {
    content.addSpacer(3)
    const loc = content.addText(gap.next.location)
    loc.font      = Font.systemFont(9)
    loc.textColor = C.secondary
  }
}

// ── Two-column lesson grid.
//    Pairs lessons side-by-side with a thin vertical divider.
//    Tussenuur placeholders always render full-width.
//    Unpaired lessons (odd count or next to tussenuur) render full-width.
function renderLessonGrid(w, events, sectionHeader, singleCol = false) {
  const shown         = Math.min(events.length, SETTINGS.maxLaterLessons)
  const lessonsToShow = events.slice(0, shown)
  const items         = insertGapPlaceholders(lessonsToShow)

  if (sectionHeader) {
    const hdr = w.addText(sectionHeader)
    hdr.font      = Font.boldSystemFont(8)
    hdr.textColor = C.secondary
    w.addSpacer(5)
  }

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

    // Single-column mode (narrow XL left column): one full-width lesson per row.
    if (singleCol) {
      const cell = w.addStack()
      cell.layoutVertically()
      renderMiniLessonCell(cell, a)
      i++
      w.addSpacer(5)
      rowCount++
      continue
    }

    // Peek at the next item — only pair if it's a real lesson (not a placeholder)
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
      // ── Single lesson — aligned under right column
      const rowStack = w.addStack()
      rowStack.layoutHorizontally()
      rowStack.topAlignContent()

      const spacer = rowStack.addStack()
      spacer.size = new Size(GRID_CELL_W + 13, 0)

      const rightCell = rowStack.addStack()
      rightCell.layoutVertically()
      renderMiniLessonCell(rightCell, a)

      i++
    }

    w.addSpacer(5)
    rowCount++
  }

  const lessonOverflow = events.length > SETTINGS.maxLaterLessons
    ? events.length - SETTINGS.maxLaterLessons
    : 0

  const tussenuurCount = items.filter(x => x.isTussenuur).length
  return [1 + Math.ceil(shown / 2) + tussenuurCount, lessonOverflow]
}

function renderDeadlines(w, deadlines, reminders, maxItems, lessonOverflow = 0) {
  const all = [
    ...deadlines.map(e => ({
      name:    e.title,
      days:    daysUntil(e.startDate),
      rawDate: e.startDate,
      isReminder: false,
      url:     `calshow://${toCalShowTime(e.startDate)}`,
    })),
    ...reminders.map(r => ({
      name:    r.title,
      days:    r.dueDate ? daysUntil(r.dueDate) : null,
      rawDate: r.dueDate,
      isReminder: true,
      url:     "x-apple-reminder://",
    })),
  ].sort((a, b) => (a.days ?? 999) - (b.days ?? 999))

  if (!all.length) return

  const overflow = all.length - maxItems
  const showMore = overflow > 0
  const combined = showMore ? all.slice(0, maxItems - 1) : all.slice(0, maxItems)

  w.addSpacer(4)

  // Section header: "+X more" (left, lesson overflow) · flex · "DUE" · "X items" (right)
  const hdrRow = w.addStack()
  hdrRow.layoutHorizontally()
  hdrRow.centerAlignContent()
  const hdrTxt = hdrRow.addText("DUE")
  hdrTxt.font      = Font.boldSystemFont(11)
  hdrTxt.textColor = C.primary
  hdrRow.addSpacer(8)
  const hdrCount = hdrRow.addText(`${all.length} item${all.length === 1 ? "" : "s"}`)
  hdrCount.font      = Font.systemFont(8)
  hdrCount.textColor = C.sectionLabel
  hdrRow.addSpacer()
  if (lessonOverflow > 0) {
    const moreTxt = hdrRow.addText(`+${lessonOverflow} more`)
    moreTxt.font      = Font.systemFont(9)
    moreTxt.textColor = C.secondary
  }
  w.addSpacer(5)

  for (const item of combined) {
    const { text: dueText, color: dueColor } = item.days !== null
      ? deadlineDisplay(item.days, item.rawDate)
      : { text: "No date", color: C.secondary }

    // Card with left accent strip
    const card = w.addStack()
    card.backgroundColor = C.deadlineCard
    card.cornerRadius    = 8
    card.layoutHorizontally()
    card.topAlignContent()
    card.url = item.url

    // Left strip — colour signals urgency
    const strip = card.addStack()
    strip.backgroundColor = dueColor
    strip.size = new Size(3, 0)

    card.addSpacer(9)

    const content = card.addStack()
    content.layoutVertically()
    content.setPadding(6, 0, 6, 9)

    const mainRow = content.addStack()
    mainRow.layoutHorizontally()
    mainRow.centerAlignContent()

    // Type dot: calendar vs reminder
    const dotChar = item.isReminder ? "◻ " : "◆ "
    const dotTxt = mainRow.addText(dotChar)
    dotTxt.font      = Font.boldSystemFont(7)
    dotTxt.textColor = dueColor

    const nameTxt = mainRow.addText(item.name)
    nameTxt.font      = Font.systemFont(11)
    nameTxt.textColor = C.primary
    nameTxt.lineLimit = 1

    mainRow.addSpacer()

    const dueLbl = mainRow.addText(dueText)
    dueLbl.font      = Font.boldSystemFont(10)
    dueLbl.textColor = dueColor

    w.addSpacer(3)
  }

  if (showMore) {
    w.addSpacer(1)
    const moreRow = w.addStack()
    moreRow.layoutHorizontally()
    moreRow.addSpacer()
    const more = moreRow.addText(`+${overflow + 1} more`)
    more.font      = Font.systemFont(10)
    more.textColor = C.sectionLabel
  }
}

// ─────────────────────────────────────────
//  TOMORROW SECTION (extra-large only)
// ─────────────────────────────────────────

// Renders a compact preview of tomorrow's lessons.
// Only shown when nextDay is literally tomorrow — Case 3 (today done) already
// shows the next school day as its primary content, so we skip it there.
function renderTomorrowSection(w, allEvents, now) {
  const nextDay = nextDayWithLessons(allEvents, now)
  if (!nextDay) return 0

  // Bail if next school day is not actually tomorrow (gap of 2+ days)
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (nextDay.toDateString() !== tomorrow.toDateString()) return 0

  const evts = eventsOnDate(allEvents, nextDay)
  if (!evts.length) return 0

  let slots = 0
  w.addSpacer(10)

  // Section header
  const hdr = w.addText("TOMORROW")
  hdr.font      = Font.boldSystemFont(8)
  hdr.textColor = C.sectionLabel
  w.addSpacer(4)
  slots += 1

  // Featured first lesson using the "next day" accent colour
  renderLessonCard(w, evts[0], "TOMORROW", C.nextAccent, C.nextDayCard, "")
  slots += cardSlots(evts[0])

  // Rest as a grid, capped at 4 to leave room for deadlines
  const rest = evts.slice(1, 5)
  if (rest.length > 0) {
    w.addSpacer(6)
    // Tomorrow preview lives in the narrow XL left column → single-column grid.
    const [gridSlots] = renderLessonGrid(w, rest, "", true)
    slots += gridSlots
  }
  return slots
}

// ─────────────────────────────────────────
//  BUILD WIDGET
// ─────────────────────────────────────────

async function buildWidget() {
  const isDark = Device.isUsingDarkAppearance()
  C = isDark ? DARK_THEME : LIGHT_THEME

  const w = new ListWidget()
  w.setPadding(10, 14, 10, 14)
  w.refreshAfterDate = new Date(Date.now() + SETTINGS.refreshFallbackMinutes * 60 * 1000)
  w.url = TAP_URL

  const grad = new LinearGradient()
  grad.colors    = [C.bg, C.bgGradientEnd]
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

  w.addSpacer(2)

  // Header row: date (left) · sync indicator (right)
  const header = w.addStack()
  header.layoutHorizontally()
  header.centerAlignContent()

  const dateTxt = header.addText(
    now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
  )
  dateTxt.font      = Font.boldSystemFont(14)
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
  syncDot.font      = Font.systemFont(8)
  syncDot.textColor = fromCache ? C.warning : C.breakAccent
  if (syncLabel) {
    const syncTxt = header.addText(syncLabel)
    syncTxt.font      = Font.boldSystemFont(11)
    syncTxt.textColor = fromCache ? C.warning : new Color("#6b8aaa")
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
  let lastGridOverflow = 0
  const todayAll  = eventsOnDate(allEvents, now)
  const current   = todayAll.find(e => now >= e.start && now < e.end)
  const todayDone = todayAll.length > 0 && todayAll.every(e => e.end <= now)
  const noLessons = todayAll.length === 0

  // Override refresh: next lesson-transition boundary, capped at fallback interval.
  const transitions = computeTransitions(todayAll, now)
  const maxRefresh  = new Date(now.getTime() + SETTINGS.refreshFallbackMinutes * 60 * 1000)
  if (transitions.length > 0 && transitions[0] < maxRefresh) {
    w.refreshAfterDate = transitions[0]
  }

  // ── Layout targets. Extra-large (iPad) splits into two columns: left = timetable,
  //    right = Due. Every other size renders single-column (sched === due === w). (#1)
  let sched = w, due = w
  if (IS_EXTRA_LARGE) {
    const columns = w.addStack()
    columns.layoutHorizontally()
    columns.topAlignContent()
    sched = columns.addStack()
    sched.layoutVertically()
    sched.size = new Size(XL_LEFT_W, 0)
    columns.addSpacer(XL_COL_GAP)
    due = columns.addStack()
    due.layoutVertically()
  }
  // Narrow XL left column can't fit two lessons side-by-side → one per row.
  const gridSingleCol = IS_EXTRA_LARGE

  // CASE 1: Currently in a lesson
  if (current) {
    const mins     = Math.round((current.end - now) / 60000)
    const progress = (now - current.start) / (current.end - current.start)
    renderLessonCard(sched, current, "NOW", C.accent, C.card, null, progress)
    slotsUsed += cardSlots(current)

    const afterCurrent = todayAll.filter(e => e.start >= current.end)
    if (afterCurrent.length > 0) {
      const nextEv = afterCurrent[0]
      const gapMin = Math.round((nextEv.start - current.end) / 60000)
      if (gapMin > 0) {
        const { period: pA } = parseSummary(current.summary)
        const { period: pB } = parseSummary(nextEv.summary)
        const hasTussenuur   = pA !== null && pB !== null && pB > pA + 1
        sched.addSpacer(5)
        if (hasTussenuur) {
          const pStr = (pA + 1 === pB - 1) ? `uur ${pA + 1}` : `uur ${pA + 1}–${pB - 1}`
          const note = sched.addText(`Tussenuur after this  ·  ${pStr}`)
          note.font      = Font.systemFont(10)
          note.textColor = C.nextAccent
        } else {
          const note = sched.addText(`Pauze after this  ·  ${gapMin} min`)
          note.font      = Font.systemFont(10)
          note.textColor = C.breakAccent
        }
        slotsUsed += 1
      }
    }

    const laterToday = todayAll.filter(e => e.start > now)
    if (laterToday.length > 0) {
      sched.addSpacer(8)
      const [gridSlots, gridOverflow] = renderLessonGrid(sched, laterToday, "LATER TODAY", gridSingleCol)
      slotsUsed += gridSlots
      lastGridOverflow = gridOverflow
    }

  // CASE 2: In a gap (break or tussenuur) or before first lesson
  } else if (!current && !todayDone && !noLessons) {
    const gap = detectCurrentGap(todayAll, now)

    if (gap) {
      if (gap.type === 'tussenuur') {
        renderTussenuurCard(sched, gap)
      } else {
        renderBreakCard(sched, gap)
      }
      slotsUsed += cardSlots(gap.next)
      const afterGap = todayAll.filter(e => e.start > gap.next.start)
      if (afterGap.length > 0) {
        sched.addSpacer(8)
        const [gridSlots, gridOverflow] = renderLessonGrid(sched, afterGap, "LATER TODAY", gridSingleCol)
        slotsUsed += gridSlots
        lastGridOverflow = gridOverflow
      }
    } else {
      const next = todayAll.find(e => e.start > now)
      const mins = Math.round((next.start - now) / 60000)
      renderLessonCard(sched, next, "NEXT LESSON", C.accent, C.card, `Starts in ${mins} min`)
      slotsUsed += cardSlots(next)
      const rest = todayAll.filter(e => e.start > next.start)
      if (rest.length > 0) {
        sched.addSpacer(8)
        const [gridSlots, gridOverflow] = renderLessonGrid(sched, rest, "LATER TODAY", gridSingleCol)
        slotsUsed += gridSlots
        lastGridOverflow = gridOverflow
      }
    }

  // CASE 3: Today done or no lessons
  } else {
    if (noLessons) {
      const dow    = now.getDay() // 0 = Sunday, 6 = Saturday
      const label  = (dow === 0 || dow === 6) ? "WEEKEND" : "HOLIDAY"
      const lbl    = sched.addText(label)
      lbl.font      = Font.boldSystemFont(13)
      lbl.textColor = C.nextAccent
    } else {
      const t = sched.addText("✓ Done for today")
      t.font      = Font.systemFont(9)
      t.textColor = C.done
    }
    slotsUsed += 1

    const nextDay     = nextDayWithLessons(allEvents, now)
    const nextDayEvts = nextDay ? eventsOnDate(allEvents, nextDay) : []

    if (nextDay && nextDayEvts.length > 0) {
      sched.addSpacer(8)
      const label       = dayLabel(nextDay)
      const firstLesson = nextDayEvts[0]
      renderLessonCard(
        sched,
        firstLesson,
        label,
        C.nextAccent,
        C.nextDayCard,
        ""
      )
      slotsUsed += cardSlots(firstLesson)
      const restOfNextDay = nextDayEvts.slice(1)
      if (restOfNextDay.length > 0) {
        sched.addSpacer(8)
        const [gridSlots, gridOverflow] = renderLessonGrid(sched, restOfNextDay, "", gridSingleCol)
        slotsUsed += gridSlots
        lastGridOverflow = gridOverflow
      }
    } else {
      sched.addSpacer(6)
      const t = sched.addText("No upcoming lessons in the next 30 days")
      t.font      = Font.systemFont(11)
      t.textColor = C.secondary
      slotsUsed += 1
    }
  }

  // ── Tomorrow preview (extra-large + Cases 1/2/3 where today isn't done)
  // Case 3 (today done/no lessons) already shows next school day as primary content.
  if (IS_EXTRA_LARGE && !todayDone && !noLessons) {
    slotsUsed += renderTomorrowSection(sched, allEvents, now)
  }

  // ── How many deadline items to show.
  // XL: the Due column has its own space, so fill it up to the ceiling.
  // Other sizes: bounded by the leftover vertical slot budget.
  let maxDeadlines
  if (IS_EXTRA_LARGE) {
    maxDeadlines = SETTINGS.maxDeadlines
  } else {
    const remainingSlots = WIDGET_SLOTS - slotsUsed - DEADLINE_OVERHEAD
    maxDeadlines = Math.min(
      SETTINGS.maxDeadlines,
      Math.max(1, Math.floor(remainingSlots / DEADLINE_SLOTS))
    )
  }

  // In the two-column layout the lesson overflow note belongs under the timetable,
  // not the Due header — so suppress it there.
  renderDeadlines(due, deadlines, reminders, maxDeadlines, IS_EXTRA_LARGE ? 0 : lastGridOverflow)

  w.addSpacer(4)
  return w
}

// ─────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────

async function loadConfig() {
  const fm   = FileManager.iCloud()
  const path = fm.joinPath(fm.documentsDirectory(), "Config/school-widget-config.json")
  if (!fm.fileExists(path)) throw new Error("Config/school-widget-config.json not found — copy the .example file and fill in your Magister iCal URL")
  await fm.downloadFileFromiCloud(path)
  const data = JSON.parse(fm.readString(path))
  if (!data.icalUrl || data.icalUrl === "YOUR_ICAL_FEED_URL") throw new Error("Set icalUrl in Config/school-widget-config.json")
  ICAL_URL           = data.icalUrl
  CAL_NAME_DEADLINES = data.calendarName  ?? CAL_NAME_DEADLINES
  CAL_NAME_REMINDERS = data.remindersName ?? CAL_NAME_DEADLINES
  if (data.tapUrl)   TAP_URL = data.tapUrl
}

// ─────────────────────────────────────────
//  RUN
// ─────────────────────────────────────────

await loadConfig()
const widget = await buildWidget()
if (config.runsInWidget) {
  Script.setWidget(widget)
} else if (IS_EXTRA_LARGE) {
  await widget.presentExtraLarge()
} else {
  await widget.presentLarge()
}
Script.complete()