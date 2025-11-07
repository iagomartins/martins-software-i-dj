# Build script for compiling C++ audio processor to WebAssembly using Emscripten

# Check if emcc is available
$emccPath = Get-Command emcc -ErrorAction SilentlyContinue
if (-not $emccPath) {
    Write-Host "Error: Emscripten compiler (emcc) not found in PATH" -ForegroundColor Red
    Write-Host "Please install Emscripten SDK and activate it:"
    Write-Host "  git clone https://github.com/emscripten-core/emsdk.git"
    Write-Host "  cd emsdk"
    Write-Host "  .\emsdk.bat install latest"
    Write-Host "  .\emsdk.bat activate latest"
    Write-Host "  .\emsdk_env.bat"
    exit 1
}

Write-Host "Building WebAssembly audio processor..." -ForegroundColor Green

# Compile to Wasm
$exportedFuncs = '["_init_processors","_set_deck1_volume","_set_deck1_pitch","_set_deck1_eq","_set_deck1_effect","_set_deck2_volume","_set_deck2_pitch","_set_deck2_eq","_set_deck2_effect","_set_crossfader","_set_master_volume","_process_deck_audio","_malloc","_free"]'
$exportedMethods = '["ccall","cwrap","UTF8ToString","stringToUTF8"]'

& emcc audio_processor.cpp wasm_bindings.cpp `
    -o ../public/audio_processor.js `
    -O3 `
    -s WASM=1 `
    -s "EXPORTED_FUNCTIONS=$exportedFuncs" `
    -s "EXPORTED_RUNTIME_METHODS=$exportedMethods" `
    -s ALLOW_MEMORY_GROWTH=1 `
    -s MODULARIZE=1 `
    -s EXPORT_NAME=createAudioProcessorModule `
    -s "ENVIRONMENT=web,worker" `
    --no-entry

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Build successful!" -ForegroundColor Green
    Write-Host "Output files:"
    Write-Host "  - public/audio_processor.js"
    Write-Host "  - public/audio_processor.wasm"
} else {
    Write-Host ""
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

