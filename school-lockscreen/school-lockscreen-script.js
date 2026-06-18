// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: blue; icon-glyph: graduation-cap;
// ─────────────────────────────────────────
//  SCHOOL LOCKSCREEN — Rectangular lockscreen widget
//  Shows current + next class from Magister iCal feed
// ─────────────────────────────────────────

let ICAL_URL = ""  // loaded from Config/school-lockscreen-config.json

const CACHE_FOLDER    = "Cache"
const CACHE_FILE      = "school-lockscreen-cache.json"
const LOOK_AHEAD_DAYS = 7   // days to scan forward when today has no more lessons
const REFRESH_MINS    = 30  // fallback widget refresh interval in minutes

// ─────────────────────────────────────────
//  SUBJECT NAME MAP  (Magister abbreviation → display name)
// ─────────────────────────────────────────

const SUBJECT_NAMES = {
  netl: "Nederlands",
  ellh: "Engels",
  el:   "Engels",
  econ: "Economie",
  wisb: "Wiskunde B",
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

// ─────────────────────────────────────────
//  UTILITIES
// ─────────────────────────────────────────

// Format a Date as HH:MM
function fmt(date) {
  return date.getHours().toString().padStart(2, "0") + ":" +
         date.getMinutes().toString().padStart(2, "0")
}

// Format as "ma 9 jun" — Dutch abbreviated day + date + month
function fmtDayDate(date) {
  const days   = ["zo","ma","di","wo","do","vr","za"]
  const months = ["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"]
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`
}

// Truncate string to n chars with ellipsis
function capStr(s, n) {
  return s && s.length > n ? s.slice(0, n - 1) + "…" : (s || "")
}

// Minutes between two dates (rounded)
function minsBetween(a, b) {
  return Math.round((b - a) / 60000)
}

// True if the location string is hidden/empty (Magister uses "verborgen")
function isHiddenLocation(loc) {
  return !loc || loc.trim() === "" || loc === "verborgen"
}

// Parse a Magister iCal SUMMARY field into structured data.
// Magister format examples: "wisb 3 - vanderBerg", "netl PW - smit", "ellh uitval"
function parseSummary(summary) {
  if (!summary) return { subject: "", teacher: null, period: null, isTest: false, isCancelled: false }

  const lower       = summary.toLowerCase()
  const isCancelled = /\b(uitval|vervallen|vrij)\b/.test(lower)
  const isTest      = /\b(pw|toets|proefwerk|se)\b/.test(lower)

  // Split on " - " or " — " to get teacher
  let teacher = null, subjectPart = summary.trim()
  const dashIdx = summary.indexOf(" - ") >= 0 ? summary.indexOf(" - ") : summary.indexOf(" — ")
  if (dashIdx >= 0) {
    teacher     = summary.slice(dashIdx + 3).trim()
    subjectPart = summary.slice(0, dashIdx).trim()
  } else {
    const parenMatch = summary.match(/^(.*?)\s*\(([^)]+)\)\s*$/)
    if (parenMatch) {
      teacher     = parenMatch[2].trim()
      subjectPart = parenMatch[1].trim()
    }
  }

  // Extract period number and abbreviation from the subject part
  const words  = subjectPart.split(/\s+/)
  const abbrev = words.find(w => isNaN(w) && w !== "") ?? words[0]

  return {
    subject:     SUBJECT_NAMES[abbrev.toLowerCase()] ?? abbrev,
    teacher:     teacher ? teacher.toLowerCase() : null,
    isCancelled,
    isTest,
  }
}

// ─────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────

async function loadConfig() {
  const fm   = FileManager.iCloud()
  const path = fm.joinPath(fm.documentsDirectory(), "Config/school-lockscreen-config.json")
  if (!fm.fileExists(path)) throw new Error("Config/school-lockscreen-config.json not found — copy the .example file and add your iCal URL")
  await fm.downloadFileFromiCloud(path)
  const data = JSON.parse(fm.readString(path))
  if (!data.icalUrl || data.icalUrl === "YOUR_ICAL_FEED_URL") throw new Error("Set icalUrl in Config/school-lockscreen-config.json")
  ICAL_URL = data.icalUrl
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
    const httpUrl = url.replace(/^webcal:\/\//i, "https://")
    const req     = new Request(httpUrl)
    icalText      = await req.loadString()
    saveCache(icalText)
  } catch {
    const cached = loadCache()
    if (cached?.icalText) { icalText = cached.icalText; fromCache = true }
  }
  if (!icalText) throw new Error("No data and no cache")
  return { events: parseIcal(icalText), fromCache }
}

function parseIcal(text) {
  const events = []
  const lines  = text
    .replace(/\r\n/g, "\n")
    .replace(/\n /g, "")    // unfold continued lines
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
  // UTC suffix → Date.UTC; no suffix → local time (device is set to Amsterdam time)
  return val.endsWith("Z")
    ? new Date(Date.UTC(y, mo, d, h, mi))
    : new Date(y, mo, d, h, mi)
}

// ─────────────────────────────────────────
//  SCHEDULE LOGIC
// ─────────────────────────────────────────

// All non-cancelled events on a given calendar date, sorted by start time
function lessonsOnDate(allEvents, date) {
  const from = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const to   = new Date(from.getTime() + 86400000)
  return allEvents
    .filter(e => e.start >= from && e.start < to && !parseSummary(e.summary).isCancelled)
    .sort((a, b) => a.start - b.start)
}

// Scan forward up to LOOK_AHEAD_DAYS to find the next day that has lessons
function nextDayWithLessons(allEvents, from) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  for (let i = 1; i <= LOOK_AHEAD_DAYS; i++) {
    d.setDate(d.getDate() + 1)
    if (lessonsOnDate(allEvents, new Date(d)).length > 0) return new Date(d)
  }
  return null
}

function getSchedule(allEvents, now) {
  const todayLessons = lessonsOnDate(allEvents, now)
  const current  = todayLessons.find(e => e.start <= now && e.end > now) || null
  const next     = todayLessons.find(e => e.start > now) || null

  // If no more lessons today, look ahead for the next school day
  let nextFuture = null
  if (!next) {
    const nextDay = nextDayWithLessons(allEvents, now)
    if (nextDay) {
      const futureLessons = lessonsOnDate(allEvents, nextDay)
      nextFuture = futureLessons[0] || null
    }
  }

  return { current, next, nextFuture, todayLessons }
}

// Next boundary time used to schedule a precise widget refresh:
// start and end of every today lesson, so the widget updates exactly when class transitions happen
function nextTransition(todayLessons, now) {
  const times = todayLessons.flatMap(e => [e.start, e.end])
  return times.filter(t => t > now).sort((a, b) => a - b)[0] || null
}

// ─────────────────────────────────────────
//  WIDGET RENDERING
// ─────────────────────────────────────────

// Single row: [LABEL]  Subject name  [time]  [room]
// label   — e.g. "NU", "DAN", "VRIJ"
// subject — event title (will be run through parseSummary)
// time    — HH:MM or "ma 9 jun · 08:30" for future days, or "" to omit
// room    — classroom number from event.location, or "" to omit
function addRow(widget, label, subject, time, room) {
  const row = widget.addStack()
  row.layoutHorizontally()
  row.centerAlignContent()

  // Label — small, muted
  const lbl = row.addText(label)
  lbl.font      = Font.boldSystemFont(9)
  lbl.textColor = new Color("#AAAAAA")
  lbl.lineLimit = 1

  row.addSpacer(6)

  // Subject name — bold, truncated shorter when time is shown (needs space)
  const maxLen = time ? 16 : 20
  const sub = row.addText(capStr(subject, maxLen))
  sub.font                = Font.boldSystemFont(13)
  sub.textColor           = Color.white()
  sub.minimumScaleFactor  = 0.75
  sub.lineLimit           = 1

  row.addSpacer(null)  // push time + room to the right

  if (time) {
    const t = row.addText(time)
    t.font      = Font.systemFont(11)
    t.textColor = new Color("#CCCCCC")
    t.lineLimit = 1
    row.addSpacer(5)
  }

  if (room) {
    const r = row.addText(room)
    r.font      = Font.monospacedSystemFont(11)
    r.textColor = new Color("#E2B262")  // gold accent
    r.lineLimit = 1
  }
}

// Single centred message (no-school states)
function addMessage(widget, text) {
  const msg = widget.addText(text)
  msg.font               = Font.systemFont(13)
  msg.textColor          = new Color("#CCCCCC")
  msg.minimumScaleFactor = 0.8
  msg.lineLimit          = 2
}

// ─────────────────────────────────────────
//  RECTANGULAR WIDGET (current + next lesson)
// ─────────────────────────────────────────

function buildRectangular(schedule, now) {
  const { current, next, nextFuture } = schedule
  const widget = new ListWidget()
  widget.backgroundColor = new Color("#000000", 0)  // transparent — iOS vibrant tint handles it

  if (!current && !next) {
    // No more lessons today
    if (nextFuture) {
      addMessage(widget, "Geen les meer vandaag")
      widget.addSpacer(4)
      const { subject } = parseSummary(nextFuture.summary)
      const room    = isHiddenLocation(nextFuture.location) ? "" : capStr(nextFuture.location, 8)
      const timeStr = `${fmtDayDate(nextFuture.start)} · ${fmt(nextFuture.start)}`
      addRow(widget, "DAN", subject, timeStr, room)
    } else {
      const day = now.getDay()
      addMessage(widget, day === 0 || day === 6 ? "Weekend — geen school" : "Geen lessen gepland")
    }

  } else {
    // Row 1 — current lesson or break status
    if (current) {
      const { subject } = parseSummary(current.summary)
      const room = isHiddenLocation(current.location) ? "" : capStr(current.location, 8)
      addRow(widget, "NU", subject, "", room)
    } else {
      // Between lessons — show countdown to next
      const mins  = minsBetween(now, next.start)
      const label = mins <= 5 ? "NU" : "VRIJ"
      addRow(widget, label, `${mins} min vrij`, "", "")
    }

    widget.addSpacer(4)

    // Row 2 — next lesson today, or next future lesson if today is done
    if (next) {
      const { subject } = parseSummary(next.summary)
      const room = isHiddenLocation(next.location) ? "" : capStr(next.location, 8)
      addRow(widget, "DAN", subject, fmt(next.start), room)
    } else if (nextFuture) {
      const { subject } = parseSummary(nextFuture.summary)
      const room    = isHiddenLocation(nextFuture.location) ? "" : capStr(nextFuture.location, 8)
      const timeStr = `${fmtDayDate(nextFuture.start)} · ${fmt(nextFuture.start)}`
      addRow(widget, "DAN", subject, timeStr, room)
    } else {
      addMessage(widget, "Geen lessen meer gepland")
    }
  }
  return widget
}

// ─────────────────────────────────────────
//  CIRCULAR WIDGET (next-lesson countdown ring)
// ─────────────────────────────────────────

// Draws a progress ring with a centred label. Lock-screen widgets are rendered
// monochrome/tinted by iOS, so we draw in white and let the system tint it.
function drawRing(progress, centerText, subText) {
  const size = 200
  const dc = new DrawContext()
  dc.size = new Size(size, size)
  dc.opaque = false
  dc.respectScreenScale = true

  const cx = size / 2, cy = size / 2, lw = 18, r = size / 2 - lw / 2 - 2
  const p  = Math.max(0, Math.min(1, progress))

  // Track
  dc.setStrokeColor(new Color("#FFFFFF", 0.25))
  dc.setLineWidth(lw)
  const track = new Path()
  track.addEllipse(new Rect(cx - r, cy - r, 2 * r, 2 * r))
  dc.addPath(track); dc.strokePath()

  // Progress arc (clockwise from 12 o'clock), approximated with segments
  if (p > 0) {
    dc.setStrokeColor(new Color("#FFFFFF", 0.95))
    dc.setLineWidth(lw)
    const arc   = new Path()
    const start = -Math.PI / 2
    const steps = Math.max(1, Math.round(60 * p))
    for (let i = 0; i <= steps; i++) {
      const a  = start + (i / 60) * 2 * Math.PI
      const px = cx + r * Math.cos(a)
      const py = cy + r * Math.sin(a)
      i === 0 ? arc.move(new Point(px, py)) : arc.addLine(new Point(px, py))
    }
    dc.addPath(arc); dc.strokePath()
  }

  // Centre number
  dc.setTextAlignedCenter()
  dc.setTextColor(Color.white())
  dc.setFont(Font.boldSystemFont(58))
  dc.drawTextInRect(centerText, new Rect(0, cy - 46, size, 64))

  // Small label below the number
  if (subText) {
    dc.setFont(Font.mediumSystemFont(24))
    dc.setTextColor(new Color("#FFFFFF", 0.8))
    dc.drawTextInRect(subText, new Rect(0, cy + 18, size, 30))
  }
  return dc.getImage()
}

function buildCircular(schedule, now) {
  const { current, next, nextFuture } = schedule
  const widget = new ListWidget()
  widget.backgroundColor = new Color("#000000", 0)
  widget.setPadding(0, 0, 0, 0)

  let progress = 0, center = "—", sub = ""
  if (current) {
    // Drain from full (start) to empty (end)
    const total = current.end - current.start
    const done  = now - current.start
    progress    = total > 0 ? 1 - done / total : 0
    center      = String(Math.max(0, Math.round((current.end - now) / 60000)))
    sub         = "min"
  } else if (next) {
    // Break — static, minutes until next lesson
    center = String(Math.max(0, minsBetween(now, next.start)))
    sub    = "vrij"
  } else if (nextFuture) {
    center = "—"
    sub    = fmtDayDate(nextFuture.start)
  }

  const img = widget.addImage(drawRing(progress, center, sub))
  img.centerAlignImage()
  img.imageSize = new Size(58, 58)
  return widget
}

// ─────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────

async function main() {
  await loadConfig()

  const family = config.runsInWidget ? config.widgetFamily : null

  let icalResult
  try {
    icalResult = await fetchIcal(ICAL_URL)
  } catch {
    const widget = new ListWidget()
    widget.backgroundColor = new Color("#000000", 0)
    addMessage(widget, "Geen data — controleer verbinding")
    if (config.runsInWidget) Script.setWidget(widget)
    else await widget.presentAccessoryRectangular()
    Script.complete()
    return
  }

  const { events } = icalResult
  const now      = new Date()
  const schedule = getSchedule(events, now)

  const widget = family === "accessoryCircular"
    ? buildCircular(schedule, now)
    : buildRectangular(schedule, now)

  // Refresh at the next lesson start/end boundary, capped at REFRESH_MINS
  const fallback = new Date(now.getTime() + REFRESH_MINS * 60 * 1000)
  const boundary = nextTransition(schedule.todayLessons, now)
  widget.refreshAfterDate = (boundary && boundary < fallback) ? boundary : fallback

  if (config.runsInWidget) {
    Script.setWidget(widget)
  } else if (family === "accessoryCircular") {
    await widget.presentAccessoryCircular()
  } else {
    // When run in-app, preview both so either placement can be checked.
    await buildRectangular(schedule, now).presentAccessoryRectangular()
    await buildCircular(schedule, now).presentAccessoryCircular()
  }
  Script.complete()
}

main()
