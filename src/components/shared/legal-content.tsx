"use client"

import { ScrollArea } from "@/components/ui/scroll-area"

// ============================================
// LEGAL CONTENT — Terms & Conditions
// ============================================
export function TermsContent() {
  return (
    <div className="space-y-4 text-sm text-muted-foreground">
      <p><strong>Última actualización:</strong> Marzo 2025</p>

      <h3 className="font-semibold text-foreground">1. Aceptación de los términos</h3>
      <p>
        Al registrarte y usar DeliGO, aceptás estos Términos y Condiciones. Si no estás de acuerdo,
        no debés usar la plataforma.
      </p>

      <h3 className="font-semibold text-foreground">2. Descripción del servicio</h3>
      <p>
        DeliGO es una plataforma que conecta clientes con negocios locales para realizar pedidos de
        comida, productos y servicios de delivery o retiro en local. DeliGO actúa como intermediario
        y no es responsable de la calidad de los productos vendidos por los negocios asociados.
      </p>

      <h3 className="font-semibold text-foreground">3. Registro de cuenta</h3>
      <p>
        Para usar DeliGO necesitás crear una cuenta con datos veraces. Sos responsable de mantener
        la confidencialidad de tu contraseña y de todas las actividades realizadas con tu cuenta.
      </p>
      <ul className="list-disc pl-4 space-y-1">
        <li>Debés ser mayor de 13 años para registrarte.</li>
        <li>No podés crear múltiples cuentas.</li>
        <li>Debés proporcionar datos reales y actualizados.</li>
      </ul>

      <h3 className="font-semibold text-foreground">4. Realización de pedidos</h3>
      <p>
        Al realizar un pedido, estás celebrando un contrato directamente con el negocio. DeliGO
        procesa el pago de la tarifa de servicio pero no es parte del contrato de compraventa.
      </p>
      <ul className="list-disc pl-4 space-y-1">
        <li>Los precios y disponibilidad son establecidos por cada negocio.</li>
        <li>Los tiempos de entrega son estimados y pueden variar.</li>
        <li>Podés cancelar un pedido dentro de los primeros minutos antes de que el negocio lo confirme.</li>
        <li>La tarifa de servicio ($250 fijos) se aplica a cada pedido para mantener la plataforma.</li>
      </ul>

      <h3 className="font-semibold text-foreground">5. Métodos de pago</h3>
      <p>
        Los pagos se realizan directamente al negocio mediante los métodos que este acepte (efectivo
        o transferencia bancaria). DeliGO no gestiona pagos ni realiza cobros en nombre del negocio.
      </p>

      <h3 className="font-semibold text-foreground">6. Reseñas y opiniones</h3>
      <p>
        Podés dejar reseñas sobre los negocios después de cada pedido. Las reseñas deben ser honestas
        y respetuosas. DeliGO se reserva el derecho de eliminar reseñas que contengan:
      </p>
      <ul className="list-disc pl-4 space-y-1">
        <li>Contenido ofensivo, discriminatorio o difamatorio.</li>
        <li>Información personal de terceros.</li>
        <li>Spam o contenido publicitario.</li>
        <li>Contenido falso o engañoso.</li>
      </ul>

      <h3 className="font-semibold text-foreground">7. Conducta del usuario</h3>
      <p>No está permitido:</p>
      <ul className="list-disc pl-4 space-y-1">
        <li>Usar la plataforma para fines ilícitos.</li>
        <li>Hacer pedidos falsos o con intención de no pagar.</li>
        <li>Acosar o amenazar a otros usuarios, negocios o repartidores.</li>
        <li>Manipular el sistema de reseñas o calificaciones.</li>
        <li>Intentar acceder a cuentas ajenas.</li>
      </ul>

      <h3 className="font-semibold text-foreground">8. Propiedad intelectual</h3>
      <p>
        El diseño, logos, marcas y contenido de DeliGO son propiedad de la plataforma. Los logos y
        nombres de los negocios son propiedad de sus respectivos dueños.
      </p>

      <h3 className="font-semibold text-foreground">9. Limitación de responsabilidad</h3>
      <p>
        DeliGO no se hace responsable por:
      </p>
      <ul className="list-disc pl-4 space-y-1">
        <li>La calidad, cantidad o estado de los productos vendidos por los negocios.</li>
        <li>Retrasos en la entrega causados por el negocio o el repartidor.</li>
        <li>Disponibilidad interrumpida del servicio por causas técnicas.</li>
        <li>Pérdidas indirectas derivadas del uso de la plataforma.</li>
      </ul>

      <h3 className="font-semibold text-foreground">10. Suspensión de cuenta</h3>
      <p>
        DeliGO puede suspender o cancelar tu cuenta si incumplís estos términos, sin perjuicio de
        otras acciones legales que correspondan.
      </p>

      <h3 className="font-semibold text-foreground">11. Modificaciones</h3>
      <p>
        Nos reservamos el derecho de modificar estos términos. Te notificaremos con al menos 15 días
        de anticipación antes de que entren en vigencia cambios significativos.
      </p>

      <h3 className="font-semibold text-foreground">12. Ley aplicable</h3>
      <p>
        Estos términos se rigen por las leyes de la República Argentina. Cualquier disputa será
        resuelta por los tribunales competentes de Argentina.
      </p>
    </div>
  )
}

