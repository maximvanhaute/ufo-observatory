"""Adapt the group's Fabric JSON export to the existing app data contract.

The supplied export mixes DMY and MDY. Resolve date order by original NUFORC
ID against the pinned date-only reference; never select an ambiguous date by
locale or change the witness's local time. All input reports are retained.
"""
import argparse,collections,datetime,gzip,hashlib,json,re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'dist/data'
def read(path): return json.loads(path.read_text())
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

def build(input_path,reference_path):
    raw=input_path.read_bytes(); incoming=json.loads(raw)
    reference=json.loads(gzip.decompress(reference_path.read_bytes()))
    manifest=read(DATA/'manifest.json'); states={s['state_code']:s for s in manifest['us_states']}
    records=[];orders=collections.Counter(); reported_orders=collections.Counter();ids=set()
    for x in incoming:
        identity=str(x['ID']);assert identity.isdigit() and identity not in ids
        ids.add(identity);assert x['Article Link']==f'https://nuforc.org/sighting/?id={identity}'
        occurrence,order=date(x['Date'],reference[identity][0]);orders[order]+=1
        reported,reported_order=date(x['Reported Date'],reference[identity][1]);reported_orders[reported_order]+=1
        flags=[]
        dt=datetime.datetime.strptime(occurrence+' '+x['Time'],'%Y-%m-%d %H:%M')
        usable=1900<=dt.year<=datetime.date.today().year
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
            reported_date=reported,source_occurrence_date_raw=x['Date'],source_occurrence_time_raw=x['Time'],source_reported_date_raw=x['Reported Date']))
    temporal=[r for r in records if r['eligible_for_time_analysis']];mapped=[r for r in records if r['eligible_for_us_state_map']]
    def counts(keys,rows=records):
        c=collections.Counter(tuple(r[k] for k in keys) for r in rows)
        return [{**dict(zip(keys,key)),'report_count':n} for key,n in c.items()]
    state_counts=collections.Counter(r['state_code'] for r in mapped)
    hours=collections.Counter(r['hour'] for r in temporal);heat=collections.Counter((r['month'],r['hour']) for r in temporal)
    quality=dict(raw_rows=len(incoming),empty_records_removed=0,duplicate_copies_removed=0,clean_reports=len(records),
        valid_time_reports=len(temporal),reports_excluded_from_time_charts=len(records)-len(temporal),
        datetime_status_counts=dict(collections.Counter(r['datetime_status'] for r in records)),us_reports=len(records),
        reports_mapped_to_us_states=len(mapped),us_reports_not_mapped=len(records)-len(mapped),
        us_reports_not_mapped_by_reason={'outside_map_scope':len(records)-len(mapped)},
        us_state_mapping_coverage_pct=round(100*len(mapped)/len(records),2),reports_without_city=0,
        reports_with_shape_not_provided=0,reports_with_source_unknown_shape=sum(r['shape_status']=='reported_unknown' for r in records),
        media_status_counts=dict(collections.Counter(r['media_status'] for r in records)),reports_with_source_explanation=0,
        earliest_valid_occurrence=min(r['occurred_at_local'] for r in temporal),latest_valid_occurrence=max(r['occurred_at_local'] for r in temporal),
        source_sha256=hashlib.sha256(raw).hexdigest(),minimum_project_year=1900,
        upstream_raw_rows_reported=159485,upstream_rows_removed_reported=19582,
        upstream_count_note='Group cleaning notes report these upstream totals; only the supplied 139,903-row final export is independently reconciled here.',
        occurrence_date_order_counts=dict(orders),reported_date_order_counts=dict(reported_orders))
    summaries=dict(scope='All retained Fabric export reports. Time charts exclude flagged years; state map covers 50 states plus DC.',quality=quality,
        by_year=sorted(counts(['year'],temporal),key=lambda r:r['year']),by_shape=sorted(counts(['shape_key','shape_name']),key=lambda r:-r['report_count']),
        by_country=counts(['country_key','country_name']),by_us_state=[{**s,'report_count':state_counts[k]} for k,s in states.items()],
        by_hour=[{'hour':h,'report_count':hours[h]} for h in range(24)],month_hour_heatmap=[{'month':m,'hour':h,'report_count':heat[m,h]} for m in range(1,13) for h in range(24)])
    source=dict(dataset_handle='Final_Dataset.json',dataset_version='Fabric final export',dataset_updated_at='2026-11-03',raw_sha256=quality['source_sha256'],
        raw_file='Final_Dataset.json',fabric_table='dbo.UFO_Sighting',
        fabric_url='https://app.fabric.microsoft.com/groups/37857c9c-3913-4e20-ad25-8253735a9b1e/lakehouses/2a150103-c21e-4014-868e-582cd0113f48?experience=fabric-developer&clientSideAuth=0&selectedPath=dbo%2FUFO_Sighting',
        upstream_url='https://github.com/christopherrobin/nuforc-scraper',date_reference_sha256=hashlib.sha256(reference_path.read_bytes()).hexdigest(),
        upstream_reuse_status='Reuse permission remains unresolved; no new licence is asserted.',
        boundary_url=manifest['source']['boundary_url'],boundary_sha256=manifest['source']['boundary_sha256'])
    manifest.update(source=source,total_reports=len(records),countries=[dict(country_key='US',country_iso2='US',country_name='United States',country_status='matched')],
        shapes=[{k:r[k] for k in ['shape_key','shape_name','shape_status']} for r in {r['shape_key']:r for r in records}.values()],
        years=sorted({r['year'] for r in temporal}),limitations=['US-only cleaned export; not the complete NUFORC archive.','Reports are self-reported observations, not verified extraterrestrial events.','Dates are resolved by original report ID against a pinned date reference. Raw export dates remain in each record.','Times are local wall-clock values; no timezones are supplied.','Duration and witness coordinates are absent. The explanation column was removed upstream.','Upstream cleaning totals are described by group notes, not independently rederived from the final export.','Reuse permission remains unresolved.'])
    parts=DATA/'reports';parts.mkdir(exist_ok=True)
    for old in parts.glob('part-*.json.gz'):old.unlink()
    names=[]
    for start in range(0,len(records),10000):
        name=f'reports/part-{start//10000+1:03d}.json.gz';names.append(name)
        (DATA/name).write_bytes(gzip.compress(packed(records[start:start+10000]),compresslevel=9,mtime=0))
    save(DATA/'reports.json',dict(schema_version='partitioned-v1',total_reports=len(records),parts=names))
    save(DATA/'manifest.json',manifest);save(DATA/'summaries.json',summaries)
    save(ROOT/'docs/dataset-import-checks.json',dict(input_rows=len(incoming),output_rows=len(records),unique_ids=len(ids),date_orders=dict(orders),reported_date_orders=dict(reported_orders),all_source_links_match_ids=True,quality=quality))
    assert len(ids)==len(records)==len(incoming)
    print(json.dumps(quality,indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('input',type=Path)
    parser.add_argument('--reference-dates',type=Path,default=ROOT/'scripts/reference-dates.json.gz')
    args=parser.parse_args();build(args.input,args.reference_dates)
