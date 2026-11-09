# How we prepare our app data

## Our current sources

We received the corrected sighting export and a population file on 7 November 2026. Both are newline-delimited JSON, with one object per line.

| Input | Grain | Records |
| --- | --- | ---: |
| Final File Swear on god for now!.json | One report per original NUFORC ID | 139,887 |
| State_Population.json | One state and year | 6,579 |

Our existing Fabric lineage points to dbo.UFO_Sighting. We retain that link and the source fingerprints in the app manifest. Our presentation traces the population series to U.S. Census Bureau data compiled by Rolf Hendriks on Kaggle.

## Our date contract

We use **Date_Fixed** for occurrence dates and **TimeOnly** for local clock time. The user referred to Only_Time, while the supplied field is TimeOnly. Our adapter supports both spellings and rejects conflicting values when both are present.

We ignore the original Date and Time columns and the Date_Corrected column. We parse Date_Fixed in month-day-year order, accepting hyphens and slashes. We parse TimeOnly as HH:MM:SS, combine it with Date_Fixed, and preserve its seconds without timezone conversion. The synthetic date carried in the original Time column has no influence on occurrence dates or charts.

We parse ReportedDate separately in month-day-year order and preserve it as reporting metadata. It is never used as the occurrence year or the population join year.

The Fabric export contains 15 reports with occurrence dates before 1900. The app excludes those rows during preparation, before building report files, charts, population joins or CSV exports. The resulting **139,872** reports span **6 July 1905 through 6 March 2026**.

Our previous 3 November export had 139,903 reports and mixed MDY/DMY dates. That historical import used a pinned original-ID date reference. We retain support for that older input schema, but the corrected export uses the group-designated fields directly.

## Our population join

We retain population as a dimension keyed by **state_code + year**. We map the 135 District of Columbia records without abbreviations to DC using the exact full name. We reject duplicate keys, unknown states, and non-positive populations. These checks prevent a many-to-many join from multiplying reports.

For each included report, we join its state and occurrence year to that dimension. We add state_population, population_year, and population_status. A missing match has a null population and an explicit status. We preserve the original report grain and ID of each included report.

We use each denominator once when calculating the comparison:

```text
reports per 100,000 residents =
  filtered reports for a state and occurrence year
  / population of that state in the same year
  * 100,000
```

In a single year we include zero-report states when their population is available. For the all-years average, we use active years as described below. We keep missing population distinct from zero and apply no interpolation, carry-forward, or population from a different year.

The population file ends in 2024. Alaska has no recent population values in the supplied file. For 2024, we match 49 states plus DC and compare **3,370 reports**. We exclude 15 Alaska reports and one US Virgin Islands report from that population comparison. Territory reports and Alaska reports remain available in the report explorer. The map shows unavailable state populations in gray with dashed borders.

Of the 139,872 reports in the app, 135,472 have a population match and 4,400 lack a matching state-year population.

## Our interactive comparison

We support a single occurrence year and an All years annual average. We preserve the shape, month, local hour, media, and text-search filters. They affect the report count, while the denominator remains the full population for that year. We describe rates as filtered reports per resident, with no annualisation of selected months or hours.

For All years, we reproduce the group’s query: count reports by state and occurrence year, join to that exact state-year population, calculate each annual rate, and then take the unweighted arithmetic mean of the rates. An **active year** has at least one filtered report and a matching population. We exclude years with no sightings from the average because they do not produce a Yearly_Sightings row in the supplied query. A state with no active years has an unavailable average, not zero. This definition differs from our 7 November implementation, which pooled populations and included zero-report years.

We show mean reports and mean population over the same active years on the scatter plot. We retain total matched reports and Active_Years_Count in the selected-state details and CSV. We round only for display. The proportional reference line still uses pooled reports divided by pooled populations over the included active state-years; it is labelled as a pooled reference rather than the mean of the state rates.

We default to All years and keep its period separate from calendar filters on Explore, Reports, and Time & shapes. Switching pages does not silently impose 2024. Explicit single-year population links remain supported. The Read reports button applies the chosen population year to that drill-down, or clears year bounds for All years.

The All years comparison starts with all **139,872 app reports** and includes **135,472** with population matches. Of **4,400** unmatched reports, **3,527** occur in 2025–2026 after the population series ends; the other **873** have missing state-year matches. Alaska has population values only in 1880 and 1890 and no reports in those years, so it has no active matched years. The dimension spans 1790–2024, with varying historical coverage. We do not extend populations to unsupported years.

The raw population file has 135 DC rows without state_abbr. The original unnormalized query therefore skips DC and matches **135,315 reports after the date cutoff**, 157 fewer than the app. Our [matching SQL](reconciliation-queries.sql) applies the same 1900 cutoff, fills DC from its exact full name, and explicitly parses the agreed MDY Date_Fixed format. We reproduced it from the exported source files; we have not executed it against the live Lakehouse. The [reconciliation record](feedback-reconciliation.json) contains all hourly buckets, active-year counts, and state averages, with both raw-file fingerprints. Vermont leads at **1.94 per 100,000 per active year** over 52 active years; California has **191.4 reports per active year** over 87 active years.

State report drill-down shows all reports matching the selected state and chosen period. The selected-state card distinguishes the state’s report total from the number included in population calculations.

We compare all states and highlight the selected state. This keeps the scatter plot and ranking useful while users read the selected state’s reports. The count/rate switch affects both the ranking and the map. The scatter always uses population and report count, with a reference line based on the pooled rate across included active state-years. The line is a proportional comparison rather than a regression.

Shared URLs preserve the Population tab, occurrence year, measure, state, and report filters. The population CSV includes all 51 state/DC rows, including missing denominators and coverage status.

## Our other preparation rules

We retain 139,872 unique original IDs after the date cutoff and validate their source links. We normalise state and shape keys for display. We preserve source summaries and explicit Yes/No media values.

We map 139,656 reports to the 50 states plus DC. We retain 216 territory reports outside those polygons. We retain the 68 missing summaries as missing. Media labels are 6,836 Yes and 133,036 No.

Our presentation reports **159,538** records in the original NUFORC snapshot, **140,746** after filtering to the US, **139,903** after removing unusable locations in Excel, and **139,887** after the Spark SQL pass removed 16 duplicate reports. In Excel and Power Query, we consolidated shapes into 19 categories and expanded relative report links. In Fabric, we standardised geography and shape casing, extracted the clock time, and corrected ambiguous dates against the original table. The presentation documents these upstream stages. We independently checked the final export and the app’s 15-row historical exclusion.

## Reproducing our snapshot

```sh
python3 scripts/import_final_dataset.py "/path/to/Final File Swear on god for now!.json" \
  --population /path/to/State_Population.json
node --test tests/*.test.mjs
```

We record raw-file SHA-256 fingerprints and output counts in the manifest and dataset-import-checks.json. We serve 14 gzip-compressed report partitions, population.json, manifest.json, and summaries.json. The browser recomputes chart values from these prepared records.

The site uses an exported snapshot. Our Fabric lineage remains reviewable from About.
