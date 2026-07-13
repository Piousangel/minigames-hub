export function ProsePage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">{title}</h1>
      <div className="space-y-4 leading-relaxed text-fg-muted [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-fg">
        {children}
      </div>
    </main>
  )
}
