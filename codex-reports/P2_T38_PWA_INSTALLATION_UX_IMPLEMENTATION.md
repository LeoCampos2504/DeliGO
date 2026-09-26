# P2-T38 — PWA Installation UX — Implementación en TESTING

**Fecha:** 2026-09-26
**Estado:** `IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_PHYSICAL_CERTIFICATION`
**Entorno:** TESTING únicamente. No se realizó certificación física.

## Resultado y markers

```text
P2_T38_IMPLEMENTATION_GATE=PASS
P2_T38_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_PHYSICAL_CERTIFICATION
IMPLEMENTATION_COMMIT_SHA=5dc91a21d5525d5e2e9ed0c83243c7cbcc620067
DOCUMENTATION_COMMIT=SEPARATE_DOCUMENTATION_COMMIT (SHA recorded in Git history)
FILES_CHANGED=5 (fileset T38 autorizado)
T38_FILES_ONLY=SI
T38_ANDROID_BACKGROUND_STATE_IMPLEMENTED=SI
T38_ANDROID_FALSE_SUCCESS_PREVENTED=SI
T38_ANDROID_RETRY_STATE_COHERENT=SI
T38_IOS_GUIDED_TUTORIAL_IMPLEMENTED=SI
T38_IPADOS_DETECTION_ALIGNED=SI
T38_MOZO_EXCLUSION_PRESERVED=SI
T38_LEGACY_ES_EXCLUSION_PRESERVED=SI
T36_BRANDING_REGRESSION=PASS
T40_PUSH_LIFECYCLE_UNTOUCHED=SI
T34_SESSION_ISOLATION_UNTOUCHED=SI
PRISMA_SCHEMA_CHANGED=NO
NEW_MIGRATIONS=0
MANIFEST_FILES_CHANGED=0
SERVICE_WORKER_CHANGED=NO
SECRET_LEAK=NO
NEW_PII_LOGGING=NO
TESTING_DEPLOY=SUCCESS
TESTING_COMMIT_MATCH=SI
LOG_GATE=PASS
HTTP_SMOKE=PASS
PRODUCTION_TOUCHED=NO
PHYSICAL_CERTIFICATION_REQUIRED=SI
REPORT_DIR_CANONICAL=C:\Leo Campos\Trabajo\deligo-main-limpio\codex-reports
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_P2_T38_PHYSICAL_CERTIFICATION
```

El cambio está publicado en `origin/testing-codex`. La implementación distingue
aceptación del diálogo nativo de instalación confirmada; Android muestra un
estado indeterminado hasta la señal `appinstalled`. En iOS/iPadOS se agregó una
guía visual paso a paso, con instrucciones Safari diferenciadas de otros
navegadores. Se reutiliza `getPwaCapabilities()` para la detección de plataforma,
Safari y standalone. No se agregó persistencia de instalación ni se cambió la
identidad PWA.

## Baseline y commits

- Se verificó la rama `work/p2-t38-installation-ux`, worktree limpio, HEAD
  `cf46781ffc999024b19063a8ed9ab34a1557b92c`, `origin/testing-codex` en
  `33923c36e1bdab8dcc70dd66fc0d28524c9db790`, `ahead=0/behind=1`. El único
  commit pendiente era la reconciliación documental autorizada, con cambios
  únicamente en `CODEX_REPORT.md` y `DELIGO_FULL_CONTEXT_LATEST.md`.
- Se aplicó `git merge --ff-only origin/testing-codex`. El worktree quedó limpio,
  HEAD igual al remoto y `ahead=0/behind=0` antes de implementar.
- Commit funcional: `5dc91a21d5525d5e2e9ed0c83243c7cbcc620067`,
  `feat: improve PWA installation guidance`.
- Push no-forzado a `origin/testing-codex`, fast-forward desde
  `33923c36e1bdab8dcc70dd66fc0d28524c9db790`. El preflight inmediatamente
  anterior confirmó que remoto no había avanzado y que el commit contenía
  exactamente los cinco archivos enumerados abajo. `origin/main` permaneció en
  `42ca5005d2ecd412de87e454b52820f38aaec5c0`.

## Fileset y auditoría

```text
src/hooks/use-install-prompt.ts
src/components/shared/install-prompt.tsx
src/lib/android-install-status-static-contract.test.ts
src/lib/pwa-install-state.ts
src/lib/pwa-install-state.test.ts
```

- `git diff --check`: PASS; ESLint sobre los cinco archivos modificados: PASS.
- No se modificaron otros archivos de producto o tests. `src/components/shared/install-prompt.test.ts` se ejecutó como regresión y quedó sin cambios.
- `PRISMA_SCHEMA_CHANGED=NO`; `NEW_MIGRATIONS=0`; no cambiaron manifests,
  service worker, branding, DynamicManifest, auth, Push, session lifecycle,
  APIs ni backend.
