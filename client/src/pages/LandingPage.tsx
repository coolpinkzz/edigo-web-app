import { useEffect } from 'react'
import { BenefitsSection } from '../components/landing/BenefitsSection'
import { CTASection } from '../components/landing/CTASection'
import { DashboardPreviewSection } from '../components/landing/DashboardPreviewSection'
import { FeaturesSection } from '../components/landing/FeaturesSection'
import { Footer } from '../components/landing/Footer'
import { HeroSection } from '../components/landing/HeroSection'
import { HowItWorksSection } from '../components/landing/HowItWorksSection'
import { Navbar } from '../components/landing/Navbar'
import { PricingSection } from '../components/landing/PricingSection'
import { TestimonialsSection } from '../components/landing/TestimonialsSection'
import { env } from '../constants/env'

const GTAG_SRC = 'https://www.googletagmanager.com/gtag/js'

export function LandingPage() {
  useEffect(() => {
    const id = env.gaMeasurementId
    if (!id) return

    window.dataLayer = window.dataLayer ?? []
    if (!window.gtag) {
      window.gtag = function gtag(...args: unknown[]) {
        window.dataLayer!.push(args)
      }
    }

    let script = document.querySelector<HTMLScriptElement>(
      `script[src^="${GTAG_SRC}"]`,
    )
    if (!script) {
      script = document.createElement('script')
      script.async = true
      script.src = `${GTAG_SRC}?id=${encodeURIComponent(id)}`
      document.head.appendChild(script)
    }

    window.gtag('js', new Date())
    window.gtag('config', id, {
      page_path: window.location.pathname + window.location.search,
    })
  }, [])

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-white">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <BenefitsSection />
      <DashboardPreviewSection />
      <PricingSection />
      <TestimonialsSection />
      <CTASection />
      <Footer />
    </main>
  )
}
