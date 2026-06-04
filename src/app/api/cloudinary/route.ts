import { NextResponse } from "next/server"

// ============================================
// GET /api/cloudinary — Return Cloudinary config for client-side uploads
// ============================================
// Only returns the cloud name and upload preset (never the API secret)

export async function GET() {
  return NextResponse.json({
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || "",
  })
}
