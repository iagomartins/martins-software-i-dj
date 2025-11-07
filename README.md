# iDJ - Professional DJ Software

A modern, cross-platform DJ software built with React, TypeScript, and Web Audio API. Features real-time audio processing via WebAssembly, dual-deck mixing, effects, EQ controls, and more.

## 🎛️ Features

### Audio Engine (WebAssembly + Web Audio API)

- **Real-time audio processing** with Web Audio API and AudioWorklet
- **High-performance DSP** via WebAssembly (compiled from C++)
- **Dual-deck mixing** with independent controls
- **Crossfader** for smooth transitions between decks
- **Pitch control** for tempo adjustment (±100%)
- **EQ controls** (Low, Mid, High bands)
- **Audio effects** (Flanger, Filter, Echo, Reverb)
- **Master and headphone volume** controls with separate routing
- **CUE functionality** for precise track positioning
- **SYNC functionality** for automatic BPM matching
- **Scratch simulation** with pitch-bend effects
- **Position tracking** with real-time waveform visualization
- **File loading** support for multiple audio formats (MP3, WAV, OGG, FLAC, M4A, AAC)

### User Interface (React + TypeScript)

- **Modern, responsive design** with Tailwind CSS
- **Dual-deck interface** with real-time waveform visualization
- **Interactive waveform** with click-to-seek and hover feedback
- **Real-time controls** for all audio parameters
- **Visual feedback** with glowing effects and animations
- **Configuration modal** for audio device selection
- **Error handling** with error boundaries
- **Toast notifications** for user feedback
- **Dark theme** with blue-purple gradient aesthetics

### Desktop Integration (Electron)

- **Cross-platform** Windows, macOS, and Linux support
- **Native file dialogs** for audio file selection
- **File system access** for audio file loading
- **IPC communication** for secure file operations
- **Web Audio API** for platform-independent audio processing

## 🏗️ Architecture

### Frontend Stack

- **React 18** - UI framework
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - High-quality component primitives
- **React Router** - Client-side routing
- **Zustand/Context API** - State management

### Audio Processing Stack

- **Web Audio API** - Audio routing and graph management
- **AudioWorklet** - Real-time audio processing on separate thread
- **WebAssembly (Wasm)** - High-performance C++ audio DSP
- **Emscripten** - C++ to WebAssembly compiler
- **AudioContext** - Audio graph management

### Build Tools

- **Emscripten** - Compiles C++ audio engine to Wasm
- **Vite** - Bundles React app
- **Electron** - Desktop app wrapper
- **TypeScript** - Type checking and compilation

## 🔧 Development

### Prerequisites

- **Node.js** 18+ and npm
- **Emscripten SDK** (for building Wasm module)
- **Electron** (installed via npm)

### Installing Emscripten

#### Windows

```bash
# Clone Emscripten
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk

# Install and activate latest SDK
emsdk install latest
emsdk activate latest

# Activate environment (run in PowerShell/CMD)
.\emsdk_env.bat
```

#### Linux/macOS

```bash
# Clone Emscripten
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk

# Install and activate latest SDK
./emsdk install latest
./emsdk activate latest

# Activate environment
source ./emsdk_env.sh
```

### Available Scripts

```bash
# Development
npm run dev              # Start Vite dev server (web version)
npm run electron:dev     # Run Electron in development mode

# Building
npm run build            # Build React app for production
npm run build:dev        # Build in development mode

# Electron
npm run electron         # Run Electron app
npm run electron:start   # Start Electron with built app
npm run electron:build   # Build and run Electron

# Code Quality
npm run lint             # Run ESLint
```

### Building the WebAssembly Audio Engine

The C++ audio processing engine is compiled to WebAssembly using Emscripten.

#### Windows

```bash
# Make sure Emscripten environment is activated
# Then run the build script
cd cpp
.\build_wasm.ps1
# Or use the batch script
.\build_wasm.bat
```

#### Linux/macOS

```bash
# Make sure Emscripten environment is activated
cd cpp
chmod +x build_wasm.sh
./build_wasm.sh
```

The build process generates:
- `public/audio_processor.wasm` - WebAssembly binary
- `public/audio_processor.js` - Emscripten glue code
- `public/audio-processor.js` - AudioWorklet processor script

### Project Structure

