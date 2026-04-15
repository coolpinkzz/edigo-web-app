import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import { GradientText } from './GradientText'
import { Button } from '../ui/Button'

const included = [
  'Fee collection module — templates, installments, and dues tracking',
  'Payment reminders — automated follow-ups for pending fees',
  'Attendance with SMS — daily marks and parent SMS alerts',
  'Admin dashboard — collections, attendance, and operational overview',
  'Role-based access — secure permissions for staff and admins',
]

export function PricingSection() {
  return (
    <section
      id="pricing"
      className="bg-slate-50 px-4 py-16 transition-colors duration-300 dark:bg-slate-950 sm:px-6 sm:py-20"
    >
      <div className="mx-auto w-full max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.45 }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="text-sm font-medium text-teal-700 dark:text-teal-300">Pricing</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            <GradientText>One plan</GradientText>. <GradientText>Every feature</GradientText>.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">
            Everything your academy needs to collect fees, remind parents, track
            attendance, and run operations from one place.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.45, delay: 0.08 }}
          className="mx-auto mt-12 max-w-lg"
        >
          <div className="relative overflow-hidden rounded-2xl border border-teal-500/20 bg-linear-to-b from-teal-500/10 to-white/80 p-1 shadow-[0_0_40px_-12px_rgba(45,212,191,0.25)] dark:border-teal-400/30 dark:from-teal-400/10 dark:to-white/5 dark:shadow-[0_0_40px_-12px_rgba(45,212,191,0.35)]">
            <div className="rounded-[0.9rem] border border-slate-200 bg-white/95 p-6 transition-colors dark:border-white/10 dark:bg-slate-950/90 sm:p-8">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Complete suite</p>
                  <p className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
                      ₹999
                    </span>
                    <span className="text-base text-slate-500 dark:text-slate-400">/ month</span>
                  </p>
                </div>
                <p className="text-xs text-slate-500 sm:text-right dark:text-slate-500">
                  Per institute · cancel anytime
                </p>
              </div>

              <ul className="mt-8 space-y-3 border-t border-slate-200 pt-8 dark:border-white/10">
                {included.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-left">
                    <CheckCircle2
                      size={18}
                      className="mt-0.5 shrink-0 text-teal-600 dark:text-teal-300"
                      aria-hidden
                    />
                    <span className="text-sm leading-6 text-slate-700 dark:text-slate-200">{item}</span>
                  </li>
                ))}
              </ul>

              <a href="#book-demo" className="mt-8 block">
                <Button className="h-11 w-full">Book a free demo</Button>
              </a>
              <p className="mt-3 text-center text-xs text-slate-500">
                Prefer to talk first? We will walk you through setup and pricing.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
