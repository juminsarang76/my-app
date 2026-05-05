export async function GET() {
  return Response.json({ message: "Hello from API!" })
}

export async function POST(req: Request) {
  const body = await req.json()
  return Response.json({ received: body })
}