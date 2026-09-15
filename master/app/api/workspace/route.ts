import { errorResponse, getWorkspace, privateHeaders } from '../../../lib/server'
export async function GET() {
  try { return Response.json(await getWorkspace(), { headers: privateHeaders }) } catch (error) { return errorResponse(error) }
}
