# TÀI LIỆU KỊCH BẢN KIỂM THỬ GIAO DIỆN & TÍNH NĂNG (QA WEB TEST CASES)

* **Dự án**: CUSC Recruitment CRM (Quản lý & Tiếp nhận Tin nhắn Tuyển sinh)
* **Phiên bản áp dụng**: v1.4.0 (Tuân thủ Nghị định 13/2023/NĐ-CP, NLP Normalizer, Entity Extractor, Keyword Rules Scoring)
* **Ngày tạo**: 04/11/2026
* **Đối tượng sử dụng**: Đội ngũ QA / QC / Tester / UAT

---

## 1. MỤC TIÊU & MÔI TRƯỜNG KIỂM THỬ

### 1.1. Mục tiêu
Xác minh trên giao diện Web (Frontend) và luồng API (Backend) đảm bảo 4 tiêu chí nghiệm thu cốt lõi:
1. **Ẩn danh dữ liệu (PDPD - Nghị định 13/2023/NĐ-CP)**: Khi ẩn danh một khách hàng, không còn bất kỳ dấu vết nào (Tên, SĐT, Email, UID) để truy ngược ra danh tính người đó, trong khi toàn bộ số liệu báo cáo, phễu tuyển sinh và doanh thu vẫn được bảo toàn nguyên vẹn.
2. **Hàm normalize()**: Xử lý mượt mà văn bản tiếng Việt tự nhiên (chữ thường, bỏ dấu, teencode lặp từ, mở rộng viết tắt hp, bn, ib, sdt,...).
3. **Trích xuất thực thể (Entity Extraction)**: Tự động trích xuất đúng Số điện thoại (chuẩn CUS-03), các loại hồ sơ (CCCD, học bạ, giấy khai sinh) và khóa học quan tâm.
4. **Bảng keyword_rules**: Cho phép người quản trị đổi trọng số từ khóa trong bảng/giao diện thì kết quả tính điểm thay đổi tức thì tại runtime mà không cần sửa code.

### 1.2. Môi trường kiểm thử
* **Frontend Web App**: `http://localhost:5173`
* **Backend API Base**: `http://localhost:3000/api`
* **Tài khoản kiểm thử**:
  - `admin@polarisx.vn` (Quyền Administrator)
  - `consultant1@polarisx.vn` (Quyền Sales / Tư vấn viên tuyển sinh)

---

## 2. MA TRẬN KỊCH BẢN KIỂM THỬ CHI TIẾT (TEST CASES)

### PHẦN 1: ẨN DANH DỮ LIỆU CÁ NHÂN (NGHỊ ĐỊNH 13/2023/NĐ-CP)

| Mã Test Case | Tên Kịch Bản | Tiền Điều Kiện | Các Bước Thực Hiện (Test Steps) | Dữ Liệu Kiểm Thử (Input) | Kết Quả Mong Đợi (Pass Criteria) | Trạng Thái |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-WEB-ANON-01** | Thao tác Ẩn danh Khách hàng từ Khung Chi Tiết (UI) | Đang đăng nhập tài khoản có quyền Quản lý/Admin, có sẵn khách hàng A trong hộp thư | 1. Vào màn hình **Inbox** (`/inbox`).<br>2. Chọn khách hàng "Nguyễn Văn A".<br>3. Tại cột bên phải (Customer Profile), mở menu Thao tác (dấu 3 chấm/hành động).<br>4. Chọn **"Ẩn danh dữ liệu (NĐ 13)"**.<br>5. Nhập lý do "Học viên yêu cầu hủy lưu trữ PII", bấm **Xác nhận**. | - Tên: Nguyễn Văn A<br>- SĐT: 0912345678<br>- Email: a.nguyen@gmail.com<br>- Giai đoạn: Đã nhập học | - Hiển thị Toast thông báo thành công.<br>- Tên đổi thành `Khách hàng ẩn danh #[MÃ]`.<br>- SĐT che thành `09********`.<br>- Email, Avatar bị xóa trống.<br>- Ghi chú cập nhật lý do tuân thủ NĐ 13. | **PASS** |
| **TC-WEB-ANON-02** | Khử nhận dạng nội dung lịch sử tin nhắn & file đính kèm | Khách hàng A đã được gửi ảnh CCCD, số điện thoại và tên trong hội thoại | 1. Sau khi ẩn danh ở TC-01, mở lại luồng tin nhắn chat của khách hàng.<br>2. Kiểm tra các bóng bóng tin nhắn cũ của khách và tư vấn viên. | Lời nhắn cũ: *"Em là Nguyễn Văn A, SĐT 0912345678 gửi CCCD"* | - Tên được thay thế bằng `[TÊN ĐÃ ẨN DANH]`.<br>- SĐT được thay thế bằng `[SĐT ĐÃ ẨN DANH]`.<br>- File/ảnh CCCD đính kèm bị xóa triệt để.<br>- Đoạn trích danh sách chat hiển thị thông báo đã ẩn danh. | **PASS** |
| **TC-WEB-ANON-03** | Chống truy vết ngược khi Tìm kiếm (Search Index) | Khách hàng A đã ẩn danh thành công | 1. Ra ô Tìm kiếm ở thanh danh sách Inbox hoặc trang Liên hệ.<br>2. Gõ tìm kiếm theo họ tên cũ "Nguyễn Văn A".<br>3. Gõ tìm kiếm theo SĐT cũ "0912345678". | Từ khóa tìm: `Nguyễn Văn A`, `0912345678` | - Trả về danh sách rỗng (0 kết quả).<br>- Không thể tìm thấy hoặc liên kết lại danh tính cũ. | **PASS** |
| **TC-WEB-ANON-04** | Kiểm tra Bảo toàn Số liệu Phễu Tuyển sinh & Doanh thu | Trước khi ẩn danh, ghi nhận tổng số học viên cột "Đã nhập học" và doanh thu trên Dashboard | 1. Vào màn hình **Kanban Tuyển sinh** (`/kanban`).<br>2. Vào màn hình **Báo cáo & Phân tích** (`/reports`).<br>3. Quan sát các biểu đồ: Funnel phễu, Tỷ trọng nguồn kênh, Doanh số theo tư vấn viên. | Lead có giá trị: `35.000.000 đ`, Stage: `Đã nhập học` | - Thẻ vẫn nằm nguyên tại cột "Đã nhập học" trên Kanban.<br>- Doanh thu và số lượng học viên trên Dashboard **không bị giảm 1 đơn vị**.<br>- Số liệu thống kê được giữ nguyên vẹn 100%. | **PASS** |

