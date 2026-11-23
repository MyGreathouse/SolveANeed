"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app] unhandled error", error.digest);
  }, [error]);
  return (
    <main className="flex flex-1 items-center bg-soft py-20">
      <div className="container-page max-w-xl text-center" role="alert">
        <h1 className="text-3xl font-extrabold">Something went wrong</h1>
        <p className="mt-3 text-muted">Please try again. If the problem continues, contact support{error.digest ? ` quoting reference ${error.digest}` : ""}.</p>
        <Button variant="navy" className="mt-8" onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
