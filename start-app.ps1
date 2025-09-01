# Start iDJ Application with Server
Write-Host "🚀 Starting iDJ Application..." -ForegroundColor Green
Write-Host ""

# Check if Node.js is available
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js not found! Please install Node.js first." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if npm is available
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "❌ npm not found! Please install npm first." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "📦 Building the app..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed! Please check for errors." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "✅ Build successful! Starting Electron app with server..." -ForegroundColor Green
Write-Host "📡 The DJ server will start automatically when Electron launches" -ForegroundColor Cyan
Write-Host ""

# Start the Electron app
npm run electron

Write-Host ""
Write-Host "👋 App closed. Press Enter to exit..." -ForegroundColor Yellow
Read-Host
