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