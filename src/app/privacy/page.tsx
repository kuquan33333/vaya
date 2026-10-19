export default function PrivacyPage() {
  return (
    <section className="pageview on"><div className="wrap legal-page">
      <span className="sec-tag">Thông báo quyền riêng tư · phiên bản privacy-v2</span>
      <h1>Thông tin của bạn được dùng như thế nào</h1>
      <p>vaytiendanang dùng dữ liệu bạn tự gửi để liên hệ tư vấn và kiểm tra yêu cầu. Số điện thoại được lưu ở D1 để xử lý lead; bản hash được dùng cho audit/rate-limit. Dữ liệu liên hệ, số điện thoại đầy đủ và ghi chú không được gửi vào mô hình AI hoặc Telegram.</p>
      <h2>CCCD hai mặt (tùy chọn, cần đồng ý riêng)</h2>
      <p>Chỉ khi Telegram Bot và khóa upload được cấu hình hợp lệ, hệ thống mới mở lựa chọn nhận ảnh. Ảnh phải là JPEG, PNG hoặc WebP, tối đa 8 MB mỗi mặt; Worker kiểm tra định dạng/chữ ký, giữ nguyên bytes ảnh gốc và gửi trực tiếp bằng Telegram Bot sendDocument. Bytes ảnh không được lưu trong D1, Worker hoặc kho đối tượng; D1 chỉ lưu metadata giao nhận, hash và trạng thái.</p>
      <p>Khi chọn đồng ý riêng, bạn hiểu rằng Telegram Bot không mã hóa đầu cuối (end-to-end encryption). Ảnh được gửi tới Telegram và người quản trị chat/bot có thể xử lý; hệ thống không bảo đảm ảnh đã gửi có thể được thu hồi hoàn toàn. Yêu cầu xóa chỉ xóa metadata nội bộ và thực hiện best-effort deleteMessage nếu Telegram cho phép. Nếu Telegram chưa xác nhận, hệ thống không báo upload thành công.</p>
      <h2>Dịch vụ xử lý</h2>
      <p>Hạ tầng ứng dụng và D1 do Cloudflare cung cấp. Telegram nhận thông báo lead đã loại PII và chỉ nhận ảnh CCCD khi bạn tick đồng ý riêng. AI chỉ nhận nội dung hội thoại đã được người dùng gửi; không gửi giấy tờ hoặc số điện thoại đầy đủ. URL Zalo chỉ xuất hiện khi chủ hệ thống tự cấu hình.</p>
      <h2>Quyền của bạn</h2>
      <p>Bạn có thể yêu cầu xem, chỉnh sửa hoặc xóa lead bằng cách cung cấp mã yêu cầu cho nhân viên được ủy quyền. Sản phẩm/lãi suất chỉ được công khai khi có nguồn và thời điểm xác minh; đây không phải là cam kết cho vay.</p>
    </div></section>
  );
}
