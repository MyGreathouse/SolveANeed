import Image from "next/image";
import { ButtonLink } from "@/components/ui/Button";

export function FinalCta() {
  return (
    <section aria-labelledby="final-cta-title" className="bg-white py-16 md:py-24">
      <div className="container-page">
        <div className="relative grid overflow-hidden rounded-[2rem] bg-navy-900 on-navy lg:grid-cols-2">
          <div className="relative z-10 p-8 md:p-14">
            <p className="eyebrow">Post a Need. Solve a Need.</p>
            <h2 id="final-cta-title" className="mt-3 text-3xl font-extrabold text-white md:text-4xl">
              Your first step takes two minutes.
            </h2>
            <p className="mt-4 max-w-md text-lg text-on-navy-muted">
              Join a community where every need is taken seriously and every offer of help is clear and fair.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/get-started?path=need" variant="gold" size="lg">I Need Help</ButtonLink>
              <ButtonLink href="/get-started?path=help" variant="outline-light" size="lg">I Want to Help</ButtonLink>
            </div>
          </div>
          <div className="relative min-h-64 lg:min-h-full">
            <Image
              src="/images/mobile-onboarding.webp"
              alt="A woman smiles while using the SolveANeed app on her phone in a café."
              fill
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-cover object-[25%_50%]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-navy-900 via-navy-900/10 to-transparent lg:via-transparent" aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
}
