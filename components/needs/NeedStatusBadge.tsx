import { Badge } from "@/components/ui/Badge";
import { NEED_STATUS_LABEL, NEED_STATUS_TONE, type NeedStatus } from "@/lib/domain/need-status";

export function NeedStatusBadge({ status }: { status: NeedStatus }) {
  return <Badge tone={NEED_STATUS_TONE[status]}>{NEED_STATUS_LABEL[status]}</Badge>;
}
