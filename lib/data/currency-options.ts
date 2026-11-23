import { formatMoney, type CurrencyInfo } from "@/lib/money";
import type { CurrencyOption } from "@/components/needs/NeedForm";

export function currencyOptions(list: CurrencyInfo[]): CurrencyOption[] {
  return list
    .filter((c) => c.enabled)
    .map((c) => ({
      code: c.code,
      name: c.name,
      symbol: c.symbol,
      minorUnit: c.minorUnit,
      minLabel: formatMoney({ amountMinor: c.minNeedMinor, currency: c.code }, { list }),
      maxLabel: formatMoney({ amountMinor: c.maxNeedMinor, currency: c.code }, { list }),
    }));
}
