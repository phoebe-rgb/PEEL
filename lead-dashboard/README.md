# SEG Lead Tracking — auto compare Netlify vs CRM

Tự động đối chiếu lead thu được trên **Netlify Forms** với lead thực sự vào **CRM (Salesforce)**,
rồi **tự cảnh báo qua Slack** khi có lead bị mất. Đây là phần Funnel không làm được
(Funnel chỉ xem thủ công, không có thông báo).

## Nguyên lý

Mỗi lần submit trên landing page sinh 1 `event_id` duy nhất, ghi đồng thời vào **Netlify Forms**
và **Pardot → Salesforce** (là trường *Submission Id*). Vì vậy:

> Lead có trong Netlify nhưng **không** có `event_id` tương ứng trong Salesforce = **lead bị mất**.

Đã kiểm chứng: 100% lead Netlify (930/930 tính đến 30/09/2026) đều có `event_id`, nên khớp nối đáng tin.

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
| `SALESFORCE_CSV_URL` | ✅ | **Mắt xích còn thiếu.** URL 1 file CSV chứa Submission Id của lead đã vào Salesforce — ví dụ 1 Google Sheet (report Salesforce export sang) đã *Publish to web → CSV*. Function chỉ cần quét ra các `event_id`. |
| `SLACK_WEBHOOK_URL` | ✅ | Slack Incoming Webhook của kênh nhận cảnh báo. |
| `ALERT_LAG_DAYS` | ❌ | Số ngày chờ trước khi coi là mất (mặc định 2, do export Salesforce trễ ~1 ngày). |
| `ALERT_WINDOW_DAYS` | ❌ | Cửa sổ tính "lead vừa mất" để báo hằng ngày (mặc định 3). |
| `SITE_MAP` | ❌ | JSON `{siteId: "BRAND"}` nếu đổi danh sách site. Mặc định đã gắn 4 site SEG. |

4 site SEG đang gắn sẵn: CAAS (`36b518a4…`), SHMS (`0643bf0d…`), HIM (`a29a7635…`), CRCS (`45589786…`).

## Deploy

```bash
# từ thư mục lead-dashboard/
netlify sites:create --name seg-lead-tracking     # hoặc dùng site có sẵn
netlify env:set NETLIFY_API_TOKEN   "xxxx"
netlify env:set SALESFORCE_CSV_URL  "https://docs.google.com/.../pub?output=csv"
netlify env:set SLACK_WEBHOOK_URL   "https://hooks.slack.com/services/xxx"
netlify deploy --prod
```

Chạy thử cảnh báo ngay (không đợi lịch): mở `/.netlify/functions/lost-lead-alert` trên trình duyệt,
hoặc `netlify functions:invoke lost-lead-alert`.

## ⚠️ Bảo mật

Trang và dữ liệu chứa **thông tin liên hệ lead thật**. Bật **password protection** cho site
(Site settings → Access & security) hoặc giới hạn SSO team — **không để public**.

## Còn thiếu để chạy tự động

1 nguồn CRM đọc được bằng máy (`SALESFORCE_CSV_URL`). Cần lấy từ freelancer / Salesforce admin:
report Salesforce lọc theo *Submission Id* export sang Google Sheet auto-refresh. Có cái này là auto-tracking chạy đầy đủ.
