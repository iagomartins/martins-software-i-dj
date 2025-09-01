const { app, BrowserWindow, ipcMain, session, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow = null;
let serverProcess = null;

// Function to start the server
function startServer() {
  console.log('🚀 Starting DJ server...');
  
  // Path to server.js relative to the electron folder
  const serverPath = path.join(__dirname, '../server.js');
  
  // Check if server.js exists
  if (!fs.existsSync(serverPath)) {
    console.error('❌ Server file not found:', serverPath);
    return;
  }
  
  // Start the server process
  serverProcess = spawn('node', [serverPath], {
    stdio: 'pipe',
    cwd: path.join(__dirname, '..') // Set working directory to project root
  });
  
  // Handle server output
  serverProcess.stdout.on('data', (data) => {
    console.log('📡 [Server]', data.toString().trim());
  });
  
  serverProcess.stderr.on('data', (data) => {
    console.error('❌ [Server Error]', data.toString().trim());
  });
  
  // Handle server process exit
  serverProcess.on('close', (code) => {
    console.log(`📡 [Server] Process exited with code ${code}`);
    serverProcess = null;
  });
  
  serverProcess.on('error', (error) => {
    console.error('❌ [Server] Failed to start:', error);
    serverProcess = null;
  });
  
  console.log('✅ Server process started with PID:', serverProcess.pid);
}

// Function to stop the server
function stopServer() {
  if (serverProcess) {
    console.log('🛑 Stopping DJ server...');
    
    // Kill the server process
    serverProcess.kill('SIGTERM');
    
    // Force kill after 5 seconds if it doesn't stop gracefully
    setTimeout(() => {
      if (serverProcess) {
        console.log('⚠️ Force killing server process...');
        serverProcess.kill('SIGKILL');
      }
    }, 5000);
    
    serverProcess = null;
  }
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false, // Allow local file access for audio
      allowRunningInsecureContent: true, // For audio file loading
      devTools: true // Always enable DevTools
    },
    title: 'iDJ - Professional DJ Software',
    icon: path.join(__dirname, '../public/favicon.ico'),
    show: false // Don't show until ready
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // ALWAYS open DevTools (debug mode always enabled)
    mainWindow.webContents.openDevTools();
    
    // Enable additional debugging features
    mainWindow.webContents.executeJavaScript(`
      console.log(' Debug mode enabled - DevTools always open');
      console.log('📱 User Agent:', navigator.userAgent);
      console.log(' Location:', window.location.href);
      console.log('⚡ Performance:', performance.now());
    `);
  });

  // Check for built files and load accordingly
  const distPath = path.join(__dirname, '../dist');
  const indexPath = path.join(distPath, 'index.html');
  
  console.log('🔧 DEBUG: Checking for built files...');
  console.log('🔧 DEBUG: Dist path:', distPath);
  console.log('🔧 DEBUG: Index path:', indexPath);
  
  if (fs.existsSync(distPath) && fs.existsSync(indexPath)) {
    // Production build exists - load from dist folder
    console.log('🔧 DEBUG: Loading production build from dist folder');
    mainWindow.loadFile(indexPath);
    
    // Set base path for assets
    mainWindow.webContents.executeJavaScript(`
      // Fix asset paths for Electron
      const base = document.querySelector('base');
      if (base) {
        base.href = 'file://${distPath.replace(/\\/g, '/')}/';
      }
    `);
  } else {
    // No built files - try development server
    console.log('🔧 DEBUG: No built files found, trying development server...');
    
    // Check if dev server is running
    const devUrl = 'http://localhost:5173';
    console.log('🔧 DEBUG: Attempting to load from:', devUrl);
    
    mainWindow.loadURL(devUrl).catch(err => {
      console.error('🔧 DEBUG: Failed to load dev server:', err);
      
      // If dev server fails, show error and instructions
      mainWindow.loadURL(`data:text/html,
        <html>
          <head>
            <title>iDJ - Setup Required</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; background: #1a1a1a; color: white; }
              .container { max-width: 600px; margin: 0 auto; }
              .error { background: #ff4444; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .success { background: #44ff44; padding: 20px; border-radius: 8px; margin: 20px 0; }
              code { background: #333; padding: 4px 8px; border-radius: 4px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1> iDJ Setup Required</h1>
              
              <div class="error">
                <h2>No Built Files Found</h2>
                <p>Your React app needs to be built before running in Electron.</p>
              </div>
              
              <h2>🔧 Quick Fix:</h2>
              <p>Run these commands in your terminal:</p>
              
              <div class="success">
                <h3>Option 1: Build for Production</h3>
                <code>npm run build</code><br>
                <small>This creates the dist folder with built files</small>
              </div>
              
              <div class="success">
                <h3>Option 2: Start Development Server</h3>
                <code>npm run dev</code><br>
                <small>Then restart Electron</small>
              </div>
              
              <h2>📁 File Structure Expected:</h2>
              <ul>
                <li><code>dist/index.html</code> - Main HTML file</li>
                <li><code>dist/assets/</code> - CSS and JS files</li>
              </ul>
              
              <h2> After Building:</h2>
              <p>Restart Electron and it should work properly!</p>
            </div>
          </body>
        </html>
      `);
    });
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Enhanced keyboard shortcuts for debugging
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // F12 to toggle DevTools
    if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
    
    // Ctrl+Shift+I to toggle DevTools
    if (input.control && input.shift && input.key === 'I') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
    
    // Ctrl+R to reload
    if (input.control && input.key === 'r') {
      mainWindow.reload();
      event.preventDefault();
    }
    
    // Ctrl+Shift+R to hard reload
    if (input.control && input.shift && input.key === 'R') {
      mainWindow.webContents.reloadIgnoringCache();
      event.preventDefault();
    }
    
    // F5 to reload
    if (input.key === 'F5') {
      mainWindow.reload();
      event.preventDefault();
    }
  });

  // Enable console logging from renderer process
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levels = ['log', 'info', 'warn', 'error'];
    const levelName = levels[level] || 'log';
    console.log(`🔧 [Renderer ${levelName.toUpperCase()}] ${message} (${sourceId}:${line})`);
  });

  // Log all page loads
  mainWindow.webContents.on('did-start-loading', () => {
    console.log('🔧 DEBUG: Page started loading');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('🔧 DEBUG: Page finished loading');
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(' DEBUG: Page failed to load:', errorCode, errorDescription, validatedURL);
  });
}

