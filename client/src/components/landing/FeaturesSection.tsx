import { motion } from 'framer-motion'
import { BarChart3, CalendarCheck2, CreditCard, Users2 } from 'lucide-react'
import { GradientText } from './GradientText'

const features = [
  {
    title: 'Fee Management',
    description:
      'Design flexible templates, split payments into installments, and track dues in real time.',
    icon: CreditCard,
  },
  {
    title: 'Attendance Dashboard',
    description:
      'Capture attendance daily, monitor class-level patterns with clean visual summaries, and send SMS alerts to parents when a student is marked absent.',
    icon: CalendarCheck2,
  },
  {
    title: 'Student Lifecycle',
    description:
      'Manage student onboarding, updates, records, and history from a single profile.',
    icon: Users2,
  },
  {
    title: 'Admin Reports',
    description:
      'Get insights on collections, pending payments, and operations to make faster decisions.',
    icon: BarChart3,
  },
]

export function FeaturesSection() {
  return (
    <section
      id="features"
      className="bg-slate-50 px-4 py-16 transition-colors duration-300 dark:bg-slate-950 sm:px-6 sm:py-20"
    >
      <div className="mx-auto w-full max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.45 }}
          className="max-w-2xl"
        >
          <p className="text-sm font-medium text-teal-700 dark:text-teal-300">Core capabilities</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            <GradientText>Everything you need</GradientText> to run{' '}
            <GradientText>academy operations</GradientText> smoothly
          </h2>
        </motion.div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {features.map((feature, index) => {
            const Icon = feature.icon

            return (
              <motion.article
                key={feature.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.35, delay: index * 0.08 }}
                className="rounded-2xl border border-slate-200 bg-white/80 p-6 backdrop-blur-sm transition-colors dark:border-white/10 dark:bg-white/5"
              >
                <div className="mb-4 inline-flex rounded-lg bg-teal-500/15 p-2 text-teal-800 dark:bg-teal-400/15 dark:text-teal-200">
                  <Icon size={20} />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {feature.description}
                </p>
              </motion.article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
