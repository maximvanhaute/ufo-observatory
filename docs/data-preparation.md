# How we prepare our app data

## Our current sources

We received the corrected sighting export and a population file on 7 November 2026. Both are newline-delimited JSON, with one object per line.

| Input | Grain | Records |
| --- | --- | ---: |
| Final File Swear on god for now!.json | One report per original NUFORC ID | 139,887 |
| State_Population.json | One state and year | 6,579 |

Our existing Fabric lineage points to dbo.UFO_Sighting. We retain that link and the source fingerprints in the app manifest. The population file’s original publisher and estimation method were not supplied. We disclose that gap in the Population tab and About view.

## Our date contract

We use **Date_Fixed** for occurrence dates and **TimeOnly** for local clock time. The user referred to Only_Time, while the supplied field is TimeOnly. Our adapter supports both spellings and rejects conflicting values when both are present.

We ignore the original Date and Time columns and the Date_Corrected column. We parse Date_Fixed in month-day-year order, accepting hyphens and slashes. We parse TimeOnly as HH:MM:SS, combine it with Date_Fixed, and preserve its seconds without timezone conversion. The synthetic date carried in the original Time column has no influence on occurrence dates or charts.

We parse ReportedDate separately in month-day-year order and preserve it as reporting metadata. It is never used as the occurrence year or the population join year.

We retain 15 pre-1900 records with a suspicious_year flag. They remain available as reports and are excluded from time charts and time-based filters. The current snapshot has **139,872 usable occurrence dates**, spanning 6 July 1905 through 6 March 2026.

Our previous 3 November export had 139,903 reports and mixed MDY/DMY dates. That historical import used a pinned original-ID date reference. We retain support for that older input schema, but the corrected export uses the group-designated fields directly.

## Our population join

We retain population as a dimension keyed by **state_code + year**. We map the 135 District of Columbia records without abbreviations to DC using the exact full name. We reject duplicate keys, unknown states, and non-positive populations. These checks prevent a many-to-many join from multiplying reports.

For each time-eligible report, we join its state and occurrence year to that dimension. We add state_population, population_year, and population_status. A missing match has a null population and an explicit status. We preserve the original report grain and every supplied ID.

We use each denominator once when calculating the comparison:

```text
reports per 100,000 residents =
  filtered reports for a state and occurrence year
  / population of that state in the same year
  * 100,000
```

We include zero-report states when their population is available. We keep missing population distinct from zero and apply no interpolation, carry-forward, or population from a different year.

The population file ends in 2024. Alaska has no recent population values in the supplied file. For 2024, we match 49 states plus DC and compare **3,370 reports**. We exclude 15 Alaska reports and one US Virgin Islands report from that population comparison. Territory reports and Alaska reports remain available in the report explorer. The map marks unavailable state populations with dashed borders and uses gray before a state is selected. Once a state is selected, only that state is green.

Across the complete export, 135,472 reports have a population match, 4,400 time-eligible reports lack a state-year match, and 15 have flagged dates. These categories sum to 139,887.

## Our interactive comparison

We use a single occurrence year to keep denominators comparable. We preserve the shape, month, local hour, media, and text-search filters. They affect the report count, while the denominator remains the full population for that year. We describe rates as filtered reports per resident, with no annualisation of selected months or hours.

We compare all states and highlight the selected state. This keeps the scatter plot and ranking useful while users read the selected state’s reports. The count/rate switch affects both the ranking and the map. The scatter always uses population and report count, with a reference line based on the weighted rate across matched areas. The line is a proportional comparison rather than a regression.

Shared URLs preserve the Population tab, occurrence year, measure, state, and report filters. The population CSV includes all 51 state/DC rows, including missing denominators and coverage status.

## Our other preparation rules

We retain all 139,887 unique original IDs and validate each source link against its ID. We normalise state and shape keys for display. We preserve source summaries and explicit Yes/No media values.

We map 139,671 reports to the 50 states plus DC. We retain 216 territory reports outside those polygons. We retain the 68 missing summaries as missing. Media labels are 6,836 Yes and 133,051 No.

Our original group cleaning notes describe an earlier stage of work, including 159,485 starting rows and 19,582 removals. We preserve those notes in Data Cleaning Steps.docx. We do not use those historical figures to claim we independently reconstructed the current export’s upstream removals.

## Reproducing our snapshot

```sh
python3 scripts/import_final_dataset.py "/path/to/Final File Swear on god for now!.json" \
  --population /path/to/State_Population.json
node --test tests/*.test.mjs
```

We record raw-file SHA-256 fingerprints and output counts in the manifest and dataset-import-checks.json. We serve 14 gzip-compressed report partitions, population.json, manifest.json, and summaries.json. The browser recomputes chart values from these prepared records.

The site uses an exported snapshot. Our Fabric lineage remains reviewable from About.
