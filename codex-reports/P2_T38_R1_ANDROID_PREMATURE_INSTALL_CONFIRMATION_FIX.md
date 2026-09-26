# P2-T38-R1 — Android premature install confirmation

**Fecha:** 2026-09-26
**Resultado:** `FIXED_TESTED_DEPLOYED_TESTING_AWAITING_RECERTIFICATION`

## Evidencia física anterior — permanece FAIL

```text
PHYSICAL_DEVICE=ANDROID_REAL
BROWSER=CHROME
PWA=CLIENTE
INITIAL_STATE=PWA_NOT_INSTALLED
PRIOR_ANDROID_ACCEPT_PHYSICAL=FAIL
PRIOR_FAILURE=PREMATURE_APP_INSTALLED_MESSAGE
P2_T38_R0_IMPLEMENTATION_COMMIT=5dc91a21d5525d5e2e9ed0c83243c7cbcc620067
```

Al aceptar la instalación, el operador vio “App instalada” antes de que la PWA
estuviera visible/utilizable en el launcher. Segundos después sí apareció. La
evidencia física prevalece sobre la suposición anterior; R1 conserva ese FAIL y
no declara cerrada/certificada T38.

## Causa raíz confirmada

Había dos consumidores del mismo evento en el flujo actualmente montado:

1. `src/hooks/use-install-prompt.ts` recibía `appinstalled`, asignaba
   `isInstalledValue=true` y transicionaba a `installed-confirmed`.
2. `src/components/shared/install-prompt.tsx` tenía otro listener que mostraba
   “¡App instalada!” durante 3 segundos. Al actualizar `isInstalled`, el banner
   de espera era reemplazado por ese éxito visual.

Así, el evento del navegador se trataba como si garantizara que el icono ya
estaba disponible desde el launcher. El componente legacy
`src/components/pwa/install-prompt.tsx` también contiene un estado interno
`installed`, incluso al aceptar `userChoice`, pero `rg` no encontró usos ni
montaje del componente/hook en la app; no era una segunda fuente visible en
esta pantalla y quedó intacto, fuera del fileset autorizado.

## Auditoría de señales del navegador

