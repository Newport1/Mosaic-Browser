# Mosaic

Mosaic is an intentionally small tiled desktop browser. Open one to four live web pages, switch focus from the compact tab strip, and keep related work visible without juggling windows.

## Run locally

```bash
npm install
npm start
```

Use **Cmd/Ctrl+T** to add a tile, **Cmd/Ctrl+W** to close the active tile, and **Cmd/Ctrl+L** to focus the address bar.

## Package

Run `npm run dist:mac` on macOS to create DMG and ZIP builds, or `npm run dist:win` on Windows to create installer and portable EXE builds. Cross-platform release builds are best produced on their target operating system.

Every push and pull request runs the tests and then builds both platforms in GitHub Actions. Open the workflow run's **Artifacts** section and download `mosaic-macos` or `mosaic-windows`. You can also start a build manually from **Actions → Build desktop installers → Run workflow**.

### Linux development libraries

The packaged applications include their runtime requirements on macOS and Windows; users do not install extra libraries. To run Electron in an Ubuntu/Debian development container, install its graphical dependencies and a virtual display:

```bash
sudo apt-get update
sudo apt-get install -y xvfb libgtk-3-0 libnss3 libasound2 \
  libxss1 libgbm1 libatk-bridge2.0-0 libdrm2 libxkbcommon0
xvfb-run -a npm start
```

Ubuntu 24.04 minimal images may name the audio package `libasound2t64` instead of `libasound2`.

The UI uses plain HTML, CSS, and JavaScript. Each website runs in an isolated, sandboxed Electron `WebContentsView`; no framework or runtime service is required.
