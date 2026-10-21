import { describe, expect, it } from "vitest";
import { verifyStaffAccess } from "@/lib/security/cloudflareAccess";

describe("staff access boundary", () => {
  it("denies requests without an Access assertion or configuration", async () => {
    const request = new Request("https://example.test/api/staff/requests/lead_test");
    expect(await verifyStaffAccess(request, { STAFF_ACCESS_TEAM_DOMAIN: "https://team.example", STAFF_ACCESS_AUD: "aud" })).toBeNull();
    expect(await verifyStaffAccess(request, {})).toBeNull();
  });
});
