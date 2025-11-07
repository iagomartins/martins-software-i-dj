@echo off
setlocal enabledelayedexpansion
REM Build script for compiling C++ audio processor to WebAssembly using Emscripten

REM Check if emcc is available
where emcc >nul 2>nul
if !ERRORLEVEL! NEQ 0 (
    echo Error: Emscripten compiler (emcc) not found in PATH
    echo Please install Emscripten SDK and activate it:
    echo   git clone https://github.com/emscripten-core/emsdk.git
    echo   cd emsdk
    echo   emsdk install latest
    echo   emsdk activate latest
    echo   emsdk_env.bat
    exit /b 1
)

echo Building WebAssembly audio processor...

REM Compile to Wasm
REM Store JSON strings in variables to avoid quote parsing issues
set "EXPORTED_FUNCS=[\"_init_processors\",\"_set_deck1_volume\",\"_set_deck1_pitch\",\"_set_deck1_eq\",\"_set_deck1_effect\",\"_set_deck2_volume\",\"_set_deck2_pitch\",\"_set_deck2_eq\",\"_set_deck2_effect\",\"_set_crossfader\",\"_set_master_volume\",\"_process_deck_audio\",\"_malloc\",\"_free\"]"
set "EXPORTED_METHODS=[\"ccall\",\"cwrap\",\"UTF8ToString\",\"stringToUTF8\"]"

emcc audio_processor.cpp wasm_bindings.cpp -o ../public/audio_processor.js -O3 -s WASM=1 -s EXPORTED_FUNCTIONS=!EXPORTED_FUNCS! -s EXPORTED_RUNTIME_METHODS=!EXPORTED_METHODS! -s ALLOW_MEMORY_GROWTH=1 -s MODULARIZE=1 -s EXPORT_NAME=createAudioProcessorModule -s ENVIRONMENT=web,worker --no-entry

if !ERRORLEVEL! EQU 0 (
    echo.
    echo Build successful!
    echo Output files:
    echo   - public/audio_processor.js
    echo   - public/audio_processor.wasm
) else (
    echo.
    echo Build failed!
    exit /b 1
)

