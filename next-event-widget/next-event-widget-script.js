// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: teal; icon-glyph: calendar-day;
// ─────────────────────────────────────────
//  NEXT EVENT WIDGET — lock-screen next calendar event
//  Families: accessoryInline ("HH:MM — Title"), accessoryRectangular
//  Calendars come from Config/next-event-config.json
// ─────────────────────────────────────────

// Built-in defaults — overridden by Config/next-event-config.json if present.
let CALENDARS    = ["Personal", "Events", "Other", "School", "Barber Appointments"]
let HORIZON_DAYS = 7   // how far ahead to look when nothing remains today

// ─── CONFIG ───────────────────────────────────────────
async function loadConfig() {
  try {
    const fm   = FileManager.iCloud()
    const path = fm.joinPath(fm.documentsDirectory(), "Config/next-event-config.json")
    if (!fm.fileExists(path)) return
    await fm.downloadFileFromiCloud(path)
    const data = JSON.parse(fm.readString(path))
    if (Array.isArray(data.calendars) && data.calendars.length) CALENDARS = data.calendars
    if (typeof data.horizonDays === "number") HORIZON_DAYS = data.horizonDays
  } catch {}
}

// ─── HELPERS ──────────────────────────────────────────
function fmtTime(date) {
  return date.getHours().toString().padStart(2, "0") + ":" +
         date.getMinutes().toString().padStart(2, "0")
}

function fmtDayDate(date) {
  const days = ["zo","ma","di","wo","do","vr","za"]
  return `${days[date.getDay()]} ${fmtTime(date)}`
}

function isToday(date) {
  const n = new Date()
  return date.getFullYear() === n.getFullYear() &&
         date.getMonth()    === n.getMonth() &&
         date.getDate()     === n.getDate()
}

// Next upcoming event across the configured calendars, or null.
async function getNextEvent() {
  try {
    const allCals = await Calendar.forEvents()
    const allowed = allCals.filter(c => CALENDARS.includes(c.title))
    if (!allowed.length) return null
    const now = new Date()
    const end = new Date(now.getTime() + HORIZON_DAYS * 86400000)
    const events = await CalendarEvent.between(now, end, allowed)
    const upcoming = events
      .filter(e => !e.isAllDay && e.startDate > now)
      .sort((a, b) => a.startDate - b.startDate)
    return upcoming[0] || null
  } catch { return null }
}

function capStr(s, n) {
  return s && s.length > n ? s.slice(0, n - 1) + "…" : (s || "")
}

// ─── WIDGETS ──────────────────────────────────────────
function inlineText(event) {
  if (!event) return "Vrij vandaag"
  const when = isToday(event.startDate) ? fmtTime(event.startDate) : fmtDayDate(event.startDate)
  return `${when} — ${capStr(event.title, 22)}`
}

function buildInline(event) {
  const widget = new ListWidget()
  const t = widget.addText(inlineText(event))
  t.font = Font.systemFont(13)
  return widget
}

function buildRectangular(event) {
  const widget = new ListWidget()
  widget.backgroundColor = new Color("#000000", 0)

  if (!event) {
    const t = widget.addText("Vrij vandaag")
    t.font = Font.boldSystemFont(15)
    t.textColor = Color.white()
    return widget
  }

  const when = widget.addText(isToday(event.startDate) ? fmtTime(event.startDate) : fmtDayDate(event.startDate))
  when.font      = Font.boldSystemFont(16)
  when.textColor = Color.white()

  widget.addSpacer(2)

  const title = widget.addText(capStr(event.title, 26))
  title.font      = Font.systemFont(13)
  title.textColor = new Color("#FFFFFF", 0.9)
  title.lineLimit = 2

  if (event.location) {
    widget.addSpacer(1)
    const loc = widget.addText(capStr(event.location, 26))
    loc.font      = Font.systemFont(10)
    loc.textColor = new Color("#FFFFFF", 0.7)
    loc.lineLimit = 1
  }
  return widget
}

// ─── MAIN ─────────────────────────────────────────────
async function main() {
  await loadConfig()
  const event  = await getNextEvent()
  const family = config.runsInWidget ? config.widgetFamily : null

  const widget = family === "accessoryRectangular"
    ? buildRectangular(event)
    : buildInline(event)

  // Refresh every 15 min, or exactly when the event starts if sooner.
  const fallback = new Date(Date.now() + 15 * 60 * 1000)
  widget.refreshAfterDate = (event && event.startDate < fallback) ? event.startDate : fallback

  if (config.runsInWidget) {
    Script.setWidget(widget)
  } else if (family === "accessoryRectangular") {
    await widget.presentAccessoryRectangular()
  } else {
    await widget.presentAccessoryInline()
  }
  Script.complete()
}

main()
