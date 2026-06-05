const fs = require("fs")
const path = require("path")

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`[copy-assets] No existe: ${src}`)
    return
  }

  fs.mkdirSync(dest, { recursive: true })

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

const root = process.cwd()

const staticSrc = path.join(root, ".next", "static")
const staticDest = path.join(root, ".next", "standalone", ".next", "static")

const publicSrc = path.join(root, "public")
const publicDest = path.join(root, ".next", "standalone", "public")

console.log("[copy-assets] Copiando .next/static...")
copyDir(staticSrc, staticDest)

console.log("[copy-assets] Copiando public...")
copyDir(publicSrc, publicDest)

console.log("[copy-assets] Listo.")
