Deploy Scriptable scripts from this repo to the Scriptable iCloud Documents directory.

The Scriptable iCloud path is: `/Users/armand/Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents`

Scripts in this repo:
- `morning-summary/morning-summary-script.js` → deploy as `morning-summary-script.js`
- `school-widget/school-widget-script.js` → deploy as `school-widget-script.js`

Instructions:
- If `$ARGUMENTS` is empty, copy both scripts to the destination directory.
- If `$ARGUMENTS` contains "morning-summary" or "morning", copy only `morning-summary-script.js`.
- If `$ARGUMENTS` contains "school" or "school-widget", copy only `school-widget-script.js`.

Use the Bash tool to run the cp command(s). After copying, confirm which file(s) were deployed and their destination path.
