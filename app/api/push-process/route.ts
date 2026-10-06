import { safeEqual } from '@/lib/push/auth'
import { processStore } from '@/lib/push/worker'
export const maxDuration = 300
export async function POST(request: Request) {
  const secret = process.env.PUSH_PROCESS_SECRET
  if (!secret || !safeEqual(request.headers.get('authorization') || '', `Bearer ${secret}`)) return Response.json({ error: 'Não autorizado.' }, { status: 401 })
  try {
    const { storeId } = await request.json()
    if (!Number.isSafeInteger(storeId) || storeId <= 0) return Response.json({ error: 'Loja inválida.' }, { status: 400 })
    return Response.json(await processStore(storeId))
  } catch { return Response.json({ error: 'Não foi possível processar os disparos.' }, { status: 503 }) }
}
