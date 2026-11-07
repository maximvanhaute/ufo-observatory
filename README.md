# UFO Observatory

We built UFO Observatory for our Vlerick Modern Data Platforms group assignment. We use Microsoft Fabric to prepare our data and a responsive web app to explore the reports through maps, charts, filters, and original source accounts.

**[Open our live app](https://ufo-observatory-vlerick.vercel.app)**

## What we explore

Our exploratory question is: **Where and when do people in the United States report UFO sightings, and how do the reported shapes vary?**

We use the app to:

- Open directly on the interactive state map. Selecting a state leaves it green and filters our report explorer. Selecting it again restores all states.
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
| Unique report IDs retained | 139,887 |
| Reports mapped to the 50 US states and Washington, DC | 139,671 |
| Territory reports retained outside that map | 216 |
| Reports eligible for time charts | 139,872 |
| Pre-1900 dates retained with a review flag | 15 |
| Reports without a supplied summary | 68 |
| Source indicates media: Yes / No | 6,836 / 133,051 |

Our usable occurrence dates span **6 July 1905 to 6 March 2026**. We preserve every supplied report ID and source link. We keep missing summaries missing, retain the source's `Unknown/Other` shape category, and distinguish an explicit `No` media label from missing information.

We use `Date_Fixed` in month-day-year order and the supplied `TimeOnly` values. We ignore `Date`, `Time`, and `Date_Corrected`. Our adapter also supports the spelling `Only_Time`. Both supplied files contain one JSON object per line. We retain population as a separate state/year dimension and also add the matching `state_population` to each report. We explain our rules and source fingerprints in [our data preparation guide](docs/data-preparation.md).

Our map is the first main panel in Explore and Population. On the Population map, state selection leaves only the chosen state green while the scatter and ranking retain the wider comparison. We place the fact carousel and summary cards below the map.

We use the user-supplied UFO landing sound by Altered Sound Effects. The opening sound attempts to play when visitors enter with sound enabled. Browser autoplay rules may require their first click. The header offers play, stop, and replay controls, and a saved mute preference is respected. We record the creator and source in [our audio attribution](docs/audio-source.md).

## Our population comparison

We open **Patterns → Population** and choose one occurrence year. We start with **2024**, the latest population year. The scatter plot compares population against report count. We can switch the ranking and map between total reports and reports per 100,000 residents. Selecting a state highlights it across the comparison and offers its source reports.

We join population on **state code + occurrence year** and use each state-year denominator once. Our rate is the filtered report count divided by that state’s population in the same year, multiplied by 100,000. Shape, month, local hour, media, and search filters affect the count. State selection highlights the comparison rather than reducing it to one point. Our CSV includes counts, denominators, rates, and unmatched-state status.

For 2024, we compare **3,370 reports across 49 states and DC**. California has 334 reports (0.85 per 100,000), and Montana has 35 (3.08 per 100,000). Alaska’s recent population is missing from the supplied file. Population stops at 2024, so we show an unavailable state for 2025–2026. We fill DC’s abbreviation from its exact full name. The population file’s original publisher and estimation method remain unprovided and are disclosed in the app.

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

Our current suite has **19 JavaScript checks and two Python importer checks**. We run the Python checks with `python3 -m unittest discover -s tests -p "test_*.py"`, or run both suites with `npm test`. Our [verification record](docs/verification.md) distinguishes automated checks, full source reconciliation, and sampled browser checks.

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