---

### PHẦN 2: CHUẨN HÓA VĂN BẢN TIẾNG VIỆT (`normalize()`)

| Mã Test Case | Tên Kịch Bản | Tiền Điều Kiện | Các Bước Thực Hiện (Test Steps) | Dữ Liệu Kiểm Thử (Input) | Kết Quả Mong Đợi (Pass Criteria) | Trạng Thái |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-WEB-NORM-01** | Mở rộng từ viết tắt học phí và câu hỏi (Nghiệm thu BA) | Khung chat sẵn sàng gửi/nhận tin nhắn | 1. Khách gửi tin nhắn qua Zalo/FB hoặc nhập vào thanh chat nội bộ.<br>2. Hệ thống chạy qua hàm chuẩn hóa `normalize()`. | `"HP bn vậy ạ"` | Chuỗi sau chuẩn hóa bắt buộc chứa 2 cụm từ khóa chuẩn: **`"hoc phi"`** và **`"bao nhieu"`**. | **PASS** |
| **TC-WEB-NORM-02** | Rút gọn teencode lặp ký tự | Tin nhắn từ học sinh chứa nhiều ký tự lặp kéo dài | 1. Gửi tin nhắn teencode có chữ lặp.<br>2. Kiểm tra chuỗi sau chuẩn hóa. | `"họcccc phí bên trường mình bao nhiuuu"` | - `"họcccc"` được rút gọn thành `"hoc"`.<br>- Chuỗi chứa `"hoc phi"` và `"bao nhieu"`. | **PASS** |
| **TC-WEB-NORM-03** | Khử nguyên âm lặp có dấu đặc thù | Tin nhắn biểu cảm tiếng Việt tự nhiên | 1. Gửi tin nhắn có nguyên âm có dấu lặp.<br>2. Kiểm tra chuỗi sau chuẩn hóa. | `"dạaaaaaa bao nhiuuuu zậy ad"` | - `"dạaaaaaa"` $\to$ `"da"`.<br>- `"zậy"` $\to$ `"vay"`.<br>- `"ad"` $\to$ `"admin"`.<br>- Chuỗi chứa `"da"`, `"bao nhieu"`. | **PASS** |
| **TC-WEB-NORM-04** | Nhận diện từ viết tắt hồ sơ thủ tục | Tin nhắn viết tắt hồ sơ | Gửi chuỗi: `"ib sdt e gui cccd va hb dky"` | Mở rộng chính xác thành: `"inbox so dien thoai e gui can cuoc cong dan va hoc ba dang ky"`. | **PASS** |

---

### PHẦN 3: TRÍCH XUẤT THỰC THỂ NGHIỆP VỤ (ENTITY EXTRACTION)

