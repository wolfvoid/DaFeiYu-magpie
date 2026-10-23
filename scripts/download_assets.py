import concurrent.futures
import hashlib
import json
import urllib.parse
import urllib.request
from pathlib import Path

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'assets/upstream.json').read_text())
destination = root / 'assets/webm'
destination.mkdir(parents=True, exist_ok=True)

def digest(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()

def download(entry):
    target = destination / entry['name']
    if target.exists() and digest(target.read_bytes()) == entry['sha']:
        return
    url = 'https://raw.githubusercontent.com/PC2005-cloud/dsh-pet/' + manifest['commit'] + '/' + urllib.parse.quote(entry['path'])
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=45) as response:
                data = response.read()
            assert len(data) == entry['size'] and digest(data) == entry['sha'], entry['name']
            temporary = target.with_suffix('.download')
            temporary.write_bytes(data)
            temporary.replace(target)
            return
        except Exception:
            if attempt == 2:
                raise

with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    completed = 0
    for result in pool.map(download, manifest['files']):
        completed += 1
        if completed % 20 == 0:
            print(f'Verified {completed}/{len(manifest["files"])} animations', flush=True)
print('All animations downloaded and hash-verified.', flush=True)
