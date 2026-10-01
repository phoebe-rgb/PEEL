export function MustRead() {
  return (
    <div className="mustread">
      <div className="pagehead"><div><h2 className="page">How to read this dashboard</h2><p className="lede">Goal: open it and know right away what happened, why, and what to do next. <b>Only ACT campaigns are included</b> (BRAND, CONV and NURT are left out); Budget & Pacing is the exception because the plan covers all paid spend.</p></div></div>

      <section className="block tone-cards"><header className="block-head"><div><span className="block-tag">Pages</span><h3>Four pages</h3></div></header><div className="block-body">
        <ul>
          <li><b>Performance</b> — three views. <b>Boss:</b> scorecards → timeline → headline → York-style <b>drill-down</b> School → Country → Channel (frozen header and first column; each cell = value, change and the last three periods; full funnel with costs; Result; an insight for each channel — what happened and why, no ad-set or ad detail) → budget moves between campaigns. <b>Google Ads</b> and <b>Meta:</b> scorecards → timeline → weekly read (Meta ad sets and ads: L7 spend / leads / CPL, L14 good leads, CPGL, register, CPReg, applied, accepted, each with the change vs P7 / P14) → comparison pivot (tick columns; equal values are merged in tick order) → budget allocation.</li>
          <li><b>💬 Comments</b> (bottom right, every page): <b>📍 Point to a table or row</b>, write, tag people with @Name, tick <b>Needs action</b> to put it on the Actions page, then <b>Save</b>. Hover a saved comment to light up the exact spot it points to (or "Show on …" to jump to its page / view). Reply under any comment. When you have finished reviewing, press <b>📨 I'm done — send my comments to Slack</b>: one message lists your action items first (what, where, which period) and then your other comments.</li>
          <li><b>Budget & Pacing</b> — plan vs spend at an even daily pace, what to do per school · channel line, next month's daily budget, by month and by area.</li>
          <li><b>Search Keywords</b> — Google search terms and keywords, winners and waste, and a negative-keyword list ready to paste into Google Ads or Google Ads Editor.</li>
          <li><b>Actions</b> — owners (Google Ads → John, Meta → Phoebe), deadline Wednesday. <b>✓ Done</b> needs what changed and why; <b>✕ Dismiss</b> needs a reason. Done and Dismissed show the effect since (7 days before vs the days after). The Thursday review lists what was done, dismissed, and what nobody touched while results got worse. Weekly Slack: Monday team review call, Tuesday action lists, Thursday review.</li>
        </ul>
      </div></section>

      <section className="block tone-analysis"><header className="block-head"><div><span className="block-tag">Funnel</span><h3>The funnel and the score</h3></div></header><div className="block-body">
        <p>Lead (created in CRM) → Good Lead (High Potential, Online Application or Nurturing) → Register (portal) → Applied (applied or accepted) → Accepted. Each stage is counted on its own CRM date, so rates such as GL/Lead are period ratios, not a cohort.</p>
        <div className="panel formula"><div className="big">Funnel score = Lead × 1 + Good Lead × 3 + Applied × 6 + Accepted × 10</div><div>Cost per score point = Spend ÷ Funnel score</div></div>
        <ul>
          <li>Deeper stages are closer to an enrolled student, so they weigh more (SEG's official ranking rule). Example: 40 leads, 6 good leads, 2 applied, 1 accepted = 40 + 18 + 12 + 10 = <b>80 points</b>; at CHF 800 that is CHF 10 per point.</li>
          <li><b>Verdict:</b> Better / Worse / Mixed / Stable compares the score and cost per point between the two periods (±10% is a move). Under 10 points on both sides = Low volume.</li>
          <li>Good leads and later stages lag the lead by days to weeks: the latest week always under-counts them, so read quality over 2+ weeks.</li>
        </ul>
      </div></section>

      <section className="block tone-charts"><header className="block-head"><div><span className="block-tag">Compare</span><h3>Comparisons and colours</h3></div></header><div className="block-body">
        <ul>
          <li><b>View</b> picks the period: Week, Month, Cycle to date (1 Aug–31 Jul) or a date range (start and end date; before 3 Aug 2026 history is weekly, so a week counts when its Thursday is inside the range). <b>Compare to</b> picks the other side: <b>Previous period</b> (the week/month before, on the same days while the period is running) or <b>Same period last year</b> (same ISO weeks or calendar month; last year only has whole weeks, so an unfinished week cannot be compared).</li>
          <li>Card values always show all selected data; the change uses the matched comparison. Green = better, red = worse, grey = within ±5–10%. Spend is never coloured. A tiny previous value shows "small base".</li>
          <li><b>Timeline:</b> volumes are columns (count axis on the left; spend/budget on the CHF axis), costs are lines (CHF axis, right) and rates are dashed lines (% axis). Faded columns are unfinished periods.</li>
        </ul>
      </div></section>

      <section className="block tone-tables"><header className="block-head"><div><span className="block-tag">Rules</span><h3>How insights and actions are made</h3></div></header><div className="block-body">
        <ul>
          <li><b>Breakdown order:</b> School → Country → Channel → Activity (BRAND · ACT · CONV · NURT) → Campaign.</li>
          <li><b>Why:</b> CPL = CPM ÷ 1000 ÷ CTR ÷ click-to-lead rate; the biggest mover is named, then the part (country, channel, audience…) that drove most of the Good-Lead change.</li>
          <li><b>Colour of a row:</b> green when its cost per good lead is ≤80% of its parent's (with ≥3 good leads) or its Result is Better; red when ≥140%, when it spends without good leads, or its Result is Worse; yellow otherwise; grey when too small.</li>
          <li><b>Deep insight:</b> the three-period trend (e.g. "good leads have fallen two periods in a row"), the funnel lever that moved most (reach cost / CPC, CTR, click→lead, GL rate, register rate) translated into what it means, the audience / theme / ad (Meta) or campaign type / search intent / campaign (Google) that drove the change or wastes money, and the latest PPC review / Meta weekly-read flags. Next steps come from those, most specific first.</li>
          <li><b>Budget allocation.</b> Budget moves <b>between campaigns</b> of the same school · country · channel — each campaign is one program target (Meta, e.g. Parents → Master's) or keyword theme (Google: Brand, Generic, Program – Bachelor / Master / Diploma, PMax). One card per line. Meta also has: target audiences (ad sets) <b>inside one campaign</b>, and switching weak ads / themes off inside a campaign. Evidence: last 28 days vs the 28 before; move = 25% of the weaker campaign's weekly spend; forecast assumes the stronger one keeps its cost per good lead minus 15%. Brand is demand-limited, so only "Test with half".</li>
          <li><b>Next / reallocation:</b> move budget from an option whose cost per good lead is ≥40% higher (or that spends without good leads) to the most efficient one with at least 3 good leads; the card estimates the extra good leads if the better option keeps its cost. <b>Budget call</b> in the matrix: Increase ≤80% of the average CPGL with ≥3 GL, Reduce ≥140% or spend without GL, otherwise Hold.</li>
          <li><b>Meta weekly read (ACT):</b> 🔴 L7 CPL more than 20% worse than P7 (🟡 when 1–2 leads make it noise) or spend with no leads; 🟡 CPGL worse L14 vs P14 or leads not qualifying. Ads: 🟢 good lead at or below the entry's CPGL, 🔴 spend ≥ entry CPGL with no good lead.</li>
          <li><b>Google PPC review (ACT):</b> daily budget ≥ CHF 20 → 3-day lead check, otherwise 7-day; alerts above 150% of the School × Country benchmark or +30% vs the previous window; scale when 14-day CPGL and GL rate beat benchmark.</li>
          <li><b>Budget:</b> Funnel posts each month's budget on the 1st, per school × channel; expected by now = the month's plan × days elapsed ÷ days in month; ±10% is on pace. <b>What to do</b> lists only under / over lines, split by country: an under-pace line's daily gap goes to its countries with the best 28-day cost per good lead (max +60% each); an over-pace line is cut from the least efficient countries first (max −50% each).</li>
          <li><b>Negatives:</b> search terms with the minimum spend and 2+ clicks, no conversion, not one of your keywords and no brand name.</li>
        </ul>
      </div></section>

      <section className="block"><header className="block-head"><div><span className="block-tag">Names</span><h3>Where the breakdowns come from</h3></div></header><div className="block-body">
        <ul>
          <li><b>Market / country</b> = country code in the campaign name (PL_SCHOOL_CH_TYPE_REGION_<b>COUNTRY</b>_…); when the campaign targets a whole region (country ALL), the country comes from the ad set name (Region_<b>COUNTRY</b>_…, e.g. Americas_CA_… = Canada). <b>Program target</b> = level and programme tokens (Master's · Culinary-Mgmt, Swiss Diploma, Parents…).</li>
          <li><b>Channel type</b>: Google GA = Search, PMax, YT = YouTube, GDN = Display; Meta; LinkedIn.</li>
          <li><b>Theme</b> and <b>format</b> (Meta) from the ad name (safety_ / career_ / rank_ / global_ / heritage_ …, IMG / VID). <b>Audience:</b> Meta from the ad set name; Google from the campaign's search intent (Brand / Programme / Category), because Funnel has no Google ad groups.</li>
          <li>Known limits: 24/25 CRM leads carry no campaign, so campaign-level comparisons start in 25/26; frequency and reach are not in Funnel; retargeting and social-boosting leads cannot be attributed to one country.</li>
        </ul>
      </div></section>
    </div>
  );
}