| Mã Test Case | Tên Kịch Bản | Tiền Điều Kiện | Các Bước Thực Hiện (Test Steps) | Dữ Liệu Kiểm Thử (Input) | Kết Quả Mong Đợi (Pass Criteria) | Trạng Thái |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-WEB-EXT-01** | Trích xuất đủ 3 loại thông tin (Nghiệm thu BA) | Tin nhắn gửi hồ sơ tuyển sinh | 1. Nhận tin nhắn từ phụ huynh/thí sinh.<br>2. Xem kết quả bóc tách thực thể của hệ thống. | `"em gửi cccd với học bạ, sđt 0912345678"` | Trả về chuẩn xác 3 loại thông tin:<br>1. **SĐT**: `0912345678`<br>2. **Hồ sơ**: `["CCCD", "Học bạ"]`<br>3. **Khóa học**: `[]` (rỗng vì không nhắc trong câu). | **PASS** |
| **TC-WEB-EXT-02** | Trích xuất SĐT theo chuẩn CUS-03 đa định dạng | Tin nhắn chứa SĐT viết dấu chấm hoặc có mã quốc gia | Gửi các định dạng:<br>1. `"0912.345.678"`<br>2. `"+84 988 777 666"`<br>3. `"090 123 4567"` | Tất cả đều trích xuất và chuẩn hóa về dạng 10 chữ số chuẩn CUS-03: `0912345678`, `0988777666`, `0901234567`. | **PASS** |
| **TC-WEB-EXT-03** | Trích xuất Khóa học từ danh mục sản phẩm (Product Catalog) | Hệ thống có danh mục: Khóa học Aptech, Khóa Arena, Khóa Lập trình Python AI | Khách nhắn: *"Em muốn hỏi học phí khóa lập trình python ai và aptech"* | Hệ thống trích xuất thành công 2 khóa học và tự động liên kết thẻ khóa học vào hồ sơ thí sinh. | **PASS** |

---

### PHẦN 4: BẢNG `keyword_rules` & CHẤM ĐIỂM ĐỘNG TẠI RUNTIME

| Mã Test Case | Tên Kịch Bản | Tiền Điều Kiện | Các Bước Thực Hiện (Test Steps) | Dữ Liệu Kiểm Thử (Input) | Kết Quả Mong Đợi (Pass Criteria) | Trạng Thái |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-WEB-RULE-01** | Chấm điểm tự động theo bộ luật mặc định (Seed) | Bảng `keyword_rules` đã được seed 16 luật ban đầu | 1. Thí sinh gửi tin nhắn quan tâm đăng ký.<br>2. Xem điểm đánh giá lead trên thẻ khách hàng. | `"Em muốn nhập học ngay khóa này, học phí bao nhiêu"` | - Khớp: `nhập học` (+50), `học phí` (+10).<br>- Điểm tiềm năng: **60 điểm**.<br>- Cờ `isExcluded: false`. | **PASS** |
| **TC-WEB-RULE-02** | Đổi trọng số trong bảng, điểm số đổi theo không sửa code (Nghiệm thu BA) | Quyền Admin mở cấu hình luật | 1. Vào màn hình Cấu hình Từ khóa Tuyển sinh.<br>2. Tại dòng từ khóa `"học phí"`, sửa trọng số từ **10 thành 35**.<br>3. Bấm **Lưu thay đổi**.<br>4. Gửi lại tin nhắn ở TC-RULE-01. | Trọng số từ khóa `"học phí"` = `35` | - Điểm tiềm năng tính lại ngay lập tức là **85 điểm** (50 + 35).<br>- Điểm số thay đổi tức thì tại runtime **không cần restart server hay sửa code**. | **PASS** |
| **TC-WEB-RULE-03** | Tắt kích hoạt từ khóa (`isActive = false`) | Quyền Admin | 1. Tắt công tắc (toggle) của từ khóa `"nhập học"`.<br>2. Gửi lại tin nhắn ở TC-RULE-01. | `isActive: false` cho từ `"nhập học"` | - Từ `"nhập học"` không còn được tính điểm.<br>- Điểm chỉ còn **35 điểm** (từ `"học phí"`). | **PASS** |
| **TC-WEB-RULE-04** | Nhận diện nhóm LOẠI TRỪ và đánh dấu Spammer | Tin nhắn quảng cáo, spam | Gửi tin: *"Cho vay trả góp lãi suất 0%, tăng like fb uy tín"* | - Khớp nhóm `LOAI_TRU` (-100 điểm).<br>- Cờ `isExcluded: true`.<br>- Lead được hệ thống tự động đưa vào mục rác/loại trừ. | **PASS** |

---

## 3. LỆNH CHẠY TỰ ĐỘNG DÀNH CHO TESTER (AUTOMATION SCRIPTS)

Tester có thể thực thi ngay toàn bộ kịch bản kiểm thử mã nguồn bằng 1 câu lệnh duy nhất:
```powershell
pnpm --filter api test test/nlp/ test/customers/anonymize-customer.spec.ts test/messaging/customer.controller.spec.ts
```

Tất cả các ca kiểm thử đều đảm bảo chỉ số **100% Pass** và tương thích hoàn toàn với kiến trúc hệ thống CUSC Recruitment CRM.

