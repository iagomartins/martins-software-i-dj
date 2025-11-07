#!/bin/bash
# Build script for compiling C++ audio processor to WebAssembly using Emscripten

# Check if emcc is available
if ! command -v emcc &> /dev/null; then
    echo "Error: Emscripten compiler (emcc) not found in PATH"
    echo "Please install Emscripten SDK and activate it:"
    echo "  git clone https://github.com/emscripten-core/emsdk.git"
    echo "  cd emsdk"
    echo "  ./emsdk install latest"
    echo "  ./emsdk activate latest"
    echo "  source ./emsdk_env.sh"
    exit 1
fi

echo "Building WebAssembly audio processor..."

# Compile to Wasm
emcc audio_processor.cpp wasm_bindings.cpp \
    -o ../public/audio_processor.js \
    -O3 \
    -s WASM=1 \
    -s EXPORTED_FUNCTIONS='["_init_processors","_set_deck1_volume","_set_deck1_pitch","_set_deck1_eq","_set_deck1_effect","_set_deck2_volume","_set_deck2_pitch","_set_deck2_eq","_set_deck2_effect","_set_crossfader","_set_master_volume","_process_deck_audio","_malloc","_free"]' \
    -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","UTF8ToString","stringToUTF8"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s MODULARIZE=1 \
    -s EXPORT_NAME="createAudioProcessorModule" \
    -s ENVIRONMENT='web,worker' \
    --no-entry

if [ $? -eq 0 ]; then
    echo ""
    echo "Build successful!"
    echo "Output files:"
    echo "  - public/audio_processor.js"
    echo "  - public/audio_processor.wasm"
else
    echo ""
    echo "Build failed!"
    exit 1
fi

