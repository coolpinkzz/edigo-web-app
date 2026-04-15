import { motion } from 'framer-motion'
import { ClipboardList, MonitorCheck, UserPlus, WalletCards } from 'lucide-react'
import { GradientText } from './GradientText'

const steps = [
  {
    title: 'Set up your academy',
    description:
      'Create your institute profile, teams, and fee templates in a guided setup.',
    icon: UserPlus,
  },
  {
    title: 'Configure fee plans',
    description:
      'Define installments, due dates, and reminders based on classes or batches.',
    icon: WalletCards,
  },
  {
    title: 'Track daily operations',
    description:
      'Mark attendance, monitor due payments, and keep student records up to date.',
    icon: ClipboardList,
  },
  {
    title: 'Monitor dashboards',
    description:
      'Use real-time reports to improve collection performance and reduce leakages.',
    icon: MonitorCheck,
  },
]

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="border-y border-slate-200 bg-slate-100/80 px-4 py-16 transition-colors duration-300 dark:border-white/10 dark:bg-slate-900/70 sm:px-6 sm:py-20"
    >
      <div className="mx-auto w-full max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.45 }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="text-sm font-medium text-teal-700 dark:text-teal-300">How it works</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Launch in <GradientText>days</GradientText>, not <GradientText>months</GradientText>
          </h2>
        </motion.div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon

            return (
              <motion.article
                key={step.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.35, delay: index * 0.08 }}
                className="rounded-xl border border-slate-200 bg-white/90 p-5 transition-colors dark:border-white/10 dark:bg-slate-950/60"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex rounded-lg bg-white/80 p-2 text-teal-800 dark:bg-white/10 dark:text-teal-200">
                    <Icon size={18} />
                  </span>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Step {index + 1}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {step.description}
                </p>
              </motion.article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
