import { NextResponse } from "next/server"

// ============================================
// GET /api/cloudinary — Return non-secret Cloudinary config
// ============================================
// Direct unsigned browser uploads are disabled; use /api/upload instead.

export async function GET() {
  return NextResponse.json({
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    uploadPreset: "",
  })
}
