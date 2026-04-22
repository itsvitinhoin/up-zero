#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

VESTI_RESOURCE="sizes" \
EXTERNAL_ATTRIBUTE_CODE="size" \
EXTERNAL_ATTRIBUTE_NAME="Tamanho" \
TERM_META_MODE="none" \
bash "$SCRIPT_DIR/sync-vesti-attribute-to-external.sh"