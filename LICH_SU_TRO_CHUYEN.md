# 📜 LỊCH SỬ TRAO ĐỔI & TỔNG KẾT TÍNH NĂNG DỰ ÁN
> **Dự án:** Theo dõi uống nước cho bà chã (Water Tracker)  
> **Repository GitHub:** `https://github.com/hoangson191995/unnuoc`  
> **Phiên bản ghi lại:** Ngày 24/11/2026 (Cập nhật đầy đủ các phiên thảo luận)

---

## 📌 MỤC LỤC
1. [Tại sao cần lưu tài liệu này?](#1-tai-sao-can-luu-tai-lieu-nay)
2. [Chi tiết các câu hỏi & Thảo luận quan trọng](#2-chi-tiet-cac-cau-hoi--thao-luan-quan-trong)
3. [Tổng hợp các tính năng đã triển khai & Nâng cấp](#3-tong-hop-cac-tinh-nang-da-trien-khai--nang-cap)
4. [Cấu trúc kỹ thuật & Cách hệ thống hoạt động](#4-cau-truc-ky-thuat--cach-he-thong-hoat-dong)
5. [Hướng dẫn phục hồi dự án sau khi Cài/Reset Windows](#5-huong-dan-phuc-hoi-du-an-sau-khi-caireset-windows)

---

## 1. TẠI SAO CẦN LƯU TÀI LIỆU NÀY?
Khi bạn cài đặt lại Windows (Reset Win) hoặc chuyển sang máy tính mới:
- Các file trong ổ `C:\` (bao gồm thư mục `Downloads` và dữ liệu phần mềm chat IDE) sẽ bị xóa sạch.
- **Giải pháp:** File tài liệu này được lưu trực tiếp vào source code dự án và **đẩy lên GitHub**. Dù bạn reset máy, đổi máy tính thì chỉ cần vào GitHub `https://github.com/hoangson191995/unnuoc` là toàn bộ ý tưởng, đoạn hội thoại và mã nguồn đều còn nguyên vẹn!

---

## 2. CHI TIẾT CÁC CÂU HỎI & THẢO LUẬN QUAN TRỌNG

### 💬 Câu hỏi 1: Đổi tiêu đề "Vườn hoa tình yêu của bà chã"
- **Yêu cầu:** Bỏ chữ "tình yêu", đổi thành "Vườn hoa của bà chã".
- **Thực hiện:** Đã chỉnh sửa trong `index.html`, giúp giao diện nhẹ nhàng, tinh tế và đúng ý người dùng.

### 💬 Câu hỏi 2: Các câu thoại linh vật ban đêm khi nào sẽ xuất hiện?
- **Giải đáp chi tiết:**
  - Linh vật (bé giọt nước / mầm cây) có cơ chế câu thoại theo khung giờ thực tế tại Việt Nam (GMT+7).
  - **Khung giờ ban đêm (từ 22:00 đến 05:00 sáng hôm sau):** Bé linh vật sẽ tự động chuyển sang chế độ nhắc ngủ, chúc ngủ ngon hoặc dặn dò nhẹ nhàng như:
    - *"Khuya rồi nè bà chã ơi, nhớ đi ngủ sớm cho da đẹp nha! 🌙"*
    - *"Đừng thức khuya quá nha, ăm chã lo đó! Ngủ ngon mơ đẹp nè 💕"*
  - Linh vật đổi câu thoại ngẫu nhiên mỗi khi người dùng bấm vào linh vật hoặc khi tải lại trang trong khung giờ đêm.

### 💬 Câu hỏi 3: Đề xuất tính năng thay đổi hàng ngày hoặc hàng tuần
- **Các đề xuất đã bàn luận:**
  1. *Hộp thư bí mật hàng ngày:* Mỗi ngày mở khóa 1 lời nhắn / quote dễ thương từ Ăm chã.
  2. *Thử thách thời tiết hàng ngày:* Lời khuyên uống nước theo nhiệt độ / trời nắng mưa.
  3. *Cây kỳ diệu hàng tuần (Weekly Plant):* Mỗi tuần trồng 1 loài cây khác nhau, uống đủ ngày thì cây nở hoa và đưa vào bộ sưu tập.
  4. *Vé cứu chuỗi (Streak Recovery):* Giúp bà chã không bị mất chuỗi ngày uống nước khi lỡ quên 1 ngày bận rộn.
- **Quyết định:** Người dùng chọn phương án **Vé cứu chuỗi kết hợp Cây kỳ diệu** và bổ sung **Favicon cô gái**.

### 💬 Câu hỏi 4: Đổi icon quả địa cầu trên tab trình duyệt
- **Yêu cầu:** Không muốn icon quả địa cầu xám mặc định của trình duyệt, muốn đổi thành icon cô gái.
- **Thực hiện:** Đã nhúng Favicon SVG dạng hình cô gái `👧` trực tiếp vào thẻ `<head>` của `index.html`. Giúp tab trình duyệt luôn hiển thị icon cô gái dễ thương, nổi bật.

### 💬 Câu hỏi 5: Thảo luận về tính năng "Vé cứu chuỗi" (Streak Rescue Ticket)
- **Ý tưởng ban đầu:** Cứu chuỗi tối đa 3 lần/tháng, có hiển thị số vé còn lại.
- **Thay đổi theo yêu cầu mới nhất:** Nâng lên **5 lần / tháng** để bà chã thoải mái hơn khi bận rộn.
- **Quy tắc hoạt động hoàn chỉnh:**
  - Mỗi tháng có tối đa **5 vé cứu chuỗi**.
  - Tự động hiển thị huy hiệu `🎟️ 5/5` ngay cạnh thanh Streak trang chủ.
  - Khi lỡ đứt chuỗi hôm qua, vừa mở web lên hệ thống sẽ tự động hiện Popup nhắc nhở ngọt ngào từ Ăm chã, tặng vé để cứu chuỗi.
  - Khi bấm *"Dùng 1 vé cứu chuỗi"*:
    + Ngày hôm qua được tính là ngày hoàn thành uống nước.
    + Chuỗi streak được nối lại ngay lập tức.
    + Được tính thêm 1 giọt sương vào Cây kỳ diệu tuần này.
    + Số vé tự động trừ đi 1 (VD: còn 4/5 vé).

---

## 3. TỔNG HỢP CÁC TÍNH NĂNG ĐÃ TRIỂN KHAI & NÂNG CẤP

| STT | Tính năng | Chi tiết triển khai |
| :--- | :--- | :--- |
| 1 | **Favicon Cô Gái 👧** | Thay icon quả địa cầu trên tab trình duyệt bằng icon cô gái SVG sắc nét. |
| 2 | **Vé Cứu Chuỗi 🎟️ (5 lần/tháng)** | Tự động phát hiện đứt chuỗi, cấp 5 vé/tháng, tự làm mới vào đầu tháng mới. |
| 3 | **Huy hiệu & Modal Vé Cứu Chuỗi** | Hiển thị số vé trực tiếp `🎟️ X/5`, bấm vào xem chi tiết lịch sử và quy tắc. |
| 4 | **Đồng bộ Cây Tuần & Cứu Chuỗi** | Dùng vé cứu chuỗi sẽ tự động tưới nước cho cây tuần giúp cây mau nở hoa. |
| 5 | **Câu thoại linh vật theo giờ** | Đầy đủ các câu thoại sáng, chiều, tối và đặc biệt là câu thoại ban đêm sau 22h. |
| 6 | **Tối ưu hóa UI/UX** | Bỏ chữ "tình yêu" trong vườn hoa, giao diện tông màu pastel hồng - xanh dịu mắt. |

---

## 4. CẤU TRÚC KỸ THUẬT & CÁCH HỆ THỐNG HOẠT ĐỘNG

### 📂 Backend (`server.js`)
- **Model `StreakRecovery`:** Lưu trữ `monthYear` (VD: "10/2026", "11/2026"), `usedCount` (số lần đã dùng trong tháng, tối đa 5), danh sách lịch sử các ngày đã cứu `history`.
- **Hàm `getMonthlyRecoveryInfo()`:** Tự động kiểm tra và khởi tạo dữ liệu cho tháng hiện tại, tính số vé còn lại `Math.max(0, 5 - usedCount)`.
- **API `/api/water/streak/recover` (POST):**
  - Kiểm tra nếu `usedCount >= 5` thì từ chối và gửi lời nhắn ngọt ngào.
  - Đánh dấu ngày hôm qua trong MongoDB `DayWater` thành `isRecovered = true` và `amount = 1500`.
  - Tăng `usedCount` lên 1 và trả về chuỗi streak mới.
- **Hàm `calculateStreak()`:** Nhận diện cả những ngày `isRecovered: true` để chuỗi không bao giờ bị đứt gãy.

### 🌐 Frontend (`index.html`)
- **SVG Favicon:** Nhúng data URL `data:image/svg+xml,...` biểu tượng `👧`.
- **Huy hiệu `#streakTicketBadge`:** Tự động render `🎟️ X/5`.
- **Modal `#streakModal`:** Hiển thị thẻ vé cứu chuỗi của Ăm chã và nút dùng vé.
- **Tự động nhắc nhở:** Hàm kiểm tra xem ngày hôm qua có bị lỡ hay không, nếu có và còn vé thì tự động mở popup cứu chuỗi đón bà chã khi vào web.

---

## 5. HƯỚNG DẪN PHỤC HỒI DỰ ÁN SAU KHI CÀI / RESET WINDOWS

Khi bạn reset lại Windows, toàn bộ máy sẽ như mới. Bạn chỉ cần thực hiện 3 bước đơn giản này để lấy lại toàn bộ dự án:

1. **Cài đặt Git và Node.js:**
   - Tải Git: [git-scm.com](https://git-scm.com/)
   - Tải Node.js (LTS): [nodejs.org](https://nodejs.org/)

2. **Kéo toàn bộ dự án từ GitHub về:**
   - Mở Terminal (PowerShell hoặc Command Prompt) và gõ lệnh:
   ```bash
   git clone https://github.com/hoangson191995/unnuoc.git
   cd unnuoc
   ```

3. **Cài đặt thư viện & Chạy lại:**
   ```bash
   npm install
   node server.js
   ```
- Mở trình duyệt vào `http://localhost:3000` là toàn bộ dữ liệu, giao diện và file `LICH_SU_TRO_CHUYEN.md` này đã có sẵn đầy đủ 100%!
