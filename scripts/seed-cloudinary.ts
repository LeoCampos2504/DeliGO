// DeliGO - Seed Script: Populate 10 sample businesses with AI-generated images uploaded to Cloudinary
// Run with: bun run scripts/seed-cloudinary.ts

import { PrismaClient } from "@prisma/client"
import ZAI from "z-ai-web-dev-sdk"
import { v2 as cloudinary } from "cloudinary"
import { mkdir, unlink } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

// Configure Cloudinary
cloudinary.config({
  cloud_name: "dztgrr6jn",
  api_key: "533619185276432",
  api_secret: "w57KhX95EqT8u980uRf6BOXerqc",
  secure: true,
})

const prisma = new PrismaClient()

// ============================================
// Image generation + upload helpers
// ============================================
let zaiInstance: any = null

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
}

async function generateAndUpload(
  prompt: string,
  size: string,
  folder: string,
  publicId: string
): Promise<string | null> {
  try {
    const zai = await getZAI()
    const response = await zai.images.generations.create({ prompt, size })
    const base64 = response.data[0].base64
    const buffer = Buffer.from(base64, "base64")

    const result = await cloudinary.uploader.upload(
      `data:image/png;base64,${buffer.toString("base64")}`,
      {
        folder,
        public_id: publicId,
        overwrite: true,
        transformation: size === "1440x720"
          ? [{ width: 1440, crop: "limit" }]
          : [{ width: 800, crop: "limit" }],
      }
    )

    return result.secure_url
  } catch (error) {
    console.error(`  ❌ Error generating/uploading image: ${error}`)
    return null
  }
}

// ============================================
// Business definitions
// ============================================
interface ProductDef {
  nombre: string
  precio: number
  categoria: string
  descripcion: string
  imgPrompt: string
  descuento?: boolean
  tipoDescuento?: string
  valorDescuento?: number
}

interface BusinessDef {
  slug: string
  nombre: string
  rubro: string
  colorPrincipal: string
  usuario: string
  email: string
  password: string
  mensajeBienvenida: string
  ofreceDelivery: boolean
  zonaDeliveryActiva: boolean
  deliveryMode: string
  precioDelivery: number
  precioDeliveryDefault: number
  tiempoEntrega: number
  lat: number
  lng: number
  horarioMode: string
  horarios: string
  abiertoManual?: boolean
  categorias: string
  zonasDelivery: string
  whatsapp: string
  instagram: string
  aceptaTransferencia: boolean
  aliasBancario: string
  promocionado?: boolean
  ordenPromocion?: number
  salonActivo?: boolean
  zonasSalon?: string
  logoPrompt: string
  bannerPrompt: string
  productos: ProductDef[]
}

