#!/usr/bin/env bash
set -euo pipefail

VESTI_BASE_URL="${VESTI_BASE_URL:-https://integracao.meuvesti.com/api}"
VESTI_API_KEY="${VESTI_API_KEY:-}"
VESTI_COMPANY_ID="${VESTI_COMPANY_ID:-}"
START_DATE="${START_DATE:-2021-09-28 01:00:00}"
END_DATE="${END_DATE:-2021-10-26 10:00:00}"
PAGE="${PAGE:-1}"
PERPAGE="${PERPAGE:-1}"
HAS_CATEGORY="${HAS_CATEGORY:-1}"

usage() {
  cat <<'EOF'
Uso:
  VESTI_API_KEY=... \
  VESTI_COMPANY_ID=... \
  ./scripts/test-vesti-products.sh

Variaveis opcionais:
  VESTI_BASE_URL  (default: https://integracao.meuvesti.com/api)
  START_DATE      (default: 2021-09-28 01:00:00)
  END_DATE        (default: 2021-10-26 10:00:00)
  PAGE            (default: 1)
  PERPAGE         (default: 1)
  HAS_CATEGORY    (default: 1)
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Erro: comando obrigatorio nao encontrado: $1" >&2
    exit 1
  fi
}

require_env() {
  local var_name="$1"
  if [[ -z "${!var_name:-}" ]]; then
    echo "Erro: variavel obrigatoria ausente: $var_name" >&2
    usage
    exit 1
  fi
}

main() {
  require_cmd curl
  require_cmd jq

  require_env VESTI_API_KEY
  require_env VESTI_COMPANY_ID

  local encoded_start
  local encoded_end
  local url
  local response

  encoded_start=$(python3 -c 'import sys; from urllib.parse import quote; print(quote(sys.argv[1], safe=""))' "$START_DATE")

  encoded_end=$(python3 -c 'import sys; from urllib.parse import quote; print(quote(sys.argv[1], safe=""))' "$END_DATE")

  url="${VESTI_BASE_URL%/}/v2/products/company/${VESTI_COMPANY_ID}?start_date=${encoded_start}&end_date=${encoded_end}&page=${PAGE}&perpage=${PERPAGE}&has_category=${HAS_CATEGORY}"

  echo "[1/2] Consultando Vesti: ${url}"
  response=$(curl -sS --request GET \
    --url "$url" \
    --header "apikey: ${VESTI_API_KEY}" \
    --header 'Content-Type: application/json')

  echo "[2/2] Resumo da resposta"
  echo "$response" | jq '{
    top_level_keys: (keys_unsorted),
    total_items_guess: (
      if type == "array" then length
      elif (.response | type) == "array" then (.response | length)
      elif (.items | type) == "array" then (.items | length)
      elif (.data | type) == "array" then (.data | length)
      elif (.products | type) == "array" then (.products | length)
      else null
      end
    ),
    first_item: (
      if type == "array" then .[0]
      elif (.response | type) == "array" then .response[0]
      elif (.items | type) == "array" then .items[0]
      elif (.data | type) == "array" then .data[0]
      elif (.products | type) == "array" then .products[0]
      else .
      end
    )
  }'
}

main "$@"