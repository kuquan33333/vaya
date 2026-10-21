import Link from "next/link";

/** Compatibility shell: legacy static packages are never rendered as live offers. */
export default function PackageDetail() {
  return (
    <section className="pageview on"><div className="wrap" style={{ padding: "70px 0" }}>
      <span className="sec-tag">Catalog đã thay đổi</span>
      <h2>Gói tĩnh cũ chưa được xác minh</h2>
      <p>Hãy mở catalog hiện tại để xem các sản phẩm có nguồn chính thức, ngày quan sát và cơ sở tính rõ ràng.</p>
      <Link className="btn btn-green" href="/#markets">Mở catalog</Link>
    </div></section>
  );
}
