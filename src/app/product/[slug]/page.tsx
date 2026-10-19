import PublicProductDetail from "@/components/PublicProductDetail";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicProductDetail slug={slug} />;
}
