# P2-T51-A0 — DeliGO Operaciones Home Visual Redesign: Audit + UX/UI Design

Fecha: 2026-09-20
Alcance: AUDITORÍA + DISEÑO ÚNICAMENTE. Cero código de producto, cero
tests, cero cambios de API/auth/DB/schema/migración, cero Production,
cero prueba física.

## 1. Preflight

```text
WORKTREE_PATH=C:/Leo Campos/Trabajo/deligo-main-limpio
BRANCH=work/p2-t43-r2
START_HEAD_SHA=aa3835aadf78d4c267518a6dccf01796297fa6da (== origin/testing-codex)
DIRTY_BEFORE=SI (2 archivos documentales pre-existentes de esta misma
  sesión, ajenos a este task: DELIGO_FULL_CONTEXT_LATEST.md,
  codex-reports/P2_T44_R1P6I_ABSOLUTE_OPERATIONS_PUSH_TARGET.md)
PRODUCT_CODE_DIRTY_AJENO=NO
```

Worktree T39 (`C:/Leo Campos/Trabajo/deligo-t39-admin`,
`54d17d56f1781ab4d0fd4f1d808df194bdf76a9d`) confirmado intacto, no
tocado. `origin/main` reconfirmado en
`ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763` — Production sin cambios.

## 2. Home real identificado

```text
OPERATIONS_HOME_ROUTE=/operaciones
OPERATIONS_HOME_COMPONENT=src/app/operaciones/page.tsx → OperacionesEntryPage
```

`src/app/operaciones/layout.tsx` envuelve toda la superficie
`/operaciones/*` y monta globalmente `<TerminalLogoutButton/>` — pero
ese botón flotante sólo se renderiza en rutas que empiezan EXACTO con
`/operaciones/terminal`, `/operaciones/salon` o `/operaciones/pyr`
(`isTerminalSurface()`, `src/components/operativo/terminal-logout-button.tsx:9,18-21`).
La ruta bare `/operaciones` NO matchea ningún prefijo → el botón nunca
aparece en el home. Confirmado, no afecta el rediseño.

## 3. Estructura actual del home (CURRENT_HOME_STRUCTURE)

Archivo completo (74 líneas), sin estado, sin `"use client"`, server
component puro:

```text
<main> shell centrado, min-h-screen, bg-background, p-4
  <Card> max-w-md, rounded-2xl, border-border/60, shadow-sm
    <CardContent> p-6, space-y-6
      Identidad:
        <Logo size="sm" />                    (no es link, decorativo)
        <h1> "DeliGO Operaciones"              (text-lg font-extrabold)
        <p>  "Elegí cómo querés entrar."       (text-sm text-muted-foreground)
      <nav aria-label="Modo de acceso">
        <Link href="/operaciones/ingresar">
          icon badge 11x11 rounded-2xl bg-muted text-foreground → UserRound
          "Ingresar con mi cuenta" (bold) +
          "Para trabajar con tu usuario y los permisos asignados por tu negocio."
          <ChevronRight/>
        <Link href="/operaciones/terminal">
          icon badge 11x11 rounded-2xl bg-muted text-foreground → Monitor
          "Usar o activar esta terminal" (bold) +
          "Para una tablet, PC o pantalla vinculada al negocio."
          <ChevronRight/>
```

No hay footer, no hay ayuda/contexto secundario, no hay estados
condicionales, no hay lectura de sesión/cookie de ningún tipo — el
comentario del propio archivo lo confirma explícitamente: *"Selector
NEUTRAL: el usuario elige explícitamente el modo. Esta pantalla no
resuelve, mezcla ni expone identidad: no consulta el contexto de
terminal ni la sesión personal."* Ambos íconos usan hoy el MISMO color
neutro (`bg-muted text-foreground`) — deliberado, para no filtrar
identidad de negocio antes de que el usuario elija.

## 4. Flujos funcionales actuales (tabla exacta)

