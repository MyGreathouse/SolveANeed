import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

/** Honest placeholder for features scheduled in a later phase. Every button still leads somewhere useful. */
export function Planned({
  title,
  phase,
  description,
  back,
}: {
  title: string;
  phase: 3 | 4 | 5;
  description: string;
  back: { href: string; label: string };
}) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState
        title={`Coming in Phase ${phase}`}
        description={
          <>
            <p>{description}</p>
            <p className="mt-2 text-sm">Nothing here is simulated: this page will show real records once the feature is live.</p>
          </>
        }
        action={<ButtonLink href={back.href} variant="navy">{back.label}</ButtonLink>}
      />
    </>
  );
}
