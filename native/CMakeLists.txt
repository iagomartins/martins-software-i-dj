cmake_minimum_required(VERSION 3.15)
project(juce_audio_processor LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# CMake.js integration
include_directories(${CMAKE_JS_INC})
link_directories(${CMAKE_JS_LIB})

# JUCE setup
set(JUCE_ROOT "C:/JUCE")
add_subdirectory(${JUCE_ROOT} juce)

# Define your native module target
add_library(juce_audio_processor SHARED
    src/juce_audio_processor.cpp
    src/binding.cpp
)

# Output settings for Node.js native addon
set_target_properties(juce_audio_processor PROPERTIES
    PREFIX ""
    SUFFIX ".node"
)

# Include node-addon-api headers
execute_process(
    COMMAND node -p "require('node-addon-api').include"
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    OUTPUT_VARIABLE NODE_ADDON_API_DIR
    OUTPUT_STRIP_TRAILING_WHITESPACE
)

target_include_directories(juce_audio_processor PRIVATE
    ${NODE_ADDON_API_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/node_modules/node-addon-api
)

# Link JUCE modules
target_link_libraries(juce_audio_processor PRIVATE
    juce::juce_audio_basics
    juce::juce_audio_devices
    juce::juce_audio_formats
    juce::juce_audio_processors
    juce::juce_audio_utils
    juce::juce_core
    juce::juce_data_structures
    juce::juce_dsp
    juce::juce_events
    juce::juce_graphics
    juce::juce_analytics
)

# Link N-API library
target_link_libraries(juce_audio_processor PRIVATE
    ${CMAKE_JS_LIB}
)

# Windows-specific compile flags
if(WIN32)
    target_compile_options(juce_audio_processor PRIVATE /W3)
endif()