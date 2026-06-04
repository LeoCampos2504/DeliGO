// DeliGO - Seed Script: Populate 10 sample businesses with full details
// Run with: bun run scripts/seed-negocios.ts

import { PrismaClient } from "@prisma/client"
import { mkdir, copyFile } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

const prisma = new PrismaClient()

// ============================================
// Image helper: copy to public/uploads/ for local serving
// ============================================
async function copyImageToPublic(
  sourcePath: string,
  category: string,
  slug: string,
  filename: string
): Promise<string> {
  const relativePath = `uploads/${category}/${slug}`
  const absolutePath = join(process.cwd(), "public", relativePath)

  if (!existsSync(absolutePath)) {
    await mkdir(absolutePath, { recursive: true })
  }

  const destPath = join(absolutePath, filename)
  if (existsSync(sourcePath)) {
    await copyFile(sourcePath, destPath)
  }

  return `/${relativePath}/${filename}`
}

// ============================================
// Business data definitions
// ============================================
const businesses = [
  {
    slug: "parrilla-del-campo",
    nombre: "Parrilla del Campo",
    rubro: "restaurante",
    colorPrincipal: "#D32F2F",
    usuario: "parriladelcampo",
    email: "parrilla@deligo.app",
    password: "$2a$10$dummyhashparrilladelcampo1234567890123456",
    mensajeBienvenida: "¡Bienvenidos a Parrilla del Campo! Los mejores asados de la región.",
    ofreceDelivery: true,
    zonaDeliveryActiva: true,
    deliveryMode: "expert",
    precioDelivery: 500,
    precioDeliveryDefault: 500,
    tiempoEntrega: 45,
    lat: -26.1845,
    lng: -58.1732,
    horarioMode: "experto",
    horarios: JSON.stringify({
      "1": { apertura: "11:00", cierre: "23:00" },
      "2": { apertura: "11:00", cierre: "23:00" },
      "3": { apertura: "11:00", cierre: "23:00" },
      "4": { apertura: "11:00", cierre: "23:00" },
      "5": { apertura: "11:00", cierre: "23:30" },
      "6": { apertura: "11:00", cierre: "00:00" },
      "7": { apertura: "11:00", cierre: "00:00" },
    }),
    categorias: JSON.stringify(["Parrilla", "Platos", "Postres", "Bebidas"]),
    zonasDelivery: JSON.stringify([
      { nombre: "Centro", precio: 400, coords: [[-26.190, -58.180], [-26.190, -58.165], [-26.178, -58.165], [-26.178, -58.180]] },
      { nombre: "Zona Norte", precio: 600, coords: [[-26.178, -58.180], [-26.178, -58.165], [-26.165, -58.165], [-26.165, -58.180]] },
      { nombre: "Zona Sur", precio: 550, coords: [[-26.190, -58.180], [-26.190, -58.165], [-26.200, -58.165], [-26.200, -58.180]] },
    ]),
    whatsapp: "5493784551234",
    instagram: "@parrilladelcampo",
    aceptaTransferencia: true,
    aliasBancario: "parrilla.campo.mp",
    promocionado: true,
    ordenPromocion: 1,
    productos: [
      { nombre: "Asado para 2", precio: 8500, categoria: "Parrilla", descripcion: "Asado completo con vacío, entraña, chorizo y morcilla. Incluye chimichurri y salsas.", img: "prod-asado.png", descuento: true, tipoDescuento: "porcentaje", valorDescuento: 15 },
      { nombre: "Bife de Chorizo", precio: 6200, categoria: "Parrilla", descripcion: "Bife de chorizo de 400g a la parrilla, con papas fritas o ensalada.", img: "prod-bife-de-chorizo.png" },
      { nombre: "Milanesa con Papas", precio: 4500, categoria: "Platos", descripcion: "Milanesa de carne napolitana con papas fritas y ensalada.", img: "prod-milanesa.png" },
      { nombre: "Choripán Artesanal", precio: 2200, categoria: "Platos", descripcion: "Chorizo parrillero en pan casero con chimichurri y salsa criolla.", img: "prod-choripan.png", descuento: true, tipoDescuento: "porcentaje", valorDescuento: 20 },
    ],
  },
  {
    slug: "sushi-zen",
    nombre: "Sushi Zen",
    rubro: "restaurante",
    colorPrincipal: "#1A237E",
    usuario: "sushizen",
    email: "sushizen@deligo.app",
    password: "$2a$10$dummyhashsushizen123456789012345678",
    mensajeBienvenida: "Sushi Zen — Armonía en cada bocado 🍣",
    ofreceDelivery: true,
    zonaDeliveryActiva: true,
    deliveryMode: "expert",
    precioDelivery: 450,
    precioDeliveryDefault: 450,
    tiempoEntrega: 35,
    lat: -26.1820,
    lng: -58.1705,
    horarioMode: "experto",
    horarios: JSON.stringify({
      "1": { apertura: "11:30", cierre: "22:30" },
      "2": { apertura: "11:30", cierre: "22:30" },
      "3": { apertura: "11:30", cierre: "22:30" },
      "4": { apertura: "11:30", cierre: "22:30" },
      "5": { apertura: "11:30", cierre: "23:00" },
      "6": { apertura: "12:00", cierre: "23:30" },
      "7": { apertura: "12:00", cierre: "22:30" },
    }),
    categorias: JSON.stringify(["Sushi", "Calientes", "Entradas", "Bebidas"]),
    zonasDelivery: JSON.stringify([
      { nombre: "Centro", precio: 350, coords: [[-26.190, -58.180], [-26.190, -58.165], [-26.178, -58.165], [-26.178, -58.180]] },
      { nombre: "Zona Norte", precio: 500, coords: [[-26.178, -58.180], [-26.178, -58.165], [-26.165, -58.165], [-26.165, -58.180]] },
    ]),
    whatsapp: "5493784561234",
    instagram: "@sushizen.ok",
    aceptaTransferencia: true,
    aliasBancario: "sushi.zen.mp",
    promocionado: true,
    ordenPromocion: 2,
    productos: [
      { nombre: "Sushi Combinado 24 pcs", precio: 7800, categoria: "Sushi", descripcion: "Combinado de 24 piezas: 8 sashimi, 8 nigiri, 8 maki variados.", img: "prod-sushi-combinado.png", descuento: true, tipoDescuento: "porcentaje", valorDescuento: 10 },
      { nombre: "Ramen de Cerdo", precio: 4500, categoria: "Calientes", descripcion: "Ramen tonkotsu con fideos, cerdo, huevo marinado y verduras.", img: "prod-ramen.png" },
      { nombre: "Ceviche Japonés", precio: 3800, categoria: "Entradas", descripcion: "Ceviche de salmón con marinada oriental, palta y sésamo.", img: "prod-ceviche.png" },
      { nombre: "Gyozas (8 unidades)", precio: 3200, categoria: "Entradas", descripcion: "Gyozas de cerdo salteadas con salsa de soja y jengibre.", img: "prod-gyozas.png" },
    ],
  },
  {
    slug: "la-verde-vida",
    nombre: "La Verde Vida",
    rubro: "restaurante",
    colorPrincipal: "#2E7D32",
    usuario: "laverdevida",
    email: "laverdevida@deligo.app",
    password: "$2a$10$dummyhashlaverdevida1234567890123456",
    mensajeBienvenida: "¡Comé rico y saludable! 🥗 100% natural y veggie.",
    ofreceDelivery: true,
    zonaDeliveryActiva: true,
    deliveryMode: "expert",
    precioDelivery: 350,
    precioDeliveryDefault: 350,
    tiempoEntrega: 30,
    lat: -26.1865,
    lng: -58.1680,
    horarioMode: "experto",
    horarios: JSON.stringify({
      "1": { apertura: "08:00", cierre: "21:00" },
      "2": { apertura: "08:00", cierre: "21:00" },
      "3": { apertura: "08:00", cierre: "21:00" },
      "4": { apertura: "08:00", cierre: "21:00" },
      "5": { apertura: "08:00", cierre: "21:00" },
      "6": { apertura: "09:00", cierre: "22:00" },
      "7": { apertura: "09:00", cierre: "15:00" },
    }),
    categorias: JSON.stringify(["Bowls", "Ensaladas", "Sándwiches", "Smoothies"]),
    zonasDelivery: JSON.stringify([
      { nombre: "Centro", precio: 300, coords: [[-26.190, -58.180], [-26.190, -58.165], [-26.178, -58.165], [-26.178, -58.180]] },
      { nombre: "Todo", precio: 450, coords: [[-26.195, -58.185], [-26.195, -58.160], [-26.170, -58.160], [-26.170, -58.185]] },
    ]),
    whatsapp: "5493784571234",
    instagram: "@laverdevida.ok",
    aceptaTransferencia: true,
    aliasBancario: "verde.vida.mp",
    productos: [
      { nombre: "Buddha Bowl", precio: 4200, categoria: "Bowls", descripcion: "Quinoa, garbanzos, palta, zanahoria, hummus y semillas.", img: "prod-buddha-bowl.png" },
      { nombre: "Ensalada César Veggie", precio: 3500, categoria: "Ensaladas", descripcion: "Lechuga, croutons integrales, parmesano vegano, aderezo césar.", img: "prod-ensalada-caesar.png", descuento: true, tipoDescuento: "porcentaje", valorDescuento: 15 },
      { nombre: "Hamburguesa Veggie", precio: 3900, categoria: "Sándwiches", descripcion: "Medallón de lentejas y verduras con palta y salsa especial.", img: "prod-hamburguesa-veggie.png" },
      { nombre: "Smoothie Verde Detox", precio: 2200, categoria: "Smoothies", descripcion: "Espinaca, manzana, jengibre, pepino y limón.", img: "prod-smoothie-verde.png" },
    ],
  },
  {
    slug: "burger-lab",
    nombre: "Burger Lab",
    rubro: "restaurante",
    colorPrincipal: "#E65100",
    usuario: "burgerlab",
    email: "burgerlab@deligo.app",
    password: "$2a$10$dummyhashburgerlab12345678901234567",
    mensajeBienvenida: "🍔 Bienvenido al Laboratorio de la Hamburguesa",
    ofreceDelivery: true,
    zonaDeliveryActiva: true,
    deliveryMode: "simple",
    precioDelivery: 400,
    precioDeliveryDefault: 400,
    tiempoEntrega: 25,
    lat: -26.1800,
    lng: -58.1750,
    horarioMode: "simple",
    horarios: "{}",
    abiertoManual: true,
    categorias: JSON.stringify(["Burgers", "Papas", "Combos", "Bebidas"]),
    zonasDelivery: JSON.stringify([]),
    whatsapp: "5493784581234",
    instagram: "@burgerlab.ok",
    aceptaTransferencia: true,
    aliasBancario: "burger.lab.mp",
    promocionado: true,
    ordenPromocion: 3,
    productos: [
      { nombre: "Clásica Cheeseburger", precio: 3800, categoria: "Burgers", descripcion: "Medallón de 180g, cheddar fundido, lechuga, tomate y salsa especial.", img: "prod-burger-clasica.png" },
      { nombre: "Doble Stack", precio: 5500, categoria: "Burgers", descripcion: "Doble medallón de 150g, doble cheddar, bacon y cebolla caramelizada.", img: "prod-burger-doble.png", descuento: true, tipoDescuento: "porcentaje", valorDescuento: 20 },
      { nombre: "Papas con Cheddar & Bacon", precio: 2500, categoria: "Papas", descripcion: "Papas fritas crocantes con salsa cheddar y bacon crocante.", img: "prod-papas-cheddar.png" },
      { nombre: "BBQ Bacon Burger", precio: 4800, categoria: "Burgers", descripcion: "Medallón de 180g, bacon, cebolla crispy, salsa BBQ ahumada.", img: "prod-burger-bbq.png" },
    ],
  },
  {
    slug: "dolce-forno",
    nombre: "Dolce Forno",
    rubro: "restaurante",
    colorPrincipal: "#5D4037",
    usuario: "dolceforno",
    email: "dolceforno@deligo.app",
    password: "$2a$10$dummyhashdolceforno12345678901234567",
    mensajeBienvenida: "🍕 ¡La auténtica pizza italiana, directo del horno a tu casa!",
    ofreceDelivery: true,
    zonaDeliveryActiva: true,
    deliveryMode: "expert",
    precioDelivery: 400,
    precioDeliveryDefault: 400,
    tiempoEntrega: 40,
    lat: -26.1830,
    lng: -58.1710,
    horarioMode: "experto",
    horarios: JSON.stringify({
      "1": { apertura: "18:00", cierre: "23:30" },
      "2": { apertura: "18:00", cierre: "23:30" },
      "3": { apertura: "18:00", cierre: "23:30" },
      "4": { apertura: "18:00", cierre: "23:30" },
      "5": { apertura: "18:00", cierre: "00:00" },
      "6": { apertura: "18:00", cierre: "00:30" },
      "7": { apertura: "19:00", cierre: "00:00" },
    }),
    categorias: JSON.stringify(["Pizzas", "Focaccias", "Pastas", "Postres"]),
    zonasDelivery: JSON.stringify([
      { nombre: "Centro", precio: 350, coords: [[-26.190, -58.180], [-26.190, -58.165], [-26.178, -58.165], [-26.178, -58.180]] },
      { nombre: "Periférico", precio: 550, coords: [[-26.195, -58.185], [-26.195, -58.160], [-26.170, -58.160], [-26.170, -58.185]] },
    ]),
    whatsapp: "5493784591234",
    instagram: "@dolceforno.pizza",
    aceptaTransferencia: true,
    aliasBancario: "dolce.forno.mp",
    productos: [
      { nombre: "Pizza Muzzarella", precio: 4500, categoria: "Pizzas", descripcion: "Pizza clásica con muzzarella derretida y salsa de tomate fresca.", img: "prod-pizza-muzzarella.png" },
      { nombre: "Pizza Fugazzeta", precio: 5200, categoria: "Pizzas", descripcion: "Pizza rellena de muzzarella y provolone con cebolla.", img: "prod-pizza-fugazzeta.png", descuento: true, tipoDescuento: "porcentaje", valorDescuento: 10 },
      { nombre: "Focaccia Romana", precio: 3200, categoria: "Focaccias", descripcion: "Focaccia con romero, aceite de oliva y sal gruesa.", img: "prod-focaccia.png" },
      { nombre: "Tiramisú Casero", precio: 2800, categoria: "Postres", descripcion: "Tiramisú artesanal con café y cacao. Porción individual.", img: "prod-tiramisu.png" },
    ],
  },
  {
    slug: "taco-loco",
    nombre: "Taco Loco",
    rubro: "restaurante",
    colorPrincipal: "#4CAF50",
    usuario: "tacoloco",
    email: "tacoloco@deligo.app",
    password: "$2a$10$dummyhashtacoloco123456789012345678",
    mensajeBienvenida: "🌮 ¡La onda mexicana llegó para quedarse! Taco Loco 🌶️",
    ofreceDelivery: true,
    zonaDeliveryActiva: true,
    deliveryMode: "expert",
    precioDelivery: 400,
    precioDeliveryDefault: 400,
    tiempoEntrega: 30,
    lat: -26.1875,
    lng: -58.1690,
    horarioMode: "experto",
    horarios: JSON.stringify({
      "1": { apertura: "11:00", cierre: "22:00" },
      "2": { apertura: "11:00", cierre: "22:00" },
      "3": { apertura: "11:00", cierre: "22:00" },
      "4": { apertura: "11:00", cierre: "22:00" },
      "5": { apertura: "11:00", cierre: "23:00" },
      "6": { apertura: "11:00", cierre: "23:30" },
      "7": { apertura: "12:00", cierre: "22:00" },
    }),
    categorias: JSON.stringify(["Tacos", "Burritos", "Entradas", "Bebidas"]),
    zonasDelivery: JSON.stringify([
      { nombre: "Centro", precio: 350, coords: [[-26.190, -58.180], [-26.190, -58.165], [-26.178, -58.165], [-26.178, -58.180]] },
    ]),
    whatsapp: "5493784601234",
    instagram: "@tacoloco.ok",
    aceptaTransferencia: true,
    aliasBancario: "taco.loco.mp",
    promocionado: true,
    ordenPromocion: 4,
    productos: [
      { nombre: "Tacos al Pastor (3 u.)", precio: 3500, categoria: "Tacos", descripcion: "3 tacos de cerdo al pastor con piña, cilantro y salsa verde.", img: "prod-tacos-al-pastor.png" },
      { nombre: "Burrito Supremo", precio: 4200, categoria: "Burritos", descripcion: "Burrito relleno de carne, arroz, frijoles, queso y guacamole.", img: "prod-burrito.png", descuento: true, tipoDescuento: "porcentaje", valorDescuento: 15 },
      { nombre: "Nachos Locos", precio: 3200, categoria: "Entradas", descripcion: "Nachos con cheddar, guacamole, crema y jalapeños.", img: "prod-nachos.png" },
      { nombre: "Quesadillas (2 u.)", precio: 2800, categoria: "Entradas", descripcion: "2 quesadillas de pollo con queso cheddar y pimientos.", img: "prod-quesadillas.png" },
    ],
  },
  {
    slug: "helados-patagonia",
    nombre: "Helados Patagonia",
    rubro: "negocio",
    colorPrincipal: "#7B1FA2",
    usuario: "heladospatagonia",
    email: "heladospatagonia@deligo.app",
    password: "$2a$10$dummyhashheladospatagonia12345678901",
    mensajeBienvenida: "🍦 ¡Los helados más ricos de la Patagonia! Sabores artesanales.",
    ofreceDelivery: true,
    zonaDeliveryActiva: true,
    deliveryMode: "simple",
    precioDelivery: 300,
    precioDeliveryDefault: 300,
    tiempoEntrega: 20,
    lat: -26.1850,
    lng: -58.1720,
    horarioMode: "simple",
    horarios: "{}",
    abiertoManual: true,
    categorias: JSON.stringify(["Helados", "Milkshakes", "Postres Helados"]),
    zonasDelivery: JSON.stringify([]),
    whatsapp: "5493784611234",
    instagram: "@heladospatagonia",
    aceptaTransferencia: true,
    aliasBancario: "helados.patagonia.mp",
    productos: [
      { nombre: "Helado Dulce de Leche", precio: 1800, categoria: "Helados", descripcion: "2 bochas de dulce de leche artesanal en cucurucho o vasito.", img: "prod-helado-dulce-leche.png" },
      { nombre: "Helado de Limón", precio: 1600, categoria: "Helados", descripcion: "2 bochas de limón al limone, refrescante y natural.", img: "prod-helado-limon.png", descuento: true, tipoDescuento: "porcentaje", valorDescuento: 10 },
      { nombre: "Sundae de Chocolate", precio: 2800, categoria: "Postres Helados", descripcion: "3 bochas de chocolate con salsa, crema y nueces.", img: "prod-helado-chocolate.png" },
      { nombre: "Milkshake Clásico", precio: 2500, categoria: "Milkshakes", descripcion: "Milkshake espeso de vainilla o chocolate con crema.", img: "prod-milkshake.png" },
    ],
  },
  {
    slug: "cafe-buenavista",
    nombre: "Café Buenavista",
    rubro: "restaurante",
    colorPrincipal: "#4E342E",
    usuario: "cafebuenavista",
    email: "cafebuenavista@deligo.app",
    password: "$2a$10$dummyhashcafebuenavista12345678901234",
    mensajeBienvenida: "☕ ¡Tu café de especialidad te espera! Buenavista Coffee",
    ofreceDelivery: true,
    zonaDeliveryActiva: false,
    deliveryMode: "",
    precioDelivery: 0,
    precioDeliveryDefault: 0,
    tiempoEntrega: 20,
    lat: -26.1810,
    lng: -58.1765,
    horarioMode: "experto",
    horarios: JSON.stringify({
      "1": { apertura: "07:00", cierre: "20:00" },
      "2": { apertura: "07:00", cierre: "20:00" },
      "3": { apertura: "07:00", cierre: "20:00" },
      "4": { apertura: "07:00", cierre: "20:00" },
      "5": { apertura: "07:00", cierre: "21:00" },
      "6": { apertura: "08:00", cierre: "21:00" },
      "7": { apertura: "08:00", cierre: "18:00" },
    }),
    categorias: JSON.stringify(["Café", "Panadería", "Desayunos", "Postres"]),
    zonasDelivery: JSON.stringify([]),
    whatsapp: "5493784621234",
    instagram: "@cafebuenavista",
    aceptaTransferencia: true,
    aliasBancario: "cafe.buenavista.mp",
    salonActivo: true,
    zonasSalon: JSON.stringify(["Interior", "Terraza"]),
    productos: [
      { nombre: "Latte Especial", precio: 2200, categoria: "Café", descripcion: "Café latte con leche artesanal y latte art. Especialidad de la casa.", img: "prod-latte.png" },
      { nombre: "Medialunas de Manteca (3 u.)", precio: 1500, categoria: "Panadería", descripcion: "3 medialunas de manteca recién horneadas, tibias.", img: "prod-medialunas.png" },
      { nombre: "Tostadas con Palta", precio: 2800, categoria: "Desayunos", descripcion: "Tostadas artesanales con palta, huevo pochado y semillas.", img: "prod-tostadas.png", descuento: true, tipoDescuento: "porcentaje", valorDescuento: 15 },
      { nombre: "Torta de Chocolate", precio: 2500, categoria: "Postres", descripcion: "Porción de torta húmeda de chocolate con ganache.", img: "prod-torta-chocolate.png" },
    ],
  },
  {
    slug: "wok-fusion",
    nombre: "Wok Fusion",
    rubro: "restaurante",
    colorPrincipal: "#C62828",
    usuario: "wokfusion",
    email: "wokfusion@deligo.app",
    password: "$2a$10$dummyhashwokfusion123456789012345678",
    mensajeBienvenida: "🥢 ¡Fusión asiática con sabor local! Wok Fusion",
    ofreceDelivery: true,
    zonaDeliveryActiva: true,
    deliveryMode: "expert",
    precioDelivery: 450,
    precioDeliveryDefault: 450,
    tiempoEntrega: 35,
    lat: -26.1840,
    lng: -58.1740,
    horarioMode: "experto",
    horarios: JSON.stringify({
      "1": { apertura: "11:00", cierre: "22:00" },
      "2": { apertura: "11:00", cierre: "22:00" },
      "3": { apertura: "11:00", cierre: "22:00" },
      "4": { apertura: "11:00", cierre: "22:00" },
      "5": { apertura: "11:00", cierre: "23:00" },
      "6": { apertura: "12:00", cierre: "23:00" },
      "7": { apertura: "12:00", cierre: "22:00" },
    }),
    categorias: JSON.stringify(["Noodles", "Arroces", "Entradas", "Especiales"]),
    zonasDelivery: JSON.stringify([
      { nombre: "Centro", precio: 350, coords: [[-26.190, -58.180], [-26.190, -58.165], [-26.178, -58.165], [-26.178, -58.180]] },
      { nombre: "Zona Norte", precio: 500, coords: [[-26.178, -58.180], [-26.178, -58.165], [-26.165, -58.165], [-26.165, -58.180]] },
      { nombre: "Zona Sur", precio: 500, coords: [[-26.190, -58.180], [-26.190, -58.165], [-26.200, -58.165], [-26.200, -58.180]] },
    ]),
    whatsapp: "5493784631234",
    instagram: "@wokfusion.ok",
    aceptaTransferencia: true,
    aliasBancario: "wok.fusion.mp",
    productos: [
      { nombre: "Pad Thai", precio: 4200, categoria: "Noodles", descripcion: "Fideos de arroz salteados con langostinos, maní y limón.", img: "prod-pad-thai.png" },
      { nombre: "Arroz Chino Especial", precio: 3800, categoria: "Arroces", descripcion: "Arroz frito con pollo, verduras y huevo. Estilo cantonés.", img: "prod-arroz-chino.png", descuento: true, tipoDescuento: "porcentaje", valorDescuento: 10 },
      { nombre: "Chow Mein de Pollo", precio: 3900, categoria: "Noodles", descripcion: "Fideos chinos salteados con pollo, vegetales y salsa de soja.", img: "prod-chow-mein.png" },
      { nombre: "Spring Rolls (6 u.)", precio: 2500, categoria: "Entradas", descripcion: "6 rollitos primavera crocantes con salsa agridulce.", img: "prod-roll-spring.png" },
    ],
  },
  {
    slug: "empanadas-del-abuela",
    nombre: "Empanadas de la Abuela",
    rubro: "negocio",
    colorPrincipal: "#F57C00",
    usuario: "empanadasabuela",
    email: "empanadasabuela@deligo.app",
    password: "$2a$10$dummyhashempanadasabuela1234567890123",
    mensajeBienvenida: "🥟 ¡Las empanadas de la abuela, como las de casa! Caseras y al horno.",
    ofreceDelivery: true,
    zonaDeliveryActiva: true,
    deliveryMode: "simple",
    precioDelivery: 350,
    precioDeliveryDefault: 350,
    tiempoEntrega: 25,
    lat: -26.1860,
    lng: -58.1700,
    horarioMode: "experto",
    horarios: JSON.stringify({
      "1": { apertura: "09:00", cierre: "21:00" },
      "2": { apertura: "09:00", cierre: "21:00" },
      "3": { apertura: "09:00", cierre: "21:00" },
      "4": { apertura: "09:00", cierre: "21:00" },
      "5": { apertura: "09:00", cierre: "22:00" },
      "6": { apertura: "09:00", cierre: "22:00" },
      "7": { apertura: "10:00", cierre: "20:00" },
    }),
    categorias: JSON.stringify(["Empanadas", "Combos", "Bebidas"]),
    zonasDelivery: JSON.stringify([]),
    whatsapp: "5493784641234",
    instagram: "@empanadasabuela",
    aceptaTransferencia: true,
    aliasBancario: "empanadas.abuela.mp",
    promocionado: true,
    ordenPromocion: 5,
    productos: [
      { nombre: "Empanada de Carne", precio: 800, categoria: "Empanadas", descripcion: "Empanada de carne cortada a cuchillo con huevo, aceituna y especias.", img: "prod-empanada-carne.png" },
      { nombre: "Empanada de Pollo", precio: 750, categoria: "Empanadas", descripcion: "Empanada de pollo desmenuzado con cebolla y pimientos.", img: "prod-empanada-pollo.png" },
      { nombre: "Empanada de Humita", precio: 800, categoria: "Empanadas", descripcion: "Empanada de choclo con queso y salsa blanca.", img: "prod-empanada-humita.png", descuento: true, tipoDescuento: "porcentaje", valorDescuento: 20 },
      { nombre: "Empanada de Jamón y Queso", precio: 750, categoria: "Empanadas", descripcion: "Empanada de jamón cocido con muzzarella derretida.", img: "prod-empanada-jamon.png" },
    ],
  },
]

