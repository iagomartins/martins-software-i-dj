# iDJ - Professional DJ Software

A modern, cross-platform DJ software built with React, TypeScript, and a custom C++ audio engine. Features real-time audio processing, dual-deck mixing, effects, EQ controls, and more.

## Quick Start

### Prerequisites

## 🎛️ Features

### Audio Engine (C++)

- **Real-time audio processing** with PortAudio
- **Dual-deck mixing** with independent controls
- **Crossfader** for smooth transitions
- **Pitch control** for tempo adjustment
- **EQ controls** (Low, Mid, High)
- **Audio effects** (Flanger, Filter, Echo, Reverb)
- **Master and headphone volume** controls
- **File loading** support for audio files

### User Interface (React)

- **Modern, responsive design** with Tailwind CSS
- **Dual-deck interface** with waveform visualization
- **Real-time controls** for all audio parameters
- **Keyboard mapping** for DJ controllers
- **Configuration modal** for settings
- **Error handling** with error boundaries
- **Toast notifications** for user feedback

### Desktop Integration (Electron)

- **Cross-platform** Windows, macOS, and Linux support
- **Native audio processing** through C++ engine
- **IPC communication** between frontend and audio engine
- **File system access** for audio file loading

## 🔧 Development

### Available Scripts

```bash
# Development
npm run dev              # Start Vite dev server
npm run electron:dev     # Run Electron in development

# Building
npm run build            # Build React app
npm run build:dev        # Build in development mode
npm run build:all        # Build both React app and C++ engine

# Electron
npm run electron         # Run Electron app
npm run electron:start   # Start Electron with built app
npm run electron:build   # Build and run Electron

# Code Quality
npm run lint             # Run ESLint
```

### Building the C++ Audio Engine

#### Windows

> IMPORTANT! Copy portaudio.dll to the CMake dist\Build\Release folder.

```bash
# Use the provided batch script
scripts/build-auto.bat
``
# Or manually
cd cpp
mkdir build && cd build
cmake ..
cmake --build . --config Release
```

#### Linux/macOS

```bash
cd cpp
mkdir build && cd build
cmake ..
make -j$(nproc)
```

### PortAudio Installation

#### Windows (using vcpkg)

```bash
# Install vcpkg
git clone https://github.com/Microsoft/vcpkg.git
cd vcpkg
.\bootstrap-vcpkg.bat

# Install PortAudio
.\vcpkg install portaudio:x64-windows
```

#### Linux (Ubuntu/Debian)

```bash
sudo apt-get install libportaudio2-dev
```

#### macOS (using Homebrew)

```bash
brew install portaudio
```

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
5. **Build the C++ audio engine** (see Building section above)

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
- **C++**: Follow modern C++17 practices
- **Commits**: Use conventional commit messages (feat:, fix:, docs:, etc.)

### Areas for Contribution

- 🎵 **Audio Features**: New effects, better audio processing
- 🎨 **UI/UX**: Interface improvements, new themes
- ⌨️ **Controller Support**: MIDI controller integration
- 🐛 **Bug Fixes**: Performance improvements, stability
- **Documentation**: Code comments, user guides
- 🧪 **Testing**: Unit tests, integration tests

### Reporting Issues

When reporting bugs, please include:

- **Operating System** and version
- **Node.js version**
- **Steps to reproduce** the issue
- **Expected vs actual behavior**
- **Console errors** (if any)
- **Screenshots** (if applicable)

## 🙏 Acknowledgments

- **PortAudio** for cross-platform audio I/O
- **React** and **Vite** teams for excellent tooling
- **shadcn/ui** for beautiful component primitives
- **Electron** team for desktop app framework
- **Tailwind CSS** for utility-first styling

---

**Happy Mixing! 🎧🎵**
