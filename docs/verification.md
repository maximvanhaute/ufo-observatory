# Verification record

## Fabric final export — 3 November 2026

The app was adapted to the supplied `Final_Dataset.json`. The interface design, assets, navigation and chart types are retained.

| Check | Result |
| --- | --- |
| Input and output IDs | 139,903 unique reports; no rows added or removed |
| Full source reconciliation | All IDs, URLs, summaries, cities, media labels and raw occurrence dates match the supplied export |
| Data/loader tests | 12 passed |
| Time charts | 139,888 eligible records; 15 pre-1900 records retained but excluded |
| US map | 139,687 mapped; 216 territory reports outside state map |
| Date resolution | All occurrence and reporting dates reconcile with pinned original-ID date reference |
| Mobile report view | Newest record 196439 shows 6 March 2026 at 22:46; original link and explicit No media retained |
| Mobile state filter/pagination | Wyoming 439 reports; page 2 of 44 works |
| Desktop map | California click selects 17,009 reports |
| Patterns | 288 month/hour cells; 122 year positions |
| Layout | No horizontal overflow observed in mobile and 1440 px desktop checks |
| Console | No errors observed in inspected local flows |

Partitioned gzip data delivery is required for the larger export. The local server and Vercel configuration set the matching encoding and JSON headers. The loader checks partition and manifest row counts and unique IDs.

Earlier verification on 1 November 2026 concerned the superseded 1,067-report Kaggle sample and is not evidence for the current data. Source totals reported in the group cleaning notes are distinguished from independently reconciled final-export totals in README.md.
