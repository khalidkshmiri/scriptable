# Morning Summary

A [Scriptable](https://scriptable.app) script that runs on iPhone at wake time. It fetches weather, calendar events, and reminders, renders a visual card as a PNG, and sends it to a Telegram chat.

## What it looks like

The card ("Daybreak Ledger") uses a warm espresso background with a gold accent color and a three-font editorial system (Hoefler Text + Menlo + Avenir Next). It renders at native device resolution (3× on iPhone 15/16).

Sections, top to bottom:

| Section | Content |
|---|---|
| Header | City · time · battery, date, gold underline |
| Weather | Condition, temp, feels-like, high/low, wind, sunrise/sunset |
| Calendar | Events grouped by calendar, sorted by start time |
| Reminders | Overdue / Today / Upcoming (3-day window), sorted by priority |
| Advice | Auto-generated tips (rain window, wind, cold, UV, busy day, late finish) |

## Setup

### 1. Install Scriptable

Download [Scriptable](https://apps.apple.com/app/scriptable/id1405459188) from the App Store and enable iCloud Drive sync.

### 2. Create a Telegram bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram → `/newbot`
2. Copy the token it gives you
3. Start a chat with your bot and send a message, then get your chat ID from `https://api.telegram.org/bot<TOKEN>/getUpdates`

### 3. Create the config file

In the Scriptable folder in iCloud Drive, create a subfolder called `Config` and add a file named `morning-summary-config.json`:

```json
{
  "token": "YOUR_BOT_TOKEN",
  "chatId": "YOUR_CHAT_ID"
}
```

### 4. Add the script

Paste `morning-summary-script.js` into Scriptable (tap `+` → paste).

### 5. Set up a wake automation

In the Shortcuts app, create a Personal Automation triggered on **Alarm** → **When stopped** and add a "Run Script" action pointing to this script.

## Configuration

At the top of the script, the `CFG` object controls which calendars are shown and the thresholds used to generate advice:

```javascript
const CFG = {
  token:     "",   // loaded from Config/morning-summary-config.json
  chatId:    "",
  calendars: ["Events","Family","Rooster","School","Personal","Barber Appointments","Admin","Other"],
  thresh:    { wind: 25, cold: 3, warm: 25, uv: 6 }
}
```

Calendar display order follows the `CFG.calendars` array. The cap per calendar is adaptive: 7 events if only one calendar has events, 4 per calendar when two or more calendars have events.

## Data sources

- **Weather** — [Open-Meteo](https://open-meteo.com/) (no API key required). Fetches current conditions, daily high/low, UV index, hourly precipitation probability, and sunrise/sunset.
- **Calendar** — `CalendarEvent.between()` via the Scriptable API, filtered to the calendars in `CFG.calendars`.
- **Reminders** — `Reminder.allIncomplete()`, filtered to overdue, due today, and due within 3 days. Reminders without a due date are never shown.
- **Location** — `Location.current()` at 100-metre accuracy, used for weather coordinates and city name.

## How it works

```
main()
├── loadConfig()                        ← reads token + chatId from iCloud
├── Promise.all([getWeather(), getCalendar(), getReminders()])
├── buildAdvice(weather, calendar)      ← generates contextual tips
├── runLayout(null, data)               ← pass 1: measure total height
├── runLayout(dc, data)                 ← pass 2: draw to DrawContext
└── sendPhoto(image, caption)          → Telegram bot sendPhoto (multipart)
```

If `sendPhoto` fails, a local iOS notification is scheduled so you know the send failed.

## Companion: Departure Alert

A separate Shortcut runs before Morning Summary in the wake automation. It finds the first calendar event with a location that is not home, reads a `#drive`/`#walk`/`#bike`/`#transit` tag from the event's Notes, gets the Apple Maps travel time, and sends a Telegram message like:

> Leave by 08:15 for Dentist — 23 min by public transport

This logic lives entirely in Shortcuts, not in this script.