| VISIBLE_LABEL | ROUTE | ACTOR | SESSION_TYPE | PURPOSE | MUST_PRESERVE |
|---|---|---|---|---|---|
| "Ingresar con mi cuenta" | `/operaciones/ingresar` | Empleado individual (`CuentaOperativa`) | Cookie `deligo_operativo_session` (`OPERATIONAL_SESSION_COOKIE_NAME`, `src/lib/auth.ts:225`) vía `GET /api/operativo/me` / `POST /api/operativo/login` | Login personal → continúa a `/operaciones/mi-panel` (panel personal, reutiliza flujo moderno de Mozo) | SÍ |
| "Usar o activar esta terminal" | `/operaciones/terminal` | Dispositivo compartido (tablet/PC/pantalla) | Cookie `deligo_operaciones_terminal` vía `GET /api/operaciones/terminal/contexto` (`src/lib/operaciones-terminal-auth.ts`) | Si terminal vinculada: muestra áreas (Salón/PyR); si no (401), auto-redirige a `/operaciones/activar` | SÍ |

No existe ningún tercer CTA/link en este archivo (sin footer, sin
"olvidé mi contraseña", sin "crear cuenta" — esos están en las páginas
destino, no en el selector).

```text
CURRENT_ACTIONS=2 (Ingresar con mi cuenta, Usar o activar esta terminal)
PERSONAL_ROUTE_CURRENT=/operaciones/ingresar
TERMINAL_ROUTE_CURRENT=/operaciones/terminal
```

## 5. Regla principal T51 — confirmada

```text
VISUAL_REDESIGN_ONLY=SI
```

Todo el diseño propuesto abajo opera exclusivamente sobre
`src/app/operaciones/page.tsx` (JSX/Tailwind). No se propone tocar
`layout.tsx`, ningún endpoint, ninguna cookie, ningún modelo.

## 6. Personal vs Terminal — distinción conceptual auditada

