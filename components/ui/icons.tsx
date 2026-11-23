import { BadgeCheck, Briefcase, Coins, FileCheck2, HandHeart, Target } from "lucide-react";

export const PillarIcon = {
  gift: HandHeart,
  paid_task: Briefcase,
  milestone: Coins,
  direct_support: Target,
} as const;

export { BadgeCheck, FileCheck2 };
