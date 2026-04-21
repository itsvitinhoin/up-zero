#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

VESTI_RESOURCE="colors" \
EXTERNAL_ATTRIBUTE_CODE="color" \
EXTERNAL_ATTRIBUTE_NAME="Cor" \
TERM_META_MODE="color" \
bash "$SCRIPT_DIR/sync-vesti-attribute-to-external.sh"
