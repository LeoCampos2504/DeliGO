// DeliGO - Upload existing local images to Cloudinary and update database
// Run with: bun run scripts/upload-to-cloudinary.ts
// Or per-business: bun run scripts/upload-to-cloudinary.ts parrilla-del-campo

import { PrismaClient } from "@prisma/client"
import { v2 as cloudinary } from "cloudinary"
import { readFileSync, existsSync } from "fs"
import { join } from "path"

// Configure Cloudinary
cloudinary.config({
  cloud_name: "dztgrr6jn",
  api_key: "533619185276432",
  api_secret: "w57KhX95EqT8u980uRf6BOXerqc",
  secure: true,
})

const prisma = new PrismaClient()

const UPLOADS_DIR = join(process.cwd(), "public", "uploads")

// ============================================
// Upload helper
// ============================================
async function uploadToCloudinary(
  localPath: string,
  folder: string,
  publicId: string
): Promise<string | null> {
  if (!existsSync(localPath)) {
    console.log(`  ⚠️ File not found: ${localPath}`)
    return null
  }

  try {
    const buffer = readFileSync(localPath)
    const base64 = buffer.toString("base64")
    const dataUri = `data:image/png;base64,${base64}`

    const result = await cloudinary.uploader.upload(dataUri, {
      folder,
      public_id: publicId,
      overwrite: true,
    })

    return result.secure_url
  } catch (error) {
    console.error(`  ❌ Upload error: ${error}`)
    return null
  }
}

// ============================================
// All businesses with their local image mapping
// ============================================
const businesses = [
  {
    slug: "parrilla-del-campo",
    nombre: "Parrilla del Campo",
    productos: [
      { nombre: "Asado para 2", file: "prod-asado.png" },
      { nombre: "Bife de Chorizo", file: "prod-bife-de-chorizo.png" },
      { nombre: "Milanesa con Papas", file: "prod-milanesa.png" },
      { nombre: "Choripán Artesanal", file: "prod-choripan.png" },
    ],
  },
  {
    slug: "sushi-zen",
    nombre: "Sushi Zen",
    productos: [
      { nombre: "Sushi Combinado 24 pcs", file: "prod-sushi-combinado.png" },
      { nombre: "Ramen de Cerdo", file: "prod-ramen.png" },
      { nombre: "Ceviche Japonés", file: "prod-ceviche.png" },
      { nombre: "Gyozas (8 unidades)", file: "prod-gyozas.png" },
    ],
  },
  {
    slug: "la-verde-vida",
    nombre: "La Verde Vida",
    productos: [
      { nombre: "Buddha Bowl", file: "prod-buddha-bowl.png" },
      { nombre: "Ensalada César Veggie", file: "prod-ensalada-caesar.png" },
      { nombre: "Hamburguesa Veggie", file: "prod-hamburguesa-veggie.png" },
      { nombre: "Smoothie Verde Detox", file: "prod-smoothie-verde.png" },
    ],
  },
  {
    slug: "burger-lab",
    nombre: "Burger Lab",
    productos: [
      { nombre: "Clásica Cheeseburger", file: "prod-burger-clasica.png" },
      { nombre: "Doble Stack", file: "prod-burger-doble.png" },
      { nombre: "Papas con Cheddar & Bacon", file: "prod-papas-cheddar.png" },
      { nombre: "BBQ Bacon Burger", file: "prod-burger-bbq.png" },
    ],
  },
  {
    slug: "dolce-forno",
    nombre: "Dolce Forno",
    productos: [
      { nombre: "Pizza Muzzarella", file: "prod-pizza-muzzarella.png" },
      { nombre: "Pizza Fugazzeta", file: "prod-pizza-fugazzeta.png" },
      { nombre: "Focaccia Romana", file: "prod-focaccia.png" },
      { nombre: "Tiramisú Casero", file: "prod-tiramisu.png" },
    ],
  },
  {
    slug: "taco-loco",
    nombre: "Taco Loco",
    productos: [
      { nombre: "Tacos al Pastor (3 u.)", file: "prod-tacos-al-pastor.png" },
      { nombre: "Burrito Supremo", file: "prod-burrito.png" },
      { nombre: "Nachos Locos", file: "prod-nachos.png" },
      { nombre: "Quesadillas (2 u.)", file: "prod-quesadillas.png" },
    ],
  },
  {
    slug: "helados-patagonia",
    nombre: "Helados Patagonia",
    productos: [
      { nombre: "Helado Dulce de Leche", file: "prod-helado-dulce-leche.png" },
      { nombre: "Helado de Limón", file: "prod-helado-limon.png" },
      { nombre: "Sundae de Chocolate", file: "prod-helado-chocolate.png" },
      { nombre: "Milkshake Clásico", file: "prod-milkshake.png" },
    ],
  },
  {
    slug: "cafe-buenavista",
    nombre: "Café Buenavista",
    productos: [
      { nombre: "Latte Especial", file: "prod-latte.png" },
      { nombre: "Medialunas de Manteca (3 u.)", file: "prod-medialunas.png" },
      { nombre: "Tostadas con Palta", file: "prod-tostadas.png" },
      { nombre: "Torta de Chocolate", file: "prod-torta-chocolate.png" },
    ],
  },
  {
    slug: "wok-fusion",
    nombre: "Wok Fusion",
    productos: [
      { nombre: "Pad Thai", file: "prod-pad-thai.png" },
      { nombre: "Arroz Chino Especial", file: "prod-arroz-chino.png" },
      { nombre: "Chow Mein de Pollo", file: "prod-chow-mein.png" },
      { nombre: "Spring Rolls (6 u.)", file: "prod-roll-spring.png" },
    ],
  },
  {
    slug: "empanadas-del-abuela",
    nombre: "Empanadas de la Abuela",
    productos: [
      { nombre: "Empanada de Carne", file: "prod-empanada-carne.png" },
      { nombre: "Empanada de Pollo", file: "prod-empanada-pollo.png" },
      { nombre: "Empanada de Humita", file: "prod-empanada-humita.png" },
      { nombre: "Empanada de Jamón y Queso", file: "prod-empanada-jamon.png" },
    ],
  },
]

