# LR Practice (Local)

## Structure
- `index.html`: filter + selection
- `practice.html`: practice flow
- `css/styles.css`: styles
- `js/app.js`: shared utilities
- `js/data.js`: Excel loading/parsing
- `js/home.js`: homepage logic
- `js/practice.js`: practice logic
- `js/vendor/xlsx.full.min.js`: SheetJS (local)

## Run (Mac / Normal mode)
1. Open Terminal in this folder.
2. Run:
   ```bash
   python3 -m http.server 8000
   ```
3. Open: `http://localhost:8000`
4. Full Excel auto-load + audio + recording should work.

## Run (Windows / Offline / No Python)
1. Open `index.html` directly (double-click).
2. Click **Import Excel** and select `TestData.xlsx` from this folder.
3. Practice flow works offline; recording may be unavailable depending on the browser/device.

## Notes
- Audio and pictures use relative paths: `./Audio/...` and `./Pic/...`.
- If recording is unavailable, the download button saves a small JSON progress file instead.
