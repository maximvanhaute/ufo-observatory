# Our data preparation

We separate our upstream cleaning in Microsoft Fabric from the adapter that prepares our final export for the web app. This distinction lets us explain which changes happened at each stage and which totals we have independently checked.

## Our source and lineage

| Item | Our current source |
| --- | --- |
| Original reporting organisation | [National UFO Reporting Center](https://nuforc.org/) |
| Fabric table | `dbo.UFO_Sighting` |
| Supplied export | `Final_Dataset.json` |
| Snapshot received | 3 November 2026 |
| Date-reference origin | Previously downloaded [NUFORC JSON snapshot](https://github.com/christopherrobin/nuforc-scraper) |
| Map boundaries | US Census Bureau, 2024 cartographic state boundaries at 1:20 million |

We keep the Fabric lineage URL, boundary source, and source fingerprints in [`manifest.json`](../dist/data/manifest.json). Opening the Fabric link requires the reader's own workspace permissions. Our website does not contain Fabric credentials or access the lakehouse at runtime.

We identify the exact inputs with SHA-256 fingerprints:

```text
Final_Dataset.json
e8fee608e876cb9ad8a97d097586693deae6b753cf7ae57f469021028d0f39a7

Original downloaded JSON used to prepare our date-only reference
638d81fd889d2170a3c14f7da06b1877d838df35c626e306982fa09c61b3f941
```

The compressed reference file's own fingerprint is also recorded in the manifest. We retain the date lookup in Git so that reproducing our current snapshot does not depend on a fresh download of a changing source.

## Our upstream cleaning

Our [original cleaning notes](Data%20Cleaning%20Steps.docx) describe how we:

- Removed records with missing country information, retained US-labelled records, removed duplicate sightings, and removed vague or blank city values.
- Standardised state abbreviations and media labels, and converted relative report links into complete URLs.
- Consolidated shapes into 19 categories, including `Unknown/Other`.
- Tidied summary whitespace and punctuation, separated occurrence dates and times, and removed the explanation column.

Our notes report **159,485 starting rows**, **19,582 removals**, and **139,903 retained rows**. We have independently reconciled the retained export; we have not reconstructed each upstream removal from that file. The separate downloaded snapshot used for our date reference contained 159,538 records. We do not treat those different recorded starting totals as interchangeable.

## Our app adapter

We run [`import_final_dataset.py`](../scripts/import_final_dataset.py) on the final Fabric export. We retain all **139,903** input records and check that their IDs are unique and their links agree with those IDs. We do not remove more records or infer additional sightings.

| Supplied field | How we use it |
| --- | --- |
| `ID` | We create a stable app key such as `nuforc-196439`. |
| `Article Link` | We preserve the original URL and check its report number against `ID`. |
| `City` | We preserve the supplied city. |
| `State` | We normalise letter case and look up state names and map eligibility. |
| `Country` | We check that its normalised value is `USA` and use country key `US`. |
| `Shape` | We normalise case and retain the combined `Unknown/Other` classification. |
| `Date` and `Time` | We resolve date order by ID and preserve the recorded local hour and minute. |
| `Reported Date` | We resolve it separately from the occurrence date. |
| `Media Available` | We convert `Yes` and `No` to explicit boolean values and matching status labels. |
| `Summary` | We preserve supplied text; 68 missing summaries remain missing. |

We keep `source_occurrence_date_raw`, `source_occurrence_time_raw`, and `source_reported_date_raw` alongside the prepared fields. We store no inferred duration, explanation, or witness coordinates.

## How we resolve dates

Our cleaning notes describe a consistent US date format, but the exported strings still mix MDY and DMY. We check both interpretations against the date associated with the same original NUFORC ID in our pinned reference.

| Export field | MDY interpretation | DMY interpretation | Same day and month |
| --- | ---: | ---: | ---: |
| Occurrence date | 82,814 | 51,736 | 5,353 |
| Reporting date | 84,351 | 50,627 | 4,925 |

Each row in this table sums to 139,903. When day and month are equal, both interpretations yield the same date. We stop the import when no interpretation agrees with the reference, rather than selecting a date according to the computer's locale.

For example, our export gives report `196439` as `06/03/2026`. Its original-ID reference confirms **6 March 2026**, so we store occurrence `2026-03-06T22:46:00` while retaining the supplied string. We do not convert the local time to UTC.

Our time-analysis rule accepts occurrence years from **1900 through the year in which we run the import**. In this snapshot, 15 records have pre-1900 dates. We retain those reports and their original date strings, mark them `suspicious_year`, and exclude them from time charts and time-based filters. Their prepared time components are null. This leaves 139,888 eligible records.

## Map coverage and missing information

We map **139,687** reports to the 50 states and Washington, DC. We retain **216** territory records outside those polygons: Puerto Rico (192), US Virgin Islands (20), Guam (3), and US Minor Outlying Islands (1). Their `outside_map_scope` flag records a coverage limitation rather than a failed or deleted report.

We also flag missing summaries as `summary_missing`. Our flags may overlap, so we do not add their counts to estimate a number of excluded reports.

We retain these distinctions:

- A missing summary is not an empty invented account.
- An explicit `No` media label is a source value, not proof that evidence cannot exist.
- `Unknown/Other` is a combined upstream shape category; we cannot reconstruct its earlier categories.
- A missing explanation reflects the removed source column, not an assessment that a sighting is inexplicable.
- A unique report ID identifies a report; it does not establish a unique physical event.

## Files we generate

| File | Purpose |
| --- | --- |
| [`dist/data/reports.json`](../dist/data/reports.json) | Our partition index and expected total count |
| `dist/data/reports/part-*.json.gz` | Our report records in batches of at most 10,000 |
| [`dist/data/manifest.json`](../dist/data/manifest.json) | Our dimensions, source metadata, fingerprints, and interpretation rules |
| [`dist/data/summaries.json`](../dist/data/summaries.json) | Our full-snapshot aggregates and quality measures |
| [`docs/dataset-import-checks.json`](dataset-import-checks.json) | Our machine-readable import reconciliation |

Our browser loads the partitions, checks their combined count against the index and manifest, and checks ID uniqueness. It then filters individual reports and recomputes chart denominators from that selection. The precomputed summaries describe the full snapshot, not every filtered view.

We keep our [verification evidence](verification.md) and [data-update procedure](development.md#updating-our-data) alongside these rules.
