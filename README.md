# UFO Observatory

We built UFO Observatory for our Vlerick Modern Data Platforms group assignment. We use Microsoft Fabric to prepare our data and a responsive web app to explore the reports through maps, charts, filters, and original source accounts.

**[Open our live app](https://ufo-observatory-vlerick.vercel.app)**

## What we explore

Our main question is **where do UFO reports concentrate, and how does the ranking change when we account for state population?** We also explore when reports occur and how witnesses describe what they saw.

We use the app to:

- Select a state on our map and compare report counts.
- Explore occurrence years, months, local hours, and reported shapes with linked charts.
- Compare state populations with report counts, switch the ranking and map to reports per 100,000 residents, and open the selected state’s reports.
- Search summaries, read individual records, and follow their original NUFORC links.
- Combine filters, share a filtered URL, and export the selected reports as CSV.
- Use the same views on desktop and mobile, with an alien mascot, sourced UFO facts, and an opening UFO landing sound with play, stop, replay, and mute controls.

We interpret these as patterns in **self-reported accounts**. A report does not establish an extraterrestrial explanation, and several reports may describe one event.

## Our current data

We use `Final File Swear on god for now!.json`, the group’s corrected Fabric export, received on **7 November 2026**, alongside `State_Population.json`. Our app serves this snapshot; it does not query Fabric live.

| Measure | Current snapshot |
| --- | ---: |
| Final Fabric export rows | 139,887 |
| Unique report IDs in the app | 139,887 |
| Dashboard reports mapped to the 50 US states and Washington, DC | 139,671 |
| Territory reports retained outside that map | 216 |
| Reports in the year-by-year timeline | 139,872 |
| Reports with valid clock times in the hourly chart | 139,887 |
| Pre-1900 entries available in Reports | 15 |
| Reports without a supplied summary | 68 |
| Source indicates media: Yes / No | 6,836 / 133,051 |

Reports spans **approximately 1400 to 6 March 2026**. Dashboard totals cover the full collection. The year-by-year timeline uses reports dated 1900 onward, with the earliest plotted record dated **6 July 1905**. We preserve the original ID and source link of every included report. We keep missing summaries missing, retain the source's `Unknown/Other` shape category, and distinguish an explicit `No` media label from missing information.

We use `Date_Fixed` in month-day-year order and the supplied `TimeOnly` values. We ignore `Date`, `Time`, and `Date_Corrected`. Our adapter also supports the spelling `Only_Time`. Both supplied files contain one JSON object per line. We retain population as a separate state/year dimension and also add the matching `state_population` to each report. We explain our rules and source fingerprints in [our data preparation guide](docs/data-preparation.md).

We use the user-supplied UFO landing sound by Altered Sound Effects. The opening sound attempts to play when visitors enter with sound enabled. Browser autoplay rules may require their first click. The header offers play, stop, and replay controls, and a saved mute preference is respected. We record the creator and source in [our audio attribution](docs/audio-source.md).

## Our population comparison

We open **Patterns → Population** and choose one occurrence year or **All years · annual average**. We default to **All years**. Choosing a population period does not change the year filters on other pages. The scatter plot compares population against report count. We can switch the ranking and map between total reports and reports per 100,000 residents. Selecting a state highlights it across the comparison and offers its source reports.

We join population on **state code + occurrence year** and use each state-year denominator once. Our rate is the filtered report count divided by that state’s population in the same year, multiplied by 100,000. Shape, month, local hour, media, and search filters affect the count. State selection highlights the comparison rather than reducing it to one point. Our CSV includes counts, denominators, rates, and unmatched-state status.

In **All years**, we first calculate each state’s rate in each matched occurrence year, then take the arithmetic mean of those annual rates. This matches our group’s `AVG(Yearly_Rate_Per_100k)` query. Each active year has equal weight; a year is active when it has at least one filtered report and a matching population. Zero-report years do not enter that query or the app’s average. We show active-year counts in tooltips and CSV. The scatter and count ranking show mean reports and mean population over those same active years. This is an average across observed active years, not a rate over every calendar year.

The dashboard and Reports both use all **139,887** records. The all-years rate comparison uses **135,475** with matching populations. Of the **4,412** unmatched reports, **3,527** are from 2025–2026, after the population file ends; **885** have another missing state-year match. The supplied SQL without DC’s abbreviation repair uses 135,318 reports: its join drops DC’s 157 matched reports. Vermont leads the active-year rate at **1.94 per 100,000**, across **52 active years**. We reproduce all 24 hourly totals and every state average independently from the raw exports in [our reconciliation record](docs/feedback-reconciliation.json); [matching SQL](docs/reconciliation-queries.sql) uses the same population join and DC normalization.

For 2024, we compare **3,370 reports across 49 states and DC**. California has 334 reports (0.85 per 100,000), and Montana has 35 (3.08 per 100,000). Alaska’s recent population is missing from the supplied file. Population stops at 2024, so we show an unavailable state for 2025–2026. We fill DC’s abbreviation from its exact full name. Our presentation traces the population series to a Kaggle compilation of U.S. Census Bureau data.

## Our project walkthrough

We kept the original NUFORC snapshot in Fabric for auditing. We cleaned the records with Excel and Power Query, then used Spark SQL in Fabric to standardise fields and correct dates before exporting JSON. [Cleaning stages and row counts](docs/data-preparation.md#our-cleaning-stages)

1. In **Reports**, set the end year to **1899** to see the 15 historical entries. The oldest is a report about a photograph of rock art. NUFORC dates it to approximately 1400. [Historical reports](https://ufo-observatory-vlerick.vercel.app/?view=reports&to=1899)
2. In **Explore**, the map and hourly chart use the full collection. The busiest recorded hour is 9 PM with 19,975 reports, followed by 10 PM with 17,554. The timeline in Patterns starts with the first available report after 1900, in 1905. [Explore dashboard](https://ufo-observatory-vlerick.vercel.app/?view=explore)
3. In **Patterns → Population**, choose **All years** and compare **Reports / year** with **Per 100k / year**. California leads on average annual report count. Vermont leads the average rate at 1.94 per 100,000 residents, followed by Montana at 1.74 and Idaho at 1.54. Each rate averages the years with reports and a population match. [Population comparison](https://ufo-observatory-vlerick.vercel.app/?view=patterns&pattern=population&population_year=all)

## Run our app locally

We use **Node.js 24**. Running the committed app requires no package installation, build step, Fabric login, or API key. We need Python 3 only when regenerating the data files.

```sh
git clone https://github.com/maximvanhaute/ufo-observatory.git
cd ufo-observatory
node scripts/serve.mjs
```

We then open **http://127.0.0.1:4173**. Our supplied server sets the gzip headers needed to load the compressed report partitions; opening `index.html` directly will not load the app correctly.

We run our automated checks with:

```sh
node --test tests/*.test.mjs
```

Our current suite has **27 JavaScript checks and two Python importer checks**. We run the Python checks with `python3 -m unittest discover -s tests -p "test_*.py"`, or run both suites with `npm test`. Our [verification record](docs/verification.md) distinguishes automated checks, full source reconciliation, and sampled browser checks.

## How our data reaches the app

```mermaid
flowchart LR
  Fabric["Fabric: dbo.UFO_Sighting"] --> Export["Corrected sighting export"]
  Export --> Adapter["Python data adapter"]
  Population["State_Population.json"] --> Adapter
  Adapter --> Snapshot["Compressed reports, metadata and summaries"]
  Snapshot --> App["Browser app hosted on Vercel"]
```

We commit the generated snapshot and the code needed to load it. We keep the original `Corrected sighting export` outside Git. We use 14 compressed report partitions, each containing at most 10,000 records, to keep individual files manageable. Our browser recomputes chart counts from the filtered report records.

## Our repository

| Location | What we keep there |
| --- | --- |
| `dist/` | Our deployable HTML, CSS, JavaScript, and visual assets |
| `dist/data/` | Our generated snapshot, metadata, summaries, facts, and Census boundaries |
| `scripts/import_final_dataset.py` | Our Fabric-export adapter and date checks |
| `scripts/reference-dates.json.gz` | Date-only lookup retained for reproducing our previous export |
| `scripts/serve.mjs` | Our local server, including gzip response headers |
| `tests/` | Our data-engine and loader regression checks |
| `docs/` | Our preparation rules, validation evidence, release steps, and AI disclosure |

## Our documentation

- [Data preparation and field definitions](docs/data-preparation.md)
- [Verification results and limits](docs/verification.md)
- [Development, data updates, and deployment](docs/development.md)
- [Our use of generative AI](docs/ai-disclosure.md)
- [Original image-generation prompts](docs/asset-prompts.md)
- [Our original cleaning notes](docs/Data%20Cleaning%20Steps.docx)

## Limits and reuse

We work with a **US-only cleaned export**, not the complete NUFORC archive. We show report counts and offer a Population view with rates based on matching state-year denominators. We treat hours as local wall-clock values because the source provides no timezones. Our map uses Census state boundaries rather than witness coordinates. Our current export supplies no duration field, and we have not joined duration from another dataset.

Our repository is public, but public availability does not establish permission to reuse the underlying report content. We do not assert a new open licence over NUFORC data; upstream reuse permission remains unresolved. We retain the [NUFORC terms](https://nuforc.org/terms/) link so readers can examine the source's conditions. The bundled D3 library has its own [ISC licence](dist/vendor/D3-LICENSE.txt).

We used **Codex** for code, data adaptation, checks, and documentation, and an **OpenAI image-generation tool** for our decorative artwork. We describe those contributions and the checks we performed in [our AI disclosure](docs/ai-disclosure.md). We remain responsible for the project and its interpretation.
