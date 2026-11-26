"use client"

// ============================================
// T1-01 — Caja del cajero: orden de las secciones según el turno CONFIRMADO
// ============================================
// Sin turno (o mientras se confirma): Caja y turno → Ventas → Salidas → herramientas.
// Con turno abierto confirmado por el servidor: Ventas → Caja y turno → Salidas → herramientas.
//
// Cómo se preserva el estado: cada sección es un hijo CON CLAVE ESTABLE del MISMO
// contenedor. Al cambiar el orden, React MUEVE los nodos del DOM existentes (reconciliación
// por clave): no desmonta ni vuelve a montar ninguna sección. La venta en curso de
// VenderView (carrito, cantidades, variantes, inicio de venta con su protección de precios,
// intento de cobro) sigue siendo la MISMA instancia, sin repetir consultas ni efectos.
// Y como se mueve el DOM (no sólo el orden visual), el orden de lectura, el de foco con Tab
// y el del lector de pantalla coinciden siempre con lo que se ve.
//
// Si el foco estaba dentro de una sección que se movió y el navegador lo perdió por el
// movimiento, se lleva al encabezado de la primera sección (nunca en otro caso: un refresco
// automático no mueve el foco del usuario).

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react"

export type SeccionCaja = "turno" | "ventas" | "salidas" | "herramientas" | "historial"

const SIN_TURNO: readonly SeccionCaja[] = ["turno", "ventas", "salidas", "herramientas", "historial"]
const CON_TURNO: readonly SeccionCaja[] = ["ventas", "turno", "salidas", "herramientas", "historial"]

/** Orden de las secciones. `conTurno` es el turno abierto CONFIRMADO por el servidor (cargando = sin turno). */
export function ordenSeccionesCaja(conTurno: boolean): readonly SeccionCaja[] {
  return conTurno ? CON_TURNO : SIN_TURNO
}

/** Atributo del encabezado enfocable (tabIndex -1) de cada sección, para recuperar el foco perdido. */
export const ATRIBUTO_FOCO_SECCION = "data-foco-seccion"

export function CajaSeccionesOrdenadas({ conTurno, secciones }: { conTurno: boolean; secciones: Partial<Record<SeccionCaja, ReactNode>> }) {
  const orden = ordenSeccionesCaja(conTurno)
  const contenedorRef = useRef<HTMLDivElement | null>(null)
  const ordenAplicadoRef = useRef(conTurno)
  // ¿El último foco del usuario estaba en estas secciones? focusin lo marca; un focusout deliberado (el elemento sigue
  // en el documento y el foco no va a ningún lado: tocó fuera) lo desmarca. Un movimiento del DOM que hace perder el
  // foco no dispara focusin, así que la marca se conserva y permite recuperarlo.
  const focoDentroRef = useRef(false)
  useEffect(() => {
    const alEnfocar = (e: FocusEvent) => { focoDentroRef.current = Boolean(contenedorRef.current?.contains(e.target as Node)) }
    const alDesenfocar = (e: FocusEvent) => {
      const t = e.target as Node | null
      if (!e.relatedTarget && t?.isConnected && contenedorRef.current?.contains(t)) focoDentroRef.current = false
    }
    document.addEventListener("focusin", alEnfocar)
    document.addEventListener("focusout", alDesenfocar)
    return () => {
      document.removeEventListener("focusin", alEnfocar)
      document.removeEventListener("focusout", alDesenfocar)
    }
  }, [])

  useLayoutEffect(() => {
    if (ordenAplicadoRef.current === conTurno) return
    ordenAplicadoRef.current = conTurno
    const activo = document.activeElement
    if (!focoDentroRef.current || (activo && activo !== document.body)) return
    const primera = ordenSeccionesCaja(conTurno).find((s) => secciones[s] != null)
    contenedorRef.current?.querySelector<HTMLElement>(`[data-seccion="${primera}"] [${ATRIBUTO_FOCO_SECCION}]`)?.focus()
  }, [conTurno, secciones])

  return (
    <div ref={contenedorRef} className="space-y-3" data-testid="caja-secciones" data-con-turno={conTurno ? "si" : "no"}>
      {orden.map((s) => (secciones[s] == null ? null : (
        <div key={s} data-seccion={s} className="min-w-0">
          {secciones[s]}
        </div>
      )))}
    </div>
  )
}
