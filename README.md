# SynthTook

Web-based mini-synth + step sequencer driven by Web Audio API and Web MIDI API.

Two ways to run it: in a browser (zero install), or as a native desktop app (**SynthTook Local** — Windows / macOS, runs offline, saves patterns to disk).

---

## Browser version

ES modules need an http origin (not `file://`):

```
npx http-server .
```

Then open the printed URL (e.g. `http://localhost:8080`) in **Chrome** or **Edge**. Web MIDI is not supported in Safari and is unreliable in older Firefox builds — use a Chromium browser.

---

## SynthTook Local (desktop app)

Native build that bundles Chromium so Web MIDI works on Windows and macOS without a browser. Patterns autosave to a JSON file on disk (no localStorage); slot saves are individual files you can back up, share, or hand-edit.

### Download

Pre-built installers are attached to each [GitHub Release](https://github.com/akahn2020/SynthTook/releases).

### Install — Windows

Two options. Both are unsigned, so Windows SmartScreen will warn on first launch.

- **`SynthTook-Local-Setup-x.y.z.exe`** — standard installer with Start Menu shortcut + uninstaller. Double-click. When SmartScreen says *"Windows protected your PC"*, click **More info** → **Run anyway**. The installer lets you pick the install directory.
- **`SynthTook-Local-x.y.z-portable.exe`** — single self-contained .exe, no install needed. Same SmartScreen bypass on first launch.

### Install — macOS

Pick the `.dmg` matching your CPU:
- **`SynthTook-Local-x.y.z-x64.dmg`** for Intel Macs
- **`SynthTook-Local-x.y.z-arm64.dmg`** for Apple Silicon (M1+)

Open the `.dmg`, drag the app to **Applications**, eject the disk image. On first launch macOS will say *"SynthTook Local can't be opened because Apple cannot check it for malicious software"* — this is the unsigned-app warning, not a real virus alert. Two ways past it:

1. **Right-click → Open** in Finder. macOS adds an extra **Open** button to the dialog. (One-time per install.)
2. Or: System Settings → **Privacy & Security** → scroll to the *"SynthTook Local was blocked"* line → **Open Anyway**.

After the first successful launch, normal double-click works.

### Where your patterns live

| OS | Path |
|---|---|
| Windows | `%APPDATA%\synthtook-local\` |
| macOS | `~/Library/Application Support/synthtook-local/` |

The app has a **File → Show Patterns Folder** menu item (Ctrl/Cmd+Shift+O) that opens this directory.

---

## Use

1. Click **POWER ON** (browsers and Electron both require a user gesture before starting audio).
2. Pick your MIDI input (e.g. M-Audio Keystation 49e) from the dropdown.
3. Play with the Keystation, with the on-screen keyboard, or with the computer keys `a w s e d f t g y h u j k`.
4. Click cells in the 16-step grid, set a BPM, hit **PLAY**.

Press **?** or click **HELP** for the full keyboard reference, factory presets, and slot/transpose/arp documentation.

---

## Building from source

```
git clone https://github.com/akahn2020/SynthTook.git
cd SynthTook
npm install
```

| Command | What it does |
|---|---|
| `npm start` | Launch the desktop app in dev mode (auto-opens DevTools). |
| `npm run dist:win` | Build the Windows installer + portable .exe into `dist/`. |
| `npm run dist:mac` | Build the macOS DMGs into `dist/`. **Must run on a Mac.** |
| `npm run dist` | Build for the current platform. |
| `npx http-server -p 8080 -c-1` | Serve the browser version on localhost. |

CI (GitHub Actions) builds both Windows and Mac installers — manually triggered from the Actions tab, or automatically when you push a `v*` tag (creates a draft release with all artifacts attached).

> **Windows symlink note:** the first local `npm run dist:win` needs an admin shell because the `winCodeSign` toolkit electron-builder downloads contains macOS symlinks that Windows refuses to create from a normal user. Once extracted to the cache, future builds run as your normal user. Alternatively, enable Windows **Developer Mode** (Settings → Privacy & Security → For developers) to grant symlink rights permanently.
