import { BrandMark } from './BrandMark'

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 px-4 py-8 transition-colors duration-300 dark:border-white/10 dark:bg-slate-950 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between dark:text-slate-400">
        <div>
          <BrandMark />
          <p className="mt-1">Modern operations platform for academies.</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <a
            href="#features"
            className="transition hover:text-slate-900 dark:hover:text-slate-200"
          >
            Features
          </a>
          <a
            href="#book-demo"
            className="transition hover:text-slate-900 dark:hover:text-slate-200"
          >
            Book Demo
          </a>
          <a
            href="mailto:pratik@edigo.in"
            className="transition hover:text-slate-900 dark:hover:text-slate-200"
          >
            pratik@edigo.in
          </a>
        </div>
      </div>
    </footer>
  );
}
