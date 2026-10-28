#!/usr/bin/env bash
# Applies Let 'Em Cook's iOS settings to the Xcode project Capacitor generates.
# Safe to run repeatedly (macOS only — uses PlistBuddy). Run after `npx cap add ios`
# or `npx cap sync ios`.
set -euo pipefail
cd "$(dirname "$0")/../.."

APP=ios/App/App
PLIST="$APP/Info.plist"
PB=/usr/libexec/PlistBuddy

set_key() { # key type value
  if $PB -c "Print :$1" "$PLIST" >/dev/null 2>&1; then $PB -c "Set :$1 $3" "$PLIST"; else $PB -c "Add :$1 $2 $3" "$PLIST"; fi
}
set_array() { # key values...
  local key=$1; shift
  $PB -c "Delete :$key" "$PLIST" >/dev/null 2>&1 || true
  $PB -c "Add :$key array" "$PLIST"
  local i=0
  for v in "$@"; do $PB -c "Add :$key:$i string $v" "$PLIST"; i=$((i+1)); done
}

set_key CFBundleDisplayName string "Let ’Em Cook"
# Photo/screenshot import uses the camera and photo library through the file picker.
set_key NSCameraUsageDescription string "Snap a photo of a recipe card or cookbook page so Walla can turn it into a recipe. Photos are read on your iPhone and never uploaded."
set_key NSPhotoLibraryUsageDescription string "Choose a recipe screenshot or photo to import, or a picture of the finished dish. Photos stay on your device."
set_key NSPhotoLibraryAddUsageDescription string "Save recipe images to your photo library."
# No custom encryption → no export-compliance paperwork.
set_key ITSAppUsesNonExemptEncryption bool false
set_key UIStatusBarStyle string UIStatusBarStyleDarkContent
set_key UIViewControllerBasedStatusBarAppearance bool true
set_array UISupportedInterfaceOrientations UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight
set_array "UISupportedInterfaceOrientations~ipad" UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight

# App icon (single 1024×1024; Xcode generates every size).
ICONSET="$APP/Assets.xcassets/AppIcon.appiconset"
mkdir -p "$ICONSET"
cp resources/ios/AppIcon-1024.png "$ICONSET/AppIcon-512@2x.png"
cat > "$ICONSET/Contents.json" <<'JSON'
{
  "images" : [ { "filename" : "AppIcon-512@2x.png", "idiom" : "universal", "platform" : "ios", "size" : "1024x1024" } ],
  "info" : { "author" : "xcode", "version" : 1 }
}
JSON

# Launch screen image.
SPLASH="$APP/Assets.xcassets/Splash.imageset"
if [ -d "$SPLASH" ]; then
  for f in "$SPLASH"/*.png; do cp resources/ios/Splash-2732.png "$f"; done
fi

# Privacy manifest, added to the app target's resources if missing.
cp resources/ios/PrivacyInfo.xcprivacy "$APP/PrivacyInfo.xcprivacy"
ruby scripts/ios/add_privacy_manifest.rb

# Version numbers: marketing version from package.json, build number from CI.
VERSION=$(node -p "require('./package.json').version")
BUILD=${BUILD_NUMBER:-1}
sed -i '' -E "s/MARKETING_VERSION = [^;]+;/MARKETING_VERSION = $VERSION;/g; s/CURRENT_PROJECT_VERSION = [^;]+;/CURRENT_PROJECT_VERSION = $BUILD;/g" ios/App/App.xcodeproj/project.pbxproj

echo "iOS project configured (version $VERSION, build $BUILD)."
