Deploy Scriptable scripts from this repo to the Scriptable iCloud Documents directory.

The Scriptable iCloud path is: `/Users/armand/Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents`

Scripts in this repo:
- `morning-summary/morning-summary-script.js` → deploy as `morning-summary-script.js`
- `school-widget/school-widget-script.js` → deploy as `school-widget-script.js`
- `school-lockscreen/school-lockscreen-script.js` → deploy as `school-lockscreen-script.js`

Instructions:
- If `$ARGUMENTS` is empty, copy all three scripts to the destination directory.
- If `$ARGUMENTS` contains "morning-summary" or "morning", copy only `morning-summary-script.js`.
- If `$ARGUMENTS` contains "school-widget", copy only `school-widget-script.js`.
- If `$ARGUMENTS` contains "school-lockscreen" or "lockscreen", copy only `school-lockscreen-script.js`.
- If `$ARGUMENTS` contains "school" (but not "school-widget" or "school-lockscreen"), copy both `school-widget-script.js` and `school-lockscreen-script.js`.

Use the Bash tool to run the cp command(s). After copying, confirm which file(s) were deployed and their destination path.
