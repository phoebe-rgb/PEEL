---
name: english-spaced-review
description: Daily English vocabulary and model-sentence routine with spaced review (same day, 1 day, 3 days, 7 days) tracked in a Google Sheet. Use when the user sends a list of new English words or sentence patterns to learn, asks for today's review ("bài ôn hôm nay", "ôn từ"), reports quiz results, or asks to fill the vocabulary sheet.
---

# English spaced review routine

Language of instructions to the user: Vietnamese. Language of study content: English.
Default timezone: Asia/Saigon. "Today" means today's date in that timezone.

## Configuration (edit when moving to another account)

- SHEET_ID: 1LX4mBGsr9dyZr4xt7ba1yCeKi1K5REIpQ2O-QBoCAhw
- Tab: Sheet1
- Needs the Google Sheets connector with edit access to that sheet. If the connector is missing or the sheet is not shared with this account, stop and tell the user in one short message what to turn on or share. Do not create a new sheet.

## Sheet layout (row 1 is the header, data starts at row 2)

| Col | Header | What goes in it |
|---|---|---|
| A | Date | Study date, shown dd/mm/yyyy. Write it as ISO text (2026-10-06) so Sheets parses it as a date. |
| B | Word/model sentence | One line only, in English: the word with part of speech, e.g. `bill (n)`, or the full sentence pattern with ___ for blanks. No Vietnamese meaning and no second line. |
| C | Phát âm | One line only, American English (General American IPA), written as `US /…/`. For a sentence, give the full line in IPA and use … for the blanks. No UK pronunciation. |
| D | Explain in English | One or two plain sentences. Add a usage note when the word has several senses, a fixed idiom, or is informal or British slang. |
| E | Example | One to three example sentences, one per line, original and natural. For a sentence pattern, give examples about other topics. |
| F | Print to my mind | `Thuộc` or `Chưa thuộc`, set after the two same-day tests. |
| G | 1 day check | `Thuộc` or `Chưa thuộc` after the next-day review. |
| H | 3 days check | Same values. Only filled for items that qualified (see below). |
| I | 7 days check | Same values. Filled for every item. |

Columns F to I have a dropdown with exactly `Thuộc` and `Chưa thuộc`. A blank cell means not yet checked or not required.
Do not change the existing header names, order, or other people's rows. Never clear or overwrite rows you did not write in this run.

## Flow 1: the user sends a new list (day 0)

1. Fix obvious typos and merge duplicates. Tell the user what you corrected (for example "ropin" to "robin").
2. Sort each item into a tier by how common it is in everyday native English:
   - Tier 1 (core): frequent, useful in many topics.
   - Tier 2 (useful): fairly common or valuable for learners.
   - Tier 3 (recognise only): rare, technical, or tied to one topic (animal names, jargon, slang from one source).
   The user's standing preference: write only model sentences plus Tier 1 and Tier 2 items. Do not write Tier 3 items. Say which items were left out and why, in one line, so the user can ask for them.
3. Fill the rows. Find the next empty row by reading `A:A`. Order: model sentences first, then Tier 1, then Tier 2. Use `update_values` for A:E only. Leave F to I empty.
4. Do not put Vietnamese in column B. Vietnamese is only for instructions in chat and in the exercise files. Pronunciation must be checked item by item. If you are unsure of an IPA symbol, say so instead of guessing.
5. Read the rows back and confirm date format, line breaks, and that nothing else changed.
6. Produce today's exercise sheet (see "Exercises"). Prefer a printable Word file (.docx) with an answer key on the last page. If a file cannot be made, put the exercises in the chat.

## Flow 2: daily review (run each morning, or when the user asks)

Read `A:I`. Convert column A to dates. Let T = today.

| Review | Which rows | Result goes in |
|---|---|---|
| 1-day | every row with date = T minus 1 | G |
| 3-day | rows with date = T minus 3 where F = `Chưa thuộc` OR G = `Chưa thuộc` (the user failed a same-day test or the 1-day check) | H |
| 7-day | every row with date = T minus 7, whatever its status | I |

- If a review set is empty, say so in one line and skip that exercise.
- Items that were `Thuộc` in F and G are not part of the 3-day review. Leave H blank for them.
- Build one combined review sheet for the day: three clearly labelled parts, shortest first. Keep it short enough for about 15 to 20 minutes.
- Do not write to the sheet until the user reports results. Then write only the correct cell (G, H or I) for each item.
- If an item is still `Chưa thuộc` after the 7-day check, tell the user and ask whether to add it again as a new row in a future batch.
- If the user missed days, do not skip: run every review whose due date has passed and mention they are late.

## Same-day tests and column F

- Test 1: right after studying, Vietnamese to English recall with the sheet covered.
- Test 2: in the evening, at least 4 hours after Test 1, translate whole sentences that use the words and patterns.
- F = `Thuộc` only if the item was right in both tests. Otherwise `Chưa thuộc`.
- The user reports results in chat (for example "thuộc: bill, precisely; chưa thuộc: ontology"). Write F for every item of that day, not only the ones mentioned. Items not mentioned: ask once before assuming.

## Exercises (day 0)

Keep this order, all with an answer key at the end:
1. Pronunciation drill: listen and repeat the American pronunciation using a dictionary site.
2. Matching words with short English definitions.
3. Gap-fill sentences with a word bank.
4. Word families and multi-sense words (for example bill, reliable and reliably).
5. US pronunciation: read the IPA in column C aloud, then mark the three hardest words and the sound that trips the user.
6. Sentence patterns: the user writes two sentences about their own life for each pattern.
7. Test 1 and Test 2 as above, then a self-scoring table that maps to column F.

Review sheets (day 1, 3, 7) are shorter: quick recall, two or three gap-fills, one translation per pattern.

## Content rules

- Examples are original sentences. Do not paste long passages from podcasts, books or transcripts. Short quotes of a phrase from the user's own source are fine.
- Judgements of how common a word is come from general knowledge, not from a frequency list. Say that when the user asks.
- Use American pronunciation only (the user dropped UK). Use the user's spelling variety only if they state one; otherwise note both (for example categorise / categorize).
- Be direct about uncertainty. Mark an IPA, a meaning or a usage note as uncertain instead of inventing one.
- Reply in Vietnamese, keep it short, and always end a day-0 or review message with exactly what the user must do next (which tests, and how to report results).
