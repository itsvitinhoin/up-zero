import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { processDueAutomationJobs } from '@/lib/whatsapp/automations'

function safeTextEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

async function processJobs(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET is not configured.' }, { status: 503 })
  }

  const authorization = req.headers.get('authorization')
  const supplied = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!supplied || !safeTextEqual(supplied, secret)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  }

  const requestedLimit = Number(req.nextUrl.searchParams.get('limit') ?? 50)
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(100, Math.max(1, Math.trunc(requestedLimit)))
    : 50
  const result = await processDueAutomationJobs(limit)
  return NextResponse.json({ ok: true, ...result })
}

export async function GET(req: NextRequest) {
  return processJobs(req)
}

export async function POST(req: NextRequest) {
  return processJobs(req)
}
