import { NextRequest, NextResponse } from "next/server"

// ============================================
// GET /api/pdf-proxy?url=...
// Proxies PDF files from Cloudinary to the client.
// This avoids CORS and auth issues when displaying PDFs
// in iframes — the server fetches from Cloudinary (no browser
// restrictions) and serves the PDF from our own domain.
// ============================================

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 })
  }

  // Only allow Cloudinary URLs for security
  if (!url.includes("res.cloudinary.com")) {
    return NextResponse.json({ error: "Only Cloudinary URLs are allowed" }, { status: 403 })
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "DeliGO-App/1.0",
      },
    })

    if (!response.ok) {
      console.error(`PDF proxy: Cloudinary returned ${response.status} for ${url}`)
      return NextResponse.json(
        { error: `Failed to fetch PDF: ${response.status}` },
        { status: response.status }
      )
    }

    const pdfBuffer = await response.arrayBuffer()

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdfBuffer.byteLength),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
      },
    })
  } catch (error) {
    console.error("PDF proxy error:", error)
    return NextResponse.json({ error: "Failed to fetch PDF" }, { status: 500 })
  }
}
