"""Vendor the pinned D3 distribution so the app has no runtime CDN dependency."""
import hashlib
import io
import json
from pathlib import Path
import ssl
import tarfile
import urllib.request
import certifi

ROOT = Path(__file__).resolve().parents[1]
URL = "https://registry.npmjs.org/d3/-/d3-7.9.0.tgz"
with urllib.request.urlopen(URL, context=ssl.create_default_context(cafile=certifi.where()), timeout=45) as response:
    archive_bytes = response.read()
with tarfile.open(fileobj=io.BytesIO(archive_bytes), mode="r:gz") as archive:
    for source, target in [("package/dist/d3.min.js", "d3.min.js"), ("package/LICENSE", "D3-LICENSE.txt")]:
        (ROOT / "dist/vendor" / target).write_bytes(archive.extractfile(source).read())
(ROOT / "dist/vendor/provenance.json").write_text(json.dumps({"package": "d3", "version": "7.9.0", "source_url": URL, "archive_sha256": hashlib.sha256(archive_bytes).hexdigest()}, indent=2))
print("Vendored D3 7.9.0 and its ISC license.")
