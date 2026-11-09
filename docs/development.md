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
node --test tests/*.test.mjs
```

We use [`verification.md`](verification.md) to record what we checked and on which snapshot. A passing test suite does not replace inspection of browser interactions or independent reconciliation against the supplied input.

## Updating our data

We keep the raw files outside Git and run the adapter from the repository root:

```sh
python3 scripts/import_final_dataset.py "/path/to/Final File Swear on god for now!.json" \
  --population /path/to/State_Population.json
node --test tests/*.test.mjs
```

The adapter reads JSON arrays or newline-delimited objects. For corrected exports, it uses Date_Fixed and TimeOnly (or Only_Time), preserves the original corrected strings, checks IDs and source links, and joins population by state and occurrence year. It validates the input before generating the report partitions, population dimension, manifest, summaries, and import-check record. We run ordinary Python because several existing checks use assertions.

We treat the generated files as one snapshot and review the source fingerprint, row counts, date exclusions, population coverage, and browser output before release. Our previous-schema import remains supported with the pinned reference and optional `--reference-dates` argument. The current corrected schema does not require that reference.

When updating the source or its fields, we update the adapter metadata and review the population source description. The current snapshot is labelled 7 November 2026. Original source files remain outside Git. We include the population dimension and prepared records in the deployment.

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

For the current snapshot, Explore should show 139,872 reports and 139,656 mapped reports. Reports should show 139,887 records, including 15 pre-1900 entries. We also check a filtered selection and its original report link. We record the deployed commit with the verification results.

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
