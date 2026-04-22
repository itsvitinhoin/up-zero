#!/usr/bin/env bash
set -euo pipefail

VESTI_BASE_URL="${VESTI_BASE_URL:-https://integracao.meuvesti.com/api}"
VESTI_API_KEY="${VESTI_API_KEY:-}"
VESTI_COMPANY_ID="${VESTI_COMPANY_ID:-}"
VESTI_CATALOGUE_ID="${VESTI_CATALOGUE_ID:-62a92727ae}"
VESTI_RESOURCE="${VESTI_RESOURCE:-colors}"

EXTERNAL_BASE_URL="${EXTERNAL_BASE_URL:-http://localhost:8080}"
EXTERNAL_API_KEY="${EXTERNAL_API_KEY:-}"
EXTERNAL_INTEGRATION="${EXTERNAL_INTEGRATION:-vesti}"
EXTERNAL_ATTRIBUTE_CODE="${EXTERNAL_ATTRIBUTE_CODE:-color}"
EXTERNAL_ATTRIBUTE_NAME="${EXTERNAL_ATTRIBUTE_NAME:-Cor}"
TERM_META_MODE="${TERM_META_MODE:-none}"
DRY_RUN="${DRY_RUN:-0}"

usage() {
  cat <<'EOF'
Uso:
  VESTI_API_KEY=... \
  VESTI_COMPANY_ID=... \
  EXTERNAL_API_KEY=... \
  VESTI_RESOURCE=colors \
  EXTERNAL_ATTRIBUTE_CODE=color \
  EXTERNAL_ATTRIBUTE_NAME=Cor \
  ./scripts/sync-vesti-attribute-to-external.sh

Variaveis opcionais:
  VESTI_BASE_URL           (default: https://integracao.meuvesti.com/api)
  VESTI_CATALOGUE_ID       (default: 62a92727ae)
  VESTI_RESOURCE           (default: colors)
  EXTERNAL_BASE_URL        (default: http://localhost:8080)
  EXTERNAL_INTEGRATION     (default: vesti)
  EXTERNAL_ATTRIBUTE_CODE  (default: color)
  EXTERNAL_ATTRIBUTE_NAME  (default: Cor)
  TERM_META_MODE           (default: none) - valores: none, color
  DRY_RUN                  (default: 0) - quando 1, nao envia POSTs
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

post_external() {
  local endpoint="$1"
  local payload="$2"

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[DRY_RUN] POST ${endpoint}"
    echo "$payload" | jq '.'
    return 0
  fi

  local response
  local body
  local status

  response=$(curl -sS -X POST "${EXTERNAL_BASE_URL%/}${endpoint}" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: ${EXTERNAL_API_KEY}" \
    --data "$payload" \
    -w '\n%{http_code}')

  body=$(echo "$response" | sed '$d')
  status=$(echo "$response" | tail -n1)

  if [[ "$status" -lt 200 || "$status" -ge 300 ]]; then
    echo "Erro ao chamar ${endpoint} (HTTP ${status})" >&2
    echo "$body" >&2
    exit 1
  fi
}

normalize_vesti_items() {
  jq -c '
    def ensure_array:
      if type == "array" then . else [] end;

    def arr:
      if type == "array" then .
      elif type == "object" then
        if (.response | type) == "array" then .response
        elif (.items | type) == "array" then .items
        elif (.colors | type) == "array" then .colors
        elif (.sizes | type) == "array" then .sizes
        elif (.data | type) == "array" then .data
        elif (.data | type) == "object" then (.data.items // .data.colors // .data.sizes // .data.response // []) | ensure_array
        else []
        end
      else []
      end;

    arr
    | map(select(type == "object"))
    | map({
        external_id: ((.id // .external_id // .slug // .name // "") | tostring),
        raw_code: ((.slug // .name // .id // .code // "") | tostring),
        name: ((.name // .description // .label // .slug // .id // "") | tostring | gsub("^\\s+|\\s+$"; "")),
        hex: ((.code // "") | tostring),
        group_name: (if .group_name == null then null else (.group_name | tostring) end)
      })
    | map(.code = (
        .raw_code
        | ascii_upcase
        | gsub("[^A-Z0-9]+"; "_")
        | gsub("^_+|_+$"; "")
      ))
    | map(select(.name != "" and .name != "null" and .code != "NULL"))
    | unique_by(.code)
    | to_entries
    | map(
        .value
        | if .code == "" then .code = ("TERM_" + ((.key + 1) | tostring)) else . end
      )
  '
}

build_term_payload() {
  local item="$1"
  local sort_order="$2"
  local code
  local name

  code=$(echo "$item" | jq -r '.code')
  name=$(echo "$item" | jq -r '.name')

  if [[ "$TERM_META_MODE" == "color" ]]; then
    local hex
    local group_name

    hex=$(echo "$item" | jq -r '.hex')
    group_name=$(echo "$item" | jq -r '.group_name // empty')

    jq -n \
      --arg code "$code" \
      --arg name "$name" \
      --arg hex "$hex" \
      --arg groupName "$group_name" \
      --argjson sort_order "$sort_order" \
      '{
        code: $code,
        name: $name,
        sort_order: $sort_order,
        meta: {
          hex: $hex,
          group_name: (if $groupName == "" then null else $groupName end)
        }
      }'
    return 0
  fi

  jq -n \
    --arg code "$code" \
    --arg name "$name" \
    --argjson sort_order "$sort_order" \
    '{
      code: $code,
      name: $name,
      sort_order: $sort_order
    }'
}

main() {
  require_cmd jq
  require_cmd curl
  require_cmd sed

  require_env VESTI_API_KEY
  require_env VESTI_COMPANY_ID
  require_env EXTERNAL_API_KEY

  local vesti_url
  local raw_items
  local normalized
  local count
  local attribute_payload

  vesti_url="${VESTI_BASE_URL%/}/v1/catalogue/company/${VESTI_COMPANY_ID}/${VESTI_RESOURCE}?catalogue_id=${VESTI_CATALOGUE_ID}"

  echo "[1/4] Buscando ${VESTI_RESOURCE} no Vesti..."
  raw_items=$(curl -sS -X GET "$vesti_url" \
    -H "apikey: ${VESTI_API_KEY}" \
    -H "Content-Type: application/json")

  echo "[2/4] Normalizando payload de ${VESTI_RESOURCE}..."
  normalized=$(echo "$raw_items" | normalize_vesti_items)
  count=$(echo "$normalized" | jq 'length')

  if [[ "$count" -eq 0 ]]; then
    echo "Nenhum item valido encontrado no retorno do Vesti para ${VESTI_RESOURCE}."
    exit 0
  fi

  echo "Total de itens normalizados: ${count}"

  echo "[3/4] Garantindo atributo '${EXTERNAL_ATTRIBUTE_CODE}' na External API..."
  attribute_payload=$(jq -n \
    --arg integration "$EXTERNAL_INTEGRATION" \
    --arg external_id "vesti-company-${VESTI_COMPANY_ID}-catalogue-${VESTI_CATALOGUE_ID}-${VESTI_RESOURCE}" \
    --arg code "$EXTERNAL_ATTRIBUTE_CODE" \
    --arg name "$EXTERNAL_ATTRIBUTE_NAME" \
    '{
      external_ref: {
        integration: $integration,
        external_id: $external_id
      },
      code: $code,
      name: $name,
      sort_order: 0
    }')

  post_external "/external/v1/attributes" "$attribute_payload"

  echo "[4/4] Criando/atualizando termos de ${EXTERNAL_ATTRIBUTE_CODE}..."
  local i=0
  while IFS= read -r item; do
    local term_payload
    term_payload=$(build_term_payload "$item" "$i")
    post_external "/external/v1/attributes/by-code/${EXTERNAL_ATTRIBUTE_CODE}/terms" "$term_payload"
    i=$((i + 1))
  done < <(echo "$normalized" | jq -c '.[]')

  echo "Sincronizacao finalizada com sucesso para ${EXTERNAL_ATTRIBUTE_CODE}."
}

main "$@"