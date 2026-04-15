import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import axios from 'axios'
import { motion } from 'framer-motion'
import { bookDemoRequest } from '../../api'
import { GradientText } from './GradientText'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

type FormState = {
  name: string
  phone: string
  email: string
}

const initialFormState: FormState = {
  name: '',
  phone: '',
  email: '',
}

export function CTASection() {
  const [form, setForm] = useState<FormState>(initialFormState)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const updateField = useCallback(
    (key: keyof FormState, value: string) => {
      setIsSubmitted(false)
      setForm((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      await bookDemoRequest({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
      })
      setIsSubmitted(true)
      setForm(initialFormState)
    } catch (err: unknown) {
      let message = 'Something went wrong. Please try again.'
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as { error?: string } | undefined
        if (data?.error) {
          message = data.error
        } else if (err.code === 'ERR_NETWORK') {
          message = 'Could not reach the server. Check your connection and try again.'
        }
      }
      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section
      id="book-demo"
      className="bg-slate-100/90 px-4 py-16 transition-colors duration-300 dark:bg-slate-900/80 sm:px-6 sm:py-20"
    >
      <div className="mx-auto grid w-full max-w-6xl gap-8 rounded-2xl border border-slate-200 bg-white/90 p-6 transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/80 sm:p-8 lg:grid-cols-[1.1fr_1fr]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.45 }}
        >
          <p className="text-sm font-medium text-teal-700 dark:text-teal-300">Book your walkthrough</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            See <GradientText>Edigo in action</GradientText> for your institute
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600 sm:text-base dark:text-slate-300">
            Share your details and our team will schedule a personalized demo to
            show how Edigo fits your fee and student workflows.
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          onSubmit={onSubmit}
          className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/90 p-4 transition-colors dark:border-white/10 dark:bg-white/5 sm:p-5"
        >
          <Input
            required
            value={form.name}
            onChange={(event) => updateField('name', event.target.value)}
            placeholder="Full name"
            className="h-11 border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 dark:border-white/15 dark:bg-slate-950/70 dark:text-white dark:placeholder:text-slate-400"
          />
          <Input
            required
            value={form.phone}
            onChange={(event) => updateField('phone', event.target.value)}
            type="tel"
            placeholder="Phone number"
            className="h-11 border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 dark:border-white/15 dark:bg-slate-950/70 dark:text-white dark:placeholder:text-slate-400"
          />
          <Input
            required
            value={form.email}
            onChange={(event) => updateField('email', event.target.value)}
            type="email"
            placeholder="Work email"
            className="h-11 border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 dark:border-white/15 dark:bg-slate-950/70 dark:text-white dark:placeholder:text-slate-400"
          />
          <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Sending…' : 'Book a Free Demo'}
          </Button>
          {submitError ? (
            <p className="text-xs text-red-600 dark:text-red-300" role="alert">
              {submitError}
            </p>
          ) : null}
          {isSubmitted ? (
            <p className="text-xs text-teal-800 dark:text-teal-200">
              Thanks! We will reach out soon to schedule your demo.
            </p>
          ) : null}
        </motion.form>
      </div>
    </section>
  )
}
