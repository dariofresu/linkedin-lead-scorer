#!/bin/bash
echo "Updating LinkedIn Lead Scorer..."
cd "$(dirname "$0")"
git pull
echo ""
echo "Done! Reloading Chrome extension..."
open -a "Google Chrome" "chrome://extensions" 2>/dev/null || xdg-open "chrome://extensions" 2>/dev/null
echo "Click the reload button on LinkedIn Lead Scorer in Chrome."