const businesses: BusinessDef[] = [
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
    logoPrompt: "Professional logo for an Argentine parrilla grill restaurant called Parrilla del Campo, featuring a stylized grill with flames, warm red and orange colors, modern design, clean white background, vector style",
    bannerPrompt: "Argentine asado barbecue spread on a rustic wooden table, grilled meats chorizo morcilla, warm ambient lighting, professional food photography, appetizing, restaurant setting",
    productos: [
      { nombre: "Asado para 2", precio: 8500, categoria: "Parrilla", descripcion: "Asado completo con vacío, entraña, chorizo y morcilla. Incluye chimichurri y salsas.", imgPrompt: "Professional food photography of Argentine asado barbecue platter for two, assorted grilled meats with chimichurri sauce, rustic wooden board, warm lighting, appetizing", descuento: true, tipoDescuento: "porcentaje", valorDescuento: 15 },
      { nombre: "Bife de Chorizo", precio: 6200, categoria: "Parrilla", descripcion: "Bife de chorizo de 400g a la parrilla, con papas fritas o ensalada.", imgPrompt: "Professional food photography of grilled bife de chorizo steak 400g with french fries, plated elegantly, warm restaurant lighting, appetizing, high quality" },
      { nombre: "Milanesa con Papas", precio: 4500, categoria: "Platos", descripcion: "Milanesa de carne napolitana con papas fritas y ensalada.", imgPrompt: "Professional food photography of Argentine milanesa napolitana with french fries and salad, cheese and tomato sauce on top, restaurant plating, appetizing" },
      { nombre: "Choripán Artesanal", precio: 2200, categoria: "Platos", descripcion: "Chorizo parrillero en pan casero con chimichurri y salsa criolla.", imgPrompt: "Professional food photography of choripan artisanal chorizo sandwich in crusty bread with chimichurri, Argentine street food, warm lighting, appetizing", descuento: true, tipoDescuento: "porcentaje", valorDescuento: 20 },
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
    mensajeBienvenida: "Sushi Zen — Armonía en cada bocado",
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
    logoPrompt: "Professional logo for a Japanese sushi restaurant called Sushi Zen, featuring a minimalist zen circle with sushi roll, dark navy blue and white colors, clean modern design, white background",
    bannerPrompt: "Elegant Japanese sushi platter spread with assorted nigiri sashimi maki rolls, chopsticks, wasabi and ginger, dark slate background, professional food photography, luxury dining",
    productos: [
      { nombre: "Sushi Combinado 24 pcs", precio: 7800, categoria: "Sushi", descripcion: "Combinado de 24 piezas: 8 sashimi, 8 nigiri, 8 maki variados.", imgPrompt: "Professional food photography of premium sushi combination platter 24 pieces, assorted nigiri sashimi and maki rolls on black slate, chopsticks, elegant presentation", descuento: true, tipoDescuento: "porcentaje", valorDescuento: 10 },
      { nombre: "Ramen de Cerdo", precio: 4500, categoria: "Calientes", descripcion: "Ramen tonkotsu con fideos, cerdo, huevo marinado y verduras.", imgPrompt: "Professional food photography of Japanese tonkotsu ramen noodle soup with pork chashu marinated egg and vegetables, steaming bowl, warm lighting, appetizing" },
      { nombre: "Ceviche Japonés", precio: 3800, categoria: "Entradas", descripcion: "Ceviche de salmón con marinada oriental, palta y sésamo.", imgPrompt: "Professional food photography of Japanese-style salmon ceviche with avocado sesame seeds, elegant plating, fresh and vibrant, appetizing" },
      { nombre: "Gyozas (8 unidades)", precio: 3200, categoria: "Entradas", descripcion: "Gyozas de cerdo salteadas con salsa de soja y jengibre.", imgPrompt: "Professional food photography of 8 pan-fried Japanese gyozas dumplings with soy sauce dipping sauce, golden crispy bottom, chopsticks, appetizing" },
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
    mensajeBienvenida: "¡Comé rico y saludable! 100% natural y veggie.",
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
    logoPrompt: "Professional logo for a healthy vegan restaurant called La Verde Vida, featuring green leaves and a bowl, fresh green colors, modern clean design, white background",
    bannerPrompt: "Colorful healthy vegan Buddha bowls spread with fresh vegetables avocado quinoa, bright natural lighting, wooden table, healthy lifestyle food photography, vibrant",
    productos: [
      { nombre: "Buddha Bowl", precio: 4200, categoria: "Bowls", descripcion: "Quinoa, garbanzos, palta, zanahoria, hummus y semillas.", imgPrompt: "Professional food photography of colorful Buddha Bowl with quinoa chickpeas avocado carrots hummus and seeds, top-down view, bright natural lighting, healthy" },
      { nombre: "Ensalada César Veggie", precio: 3500, categoria: "Ensaladas", descripcion: "Lechuga, croutons integrales, parmesano vegano, aderezo césar.", imgPrompt: "Professional food photography of vegan Caesar salad with lettuce whole grain croutons and vegan parmesan, creamy dressing, fresh and green, appetizing", descuento: true, tipoDescuento: "porcentaje", valorDescuento: 15 },
      { nombre: "Hamburguesa Veggie", precio: 3900, categoria: "Sándwiches", descripcion: "Medallón de lentejas y verduras con palta y salsa especial.", imgPrompt: "Professional food photography of veggie lentil burger with avocado and special sauce in brioche bun, fries on side, appetizing, warm lighting" },
      { nombre: "Smoothie Verde Detox", precio: 2200, categoria: "Smoothies", descripcion: "Espinaca, manzana, jengibre, pepino y limón.", imgPrompt: "Professional food photography of green detox smoothie in glass jar with spinach apple ginger cucumber and lemon, fresh ingredients around, bright natural lighting" },
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
    mensajeBienvenida: "Bienvenido al Laboratorio de la Hamburguesa",
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
    logoPrompt: "Professional logo for a gourmet burger restaurant called Burger Lab, featuring a burger with science flask element, orange and dark colors, modern bold design, white background",
    bannerPrompt: "Gourmet artisan burgers on dark background with melted cheese dripping, bacon, caramelized onions, dramatic lighting, professional food photography, indulgent",
    productos: [
      { nombre: "Clásica Cheeseburger", precio: 3800, categoria: "Burgers", descripcion: "Medallón de 180g, cheddar fundido, lechuga, tomate y salsa especial.", imgPrompt: "Professional food photography of classic cheeseburger with melted cheddar lettuce tomato and special sauce, 180g beef patty, sesame bun, appetizing" },
      { nombre: "Doble Stack", precio: 5500, categoria: "Burgers", descripcion: "Doble medallón de 150g, doble cheddar, bacon y cebolla caramelizada.", imgPrompt: "Professional food photography of double stack burger with two 150g patties double cheddar bacon and caramelized onions, tall burger, dramatic lighting", descuento: true, tipoDescuento: "porcentaje", valorDescuento: 20 },
      { nombre: "Papas con Cheddar & Bacon", precio: 2500, categoria: "Papas", descripcion: "Papas fritas crocantes con salsa cheddar y bacon crocante.", imgPrompt: "Professional food photography of loaded fries with cheddar cheese sauce and crispy bacon bits, golden french fries, comfort food, appetizing" },
      { nombre: "BBQ Bacon Burger", precio: 4800, categoria: "Burgers", descripcion: "Medallón de 180g, bacon, cebolla crispy, salsa BBQ ahumada.", imgPrompt: "Professional food photography of BBQ bacon burger with crispy onion rings and smoky BBQ sauce, 180g patty, warm lighting, appetizing" },
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
    mensajeBienvenida: "La auténtica pizza italiana, directo del horno a tu casa!",
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
    logoPrompt: "Professional logo for an Italian pizza restaurant called Dolce Forno, featuring a wood-fired oven with pizza, brown and cream colors, rustic elegant design, white background",
    bannerPrompt: "Authentic Italian wood-fired pizza fresh from the oven, melted cheese bubbling, basil leaves on top, rustic pizzeria setting, warm ambient lighting, professional food photography",
    productos: [
      { nombre: "Pizza Muzzarella", precio: 4500, categoria: "Pizzas", descripcion: "Pizza clásica con muzzarella derretida y salsa de tomate fresca.", imgPrompt: "Professional food photography of classic Italian muzzarella pizza with melted cheese and fresh tomato sauce, wood-fired crust, basil on top, appetizing" },
      { nombre: "Pizza Fugazzeta", precio: 5200, categoria: "Pizzas", descripcion: "Pizza rellena de muzzarella y provolone con cebolla.", imgPrompt: "Professional food photography of Argentine fugazzeta pizza stuffed with mozzarella and provolone cheese with onions, thick crust, cheese pull, appetizing", descuento: true, tipoDescuento: "porcentaje", valorDescuento: 10 },
      { nombre: "Focaccia Romana", precio: 3200, categoria: "Focaccias", descripcion: "Focaccia con romero, aceite de oliva y sal gruesa.", imgPrompt: "Professional food photography of Italian focaccia bread with rosemary olive oil and coarse salt, golden crust, rustic plating, warm lighting, appetizing" },
      { nombre: "Tiramisú Casero", precio: 2800, categoria: "Postres", descripcion: "Tiramisú artesanal con café y cacao. Porción individual.", imgPrompt: "Professional food photography of homemade Italian tiramisu dessert with coffee and cocoa, individual portion in elegant glass, dusted with cocoa powder, appetizing" },
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
    mensajeBienvenida: "La onda mexicana llegó para quedarse! Taco Loco",
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
    logoPrompt: "Professional logo for a Mexican taco restaurant called Taco Loco, featuring a fun animated taco with chili pepper, green and red colors, vibrant design, white background",
    bannerPrompt: "Festive Mexican taco spread with assorted tacos al pastor carnitas and carne asada, colorful decorations, lime wedges and salsa, vibrant professional food photography",
    productos: [
      { nombre: "Tacos al Pastor (3 u.)", precio: 3500, categoria: "Tacos", descripcion: "3 tacos de cerdo al pastor con piña, cilantro y salsa verde.", imgPrompt: "Professional food photography of 3 tacos al pastor with pork pineapple cilantro and green salsa on corn tortillas, vibrant colors, appetizing" },
      { nombre: "Burrito Supremo", precio: 4200, categoria: "Burritos", descripcion: "Burrito relleno de carne, arroz, frijoles, queso y guacamole.", imgPrompt: "Professional food photography of supreme burrito stuffed with meat rice beans cheese and guacamole, large wrapped flour tortilla, appetizing", descuento: true, tipoDescuento: "porcentaje", valorDescuento: 15 },
      { nombre: "Nachos Locos", precio: 3200, categoria: "Entradas", descripcion: "Nachos con cheddar, guacamole, crema y jalapeños.", imgPrompt: "Professional food photography of loaded nachos with cheddar cheese guacamole sour cream and jalapeños, colorful and appetizing, top-down view" },
      { nombre: "Quesadillas (2 u.)", precio: 2800, categoria: "Entradas", descripcion: "2 quesadillas de pollo con queso cheddar y pimientos.", imgPrompt: "Professional food photography of 2 chicken quesadillas with cheddar cheese and peppers, golden grilled tortilla, salsa on side, appetizing" },
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
    mensajeBienvenida: "Los helados más ricos de la Patagonia! Sabores artesanales.",
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
    logoPrompt: "Professional logo for an artisan ice cream shop called Helados Patagonia, featuring a scoop of ice cream with mountain silhouette, purple and cream colors, clean modern design, white background",
    bannerPrompt: "Artisan ice cream shop display with colorful ice cream flavors in metal tubs, waffle cones, fresh berries and toppings, bright pastel colors, professional food photography, inviting",
    productos: [
      { nombre: "Helado Dulce de Leche", precio: 1800, categoria: "Helados", descripcion: "2 bochas de dulce de leche artesanal en cucurucho o vasito.", imgPrompt: "Professional food photography of 2 scoops of artisan dulce de leche ice cream in waffle cone, golden caramel color, creamy texture, appetizing" },
      { nombre: "Helado de Limón", precio: 1600, categoria: "Helados", descripcion: "2 bochas de limón al limone, refrescante y natural.", imgPrompt: "Professional food photography of 2 scoops of fresh lemon ice cream in cup, bright yellow color, refreshing, mint garnish, appetizing", descuento: true, tipoDescuento: "porcentaje", valorDescuento: 10 },
      { nombre: "Sundae de Chocolate", precio: 2800, categoria: "Postres Helados", descripcion: "3 bochas de chocolate con salsa, crema y nueces.", imgPrompt: "Professional food photography of chocolate sundae with 3 scoops chocolate sauce whipped cream and walnuts, tall glass, indulgent, appetizing" },
      { nombre: "Milkshake Clásico", precio: 2500, categoria: "Milkshakes", descripcion: "Milkshake espeso de vainilla o chocolate con crema.", imgPrompt: "Professional food photography of thick classic vanilla milkshake in tall glass with whipped cream and cherry, straw, retro diner style, appetizing" },
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
    mensajeBienvenida: "Tu café de especialidad te espera! Buenavista Coffee",
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
    logoPrompt: "Professional logo for a specialty coffee shop called Cafe Buenavista, featuring a coffee cup with steam and mountains, brown and cream colors, elegant design, white background",
    bannerPrompt: "Specialty coffee shop interior with barista pouring latte art, coffee beans, pastry display, warm cozy atmosphere, professional photography, inviting",
    productos: [
      { nombre: "Latte Especial", precio: 2200, categoria: "Café", descripcion: "Café latte con leche artesanal y latte art. Especialidad de la casa.", imgPrompt: "Professional food photography of specialty latte with beautiful latte art on top, artisan milk, ceramic cup, warm cozy cafe setting, appetizing" },
      { nombre: "Medialunas de Manteca (3 u.)", precio: 1500, categoria: "Panadería", descripcion: "3 medialunas de manteca recién horneadas, tibias.", imgPrompt: "Professional food photography of 3 freshly baked Argentine medialunas de manteca croissants, golden flaky, on rustic plate, warm lighting, appetizing" },
      { nombre: "Tostadas con Palta", precio: 2800, categoria: "Desayunos", descripcion: "Tostadas artesanales con palta, huevo pochado y semillas.", imgPrompt: "Professional food photography of artisan toast with avocado poached egg and seeds, healthy breakfast, bright natural lighting, appetizing", descuento: true, tipoDescuento: "porcentaje", valorDescuento: 15 },
      { nombre: "Torta de Chocolate", precio: 2500, categoria: "Postres", descripcion: "Porción de torta húmeda de chocolate con ganache.", imgPrompt: "Professional food photography of moist chocolate cake slice with ganache frosting, dessert plate, elegant presentation, warm lighting, appetizing" },
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
    mensajeBienvenida: "Fusión asiática con sabor local! Wok Fusion",
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
    logoPrompt: "Professional logo for an Asian fusion wok restaurant called Wok Fusion, featuring a wok with flames and chopsticks, red and gold colors, modern design, white background",
    bannerPrompt: "Asian fusion wok cooking with flames, fresh vegetables being stir-fried in a wok, steam rising, colorful ingredients, dynamic action shot, professional food photography",
    productos: [
      { nombre: "Pad Thai", precio: 4200, categoria: "Noodles", descripcion: "Fideos de arroz salteados con langostinos, maní y limón.", imgPrompt: "Professional food photography of pad thai noodles with shrimp peanuts and lime, plated beautifully, garnished with cilantro, warm lighting, appetizing" },
      { nombre: "Arroz Chino Especial", precio: 3800, categoria: "Arroces", descripcion: "Arroz frito con pollo, verduras y huevo. Estilo cantonés.", imgPrompt: "Professional food photography of Cantonese special fried rice with chicken vegetables and egg, wok-charred, chopsticks, appetizing", descuento: true, tipoDescuento: "porcentaje", valorDescuento: 10 },
      { nombre: "Chow Mein de Pollo", precio: 3900, categoria: "Noodles", descripcion: "Fideos chinos salteados con pollo, vegetales y salsa de soja.", imgPrompt: "Professional food photography of chicken chow mein noodles with vegetables and soy sauce, stir-fried in wok, steaming, appetizing" },
      { nombre: "Spring Rolls (6 u.)", precio: 2500, categoria: "Entradas", descripcion: "6 rollitos primavera crocantes con salsa agridulce.", imgPrompt: "Professional food photography of 6 crispy spring rolls with sweet and sour dipping sauce, golden and crunchy, chopsticks, appetizing" },
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
    mensajeBienvenida: "Las empanadas de la abuela, como las de casa! Caseras y al horno.",
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
    logoPrompt: "Professional logo for an empanada shop called Empanadas de la Abuela, featuring a warm baked empanada with steam, orange and brown colors, homey traditional design, white background",
    bannerPrompt: "Freshly baked Argentine empanadas assortment on rustic cloth, golden baked crust, steam rising, traditional homemade look, warm lighting, professional food photography",
    productos: [
      { nombre: "Empanada de Carne", precio: 800, categoria: "Empanadas", descripcion: "Empanada de carne cortada a cuchillo con huevo, aceituna y especias.", imgPrompt: "Professional food photography of Argentine beef empanada, golden baked crust, cut open showing meat filling with egg olives and spices, warm lighting, appetizing" },
      { nombre: "Empanada de Pollo", precio: 750, categoria: "Empanadas", descripcion: "Empanada de pollo desmenuzado con cebolla y pimientos.", imgPrompt: "Professional food photography of chicken empanada, golden flaky crust, cut open showing shredded chicken with onions and peppers, warm lighting, appetizing" },
      { nombre: "Empanada de Humita", precio: 800, categoria: "Empanadas", descripcion: "Empanada de choclo con queso y salsa blanca.", imgPrompt: "Professional food photography of corn humita empanada, golden baked crust, cut open showing corn filling with cheese and white sauce, warm lighting, appetizing", descuento: true, tipoDescuento: "porcentaje", valorDescuento: 20 },
      { nombre: "Empanada de Jamón y Queso", precio: 750, categoria: "Empanadas", descripcion: "Empanada de jamón cocido con muzzarella derretida.", imgPrompt: "Professional food photography of ham and cheese empanada, golden crust, cut open showing melted mozzarella and cooked ham, cheese pull, warm lighting, appetizing" },
    ],
  },
]

// ============================================
// Main seed function
// ============================================
async function seed() {
  console.log("🌱 DeliGO Seed: Creating 10 businesses with AI-generated images on Cloudinary")
  console.log("")

  // Step 1: Clean existing seed data by slug AND email
  console.log("🧹 Cleaning existing seed data...")
  const seedEmails = businesses.map(b => b.email)
  const seedSlugs = businesses.map(b => b.slug)

  const existingNegocios = await prisma.negocio.findMany({
    where: {
      OR: [
        { slug: { in: seedSlugs } },
        { email: { in: seedEmails } },
      ]
    }
  })

  for (const existing of existingNegocios) {
    await prisma.promocion.deleteMany({ where: { negocioId: existing.id } })
    const secciones = await prisma.seccionCatalogo.findMany({ where: { negocioId: existing.id } })
    for (const sec of secciones) {
      await prisma.seccionProducto.deleteMany({ where: { seccionId: sec.id } })
    }
    await prisma.seccionCatalogo.deleteMany({ where: { negocioId: existing.id } })
    await prisma.producto.deleteMany({ where: { negocioId: existing.id } })
    await prisma.mesa.deleteMany({ where: { negocioId: existing.id } })
    await prisma.negocio.delete({ where: { id: existing.id } })
    console.log(`  🗑️ Deleted: ${existing.slug} (${existing.email})`)
  }
  console.log("")

  // Step 2: Create businesses with AI-generated images
  for (let bizIdx = 0; bizIdx < businesses.length; bizIdx++) {
    const biz = businesses[bizIdx]
    console.log(`📋 [${bizIdx + 1}/${businesses.length}] Creating: ${biz.nombre} (${biz.slug})`)

    // Generate & upload logo
    console.log("  🎨 Generating logo...")
    const logoUrl = await generateAndUpload(
      biz.logoPrompt,
      "1024x1024",
      `logos/${biz.slug}`,
      "logo"
    )
    if (logoUrl) console.log(`  ✅ Logo: ${logoUrl.substring(0, 80)}...`)

    // Generate & upload banner
    console.log("  🎨 Generating banner...")
    const bannerUrl = await generateAndUpload(
      biz.bannerPrompt,
      "1440x720",
      `banners/${biz.slug}`,
      "banner"
    )
    if (bannerUrl) console.log(`  ✅ Banner: ${bannerUrl.substring(0, 80)}...`)

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

      // Generate & upload product image
      console.log(`  🎨 Generating product: ${prod.nombre}...`)
      const prodImgUrl = await generateAndUpload(
        prod.imgPrompt,
        "1024x1024",
        `productos/${biz.slug}`,
        `prod-${pIdx + 1}`
      )

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

      console.log(`  📦 ${prod.nombre} - $${prod.precio}${prod.descuento ? ` (-${prod.valorDescuento}%)` : ""}${prodImgUrl ? " ✅" : " ⚠️ no img"}`)
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
  console.log("🎉 Seed completed!")
  console.log(`   - ${businesses.length} businesses created`)
  console.log(`   - Images uploaded to Cloudinary (cloud: dztgrr6jn)`)
  console.log(`   - ${businesses.reduce((sum, b) => sum + b.productos.length, 0)} products created`)
  console.log("")

  await prisma.$disconnect()
}

seed().catch((e) => {
  console.error("❌ Seed error:", e)
  prisma.$disconnect()
  process.exit(1)
})
