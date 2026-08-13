// OBSERVABILITY + LOAD/PERFORMANCE CERTIFICATION — handleSummary compartido
// ============================================
// Reemplaza `--summary-export` (diseño anterior, corregido en Fase A) por
// `handleSummary(data)` — control total del contenido de cada artifact, en
// un solo lugar, lo que permite centralizar el secret-scrubbing: ninguno de
// estos archivos referencia jamás un token/password/DB URL (los scripts de
// esta carpeta nunca los tienen en memoria para empezar — sólo el índice de
// identidad, nunca el secreto).

function extractThresholdVerdict(data) {
  const verdict = {}
  const metrics = data.metrics || {}
  for (const [name, metric] of Object.entries(metrics)) {
    if (metric && metric.thresholds) {
      for (const [expr, result] of Object.entries(metric.thresholds)) {
        verdict[`${name}{${expr}}`] = { ok: result.ok !== false }
      }
    }
  }
  return verdict
}

function allThresholdsPassed(verdict) {
  return Object.values(verdict).every((entry) => entry.ok)
}

function fmt(value) {
  return typeof value === "number" ? value.toFixed(2) : String(value)
}

function buildHumanReport(data, meta) {
  const metrics = data.metrics || {}
  const verdict = extractThresholdVerdict(data)
  const lines = []
  lines.push(`# LoadCert — ${meta.scenario}`)
  lines.push("")
  lines.push(`- runId: ${meta.runId}`)
  lines.push(`- target: ${meta.targetUrl}`)
  lines.push(`- commit: ${meta.commitHash}`)
  lines.push(`- durationMs: ${data.state ? data.state.testRunDurationMs : "unknown"}`)
  lines.push("")
  lines.push("## Thresholds")
  for (const [name, entry] of Object.entries(verdict)) {
    lines.push(`- ${entry.ok ? "PASS" : "FAIL"} — ${name}`)
  }
  lines.push(`- ALL_THRESHOLDS_PASS=${allThresholdsPassed(verdict) ? "SI" : "NO"}`)
  lines.push("")
  lines.push("## Key metrics")
  if (metrics.http_reqs) lines.push(`- requests total: ${metrics.http_reqs.values.count}`)
  if (metrics.iterations) lines.push(`- iterations: ${metrics.iterations.values.count}`)
  if (metrics.http_req_failed) lines.push(`- http_req_failed rate: ${fmt(metrics.http_req_failed.values.rate)}`)
  if (metrics.checks) lines.push(`- checks rate: ${fmt(metrics.checks.values.rate)}`)
  if (metrics.http_req_duration) {
    // k6 llama "med" al p50 por defecto (no "p(50)") — summaryTrendStats en
    // options.js de cada escenario agrega explícitamente p(99), que no
    // viene en el set por defecto (avg/min/med/max/p(90)/p(95)).
    const d = metrics.http_req_duration.values
    lines.push(`- http_req_duration p50/p95/p99: ${fmt(d["med"])}ms / ${fmt(d["p(95)"])}ms / ${fmt(d["p(99)"])}ms`)
  }
  lines.push("")
  lines.push("(Ver summary.json para el detalle completo por métrica/tag.)")
  return lines.join("\n") + "\n"
}

/**
 * meta = { runId, scenario, targetUrl, commitHash, resultsDir }
 * resultsDir DEBE ser una ruta absoluta (pasada por el runner vía env var) —
 * handleSummary() puede escribir a rutas absolutas o relativas; se usa
 * absoluta para no depender del cwd del proceso k6.
 */
export function buildSummaryOutputs(data, meta) {
  const verdict = extractThresholdVerdict(data)
  const humanReport = buildHumanReport(data, meta)
  const base = meta.resultsDir.replace(/[\\/]+$/, "")
  return {
    stdout: humanReport,
    [`${base}/summary.json`]: JSON.stringify(data, null, 2),
    [`${base}/threshold-verdict.json`]: JSON.stringify(
      { allPass: allThresholdsPassed(verdict), thresholds: verdict },
      null,
      2
    ),
    [`${base}/human-report.md`]: humanReport,
  }
}
