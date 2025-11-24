#!/bin/bash

# Build script for Firefox extension

echo "Building Firefox extension..."

# Create a temporary directory
TEMP_DIR="temp_build"
mkdir -p "$TEMP_DIR"

# Copy all extension files to temp directory
cp manifest.json content.js styles.css background.js favicon.png README.md LICENSE.MD "$TEMP_DIR/"

# Create the .xpi file (which is just a .zip file)
cd "$TEMP_DIR"
zip -r "../twitch_video_preview.xpi" .

# Clean up
cd ..
rm -rf "$TEMP_DIR"

echo "Build complete! Extension file: twitch_video_preview.xpi"