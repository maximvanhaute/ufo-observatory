# Verification record

## Corrected export and population comparison — 7 November 2026

We checked the current corrected source against the complete prepared output by original NUFORC ID. All 139,887 IDs, corrected occurrence dates and times, links, cities, summaries, and media values reconcile with the supplied file. The raw fingerprints are recorded in dataset-import-checks.json and the manifest.

We retained 139,872 time-eligible reports, 139,671 mapped reports, 216 territory reports, and 15 flagged dates. Every prepared report’s population value matches the dimension for its occurrence state and year, or remains null when unavailable.

### Automated checks

We run 19 JavaScript checks and two Python importer checks, including subcases for both TimeOnly and Only_Time. The importer regression uses invalid Date and Date_Corrected values and an unrelated synthetic Time timestamp, and verifies the correct occurrence date and local time still come exclusively from the corrected fields. It also verifies that corrected imports work without the legacy date reference.

We check that duplicate population keys fail, zero reports remain zero with a positive denominator, missing populations remain null, and state selection preserves the comparison. For 2024, the 50 matched state/DC rows contain 3,370 reports. California has 334 reports and 39,431,263 residents, giving 0.85 per 100,000. Montana has 35 reports and 1,137,233 residents, giving 3.08 per 100,000.

### Browser checks

We tested the following through the local app’s controls:

- Population opens from Patterns, with 50 scatter dots and Montana leading the rate ranking.
- Switching to total reports changes the ranking leader to California and updates map shading.
- Keyboard selection of Montana highlights it, preserves all comparison points, and opens its 35 reports for 2024.
- Report details show the matching occurrence-year population.
- A 2025 selection has 0/51 population coverage, no rate dots, and a visible unavailable-data note.
- A triangle filter changes the matched 2024 report count to 260 and updates the selected state’s rate.
- The URL restores the selected state, year, shape, and measure after reload.
- Export CSV activates the population-specific export. Automated CSV checks verify all 51 state/DC rows and blank denominators for missing population.
- The original time-and-shape view still renders its 288 heatmap cells.
- At a 375px phone viewport, document width equals viewport width. The filter drawer, selected-state details, and ranking work.
- Alaska can be selected on the map while its unavailable population stays explicit.

We observed no browser warnings or errors in those inspected flows. These are sampled interaction checks, alongside full source reconciliation.

We disclose that the population file ends in 2024, lacks recent Alaska values, and has no supplied original publisher or estimation method. Rates describe filtered self-reported accounts.

## Earlier verification records

## Fabric final export — 3 November 2026

We adapted our app to `Final_Dataset.json`, received from our Fabric table `dbo.UFO_Sighting`. We retained the existing design, assets, navigation, and chart types. We identify this input with SHA-256 `e8fee608e876cb9ad8a97d097586693deae6b753cf7ae57f469021028d0f39a7`.

We separate automated checks against every record from selected browser interactions. Our results apply to this snapshot and the flows listed below, not every possible source update or filter combination.

## Our data checks

| Check | Result |
| --- | --- |
| Input and output IDs | 139,903 unique reports; no rows added or removed |
| Full source reconciliation | All IDs, URLs, summaries, cities, media labels and raw occurrence dates match the supplied export |
| Data/loader tests | 12 passed |
| Time charts | 139,888 eligible records; 15 pre-1900 records retained but excluded |
| US map | 139,687 mapped; 216 territory reports outside state map |
| Date resolution | All occurrence and reporting dates reconcile with pinned original-ID date reference |
| Explicit media labels | 6,840 Yes and 133,063 No; both remain distinct from missing information |
| Missing summaries | 68 retained as missing; no replacement stories generated |

We ran our automated suite with:

```sh
node --test tests/data-engine.test.mjs
```

Our 12 tests cover aggregate reconciliation, retained map exclusions, combined filters, January and midnight handling, flagged dates, explicit No media, search, local-time formatting, sorting, CSV quoting/formula escaping, mixed-date resolution, and incomplete partitions. We do not treat agreement between two generated outputs as independent verification of the original source.

## Our browser checks

| Flow we inspected | Observed result |
| --- | --- |
| Mobile report details | Report 196439 displays 6 March 2026 at 22:46, its original NUFORC URL, and explicit No media |
| Mobile state filter and pagination | Wyoming returns 439 reports; moving to page 2 of 44 works |
| Desktop map selection | Clicking California selects 17,009 reports |
| Pattern charts | We observed 288 month/hour cells and 122 year positions |
| Layout | We observed no horizontal overflow in the inspected mobile and 1440 px desktop views |
| Local console | We observed no errors in the inspected local flows |

## Our production release

We deployed the reviewed GitHub source commit `c48d81b2f89c4c7d3b13adea387c5034034a8e1b` to our existing Vercel project on 3 November 2026. Deployment `dpl_HyyEDEjrqj2sNPeiYfq8n1hbsD3D` reached `READY` and served [our production URL](https://ufo-observatory-vlerick.vercel.app).

On the live app, we checked:

- Our initial counts: 139,903 reports, 139,687 mapped records, and 139,888 eligible occurrence dates.
- Successful loading of all report partitions and the 1905–2026 period label.
- The explicit No media filter returning 133,063 reports.
- Report 196439's displayed occurrence date, source summary, media label, and original report URL.
- Our mobile About view showing the updated quality cards and `dbo.UFO_Sighting` source link without horizontal overflow.
- No console errors in the inspected production flows.

These checks establish that our app loaded the intended snapshot and that the inspected interactions worked. We did not test every external NUFORC page, verify the truth of the accounts, or perform a load test or security audit.

We deliver the larger export as gzip-compressed partitions. Our local server and Vercel configuration set the matching encoding and JSON headers. Our partition loader checks the combined count against the index; the app then checks the manifest total and ID uniqueness.

## Our evidence and its limits

We retain the machine-readable import results in [`dataset-import-checks.json`](dataset-import-checks.json), the source metadata in [`manifest.json`](../dist/data/manifest.json), and our rules in [data preparation](data-preparation.md).

Our 1 November checks concerned the superseded 1,067-report Kaggle sample. We do not use those results as evidence for the current data. We also distinguish the starting/removal totals in our original cleaning notes from the final-export totals we independently reconciled.
