import { motion } from 'framer-motion'
import { InstallmentTrendMiniChart } from './InstallmentTrendMiniChart'
import { GradientText } from './GradientText'

export function DashboardPreviewSection() {
  return (
    <section className="bg-slate-100/80 px-4 py-16 transition-colors duration-300 dark:bg-slate-900/70 sm:px-6 sm:py-20">
      <div className="mx-auto w-full max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.45 }}
          className="max-w-2xl"
        >
          <p className="text-sm font-medium text-teal-700 dark:text-teal-300">Dashboard preview</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            <GradientText>Real-time</GradientText> view of every key metric
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-10 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-2xl shadow-slate-900/10 transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/70 dark:shadow-slate-950/40 sm:p-6"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Total Students', '1,284'],
              ['Collected This Month', 'INR 8.4L'],
              ['Pending Installments', '312'],
              ['Attendance Rate', '92%'],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg border border-slate-200 bg-slate-50/90 p-4 transition-colors dark:border-white/10 dark:bg-white/5"
              >
                <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-4 transition-colors dark:border-white/10 dark:bg-white/5">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Collections Trend</p>
              <div className="mt-3 min-h-36 w-full min-w-0">
                <InstallmentTrendMiniChart height={144} />
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-4 transition-colors dark:border-white/10 dark:bg-white/5">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Recent Dues</p>
              <div className="mt-3 space-y-2">
                {['Grade 8 Batch A', 'Grade 10 Evening', 'Commerce 12 Weekend'].map(
                  (item) => (
                    <div
                      key={item}
                      className="flex items-center justify-between rounded-md border border-transparent bg-white px-3 py-2 text-xs text-slate-600 dark:border-white/5 dark:bg-slate-900/70 dark:text-slate-300"
                    >
                      <span>{item}</span>
                      <span>INR 24k</span>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
