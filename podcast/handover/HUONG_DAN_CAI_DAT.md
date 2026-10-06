# Cài đặt routine ôn từ vựng trên tài khoản khác

Gồm 3 phần: skill, kết nối Google Sheet, và lịch nhắc hằng ngày.

## 1. Cài skill

1. Nén thư mục `english-spaced-review` thành file zip (file `english-spaced-review.zip` kèm theo đã làm sẵn, bên trong là thư mục `english-spaced-review/SKILL.md`).
2. Trên tài khoản mới, vào phần quản lý Skills (thường ở Settings, mục Capabilities hoặc Customize; tên menu có thể khác tùy phiên bản) và tải file zip lên, rồi bật skill.
3. Nếu tài khoản không có chỗ tải skill: dán toàn bộ nội dung `SKILL.md` vào Custom instructions của Project, hoặc gửi cho Claude ở tin nhắn đầu tiên của mỗi cuộc trò chuyện.

## 2. Kết nối Google Sheet

1. Bật connector Google Sheets (và Google Drive nếu muốn tạo file) cho tài khoản mới.
2. Chia sẻ Google Sheet cho tài khoản Google của tài khoản mới với quyền Chỉnh sửa, hoặc dùng "Tạo bản sao" rồi đổi `SHEET_ID` trong `SKILL.md` thành ID của bản sao.
   ID là đoạn giữa `/d/` và `/edit` trong link của sheet.
3. Cột B chỉ ghi tiếng Anh (từ hoặc mẫu câu), không có nghĩa tiếng Việt. Cột C chỉ ghi phát âm Mỹ (US).
4. Bảng phải có đúng 9 cột: Date, Word/model sentence, Phát âm, Explain in English, Example, Print to my mind, 1 day check, 3 days check, 7 days check. Cột F đến I nên có dropdown "Thuộc" và "Chưa thuộc" (Data, rồi Data validation, rồi Dropdown).

## 3. Lịch nhắc hằng ngày (routine)

1. Tạo một scheduled task hoặc routine chạy mỗi sáng (ví dụ 7:30, múi giờ Asia/Saigon).
2. Dán nội dung file `ROUTINE_PROMPT.txt` làm lời nhắc.
3. Cho routine quyền dùng connector Google Sheets đã bật ở bước 2.
4. Chạy thử một lần bằng tay để kiểm tra, rồi để chạy theo lịch.

## Cách dùng hằng ngày

- Ngày học mới: gửi danh sách từ. Claude sửa chính tả, chọn nhóm, điền Google Sheet, rồi gửi cả bộ bài tập trong một tin nhắn để bạn trả lời một lượt (ví dụ `A1b A2a B1c C1: ...`). Muốn bản in Word thì nói rõ.
- Cuối ngày: báo kết quả hai bài kiểm tra ("thuộc: …; chưa thuộc: …") để Claude điền cột F.
- Mỗi sáng: routine gửi bài ôn 1 ngày, 3 ngày, 7 ngày. Làm xong thì báo kết quả để Claude điền cột G, H, I.

## Quy tắc ôn (tóm tắt)

| Ôn | Gồm những dòng nào |
|---|---|
| Cùng ngày | 2 bài kiểm tra. Cột F là "Thuộc" chỉ khi đúng cả hai |
| 1 ngày | Tất cả từ học hôm qua |
| 3 ngày | Từ học 3 ngày trước mà cột F hoặc G là "Chưa thuộc" |
| 7 ngày | Tất cả từ học 7 ngày trước |

## Lưu ý

- Nhóm từ chỉ để nhận biết (hiếm, chuyên ngành, tên động vật…) mặc định không đưa vào bảng. Muốn đưa vào, nói rõ với Claude.
- Điều "3 ngày chỉ ôn từ chưa nhớ" là cách hiểu của người soạn. Nếu bạn muốn ôn tất cả từ 3 ngày trước, sửa dòng tương ứng trong `SKILL.md`.