El copy actual YA distingue correctamente los dos caminos ("tu usuario y
los permisos asignados por tu negocio" vs "tablet, PC o pantalla
vinculada al negocio") — el gap es puramente VISUAL: ambos íconos
comparten el mismo color neutro, sin jerarquía ni diferenciación de
marca entre "persona" y "dispositivo". El diseño (§11/§12) resuelve esto
con color, sin tocar el texto base (que ya es preciso y verificado).

## 7. Auditoría del lenguaje visual compartido de DeliGO

Revisado como referencia (sin copiar pantallas completas):
`src/app/login/page.tsx` (Cliente), `src/app/negocio/page.tsx`
(Negocio), `src/app/operaciones/ingresar/page.tsx` y
`src/app/operaciones/terminal/page.tsx` (ya dentro de Operaciones).

Patrón repetido, verificado línea por línea en los 4 archivos:

```text
Shell:      min-h-screen flex items-center justify-center bg-background
            (p-4 o px-4 py-8), contenido en un <div>/<Card>
            max-w-sm | max-w-md, centrado.
Decoración: (opcional, usado en login Cliente y en
            operaciones/ingresar) 2 círculos absolutos, blur-3xl,
            bg-<accent>/5..10, pointer-events-none, dentro de un
            wrapper con overflow-hidden.
Icon badge: contenedor cuadrado redondeado (rounded-2xl para badges
            compactos ~44px, rounded-3xl para hero ~64px), o bien
            `bg-gradient-to-br from-<accent> to-<accent>/70` +
            `shadow-lg shadow-<accent>/20` (hero), o bien
            `bg-<accent>-100 text-<accent>-700
            dark:bg-<accent>-950/40 dark:text-<accent>-300`
            (compacto, ej. operaciones/ingresar), o bien
            `style={{backgroundColor:`${accent}15`, color: accent}}`
            cuando el accent es dinámico (operaciones/terminal, usa
            negocio.colorPrincipal).
Card:       shadcn <Card>, `border-border/50` o `/60`, `rounded-2xl`,
            `shadow-sm` (neutro) o `shadow-lg shadow-<accent>/5`
            (con identidad).
Logo:       <Logo size="sm|md|lg"/> siempre igual, "Deli" en
            text-foreground + "GO" en text-primary — NUNCA envuelto en
            <Link> en ningún archivo del repo (confirmado por grep,
            0 resultados) — siempre decorativo.
Heading:    h1 text-lg/xl/2xl font-extrabold o font-bold.
Subheading: p text-sm text-muted-foreground.
Back link:  <ArrowLeft className="h-4 w-4"/> + "Volver"/"Volver al
            inicio", text-sm text-muted-foreground hover:text-foreground.
Dark mode:  clases dark: explícitas en TODOS los colores custom
            (dark:bg-amber-950/40, dark:border-emerald-900/50, etc.) —
            nunca color hardcodeado sin contraparte dark.
Accent por actor: Cliente=primary (naranja/tema), Negocio=emerald/teal
            (login) con variantes ámbar/rojo para estados de alerta,
            Operaciones-personal (/ingresar)=amber ya establecido,
            Operaciones-terminal=negocio.colorPrincipal (dinámico, sólo
            conocido DESPUÉS de autenticar la terminal).
```

```text
DELIGO_SHARED_VISUAL_LANGUAGE=shell centrado max-w-sm/md + Card
  shadow-lg/shadow-sm + icon badge redondeado con accent por actor +
  Logo decorativo constante + heading extrabold/subheading muted +
  soporte dark: universal vía clases Tailwind, ThemeProvider global
  (src/app/layout.tsx:5,89) aplica a toda la app incluida /operaciones.
```

## 8. Identidad "DeliGO Operaciones"

```text
NEW_ASSET_REQUIRED=NO
```

`Logo` (`src/components/shared/logo.tsx`) es texto puro con CSS — cero
imagen, cero SVG externo, reutilizable sin fricción. Los íconos
(`UserRound`, `Monitor`, `ChevronRight`) ya están importados en el
archivo objetivo. No se requiere ningún asset nuevo, ni logo alternativo
para Operaciones — se reutiliza `<Logo/>` idéntico al resto de DeliGO
(consistente con /ingresar y /terminal, que YA lo usan igual).

Hallazgo relevante: `/operaciones/ingresar` ya estableció **amber** como
el accent de "cuenta personal de Operaciones" (icon badge
`bg-amber-100 text-amber-700`, CTA `bg-amber-500`, decoración de fondo
`bg-amber-400/10`/`bg-orange-500/10`). El home debe **heredar ese mismo
amber** para la opción "Ingresar con mi cuenta" en vez de inventar un
color nuevo — continuidad visual entre el selector y su destino.

`/operaciones/terminal` usa `negocio.colorPrincipal` (dinámico, sólo
disponible tras resolver la terminal) — el home NO puede ni debe usar
ese color (rompería la neutralidad arquitectónica documentada en el
propio código, §3). Se propone un accent FIJO y genérico para la opción
Terminal en el home (slate/gris-azulado, evocando "dispositivo", nunca
un color de negocio específico) — ver §12.

## 9. Estructura propuesta (Option A, recomendada — ver §26)

```text
<main> shell, min-h-screen, bg-background, p-4, relative, overflow-hidden
  Decoración de fondo (2 blurs sutiles, reutilizando el patrón exacto
    de /operaciones/ingresar): bg-amber-400/10 y bg-slate-400/10 —
    refleja los dos accents de las opciones de abajo, sin comprometerse
    con ninguno antes de tiempo (siguen siendo pointer-events-none,
    puramente decorativos, position absolute detrás del Card).
  <Card> relative, max-w-md, rounded-2xl, border-border/60,
         shadow-lg shadow-black/5 dark:shadow-black/20 (upgrade de
         shadow-sm actual, mismo lenguaje que /ingresar)
    <CardContent> p-6, space-y-6
      Identidad (sin cambios de contenido, mejora tipográfica menor):
        <Logo size="sm"/>
        <h1>DeliGO Operaciones</h1>
        <p>Elegí cómo querés entrar.</p>
      <nav aria-label="Modo de acceso">
        PERSONAL_CARD (§11) — accent amber
        TERMINAL_CARD (§12) — accent slate
      (sin footer nuevo — ver §10, no se inventa ayuda no verificada)
```

No se convierte en dashboard, no se agregan secciones nuevas, no se
cambia el "shell" server-component (sigue sin `"use client"`, sigue sin
leer cookies/estado).

## 10. Card Personal (PERSONAL_CARD_DESIGN)

```text
Icono:        UserRound (sin cambio)
Badge:        w-11 h-11 rounded-2xl, bg-amber-100 text-amber-700
              dark:bg-amber-950/40 dark:text-amber-300
              (idéntico a operaciones/ingresar:140 — continuidad
              selector→destino)
Título:       "Ingresar con mi cuenta" (sin cambio — evidence-based)
Descripción:  "Para trabajar con tu usuario y los permisos asignados
              por tu negocio." (sin cambio — ya refleja el modelo real
              de CuentaOperativa/scopes, no se inventan roles/áreas)
CTA:          fila completa clickable (Link envolviendo toda la
              tarjeta, patrón ya usado) + ChevronRight; hover
              hover:border-amber-400/40 hover:shadow-md (en vez del
              genérico hover:border-primary/40 — refuerza identidad)
Focus:        focus-visible:ring-2 focus-visible:ring-ring (sin cambio,
              ya cumple)
Mobile:       sin cambio de layout — ya es full-width, ya es una fila
              flex con truncamiento (min-w-0 flex-1) para texto largo
```

## 11. Card Terminal (TERMINAL_CARD_DESIGN)

```text
Icono:        Monitor (sin cambio)
Badge:        w-11 h-11 rounded-2xl, bg-slate-100 text-slate-700
              dark:bg-slate-800/60 dark:text-slate-300 (NUEVO accent
              fijo y genérico — nunca negocio.colorPrincipal, nunca
              amber, evita cualquier lectura de identidad de negocio
              antes de autenticar la terminal)
Título:       "Usar o activar esta terminal" (sin cambio — ya cubre
              ambos casos reales: terminal ya vinculada [continúa] o
              sin vincular [el propio /operaciones/terminal redirige a
              /operaciones/activar automáticamente si hace falta])
Descripción:  "Para una tablet, PC o pantalla vinculada al negocio."
              (sin cambio)
CTA:          mismo patrón fila completa clickable + ChevronRight;
              hover hover:border-slate-400/40 hover:shadow-md
Focus:        sin cambio
Mobile:       sin cambio de layout
```

## 12. No cambiar routing — confirmado

```text
PERSONAL_ROUTE_CURRENT=/operaciones/ingresar
TERMINAL_ROUTE_CURRENT=/operaciones/terminal
PERSONAL_ROUTE_CHANGED=NO (planeado para R1)
TERMINAL_ROUTE_CHANGED=NO (planeado para R1)
```

Ambos `href` permanecen carácter por carácter idénticos — el diseño
sólo toca `className`/color, nunca `href`.

## 13. Auth / session isolation — auditoría superficial (sin refactor)

```text
PERSONAL_SESSION_AUTHORITY=cookie `deligo_operativo_session`
  (`OPERATIONAL_SESSION_COOKIE_NAME`, src/lib/auth.ts:225) — contrato
  GET /api/operativo/me / POST /api/operativo/login, exclusivo de
  /operaciones/ingresar y /operaciones/mi-panel.
TERMINAL_SESSION_AUTHORITY=cookie `deligo_operaciones_terminal` —
  contrato GET /api/operaciones/terminal/contexto
  (src/lib/operaciones-terminal-auth.ts, src/lib/device-identity.ts),
  exclusivo de /operaciones/terminal, /operaciones/salon,
  /operaciones/pyr, /operaciones/activar.
```

El home (`page.tsx`) hoy no importa ni consulta NINGUNA de las dos —
el rediseño debe preservar exactamente ese hecho (server component
puro, sin `"use client"`, sin `fetch`, sin lectura de cookies). Esta es
la garantía arquitectónica de que el selector nunca puede "mezclar"
ambas identidades — no se toca.

## 14. T52 / T38 / T40 — confirmado sin tocar

```text
T52_SCOPE_TOUCHED=NO (no se toca manifest, DynamicManifest, iconos
  legacy, /mozo, service worker — el archivo objetivo no importa nada
  de PWA identity)
T38_SCOPE_TOUCHED=NO (no se implementa ningún prompt de instalación,
  tutorial iOS, ni detección de standalone)
PUSH_SCOPE_TOUCHED=NO (no se toca push, subscriptions, SW, permisos de
  notificación, ni login lifecycle)
```

## 15. Responsive — auditoría y plan

Estructura actual ya es mobile-first (`max-w-md`, `p-4`, `flex-1
min-w-0` con truncamiento). Verificado en 320/360/390px y desktop
(análisis estático de las clases, sin viewport físico en A0):

```text
max-width:      max-w-md (Card) — sin cambio
padding:        p-4 (main), p-6 (CardContent) — sin cambio
card stacking:  nav es una columna única (space-y-3) en todos los
                anchos — nunca se convierte en grid horizontal (evita
                el riesgo de que "Elegir un camino" se perciba como
                dashboard)
gaps:           gap-3 entre ícono/texto/chevron dentro de cada opción
text wrapping:  título con leading-tight; descripción sin line-clamp
                explícito — a 320px con el texto actual no corta
                (frases cortas, ya verificadas en producción por
                /operaciones/ingresar y /terminal con textos similares
                o más largos)
button sizes:   fila completa clickable ≥ 44px de alto real (padding
                p-4 + contenido ~11px icon + texto de 2 líneas ⇒
                bien por encima de 44px)
safe-area:      no aplica (no es una superficie PWA standalone con
                notch relevante distinta a las demás páginas de
                Operaciones, que tampoco la usan en esta pantalla)
scroll:         min-h-screen + flex centrado ⇒ sin scroll salvo
                viewports muy bajos, comportamiento ya existente
```

```text
TOUCH_TARGET_PLAN=cada opción sigue siendo la fila completa clickable
  (Link envolviendo el div, patrón ya presente) — sin doble
  interacción confusa (un solo target por opción, el ChevronRight es
  puramente decorativo, no un botón separado); focus-visible ya
  presente en el Link exterior.
```

## 16. Accessibility

```text
heading hierarchy:   único <h1> por página (correcto, sin saltos)
contraste:           amber-700/amber-100 y slate-700/slate-100 (y sus
                     variantes dark) son combinaciones ya usadas o
                     equivalentes a las de /operaciones/ingresar
                     (amber) y a badges existentes en el design system
                     (slate ya usado en otras superficies del repo con
                     mismo patrón de contraste) — no se introduce una
                     paleta nueva sin precedente
aria:                <nav aria-label="Modo de acceso"> ya presente,
                     sin cambio; iconos son decorativos junto a texto
                     visible ⇒ no requieren aria-label propio (ya es
                     el patrón actual, correcto)
semantic:            <Link> de Next.js renderiza <a> real — ya
                     accesible por teclado sin cambios
focus:               focus-visible:ring-2 ya presente en ambos Links
reduced motion:      no se propone ninguna animación nueva (ni
                     framer-motion ni transiciones complejas) — sólo
                     transition-all ya existente en hover de borde/
                     sombra (mismo que hoy, no se agrega movimiento)
```

## 17. Dark mode

```text
DARK_MODE_SUPPORTED_CURRENTLY=SI (ThemeProvider global,
  src/app/layout.tsx:5,89 — aplica a toda la app, incluido
  /operaciones; confirmado también por el uso extensivo de clases
  dark: en /operaciones/ingresar y /operaciones/terminal)
DARK_MODE_PLAN=todo color nuevo propuesto (amber-100/amber-700 para
  Personal, slate-100/slate-700 para Terminal) lleva su contraparte
  dark: explícita (dark:bg-amber-950/40 dark:text-amber-300 —ya
  probada en producción por /ingresar—, dark:bg-slate-800/60
  dark:text-slate-300 —nueva pero sigue el mismo patrón de opacidad
  reducida sobre fondo oscuro que el resto del design system). Cero
  color hardcodeado sin variante dark.
```

## 18. Copy

Auditado: el copy actual (`"Ingresar con mi cuenta"` /
`"Para trabajar con tu usuario y los permisos asignados por tu
negocio."` y `"Usar o activar esta terminal"` /
`"Para una tablet, PC o pantalla vinculada al negocio."`) ya es preciso,
ya refleja el modelo real (`CuentaOperativa` con permisos por negocio;
`TerminalOperativa` vinculada al negocio) y ya fue validado en
producción por las páginas destino que usan frases equivalentes. **No
se propone cambiar ningún texto** — el gap identificado en toda esta
auditoría es 100% visual (color/jerarquía), nunca de contenido. Cambiar
copy sin necesidad violaría el alcance ("VISUAL_REDESIGN_ONLY").

## 19. Home state / sesión existente

```text
EXISTING_SESSION_HOME_BEHAVIOR=El home NUNCA consulta ninguna sesión
  (ni personal ni terminal) — muestra siempre las mismas 2 opciones
  sin importar el estado real. Cada página destino resuelve su propio
  estado de forma independiente: /operaciones/ingresar detecta sesión
  personal existente vía GET /api/operativo/me y muestra un atajo
  "Continuar a mi panel" en vez del formulario; /operaciones/terminal
  consulta GET /api/operaciones/terminal/contexto y redirige
  automáticamente a /operaciones/activar si la terminal no es válida.
  El rediseño de T51 NO debe agregar lectura de sesión al home (sería
  arquitectura nueva, fuera de alcance) — sólo mejora visual del
  selector neutral existente.
```

## 20. Back / navigation

Auditado: el home no tiene "volver" (es el punto de entrada de más
alto nivel de `/operaciones`) ni logo clickable (`<Logo/>` nunca es un
`<Link>` en ningún archivo del repo — confirmado por grep). Ambas
páginas destino sí tienen "Volver" hacia `/operaciones`. El rediseño no
agrega navegación nueva al home (no hay a dónde "volver" desde el nivel
más alto, y agregar un logo-como-link rompería la consistencia con el
resto del repo).

## 21. Componentes reutilizables (REUSABLE_COMPONENTS)

```text
REUSABLE_COMPONENTS=Card/CardContent (@/components/ui/card),
  Logo (@/components/shared/logo), lucide-react icons (UserRound,
  Monitor, ChevronRight — ya importados; ningún ícono nuevo
  requerido), next/link (Link), cn() de @/lib/utils para componer
  className condicional (patrón ya usado en el resto del repo, ej.
  salon-tab.tsx). No se requiere Button para el CTA (el patrón
  "fila completa clickable" del propio archivo ya resuelve la
  interacción sin botón dedicado, igual que hoy).
```

Preferencia de reuso confirmada: cero componentes nuevos son
estrictamente necesarios. Como mejora opcional de mantenibilidad (no
obligatoria), R1 podría extraer un pequeño helper local
`EntryOptionCard({href, icon, accent, title, description})` DENTRO del
mismo archivo `page.tsx` para no duplicar el markup entre Personal y
Terminal — reduce ~20 líneas de duplicación sin crear un archivo nuevo
ni afectar el árbol de imports.

## 22. Opciones de diseño

### OPTION_A — Refinamiento del Card único (RECOMENDADA)

```text
Layout:      mantiene la estructura EXACTA actual (un solo <Card>,
             nav vertical con 2 filas clickables) — sólo se agregan
             accent colors distintos por opción, decoración de fondo
             sutil (blur), y shadow-lg en vez de shadow-sm.
Pros:        diff mínimo (~15-20 líneas), riesgo casi nulo, cero
             cambio estructural, coherente con "no convertir el home
             en dashboard", reutiliza 1:1 el patrón ya validado en
             /operaciones/ingresar.
Riesgos:     ninguno funcional; riesgo visual bajo (el resultado sigue
             pareciendo "el mismo home, mejor pulido" — es justamente
             el objetivo pedido).
Complejidad: BAJA.
```

### OPTION_B — Hero + 2 cards independientes en grid

```text
Layout:      Logo + heading fuera de cualquier Card (hero centrado),
             seguido de 2 <Card> separadas (Personal / Terminal) en
             grid-cols-1 sm:grid-cols-2, cada una con su propio botón
             CTA explícito (no sólo fila clickable) — mismo patrón que
             AreaCard en /operaciones/terminal cuando hay 2 áreas.
Pros:        más espacio para copy, visualmente más "importante" cada
             opción, reutiliza el patrón de grid que YA existe en
             /operaciones/terminal (consistencia con esa pantalla
             específica).
Riesgos:     mayor superficie de cambio (nueva estructura de grid,
             nuevo componente Button/CTA por card), más fácil de que
             "se sienta como un dashboard" (justo lo que la tarea pide
             evitar), requiere más decisiones de spacing en mobile
             (2 cards completas vs. 2 filas compactas).
Complejidad: MEDIA.
```

```text
OPTION_A=Refinamiento del Card único existente (accent color +
  decoración + shadow), sin cambio estructural
OPTION_B=Hero + 2 Cards independientes en grid (mayor cambio
  estructural, replica el patrón de AreaCard de /operaciones/terminal)
RECOMMENDED_OPTION=OPTION_A — cumple mejor "simple, profesional, claro,
  sin ruido, no convertir en dashboard"; menor riesgo; refuerza
  continuidad visual con /operaciones/ingresar (mismo amber) sin
  inflar la superficie de cambio para una pantalla que sigue siendo,
  conceptualmente, un selector binario simple.
```

## 23. Recomendación R1 — plan de archivos

| PATH | CHANGE | WHY | RISK |
|---|---|---|---|
| `src/app/operaciones/page.tsx` | Ajustar `className`/colores: accent amber en badge+hover de "Ingresar con mi cuenta", accent slate nuevo en badge+hover de "Usar o activar esta terminal", agregar decoración de fondo (2 blurs, patrón de `/operaciones/ingresar`), subir `shadow-sm`→`shadow-lg shadow-black/5 dark:shadow-black/20` en el Card. Opcionalmente extraer un helper local `EntryOptionCard` para evitar duplicación. **Sin tocar `href`, sin tocar texto, sin agregar imports de auth/session.** | Único archivo que renderiza el home; cambio 100% visual, cero lógica | BAJO |
| (ninguno más) | — | No se requiere ningún otro archivo — no hay lógica compartida que extraer a un helper cross-file, y los componentes reutilizables (`Card`, `Logo`, iconos) ya existen | — |

```text
R1_PRODUCT_FILES_PLANNED=1 (src/app/operaciones/page.tsx)
R1_TEST_FILES_PLANNED=1 (test estático/render nuevo para el home,
  ver §24 — nombre sugerido:
  src/app/operaciones/page.test.tsx)
```

No se modifica backend, no se modifica ningún otro archivo de
Operaciones (`layout.tsx`, `ingresar/page.tsx`, `terminal/page.tsx`,
`activar/page.tsx` quedan intactos).

## 24. Test plan (planeado, NO implementado en A0)

```text
A. Renderiza ambas opciones — query por texto exacto "Ingresar con mi
   cuenta" y "Usar o activar esta terminal".
B. El href de la opción personal es exactamente "/operaciones/ingresar"
   (sin cambio respecto al valor actual).
C. El href de la opción terminal es exactamente "/operaciones/terminal"
   (sin cambio respecto al valor actual).
D. Los textos de descripción coinciden exactamente con los actuales
   (guarda contra regresión de copy no autorizada).
E. El <nav> contiene exactamente 2 <Link> — ningún enlace legacy nuevo
   (ej. nunca a /mozo, /negocio, /repartidor).
F. Clases de touch-target/responsive presentes (ej. assert sobre
   className conteniendo "rounded-2xl" y "p-4" en cada fila).
G. El archivo no importa ningún módulo de auth/session
   (@/lib/auth, @/lib/operaciones-terminal-auth, next/headers,
   cookies) — assert estático sobre el source o sobre el árbol de
   imports del módulo compilado.
H. No se modifica ningún manifest/service-worker en el diff de esta
   ronda (verificable por `git diff --name-only`, no por un test
   unitario).
I. Contrato de dark mode: si se agregan accents con `dark:`, assert
   que cada clase de color custom nueva tiene su contraparte `dark:`
   (mismo patrón de test estático usado en T47/T50 para contratos
   puros).
J. Contrato de "sin overflow móvil": verificable de forma confiable
   sólo en navegador real (Browser pane / dispositivo) en R1 — no se
   modela como test unitario estático, se deja como paso de
   verificación manual/Browser en R1 antes de deploy.
```

## 25. Certificación física futura (R2) — preparado, NO ejecutado

```text
R2_CASE_A_READY=SI — home desktop (viewport ≥1280px)
R2_CASE_B_READY=SI — home mobile (320/360/390px, Browser pane o
  dispositivo real)
R2_CASE_C_READY=SI — "Cuenta personal" visualmente clara y distinta
  (accent amber diferenciado)
R2_CASE_D_READY=SI — "Terminal" visualmente clara y distinta (accent
  slate diferenciado)
R2_CASE_E_READY=SI — tap "Ingresar con mi cuenta" → llega exactamente
  a /operaciones/ingresar (sin cambio de destino)
R2_CASE_F_READY=SI — "Volver" desde /operaciones/ingresar o
  /operaciones/terminal regresa correctamente a /operaciones
R2_CASE_G_READY=SI — tap "Usar o activar esta terminal" → llega
  exactamente a /operaciones/terminal (o auto-redirige a
  /operaciones/activar si no hay terminal vinculada — comportamiento
  preexistente, no tocado)
R2_CASE_H_READY=SI — dark mode (toggle del sistema/tema), ambos
  accents legibles
R2_CASE_I_READY=SI — sin overflow horizontal ni cortes de texto en
  320px
R2_CASE_J_READY=CONDICIONAL — PWA "Operaciones" instalada, si el
  operador tiene un dispositivo con la PWA ya instalada disponible;
  si no, se marca NOT_REQUIRED_CONDITIONAL igual que T50 hizo con su
  Case E cuando la condición previa no estaba disponible
```

No se ejecuta ningún caso ahora — sólo se registra que el diseño deja
todos los casos preparados para R1→R2.

## 26. Estados a preservar — verificados sin tocar

```text
P2_T55_STATUS_UNCHANGED=CLOSED_TESTING_CERTIFIED
P2_T50_STATUS_UNCHANGED=CLOSED_TESTING_CERTIFIED
P2_T49_STATUS_UNCHANGED=CLOSED_TESTING_CERTIFIED
P2_T47_STATUS_UNCHANGED=CLOSED_TESTING_CERTIFIED
P2_T45_STATUS_UNCHANGED=CLOSED_TESTING_CERTIFIED
P2_T43_STATUS_UNCHANGED=CLOSED_TESTING_CERTIFIED
P2_T44_STATUS_UNCHANGED=PAUSED_UNRESOLVED_AFTER_TIMEBOX
P2_T46_ORIGINAL_STATUS_UNCHANGED=CLOSED_PRODUCTION
P2_T46_R2_STATUS_UNCHANGED=CLOSED_TESTING_CERTIFIED_AWAITING_PRODUCTION_PROMOTION
CLIENT_MESA_SILENT_DEFAULT_PAYMENT_FINDING_UNCHANGED=OPEN
T39_TOUCHED=NO
```

## 27. Cierre de esta ronda (A0)

```text
PRODUCT_FILES_CHANGED_DURING_A0=0
API_FILES_CHANGED_DURING_A0=0
TEST_FILES_CHANGED_DURING_A0=0
SCHEMA_CHANGED=NO
MIGRATION_CREATED=NO
DB_MUTATED=NO
AUTH_CHANGED=NO
PERMISSIONS_CHANGED=NO
ROUTING_CHANGED=NO
PRODUCTION_TOUCHED=NO
```