// ============================================
// Process one business
// ============================================
async function processBusiness(biz: typeof businesses[0]) {
  console.log(`\n📋 Processing: ${biz.nombre} (${biz.slug})`)

  // Find the negocio in DB
  const negocio = await prisma.negocio.findFirst({ where: { slug: biz.slug } })
  if (!negocio) {
    console.log(`  ⚠️ Business not found in DB, skipping. Run seed-data-only first.`)
    return
  }

  // 1. Upload logo
  const logoLocal = join(UPLOADS_DIR, "logos", biz.slug, "logo.png")
  console.log(`  📤 Uploading logo...`)
  const logoUrl = await uploadToCloudinary(logoLocal, `logos/${biz.slug}`, "logo")
  if (logoUrl) {
    await prisma.negocio.update({ where: { id: negocio.id }, data: { logoUrl } })
    console.log(`  ✅ Logo uploaded: ${logoUrl.substring(0, 70)}...`)
  }

  // 2. Upload banner
  const bannerLocal = join(UPLOADS_DIR, "banners", biz.slug, "banner.png")
  console.log(`  📤 Uploading banner...`)
  const bannerUrl = await uploadToCloudinary(bannerLocal, `banners/${biz.slug}`, "banner")
  if (bannerUrl) {
    await prisma.negocio.update({ where: { id: negocio.id }, data: { bannerUrl } })
    console.log(`  ✅ Banner uploaded: ${bannerUrl.substring(0, 70)}...`)
  }

  // 3. Upload product images
  for (const prod of biz.productos) {
    const prodLocal = join(UPLOADS_DIR, "productos", biz.slug, prod.file)
    console.log(`  📤 Uploading product: ${prod.nombre}...`)
    const prodUrl = await uploadToCloudinary(prodLocal, `productos/${biz.slug}`, prod.file.replace(".png", ""))
    if (prodUrl) {
      // Find the product by name and negocioId
      const producto = await prisma.producto.findFirst({
        where: { nombre: prod.nombre, negocioId: negocio.id },
      })
      if (producto) {
        await prisma.producto.update({ where: { id: producto.id }, data: { imagenUrl: prodUrl } })
        console.log(`  ✅ ${prod.nombre} uploaded`)
      } else {
        console.log(`  ⚠️ Product "${prod.nombre}" not found in DB`)
      }
    }
  }

  console.log(`  ✅ ${biz.nombre} done!`)
}

// ============================================
// Main
// ============================================
async function main() {
  const targetSlug = process.argv[2] // optional: filter by slug

  if (targetSlug) {
    const biz = businesses.find(b => b.slug === targetSlug)
    if (!biz) {
      console.error(`❌ Business "${targetSlug}" not found. Available: ${businesses.map(b => b.slug).join(", ")}`)
      process.exit(1)
    }
    console.log(`🚀 Uploading images for single business: ${biz.nombre}`)
    await processBusiness(biz)
  } else {
    console.log(`🚀 Uploading ALL local images to Cloudinary (${businesses.length} businesses)`)
    for (const biz of businesses) {
      await processBusiness(biz)
    }
  }

  console.log(`\n🎉 Upload complete!`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error("❌ Error:", e)
  prisma.$disconnect()
  process.exit(1)
})
