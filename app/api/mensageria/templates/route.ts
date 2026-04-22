import { NextRequest, NextResponse } from 'next/server'
import { deleteTemplate, getTemplate, getTemplates, upsertTemplate } from '@/lib/whatsapp/store'
import type { WaTemplate } from '@/lib/whatsapp/types'

export const dynamic = 'force-dynamic'

function extractVars(body: string): string[] {
  return [...new Set((body.match(/{{(\w+)}}/g) ?? []).map((m) => m.replace(/[{}]/g, '')))]
}

export async function GET() {
  const list = getTemplates().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  return NextResponse.json(list)
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Partial<WaTemplate>
  const id = `tpl-${Date.now()}`
  const template: WaTemplate = {
    id,
    name: body.name ?? 'Novo Modelo',
    body: body.body ?? '',
    variables: extractVars(body.body ?? ''),
    isActive: body.isActive ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  upsertTemplate(template)
  return NextResponse.json(template, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json() as { id: string } & Partial<WaTemplate>
  const existing = getTemplate(body.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const updatedBody = body.body ?? existing.body
  const updated: WaTemplate = {
    ...existing,
    ...body,
    variables: extractVars(updatedBody),
    updatedAt: new Date(),
  }
  upsertTemplate(updated)
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id: string }
  deleteTemplate(id)
  return NextResponse.json({ ok: true })
}
