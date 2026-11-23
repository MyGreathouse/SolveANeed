import { Paperclip, ShieldAlert } from "lucide-react";
import type { Conversation } from "@/lib/data/deals";
import { ReportForm } from "@/components/needs/ReportForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Alert } from "@/components/ui/Alert";
import { blockMemberAction } from "@/app/dashboard/deals/actions";
import { MessageForm } from "./MessageForm";

export function ConversationPanel({
  conversation,
  offerId,
  viewerId,
  otherName,
  canSend,
}: {
  conversation: Conversation;
  offerId: string;
  viewerId: string;
  otherName: string;
  canSend: boolean;
}) {
  const files = new Map(conversation.files.map((f) => [f.id, f]));
  return (
    <section className="card p-6" aria-labelledby="conv-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="conv-h" className="text-lg font-bold">Messages with {otherName}</h2>
        {!conversation.blocked && (
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold text-danger-700">Block {otherName}</summary>
            <form action={blockMemberAction} className="mt-3 space-y-2 rounded-2xl border border-line p-3">
              <input type="hidden" name="offerId" value={offerId} />
              <label className="block text-sm font-semibold" htmlFor="block-reason">Reason (private to you)</label>
              <input id="block-reason" name="reason" maxLength={500} className="field-input" />
              <p className="text-xs text-muted">They won&apos;t be able to message you or make new offers. Existing records are kept for safety and disputes.</p>
              <SubmitButton variant="danger" size="sm" pendingLabel="Blocking…">Block member</SubmitButton>
            </form>
          </details>
        )}
      </div>
      {conversation.blocked && (
        <Alert tone="warning" className="mt-4" title="You have blocked this member">
          You can unblock them in Settings. Messages are kept for safety and any dispute.
        </Alert>
      )}
      <ol className="mt-5 space-y-3" aria-label="Messages">
        {conversation.messages.length === 0 && <li className="text-sm text-muted">No messages yet.</li>}
        {conversation.messages.map((m) => {
          const mine = m.sender_id === viewerId;
          const file = m.file_id ? files.get(m.file_id) : undefined;
          return (
            <li key={m.id} className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${mine ? "ml-auto bg-navy-900 text-white" : "bg-soft text-charcoal"}`}>
              <p className="sr-only">{mine ? "You" : otherName} wrote:</p>
              <p className="whitespace-pre-line break-words">{m.body}</p>
              {file && (
                <a href={`/api/files/${file.id}`} className={`mt-2 inline-flex items-center gap-1.5 font-semibold underline ${mine ? "text-gold-300" : "text-navy-900"}`}>
                  <Paperclip className="size-4" aria-hidden="true" />{file.file_name}
                </a>
              )}
              {m.flags.length > 0 && (
                <p className={`mt-2 inline-flex items-center gap-1.5 text-xs ${mine ? "text-gold-300" : "text-warning-700"}`}>
                  <ShieldAlert className="size-3.5" aria-hidden="true" /> Contains contact or off-platform payment details — be careful.
                </p>
              )}
              <div className={`mt-1 flex items-center justify-between gap-3 text-xs ${mine ? "text-white/70" : "text-muted"}`}>
                <time dateTime={m.created_at}>{new Date(m.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</time>
              </div>
              {!mine && (
                <div className="mt-2 text-navy-900">
                  <ReportForm targetType="message" targetId={m.id} label="Report this message" />
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <div className="mt-6 border-t border-line pt-5">
        {canSend && !conversation.blocked ? (
          <MessageForm conversationId={conversation.id} offerId={offerId} />
        ) : (
          <p className="text-sm text-muted">New messages can&apos;t be sent in this conversation.</p>
        )}
      </div>
    </section>
  );
}
