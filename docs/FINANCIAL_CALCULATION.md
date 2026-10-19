# Công thức tài chính

## Rate basis

- `annual-nominal-reducing-balance`: lãi tháng = annual / 12 trên dư nợ mở đầu;
- `annual-nominal-original-principal`: lãi tháng trên gốc ban đầu;
- `monthly-flat`: dùng monthly percent trực tiếp trên gốc ban đầu, không nhân
  mù thành APR;
- `apr`, `eir`, `unknown`: không được dùng cho bảng amortization hiện tại khi
  thiếu quy tắc chuyển đổi/định nghĩa đầy đủ.

Rate promotion chỉ được tính xuyên suốt khi post-promo basis và value có thật.
Nếu thiếu, calculation trả `unavailable-rate` thay vì áp dụng promo cho toàn
kỳ hạn.

## Khoản trả và phí

`calculateLoan` hỗ trợ annuity và equal-principal, trả schedule từng tháng,
first payment, interest, principal và closing balance. Khi phí upfront/monthly
chưa biết, `totalFeesVnd` và `totalRepaymentVnd` là `null`; UI hiển thị chưa biết.

## DTI, risk và MCDA

`DTI = (first payment + existing monthly debt) / monthly income`, cap mặc định
60%. Risk kết hợp DTI và term. MCDA giữ thuật toán legacy với trọng số rate,
risk và thuộc tính; sản phẩm đầu vào của public ranking hiện là D1 verified.

## Survivability

Monte Carlo vẫn giữ 220 seeded paths và logic shock hiện có. UI không tự gắn
lãi suất mẫu nữa: rate phải đến từ product detail/query hoặc được người dùng
nhập và hiển thị như một giả định. 4×4 stress grid sử dụng rate schedule,
grace period và household cashflow của engine.

Mọi kết quả là phân tích, không phải cam kết phê duyệt. Bên cho vay vẫn quyết
định sau khi thẩm định hồ sơ.
