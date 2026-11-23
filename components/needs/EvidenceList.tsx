import { FileText, ImageIcon, Lock } from "lucide-react";
import type { EvidenceFile } from "@/lib/data/needs";
import { deleteEvidenceAction } from "@/app/dashboard/requester/needs/actions";

export function formatBytes(n: number) {
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function EvidenceList({ files, canDelete, needId }: { files: EvidenceFile[]; canDelete: boolean; needId: string }) {
  if (!files.length) return <p className="text-sm text-muted">No evidence uploaded yet.</p>;
  return (
    <ul className="divide-y divide-line rounded-2xl border border-line">
      {files.map((f) => {
        const Icon = f.mime_type === "application/pdf" ? FileText : ImageIcon;
        return (
          <li key={f.id} className="flex items-center gap-3 p-3">
            <Icon className="size-5 shrink-0 text-navy-700" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <a href={`/api/evidence/${f.id}`} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-semibold text-navy-900 underline">
                {f.file_name}<span className="sr-only"> (opens a private, time-limited link in a new tab)</span>
              </a>
              <p className="flex items-center gap-1 text-xs text-muted"><Lock className="size-3" aria-hidden="true" />Private · {formatBytes(f.size_bytes)}</p>
            </div>
            {canDelete && (
              <form action={deleteEvidenceAction}>
                <input type="hidden" name="evidenceId" value={f.id} />
                <input type="hidden" name="needId" value={needId} />
                <button type="submit" className="min-h-10 rounded-full px-3 text-sm font-semibold text-danger-700 hover:bg-danger-50">
                  Remove<span className="sr-only"> {f.file_name}</span>
                </button>
              </form>
            )}
          </li>
        );
      })}
    </ul>
  );
}
