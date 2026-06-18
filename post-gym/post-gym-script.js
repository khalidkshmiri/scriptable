// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: red; icon-glyph: dumbbell;
// ─────────────────────────────────────────
//  POST-GYM SUMMARY — log a workout, write gym-log.json, Telegram confirm
//  Trigger via Shortcuts when Gym Focus turns off (Run Script action).
//  Optional duration in minutes can be passed as the Shortcut input parameter.
// ─────────────────────────────────────────

const LOG_FILE = "gym-log.json"
const MUSCLES  = ["Chest", "Back", "Shoulders", "Arms", "Legs", "Forearms", "Core", "Cardio"]

// ─── DATA ─────────────────────────────────────────────
function docPath(name) {
  const fm = FileManager.iCloud()
  return fm.joinPath(fm.documentsDirectory(), name)
}

async function loadJson(name, fallback) {
  try {
    const fm = FileManager.iCloud()
    const p  = docPath(name)
    if (!fm.fileExists(p)) return fallback
    await fm.downloadFileFromiCloud(p)
    const data = JSON.parse(fm.readString(p))
    return data
  } catch { return fallback }
}

function saveJson(name, data) {
  FileManager.iCloud().writeString(docPath(name), JSON.stringify(data, null, 2))
}

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// ─── TELEGRAM (reuses morning-summary creds) ──────────
async function telegram(text) {
  try {
    const cfg = await loadJson("Config/morning-summary-config.json", null)
    if (!cfg || !cfg.token || !cfg.chatId) return false
    const req = new Request(`https://api.telegram.org/bot${cfg.token}/sendMessage`)
    req.method = "POST"
    req.addParameterToMultipart("chat_id", String(cfg.chatId))
    req.addParameterToMultipart("text", text)
    const r = await req.loadJSON()
    return !!r.ok
  } catch { return false }
}

// ─── UI ───────────────────────────────────────────────
async function pickMuscles(selected) {
  const table = new UITable()
  table.showSeparators = true
  function render() {
    table.removeAllRows()
    const head = new UITableRow(); head.isHeader = true
    head.addText("Trained muscle groups", "Tap to toggle, then swipe down to continue")
    table.addRow(head)
    for (const m of MUSCLES) {
      const row = new UITableRow()
      row.height = 48
      row.addText(`${selected.has(m) ? "✓" : "○"}  ${m}`)
      row.onSelect = () => {
        selected.has(m) ? selected.delete(m) : selected.add(m)
        render(); table.reload()
      }
      table.addRow(row)
    }
  }
  render()
  await table.present(false)
}

// ─── MAIN ─────────────────────────────────────────────
async function main() {
  const log = await loadJson(LOG_FILE, [])
  const entries = Array.isArray(log) ? log : []

  // Optional duration from the Shortcut input parameter.
  let durationMin = null
  const param = (typeof args !== "undefined" && args.shortcutParameter) ? args.shortcutParameter : null
  if (param != null && !isNaN(parseInt(param, 10))) durationMin = parseInt(param, 10)

  const selected = new Set()
  await pickMuscles(selected)

  // Confirm + optional manual duration entry.
  const confirm = new Alert()
  confirm.title = "Log workout?"
  confirm.message = selected.size
    ? `Muscle groups: ${[...selected].join(", ")}`
    : "No muscle groups selected."
  confirm.addTextField("Duration (min, optional)", durationMin != null ? String(durationMin) : "")
  confirm.addAction("Save")
  confirm.addCancelAction("Cancel")
  const idx = await confirm.presentAlert()
  if (idx === -1) { Script.complete(); return }

  const durRaw = confirm.textFieldValue(0)
  if (durRaw && !isNaN(parseInt(durRaw, 10))) durationMin = parseInt(durRaw, 10)

  const now = new Date()
  entries.push({ date: isoDate(now), durationMin, muscles: [...selected], ts: now.toISOString() })
  saveJson(LOG_FILE, entries)

  const durTxt = durationMin != null ? ` · ${durationMin} min` : ""
  const musTxt = selected.size ? [...selected].join(", ") : "session logged"
  await telegram(`Gym ✓ ${musTxt}${durTxt}`)

  const done = new Alert()
  done.title = "Saved"
  done.message = `Workout logged${durTxt}.`
  done.addAction("Done")
  await done.presentAlert()
  Script.complete()
}

main()