// App event handlers
app.whenReady().then(() => {
  console.log('🔧 DEBUG: Electron app is ready');
  
  // Start the DJ server first
  startServer();
  
  // Wait a moment for server to start, then create window
  setTimeout(() => {
    createWindow();
  }, 1000);
  
  // ALWAYS enable comprehensive debugging features
  console.log('🔧 DEBUG: Enabling comprehensive debugging...');
  
  // Enable source maps for better debugging
  app.commandLine.appendSwitch('enable-source-maps');
  
  // Enable remote debugging
  app.commandLine.appendSwitch('remote-debugging-port', '9222');
  
  // Enable additional debugging flags
  app.commandLine.appendSwitch('enable-logging');
  app.commandLine.appendSwitch('v', '1');
  app.commandLine.appendSwitch('vmodule', '*/electron/*=1');
  
  // Enable DevTools extensions
  app.commandLine.appendSwitch('enable-extensions');
  
  console.log('🔧 DEBUG: Debug mode fully enabled');
});

app.on('window-all-closed', () => {
  console.log(' DEBUG: All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up server when app quits
app.on('before-quit', () => {
  console.log('🛑 App quitting, cleaning up server...');
  stopServer();
});

// Handle process termination signals
process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, cleaning up...');
  stopServer();
  app.quit();
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, cleaning up...');
  stopServer();
  app.quit();
});

app.on('activate', () => {
  console.log('🔧 DEBUG: App activated');
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Enhanced IPC handlers with debug logging
ipcMain.handle('get-audio-devices', async () => {
  console.log('🔧 DEBUG: get-audio-devices called');
  try {
    const result = {
      success: true,
      devices: ['Default Output', 'Default Input'],
      timestamp: new Date().toISOString()
    };
    console.log('🔧 DEBUG: Audio devices result:', result);
    return result;
  } catch (error) {
    console.error('🔧 DEBUG: Error getting audio devices:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('request-audio-permission', async () => {
  console.log('🔧 DEBUG: request-audio-permission called');
  try {
    const result = { success: true, granted: true, timestamp: new Date().toISOString() };
    console.log('🔧 DEBUG: Audio permission result:', result);
    return result;
  } catch (error) {
    console.error('🔧 DEBUG: Error requesting audio permission:', error);
    return { success: false, error: error.message };
  }
});

// Handle uncaught exceptions with debug info
process.on('uncaughtException', (error) => {
  console.error('🔧 DEBUG: Uncaught Exception:', error);
  console.error(' DEBUG: Stack trace:', error.stack);
  console.error('🔧 DEBUG: Process info:', {
    pid: process.pid,
    version: process.version,
    platform: process.platform,
    arch: process.arch
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔧 DEBUG: Unhandled Rejection at:', promise);
  console.error('🔧 DEBUG: Reason:', reason);
  console.error('🔧 DEBUG: Promise stack:', promise.stack);
});

// Export for potential use
module.exports = { createWindow };
