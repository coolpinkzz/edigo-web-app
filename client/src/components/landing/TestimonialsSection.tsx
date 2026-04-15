import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { GradientText } from "./GradientText";

const testimonials = [
  {
    quote:
      "Edigo helped us structure installment collections and cut follow-up time by half.",
    name: "Ashish Johnson",
    role: "Founder, Johnson's Academy",
  },
  {
    quote:
      "Attendance and fees are finally in one place. Our admin team has far more clarity.",
    name: "Naveen Yadav",
    role: "Admin and Computer Teacher, NVM Public School",
  },
];

const trustIndicators = [
  "Fast onboarding",
  "Role-based access",
  "Audit-friendly records",
];

export function TestimonialsSection() {
  return (
    <section
      id="testimonials"
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
          <p className="text-sm font-medium text-teal-700 dark:text-teal-300">
            Trust and credibility
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Built for teams who care about <GradientText>reliability</GradientText>
          </h2>
        </motion.div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {testimonials.map((item, index) => (
            <motion.figure
              key={item.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.35, delay: index * 0.08 }}
              className="rounded-2xl border border-slate-200 bg-white/80 p-6 transition-colors dark:border-white/10 dark:bg-white/5"
            >
              <div
                className="mb-4 flex gap-0.5"
                aria-label="Rated 5 out of 5 stars"
              >
                {Array.from({ length: 5 }).map((_, starIndex) => (
                  <Star
                    key={starIndex}
                    size={18}
                    className="shrink-0 fill-amber-400 text-amber-400 dark:fill-amber-400/90 dark:text-amber-400/90"
                    aria-hidden
                  />
                ))}
              </div>
              <blockquote className="text-sm leading-7 text-slate-700 dark:text-slate-200">
                "{item.quote}"
              </blockquote>
              <figcaption className="mt-4">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {item.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {item.role}
                </p>
              </figcaption>
            </motion.figure>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {trustIndicators.map((item) => (
            <span
              key={item}
              className="rounded-full border border-slate-200 bg-slate-100/80 px-3 py-1 text-xs text-slate-600 transition-colors dark:border-white/15 dark:bg-white/5 dark:text-slate-300"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
