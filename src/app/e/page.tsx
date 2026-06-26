export default function EmpleadoNoTokenPage() {
  return (
    <main className="min-h-dvh bg-background flex items-center justify-center px-6 py-10">
      <section className="w-full max-w-sm rounded-2xl border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-100 text-2xl">
          E
        </div>
        <h1 className="text-xl font-extrabold text-foreground">Abrí nuevamente tu link de acceso</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          La app de empleados no guarda tu token de acceso. Para entrar al panel, abrí el link compartido por el negocio.
        </p>
        <a
          href="/cliente/"
          className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-cyan-600 px-4 text-sm font-bold text-white transition-colors hover:bg-cyan-700"
        >
          Ir al inicio
        </a>
      </section>
    </main>
  )
}
