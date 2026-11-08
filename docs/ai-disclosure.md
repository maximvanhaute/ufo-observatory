# Our use of generative AI

We used generative AI to support implementation and communication for our Modern Data Platforms project. We disclose it because the assignment asks us to explain which tools we used, how we used them, and where their output materially influenced our work.

| Tool | How we used it | Where its output influenced our project |
| --- | --- | --- |
| OpenAI Codex | Assisted with app code, the JSON adapter, automated checks, browser verification, and documentation | Our data-loading and filtering implementation, date-resolution workflow, tests, setup instructions, and project explanations |
| OpenAI image-generation tool available through Codex | Generated decorative artwork from prompts and our visual direction | Our alien-in-a-saucer mascot and night landscape background |

We retain the [original asset prompts](asset-prompts.md), our [data preparation rules](data-preparation.md), and our [verification record](verification.md) so we can explain these contributions with concrete examples.

## What we checked

We used automated reconciliation to compare all supplied IDs, links, summaries, cities, media labels, and raw occurrence dates with the generated app records. We checked chart totals, time exclusions, map coverage, and date resolution. Our current suite has 27 JavaScript checks and two Python importer checks. We also inspected selected desktop and mobile browser flows, including filters, report details, original links, and pagination.

Following our group’s query feedback on 8 November, Codex assisted with an independent raw-export reproduction of every hourly bucket and every state average. Our first all-years implementation used a population-weighted rate and zero-report years. We replaced it with the group’s arithmetic mean of annual rates over active years, documented that definition, and retained the active-year counts. These were explicit choices based on group feedback, rather than a model deciding which average our project should use.

These checks were themselves assisted by code and tools. We distinguish a complete automated field reconciliation from a sampled browser check; we do not claim that a person manually reviewed every report or every possible filter combination.

## What we preserve

We use the supplied source accounts rather than AI-written sighting stories. We use the group’s corrected Date_Fixed and TimeOnly columns for the current export. Our earlier export used original report IDs and a pinned reference to resolve mixed date order. We leave missing summaries missing, retain source media labels, and do not invent durations, witness locations, or explanations. Our artwork is decorative and does not depict evidence for an actual report.

We remain responsible for reviewing the implementation, explaining the data-management decisions, checking conclusions, and presenting our own learning. This disclosure records the AI contributions we know about; it is not a claim that all review or presentation work has already been completed.
