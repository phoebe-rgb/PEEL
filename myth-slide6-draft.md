# Myth Studio — draft reply cho Lucie (slide 6: Campaign Timeline)

Nguồn: #myth_ppc, launch 25/05/2026 → Long join 23/09/2026 → pause 19/10/2026.
Gom theo workstream (ý Lucie) nhưng **có ngày ở từng dòng** để thành timeline thật.

Dán vào thread #client-myth-studio (thread của Piers "just checking we are doing
the end of campaign report"), reply message của Lucie 09/11.

---

Hi @Lucie, adding what we did before @Long joined — the campaign ran from 25 May, Long came on 23 Sep, we paused on 19 Oct. Grouped by workstream so it doesn't read as a day-by-day log, but I've kept the dates on each line so you can see the work was continuous rather than back-loaded. Happy to strip the dates for the client version.

**Negative keywords — running continuously from week one**
• 29 May: search terms wired into Funnel and the automated review built — flagged candidates to a Google Sheet, short summary to Slack
• 30 May: first run (27–30 May) flagged 252 terms, scored against 9 irrelevant-traffic categories: AI video tools, animation software/DIY, named competitor studios, stop motion, non-London UK cities, VFX/post-production, freelancer signals, explainer videos, kids/anime
• 1 Jun: moved to a daily trigger — phrase-match keywords were pulling heavy impressions
• 2–11 Jun: 268, 228, 64 and 90 terms flagged across four runs. Competitor studio names were the biggest drain (93–98 terms a run: Pixar, Aardman, Blue Zoo, Escape Studios, Dreamworks London), then AI tools (higgsfield 117 impressions, pollo ai 70, popvid 51, renderforest 26)
• 10 Jun: fixed overlapping review windows — moved to every 2 days on a 2-day range so terms weren't counted twice
• 13 Jun – 28 Jul: runs settled at 19–51 terms each. Flagged volume dropped from 250–300 a run at launch to 20–50 — the list was working

**Job enquiries and other non-buyer traffic — four separate angles**
• Through the review: freelancer-signal negatives (animator for hire, showreel, 2d animators, uk animation directory)
• 3 Jun: flagged that leads with no UTMs were arriving from the general contact form, not the ads
• 26 Jun: traced the "created by Izzy/Piers" leads to that same form, and asked for landing-page capture in Zapier so they could at least be sourced
• 30 Jun: agreed to filter the Zap to pass only leads carrying UTMs, so job applications and agency pitches stopped clogging the paid funnel in Pipedrive
• 3 Sep: negative in-market audiences applied to both live campaigns
• Explainer ad group paused at the client's request

**Keyword and theme analysis**
• 2 Jun: AI / hybrid theme was pulling broad AI-tool traffic and the client had said AI wasn't their focus, so we moved to isolate it on its own low budget
• 4 Jun: re-checked before acting — AI was only 15% of spend, so we left the structure alone rather than reset Google's learning
• 15 Jun: Brand ad group launched. 23 Jun: turned off after a lead came through it — nobody was bidding on Myth's name, so we were paying for a conversion we'd have had for free. Also decided against competitor brand terms: more expensive, lower conversion rate
• 24 Jun: reviewed splitting themes out and held off — only Animation Company (8 leads, CPL £165) and Hybrid AI (1 lead, CPL £208) had data. Focused instead on ad copy, sitelinks and negatives
• 1 Jul: after James' feedback that the keywords read as industry jargon, rebuilt the set around buyer language and delivered a reworked keyword sheet
• 20 Jul: P2 analysis — the generic animation company / studio / agency group was driving ~70% of both spend and leads, while 2D and 3D had spent ~£600 with no conversions. Proposed ring-fenced budgets: Core 60–65%, Positioning 25%
• 24 Jul: new campaign structure proposal shared as a deck for sign-off, plus UK volume research on Broadcast & Title Sequences

**Restructure**
• 12 Jun: root-caused the underspend — one campaign on a shared £70/day cap, Animation Company taking ~67% of it while Fast / Expedited had received £1.56 in 18 days. The theme had never had the budget to prove itself either way. Cycle budget was £4,000 and we were 18 days in at £1,138
• 12 Jun: proposed splitting into separate campaigns with their own daily budgets so every theme got a real test, with a staged scale-up (£90 → £120 → £150/day) to land the full cycle budget

**Conversion events and tracking**
• 29 May: completed Google advertiser verification so the logo showed in the ads
• 1 Jun: fixed Google Ads conversion tracking and cleared the test leads out of Pipedrive
• 9 Jun: set conversion value to £2,500 on the lead form (£50k average deal × 5% paid win rate), counting one per click on a 30-day window
• 8 Jul: traced the gap where GA logged 5 conversions with no CRM leads — two separate form flows, so the success event only confirmed the tracking API had responded, not that the lead reached the CRM

**Bid strategy — tuned throughout**
• 12 Jun: started on Max clicks deliberately, to get a clean read on targeting before handing Google the conversion signal
• 15–19 Jun: moved to Max conversions, spend stalled at £7 over three days, back to clicks, then back again once it overspent without leads — too little volume for Google to learn on
• 5–6 Jul: campaign stopped spending for three days with lost IS (rank) above 90%. Rather than assume it was the ad copy, we found the 2 Jul target CPA change hadn't saved but had still pushed the campaign into re-learning

**Measurement and reporting**
• 2 Jun: built the Looker Studio dashboard. 3 Jun: added lead status by theme — cold / warm / hot alongside cost and lead counts
• 3 Jun: found and fixed a ~40% gap between Funnel and Google Ads caused by sync lag, and moved the daily snapshot later in the morning
• 4–5 Jun: Funnel's search-term dimension was returning null, so built a daily Google Ads export to a Sheet and fed that in instead. 11 Jun: dashboard updated with the full search-term data

One to add to **Key learnings**: job enquiries were the hardest thing to filter. The same keywords that bring real briefs also bring people looking for work, so no negative list removes them completely without cutting into real demand too.

---

## Ghi chú thêm (không trong draft)

- Remaining budget tới 26/10: 2.616 (Phoebe đã trả lời Piers trong thread).
- Ad scheduling: client muốn chỉ chạy Mon–Fri giờ UK để kịp phản hồi; mình đề xuất
  email tự động ~10 phút sau khi có lead thay vì tắt ads cuối tuần. Có thể dùng làm
  ví dụ "mình chủ động đề xuất cách giữ lead" nếu muốn thêm 1 dòng.
- Lucie nói rõ "without tying them to specific months". Draft trên vẫn gom theo
  workstream nên không đọc ra kiểu "tháng 10 mới làm", nhưng nếu bản cho client cần
  sạch hoàn toàn thì bỏ ngày đi là xong — nội dung không đổi.
