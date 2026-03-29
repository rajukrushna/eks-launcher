# EKS Launcher

A desktop app for managing Okta + EKS environment configurations and kubectl port-forwards — connect to any cluster and forward services in one click.

**Runs on macOS, Windows, and Linux (including WSL).**

Built with: **Electron 30 · React 18 · Vite · better-sqlite3 · Zustand**

---

## Features

- **Connect tab** — select an environment, click Connect. Runs `gimme-aws-creds` (using Okta config stored in DB or falls back to `~/.okta_aws_login_config`), then runs the EKS command. Live stdout/stderr streams into the terminal panel.
- **Port Forwards tab** — locked until EKS is connected. 21 services pre-seeded, grouped into Services / Databases / Dashboards. Start/stop individual services or all at once. Expand any row for per-service live logs.
- **Environment management** — full add/edit/delete for environments with Okta config fields stored in SQLite (no file dependency).
- **Port-forward management** — add/edit/delete port-forward entries with auto-generated kubectl commands.

---

## Prerequisites

- Node.js 18+
- `gimme-aws-creds` on your PATH
- `aws` CLI on your PATH
- `kubectl` on your PATH

---

## Development

```bash
git clone https://github.com/YOUR_USERNAME/eks-launcher.git
cd eks-launcher
npm install       # postinstall auto-rebuilds better-sqlite3 for Electron
npm run dev
```

---

## Building for Distribution

### macOS (run on macOS)
```bash
npm run dist:mac
# → release/EKS Launcher-1.0.0-arm64.dmg
# → release/EKS Launcher-1.0.0.dmg
```

### Windows (run on Windows or WSL)
```bash
npm run dist:win
# → release/EKS Launcher Setup 1.0.0.exe
# → release/EKS Launcher 1.0.0.exe  (portable)
```

### Linux / WSL
```bash
npm run dist:linux
# → release/EKS Launcher-1.0.0.AppImage
# → release/eks-launcher_1.0.0_amd64.deb
```

---

## Automated Builds via GitHub Actions

Push a version tag — GitHub builds all three platforms in parallel and creates a release:

```bash
git tag v1.0.0
git push --tags
```

Binaries appear under the **Releases** tab automatically.

---

## WSL Setup

### Windows 11 (WSLg)
No extra steps — run `npm run dev` and the window appears on your Windows desktop.

### Windows 10 (VcXsrv)
1. Install [VcXsrv](https://sourceforge.net/projects/vcxsrv/). Launch with **Disable access control** checked.
2. In WSL:
```bash
echo 'export DISPLAY=$(cat /etc/resolv.conf | grep nameserver | awk '"'"'{print $2}'"'"'):0' >> ~/.bashrc
echo 'export LIBGL_ALWAYS_INDIRECT=1' >> ~/.bashrc
source ~/.bashrc
```

### System dependencies (WSL/Ubuntu)
```bash
sudo apt-get update && sudo apt-get install -y \
  libgtk-3-dev libnotify-dev libnss3 libxss1 \
  libxtst6 xauth libgbm-dev libasound2
```

---

## Project Structure

```
eks-launcher/
├── .github/workflows/build.yml     # CI: builds mac + win + linux on tag push
├── electron/
│   ├── main.ts                     # SQLite, IPC, shell execution, port-forward processes
│   └── preload.ts                  # Secure context bridge
├── src/
│   ├── components/
│   │   ├── TitleBar.tsx
│   │   └── Sidebar.tsx
│   ├── screens/
│   │   ├── HomeView.tsx            # Connect + Port Forwards tabs
│   │   ├── PortForwardView.tsx     # Runtime panel (start/stop/logs)
│   │   ├── PortForwardManageView.tsx
│   │   ├── PortForwardFormView.tsx
│   │   └── EnvFormView.tsx
│   ├── store/useStore.ts
│   ├── App.tsx
│   ├── index.css
│   └── types.ts
├── build/                          # Add icon.icns / icon.ico / icon.png here
├── package.json
└── vite.config.ts
```

---

## Database

| Platform | Location |
|----------|----------|
| macOS | `~/Library/Application Support/eks-launcher/eks-launcher.db` |
| Windows | `%APPDATA%\eks-launcher\eks-launcher.db` |
| Linux | `~/.config/eks-launcher/eks-launcher.db` |

**Okta config:** if `okta_org_url` is set on an environment, a temp config file is written and passed to `gimme-aws-creds --config <path>` (deleted immediately after). If blank, falls back to `~/.okta_aws_login_config`.

---

## Adding Icons

Place in `build/` directory:

| File | Platform | Size |
|------|----------|------|
| `icon.icns` | macOS | 512×512 |
| `icon.ico` | Windows | 256×256 |
| `icon.png` | Linux | 512×512 |
