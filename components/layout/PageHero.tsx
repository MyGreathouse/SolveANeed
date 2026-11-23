import Image from "next/image";
import type { ReactNode } from "react";

export function PageHero({
  eyebrow,
  title,
  intro,
  image,
  imageAlt,
  imagePosition = "object-center",
  illustrative,
  actions,
}: {
  eyebrow: string;
  title: string;
  intro: ReactNode;
  image?: string;
  imageAlt?: string;
  imagePosition?: string;
  illustrative?: boolean;
  actions?: ReactNode;
}) {
  return (
    <section className="bg-navy-900 on-navy">
      <div className="container-page grid items-center gap-10 py-14 md:py-20 lg:grid-cols-2">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight text-white md:text-5xl">{title}</h1>
          <div className="mt-5 max-w-xl text-lg leading-relaxed text-on-navy-muted">{intro}</div>
          {actions && <div className="mt-8 flex flex-col gap-3 sm:flex-row">{actions}</div>}
        </div>
        {image && (
          <figure className="relative">
            <div className="relative aspect-[16/10] overflow-hidden rounded-[2rem] ring-1 ring-white/10">
              <Image src={image} alt={imageAlt ?? ""} fill priority sizes="(min-width: 1024px) 45vw, 100vw" className={`object-cover ${imagePosition}`} />
            </div>
            {illustrative && (
              <figcaption className="mt-2 text-xs text-on-navy-muted">Illustration only — figures shown in the image are not real SolveANeed data.</figcaption>
            )}
          </figure>
        )}
      </div>
    </section>
  );
}
