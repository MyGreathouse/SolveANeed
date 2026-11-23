import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { listMyEvidence } from "@/lib/data/needs";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { formatBytes } from "@/components/needs/EvidenceList";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const viewer = await requireRole(["requester"], { next: "/dashboard/requester/documents" });
  const files = await listMyEvidence(viewer.id);
  return (
    <>
      <PageHeader title="Documents" description="All private evidence you've uploaded. Only you and our moderators can open these files." />
      {files.length ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Your uploaded evidence files</caption>
            <thead className="border-b border-line text-muted">
              <tr><th scope="col" className="p-4 font-semibold">File</th><th scope="col" className="p-4 font-semibold">Need</th><th scope="col" className="p-4 font-semibold">Size</th><th scope="col" className="p-4 font-semibold">Uploaded</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {files.map((f) => (
                <tr key={f.id}>
                  <td className="p-4"><a href={`/api/evidence/${f.id}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy-900 underline">{f.file_name}</a></td>
                  <td className="p-4"><Link href={`/dashboard/requester/needs/${f.need_id}`} className="underline">{f.need_title}</Link></td>
                  <td className="p-4 text-muted">{formatBytes(f.size_bytes)}</td>
                  <td className="p-4 text-muted">{new Date(f.created_at).toLocaleDateString("en-GB")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No documents yet" description="You can add private supporting evidence to any need while it's a draft." action={<ButtonLink href="/dashboard/requester/needs" variant="navy">Go to my needs</ButtonLink>} />
      )}
    </>
  );
}
