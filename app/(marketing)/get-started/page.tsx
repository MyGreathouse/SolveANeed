import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getViewer } from "@/lib/auth/session";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Get started" };

export default async function GetStartedPage({ searchParams }: PageProps<"/get-started">) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const highlighted = sp.path === "need" ? "need" : sp.path === "help" ? "help" : null;

  const paths = [
    {
      key: "need",
      title: "I Need Help",
      body: "Post a genuine need. After a quick review, supporters can give, offer paid tasks, fund milestones or solve it directly.",
      steps: ["Create your free account", "Describe your need and upload private evidence", "Submit for review — we'll notify you when it's live"],
      href: viewer ? "/dashboard/requester/needs/new" : "/sign-up?intent=need",
      cta: viewer ? "Create a need" : "Create account & post a need",
      image: "/images/fund-milestones-v2.webp",
      alt: "A woman celebrates while working at her laptop.",
    },
    {
      key: "help",
      title: "I Want to Help",
      body: "Browse reviewed needs and choose how to help — a gift, a paid task, milestone sponsorship or a practical solution.",
      steps: ["Browse needs — no account needed", "Create an account to save needs and make offers", "Set preferences to see your best matches"],
      href: viewer ? "/dashboard/supporter" : "/sign-up?intent=help",
      cta: viewer ? "Go to supporter dashboard" : "Create a supporter account",
      secondary: { href: "/needs", label: "Browse needs first" },
      image: "/images/community-v2.webp",
      alt: "A diverse group of smiling people standing together.",
    },
  ] as const;

  return (
    <main className="bg-soft py-12 md:py-20">
      <div className="container-page">
        <p className="eyebrow">Get started</p>
        <h1 className="mt-2 text-4xl font-extrabold md:text-5xl">How would you like to begin?</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">One account works for both. You can switch sides at any time.</p>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {paths.map((p) => (
            <section
              key={p.key}
              aria-labelledby={`path-${p.key}`}
              className={cn("card flex flex-col overflow-hidden", highlighted === p.key && "ring-4 ring-gold-500")}
            >
              <div className="relative aspect-[16/8]">
                <Image src={p.image} alt={p.alt} fill sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover object-[50%_30%]" priority={highlighted === p.key} />
              </div>
              <div className="flex flex-1 flex-col p-6 md:p-8">
                <h2 id={`path-${p.key}`} className="text-2xl font-extrabold">{p.title}</h2>
                <p className="mt-2 text-muted">{p.body}</p>
                <ol className="mt-5 space-y-2">
                  {p.steps.map((s, i) => (
                    <li key={s} className="flex items-center gap-3 text-sm">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-navy-900 text-xs font-bold text-gold-500">{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
                <div className="mt-auto flex flex-col gap-3 pt-7 sm:flex-row">
                  <Link href={p.href} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-gold-500 px-6 font-semibold text-navy-900 hover:bg-gold-300">
                    {p.cta} <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                  {"secondary" in p && (
                    <Link href={p.secondary.href} className="inline-flex min-h-12 items-center justify-center rounded-full border border-navy-900/25 px-6 font-semibold text-navy-900 hover:border-navy-900">
                      {p.secondary.label}
                    </Link>
                  )}
                </div>
              </div>
            </section>
          ))}
        </div>
        {!viewer && (
          <p className="mt-8 text-center text-sm text-muted">
            Already a member? <Link href="/sign-in" className="font-semibold text-navy-900 underline">Sign in</Link>
          </p>
        )}
      </div>
    </main>
  );
}
