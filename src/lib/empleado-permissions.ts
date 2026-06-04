// DeliGO - Employee Permission System
// Granular role-based access control for employees

export type EmpleadoPermiso =
  | "gestion_pedidos"      // Ver y cambiar estado de pedidos
  | "gestion_productos"    // Crear, editar, eliminar productos
  | "gestion_caja"         // Ver resumen de ventas/cierre de caja
  | "gestion_empleados"    // Ver y gestionar otros empleados

// Default permissions by role
const ROLE_DEFAULTS: Record<string, EmpleadoPermiso[]> = {
  admin: [
    "gestion_pedidos",
    "gestion_productos",
    "gestion_caja",
    "gestion_empleados",
  ],
  cajero: [
    "gestion_pedidos",
    "gestion_caja",
  ],
  cocinero: [
    "gestion_pedidos",
  ],
  mozo: [
    "gestion_pedidos",
  ],
}

/**
 * Parse permisos from JSON string stored in DB
 */
export function parsePermisos(permisosJson: string): EmpleadoPermiso[] {
  try {
    const parsed = JSON.parse(permisosJson)
    if (Array.isArray(parsed)) return parsed as EmpleadoPermiso[]
    return []
  } catch {
    return []
  }
}

/**
 * Serialize permisos to JSON string for DB storage
 */
export function serializePermisos(permisos: EmpleadoPermiso[]): string {
  return JSON.stringify(permisos)
}

/**
 * Get effective permissions for an employee.
 * If they have custom permisos set, use those.
 * Otherwise, fall back to role defaults.
 */
export function getEffectivePermisos(
  rol: string,
  permisosJson: string
): EmpleadoPermiso[] {
  const customPermisos = parsePermisos(permisosJson)
  if (customPermisos.length > 0) return customPermisos
  return ROLE_DEFAULTS[rol] || ROLE_DEFAULTS.mozo
}

/**
 * Check if an employee has a specific permission.
 */
export function hasPermiso(
  rol: string,
  permisosJson: string,
  permiso: EmpleadoPermiso
): boolean {
  const permisos = getEffectivePermisos(rol, permisosJson)
  return permisos.includes(permiso)
}

/**
 * All available permissions for UI display
 */
export const ALL_PERMISOS: { id: EmpleadoPermiso; label: string; description: string }[] = [
  {
    id: "gestion_pedidos",
    label: "Gestión de Pedidos",
    description: "Ver y cambiar estado de pedidos",
  },
  {
    id: "gestion_productos",
    label: "Gestión de Productos",
    description: "Crear, editar y eliminar productos",
  },
  {
    id: "gestion_caja",
    label: "Gestión de Caja",
    description: "Ver resumen de ventas y cierre de caja",
  },
  {
    id: "gestion_empleados",
    label: "Gestión de Empleados",
    description: "Ver y gestionar otros empleados",
  },
]

/**
 * Available roles for UI display
 */
export const EMPLEADO_ROLES = [
  { id: "mozo", label: "Mozo", icon: "🧑‍🍳" },
  { id: "cajero", label: "Cajero", icon: "💰" },
  { id: "cocinero", label: "Cocinero", icon: "👨‍🍳" },
  { id: "admin", label: "Administrador", icon: "🔑" },
] as const
