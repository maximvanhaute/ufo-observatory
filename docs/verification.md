# Verification record

## Presentation alignment and historical cutoff — 9 November 2026

We matched the About page’s cleaning stages to the final presentation. The group reports 159,538 original rows, 140,746 US rows, 139,903 after Excel, and 139,887 after Spark SQL. The final Fabric export includes 15 pre-1900 reports. The site excludes them during preparation and publishes 139,872 reports, with occurrence dates from 6 July 1905 to 6 March 2026.

We recomputed the hourly and population figures from the original exports with the same cutoff. The hourly chart uses 139,872 times. The map includes 139,656 reports. The all-years population comparison matches 135,472 reports, with 4,400 missing population matches. Vermont remains first at 1.94 per 100,000. The 2024 comparison still matches 3,370 reports. The matching SQL and reconciliation record apply the same cutoff.


## Query reconciliation and all-years default — 8 November 2026 (before the historical cutoff)

We reproduced the group's hourly and average-per-capita queries independently from the two original JSON exports with `scripts/reconcile_fabric_queries.py`. We preserved raw-file SHA-256 values, all 24 hourly totals, every state rate, and active-year counts in [feedback-reconciliation.json](feedback-reconciliation.json). This is an export-based reproduction, not a live Fabric SQL execution. We use explicit MDY parsing of Date_Fixed and provide [matching SQL](reconciliation-queries.sql), including the app's existing DC abbreviation repair.

The hourly query includes all 139,887 valid TimeOnly values. The former date flag removed 15 otherwise valid clock times: hour 0 lost five; hours 6 and 7 one each; hour 8 two; hour 14 one; hour 20 three; hours 21 and 23 one each. Calendar charts still retain their separate 139,872-date quality scope. Source reports keep their review flags.

We changed the all-years metric to the arithmetic mean of annual rates over active matched years. Zero-report years are absent, matching the group's Yearly_Sightings CTE. Each state rate and active-year count matches the independent source calculation. Vermont leads at 1.94 per 100,000 over 52 active years; California has 191.4 reports per active year over 87 active years. A synthetic three-year example distinguishes an equal-weight active-year mean from a pooled population rate and from averaging over zero-report years. No active years produces an unavailable average rather than zero.

All 139,887 reports remain present. The rate comparison includes 135,475: 3,527 reports are after the population series ends in 2024, and 885 have other missing state-year matches. Three flagged historical dates have valid population joins and are included without removing their flags. The raw, unnormalized SQL join includes 135,318 reports because it drops DC's 157 matched reports. We retain the established DC correction and document it in the matching query.

Our current suite passes **27 JavaScript checks and two Python importer checks**. The checks reconcile all hourly bins, every state's active-year average, counts and mean population, single-year 2024 results, missing/no-active states, CSV fields, duplicate denominators, historical flags, default routing, and isolation of population periods from general year filters.

In the local browser we verified a fresh Population link defaults to All years, the 135,475 matched total and visible 4,412 exclusions, Vermont's 52-year detail, all 642 Vermont reports in the all-years drill-down, 2024's unchanged 3,370 compared reports, and returning to Explore with all 139,887 reports and empty calendar bounds. All 24 rendered hourly bar labels agree with the raw-export check. Reload preserves All years; CSV export reports success. The 375px mobile viewport has no horizontal overflow. We observed no browser errors in these inspected flows.

## All-years population average — 7 November 2026 (superseded)

We added All years alongside the existing single-year selector. The current shared window is 1905–2024. We include state-years with population data, including years with no reports. Each state’s annual rate is its included reports divided by summed annual populations, multiplied by 100,000. Its scatter coordinates are mean population and mean annual report count across those same covered years.

We compare 135,472 reports. Alaska has no matching population years. Hawaii has 75 years (1950–2024), and its shorter coverage is displayed in tooltips, state details, and CSV. We distinguish 873 unmatched reports within the period from the 3,527 eligible reports after 2024. Fifteen flagged dates remain excluded from time analysis.

Our suite now contains 22 JavaScript checks and two Python importer checks. A three-year fixture with a zero-report middle year verifies the weighted rate, average population, and annual mean. Another fixture verifies exclusion of a report without a matching state-year population. The full-data check verifies Washington’s 1.71 annual reports per 100,000 and California’s 138.8 average annual reports. CSV checks cover period boundaries, denominators, and shorter coverage.

We checked the local browser through the existing controls. The all-years selector displays 135,472 matched reports. The count/rate switch changes the leader from California to Washington. Choosing 2024 restores 3,370 reports and California’s 334-report count. Reload preserves the All years selection and measure. The selected-state report drill-down and CSV action work. On a 375px phone viewport the selector fits without horizontal overflow. We observed no browser warnings or errors in those inspected flows.

## Opening sound — 7 November 2026

We downloaded the user-supplied UFO landing clip’s AAC audio stream and verified the creator’s Creative Commons Attribution label in YouTube metadata. Our browser decoded the file and reported a duration of 14.33 seconds, readyState 4, active playback, and increasing currentTime. We verified that the sound toggle pauses and resets the clip, and that a muted preference survives reload. Play and replay remain available from the header.

We observed no browser errors in these local checks. The existing 21 automated checks also passed.

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
