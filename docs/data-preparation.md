# How we prepare our app data

## Our current sources

We received the corrected sighting export and a population file on 7 November 2026. Both are newline-delimited JSON, with one object per line.

| Input | Grain | Records |
| --- | --- | ---: |
| Final File Swear on god for now!.json | One report per original NUFORC ID | 139,887 |
| State_Population.json | One state and year | 6,579 |

Our Fabric lineage points to dbo.UFO_Sighting. We retain that link and the source fingerprints in the app manifest. Our presentation traces the population series to a Kaggle compilation of U.S. Census Bureau data.

## Our cleaning stages

We downloaded a JSON snapshot of the NUFORC reports and kept the original data in the Fabric Lakehouse for comparison. We cleaned a working copy in Excel and Power Query, loaded it into Fabric, and used Spark SQL to complete the transformations.

| Stage | Rows | What we did |
| --- | ---: | --- |
| Original snapshot | 159,538 | Preserved the source rows and report IDs for audit |
| US records | 140,746 | Filtered to the United States |
| Excel and Power Query | 139,903 | Removed 843 unusable locations, grouped shapes into 19 categories, and expanded relative report links |
| Fabric and Spark SQL | 139,887 | Removed 16 duplicate reports, standardised geography and shape labels, extracted local clock times, and corrected ambiguous dates against the original table |

We exported the curated Fabric data as JSON for the app. The dashboard and Reports both use all 139,887 entries. The year-by-year timeline covers 139,872 entries dated 1900 onward. We independently checked the final export and the 15 historical records. The upstream counts come from our group’s presentation.

## Our date contract

We use **Date_Fixed** for occurrence dates and **TimeOnly** for local clock time. Our adapter also accepts **Only_Time** and rejects conflicting values when both fields are present.

We ignore the original Date and Time columns and the Date_Corrected column. We parse Date_Fixed in month-day-year order, accepting hyphens and slashes. We parse TimeOnly as HH:MM:SS, combine it with Date_Fixed, and preserve its seconds without timezone conversion. The synthetic date carried in the original Time column has no influence on occurrence dates or charts.

We parse ReportedDate separately in month-day-year order and preserve it as reporting metadata. It is never used as the occurrence year or the population join year.

The Fabric export contains 15 reports with occurrence dates before 1900. We retain them in Reports, its CSV and the dashboard totals. The year-by-year timeline covers dates from 1900 onward. We label their dates as historical. The entry dated 1400 carries an approximate-date label from [its NUFORC record](https://nuforc.org/sighting/?id=54856). The full report browser contains **139,887** records spanning approximately 1400 through 6 March 2026. The timeline plots **139,872** reports spanning 6 July 1905 through 6 March 2026.

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

Of the 139,887 dashboard reports, 135,475 have a population match and 4,412 lack a matching state-year population.

## Our interactive comparison

We support a single occurrence year and an All years annual average. We preserve the shape, month, local hour, media, and text-search filters. They affect the report count, while the denominator remains the full population for that year. We describe rates as filtered reports per resident, with no annualisation of selected months or hours.

For All years, we reproduce the group’s query: count reports by state and occurrence year, join to that exact state-year population, calculate each annual rate, and then take the unweighted arithmetic mean of the rates. An **active year** has at least one filtered report and a matching population. We exclude years with no sightings from the average because they do not produce a Yearly_Sightings row in the supplied query. A state with no active years has an unavailable average, not zero. This definition differs from our 7 November implementation, which pooled populations and included zero-report years.

We show mean reports and mean population over the same active years on the scatter plot. We retain total matched reports and Active_Years_Count in the selected-state details and CSV. We round only for display. The proportional reference line still uses pooled reports divided by pooled populations over the included active state-years; it is labelled as a pooled reference rather than the mean of the state rates.

We default to All years and keep its period separate from calendar filters on Explore, Reports, and Time & shapes. The Read reports button applies the chosen year to that drill-down. All years clears the year bounds.

The All years comparison starts with all **139,887 dashboard reports** and includes **135,475** with population matches. Of **4,412** unmatched reports, **3,527** occur in 2025–2026 after the population series ends; the other **885** have missing state-year matches. Alaska has population values only in 1880 and 1890 and no reports in those years, so it has no active matched years. The dimension spans 1790–2024, with varying historical coverage. We do not extend populations to unsupported years.

The raw population file has 135 DC rows with a blank state_abbr. The original join skips DC and matches **135,318 reports**, 157 fewer than the app. Our matching SQL fills DC from its exact full name and parses Date_Fixed as month-day-year. [Matching SQL](reconciliation-queries.sql)

We reproduced the calculation using the exported files. The reconciliation record contains the hourly counts, active-year counts, state averages, and both input fingerprints. Vermont averages **1.94 reports per 100,000 residents per active year** over 52 years. California averages **191.4 reports per active year** over 87 years. [Reconciliation record](feedback-reconciliation.json)

State report drill-down shows all reports matching the selected state and chosen period. The selected-state card distinguishes the state’s report total from the number included in population calculations.

We compare all states and highlight the selected state. This keeps the scatter plot and ranking useful while users read the selected state’s reports. The count/rate switch affects both the ranking and the map. The scatter always uses population and report count, with a reference line based on the pooled rate across included active state-years. The line is a proportional comparison rather than a regression.

Shared URLs preserve the Population tab, occurrence year, measure, state, and report filters. The population CSV includes all 51 state/DC rows, including missing denominators and coverage status.

## Our other preparation rules

We retain 139,887 unique original IDs and validate their source links. We normalise state and shape keys for display. We preserve source summaries and explicit Yes/No media values.

We map 139,671 dashboard reports to the 50 states plus DC. We retain 216 territory reports outside those polygons. We retain the 68 missing summaries as missing. Media labels are 6,836 Yes and 133,051 No.

## Reproducing our snapshot

```sh
python3 scripts/import_final_dataset.py "/path/to/Final File Swear on god for now!.json" \
  --population /path/to/State_Population.json
node --test tests/*.test.mjs
```

We record raw-file SHA-256 fingerprints and output counts in the manifest and dataset-import-checks.json. We serve 14 gzip-compressed report partitions, population.json, manifest.json, and summaries.json. The browser recomputes chart values from these prepared records.

The site uses an exported snapshot. Our Fabric lineage remains reviewable from About.
