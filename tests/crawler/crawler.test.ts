import { describe, expect, it } from "vitest";
import { extractCandidateSignals, fetchSource, robotsAllows, type CrawlSource } from "../../workers/ingestor/src/crawler";

const source: CrawlSource = {
  source_id: "source:test",
  provider_id: "provider:test",
  source_url: "https://bank.example.vn/loans/home",
  source_type: "html",
  robots_status: "allowed",
  terms_status: "allowed",
  crawl_enabled: 1,
  user_agent: "vaytiendanang-test/1.0",
  etag: null,
  last_modified: null,
  previous_content_hash: null,
};

describe("crawler safety gates", () => {
  it("applies the longest matching robots rule", () => {
    const robots = "User-agent: *\nDisallow: /\nAllow: /loans/\nDisallow: /loans/private/";
    expect(robotsAllows(robots, source.source_url, source.user_agent!)).toBe(true);
    expect(robotsAllows(robots, "https://bank.example.vn/loans/private/file", source.user_agent!)).toBe(false);
  });

  it("extracts signals without publishing a rate", () => {
    expect(extractCandidateSignals("Lãi suất 8%/năm, hạn mức 2 tỷ, kỳ hạn 240 tháng, phí hồ sơ")).toEqual([
      "rate",
      "amount",
      "term",
      "fee",
      "eligibility",
    ]);
  });

  it("requires robots permission and puts rate pages into review", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith("/robots.txt")) {
        return new Response("User-agent: *\nAllow: /", { status: 200 });
      }
      return new Response("<html><title>Home loan</title><p>Lãi suất 8%/năm và kỳ hạn 240 tháng</p></html>", {
        status: 200,
        headers: { etag: "\"v1\"" },
      });
    };
    const observation = await fetchSource(source, fetchImpl);
    expect(observation.validationStatus).toBe("anomaly");
    expect(observation.extracted.candidateSignals).toContain("rate");
    expect(observation.etag).toBe('"v1"');
  });

  it("blocks when robots cannot be fetched", async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error("network disabled");
    };
    const observation = await fetchSource(source, fetchImpl);
    expect(observation.validationStatus).toBe("blocked");
    expect(observation.errorMessage).toBe("robots_fetch_failed");
  });
});
