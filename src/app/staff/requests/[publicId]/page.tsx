import StaffRequestClient from "./StaffRequestClient";

export default async function StaffRequestPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  return <StaffRequestClient publicId={publicId} />;
}
