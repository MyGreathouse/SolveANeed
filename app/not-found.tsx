import { ButtonLink } from "@/components/ui/Button";
import { LogoMark } from "@/components/brand/Logo";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center bg-soft py-20">
      <div className="container-page max-w-xl text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-navy-900"><LogoMark className="h-8 w-9" /></div>
        <h1 className="mt-6 text-3xl font-extrabold">We couldn&apos;t find that page</h1>
        <p className="mt-3 text-muted">It may have been moved, closed, or you may not have permission to view it.</p>
        <div className="mt-8 flex justify-center gap-3">
          <ButtonLink href="/" variant="navy">Go home</ButtonLink>
          <ButtonLink href="/needs" variant="outline">Explore needs</ButtonLink>
        </div>
      </div>
    </main>
  );
}