// ============================================
// LEGAL CONTENT — Privacy Policy
// ============================================
export function PrivacyContent() {
  return (
    <div className="space-y-4 text-sm text-muted-foreground">
      <p><strong>Última actualización:</strong> Marzo 2025</p>

      <h3 className="font-semibold text-foreground">1. Responsable del tratamiento</h3>
      <p>
        DeliGO es la plataforma responsable del tratamiento de los datos personales de los usuarios.
        Nuestro domicilio legal se encuentra en la República Argentina.
      </p>

      <h3 className="font-semibold text-foreground">2. Datos que recopilamos</h3>
      <p>Recopilamos los siguientes datos personales:</p>
      <ul className="list-disc pl-4 space-y-1">
        <li><strong>Datos de registro:</strong> Nombre, email, teléfono y contraseña (encriptada).</li>
        <li><strong>Datos de ubicación:</strong> Direcciones de entrega guardadas y coordenadas GPS cuando usás la función &quot;Mi ubicación&quot;.</li>
        <li><strong>Datos de pedidos:</strong> Historial de pedidos, productos solicitados, montos, métodos de pago.</li>
        <li><strong>Datos de reseñas:</strong> Calificaciones y comentarios sobre negocios.</li>
        <li><strong>Datos de dispositivo:</strong> Información del navegador, sistema operativo, y preferencias de notificaciones push.</li>
        <li><strong>Datos de autenticación Google:</strong> Si elegís ingresar con Google, recibimos tu nombre y email de Google.</li>
      </ul>

      <h3 className="font-semibold text-foreground">3. Finalidad del tratamiento</h3>
      <p>Usamos tus datos para:</p>
      <ul className="list-disc pl-4 space-y-1">
        <li>Prestar el servicio de pedidos y delivery.</li>
        <li>Comunicarte el estado de tus pedidos.</li>
        <li>Mejorar la experiencia de usuario y personalizar contenido.</li>
        <li>Enviar notificaciones sobre tus pedidos y promociones relevantes.</li>
        <li>Cumplir con obligaciones legales y reglamentarias.</li>
        <li>Prevenir fraudes y garantizar la seguridad de la plataforma.</li>
      </ul>

      <h3 className="font-semibold text-foreground">4. Base legal</h3>
      <p>
        El tratamiento de tus datos se basa en tu consentimiento (al registrarte y usar la plataforma),
        en la ejecución del contrato de servicio, y en intereses legítimos de DeliGO para mejorar el servicio.
      </p>

      <h3 className="font-semibold text-foreground">5. Compartir datos con terceros</h3>
      <p>
        <strong>No vendemos tus datos personales.</strong> Compartimos información únicamente con:
      </p>
      <ul className="list-disc pl-4 space-y-1">
        <li><strong>Negocios asociados:</strong> Los datos necesarios para procesar tus pedidos (nombre, dirección de entrega, teléfono).</li>
        <li><strong>Proveedores de servicio:</strong> Servicios de hosting, almacenamiento de imágenes y autenticación (Google OAuth).</li>
        <li><strong>Autoridades competentes:</strong> Cuando lo exija la ley.</li>
      </ul>

      <h3 className="font-semibold text-foreground">6. Seguridad de los datos</h3>
      <p>
        Implementamos medidas de seguridad técnicas y organizativas para proteger tus datos:
      </p>
      <ul className="list-disc pl-4 space-y-1">
        <li>Contraseñas encriptadas con algoritmo PBKDF2 (100,000 iteraciones).</li>
        <li>Comunicaciones protegidas con HTTPS/TLS.</li>
        <li>Cookies de sesión httpOnly y seguras.</li>
        <li>Acceso restringido a datos personales por personal autorizado.</li>
      </ul>

      <h3 className="font-semibold text-foreground">7. Conservación de datos</h3>
      <p>
        Conservamos tus datos mientras tengas una cuenta activa. Al eliminar tu cuenta, tus datos
        personales se eliminan dentro de los 30 días, excepto aquellos que debamos conservar por
        obligaciones legales (datos fiscales de pedidos durante 5 años).
      </p>

      <h3 className="font-semibold text-foreground">8. Derechos del titular</h3>
      <p>Tenés derecho a:</p>
      <ul className="list-disc pl-4 space-y-1">
        <li><strong>Acceder</strong> a tus datos personales.</li>
        <li><strong>Rectificar</strong> datos incorrectos.</li>
        <li><strong>Suprimir</strong> tu cuenta y datos.</li>
        <li><strong>Exportar</strong> tus datos en formato legible.</li>
        <li><strong>Oponerte</strong> al tratamiento de tus datos.</li>
        <li><strong>Revocar</strong> tu consentimiento en cualquier momento.</li>
      </ul>
      <p>
        Para ejercer tus derechos, podés usar las opciones de tu perfil o contactarnos a soporte@deligo.app.
      </p>

      <h3 className="font-semibold text-foreground">9. Menores de edad</h3>
      <p>
        DeliGO no está dirigido a menores de 13 años. No recopilamos conscientemente datos de menores.
      </p>

      <h3 className="font-semibold text-foreground">10. Cambios en la política</h3>
      <p>
        Podemos actualizar esta política. Te notificaremos por email o en la app cuando haya cambios significativos.
      </p>

      <h3 className="font-semibold text-foreground">11. Contacto</h3>
      <p>
        Para consultas sobre privacidad: <strong>soporte@deligo.app</strong>
      </p>
    </div>
  )
}

