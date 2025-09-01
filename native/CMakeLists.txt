cmake_minimum_required(VERSION 3.15)
project(juce_audio_processor)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Source files
set(SOURCES
    src/juce_audio_processor.cpp
    src/binding.cpp
)

# Create shared library
add_library(juce_audio_processor SHARED ${SOURCES})

# Include Node.js headers (cmake-js provides these automatically)
target_include_directories(juce_audio_processor PRIVATE ${CMAKE_JS_INC})

# Link Node.js libraries
target_link_libraries(juce_audio_processor ${CMAKE_JS_LIB})

# Set output name
set_target_properties(juce_audio_processor PROPERTIES
    PREFIX ""
    SUFFIX ".node"
)

# Windows-specific settings
if(WIN32)
    # Set JUCE paths - adjust these to match your JUCE installation
    set(JUCE_ROOT "C:/JUCE" CACHE PATH "Path to JUCE framework")
    set(JUCE_MODULES_DIR "${JUCE_ROOT}/modules")
    
    # Include directories for JUCE
    target_include_directories(juce_audio_processor PRIVATE
        "${JUCE_MODULES_DIR}"
        "${JUCE_MODULES_DIR}/JUCE/modules"
    )
    
    # Link JUCE libraries - adjust paths as needed
    target_link_libraries(juce_audio_processor
        "${JUCE_ROOT}/lib/juce_audio_processors.lib"
        "${JUCE_ROOT}/lib/juce_dsp.lib"
        "${JUCE_ROOT}/lib/juce_core.lib"
        "${JUCE_ROOT}/lib/juce_audio_basics.lib"
        "${JUCE_ROOT}/lib/juce_audio_formats.lib"
        "${JUCE_ROOT}/lib/juce_audio_devices.lib"
        "${JUCE_ROOT}/lib/juce_audio_utils.lib"
        "${JUCE_ROOT}/lib/juce_events.lib"
        "${JUCE_ROOT}/lib/juce_data_structures.lib"
        "${JUCE_ROOT}/lib/juce_graphics.lib"
        "${JUCE_ROOT}/lib/juce_text_utils.lib"
        "${JUCE_ROOT}/lib/juce_analytics.lib"
    )
    
    # Compiler flags for Windows
    target_compile_options(juce_audio_processor PRIVATE /W3)
    
else()
    # Unix/Linux fallback
    find_package(PkgConfig REQUIRED)
    pkg_check_modules(JUCE REQUIRED juce)
    target_include_directories(juce_audio_processor PRIVATE ${JUCE_INCLUDE_DIRS})
    target_link_libraries(juce_audio_processor ${JUCE_LIBRARIES})
    target_compile_options(juce_audio_processor PRIVATE ${JUCE_CFLAGS_OTHER})
endif()