# SEG Lead Tracking — auto compare Netlify vs CRM

Tự động đối chiếu lead thu được trên **Netlify Forms** với lead thực sự vào **CRM (Salesforce)**,
rồi **tự cảnh báo qua Slack** khi có lead bị mất. Đây là phần Funnel không làm được
(Funnel chỉ xem thủ công, không có thông báo).

## Nguyên lý

> Lead có trong Netlify nhưng **không** thấy trong export Salesforce = **lead bị mất**.

Khớp bằng **email** (lowercase). Nguồn CRM hiện tại — Google Sheet *"SEG - New Lead from Netify"*,
tab **"Funnel data"** (cột `Date`, `Email`) — chưa có `Submission Id`, nên email là khoá khớp.
Nếu về sau export thêm cột **Submission Id**, code tự nhận UUID và dùng luôn làm khoá mạnh hơn
(`getCrmKeys` trả cả `emails` và `ids`; `classify` khớp email HOẶC event_id).

Chỉ so từ `MATCH_WINDOW_START` (mốc Salesforce bắt đầu có dữ liệu, hiện 2026-09-01) để tránh
"mất" giả với lead cũ. Lead < `ALERT_LAG_DAYS` ngày để ở trạng thái *chờ* (do export trễ).

> ⚠️ Khớp email không tuyệt đối (email lệch, CRM gộp trùng) → coi số "mất" là **tín hiệu cần
> kiểm chứng**. Thêm `Submission Id` vào export là cách làm nó chính xác 100%.

## Thành phần

| File | Vai trò |
|------|---------|
| `netlify/functions/lost-lead-alert.mjs` | **Chạy theo lịch** (mặc định 08:00 UTC/ngày). Kéo lead Netlify + đọc danh sách CRM, so khớp, gửi Slack danh sách lead mất. |
| `netlify/functions/leads.mjs` | API JSON: lead hiện tại + trạng thái khớp CRM (cho trang xem nhanh). |
| `netlify/functions/_lib.mjs` | Hàm dùng chung: gọi Netlify API, đọc CRM CSV, phân loại matched/lost/pending. |
| `public/index.html` | Trang xem nhanh (tùy chọn). |
| `netlify.toml` | Cấu hình build + lịch chạy. |

## Cần cấu hình (biến môi trường trên Netlify)

| Biến | Bắt buộc | Mô tả |
|------|:---:|-------|
| `NETLIFY_API_TOKEN` | ✅ | Netlify personal access token (User settings → Applications → New access token). Để function đọc Forms của 4 site SEG. |
| `SALESFORCE_CSV_URL` | ✅ | URL CSV của export Salesforce. Dùng **tab "Funnel data"** (không phải tab đầu): `https://docs.google.com/spreadsheets/d/1bAvxn13rUsclKOEKe_B0gRVWXbdQDn5vymPba0sBmtM/export?format=csv&gid=1301696085`. Sheet phải **Share → Anyone with the link (Viewer)** (hoặc Publish tab) để function đọc được không cần đăng nhập Google. |
| `SLACK_WEBHOOK_URL` | ✅ | Slack Incoming Webhook của kênh nhận cảnh báo. |
| `MATCH_WINDOW_START` | ❌ | Chỉ so từ ngày này (mặc định lấy env; nên đặt `2026-09-01`). Tránh "mất" giả với lead trước khi Salesforce có dữ liệu. |
| `ALERT_LAG_DAYS` | ❌ | Số ngày chờ trước khi coi là mất (mặc định 2, do export Salesforce trễ). |
| `ALERT_WINDOW_DAYS` | ❌ | Cửa sổ tính "lead vừa mất" để báo mỗi lần (mặc định 3). |
| `SITE_MAP` | ❌ | JSON `{siteId: "BRAND"}` nếu đổi danh sách site. Mặc định đã gắn 4 site SEG. |

4 site SEG đang gắn sẵn: CAAS (`36b518a4…`), SHMS (`0643bf0d…`), HIM (`a29a7635…`), CRCS (`45589786…`).

## Deploy

```bash
# từ thư mục lead-dashboard/
netlify sites:create --name seg-lead-tracking     # hoặc dùng site có sẵn
netlify env:set NETLIFY_API_TOKEN  "xxxx"
netlify env:set SALESFORCE_CSV_URL "https://docs.google.com/spreadsheets/d/1bAvxn13rUsclKOEKe_B0gRVWXbdQDn5vymPba0sBmtM/export?format=csv&gid=1301696085"
netlify env:set SLACK_WEBHOOK_URL  "https://hooks.slack.com/services/xxx"
netlify env:set MATCH_WINDOW_START "2026-09-01"
netlify deploy --prod
```

Chạy thử cảnh báo ngay (không đợi lịch): mở `/.netlify/functions/lost-lead-alert` trên trình duyệt,
hoặc `netlify functions:invoke lost-lead-alert`.

## ⚠️ Bảo mật

Trang và dữ liệu chứa **thông tin liên hệ lead thật**. Bật **password protection** cho site
(Site settings → Access & security) hoặc giới hạn SSO team — **không để public**.

## Kiểm chứng trước khi tin số "mất"

Khớp theo email nên số lead "mất" là tín hiệu, chưa phải kết luận. Trước khi báo động rộng:
1. Lấy vài lead "mất" trong dashboard, tìm email đó thẳng trong Salesforce (có thể đã vào nhưng email khác/gộp trùng).
2. Nhờ freelancer thêm cột **Submission Id** vào export → khớp bằng `event_id`, chính xác 100%.
