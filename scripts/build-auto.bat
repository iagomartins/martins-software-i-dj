@echo off
echo Building C++ Audio Engine...

cd cpp
if not exist build mkdir build
cd build

echo Configuring with CMake...
cmake ..

echo Building...
cmake --build . --config Release

echo Copying to dist folder...
if exist Release\audio_engine.dll copy Release\audio_engine.dll ..\..\dist\
if exist Release\audio_engine.lib copy Release\audio_engine.lib ..\..\dist\
if exist Debug\audio_engine.dll copy Debug\audio_engine.dll ..\..\dist\

echo Build complete!
pause
