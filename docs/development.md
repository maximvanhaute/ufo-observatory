# Developing and releasing our app

We keep our app static: HTML, CSS, and browser JavaScript in `dist/`, with locally bundled D3 and data files. We use Node.js 24 to run and test it, and Python 3's standard library to regenerate the snapshot. We have no dependency-installation or frontend build step.

## Our local workflow

From the repository root, we run:

```sh
node scripts/serve.mjs
```

We open http://127.0.0.1:4173. We can choose another port, for example:

```sh
node scripts/serve.mjs 4174
```

Our server binds to `127.0.0.1` and serves `dist/`. It sets `Content-Encoding: gzip` and JSON content type for our compressed partitions. We stop it with Ctrl+C when finished. There is no hot reload, so we refresh the browser after editing a served file.

We run the existing regression checks with:

```sh
node --test tests/data-engine.test.mjs
```

We use [`verification.md`](verification.md) to record what we checked and on which snapshot. A passing test suite does not replace inspection of browser interactions or independent reconciliation against the supplied input.

## Updating our data

We keep a new Fabric export outside Git and use the adapter from the repository root:

```sh
python3 scripts/import_final_dataset.py /path/to/Final_Dataset.json
node --test tests/data-engine.test.mjs
```

The adapter replaces the generated report partitions, index, manifest, summaries, and import-check record in place. It expects the current [input fields](data-preparation.md#our-app-adapter), US-labelled records, unique numeric IDs, matching source links, and a date reference for every ID. We run it with ordinary Python, not optimisation mode, because it uses assertions for several checks.

Our committed reference covers the current set of report IDs. New IDs require a verified replacement reference before import. We can select that reference with:

```sh
python3 scripts/import_final_dataset.py /path/to/Final_Dataset.json \
  --reference-dates /path/to/reference-dates.json.gz
```

We store that lookup as a gzip-compressed JSON object, with each original ID mapped to its occurrence date and reporting date:

```json
{
  "196439": ["2026-03-06", "2026-03-06"]
}
```

Before committing a replacement snapshot, we:

1. Review the input count, IDs, schema, source fingerprint, and date-reference provenance.
2. Reconcile the generated records and aggregates with the new input and examine date and map exclusions.
3. Review changed files with `git diff --stat` and check the output in `docs/dataset-import-checks.json`.
4. Update snapshot-specific test expectations only after independently validating the new totals. We keep the tests for filtering, date handling, CSV escaping, and incomplete partitions.
5. Check desktop and mobile loading, filters, report details, original links, and a filtered CSV export.
6. Update our README and preparation/verification records to describe the same snapshot.

Our source metadata currently contains the 3 November 2026 snapshot label and Fabric table URL. A different source or later export also requires us to update that metadata in the adapter; it is not inferred automatically. We review the complete snapshot before release because its files form one matching set.

## Our Vercel configuration

| Setting | Our value |
| --- | --- |
| Project | `ufo-observatory-vlerick` |
| Source repository | `maximvanhaute/ufo-observatory` |
| Repository root | The project root, containing `vercel.json` |
| Framework preset | Other / null |
| Output directory | `dist` |
| Install command | Empty |
| Build command | Empty |
| Production URL | https://ufo-observatory-vlerick.vercel.app |

We preserve the response-header rules in [`vercel.json`](../vercel.json). They make `/data/reports/` serve our precompressed JSON with gzip encoding and JSON content type. Changing the output directory or omitting these headers can prevent the dataset from loading even when the page and images appear.

Our verified 3 November release was created from GitHub commit `c48d81b2f89c4c7d3b13adea387c5034034a8e1b` using a Vercel Git-source deployment. That release reached `READY` as deployment `dpl_HyyEDEjrqj2sNPeiYfq8n1hbsD3D`.

We do not assume that every GitHub push automatically updates production. We confirm the project's Git connection and production-branch settings in Vercel before relying on that workflow. When releasing, we select the intended project and reviewed commit, inspect its deployment status, and check the production URL after it becomes ready.

For the current snapshot, our initial live counts should be 139,903 reports, 139,687 mapped reports, and 139,888 eligible occurrence dates. We also check a filtered selection and its original report link. We record the deployed commit with the verification results.

## Common issues we check

| Symptom | What we check |
| --- | --- |
| The page stays on “Opening the observatory…” or shows a data-load error | We use our Node server locally and inspect failed data requests and browser errors. |
| A partition produces a JSON/decompression error | We check that the `.json.gz` file is present and both gzip and JSON headers are configured. |
| An import stops on an unknown ID or unresolved date | We examine the input and pinned reference instead of bypassing the date check. |
| The country filter only offers the United States | We expect this: our current cleaned export is US-only. |
| “Not provided” media returns no records | We expect this snapshot to contain explicit Yes/No values; missing media is a separate category. |
| Counts remain at an older snapshot | We compare the served manifest and the deployed Git commit with the version we intended to release. |

## Changes to our repository

We keep code, generated data, and their documentation consistent in each change. We describe what changed and how we checked it in our commits and pull requests. We do not add Fabric credentials, access tokens, local hosting identities, or raw exports to Git. Repository visibility and review requirements are GitHub settings; the `private` field in `package.json` only prevents npm publication.