- El commit no agrega logging de UA ni logging PII. Revisión del diff de
  credenciales/patrones sensibles: sin secretos agregados.
- La implementación no ejecutó comandos directos contra la DB. El servicio
  DeliGO Copy ya tiene configurado en Railway el predeploy automático
  `npx prisma migrate deploy --schema prisma/schema.prisma`; fue parte del
  autodeploy autorizado por esta tarea. Este commit no incorpora schema ni
  migraciones.

## Validación

### Tests

- Focal T38 + exclusiones `/mozo`, `/e`, `/s`: **38 pass, 0 fail** en 3 archivos.
- Regresión de identidad y scope PWA, branding/íconos T36, service-worker
  routing y contrato Push/session: **58 pass, 0 fail** en 5 archivos.
- También se lanzó por error un contrato adicional de atomicidad de login T34;
  una aserción falló en el orden de `setCookie` respecto de la transacción. El
  test y su archivo no fueron modificados y están fuera de T38. Se excluyó de la
  cifra de regresión T38/T36/T40 anterior; no se intentó arreglarlo.

### Typecheck y build

- `bunx tsc --noEmit`: **FAIL global del repositorio** por errores en archivos
  ajenos no modificados (entre ellos `prisma/seed.ts`, migración SQLite/Postgres,
  rutas de denuncias/Mozo, formularios y auth). El filtro sobre el fileset T38 y
  `pwa-capabilities.ts` no encontró diagnósticos T38. No se exigió cero errores
  globales ni se editaron esas áreas.
- `bun run build`: **PASS**. Prisma Client se generó localmente; Next compiló,
  generó 158 páginas y completó el empaquetado standalone. Next informó que
  omite su validación de tipos, por eso el typecheck separado se reporta arriba.
- ESLint: **PASS**. `git diff --check`: **PASS**.

## TESTING deploy y logs

Todos los estados son del commit `5dc91a21d5525d5e2e9ed0c83243c7cbcc620067`:

| Servicio | Deployment | Estado |
|---|---|---|
| DeliGO Copy | `aad919b1-08cf-41ad-891b-9b159b64e948` | `SUCCESS` |
| chat en vivo | `b1f94e5d-efaa-4c6f-b660-2e726b2dbd88` | `SUCCESS` |
| Review Moderation Expiry | `590ef7c9-bfef-4a6a-b7e4-a141e2ad8938` | `SUCCESS` |
| DeliGO Mesa Occupancy Cron | `f9522ad4-15b7-4df3-94a2-37c7493eafbe` | `SKIPPED` — sin cambios en watched files |

Se revisaron logs de build, deployment y runtime disponibles de los servicios
relevantes. No hubo exception, unhandled error, crash, build failure, ni error de
manifest/service worker/bundle. DeliGO Copy tuvo 12 registros etiquetados como
`error` en la salida de deployment; al inspeccionarlos, eran avisos npm, aviso
de actualización de Prisma y salida normal del comando de arranque, no fallas
operativas. Se clasifican `NON_BLOCKING_UNRELATED`. Builds de DeliGO Copy y
Review Moderation Expiry no mostraron niveles de error; chat en vivo no mostró
errores.

## HTTP smoke no mutante

GET al dominio TESTING `https://deligo-copy-production.up.railway.app` después
del SUCCESS de DeliGO Copy. **15/15 respondieron HTTP 200**; los manifests
también parsearon como JSON:

```text
/, /cliente, /negocio, /repartidor, /operaciones, /admin
/manifest-cliente.json, /manifest-negocio.json, /manifest-repartidor.json
/manifest-operaciones.json, /manifest-admin.json, /manifest-mozo.json
/manifest-empleado.json, /manifest-salon.json, /sw.js
```

## Checklist de certificación física pendiente

**Android real — aceptar:** PWA no instalada; abrir prompt y aceptar; verificar
“Terminando la instalación…” sin porcentaje ni afirmación prematura; esperar la
confirmación del navegador; abrir desde launcher.

**Android real — cancelar:** abrir prompt y cancelar; verificar que no confirme
instalación ni deje spinner eterno; comprobar que un nuevo evento del navegador
permite reintentar.

**iPhone/iPad real — Safari:** abrir tutorial en navegador, recorrer opciones →
Compartir → Ver más si corresponde → Agregar a pantalla de inicio → confirmar;
abrir desde icono y verificar que standalone no muestre la guía. Registrar
versiones de iOS/Safari y variaciones observadas. No asumir orden universal.

La certificación debe realizarla el operador. Este agente no la inició; T38 no
está cerrado ni promovido a Production.
