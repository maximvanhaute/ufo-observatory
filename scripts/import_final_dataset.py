"""Adapt corrected and legacy Fabric exports, retaining every supplied ID.

Corrected exports use Date_Fixed and TimeOnly (or Only_Time). Legacy exports
resolve mixed dates against the pinned lookup. Population joins on state/year.
"""
import argparse,collections,datetime,gzip,hashlib,json,re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'dist/data'
def read(path):
    text=path.read_text(encoding='utf-8-sig')
    try:return json.loads(text)
    except json.JSONDecodeError:
        return [json.loads(line) for line in text.splitlines() if line.strip()]
def packed(value): return json.dumps(value,ensure_ascii=False,separators=(',',':')).encode()
def save(path,value): path.write_bytes(packed(value))
def date(value,reference):
    candidates={}
    for name,fmt in [('mdy','%m/%d/%Y'),('dmy','%d/%m/%Y')]:
        try:candidates[name]=datetime.datetime.strptime(value,fmt).date().isoformat()
        except (ValueError,TypeError): pass
    matches=[order for order,result in candidates.items() if result==reference]
    if matches:return reference,'same_day_month' if len(matches)==2 else matches[0]
    raise ValueError(f'Unresolved date {value!r}, reference {reference!r}')

def fixed_date(value):
    return datetime.datetime.strptime(value.replace('/','-'),'%m-%d-%Y').date().isoformat()

def population_dimension(path,states):
    incoming=read(path)
    if isinstance(incoming,dict):incoming=[incoming]
    records=[];lookup={};filled=0
    codes={row['state_name']:code for code,row in states.items()}
    for row in incoming:
        code=row.get('state_abbr') or codes.get(row['state'])
        if not row.get('state_abbr'):filled+=1
        if code not in states or states[code]['state_name']!=row['state']:
            raise ValueError(f"Unknown state in population file: {row['state']!r}")
        year=int(row['year']);population=int(row['population']);key=(code,year)
        if key in lookup or population<=0:raise ValueError(f'Invalid or duplicate population: {key}')
        lookup[key]=population
        records.append(dict(state_code=code,state_name=row['state'],year=year,population=population))
    metadata=dict(raw_file=path.name,raw_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
        source_note='Group-supplied population file. Original publisher and estimation method have not been provided.',
        min_year=min(r['year'] for r in records),max_year=max(r['year'] for r in records),
        rows=len(records),state_codes_filled_from_name=filled,
        join_key=['state_code','year'],rate_unit='reports per 100,000 residents',
        missing_values_policy='No interpolation or carry-forward. Missing state-years are excluded from rate comparisons.')
    return dict(metadata=metadata,records=records),lookup