// ============================================
// Main seed function
// ============================================
async function seed() {
  console.log("🌱 Seeding DeliGO database with 10 sample businesses...")
  console.log("")

  const seedImagesDir = join(process.cwd(), "upload", "seed-images")

  for (const biz of businesses) {
    console.log(`📋 Creating: ${biz.nombre} (${biz.slug})`)

    // Copy logo image
    let logoUrl: string | null = null
    const logoSource = join(seedImagesDir, `logo-${biz.slug}.png`)
    if (existsSync(logoSource)) {
      logoUrl = await copyImageToPublic(logoSource, "logos", biz.slug, "logo.png")
      console.log(`  ✅ Logo: ${logoUrl}`)
    }

    // Copy banner image
    let bannerUrl: string | null = null
    const bannerSource = join(seedImagesDir, `banner-${biz.slug}.png`)
    if (existsSync(bannerSource)) {
      bannerUrl = await copyImageToPublic(bannerSource, "banners", biz.slug, "banner.png")
      console.log(`  ✅ Banner: ${bannerUrl}`)
    }

    // Create the business
    const negocio = await prisma.negocio.create({
      data: {
        slug: biz.slug,
        nombre: biz.nombre,
        usuario: biz.usuario,
        email: biz.email,
        password: biz.password,
        rubro: biz.rubro,
        aprobado: true,
        suspendido: false,
        emailVerified: new Date(),
        colorPrincipal: biz.colorPrincipal,
        mensajeBienvenida: biz.mensajeBienvenida || "",
        logoUrl,
        bannerUrl,
        ofreceDelivery: biz.ofreceDelivery,
        zonaDeliveryActiva: biz.zonaDeliveryActiva,
        deliveryMode: biz.deliveryMode || "",
        zonasDelivery: biz.zonasDelivery || "[]",
        precioDelivery: biz.precioDelivery,
        precioDeliveryDefault: biz.precioDeliveryDefault,
        tiempoEntrega: biz.tiempoEntrega,
        lat: biz.lat,
        lng: biz.lng,
        horarioMode: biz.horarioMode,
        horarios: biz.horarios || "{}",
        abiertoManual: biz.abiertoManual ?? false,
        categorias: biz.categorias || "[]",
        agregadosCategorias: "[]",
        ingredientesCategorias: "[]",
        seccionesCatalogo: "[]",
        whatsapp: biz.whatsapp || "",
        instagram: biz.instagram || "",
        facebook: "",
        aceptaTransferencia: biz.aceptaTransferencia ?? false,
        aliasBancario: biz.aliasBancario || "",
        promocionado: biz.promocionado ?? false,
        ordenPromocion: biz.ordenPromocion ?? 0,
        salonActivo: biz.salonActivo ?? false,
        zonasSalon: biz.zonasSalon || "[]",
        empleadosActivos: false,
        mostrarVentas: true,
        planTipo: "prueba",
        deudaTarifa: 0,
        toleranciaCancelacion: 5,
      },
    })

    // Create secciones for the catalog
    const categorias: string[] = JSON.parse(biz.categorias || "[]")
    for (let i = 0; i < categorias.length; i++) {
      await prisma.seccionCatalogo.create({
        data: {
          nombre: categorias[i],
          orientacion: "vertical",
          orden: i,
          negocioId: negocio.id,
        },
      })
    }

    // Create products
    for (let pIdx = 0; pIdx < biz.productos.length; pIdx++) {
      const prod = biz.productos[pIdx]

      // Copy product image
      let prodImgUrl: string | null = null
      const prodImgSource = join(seedImagesDir, "products", prod.img)
      if (existsSync(prodImgSource)) {
        prodImgUrl = await copyImageToPublic(prodImgSource, "productos", biz.slug, prod.img)
      }

      // Find the section for this product's category
      const seccion = await prisma.seccionCatalogo.findFirst({
        where: { negocioId: negocio.id, nombre: prod.categoria },
      })

      const producto = await prisma.producto.create({
        data: {
          nombre: prod.nombre,
          precio: prod.precio,
          categoria: prod.categoria,
          imagenUrl: prodImgUrl,
          descripcion: prod.descripcion || null,
          stock: true,
          descuentoActivo: prod.descuento ?? false,
          tipoDescuento: prod.tipoDescuento || "porcentaje",
          valorDescuento: prod.valorDescuento ?? 0,
          orden: pIdx,
          negocioId: negocio.id,
        },
      })

      // Link product to section
      if (seccion) {
        await prisma.seccionProducto.create({
          data: {
            seccionId: seccion.id,
            productoId: producto.id,
            orden: pIdx,
          },
        })
      }

      // Create promocion record for discounted products
      if (prod.descuento && prod.valorDescuento) {
        const precioPromo = prod.tipoDescuento === "porcentaje"
          ? prod.precio * (1 - prod.valorDescuento / 100)
          : prod.precio - prod.valorDescuento

        await prisma.promocion.create({
          data: {
            productoId: producto.id,
            negocioId: negocio.id,
            negocioSlug: biz.slug,
            negocioNombre: biz.nombre,
            precioOriginal: prod.precio,
            precioPromo,
            descuento: prod.tipoDescuento === "porcentaje"
              ? `${prod.valorDescuento}%`
              : `$${prod.valorDescuento}`,
            activa: true,
          },
        })
      }

      console.log(`  📦 ${prod.nombre} - $${prod.precio}${prod.descuento ? ` (-${prod.valorDescuento}%)` : ""}`)
    }

    // Create mesas for salon businesses
    if (biz.salonActivo) {
      const mesas = [
        { numero: 1, nombre: "Mesa 1", zona: "Interior", capacidad: 4 },
        { numero: 2, nombre: "Mesa 2", zona: "Interior", capacidad: 2 },
        { numero: 3, nombre: "Mesa 3", zona: "Interior", capacidad: 4 },
        { numero: 4, nombre: "Barra 1", zona: "Interior", capacidad: 2 },
        { numero: 5, nombre: "Terraza 1", zona: "Terraza", capacidad: 4 },
        { numero: 6, nombre: "Terraza 2", zona: "Terraza", capacidad: 4 },
      ]
      for (const mesa of mesas) {
        await prisma.mesa.create({
          data: {
            numero: mesa.numero,
            nombre: mesa.nombre,
            zona: mesa.zona,
            capacidad: mesa.capacidad,
            activa: true,
            negocioId: negocio.id,
          },
        })
      }
      console.log(`  🪑 Created ${mesas.length} mesas`)
    }

    console.log("")
  }

  // Update config for promocionados
  const existingConfig = await prisma.configPlataforma.findFirst()
  if (existingConfig) {
    await prisma.configPlataforma.update({
      where: { id: existingConfig.id },
      data: { promocionadosActivos: true },
    })
  } else {
    await prisma.configPlataforma.create({
      data: { promocionadosActivos: true },
    })
  }
  console.log("✅ Promocionados activados en config")

  console.log("")
  console.log("🎉 Seed completed! 10 businesses with products, images, and delivery zones created.")
  console.log("")

  await prisma.$disconnect()
}

seed().catch((e) => {
  console.error("❌ Seed error:", e)
  prisma.$disconnect()
  process.exit(1)
})
