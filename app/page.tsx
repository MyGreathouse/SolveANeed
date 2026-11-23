import { Hero } from "@/components/home/Hero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { FourWays } from "@/components/home/FourWays";
import { ExploreNeeds } from "@/components/home/ExploreNeeds";
import { GiveOrEarn } from "@/components/home/GiveOrEarn";
import { TrustSafety } from "@/components/home/TrustSafety";
import { BusinessPartnerships } from "@/components/home/BusinessPartnerships";
import { Faq, FAQS } from "@/components/home/Faq";
import { FinalCta } from "@/components/home/FinalCta";

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

export default function HomePage() {
  return (
    <main>
      <Hero />
      <HowItWorks />
      <FourWays />
      <ExploreNeeds />
      <GiveOrEarn />
      <TrustSafety />
      <BusinessPartnerships />
      <Faq />
      <FinalCta />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }} />
    </main>
  );
}
