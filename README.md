# UFO Observatory

Interactive UFO report explorer for the Vlerick Modern Data Platforms group assignment.

Live app: https://ufo-observatory-vlerick.vercel.app

## Run

No package installation is needed. Use Node 22 or 24:

```sh
node scripts/serve.mjs
```

Open http://127.0.0.1:4173. Use this server rather than a generic static server: it sets gzip headers for the data partitions.

```sh
node --test tests/data-engine.test.mjs
```

## Current dataset

The group supplied `Final_Dataset.json`, exported from Microsoft Fabric table `dbo.UFO_Sighting`, on 3 November 2026. The app retains **139,903 unique reports**, all labelled USA. **139,687** map to the 50 states plus DC; **216** are territory records outside the map. Time charts use **139,888** records. Fifteen pre-1900 dates remain flagged and excluded from time charts. Valid occurrences span 1905-07-06 to 2026-03-06.

The input SHA-256 is `e8fee608e876cb9ad8a97d097586693deae6b753cf7ae57f469021028d0f39a7`. Every original ID and original NUFORC link is preserved. Missing summaries (68) remain missing. Media values retain explicit Yes/No semantics. Unknown/Other remains the source's combined category. No duration, coordinates or explanation is inferred or joined from another source.

`docs/Data Cleaning Steps.docx` describes the group's upstream cleaning. It reports 159,485 initial rows and 19,582 removals; those upstream totals are not independently reconstructed from the final export. The app adapter does not remove additional rows.

## Date handling

The final export mixes MDY and DMY despite the notes describing a consistent US format. Occurrence dates resolve as 82,814 MDY, 51,736 DMY and 5,353 equal-day/month values. The adapter resolves them by original NUFORC ID using a pinned date-only reference from the previously downloaded `christopherrobin/nuforc-scraper` snapshot, SHA-256 `638d81fd889d2170a3c14f7da06b1877d838df35c626e306982fa09c61b3f941`. All supplied dates reconcile; unresolved dates fail the import. Reporting dates are handled separately. Local hours are kept without timezone conversion. Supplied date/time strings remain in each record.

To import another export with the same contract:

```sh
python3 scripts/import_final_dataset.py /path/to/Final_Dataset.json
node --test tests/data-engine.test.mjs
```

The raw input is not committed. Generated data, the pinned date reference, import checks and importer are committed. This is an exported snapshot, not a live Fabric connection. The Fabric lineage URL is in `dist/data/manifest.json` and requires the viewer's own Fabric permissions.

## Data delivery and hosting

`dist/data/reports.json` indexes 14 precompressed JSON partitions. The loader also accepts the earlier array format. `vercel.json` serves partition files with gzip encoding and JSON content type. The existing design, maps, charts, report viewer, mobile navigation, mascot and fun-fact banner are retained. Source labels and counts are updated. Explicit No media has its own filter.

Vercel serves `dist/` without a build step. D3 7.9.0 and its ISC licence are vendored, with no runtime CDN dependency. No app secrets or database credentials are required.

## Interpretation, reuse and AI

Counts describe reports in the US-only cleaned export, not verified objects, independent events, national incidence or population-adjusted risk. Different report IDs can describe one event. The state map uses Census polygons, not witness locations.

This repository does not assert an open licence over NUFORC report content. Upstream reuse permission remains unresolved. The repository is private by default. See https://nuforc.org/terms/.

Codex assisted with app code, data adaptation, checks and documentation. Image generation created the decorative mascot and scenery; prompts are in `docs/asset-prompts.md`. No model generated sighting summaries, guessed dates or places, or classified reports as true. The group remains responsible for reviewing and disclosing AI contributions.
