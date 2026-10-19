import { describe, expect, it } from "vitest";
import { LOCAL_CATALOG } from "@/lib/catalog/legacyCatalog";
import { isPubliclyRankable, publicProducts } from "@/lib/catalog/service";

describe("catalog publication gates", () => {
  it("keeps legacy records stable but outside the public ranking set", () => {
    expect(LOCAL_CATALOG).toHaveLength(28);
    expect(new Set(LOCAL_CATALOG.map((product) => product.productId)).size).toBe(28);
    expect(publicProducts(LOCAL_CATALOG)).toHaveLength(0);
    expect(LOCAL_CATALOG.every((product) => !isPubliclyRankable(product))).toBe(true);
  });
});
