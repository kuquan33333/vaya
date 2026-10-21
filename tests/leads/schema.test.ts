import { describe, expect, it } from "vitest";
import { normalizeVietnamPhone, redactPhone } from "@/lib/leads/schema";

describe("lead privacy helpers", () => {
  it("normalizes accepted Vietnam phone forms", () => {
    expect(normalizeVietnamPhone("0912 345 678")).toBe("+84912345678");
    expect(normalizeVietnamPhone("+84 912 345 678")).toBe("+84912345678");
    expect(normalizeVietnamPhone("0123456789")).toBeNull();
  });

  it("redacts the normalized phone for logs/audit", () => {
    expect(redactPhone("+84912345678")).toBe("+84******78");
  });
});
