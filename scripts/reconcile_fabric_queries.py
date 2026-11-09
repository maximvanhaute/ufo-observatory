"""Independently reproduce the group's SQL from the two raw Fabric exports.

This does not query the live Lakehouse. Date_Fixed is explicitly MDY, as agreed
for the export; implicit SQL date parsing may depend on the session settings.
"""
import argparse
import collections
import datetime
import hashlib
import json
from pathlib import Path


def read(path):
    text = path.read_text(encoding='utf-8-sig')
    try:
        value = json.loads(text)
        return value if isinstance(value, list) else [value]
    except json.JSONDecodeError:
        return [json.loads(line) for line in text.splitlines() if line.strip()]


def reconcile(sightings_path, population_path):
    reports, populations = read(sightings_path), read(population_path)
    counts, hours = collections.Counter(), collections.Counter()
    null_ids = 0
    for row in reports:
        if row['ID'] is None:
            null_ids += 1
            continue  # COUNT(ID) counts non-null IDs.
        time = datetime.datetime.strptime(row.get('TimeOnly', row.get('Only_Time')), '%H:%M:%S').time()
        date = datetime.datetime.strptime(row['Date_Fixed'].replace('/', '-'), '%m-%d-%Y').date()
        hours[time.hour] += 1
        counts[(row['State'].upper(), date.year)] += 1

    def comparison(repair_dc):
        lookup, names = {}, {}
        for row in populations:
            code = row.get('state_abbr')
            if not code and repair_dc and row['state'] == 'District of Columbia':
                code = 'DC'
            if not code:
                continue
            key = (code.upper(), int(row['year']))
            if key in lookup or row['population'] <= 0:
                raise ValueError('Invalid/duplicate state-year denominator')
            lookup[key] = row['population']
            names[code.upper()] = row['state']
        years = collections.defaultdict(list)
        excluded = collections.Counter()
        end_year = max(row['year'] for row in populations)
        for (code, year), count in counts.items():
            population = lookup.get((code, year))
            if population is not None:
                years[code].append((year, count, population))
            else:
                reason = 'after_population_end' if year > end_year else 'missing_state_year'
                excluded[reason] += count
        rows = []
        for code, values in years.items():
            n = len(values)
            rows.append(dict(
                state_code=code, state_name=names[code], active_years=n,
                reports=sum(c for y, c, p in values),
                average_annual_sightings_per_100k=sum(c / p * 100000 for y, c, p in values) / n,
                average_reports_per_active_year=sum(c for y, c, p in values) / n,
                average_population_active_years=sum(p for y, c, p in values) / n,
                active_start_year=min(y for y, c, p in values),
                active_end_year=max(y for y, c, p in values),
            ))
        rows.sort(key=lambda row: (-row['average_annual_sightings_per_100k'], row['state_name']))
        return dict(matched_reports=sum(row['reports'] for row in rows), excluded_reports=dict(excluded), states=rows)

    return dict(
        source_files={path.name:hashlib.sha256(path.read_bytes()).hexdigest() for path in [sightings_path, population_path]},
        scope='Recomputed from supplied export files, not a live Fabric SQL execution.',
        date_policy='Date_Fixed parsed as MDY, including historical dates.',
        average_policy='Arithmetic mean of annual rates over active matched state-years, as in the supplied SQL. Zero-report years absent.',
        input_rows=len(reports), null_ids=null_ids,
        hours=[dict(hour=h, count=hours[h]) for h in range(24)],
        original_sql_join=comparison(False), app_normalized_dc_join=comparison(True),
    )


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('sightings', type=Path)
    parser.add_argument('population', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = reconcile(args.sightings, args.population)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({
        'input_rows':result['input_rows'], 'valid_clock_times':sum(row['count'] for row in result['hours']),
        'original_sql_join_matched':result['original_sql_join']['matched_reports'],
        'normalized_dc_join_matched':result['app_normalized_dc_join']['matched_reports'],
        'normalized_exclusions':result['app_normalized_dc_join']['excluded_reports'],
        'top_state':result['app_normalized_dc_join']['states'][0],
    }, indent=2))
