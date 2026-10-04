#!/bin/bash
# v4.1: build minified theme assets (site.min.css, v3.min.css, *.min.js). Run after editing the sources.
# Requires: cd tools && npm install
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T="$ROOT/wp-content/themes/sample-beach-house/assets"
cd "$ROOT/tools"
for c in site v3; do npx csso "$T/css/$c.css" -o "$T/css/$c.min.css" --no-restructure; done
for j in site booking experience; do npx terser "$T/js/$j.js" -c -m --comments '/^!|All-Moh/' -o "$T/js/$j.min.js"; done
ls -la "$T"/css/*.min.css "$T"/js/*.min.js
