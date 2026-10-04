import { AdvertisementSection } from '@/features/home/sections/AdvertisementSection'
import { BenefitsSection } from '@/features/home/sections/BenefitsSection'
import { CtaBanner } from '@/components/shared/CtaBanner'
import { HeroSection } from '@/features/home/sections/HeroSection'
import { HowItWorksSection } from '@/features/home/sections/HowItWorksSection'
import { QuickActionsSection } from '@/features/home/sections/QuickActionsSection'
import { ServicesSection } from '@/features/home/sections/ServicesSection'
import { TestimonialsSection } from '@/features/home/sections/TestimonialsSection'
import { WhyChooseUsSection } from '@/features/home/sections/WhyChooseUsSection'

export function HomePage() {
  return (
    <>
      <HeroSection />
      <BenefitsSection />
      <QuickActionsSection />
      <ServicesSection />
      <HowItWorksSection />
      <AdvertisementSection />
      <WhyChooseUsSection />
      <TestimonialsSection />
      <CtaBanner />
    </>
  )
}
