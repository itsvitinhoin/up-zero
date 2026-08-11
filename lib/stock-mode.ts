import type { StockMode } from "@/lib/types"

export const INFINITE_STOCK_MAX_QTY = 9999

export type StockModeConfig = {
	stockMode: StockMode
	variantMaxQty: number
}

export function normalizeQuantityByStockMode(quantity: number, config: StockModeConfig): number {
	const parsed = Math.max(1, Math.floor(quantity))

	if (config.stockMode === "BINARY") {
		return 1
	}

	if (config.stockMode === "INFINITO") {
		return parsed
	}

	if (config.stockMode === "FANTASY") {
		return Math.min(parsed, config.variantMaxQty)
	}

	return parsed
}

type ResolveAvailableQtyParams = {
	stockMode: StockMode
	variantMaxQty: number
	stockQty: number
	reservedQty?: number
}

export function resolveAvailableQtyByStockMode(params: ResolveAvailableQtyParams): number {
	const stockQty = Math.max(0, Math.floor(Number(params.stockQty || 0)))
	const reservedQty = Math.max(0, Math.floor(Number(params.reservedQty || 0)))
	const variantMaxQty = Math.max(1, Math.floor(Number(params.variantMaxQty || 1)))

	switch (params.stockMode) {
		case "BINARY":
			return stockQty > 0 ? 1 : 0
		case "INFINITO":
			return stockQty > 0 ? INFINITE_STOCK_MAX_QTY : 0
		case "FANTASY":
			return stockQty > 0 ? Math.max(0, variantMaxQty - reservedQty) : 0
		case "REAL":
			// stock_qty is already reduced when orders reserve units.
			return Math.max(0, stockQty)
		case "WMS":
		default:
			return Math.max(0, stockQty - reservedQty)
	}
}