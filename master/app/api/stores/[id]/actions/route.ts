import { MasterError, mutationSchema } from '../../../../../lib/contracts'
import { assertOrigin, body, errorResponse, mutateStore, privateHeaders } from '../../../../../lib/server'
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertOrigin(request)
    const { id } = await context.params
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) throw new MasterError(400, 'Loja inválida.')
    return Response.json(await mutateStore(Number(id), mutationSchema.parse(await body(request))), { headers: privateHeaders })
  } catch (error) { return errorResponse(error) }
}
