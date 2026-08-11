import { NextRequest, NextResponse } from 'next/server'
import { normalizePhone } from '@/lib/whatsapp/engine'
import { addLog, createId, deleteContactList, getState, saveContact, saveContactList } from '@/lib/whatsapp/store'
import { checkUserPermission } from '@/lib/actions/permissions'
import type { Contact, ContactList } from '@/lib/whatsapp/types'


export async function GET() {
  const permission = await checkUserPermission('messaging.view').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para visualizar mensageria' }, { status: 403 })
  }

  const state = getState()
  return NextResponse.json({ contacts: state.contacts, lists: state.contactLists })
}

export async function POST(req: NextRequest) {
  const permission = await checkUserPermission('messaging.manage_templates').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para gerenciar templates de mensageria' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as {
    kind?: 'contact' | 'list'
    id?: string
    name?: string
    phone?: string
    countryCode?: string
    email?: string
    document?: string
    customerType?: Contact['customerType']
    state?: string
    city?: string
    tags?: string[]
    source?: string
    optInWhatsapp?: boolean
    totalSpent?: number
    orderCount?: number
    lastPurchaseAt?: string
    contactIds?: string[]
    filters?: ContactList['filters']
    description?: string
  }
  const now = new Date().toISOString()

  if (body.kind === 'contact') {
    const normalizedPhone = normalizePhone(body.phone ?? '', body.countryCode ?? '55')
    if (!normalizedPhone) return NextResponse.json({ error: 'Invalid phone number.' }, { status: 400 })

    const contact: Contact = {
      id: body.id ?? createId('contact'),
      name: String(body.name ?? 'Contato').trim(),
      phone: normalizedPhone,
      countryCode: body.countryCode ?? normalizedPhone.slice(0, 2),
      email: body.email,
      document: body.document,
      customerType: body.customerType,
      tags: body.tags ?? [],
      source: body.source,
      status: body.phone && body.optInWhatsapp ? 'active' : 'incomplete',
      optInWhatsapp: Boolean(body.optInWhatsapp),
      state: body.state,
      city: body.city,
      totalSpent: Number(body.totalSpent ?? 0),
      orderCount: Number(body.orderCount ?? 0),
      lastPurchaseAt: body.lastPurchaseAt,
      createdAt: now,
      updatedAt: now,
    }
    saveContact(contact)
    addLog({
      type: 'contact_created',
      status: contact.optInWhatsapp ? 'success' : 'needs_attention',
      description: contact.optInWhatsapp ? 'Contact saved with WhatsApp opt-in.' : 'Contact saved without WhatsApp opt-in.',
      recommendedAction: contact.optInWhatsapp ? 'Add the contact to a list or campaign.' : 'Do not send campaigns until opt-in is confirmed.',
    })
    return NextResponse.json(getState())
  }

  const list: ContactList = {
    id: body.id ?? createId('list'),
    name: String(body.name ?? 'Nova lista').trim(),
    description: body.description,
    filters: body.filters ?? {},
    contactIds: body.contactIds ?? [],
    createdAt: now,
    updatedAt: now,
  }
  saveContactList(list)
  addLog({
    type: 'contact_list_created',
    status: 'success',
    description: 'Contact list saved.',
    safePayload: { name: list.name, contacts: list.contactIds.length },
    recommendedAction: 'Associate this list with a campaign and verify opt-in before sending.',
  })
  return NextResponse.json(getState())
}

export async function PATCH(req: NextRequest) {
  const permission = await checkUserPermission('messaging.manage_templates').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para gerenciar templates de mensageria' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as Partial<ContactList> & { id?: string }
  if (!body.id) return NextResponse.json({ error: 'List id is required.' }, { status: 400 })

  const existing = getState().contactLists.find((list) => list.id === body.id)
  if (!existing) return NextResponse.json({ error: 'List not found.' }, { status: 404 })

  saveContactList({ ...existing, ...body, updatedAt: new Date().toISOString() })
  return NextResponse.json(getState())
}

export async function DELETE(req: NextRequest) {
  const permission = await checkUserPermission('messaging.manage_templates').catch(() => null)
  if (permission?.has_permission !== true) {
    return NextResponse.json({ error: 'Você não tem permissão para gerenciar templates de mensageria' }, { status: 403 })
  }

  const { id } = await req.json().catch(() => ({})) as { id?: string }
  if (!id) return NextResponse.json({ error: 'List id is required.' }, { status: 400 })
  deleteContactList(id)
  return NextResponse.json(getState())
}
