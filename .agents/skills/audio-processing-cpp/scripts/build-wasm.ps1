# Automated build script for compiling C++ audio processor to WebAssembly
# Location: .agents/skills/audio-processing-cpp/scripts/build-wasm.ps1

$ErrorActionPreference = "Stop"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   iDJ WebAssembly Audio Engine Build    " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Check for Emscripten compiler (emcc)
$emccCmd = Get-Command emcc -ErrorAction SilentlyContinue
if (-not $emccCmd) {
    Write-Host "[ERROR] Emscripten compiler (emcc) not found in PATH." -ForegroundColor Red
    Write-Host "Please install or activate the Emscripten SDK:" -ForegroundColor Yellow
    Write-Host "  1. git clone https://github.com/emscripten-core/emsdk.git"
    Write-Host "  2. cd emsdk"
    Write-Host "  3. .\emsdk.bat install latest"
    Write-Host "  4. .\emsdk.bat activate latest"
    Write-Host "  5. .\emsdk_env.ps1"
    exit 1
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")
$cppDir = Join-Path $repoRoot "cpp"
$publicDir = Join-Path $repoRoot "public"
$outJs = Join-Path $publicDir "audio_processor.js"
$outWasm = Join-Path $publicDir "audio_processor.wasm"

Write-Host "[INFO] Repository Root: $repoRoot" -ForegroundColor Gray
Write-Host "[INFO] Compiling from: $cppDir" -ForegroundColor Gray

# Complete list of exported functions including filter controls
$exportedFuncs = '["_init_processors","_set_deck1_volume","_set_deck1_pitch","_set_deck1_eq","_set_deck1_effect","_set_deck1_filter","_set_deck2_volume","_set_deck2_pitch","_set_deck2_eq","_set_deck2_effect","_set_deck2_filter","_set_crossfader","_set_master_volume","_process_deck_audio","_malloc","_free"]'
$exportedMethods = '["ccall","cwrap","UTF8ToString","stringToUTF8"]'

Push-Location $cppDir
try {
    Write-Host "[BUILD] Invoking emcc with -O3 optimization..." -ForegroundColor Green
    & emcc audio_processor.cpp wasm_bindings.cpp `
        -o $outJs `
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
        Write-Host "[SUCCESS] Wasm compilation succeeded!" -ForegroundColor Green
        if (Test-Path $outWasm) {
            $wasmSize = (Get-Item $outWasm).Length / 1KB
            Write-Host "  - $outWasm ($([math]::Round($wasmSize, 2)) KB)" -ForegroundColor Cyan
        }
        if (Test-Path $outJs) {
            $jsSize = (Get-Item $outJs).Length / 1KB
            Write-Host "  - $outJs ($([math]::Round($jsSize, 2)) KB)" -ForegroundColor Cyan
        }
    } else {
        Write-Host "[ERROR] emcc returned exit code $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }
} finally {
    Pop-Location
}
