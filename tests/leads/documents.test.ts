import { describe, expect, it } from "vitest";
import { hasAllowedSignature, stripImageMetadata } from "@/lib/leads/documentSecurity";

describe("document upload signature gate", () => {
  it("accepts the declared JPEG, PNG and WebP signatures", () => {
    expect(hasAllowedSignature("image/jpeg", new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(hasAllowedSignature("image/png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect(hasAllowedSignature("image/webp", new Uint8Array([...new TextEncoder().encode("RIFF"), 0, 0, 0, 0, ...new TextEncoder().encode("WEBP")]))).toBe(true);
  });

  it("rejects mislabeled text and unsupported formats", () => {
    expect(hasAllowedSignature("image/png", new TextEncoder().encode("<svg></svg>"))).toBe(false);
    expect(hasAllowedSignature("image/svg+xml", new TextEncoder().encode("<svg></svg>"))).toBe(false);
  });

  it("removes common JPEG metadata segments before storage", () => {
    const jpeg = new Uint8Array([
      0xff, 0xd8,
      0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
      0xff, 0xda, 0x00, 0x02, 0x01, 0x02, 0xff, 0xd9,
    ]);
    const stripped = stripImageMetadata("image/jpeg", jpeg);
    expect(stripped).not.toBeNull();
    expect(Array.from(stripped ?? [])).not.toContain(0x45);
    expect(stripped?.[0]).toBe(0xff);
    expect(stripped?.[1]).toBe(0xd8);
  });
});