// ============================================
// LEGAL CONTENT — Cookies Policy
// ============================================
export function CookiesContent() {
  return (
    <div className="space-y-4 text-sm text-muted-foreground">
      <p><strong>Última actualización:</strong> Marzo 2025</p>

      <h3 className="font-semibold text-foreground">1. ¿Qué son las cookies?</h3>
      <p>
        Las cookies son pequeños archivos de texto que se almacenan en tu dispositivo cuando visitás
        nuestro sitio. Nos ayudan a recordar tus preferencias y mejorar tu experiencia.
      </p>

      <h3 className="font-semibold text-foreground">2. Cookies que usamos</h3>

      <div className="space-y-3">
        <div>
          <p className="font-medium text-foreground">Cookies esenciales</p>
          <p>Necesarias para el funcionamiento de la plataforma:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><code className="bg-muted px-1 rounded text-xs">deligo_session</code> — Token de sesión httpOnly. Sin esta cookie, no podés estar logueado.</li>
            <li><code className="bg-muted px-1 rounded text-xs">deligo-auth</code> — Estado de autenticación (Zustand persist).</li>
            <li><code className="bg-muted px-1 rounded text-xs">deligo-nav</code> — Última pestaña activa en la navegación.</li>
          </ul>
        </div>

        <div>
          <p className="font-medium text-foreground">Cookies de preferencias</p>
          <p>Recordán tus configuraciones:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><code className="bg-muted px-1 rounded text-xs">deligo-cart</code> — Tu carrito de compras guardado.</li>
            <li><code className="bg-muted px-1 rounded text-xs">theme</code> — Tu preferencia de tema (claro/oscuro).</li>
          </ul>
        </div>

        <div>
          <p className="font-medium text-foreground">Cookies de terceros</p>
          <p>No usamos cookies de seguimiento de terceros (Google Analytics, Meta Pixel, etc.).</p>
        </div>
      </div>

      <h3 className="font-semibold text-foreground">3. Almacenamiento local</h3>
      <p>
        Además de cookies, usamos <code className="bg-muted px-1 rounded text-xs">localStorage</code> para:
      </p>
      <ul className="list-disc pl-4 space-y-1">
        <li>Guardar datos del carrito de compras.</li>
        <li>Mantener la sesión del usuario entre recargas.</li>
        <li>Guardar preferencias de navegación.</li>
      </ul>

      <h3 className="font-semibold text-foreground">4. Gestión de cookies</h3>
      <p>
        Podés gestionar o eliminar cookies desde la configuración de tu navegador. Tené en cuenta que
        desactivar las cookies esenciales puede afectar el funcionamiento de la plataforma.
      </p>

      <h3 className="font-semibold text-foreground">5. Push notifications</h3>
      <p>
        Si activás las notificaciones push, almacenamos una suscripción de push en tu perfil. Podés
        desactivarla en cualquier momento desde Configuración en tu perfil.
      </p>

      <h3 className="font-semibold text-foreground">6. Contacto</h3>
      <p>
        Para consultas sobre cookies: <strong>soporte@deligo.app</strong>
      </p>
    </div>
  )
}

// ============================================
// Legal Dialog — reusable for showing terms/privacy
// ============================================
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type LegalDialogType = "terms" | "privacy"

interface LegalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: LegalDialogType
}

export function LegalDialog({ open, onOpenChange, type }: LegalDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] p-0 gap-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-lg">
            {type === "terms" ? "Términos y Condiciones" : "Política de Privacidad"}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] px-6 pb-6">
          {type === "terms" ? <TermsContent /> : <PrivacyContent />}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
