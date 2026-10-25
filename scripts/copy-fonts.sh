#!/usr/bin/env bash
# Populate site/assets/fonts/ from @fontsource (latin subsets) and the licensed faces under fonts/.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p site/assets/fonts
for f in lora-latin-400-normal lora-latin-400-italic lora-latin-500-normal lora-latin-600-normal lora-latin-600-italic lora-latin-700-normal; do
  cp "node_modules/@fontsource/lora/files/$f.woff2" site/assets/fonts/; done
for f in ibm-plex-mono-latin-400-normal ibm-plex-mono-latin-500-normal ibm-plex-mono-latin-600-normal; do
  cp "node_modules/@fontsource/ibm-plex-mono/files/$f.woff2" site/assets/fonts/; done
cp fonts/cooper-bt/*.woff2 site/assets/fonts/
