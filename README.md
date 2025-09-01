# Welcome to iDJ

To run this project you need Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Access app: https://martins-software-i-dj.lovable.app/

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone https://github.com/iagomartins/martins-software-i-dj.git

# Step 2: Navigate to the project directory.
cd martins-software-i-dj

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## 🚀 Running the Electron App with Integrated Server

This project now includes an Electron desktop application with an integrated DJ audio server that starts automatically.

### Quick Start (Windows)

**Option 1: Double-click the batch file**
```bash
start-app.bat
```

**Option 2: Run PowerShell script**
```powershell
.\start-app.ps1
```

### Manual Start

**Build and run the complete app:**
```bash
npm run start
```

**Development mode (with hot reload):**
```bash
npm run start:dev
```

**Run just the Electron app:**
```bash
npm run electron
```

**Run just the server:**
```bash
npm run server
```

### What Happens When You Start

1. **Build Process**: The React app is built for production
2. **Server Launch**: A Node.js DJ server starts automatically (ports 4000 & 4001)
3. **Electron App**: The desktop application launches with the built React app
4. **Integrated Experience**: Both the UI and audio processing work together seamlessly

### Server Features

- **HTTP Upload**: Accepts audio files on port 4000
- **WebSocket Control**: Real-time DJ controls on port 4001
- **Audio Processing**: Professional-grade audio engine with scratching support
- **Format Support**: WAV, MP3, FLAC, OGG, M4A (via FFmpeg)

### Stopping the App

- Close the Electron window to stop both the app and server
- The server process is automatically cleaned up when you exit
- Use Ctrl+C in terminal if running manually

### Troubleshooting

**Server won't start:**
- Ensure Node.js is installed and in your PATH
- Check that `server.js` exists in the project root
- Verify ports 4000 and 4001 are available

**Build fails:**
- Run `npm install` to ensure all dependencies are installed
- Check for TypeScript compilation errors
- Verify Vite configuration

**Audio issues:**
- Ensure your system audio is working
- Check that the server is running (should see server logs in Electron console)
- Verify audio file formats are supported
