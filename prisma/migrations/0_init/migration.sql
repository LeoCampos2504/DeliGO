-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "googleId" TEXT,
    "telefono" TEXT NOT NULL DEFAULT '',
    "pushSubscription" TEXT,
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailVerified" TIMESTAMP(3),
    "verificationToken" TEXT,
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "bloqueadoFecha" TIMESTAMP(3),
    "ultimoIp" TEXT NOT NULL DEFAULT '',
    "dispositivoFingerprint" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direcciones" (
    "id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "referencia" TEXT NOT NULL DEFAULT '',
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "clienteId" TEXT NOT NULL,

    CONSTRAINT "direcciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favoritos" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,

    CONSTRAINT "favoritos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "negocios" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT 'pending@deligo.app',
    "password" TEXT NOT NULL,
    "rubro" TEXT NOT NULL DEFAULT 'restaurante',
    "aprobado" BOOLEAN NOT NULL DEFAULT false,
    "suspendido" BOOLEAN NOT NULL DEFAULT false,
    "emailVerified" TIMESTAMP(3),
    "verificationToken" TEXT,
    "colorPrincipal" TEXT NOT NULL DEFAULT '#FB8C00',
    "mensajeBienvenida" TEXT NOT NULL DEFAULT '',
    "logoEnCirculo" BOOLEAN NOT NULL DEFAULT false,
    "colorCirculoLogo" TEXT NOT NULL DEFAULT '',
    "colorFondo" TEXT NOT NULL DEFAULT '',
    "categorias" TEXT NOT NULL DEFAULT '[]',
    "agregadosCategorias" TEXT NOT NULL DEFAULT '[]',
    "ingredientesCategorias" TEXT NOT NULL DEFAULT '[]',
    "seccionesCatalogo" TEXT NOT NULL DEFAULT '[]',
    "horarios" TEXT NOT NULL DEFAULT '{}',
    "horarioMode" TEXT NOT NULL DEFAULT 'experto',
    "abiertoManual" BOOLEAN NOT NULL DEFAULT true,
    "whatsapp" TEXT NOT NULL DEFAULT '',
    "instagram" TEXT NOT NULL DEFAULT '',
    "facebook" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT,
    "bannerUrl" TEXT,
    "fondoImagenUrl" TEXT,
    "ofreceDelivery" BOOLEAN NOT NULL DEFAULT false,
    "zonaDeliveryActiva" BOOLEAN NOT NULL DEFAULT false,
    "zonasDelivery" TEXT NOT NULL DEFAULT '[]',
    "precioDelivery" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "precioDeliveryDefault" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryMode" TEXT NOT NULL DEFAULT '',
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "mostrarVentas" BOOLEAN NOT NULL DEFAULT false,
    "panelMode" TEXT NOT NULL DEFAULT '',
    "promocionado" BOOLEAN NOT NULL DEFAULT false,
    "ordenPromocion" INTEGER NOT NULL DEFAULT 0,
    "destacadoHasta" TIMESTAMP(3),
    "seguimientoDeliveryActivo" BOOLEAN NOT NULL DEFAULT false,
    "salonActivo" BOOLEAN NOT NULL DEFAULT false,
    "empleadosActivos" BOOLEAN NOT NULL DEFAULT false,
    "zonasSalon" TEXT NOT NULL DEFAULT '[]',
    "aceptaTransferencia" BOOLEAN NOT NULL DEFAULT false,
    "aliasBancario" TEXT NOT NULL DEFAULT '',
    "toleranciaCancelacion" INTEGER NOT NULL DEFAULT 5,
    "tiempoEntrega" INTEGER NOT NULL DEFAULT 30,
    "repartidorCodigo" TEXT,
    "tokenEmpleados" TEXT,
    "tokenSalon" TEXT,
    "planTipo" TEXT NOT NULL DEFAULT 'prueba',
    "planVencimiento" TEXT,
    "planFechaInicio" TEXT,
    "planFechaRenovacion" TEXT,
    "pushSubscription" TEXT,
    "pushSubscriptionSalon" TEXT,
    "pushSubscriptionEmpleados" TEXT,
    "deudaTarifa" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "limiteDeuda" DOUBLE PRECISION,
    "puntuacionPromedio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalResenas" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "negocios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secciones_catalogo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orientacion" TEXT NOT NULL DEFAULT 'vertical',
    "orden" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '',
    "negocioId" TEXT NOT NULL,

    CONSTRAINT "secciones_catalogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seccion_productos" (
    "id" TEXT NOT NULL,
    "seccionId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "seccion_productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "precio" DOUBLE PRECISION NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT 'Sin Categoria',
    "imagenUrl" TEXT,
    "imagenesExtra" TEXT NOT NULL DEFAULT '[]',
    "negocioId" TEXT NOT NULL,
    "stock" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "descuentoActivo" BOOLEAN NOT NULL DEFAULT false,
    "tipoDescuento" TEXT NOT NULL DEFAULT 'porcentaje',
    "valorDescuento" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "descripcion" TEXT,
    "secciones" TEXT NOT NULL DEFAULT '[]',
    "recomendados" TEXT NOT NULL DEFAULT '[]',
    "opcionesCompartidasIds" TEXT NOT NULL DEFAULT '[]',
    "talles" TEXT NOT NULL DEFAULT '[]',
    "colores" TEXT NOT NULL DEFAULT '[]',
    "material" TEXT NOT NULL DEFAULT '',
    "genero" TEXT NOT NULL DEFAULT '',
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producto_agregados" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "agregadoId" TEXT NOT NULL,

    CONSTRAINT "producto_agregados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producto_ingredientes" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "ingredienteId" TEXT NOT NULL,

    CONSTRAINT "producto_ingredientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agregados" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "precio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "categoria" TEXT NOT NULL DEFAULT '',
    "imagenUrl" TEXT,
    "negocioId" TEXT NOT NULL,

    CONSTRAINT "agregados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredientes" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT '',
    "imagenUrl" TEXT,
    "negocioId" TEXT NOT NULL,

    CONSTRAINT "ingredientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "negocioSlug" TEXT NOT NULL,
    "negocioNombre" TEXT NOT NULL,
    "clienteId" TEXT,
    "clienteNombre" TEXT NOT NULL,
    "clienteTelefono" TEXT NOT NULL DEFAULT '',
    "total" DOUBLE PRECISION NOT NULL,
    "totalProductos" DOUBLE PRECISION NOT NULL,
    "tarifaServicio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "precioDelivery" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metodoEntrega" TEXT NOT NULL DEFAULT 'retiro',
    "direccion" TEXT,
    "referencia" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "mesaId" TEXT,
    "mesaNumero" INTEGER,
    "empleadoId" TEXT,
    "empleadoNombre" TEXT,
    "negocioLat" DOUBLE PRECISION,
    "negocioLng" DOUBLE PRECISION,
    "repartidorId" TEXT,
    "repartidorNombre" TEXT,
    "repartidorAceptaFecha" TIMESTAMP(3),
    "repartidorLat" DOUBLE PRECISION,
    "repartidorLng" DOUBLE PRECISION,
    "repartidorLastUpdate" TIMESTAMP(3),
    "metodoPago" TEXT NOT NULL DEFAULT 'efectivo',
    "notas" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'recibido',
    "deudaAcumulada" BOOLEAN NOT NULL DEFAULT false,
    "canceladoPor" TEXT,
    "canceladoMotivo" TEXT,
    "canceladoFecha" TIMESTAMP(3),
    "clienteConfirmaRecibido" BOOLEAN NOT NULL DEFAULT false,
    "clienteConfirmaFecha" TIMESTAMP(3),
    "entregadoPorRepartidor" BOOLEAN NOT NULL DEFAULT false,
    "entregadoFecha" TIMESTAMP(3),
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_items" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "productoId" TEXT,
    "nombre" TEXT NOT NULL,
    "precio" DOUBLE PRECISION NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "agregados" TEXT NOT NULL DEFAULT '[]',
    "secciones" TEXT NOT NULL DEFAULT '{}',
    "seccionesPrecios" TEXT NOT NULL DEFAULT '{}',
    "ingredientes" TEXT NOT NULL DEFAULT '[]',
    "ingredientesQuitados" TEXT NOT NULL DEFAULT '[]',
    "talle" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "pedido_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_mensajes" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "remitente" TEXT NOT NULL,
    "texto" TEXT NOT NULL DEFAULT '',
    "imagenUrl" TEXT,
    "archivoUrl" TEXT,
    "archivoNombre" TEXT,
    "archivoTipo" TEXT,
    "leido" BOOLEAN NOT NULL DEFAULT false,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clienteId" TEXT,

    CONSTRAINT "chat_mensajes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resenas" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "clienteNombre" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "puntuacion" INTEGER NOT NULL,
    "comentario" TEXT NOT NULL DEFAULT '',
    "rapidez" INTEGER,
    "calidad" INTEGER,
    "precio" INTEGER,
    "respuestaNegocio" TEXT,
    "fechaRespuesta" TIMESTAMP(3),
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resenas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repartidores" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "googleId" TEXT,
    "telefono" TEXT NOT NULL DEFAULT '',
    "pushSubscription" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailVerified" TIMESTAMP(3),
    "verificationToken" TEXT,

    CONSTRAINT "repartidores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repartidor_negocios" (
    "id" TEXT NOT NULL,
    "repartidorId" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "negocioSlug" TEXT NOT NULL,
    "negocioNombre" TEXT NOT NULL,
    "negocioLogoUrl" TEXT,
    "codigoAcceso" TEXT NOT NULL,
    "fechaAsociacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repartidor_negocios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "super_admins" (
    "id" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "pushSubscription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "super_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deuda_historial" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "negocioNombre" TEXT NOT NULL,
    "montoAbonado" DOUBLE PRECISION NOT NULL,
    "deudaAnterior" DOUBLE PRECISION NOT NULL,
    "fechaAbono" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" TEXT NOT NULL DEFAULT 'abono_total',

    CONSTRAINT "deuda_historial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userType" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sesiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promociones" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "negocioSlug" TEXT NOT NULL,
    "negocioNombre" TEXT NOT NULL,
    "precioOriginal" DOUBLE PRECISION NOT NULL,
    "precioPromo" DOUBLE PRECISION NOT NULL,
    "descuento" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaFin" TIMESTAMP(3),
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "promociones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mesas" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL DEFAULT '',
    "zona" TEXT NOT NULL DEFAULT '',
    "forma" TEXT NOT NULL DEFAULT '',
    "capacidad" INTEGER NOT NULL DEFAULT 4,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "negocioId" TEXT NOT NULL,
    "empleadoId" TEXT,

    CONSTRAINT "mesas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuentas_operativas" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "googleId" TEXT,
    "telefono" TEXT,
    "emailVerified" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuentas_operativas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empleados" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'mozo',
    "permisos" TEXT NOT NULL DEFAULT '[]',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "token" TEXT,
    "pushSubscription" TEXT,
    "negocioId" TEXT NOT NULL,
    "cuentaOperativaId" TEXT,

    CONSTRAINT "empleados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codigos_incorporacion_mozo" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "empleadoObjetivoId" TEXT,
    "rol" TEXT NOT NULL DEFAULT 'mozo',
    "codeHash" TEXT NOT NULL,
    "codePrefix" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedByCuentaOperativaId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigos_incorporacion_mozo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terminales_salon" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL DEFAULT 'Terminal de salón',
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "pushSubscription" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "terminales_salon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vinculaciones_terminal_salon" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codePrefix" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vinculaciones_terminal_salon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones_terminal_salon" (
    "id" TEXT NOT NULL,
    "terminalSalonId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sesiones_terminal_salon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_plataforma" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL DEFAULT '',
    "valor" TEXT NOT NULL DEFAULT '',
    "promocionadosActivos" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_plataforma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opciones_compartidas" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "opciones" TEXT NOT NULL DEFAULT '[]',
    "obligatorio" BOOLEAN NOT NULL DEFAULT false,
    "maximo" INTEGER NOT NULL DEFAULT 0,
    "negocioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opciones_compartidas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "denuncias" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "pedidoId" TEXT,
    "negocioNombre" TEXT NOT NULL,
    "clienteNombre" TEXT NOT NULL,
    "motivoTipo" TEXT NOT NULL DEFAULT 'otro',
    "motivo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "denuncias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes_bloqueados" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL DEFAULT '',
    "clienteId" TEXT,
    "clienteNombre" TEXT NOT NULL DEFAULT '',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_bloqueados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userType" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "recurso" TEXT NOT NULL,
    "recursoId" TEXT NOT NULL DEFAULT '',
    "detalle" TEXT NOT NULL DEFAULT '{}',
    "ip" TEXT NOT NULL DEFAULT '',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userType" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "leido" BOOLEAN NOT NULL DEFAULT false,
    "pedidoId" TEXT,
    "negocioId" TEXT,
    "datos" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_eventos" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "estadoAnterior" TEXT NOT NULL DEFAULT '',
    "userId" TEXT,
    "userType" TEXT,
    "nota" TEXT NOT NULL DEFAULT '',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedido_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "destacado_solicitudes" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "meses" INTEGER NOT NULL DEFAULT 0,
    "dias" INTEGER NOT NULL DEFAULT 0,
    "precio" DOUBLE PRECISION NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "comprobanteUrl" TEXT,
    "notaAdmin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "destacado_solicitudes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clientes_email_key" ON "clientes"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_googleId_key" ON "clientes"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_verificationToken_key" ON "clientes"("verificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "favoritos_clienteId_negocioId_key" ON "favoritos"("clienteId", "negocioId");

-- CreateIndex
CREATE UNIQUE INDEX "negocios_slug_key" ON "negocios"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "negocios_nombre_key" ON "negocios"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "negocios_usuario_key" ON "negocios"("usuario");

-- CreateIndex
CREATE UNIQUE INDEX "negocios_email_key" ON "negocios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "negocios_verificationToken_key" ON "negocios"("verificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "negocios_repartidorCodigo_key" ON "negocios"("repartidorCodigo");

-- CreateIndex
CREATE UNIQUE INDEX "negocios_tokenEmpleados_key" ON "negocios"("tokenEmpleados");

-- CreateIndex
CREATE UNIQUE INDEX "negocios_tokenSalon_key" ON "negocios"("tokenSalon");

-- CreateIndex
CREATE UNIQUE INDEX "seccion_productos_seccionId_productoId_key" ON "seccion_productos"("seccionId", "productoId");

-- CreateIndex
CREATE UNIQUE INDEX "producto_agregados_productoId_agregadoId_key" ON "producto_agregados"("productoId", "agregadoId");

-- CreateIndex
CREATE UNIQUE INDEX "producto_ingredientes_productoId_ingredienteId_key" ON "producto_ingredientes"("productoId", "ingredienteId");

-- CreateIndex
CREATE UNIQUE INDEX "resenas_pedidoId_key" ON "resenas"("pedidoId");

-- CreateIndex
CREATE UNIQUE INDEX "repartidores_email_key" ON "repartidores"("email");

-- CreateIndex
CREATE UNIQUE INDEX "repartidores_googleId_key" ON "repartidores"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "repartidores_verificationToken_key" ON "repartidores"("verificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "repartidor_negocios_repartidorId_negocioId_key" ON "repartidor_negocios"("repartidorId", "negocioId");

-- CreateIndex
CREATE UNIQUE INDEX "sesiones_token_key" ON "sesiones"("token");

-- CreateIndex
CREATE UNIQUE INDEX "promociones_productoId_key" ON "promociones"("productoId");

-- CreateIndex
CREATE UNIQUE INDEX "mesas_negocioId_numero_key" ON "mesas"("negocioId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_operativas_email_key" ON "cuentas_operativas"("email");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_operativas_googleId_key" ON "cuentas_operativas"("googleId");

-- CreateIndex
CREATE INDEX "cuentas_operativas_activo_eliminado_idx" ON "cuentas_operativas"("activo", "eliminado");

-- CreateIndex
CREATE INDEX "empleados_cuentaOperativaId_idx" ON "empleados"("cuentaOperativaId");

-- CreateIndex
CREATE UNIQUE INDEX "empleados_negocioId_codigo_key" ON "empleados"("negocioId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "empleados_negocioId_cuentaOperativaId_key" ON "empleados"("negocioId", "cuentaOperativaId");

-- CreateIndex
CREATE UNIQUE INDEX "codigos_incorporacion_mozo_codeHash_key" ON "codigos_incorporacion_mozo"("codeHash");

-- CreateIndex
CREATE INDEX "codigos_incorporacion_mozo_negocioId_expiresAt_idx" ON "codigos_incorporacion_mozo"("negocioId", "expiresAt");

-- CreateIndex
CREATE INDEX "codigos_incorporacion_mozo_negocioId_revokedAt_idx" ON "codigos_incorporacion_mozo"("negocioId", "revokedAt");

-- CreateIndex
CREATE INDEX "codigos_incorporacion_mozo_empleadoObjetivoId_idx" ON "codigos_incorporacion_mozo"("empleadoObjetivoId");

-- CreateIndex
CREATE INDEX "codigos_incorporacion_mozo_usedByCuentaOperativaId_idx" ON "codigos_incorporacion_mozo"("usedByCuentaOperativaId");

-- CreateIndex
CREATE INDEX "codigos_incorporacion_mozo_rol_idx" ON "codigos_incorporacion_mozo"("rol");

-- CreateIndex
CREATE INDEX "terminales_salon_negocioId_estado_idx" ON "terminales_salon"("negocioId", "estado");

-- CreateIndex
CREATE INDEX "terminales_salon_negocioId_revokedAt_idx" ON "terminales_salon"("negocioId", "revokedAt");

-- CreateIndex
CREATE INDEX "terminales_salon_lastUsedAt_idx" ON "terminales_salon"("lastUsedAt");

-- CreateIndex
CREATE UNIQUE INDEX "vinculaciones_terminal_salon_codeHash_key" ON "vinculaciones_terminal_salon"("codeHash");

-- CreateIndex
CREATE INDEX "vinculaciones_terminal_salon_negocioId_expiresAt_idx" ON "vinculaciones_terminal_salon"("negocioId", "expiresAt");

-- CreateIndex
CREATE INDEX "vinculaciones_terminal_salon_negocioId_revokedAt_idx" ON "vinculaciones_terminal_salon"("negocioId", "revokedAt");

-- CreateIndex
CREATE INDEX "vinculaciones_terminal_salon_usedAt_idx" ON "vinculaciones_terminal_salon"("usedAt");

-- CreateIndex
CREATE UNIQUE INDEX "sesiones_terminal_salon_tokenHash_key" ON "sesiones_terminal_salon"("tokenHash");

-- CreateIndex
CREATE INDEX "sesiones_terminal_salon_terminalSalonId_revokedAt_idx" ON "sesiones_terminal_salon"("terminalSalonId", "revokedAt");

-- CreateIndex
CREATE INDEX "sesiones_terminal_salon_expiresAt_idx" ON "sesiones_terminal_salon"("expiresAt");

-- CreateIndex
CREATE INDEX "sesiones_terminal_salon_lastUsedAt_idx" ON "sesiones_terminal_salon"("lastUsedAt");

-- CreateIndex
CREATE UNIQUE INDEX "config_plataforma_clave_key" ON "config_plataforma"("clave");

-- CreateIndex
CREATE INDEX "denuncias_clienteId_idx" ON "denuncias"("clienteId");

-- CreateIndex
CREATE INDEX "denuncias_negocioId_idx" ON "denuncias"("negocioId");

-- CreateIndex
CREATE INDEX "clientes_bloqueados_ip_idx" ON "clientes_bloqueados"("ip");

-- CreateIndex
CREATE INDEX "clientes_bloqueados_fingerprint_idx" ON "clientes_bloqueados"("fingerprint");

-- CreateIndex
CREATE INDEX "audit_logs_userId_fecha_idx" ON "audit_logs"("userId", "fecha");

-- CreateIndex
CREATE INDEX "audit_logs_recurso_recursoId_idx" ON "audit_logs"("recurso", "recursoId");

-- CreateIndex
CREATE INDEX "audit_logs_accion_idx" ON "audit_logs"("accion");

-- CreateIndex
CREATE INDEX "notificaciones_userId_userType_leido_createdAt_idx" ON "notificaciones"("userId", "userType", "leido", "createdAt");

-- CreateIndex
CREATE INDEX "notificaciones_userId_userType_createdAt_idx" ON "notificaciones"("userId", "userType", "createdAt");

-- CreateIndex
CREATE INDEX "pedido_eventos_pedidoId_fecha_idx" ON "pedido_eventos"("pedidoId", "fecha");

-- CreateIndex
CREATE INDEX "destacado_solicitudes_estado_createdAt_idx" ON "destacado_solicitudes"("estado", "createdAt");

-- CreateIndex
CREATE INDEX "destacado_solicitudes_negocioId_idx" ON "destacado_solicitudes"("negocioId");

-- AddForeignKey
ALTER TABLE "direcciones" ADD CONSTRAINT "direcciones_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favoritos" ADD CONSTRAINT "favoritos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favoritos" ADD CONSTRAINT "favoritos_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secciones_catalogo" ADD CONSTRAINT "secciones_catalogo_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seccion_productos" ADD CONSTRAINT "seccion_productos_seccionId_fkey" FOREIGN KEY ("seccionId") REFERENCES "secciones_catalogo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seccion_productos" ADD CONSTRAINT "seccion_productos_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_agregados" ADD CONSTRAINT "producto_agregados_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_agregados" ADD CONSTRAINT "producto_agregados_agregadoId_fkey" FOREIGN KEY ("agregadoId") REFERENCES "agregados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_ingredientes" ADD CONSTRAINT "producto_ingredientes_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_ingredientes" ADD CONSTRAINT "producto_ingredientes_ingredienteId_fkey" FOREIGN KEY ("ingredienteId") REFERENCES "ingredientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agregados" ADD CONSTRAINT "agregados_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredientes" ADD CONSTRAINT "ingredientes_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_mensajes" ADD CONSTRAINT "chat_mensajes_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_mensajes" ADD CONSTRAINT "chat_mensajes_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resenas" ADD CONSTRAINT "resenas_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resenas" ADD CONSTRAINT "resenas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resenas" ADD CONSTRAINT "resenas_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repartidor_negocios" ADD CONSTRAINT "repartidor_negocios_repartidorId_fkey" FOREIGN KEY ("repartidorId") REFERENCES "repartidores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repartidor_negocios" ADD CONSTRAINT "repartidor_negocios_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deuda_historial" ADD CONSTRAINT "deuda_historial_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promociones" ADD CONSTRAINT "promociones_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promociones" ADD CONSTRAINT "promociones_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mesas" ADD CONSTRAINT "mesas_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mesas" ADD CONSTRAINT "mesas_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_cuentaOperativaId_fkey" FOREIGN KEY ("cuentaOperativaId") REFERENCES "cuentas_operativas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigos_incorporacion_mozo" ADD CONSTRAINT "codigos_incorporacion_mozo_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigos_incorporacion_mozo" ADD CONSTRAINT "codigos_incorporacion_mozo_empleadoObjetivoId_fkey" FOREIGN KEY ("empleadoObjetivoId") REFERENCES "empleados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigos_incorporacion_mozo" ADD CONSTRAINT "codigos_incorporacion_mozo_usedByCuentaOperativaId_fkey" FOREIGN KEY ("usedByCuentaOperativaId") REFERENCES "cuentas_operativas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terminales_salon" ADD CONSTRAINT "terminales_salon_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculaciones_terminal_salon" ADD CONSTRAINT "vinculaciones_terminal_salon_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_terminal_salon" ADD CONSTRAINT "sesiones_terminal_salon_terminalSalonId_fkey" FOREIGN KEY ("terminalSalonId") REFERENCES "terminales_salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opciones_compartidas" ADD CONSTRAINT "opciones_compartidas_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "denuncias" ADD CONSTRAINT "denuncias_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "denuncias" ADD CONSTRAINT "denuncias_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_eventos" ADD CONSTRAINT "pedido_eventos_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destacado_solicitudes" ADD CONSTRAINT "destacado_solicitudes_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
