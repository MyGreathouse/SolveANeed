import Image from "next/image";
import { LogoMark } from "@/components/brand/Logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 items-stretch bg-soft">
      <div className="container-page grid flex-1 gap-10 py-10 md:py-16 lg:grid-cols-[1fr_1.05fr] lg:items-center">
        <section className="order-2 lg:order-1">
          <div className="card mx-auto w-full max-w-lg p-6 sm:p-9">{children}</div>
        </section>
        <aside className="relative order-1 hidden overflow-hidden rounded-[2rem] bg-navy-900 lg:order-2 lg:block lg:min-h-[36rem] on-navy" aria-hidden="true">
          <Image
            src="/images/mobile-onboarding-v2.webp"
            alt=""
            fill
            sizes="(min-width: 1024px) 50vw, 0px"
            className="object-cover object-[40%_40%] opacity-90"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-900/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-10">
            <LogoMark className="h-10 w-11" />
            <p className="mt-4 font-display text-3xl font-extrabold leading-tight text-white">
              Every Need Deserves a Solution.
            </p>
            <p className="mt-2 text-on-navy-muted">Post a Need. Solve a Need.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