```
martins-software-i-dj/
├── src/                    # React application source
│   ├── components/         # React components
│   │   ├── dj/            # DJ-specific components
│   │   └── ui/            # shadcn/ui components
│   ├── contexts/          # React contexts
│   ├── hooks/             # Custom React hooks
│   ├── services/          # Business logic services
│   │   └── AudioService.ts # Audio management singleton
│   └── pages/             # Page components
├── cpp/                    # C++ audio engine source
│   ├── audio_processor.cpp # Audio DSP algorithms
│   ├── audio_processor.h   # DSP header
│   ├── wasm_bindings.cpp   # Emscripten bindings
│   └── build_wasm.*        # Build scripts
├── electron/               # Electron main process
│   ├── main.cjs           # Main process entry
│   └── preload.js         # Preload script
├── public/                 # Static assets
│   ├── audio_processor.*  # Wasm module files
│   └── audio-processor.js # AudioWorklet processor
└── dist/                   # Build output
```

## 🎵 How It Works

### Audio Processing Pipeline

1. **Audio Loading**: Files are loaded via Electron IPC and decoded using Web Audio API
2. **Audio Graph**: Audio flows through `AudioBufferSourceNode` → `GainNode` → `AudioWorkletNode`
3. **Real-time Processing**: AudioWorklet runs C++ DSP code (compiled to Wasm) on a separate audio thread
4. **Crossfader**: Web Audio API gain nodes control deck mixing
5. **Output**: Audio is routed to master output and headphone output via `MediaStreamAudioDestinationNode`

### Key Components

- **AudioService**: Singleton managing AudioContext, AudioWorklet, and deck state
- **AudioWorklet**: Real-time audio processing thread running Wasm module
- **DJDeck**: React component for individual deck controls
- **AudioWaveform**: Interactive waveform visualization with seek functionality

## 🤝 Contributing

We welcome contributions to iDJ! Here's how you can help:

### Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/martins-software-i-dj.git
   cd martins-software-i-dj
   ```
3. **Create a new branch** for your feature:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **Install dependencies**:
   ```bash
   npm install
   ```
5. **Build the Wasm module** (see Building section above)
6. **Start development**:
   ```bash
   npm run dev          # Web version
   npm run electron:dev # Desktop version
   ```

### Development Workflow

1. **Make your changes** to the codebase
2. **Test your changes** thoroughly:
   ```bash
   npm run dev          # Test web version
   npm run electron:dev # Test desktop version
   ```
3. **Run linting** to ensure code quality:
   ```bash
   npm run lint
   ```
4. **Commit your changes** with semantic commits:
   ```bash
   git add .
   git commit -m "feat(Feature): add new audio effect"
   ```
5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```
6. **Create a Pull Request** on GitHub

### Code Style Guidelines

- **TypeScript**: Use strict typing, avoid `any`
- **React**: Use functional components with hooks
- **CSS**: Use Tailwind CSS classes, avoid custom CSS when possible
- **C++**: Follow modern C++17 practices for Wasm compilation
- **Commits**: Use conventional commit messages (feat:, fix:, docs:, etc.)

### Areas for Contribution

- 🎵 **Audio Features**: New effects, better audio processing algorithms
- 🎨 **UI/UX**: Interface improvements, new themes, accessibility
- ⌨️ **Controller Support**: MIDI controller integration
- 🐛 **Bug Fixes**: Performance improvements, stability, cross-platform compatibility
- 📚 **Documentation**: Code comments, user guides, API documentation
- 🧪 **Testing**: Unit tests, integration tests, E2E tests

### Reporting Issues

When reporting bugs, please include:

- **Operating System** and version
- **Node.js version**
- **Browser/Electron version** (if applicable)
- **Steps to reproduce** the issue
- **Expected vs actual behavior**
- **Console errors** (if any)
- **Screenshots** (if applicable)

## 🔍 Technical Details

### Web Audio API Architecture

- **AudioContext**: Main audio context managing the audio graph
- **AudioWorkletNode**: Custom audio processor running on audio thread
- **AudioBufferSourceNode**: Plays decoded audio buffers
- **GainNode**: Volume and crossfader control
- **MediaStreamAudioDestinationNode**: Output routing for device selection

### WebAssembly Integration

- **Emscripten**: Compiles C++ to Wasm with JavaScript glue code
- **AudioWorklet**: Loads and runs Wasm module on audio thread
- **Shared Memory**: Efficient data transfer between main thread and audio thread
- **Real-time Processing**: 128-sample buffer processing at 44.1kHz

### Electron Integration

- **Main Process**: Handles file system access and window management
- **Renderer Process**: Runs React app with Web Audio API
- **IPC**: Secure communication for file operations
- **Preload Script**: Exposes limited API to renderer process

## 🙏 Acknowledgments

- **Web Audio API** team for excellent browser audio capabilities
- **Emscripten** project for C++ to WebAssembly compilation
- **React** and **Vite** teams for excellent tooling
- **shadcn/ui** for beautiful component primitives
- **Electron** team for desktop app framework
- **Tailwind CSS** for utility-first styling

## 📄 License

[Add your license here]

---

**Happy Mixing! 🎧🎵**
