import { PrismaClient as SQLiteClient } from "../node_modules/.prisma/client-sqlite"
import { PrismaClient as PostgresClient } from "../node_modules/.prisma/client-postgres"

const sqlite = new SQLiteClient()
const postgres = new PostgresClient()

async function main() {
  console.log("🚀 Iniciando migración SQLite → PostgreSQL")

  console.log("🧹 Limpiando PostgreSQL vacío...")

  await postgres.auditLog.deleteMany()
  await postgres.pedidoEvento.deleteMany()
  await postgres.chatMensaje.deleteMany()
  await postgres.resena.deleteMany()
  await postgres.pedidoItem.deleteMany()
  await postgres.pedido.deleteMany()
  await postgres.favorito.deleteMany()
  await postgres.direccion.deleteMany()
  await postgres.sesion.deleteMany()
  await postgres.promocion.deleteMany()
  await postgres.deudaHistorial.deleteMany()
  await postgres.mesa.deleteMany()
  await postgres.empleado.deleteMany()
  await postgres.repartidorNegocio.deleteMany()
  await postgres.repartidor.deleteMany()
  await postgres.seccionProducto.deleteMany()
  await postgres.seccionCatalogo.deleteMany()
  await postgres.productoAgregado.deleteMany()
  await postgres.productoIngrediente.deleteMany()
  await postgres.agregado.deleteMany()
  await postgres.ingrediente.deleteMany()
  await postgres.opcionesCompartidas.deleteMany()
  await postgres.producto.deleteMany()
  await postgres.negocio.deleteMany()
  await postgres.cliente.deleteMany()
  await postgres.superAdmin.deleteMany()
  await postgres.configPlataforma.deleteMany()

  console.log("📦 Migrando clientes...")
  const clientes = await sqlite.cliente.findMany()
  for (const item of clientes) {
    await postgres.cliente.create({ data: item })
  }

  console.log("📦 Migrando negocios...")
  const negocios = await sqlite.negocio.findMany()
  for (const item of negocios) {
    await postgres.negocio.create({ data: item })
  }

  console.log("📦 Migrando direcciones...")
  const direcciones = await sqlite.direccion.findMany()
  for (const item of direcciones) {
    await postgres.direccion.create({ data: item })
  }

  console.log("📦 Migrando favoritos...")
  const favoritos = await sqlite.favorito.findMany()
  for (const item of favoritos) {
    await postgres.favorito.create({ data: item })
  }

  console.log("📦 Migrando productos...")
  const productos = await sqlite.producto.findMany()
  for (const item of productos) {
    await postgres.producto.create({ data: item })
  }

  console.log("📦 Migrando agregados...")
  const agregados = await sqlite.agregado.findMany()
  for (const item of agregados) {
    await postgres.agregado.create({ data: item })
  }

  console.log("📦 Migrando ingredientes...")
  const ingredientes = await sqlite.ingrediente.findMany()
  for (const item of ingredientes) {
    await postgres.ingrediente.create({ data: item })
  }

  console.log("📦 Migrando relaciones producto-agregado...")
  const productoAgregados = await sqlite.productoAgregado.findMany()
  for (const item of productoAgregados) {
    await postgres.productoAgregado.create({ data: item })
  }

  console.log("📦 Migrando relaciones producto-ingrediente...")
  const productoIngredientes = await sqlite.productoIngrediente.findMany()
  for (const item of productoIngredientes) {
    await postgres.productoIngrediente.create({ data: item })
  }

  console.log("📦 Migrando secciones...")
  const secciones = await sqlite.seccionCatalogo.findMany()
  for (const item of secciones) {
    await postgres.seccionCatalogo.create({ data: item })
  }

  console.log("📦 Migrando seccion-productos...")
  const seccionProductos = await sqlite.seccionProducto.findMany()
  for (const item of seccionProductos) {
    await postgres.seccionProducto.create({ data: item })
  }

  console.log("📦 Migrando opciones compartidas...")
  const opcionesCompartidas = await sqlite.opcionesCompartidas.findMany()
  for (const item of opcionesCompartidas) {
    await postgres.opcionesCompartidas.create({ data: item })
  }

  console.log("📦 Migrando pedidos...")
  const pedidos = await sqlite.pedido.findMany()
  for (const item of pedidos) {
    await postgres.pedido.create({ data: item })
  }

  console.log("📦 Migrando items de pedidos...")
  const pedidoItems = await sqlite.pedidoItem.findMany()
  for (const item of pedidoItems) {
    await postgres.pedidoItem.create({ data: item })
  }

  console.log("📦 Migrando mensajes de chat...")
  const chatMensajes = await sqlite.chatMensaje.findMany()
  for (const item of chatMensajes) {
    await postgres.chatMensaje.create({ data: item })
  }

  console.log("📦 Migrando reseñas...")
  const resenas = await sqlite.resena.findMany()
  for (const item of resenas) {
    await postgres.resena.create({ data: item })
  }

  console.log("📦 Migrando repartidores...")
  const repartidores = await sqlite.repartidor.findMany()
  for (const item of repartidores) {
    await postgres.repartidor.create({ data: item })
  }

  console.log("📦 Migrando repartidor-negocio...")
  const repartidorNegocios = await sqlite.repartidorNegocio.findMany()
  for (const item of repartidorNegocios) {
    await postgres.repartidorNegocio.create({ data: item })
  }

  console.log("📦 Migrando empleados...")
  const empleados = await sqlite.empleado.findMany()
  for (const item of empleados) {
    await postgres.empleado.create({ data: item })
  }

  console.log("📦 Migrando mesas...")
  const mesas = await sqlite.mesa.findMany()
  for (const item of mesas) {
    await postgres.mesa.create({ data: item })
  }

  console.log("📦 Migrando superadmin...")
  const superAdmins = await sqlite.superAdmin.findMany()
  for (const item of superAdmins) {
    await postgres.superAdmin.create({ data: item })
  }

  console.log("📦 Migrando deuda historial...")
  const deudaHistorial = await sqlite.deudaHistorial.findMany()
  for (const item of deudaHistorial) {
    await postgres.deudaHistorial.create({ data: item })
  }

  console.log("📦 Migrando sesiones...")
  const sesiones = await sqlite.sesion.findMany()
  for (const item of sesiones) {
    await postgres.sesion.create({ data: item })
  }

  console.log("📦 Migrando promociones...")
  const promociones = await sqlite.promocion.findMany()
  for (const item of promociones) {
    await postgres.promocion.create({ data: item })
  }

  console.log("📦 Migrando configuración de plataforma...")
  const configs = await sqlite.configPlataforma.findMany()
  for (const item of configs) {
    await postgres.configPlataforma.create({ data: item })
  }

  console.log("📦 Migrando auditoría...")
  const auditLogs = await sqlite.auditLog.findMany()
  for (const item of auditLogs) {
    await postgres.auditLog.create({ data: item })
  }

  console.log("📦 Migrando eventos de pedidos...")
  const pedidoEventos = await sqlite.pedidoEvento.findMany()
  for (const item of pedidoEventos) {
    await postgres.pedidoEvento.create({ data: item })
  }

  console.log("✅ Migración terminada correctamente")

  console.log("📊 Conteo final:")
  console.log("Clientes:", await postgres.cliente.count())
  console.log("Negocios:", await postgres.negocio.count())
  console.log("Productos:", await postgres.producto.count())
  console.log("Pedidos:", await postgres.pedido.count())
  console.log("Items:", await postgres.pedidoItem.count())
  console.log("Reseñas:", await postgres.resena.count())
  console.log("Repartidores:", await postgres.repartidor.count())
  console.log("Empleados:", await postgres.empleado.count())
  console.log("Mesas:", await postgres.mesa.count())
}

main()
  .catch((error) => {
    console.error("❌ Error migrando datos:")
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await sqlite.$disconnect()
    await postgres.$disconnect()
  })