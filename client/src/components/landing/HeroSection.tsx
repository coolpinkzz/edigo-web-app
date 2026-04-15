import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { InstallmentTrendMiniChart } from "./InstallmentTrendMiniChart";
import { GradientText } from "./GradientText";
import { Button } from "../ui/Button";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-slate-50 px-4 pb-16 pt-14 transition-colors duration-300 dark:border-white/10 dark:bg-slate-950 sm:px-6 sm:pb-20 sm:pt-20">
      <div className="absolute left-1/2 top-0 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-teal-400/20 blur-3xl dark:bg-teal-400/15" />
      <div className="absolute right-0 top-20 h-[280px] w-[280px] rounded-full bg-cyan-400/15 blur-3xl dark:bg-cyan-400/10" />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="inline-flex items-center rounded-full border border-teal-600/25 bg-teal-500/10 px-3 py-1 text-xs font-medium tracking-wide text-teal-800 dark:border-teal-300/30 dark:bg-teal-400/10 dark:text-teal-200">
            Academy Operations, Simplified
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl dark:text-white">
            All-in-One <GradientText>Institute Management</GradientText>{" "}
            Software
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg dark:text-slate-300">
            Edigo helps institutes automate{" "}
            <GradientText>fee installments</GradientText>, track attendance in{" "}
            <GradientText>real-time</GradientText>, and gain complete admin
            visibility — without spreadsheets.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#book-demo">
              <Button className="h-11 px-6 text-sm">
                Book a Free Demo
                <ArrowRight size={16} className="ml-2" />
              </Button>
            </a>
            <a
              href="#features"
              className="inline-flex h-11 items-center rounded-lg border border-slate-300 px-6 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-white/20 dark:text-slate-200 dark:hover:border-white/40 dark:hover:text-white"
            >
              Explore Features
            </a>
          </div>

          <div className="mt-6 inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <ShieldCheck
              size={16}
              className="text-teal-600 dark:text-teal-300"
            />
            Trusted by growing academies and coaching centers
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-2xl shadow-slate-900/10 backdrop-blur transition-colors duration-300 dark:border-white/15 dark:bg-white/10 dark:shadow-slate-950/40"
        >
          <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-4 dark:border-white/10 dark:bg-slate-950/70">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                Revenue Snapshot
              </p>
              <span className="rounded-md bg-teal-500/15 px-2 py-1 text-xs text-teal-800 dark:bg-teal-400/15 dark:text-teal-200">
                This Month
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900/70">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Collected
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                  INR 8.4L
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900/70">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pending
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                  INR 1.2L
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900/70">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Attendance
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                  92%
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900/70">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Installment Collection Trend
              </p>
              <div className="mt-2 min-h-30 w-full min-w-0">
                <InstallmentTrendMiniChart height={120} />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
