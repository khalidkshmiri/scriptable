# Scriptable Scripts

This repo contains a set of iPhone widgets and automation scripts built with
[Scriptable](https://scriptable.app) — a free iOS app that lets you run JavaScript code on your
phone to build widgets and automations.

No coding knowledge is needed to use these scripts. You just paste the code into the app and follow the setup steps below.

---

## What's inside

| Script | What it does |
|---|---|
| [Morning Summary](#morning-summary) | Sends you a daily briefing card to Telegram when you wake up |
| [School Widget](#school-widget) | Shows your school schedule and upcoming deadlines on your home screen |

### More widgets & automations

Each lives in its own folder with a dedicated README. Telegram-sending scripts reuse the
credentials from `Config/morning-summary-config.json`.

| Script | Folder | What it does |
|---|---|---|
| School Lockscreen | `school-lockscreen/` | Lock-screen current/next lesson + countdown ring |
| Countdown | `countdown-widget/` | Lock-screen countdown to exam dates / milestones |
| Next Event | `next-event-widget/` | Lock-screen next calendar event |
| Barber Tracker | `barber-tracker/` | Earnings widget + quick-log → `barber-log.json` |
| Gym Log | `gym-log-widget/` | Workout streak widget + quick-log → `gym-log.json` |
| Study Tracker | `study-tracker/` | Weekly study widget + Pomodoro → `study-log.json` |
| OV Departures | `ov-widget/` | Next NS/RET departures (keyless `ovapi.nl`) |
| Post-Gym | `post-gym/` | Log a workout when Gym Focus ends |
| Evening Summary | `evening-summary/` | Tomorrow's card to Telegram (~21:30) |
| Pre-School Briefing | `pre-school-briefing/` | First lesson + deadlines + weather on School Focus |
| Weekly Review | `weekly-review/` | Sunday recap card from your logs |

> Configuration templates for every script live in `Config/*.example.json`. Copy the one you
> need to `Config/<name>-config.json` in the Scriptable iCloud folder and fill it in.

---

## Morning Summary

Located in the `morning-summary/` folder.

### What it does

Every morning when you stop your alarm, your phone automatically:

1. Checks your current location
2. Fetches the weather for where you are
3. Grabs your calendar events for today
4. Grabs your reminders that are overdue or due soon
5. Builds a beautiful image card with all of that info
6. Sends it to you on Telegram

The card looks like a newspaper front page — dark background, gold accents, clean typography. It shows:

- City, time, battery level, and today's date
- Weather: temperature, wind, UV index, sunrise and sunset
- Your calendar events, grouped by calendar
- Reminders that need your attention (overdue, today, or within 3 days)
- Smart advice tips (e.g. "Rain expected at 14:00 — bring a jacket" or "UV is high today")

### How to set it up

**Step 1 — Install Scriptable**

Download [Scriptable](https://apps.apple.com/app/scriptable/id1405459188) from the App Store. When it asks, allow it to use iCloud Drive — this is how it saves and syncs your scripts.

**Step 2 — Create a Telegram bot**

Telegram is the messaging app the script uses to send you the card. You need a "bot" — think of it as a helper account that can send messages on your behalf.

1. Open Telegram and search for **@BotFather**
2. Send it the message: `/newbot`
3. Follow the instructions — give your bot a name (anything you like)
4. BotFather will give you a **token** — a long string of letters and numbers. Save it.
5. Open a chat with your new bot and send any message (e.g. "hello")
6. To find your **chat ID**: in your browser, go to `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` (replace `<YOUR_TOKEN>` with the token you just got). Look for a number next to `"id":` in the result.

**Step 3 — Add your credentials**

In the Files app on your iPhone, go to **iCloud Drive → Scriptable → Config**. Copy `morning-summary-config.example.json`, rename the copy to `morning-summary-config.json`, and replace the placeholder values with your bot token and chat ID.

**Step 4 — Add the script to Scriptable**

Open Scriptable, tap the `+` button, and paste in the full contents of `morning-summary/morning-summary-script.js`.

**Step 5 — Set up the wake automation**

1. Open the **Shortcuts** app
2. Go to **Automation** (bottom tab) → tap `+` → **Personal Automation**
3. Choose **Alarm** → **When Stopped**
4. Add a **Run Script** action → select the Morning Summary script
5. Turn off "Ask Before Running" so it runs silently

That's it. The next morning when you stop your alarm, the card will appear in your Telegram.

### Customising calendars and thresholds

Near the top of the script file there is a block called `CFG`. You can edit which calendars appear on the card, and how sensitive the advice tips are:

```javascript
calendars: ["Events", "Family", "School", "Personal", ...]  // add or remove calendar names
thresh: { wind: 25, cold: 3, warm: 25, uv: 6 }             // units: km/h, °C, °C, UV index
```

The calendar names must match exactly what you have in the iOS Calendar app.

---

## School Widget

Located in the `school-widget/` folder.

### What it does

A home screen widget that shows your school day at a glance:

- What lesson you are in right now (or how long until the next one)
- The lessons coming up later today
- Upcoming deadlines and assignments
- Reminders tagged under your "School" calendar/reminder list

It pulls your timetable directly from Magister (via its iCal link) and refreshes automatically in the background.

### How to set it up

**Step 1 — Get your Magister iCal link**

1. Log in to Magister in a browser
2. Go to your agenda/calendar settings and find the option to export or subscribe to your calendar
3. Copy the iCal subscription link (it will start with `https://calendar.magister.net/...`)

**Step 2 — Add your iCal URL**

In the Files app on your iPhone, go to **iCloud Drive → Scriptable → Config**. Copy `school-widget-config.example.json`, rename the copy to `school-widget-config.json`, and replace `YOUR_MAGISTER_ICAL_URL` with the link you just copied.

**Step 3 — Add the script**

Open Scriptable, tap `+`, and paste in the full contents of `school-widget/school-widget-script.js`.

**Step 4 — Add the widget to your home screen**

1. Long-press your iPhone home screen until icons start jiggling
2. Tap the `+` button in the top corner
3. Search for **Scriptable**
4. Choose the **Large** widget size (it needs the space to show your full schedule)
5. Tap **Add Widget**, then tap on it to configure it
6. Set the script to **School Widget**

The widget will update itself every 10 minutes automatically.

### What it shows

- **Currently in a lesson** — shows the subject, teacher, and room, plus how long is left
- **In a break** — shows how long until the next lesson
- **Before school starts** — shows today's full timetable
- **School day done** — shows a free message and upcoming deadlines
- **Deadlines** — always shown at the bottom, color-coded by urgency (red = due soon)

---

## General notes

- Both scripts work completely offline for display purposes — they cache data and fall back to cached versions if there is no internet connection.
- Nothing is ever sent to any server except weather data (fetched from [Open-Meteo](https://open-meteo.com/), which is free and requires no account) and the Morning Summary card (sent via your own Telegram bot to yourself).
- You are always in control — the Telegram bot is yours, and no one else can access it.
