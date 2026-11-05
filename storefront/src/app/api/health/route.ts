// Liveness probe for the hosting platform. Lives under /api so the region
// middleware does not redirect it.
export const dynamic = "force-dynamic"

export function GET() {
  return Response.json({ status: "ok" })
}
