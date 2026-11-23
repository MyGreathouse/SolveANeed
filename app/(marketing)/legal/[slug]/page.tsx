import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { LEGAL_PAGES } from "./content";

export function generateStaticParams() {
  return Object.keys(LEGAL_PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/legal/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: LEGAL_PAGES[slug]?.title ?? "Legal" };
}

export default async function LegalPage({ params }: PageProps<"/legal/[slug]">) {
  const { slug } = await params;
  const page = LEGAL_PAGES[slug];
  if (!page) notFound();
  return (
    <main className="bg-white py-12 md:py-16">
      <article className="container-page max-w-3xl">
        <p className="eyebrow">Legal</p>
        <h1 className="mt-2 text-4xl font-extrabold">{page.title}</h1>
        <Alert tone="warning" className="mt-6" title="Draft — not yet legally reviewed">
          This document is a working draft prepared during development. It must be reviewed and approved by a qualified UK solicitor before SolveANeed launches publicly.
        </Alert>
        <div className="prose-sn mt-8 leading-relaxed text-charcoal">{page.body}</div>
      </article>
    </main>
  );
}
