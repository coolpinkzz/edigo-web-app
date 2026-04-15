import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import { GradientText } from './GradientText'

const benefits = [
  'Save admin hours spent on manual reconciliation and follow-ups.',
  'Reduce billing and attendance errors through consistent workflows.',
  'Get clear visibility into dues, collections, and operational health.',
]

export function BenefitsSection() {
  return (
    <section
      id="benefits"
      className="bg-slate-50 px-4 py-16 transition-colors duration-300 dark:bg-slate-950 sm:px-6 sm:py-20"
    >
      <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.45 }}
        >
          <p className="text-sm font-medium text-teal-700 dark:text-teal-300">Why Edigo</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Built for <GradientText>operational clarity</GradientText> and{' '}
            <GradientText>reliable growth</GradientText>
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
            Replace disconnected tools with one platform your admin and
            operations team can trust every day.
          </p>
        </motion.div>

        <motion.ul
          initial={{ opacity: 0, x: 24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="space-y-3 rounded-2xl border border-slate-200 bg-white/80 p-6 transition-colors dark:border-white/10 dark:bg-white/5"
        >
          {benefits.map((benefit) => (
            <li key={benefit} className="flex items-start gap-3">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-teal-600 dark:text-teal-300" />
              <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">{benefit}</p>
            </li>
          ))}
        </motion.ul>
      </div>
    </section>
  )
}
