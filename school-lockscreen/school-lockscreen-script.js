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
//  MAIN
// ─────────────────────────────────────────

async function main() {
  await loadConfig()

  const widget = new ListWidget()
  widget.backgroundColor = new Color("#000000", 0)  // transparent — iOS vibrant tint handles it

  // Set refresh to next lesson boundary so the widget flips exactly on time
  let icalResult
  try {
    icalResult = await fetchIcal(ICAL_URL)
  } catch {
    // If even the cache is unavailable, show an error and bail
    addMessage(widget, "Geen data — controleer verbinding")
    Script.setWidget(widget)
    Script.complete()
    return
  }

  const { events, fromCache } = icalResult
  const now = new Date()
  const { current, next, nextFuture, todayLessons } = getSchedule(events, now)

  // Schedule next refresh at the next lesson start/end, capped at REFRESH_MINS
  const fallback  = new Date(now.getTime() + REFRESH_MINS * 60 * 1000)
  const boundary  = nextTransition(todayLessons, now)
  widget.refreshAfterDate = (boundary && boundary < fallback) ? boundary : fallback

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

  if (config.runsInWidget) {
    Script.setWidget(widget)
  } else {
    await widget.presentAccessoryRectangular()
  }
  Script.complete()
}

main()
