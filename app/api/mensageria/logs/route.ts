import { NextRequest, NextResponse } from 'next/server'
import { clearLogs, getLogs } from '@/lib/whatsapp/store'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const ruleId = searchParams.get('ruleId')
  const limit = Math.min(Number(searchParams.get('limit') ?? '200'), 500)

  let result = getLogs()
  if (status) result = result.filter((l) => l.status === status)
  if (ruleId) result = result.filter((l) => l.ruleId === ruleId)

  return NextResponse.json(result.slice(0, limit))
}

export async function DELETE() {
  clearLogs()
  return NextResponse.json({ ok: true })
}
