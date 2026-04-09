export function ComingSoonPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <img
        src="https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&w=2200&q=80"
        alt="Students in a classroom"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-slate-950/75" />
      <div className="absolute inset-0 bg-linear-to-b from-slate-900/40 via-slate-900/70 to-slate-950/90" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-6 py-16 text-center">
        <span className="mb-6 inline-flex items-center rounded-full border border-teal-300/30 bg-teal-400/10 px-4 py-1 text-sm font-medium tracking-wide text-teal-200 backdrop-blur">
          Edigo
        </span>

        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          Coming Soon
        </h1>

        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
          Edigo is building a simpler way for institutes to manage student
          records, attendance, and fee collection in one place.
        </p>

        <p className="mt-3 text-sm text-slate-400 sm:text-base">
          We are preparing the experience. Launching shortly.
        </p>

        <div className="mt-10 w-full max-w-lg rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
          <p className="text-sm text-slate-300">
            Want early access for your school or academy?
          </p>
          <a
            href="mailto:pratik@edigo.in"
            className="mt-2 inline-block text-base font-semibold text-teal-300 transition hover:text-teal-200"
          >
            pratik@edigo.in
          </a>
        </div>
      </div>
    </main>
  );
}
