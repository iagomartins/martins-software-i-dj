cmake_minimum_required(VERSION 3.16)
project(DJAudioEngine)

set(CMAKE_CXX_STANDARD 17)

# Windows-specific configuration
if(WIN32)
    # Find PortAudio for Windows
    find_library(PORTAUDIO_LIB 
        NAMES portaudio
        PATHS 
            "C:/vcpkg/installed/x64-windows/lib"
            "C:/Program Files/PortAudio/lib"
            "C:/portaudio/lib"
    )
    
    find_path(PORTAUDIO_INCLUDE 
        NAMES portaudio.h
        PATHS 
            "C:/vcpkg/installed/x64-windows/include"
            "C:/Program Files/PortAudio/include"
            "C:/portaudio/include"
    )
    
    # If using vcpkg, set the toolchain
    if(DEFINED ENV{VCPKG_ROOT})
        set(CMAKE_TOOLCHAIN_FILE "$ENV{VCPKG_ROOT}/scripts/buildsystems/vcpkg.cmake")
    endif()
else()
    # Linux/macOS configuration
    find_package(PkgConfig REQUIRED)
    find_library(PORTAUDIO_LIB portaudio)
    find_path(PORTAUDIO_INCLUDE portaudio.h)
endif()

# Create shared library
add_library(audio_engine SHARED
    audio_engine.cpp
    audio_engine.h
)

# Windows-specific export definitions
if(WIN32)
    # Create a .def file for exports
    set(EXPORT_DEF_FILE "${CMAKE_CURRENT_SOURCE_DIR}/audio_engine.def")
    file(WRITE ${EXPORT_DEF_FILE}
        "EXPORTS\n"
        "AudioEngine_New\n"
        "AudioEngine_Delete\n"
        "AudioEngine_Initialize\n"
        "AudioEngine_Shutdown\n"
        "AudioEngine_SetDeckPlaying\n"
        "AudioEngine_SetDeckVolume\n"
        "AudioEngine_SetDeckPitch\n"
        "AudioEngine_SetDeckPosition\n"
        "AudioEngine_SetDeckFile\n"
        "AudioEngine_SetEffect\n"
        "AudioEngine_SetEQ\n"
        "AudioEngine_SetCrossfader\n"
        "AudioEngine_SetMasterVolume\n"
        "AudioEngine_SetHeadphoneVolume\n"
    )
    
    # Link the .def file
    target_sources(audio_engine PRIVATE ${EXPORT_DEF_FILE})
    
    # Set Windows-specific properties
    set_target_properties(audio_engine PROPERTIES
        RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/../dist"
        WINDOWS_EXPORT_ALL_SYMBOLS TRUE
    )
endif()

# Link PortAudio if found
if(PORTAUDIO_LIB AND PORTAUDIO_INCLUDE)
    target_include_directories(audio_engine PRIVATE ${PORTAUDIO_INCLUDE})
    target_link_libraries(audio_engine PRIVATE ${PORTAUDIO_LIB})
    message(STATUS "PortAudio found and linked")
else()
    message(WARNING "PortAudio not found - building without audio processing")
endif()

# Set output directory
set_target_properties(audio_engine PROPERTIES
    LIBRARY_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/../dist"
)