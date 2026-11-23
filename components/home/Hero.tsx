import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { LogoMark } from "@/components/brand/Logo";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-navy-900 on-navy" aria-labelledby="hero-title">
      <div className="pointer-events-none absolute -left-40 -top-40 size-[34rem] rounded-full bg-gold-500/10 blur-3xl" aria-hidden="true" />
      <div className="container-page relative grid items-center gap-10 py-14 md:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-24">
        <div>
          <p className="eyebrow">Post a Need. Solve a Need.</p>
          <h1 id="hero-title" className="mt-4 font-display text-[2.6rem] font-extrabold leading-[1.05] text-white sm:text-5xl lg:text-6xl">
            Every Need Deserves a <span className="text-gold-500">Solution.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-on-navy-muted">
            Whether you need a helping hand or have the power to make a difference, SolveANeed connects real people with meaningful solutions.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/get-started?path=need" variant="gold" size="lg">
              I Need Help
            </ButtonLink>
            <ButtonLink href="/get-started?path=help" variant="white" size="lg">
              <LogoMark variant="light" className="h-5 w-6" />
              I Want to Help
            </ButtonLink>
          </div>
          <Link href="/how-it-works" className="mt-6 inline-flex min-h-11 items-center gap-2 font-semibold text-white underline-offset-4 hover:underline">
            See How It Works <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <p className="mt-10 text-sm font-semibold tracking-[0.28em] text-gold-500" aria-label="Give, Earn, Fund, Solve">
            GIVE • EARN • FUND • SOLVE
          </p>
        </div>

        <div className="relative">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] ring-1 ring-white/10 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.6)]">
            <Image
              src="/images/give-support.webp"
              alt="A smiling man sits beside an older woman, his hand on her shoulder, as she places her hands on her heart in gratitude."
              fill
              priority
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover object-[45%_50%]"
            />
          </div>
          <div className="absolute -bottom-5 left-5 right-5 rounded-2xl border border-white/10 bg-navy-950/90 p-4 backdrop-blur sm:left-auto sm:right-6 sm:w-72">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-500">Four ways to help</p>
            <p className="mt-1 text-sm text-white">Give freely, offer paid work, fund milestones or solve directly.</p>
          </div>
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent" aria-hidden="true" />
    </section>
  );
}
