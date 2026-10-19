import { z } from "zod";

const sourceValues = ["banner", "card", "detail", "ai", "market", "human", "checklist", "organic"] as const;

export const LeadInputSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(20),
  province: z.string().trim().min(2).max(100),
  productId: z.string().trim().max(160).optional().nullable(),
  providerId: z.string().trim().max(160).optional().nullable(),
  loanType: z.string().trim().max(80).optional().nullable(),
  amountVnd: z.number().int().positive().max(50_000_000_000).optional().nullable(),
  termMonths: z.number().int().positive().max(360).optional().nullable(),
  note: z.string().trim().max(1_000).optional().nullable(),
  source: z.enum(sourceValues).default("organic"),
  campaign: z.string().trim().max(160).optional().nullable(),
  consentContact: z.literal(true),
  consentProcessingNotice: z.literal(true),
  consentDocumentUpload: z.boolean().default(false),
  consentTelegramDocument: z.boolean().default(false),
  turnstileToken: z.string().trim().max(2_048).optional().nullable(),
});

export type LeadInput = z.infer<typeof LeadInputSchema>;

export function normalizeVietnamPhone(value: string): string | null {
  const compact = value.replace(/[\s().-]/g, "");
  const national = compact.startsWith("+84")
    ? `0${compact.slice(3)}`
    : compact.startsWith("84")
      ? `0${compact.slice(2)}`
      : compact;
  if (!/^0(?:3|5|7|8|9)\d{8}$/.test(national)) return null;
  return `+84${national.slice(1)}`;
}

export function redactPhone(phoneE164: string): string {
  return `${phoneE164.slice(0, 3)}******${phoneE164.slice(-2)}`;
}
