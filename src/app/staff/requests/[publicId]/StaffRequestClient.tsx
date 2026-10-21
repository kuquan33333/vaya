"use client";

import { useCallback, useEffect, useState } from "react";

type Lead = {
  public_id: string;
  full_name: string;
  phone_e164: string;
  province: string;
  product_id: string | null;
  provider_id: string | null;
  loan_type: string | null;
  amount_vnd: number | null;
  term_months: number | null;
  note: string | null;
  source: string;
  campaign: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type Document = {
  document_id: string;
  side: "front" | "back";
  content_type: string;
  byte_size: number;
  sha256: string;
  status: string;
  telegram_message_id: number | null;
  telegram_sent_at: string | null;
  error_message: string | null;
  expires_at: string | null;
  deleted_at: string | null;
  created_at: string;
};

const STATUSES = ["new", "contacted", "pending", "closed", "deleted"] as const;

export default function StaffRequestClient({ publicId }: { publicId: string }) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [status, setStatus] = useState("new");
  const [state, setState] = useState<"loading" | "ready" | "denied" | "error">("loading");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    const response = await fetch(`/api/staff/requests/${encodeURIComponent(publicId)}`, { cache: "no-store" });
    if (response.status === 403) {
      setState("denied");
      return;
    }
    if (!response.ok) {
      setState("error");
      return;
    }
    const data = (await response.json()) as { lead: Lead; documents: Document[] };
    setLead(data.lead);
    setDocuments(data.documents);
    setStatus(data.lead.status);
    setState("ready");
  }, [publicId]);

  useEffect(() => {
    void load().catch(() => setState("error"));
  }, [load]);

  const updateStatus = async (nextStatus: string) => {
    setMessage("");
    const response = await fetch(`/api/staff/requests/${encodeURIComponent(publicId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!response.ok) {
      setMessage("Không thể cập nhật trạng thái; phiên Access có thể đã hết hạn.");
      return;
    }
    setMessage("Đã cập nhật.");
    await load();
  };

  if (state === "loading") return <main className="pageview on"><div className="wrap"><p>Đang tải hồ sơ nội bộ…</p></div></main>;
  if (state === "denied") return <main className="pageview on"><div className="wrap"><h1>Cần Cloudflare Access</h1><p>Hãy đăng nhập tài khoản nhân viên được allowlist rồi mở lại liên kết.</p></div></main>;
  if (state !== "ready" || !lead) return <main className="pageview on"><div className="wrap"><h1>Không tải được hồ sơ</h1><p>Mã hồ sơ không tồn tại hoặc hệ thống tạm thời chưa sẵn sàng.</p></div></main>;

  return (
    <main className="pageview on">
      <div className="wrap staff-request">
        <span className="sec-tag">Hồ sơ nội bộ</span>
        <h1>{lead.public_id}</h1>
        <p className="form-footnote">Chỉ nhân viên đã xác thực Cloudflare Access mới xem được trang này. Đây không phải trang danh sách Admin.</p>
        <div className="staff-request-grid">
          <section className="staff-card">
            <h2>Thông tin liên hệ</h2>
            <dl>
              <div><dt>Họ tên</dt><dd>{lead.full_name}</dd></div>
              <div><dt>Điện thoại</dt><dd>{lead.phone_e164}</dd></div>
              <div><dt>Tỉnh/thành</dt><dd>{lead.province}</dd></div>
              <div><dt>Sản phẩm</dt><dd>{lead.product_id ?? "Chưa chọn"}</dd></div>
              <div><dt>Nhà cung cấp</dt><dd>{lead.provider_id ?? "Chưa chọn"}</dd></div>
              <div><dt>Nguồn</dt><dd>{lead.source}{lead.campaign ? ` · ${lead.campaign}` : ""}</dd></div>
              <div><dt>Số tiền</dt><dd>{lead.amount_vnd == null ? "Chưa nhập" : `${lead.amount_vnd.toLocaleString("vi-VN")} VND`}</dd></div>
              <div><dt>Kỳ hạn</dt><dd>{lead.term_months == null ? "Chưa nhập" : `${lead.term_months} tháng`}</dd></div>
              <div><dt>Ghi chú</dt><dd>{lead.note ?? "Không có"}</dd></div>
            </dl>
          </section>
          <section className="staff-card">
            <h2>Xử lý</h2>
            <label className="fq"><span>Trạng thái</span><select value={status} onChange={(event) => setStatus(event.target.value)}>{STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <button className="btn btn-green btn-sm" onClick={() => void updateStatus(status)}>Lưu trạng thái</button>
            {message && <p className="form-footnote">{message}</p>}
            <p className="form-footnote">Tạo lúc: {new Date(lead.created_at).toLocaleString("vi-VN")}</p>
          </section>
        </div>
        <section className="staff-card">
          <h2>CCCD đã gửi Telegram</h2>
          <p className="form-footnote">Worker không lưu bytes ảnh và không có nút tải lại. Telegram Bot không mã hóa đầu cuối; việc xóa trong hệ thống không bảo đảm thu hồi ảnh đã gửi.</p>
          {documents.length === 0 ? <p>Khách chưa gửi tài liệu.</p> : <div className="staff-documents">{documents.map((document) => <div key={document.document_id}><span>CCCD mặt {document.side === "front" ? "trước" : "sau"} · {document.status} · {document.byte_size.toLocaleString("vi-VN")} bytes</span><small>{document.telegram_sent_at ? `Đã xác nhận lúc ${new Date(document.telegram_sent_at).toLocaleString("vi-VN")}` : document.error_message ?? "Chưa có xác nhận Telegram"}</small></div>)}</div>}
        </section>
        <button className="btn btn-danger btn-sm" onClick={() => { if (window.confirm("Xóa hồ sơ và metadata tài liệu? Ảnh đã gửi tới Telegram có thể không thu hồi được.")) void updateStatus("deleted"); }}>Thu hồi metadata và xóa hồ sơ</button>
      </div>
    </main>
  );
}