def build(input_path,reference_path,population_path=None):
    raw=input_path.read_bytes(); incoming=read(input_path)
    if isinstance(incoming,dict):incoming=[incoming]
    manifest=read(DATA/'manifest.json'); states={s['state_code']:s for s in manifest['us_states']}
    corrected=all('Date_Fixed' in row for row in incoming)
    reference={} if corrected else json.loads(gzip.decompress(reference_path.read_bytes()))
    population,pop_lookup=population_dimension(population_path,states) if population_path else (None,{})
    records=[];orders=collections.Counter(); reported_orders=collections.Counter();ids=set()
    pre_1900_removed = 0
    for original in incoming:
        if corrected:
            time_field='TimeOnly' if 'TimeOnly' in original else 'Only_Time'
            if 'TimeOnly' in original and 'Only_Time' in original and original['TimeOnly']!=original['Only_Time']:
                raise ValueError('Conflicting corrected time columns')
            x={**original,'Article Link':original['ArticleLink'],'Media Available':original['MediaAvailability'],
                'Reported Date':original['ReportedDate']}
            occurrence=fixed_date(original['Date_Fixed']);order='Date_Fixed_mdy'
            time=original[time_field]
            datetime.datetime.strptime(time,'%H:%M:%S')
            occurrence_raw=original['Date_Fixed']
        else:
            x=original
            occurrence,order=date(x['Date'],reference[str(x['ID'])][0])
            time=x['Time'];occurrence_raw=x['Date']
        identity=str(x['ID']);assert identity.isdigit() and identity not in ids
        ids.add(identity);assert x['Article Link']==f'https://nuforc.org/sighting/?id={identity}'
        dt=datetime.datetime.fromisoformat(occurrence+'T'+time)
        if dt.year < 1900:
            pre_1900_removed += 1
            continue
        orders[order]+=1
        if corrected:
            reported=fixed_date(x['Reported Date']);reported_order='ReportedDate_mdy'
        else:
            reported,reported_order=date(x['Reported Date'],reference[identity][1])
        reported_orders[reported_order]+=1
        flags=[]
        usable=dt.year<=datetime.date.today().year
        if not usable: flags.append('suspicious_year')
        code=x['State'].strip().upper();state=states.get(code);mapped=state is not None
        if not mapped:flags.append('outside_map_scope')
        assert x['Country'].strip().upper()=='USA'
        shape=x['Shape'].strip();sk=shape.casefold().replace('/','_')
        unknown=sk in ('unknown_other','unknown','other')
        if unknown:sk='unknown';shape='Unknown/Other'
        else:shape=shape.capitalize()
        media={'Yes':True,'No':False}[x['Media Available']]
        if not x.get('Summary'):flags.append('summary_missing')
        records.append(dict(report_id='nuforc-'+identity,source_url=x['Article Link'],
            occurred_at_local=dt.isoformat() if usable else None,year=dt.year if usable else None,
            month=dt.month if usable else None,day=dt.day if usable else None,hour=dt.hour if usable else None,
            weekday_iso=dt.isoweekday() if usable else None,datetime_status='valid' if usable else 'suspicious_year',
            eligible_for_time_analysis=usable,city=x['City'],country_key='US',country_iso2='US',country_name='United States',
            state_key=code,state_code=code,state_name=state['state_name'] if state else {'PR':'Puerto Rico','VI':'US Virgin Islands','GU':'Guam','UM':'US Minor Outlying Islands'}.get(code,code),
            eligible_for_us_state_map=mapped,shape_key=sk,shape_name=shape,shape_status='reported_unknown' if unknown else 'described',
            summary=x.get('Summary') or None,media_available=media,media_status='yes' if media else 'no',
            explanation_category=None,explanation_certainty='not_provided',has_source_explanation=False,quality_flags=flags,
            reported_date=reported,source_occurrence_date_raw=occurrence_raw,source_occurrence_time_raw=time,source_reported_date_raw=x['Reported Date']))
        if population:
            value=pop_lookup.get((code,dt.year))
            records[-1].update(state_population=value,population_year=dt.year,
                population_status='matched' if value else 'state_year_unavailable')
    temporal=[r for r in records if r['eligible_for_time_analysis']];mapped=[r for r in records if r['eligible_for_us_state_map']]
    def counts(keys,rows=records):
        c=collections.Counter(tuple(r[k] for k in keys) for r in rows)
        return [{**dict(zip(keys,key)),'report_count':n} for key,n in c.items()]
    state_counts=collections.Counter(r['state_code'] for r in mapped)
    hours=collections.Counter(int(r['source_occurrence_time_raw'].split(':')[0]) for r in records);heat=collections.Counter((r['month'],r['hour']) for r in temporal)
    quality=dict(raw_rows=len(incoming),empty_records_removed=0,duplicate_copies_removed=0,clean_reports=len(records),
        pre_1900_reports_removed=pre_1900_removed,
        valid_time_reports=len(temporal),reports_excluded_from_time_charts=len(records)-len(temporal),
        valid_hour_reports=len(records),reports_excluded_from_hour_charts=0,
        datetime_status_counts=dict(collections.Counter(r['datetime_status'] for r in records)),us_reports=len(records),
        reports_mapped_to_us_states=len(mapped),us_reports_not_mapped=len(records)-len(mapped),
        us_reports_not_mapped_by_reason={'outside_map_scope':len(records)-len(mapped)},
        us_state_mapping_coverage_pct=round(100*len(mapped)/len(records),2),reports_without_city=0,
        reports_with_shape_not_provided=0,reports_with_source_unknown_shape=sum(r['shape_status']=='reported_unknown' for r in records),
        media_status_counts=dict(collections.Counter(r['media_status'] for r in records)),reports_with_source_explanation=0,
        earliest_valid_occurrence=min(r['occurred_at_local'] for r in temporal),latest_valid_occurrence=max(r['occurred_at_local'] for r in temporal),
        source_sha256=hashlib.sha256(raw).hexdigest(),minimum_project_year=1900,
        upstream_raw_rows_reported=159538,upstream_us_rows_reported=140746,upstream_excel_rows_reported=139903,
        upstream_duplicates_removed_reported=16,
        upstream_count_note='Upstream totals come from the group presentation. The app cutoff and retained totals are verified against the supplied Fabric export.',
        occurrence_date_order_counts=dict(orders),reported_date_order_counts=dict(reported_orders))
    summaries=dict(scope='Fabric export reports with occurrence years from 1900 onward. The state map covers 50 states plus DC.',quality=quality,
        by_year=sorted(counts(['year'],temporal),key=lambda r:r['year']),by_shape=sorted(counts(['shape_key','shape_name']),key=lambda r:-r['report_count']),
        by_country=counts(['country_key','country_name']),by_us_state=[{**s,'report_count':state_counts[k]} for k,s in states.items()],
        by_hour=[{'hour':h,'report_count':hours[h]} for h in range(24)],month_hour_heatmap=[{'month':m,'hour':h,'report_count':heat[m,h]} for m in range(1,13) for h in range(24)])
    source=dict(dataset_handle=input_path.name,dataset_version='Corrected Fabric export' if corrected else 'Fabric final export',
        dataset_updated_at='2026-11-07' if corrected else '2026-11-03',raw_sha256=quality['source_sha256'],
        raw_file=input_path.name,fabric_table='dbo.UFO_Sighting',
        fabric_url='https://app.fabric.microsoft.com/groups/37857c9c-3913-4e20-ad25-8253735a9b1e/lakehouses/2a150103-c21e-4014-868e-582cd0113f48?experience=fabric-developer&clientSideAuth=0&selectedPath=dbo%2FUFO_Sighting',
        upstream_url='https://github.com/christopherrobin/nuforc-scraper',
        date_reference_sha256=None if corrected else hashlib.sha256(reference_path.read_bytes()).hexdigest(),
        occurrence_date_field='Date_Fixed' if corrected else 'Date',
        occurrence_time_field='TimeOnly / Only_Time' if corrected else 'Time',
        upstream_reuse_status='Reuse permission remains unresolved; no new licence is asserted.',
        boundary_url=manifest['source']['boundary_url'],boundary_sha256=manifest['source']['boundary_sha256'])
    manifest.update(source=source,total_reports=len(records),countries=[dict(country_key='US',country_iso2='US',country_name='United States',country_status='matched')],
        shapes=[{k:r[k] for k in ['shape_key','shape_name','shape_status']} for r in {r['shape_key']:r for r in records}.values()],
        years=sorted({r['year'] for r in temporal}),limitations=['US-only cleaned export; not the complete NUFORC archive.','Reports are self-reported observations, not verified extraterrestrial events.',
        'Occurrence dates use Date_Fixed and times use TimeOnly. Date, Time and Date_Corrected are ignored.' if corrected else 'Dates are resolved by original report ID against a pinned date reference. Raw export dates remain in each record.',
        'Reports dated before 1900 are excluded from the app.','Times are local wall-clock values; no timezones are supplied.','Duration and witness coordinates are absent. The explanation column was removed upstream.','Upstream cleaning totals are reported in the group presentation.','Reuse permission remains unresolved.'])
    if population:
        manifest['population']=population['metadata']
        quality['population_match_counts']=dict(collections.Counter(r['population_status'] for r in records))
        save(DATA/'population.json',population)
    parts=DATA/'reports';parts.mkdir(exist_ok=True)
    for old in parts.glob('part-*.json.gz'):old.unlink()
    names=[]
    for start in range(0,len(records),10000):
        name=f'reports/part-{start//10000+1:03d}.json.gz';names.append(name)
        (DATA/name).write_bytes(gzip.compress(packed(records[start:start+10000]),compresslevel=9,mtime=0))
    save(DATA/'reports.json',dict(schema_version='partitioned-v1',total_reports=len(records),parts=names))
    save(DATA/'manifest.json',manifest);save(DATA/'summaries.json',summaries)
    save(ROOT/'docs/dataset-import-checks.json',dict(input_rows=len(incoming),output_rows=len(records),unique_ids=len(records),pre_1900_reports_removed=pre_1900_removed,date_orders=dict(orders),reported_date_orders=dict(reported_orders),all_source_links_match_ids=True,quality=quality))
    assert len(ids)==len(incoming)==len(records)+pre_1900_removed
    print(json.dumps(quality,indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('input',type=Path)
    parser.add_argument('--reference-dates',type=Path,default=ROOT/'scripts/reference-dates.json.gz')
    parser.add_argument('--population',type=Path)
    args=parser.parse_args();build(args.input,args.reference_dates,args.population)
