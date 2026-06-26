import { NextRequest, NextResponse } from "next/server"
import { validateCloudinaryPdfUrl } from "@/lib/resource-url"

const MAX_PDF_PROXY_SIZE = 10 * 1024 * 1024

function hasPdfSignature(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 5))
  return bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
}

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

  const validUrl = validateCloudinaryPdfUrl(url)
  if (!validUrl.ok) {
    return NextResponse.json({ error: "Only Cloudinary URLs are allowed" }, { status: 403 })
  }

  try {
    const response = await fetch(validUrl.value, {
      redirect: "manual",
      headers: {
        "User-Agent": "DeliGO-App/1.0",
      },
    })

    if (response.status >= 300 && response.status < 400) {
      return NextResponse.json({ error: "Redirects are not allowed" }, { status: 403 })
    }

    if (!response.ok) {
      console.error(`PDF proxy: Cloudinary returned ${response.status} for ${validUrl.value}`)
      return NextResponse.json(
        { error: `Failed to fetch PDF: ${response.status}` },
        { status: response.status }
      )
    }

    const contentLength = response.headers.get("content-length")
    if (contentLength && Number(contentLength) > MAX_PDF_PROXY_SIZE) {
      return NextResponse.json({ error: "PDF too large" }, { status: 413 })
    }

    const pdfBuffer = await response.arrayBuffer()
    if (pdfBuffer.byteLength > MAX_PDF_PROXY_SIZE) {
      return NextResponse.json({ error: "PDF too large" }, { status: 413 })
    }
    if (!hasPdfSignature(pdfBuffer)) {
      return NextResponse.json({ error: "Invalid PDF" }, { status: 400 })
    }

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
