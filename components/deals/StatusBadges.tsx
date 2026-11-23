import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { OFFER_STATUS_LABEL } from "@/lib/domain/offers";
import { AGREEMENT_STATUS_LABEL, type AgreementStatus } from "@/lib/domain/agreement-status";
import type { OfferStatus } from "@/lib/domain/offer-status";

const OFFER_TONE: Record<OfferStatus, BadgeTone> = {
  draft: "neutral", proposed: "info", countered: "gold", accepted: "success", declined: "neutral",
  expired: "neutral", cancelled: "neutral", completed: "navy", disputed: "danger",
};
const AGREEMENT_TONE: Record<AgreementStatus, BadgeTone> = {
  awaiting_payment_readiness: "warning", active: "info", submitted: "gold", revision_requested: "gold",
  in_review: "gold", completed: "navy", cancelled: "neutral", lapsed: "neutral", disputed: "danger",
};

export function OfferStatusBadge({ status }: { status: OfferStatus }) {
  return <Badge tone={OFFER_TONE[status]}>{OFFER_STATUS_LABEL[status]}</Badge>;
}
export function AgreementStatusBadge({ status }: { status: AgreementStatus }) {
  return <Badge tone={AGREEMENT_TONE[status]}>{AGREEMENT_STATUS_LABEL[status]}</Badge>;
}
