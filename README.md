# Mosaic

Mosaic is a fullscreen tiled desktop browser. It deliberately has no tab strip: every open page is visible as a tile, and adding another page reflows the entire workspace.

## Interaction model

- There is no four-page or other application-level tile limit.
- **Cmd/Ctrl+T**, the bottom-right `+` button, and links that request a new window create another tile.
- Click a page in the grid to bring it fullscreen.
- Use the bottom-right rounded-square button or **Escape** to return it to the grid.
- **Cmd/Ctrl+L** focuses the active page address bar.
- **Cmd/Ctrl+W** closes the active page.
- **Cmd/Ctrl+R** reloads the active page.

The app opens fullscreen by default. For development, use the windowed command below.

## Run locally

```bash
npm install
npm start
```

```bash
npm run start:windowed
```

## Verify

```bash
npm test
npm run check
```

Regression coverage exercises 5, 12, 32, and 64-tile layouts so the former four-tile cap cannot return unnoticed.

## Package

Run `npm run dist:mac` on macOS to create DMG and ZIP builds, or `npm run dist:win` on Windows to create installer and portable EXE builds. Cross-platform release builds are best produced on their target operating system.

Every push and pull request runs the tests and then builds both platforms in GitHub Actions. Open the workflow run's **Artifacts** section and download `mosaic-macos` or `mosaic-windows`. You can also start a build manually from **Actions → Build desktop installers → Run workflow**.

### Linux development libraries

The packaged applications include their runtime requirements on macOS and Windows. To run Electron in an Ubuntu/Debian development container, install its graphical dependencies and a virtual display:

```bash
sudo apt-get update
sudo apt-get install -y xvfb libgtk-3-0 libnss3 libasound2 \
  libxss1 libgbm1 libatk-bridge2.0-0 libdrm2 libxkbcommon0
xvfb-run -a npm start
```

Ubuntu 24.04 minimal images may name the audio package `libasound2t64` instead of `libasound2`.

## Architecture

Each page runs in an isolated, sandboxed Electron `WebContentsView`. Each tile also has a transparent chrome view for its address bar and overview click target. A separate topmost control view keeps the bottom-right new-page/restore control usable above real webpages.

`src/layout.js` calculates a dense responsive grid for any page count. `src/main.js` owns page lifecycle, popup interception, focus/restore animation, native view bounds, and keyboard shortcuts.
