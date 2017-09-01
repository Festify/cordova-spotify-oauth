#!/usr/bin/env bash

AUTH_INSTALL_PATH="plugins/cordova-spotify-oauth/src/android/spotify-auth"
AUTH_DOWNLOAD_PATH="https://github.com/spotify/android-auth/archive/1.0.tar.gz"

if [ ! -d "$AUTH_INSTALL_PATH" ]; then
    mkdir -p "$AUTH_INSTALL_PATH"
    curl -LsS $AUTH_DOWNLOAD_PATH | tar -xz -C "$AUTH_INSTALL_PATH" --strip 1
else
    echo "Skipping auth library download since it's already there."
fi

cd $(dirname $0)/src/android/spotify-auth
echo "include ':auth-lib'" > settings.gradle

if [ ! -f "auth-lib/build/outputs/aar/spotify-android-auth-1.0.0.aar" ]; then
    ./gradlew clean build
else
    echo "Skipping auth library build since the AAR is already there."
fi