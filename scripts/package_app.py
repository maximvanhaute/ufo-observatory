"""Create a portable app archive, excluding hosting identities, caches and QA files."""
import argparse
from pathlib import Path
import shutil
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT.parents[1] / "output/ufo-observatory-app.zip"


def package():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(OUTPUT, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for source in sorted(ROOT.rglob("*")):
            relative = source.relative_to(ROOT)
            if not source.is_file() or any(part.startswith(".") or part in ("output", "node_modules", "__pycache__") for part in relative.parts):
                continue
            archive.write(source, Path("ufo-observatory-app") / relative)
    with zipfile.ZipFile(OUTPUT) as archive:
        assert archive.testzip() is None
        count = len(archive.namelist())
    return OUTPUT, count


if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--copy-to", type=Path)
    args=parser.parse_args()
    output,count=package()
    print(f"Packaged {count} files: {output}")
    if args.copy_to:
        args.copy_to.mkdir(parents=True, exist_ok=True)
        target=args.copy_to/output.name
        shutil.copy2(output,target)
        print(f"Copied app archive to: {target}")
