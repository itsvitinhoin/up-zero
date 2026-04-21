#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[1/2] Sincronizando cores..."
bash "$SCRIPT_DIR/sync-vesti-colors-to-external.sh"

echo "[2/2] Sincronizando tamanhos..."
bash "$SCRIPT_DIR/sync-vesti-sizes-to-external.sh"

echo "Sincronizacao completa de atributos do Vesti finalizada."