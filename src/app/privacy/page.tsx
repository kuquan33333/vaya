export default function PrivacyPage() {
  return (
    <section className="pageview on"><div className="wrap legal-page">
      <span className="sec-tag">Thông báo quyền riêng tư · phiên bản privacy-v1</span>
      <h1>Thông tin của bạn được dùng như thế nào</h1>
      <p>vaytiendanang dùng dữ liệu bạn tự gửi để liên hệ tư vấn và kiểm tra yêu cầu. Số điện thoại được lưu ở D1 để xử lý lead; bản hash được dùng cho audit/rate-limit. Dữ liệu liên hệ và ghi chú không được gửi vào mô hình AI hoặc Telegram.</p>
      <h2>Giấy tờ tùy chọn</h2>
      <p>CCCD chỉ được tải khi kho R2 private đã được bật và bạn đã đồng ý riêng. File không có URL công khai, được giới hạn loại/kích thước và có thời hạn xóa mặc định 30 ngày. Khi cấu hình chưa cho phép, hệ thống không nhận giấy tờ. Quyền xem tài liệu yêu cầu nhân viên qua Cloudflare Access; Telegram không nhận ảnh hoặc số CCCD.</p>
      <h2>Dịch vụ xử lý</h2>
      <p>Hạ tầng lưu trữ và bảo vệ truy cập do Cloudflare cung cấp. Telegram chỉ nhận mã hồ sơ và metadata tối thiểu để nhân viên biết có lead mới. AI chỉ nhận nội dung hội thoại đã được người dùng gửi; không gửi giấy tờ hoặc số điện thoại đầy đủ. URL Zalo chỉ xuất hiện khi chủ hệ thống tự cấu hình.</p>
      <h2>Quyền của bạn</h2>
      <p>Bạn có thể yêu cầu xem, chỉnh sửa hoặc xóa lead bằng cách cung cấp mã yêu cầu cho nhân viên được ủy quyền. Sản phẩm/lãi suất chỉ được công khai khi có nguồn và thời điểm xác minh; đây không phải là cam kết cho vay.</p>
    </div></section>
  );
}
