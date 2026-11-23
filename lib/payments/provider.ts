/**
 * Payment abstraction layer — INTERFACE ONLY (Phase 4).
 *
 * Status: planned. No provider is integrated and no money can move.
 * The database additionally blocks live-mode records
 * (payment_transactions.livemode must be false).
 *
 * Before any implementation: legal review, provider eligibility (e.g. Stripe
 * Connect for a UK marketplace), documented fund flows and ownership, payout,
 * refund, chargeback and dispute rules, and safeguarding confirmation.
 * Never describe funds as "held in escrow" unless the regulated arrangement
 * genuinely supports that description.
 */
import type { Money } from "@/lib/money";

export type PaymentKind = "contribution" | "task_payment" | "milestone_payment" | "direct_purchase";

export interface CreatePaymentInput {
  kind: PaymentKind;
  amount: Money;
  payerId: string;
  payeeId?: string;
  needId?: string;
  agreementId?: string;
  /** Required. Re-using a key must never create a second charge. */
  idempotencyKey: string;
}

export interface PaymentIntentResult {
  providerRef: string;
  clientSecret?: string; // passed to the provider's hosted UI; card data never touches our servers
  status: "requires_action" | "processing" | "succeeded" | "failed";
}

export interface VerifiedEvent {
  provider: string;
  eventId: string;
  type: string;
  payload: unknown;
}

export interface PaymentProvider {
  readonly name: "sandbox" | "stripe";
  createPayment(input: CreatePaymentInput): Promise<PaymentIntentResult>;
  refund(providerRef: string, amount: Money, idempotencyKey: string): Promise<{ providerRef: string }>;
  createPayout(recipientAccountRef: string, amount: Money, idempotencyKey: string): Promise<{ providerRef: string }>;
  /** MUST verify the signature against the raw request body; throws if invalid. */
  verifyWebhook(rawBody: string, signatureHeader: string): Promise<VerifiedEvent>;
}
