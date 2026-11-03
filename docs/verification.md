# Our verification record

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