| Señal | Hallazgo para este caso |
|---|---|
| `appinstalled` | Chrome comunica que completó su flujo de instalación; no expone el estado de visibilidad/listo del launcher. El caso físico de este teléfono demostró que la señal no basta para el mensaje de éxito. [MDN: `appinstalled`](https://developer.mozilla.org/en-US/docs/Web/API/Window/appinstalled_event) |
| `display-mode: standalone` | Confirma que esta ventana está ejecutándose en modo standalone. Es evidencia suficiente cuando se abre la instancia instalada; no informa desde la pestaña vieja cuándo el launcher terminó de materializarla. [MDN: display mode](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Create_a_standalone_app) |
| `navigator.standalone` | Propiedad no estándar disponible en Safari de iOS; no es una señal Android/Chrome. [MDN: Navigator](https://developer.mozilla.org/en-US/docs/Web/API/Navigator) |
| `getInstalledRelatedApps()` | Chrome Android lo soporta, pero requiere declarar la PWA relacionada en `related_applications`. Los ocho manifests actuales no tienen ese campo; añadirlo estaba prohibido. Además, “instalada” no demuestra por sí solo visibilidad en launcher. [Chrome for Developers](https://developer.chrome.com/docs/capabilities/get-installed-related-apps) |
| focus/visibility/navigation | Sólo informa del ciclo de vida de la pestaña; no prueba instalación ni launcher-ready. No se añadió polling ni se usa como autoridad. |

No se encontró una señal web compatible y configurada que informe “icono ya
visible/listo en launcher”. La confirmación fuerte queda limitada a observar
esta PWA ejecutándose en standalone.

## Corrección R1

- Se añadió el estado `browser-install-event-received`, distinto de
  `installed-confirmed`. `appinstalled` ya no asigna `isInstalledValue=true`.
- `installed-confirmed` sólo se alcanza al observar standalone (incluida la
  apertura inicial real desde la PWA instalada).
- Se eliminó el listener duplicado y el toast “¡App instalada!”.
- Tras aceptar, la espera ahora es un aviso estático “Instalación iniciada”; tras
  `appinstalled`, explica que Chrome puede tardar en mostrarla en “tus apps” y
  que la página no puede verificar launcher-ready. Se puede cerrar y continuar
  usando la pestaña: no hay spinner, porcentajes ni CTA inmediato.
- Un `beforeinstallprompt` nuevo sigue creando una nueva oportunidad de retry;
  dismissed/failure no se declara éxito. iOS/iPadOS permanece sin cambios.

La confirmación física post-fix sigue pendiente; estos cambios no sustituyen la
repetición física de Android ACCEPT.

## Fileset y límites

```text
T38_R1_FILES_ONLY=SI
FILES_CHANGED=5
PRISMA_SCHEMA_CHANGED=NO
NEW_MIGRATIONS=0
MANIFEST_FILES_CHANGED=0
SERVICE_WORKER_CHANGED=NO
AUTH_CHANGED=NO
PUSH_CHANGED=NO
BACKEND_CHANGED=NO
T34_SESSION_ISOLATION_UNTOUCHED=SI
PRODUCTION_TOUCHED=NO
```

Paths funcionales exactos:

- `src/hooks/use-install-prompt.ts`
- `src/components/shared/install-prompt.tsx`
- `src/lib/pwa-install-state.ts`
- `src/lib/pwa-install-state.test.ts`
- `src/lib/android-install-status-static-contract.test.ts`

El fallo T34 de orden `setCookie`/transacción observado en R0 permanece
documentado y sin cambios; esta tarea no lo ejecutó ni lo corrigió.

## Validación

- Tests focales T38 + exclusiones `/mozo`, `/e`, `/s`: **40 pass, 0 fail** en 3
  archivos; incluye replay `accepted → appinstalled` sin `installed-confirmed`.
- Regresión dirigida PWA/identidad/scope/T36/service-worker/T40: **131 pass, 0
  fail** en 12 archivos.
- Una tanda de exploración adicional que incluía un contrato histórico
  AUTH02 de Push dio 154 pass y 1 fail: espera un literal de selector distinto
  del que usa actualmente el archivo Push, ambos intactos en R1. Es ajeno al
  fileset; no se corrigió ni mezcló.
- ESLint del fileset: **PASS**. `git diff --check`: **PASS**.
- `bunx tsc --noEmit`: **FAIL global**, con diagnósticos del repositorio en
  archivos no modificados (p.ej. `prisma/seed.ts` y scripts de migración); el
  filtro de los cinco paths R1 no encontró diagnósticos. Next Build también
  informó que omite type validation. No se reparó el baseline ajeno.
- `bun run build`: **PASS**; Next compiló y generó 158 páginas.

## TESTING deploy, logs y smoke

Commit funcional único: `147f24a39dc6f2df04ca8b5f9d54492864de9460`
(`fix: avoid premature PWA install confirmation`), publicado a
`origin/testing-codex`. No hubo redeploy manual.

| Servicio TESTING | Deployment | Resultado |
|---|---|---|
| DeliGO Copy | `72f9b3d2-acda-42c6-89e0-1a393274046a` | `SUCCESS`, commit exacto |
| chat en vivo | `46deaa53-34b7-43a9-a0f0-9fc17f09a611` | `SUCCESS`, commit exacto |
| Review Moderation Expiry | `7d53dc1c-946a-4d3b-a2e6-2911d181a122` | `SUCCESS`, commit exacto |
| DeliGO Mesa Occupancy Cron | `b53a7760-1635-4c48-90c4-61a66d60f5b0` | `SKIPPED`, sin cambios en watched files |

El build no devolvió errores. En logs de deploy DeliGO Copy, Railway etiquetó
como `error` mensajes que eran el warning `npm warn config production`, el
aviso informativo de actualización de Prisma y la línea normal de comando de
arranque; clasificados `NON_BLOCKING_UNRELATED`. El contenedor informó
`No pending migrations to apply.` y luego `Ready`; no se agregaron ni ejecutaron
migraciones nuevas por R1. No se detectaron exception/fatal/unhandled, bundle
failure, runtime crash ni error PWA bloqueante.

HTTP GET smoke no mutante: **15/15** (`/`, rutas principales Cliente/Negocio/
Repartidor/Operaciones/Admin, ocho manifests y `/sw.js`). Los ocho manifests
respondieron 200 y parsearon como JSON. Esto no equivale a certificación física.

## Estado y siguiente acción

```text
P2_T38_R1_TECHNICAL_GATE=PASS
P2_T38_STATUS=FIXED_TESTED_DEPLOYED_TESTING_AWAITING_RECERTIFICATION
PRIOR_ANDROID_ACCEPT_PHYSICAL=FAIL
PRIOR_FAILURE=PREMATURE_APP_INSTALLED_MESSAGE
APPINSTALLED_AS_LAUNCHER_READY=NO
PREMATURE_SUCCESS_REMOVED=SI
POST_ACCEPT_UX_TRUTHFUL=SI
ANDROID_STATE_NOT_STUCK=SI
ANDROID_RETRY_PRESERVED=SI
IOS_TUTORIAL_REGRESSION=PASS_AUTOMATED_ONLY
T36_BRANDING_REGRESSION=PASS
T40_PUSH_LIFECYCLE_UNTOUCHED=SI
T34_SESSION_ISOLATION_UNTOUCHED=SI
PRISMA_SCHEMA_CHANGED=NO
NEW_MIGRATIONS=0
MANIFEST_FILES_CHANGED=0
SERVICE_WORKER_CHANGED=NO
TESTING_DEPLOY=SUCCESS
TESTING_COMMIT_MATCH=SI
LOG_GATE=PASS
HTTP_SMOKE=PASS
PRODUCTION_TOUCHED=NO
PHYSICAL_RECERTIFICATION_REQUIRED=SI
REPORT_DIR_CANONICAL=C:\Leo Campos\Trabajo\deligo-main-limpio\codex-reports
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_ANDROID_ACCEPT_PHYSICAL_RECERTIFICATION
```

El operador debe probar primero sólo Android — ACCEPT en el dispositivo real.
No iniciar la prueba de cancelación, la certificación iOS ni cerrar T38 antes
de recibir y registrar esa nueva evidencia.

## Adenda — cierre de recertificación física R1 (2026-09-26)

El bloque anterior conserva fielmente el estado y la siguiente acción al
momento de publicar el fix R1; quedó supersedido por el cierre físico posterior
sin borrar ese historial. El operador reportó Android real ACCEPT=PASS,
Android real CANCEL=PASS e iPhone/Safari=PASS. No se informaron modelos ni
versiones de sistema/navegador. El gate de logs disponible no mostró errores
PWA/runtime bloqueantes; los mensajes de npm/Prisma y arranque fueron
clasificados no bloqueantes. Resultado vigente:

```text
P2_T38_R1_IMPLEMENTATION_COMMIT=147f24a39dc6f2df04ca8b5f9d54492864de9460
PRIOR_ANDROID_ACCEPT_PHYSICAL=FAIL (R0; PREMATURE_APP_INSTALLED_MESSAGE; preservado)
ANDROID_ACCEPT_PHYSICAL_RECERTIFICATION=PASS
ANDROID_CANCEL_PHYSICAL_RECERTIFICATION=PASS
IOS_PHYSICAL_CERTIFICATION=PASS
T38_POST_PHYSICAL_LOG_GATE=PASS
P2_T38_PHYSICAL_CERTIFICATION=PASS
P2_T38_FINAL_GATE=PASS
P2_T38_STATUS=CLOSED_TESTING_CERTIFIED
PRODUCTION_TOUCHED=NO
REPORT=codex-reports/P2_T38_R1_PHYSICAL_RECERTIFICATION_CLOSEOUT.md
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_NEXT_PRIORITY_DECISION
```
