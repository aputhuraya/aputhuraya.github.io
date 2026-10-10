# PROTOTYPE copy deck

Three variants of the portfolio home page, one file each in this folder
(`variant-a.html`, `variant-b.html`, `variant-c.html`), switchable with the
floating bar from `switcher.js`. Every variant uses THIS copy, word for word.
Variants differ in layout, not in words. Throwaway: delete this folder once a
variant wins and is folded into `index.html`.

Rules for all copy: no em-dashes, no en-dashes as dashes, no dollar figures.
Numbers are percentages and counts only.

---

## Head

- `<title>`: Anish Puthuraya
- meta description: Anish Puthuraya, Data & AI Leader. Leading data engineering and AI in the hospitality industry.

## Nav

- Name: ANISH PUTHURAYA
- Links: Work (#work), Talks (#talks), Experience (#experience)
- CTA button: Contact (#contact)

## Hero

- Label: DATA & AI LEADER
- H1: Leading data engineering and AI in the hospitality industry.
- Focus areas (4, in this order): Data strategy / Platform architecture / Data governance / Applied AI
- Buttons: See the work (#work), Get in touch (#contact)
- Photo: ../assets/portrait.jpg, alt "Anish Puthuraya"

## Stats (4)

| Value | Label |
|---|---|
| 7+ | Years in data |
| 40% → 16% | Forecast error, after measuring it |
| 600+ | AI changes, each approved by a person |
| 3 | Talks given in 2026 |

## Work (section label: 01 / WORK)

Each project has a number, a plain name, tags, three short lines, and one small chart.

### 01 Revenue planning app

- Tags: WEB APP · MICROSOFT FABRIC · AZURE
- Problem: Forecasts and budgets lived in a vendor tool, an Access app and spreadsheets.
- Move: Took a design prototype to production with 2 engineers and AI coding agents, behind automated release checks.
- Result: In production in 10 weeks, now in pilot. Daily, monthly and P&L views agree to the penny.
- Chart: a 10-week timeline. Ticks for weeks 1 to 10. A dot at week 0 labelled "Prototype". A filled dot at week 10 labelled "Live". Caption: "Prototype to production: 10 weeks".

### 02 Forecasting platform

- Tags: MACHINE LEARNING · MICROSOFT FABRIC
- Problem: Forecasts drove decisions, but no one had measured how far off they were.
- Move: Tested every model against real results, then fixed the defects the numbers showed.
- Result: Error on past data fell from 40% to 16%. Monthly forecasts now cover 100+ hotels.
- Chart: two horizontal bars. "Before" 40% (grey), "After" 16% (blue). Caption: "Forecast error".

### 03 Database knowledge agent

- Tags: AI AGENTS · GOVERNANCE
- Problem: An 8.2 TB production database had no documentation.
- Move: Built an AI agent that maps and documents it, and asks a person before any change.
- Result: 600+ changes made. Every one approved by a person.
- Chart: a 4-step flow in boxes joined by arrows: Draft → Dry run → Person approves → Applied. The "Person approves" box is blue. Caption: "600+ changes, 0 unattended".

## How I lead (section label: 02 / HOW I LEAD)

Four principles. The line is the principle. The small line under it is the proof.

1. Check the number where people read it.
   Proof: Every fix is checked in the report people use, not only in the table.
2. No AI change goes live until a person approves it.
   Proof: 600+ AI changes so far. None ran on their own.
3. When the data says a claim is wrong, take the claim back.
   Proof: We retracted our own "model beats humans" result after a units check.
4. Every finding ends as explained, ruled out, or still open.
   Proof: Nothing gets dropped because a tidier story came along.

## Talks (section label: 03 / TALKS)

Order: upcoming first, then newest to oldest.

### Upcoming

- Event: devopsdays Boston
- Date: Oct 19-20, 2026
- Place: Cambridge, MA
- Format: Conference session
- Title: We Gave the Agent Production Credentials
- Status badge: UPCOMING
- No photo. Show as a typographic card (blue background works well).

### 1. Day of Data Pittsburgh (SQLSaturday)

- Date: Oct 10, 2026
- Place: Pittsburgh, PA
- Format: 60-minute session
- Title: The Best Model Was a Ratio: Hybrid Forecasting on Microsoft Fabric
- Room: Data professionals at a free, community-run conference
- Photos: ../assets/talks/pgh-teaching.jpg (16:9), ../assets/talks/pgh-speaking.jpg (4:5)

### 2. devopsdays Philadelphia

- Date: Oct 2, 2026
- Place: Philadelphia, PA
- Format: Ignite talk
- Title: We Gave the Agent Production Credentials
- Room: DevOps and platform engineers
- Photos: ../assets/talks/phl-stage.jpg (16:9), ../assets/talks/phl-gesture.jpg (4:5), ../assets/talks/phl-podium.jpg (4:5), ../assets/talks/phl-badge.jpg (square)

### 3. SIM Boston (Society for Information Management)

- Date: Mar 19, 2026
- Place: Boston, MA
- Format: Interactive session
- Title: Build Trust in Your Data with Transparency
- Room: CIOs and technology executives
- No photo. Show as a typographic card.

Every photo also exists as a blue duotone: same name with `-duo` before `.jpg`
(for example `../assets/talks/phl-stage-duo.jpg`). All photo alt text:
"Anish Puthuraya speaking at <event>".

## Experience (section label: 04 / EXPERIENCE)

### Senior Manager, Data Engineering

- Subtitle: Data & AI Leader
- Org: Pyramid Global Hospitality · Boston, MA
- Dates: 2023 to PRESENT
- Points:
  - Lead a team of 3 data engineers and partner with the COO and analytics leadership on data strategy.
  - Rebuilt the enterprise data platform on Microsoft Fabric as a medallion lakehouse, joining Opera, Amadeus, Salesforce and Delphi data.
  - Moved 250+ Azure workloads from personal logins to managed identities, with no major failures.
  - Cut cloud costs through an infrastructure audit, and built AI data quality checks that run five times a day.

### Associate II

- Org: PwC · Bangalore, India
- Dates: 2021 to 2022
- Points:
  - Led a two-person Cloud Analytics team for Nordstrom, building inventory tracking.
  - Tuned Spark clusters for 5x higher efficiency and a 50% cut in infrastructure costs.
  - Shipped ML models on Azure Databricks that predict claims.

### Project Engineer

- Org: Wipro Technologies · Pune, India
- Dates: 2018 to 2021
- Points:
  - Delivered analytics and automation for enterprise clients with Microsoft Power Platform and Power BI.

### Education & certification

- M.S. in Business Analytics, Boston University, Questrom School of Business, 2023
- B.Tech., IIT Bombay, 2018
- Microsoft Certified: Azure Data Engineer Associate (DP-203)

## Contact (section label: 05 / CONTACT)

- Headline: Let's talk data.
- Email: anish.gopalakrishna@gmail.com (mailto link)
- Links: LinkedIn https://linkedin.com/in/anish-puthuraya, GitHub https://github.com/aputhuraya
- Location: Boston, MA
