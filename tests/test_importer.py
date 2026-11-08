"""Regression checks for the corrected export contract and population grain."""
import gzip
import importlib.util
import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('adapter', ROOT / 'scripts/import_final_dataset.py')
adapter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)


class CorrectedImportTests(unittest.TestCase):
    def test_corrected_fields_override_legacy_columns(self):
        for time_field in ('TimeOnly', 'Only_Time'):
            with self.subTest(time_field=time_field), tempfile.TemporaryDirectory() as temporary:
                folder = Path(temporary)
                (folder / 'dist/data').mkdir(parents=True)
                (folder / 'docs').mkdir()
                manifest = json.loads((ROOT / 'dist/data/manifest.json').read_text())
                (folder / 'dist/data/manifest.json').write_text(json.dumps(manifest))
                row = {
                    'ID': 123, 'ArticleLink': 'https://nuforc.org/sighting/?id=123',
                    'City': 'Test city', 'State': 'TX', 'Country': 'USA', 'Shape': 'LIGHT',
                    'Date_Fixed': '02-03-2024', time_field: '00:15:30',
                    'Date': 'invalid and ignored', 'Time': '2099-12-31T23:59:00Z',
                    'Date_Corrected': 'invalid and ignored', 'ReportedDate': '02-04-2024',
                    'MediaAvailability': 'No', 'Summary': 'Source summary',
                }
                source = folder / 'corrected.json'
                historical = {**row, 'ID':124, 'ArticleLink':'https://nuforc.org/sighting/?id=124', 'Date_Fixed':'04/17/1897'}
                source.write_text(json.dumps(row) + '\n' + json.dumps(historical) + '\n')
                pop = folder / 'population.json'
                pop.write_text(json.dumps([{'state':'Texas', 'state_abbr':'TX', 'year':2024, 'population':31290831},
                                          {'state':'Texas', 'state_abbr':'TX', 'year':1897, 'population':1000}]))
                previous_root, previous_data = adapter.ROOT, adapter.DATA
                try:
                    adapter.ROOT, adapter.DATA = folder, folder / 'dist/data'
                    # Corrected imports must work without the legacy reference file.
                    with contextlib.redirect_stdout(io.StringIO()):
                        adapter.build(source, folder / 'reference-does-not-exist.gz', pop)
                    index = json.loads((folder / 'dist/data/reports.json').read_text())
                    reports = json.loads(gzip.decompress((folder / 'dist/data' / index['parts'][0]).read_bytes()))
                finally:
                    adapter.ROOT, adapter.DATA = previous_root, previous_data
                self.assertEqual(len(reports), 2)
                self.assertEqual(reports[0]['occurred_at_local'], '2024-02-03T00:15:30')
                self.assertEqual(reports[0]['state_population'], 31290831)
                self.assertEqual(reports[1]['state_population'], 1000)
                self.assertEqual(reports[1]['population_year'], 1897)
                self.assertIn('suspicious_year', reports[1]['quality_flags'])
                self.assertFalse(reports[1]['eligible_for_time_analysis'])
                summary = json.loads((folder / 'dist/data/summaries.json').read_text())
                self.assertEqual(summary['quality']['valid_hour_reports'], 2)
                self.assertEqual(summary['by_hour'][0]['report_count'], 2)

    def test_duplicate_state_year_is_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'population.json'
            record = {'state':'Texas', 'state_abbr':'TX', 'year':2024, 'population':31290831}
            path.write_text(json.dumps([record, record]))
            with self.assertRaisesRegex(ValueError, 'duplicate population'):
                adapter.population_dimension(path, {'TX': {'state_name':'Texas'}})


if __name__ == '__main__':
    unittest.main()
