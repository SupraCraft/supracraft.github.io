#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_FILES = [
    ROOT / 'index.html',
    ROOT / '404.html',
    ROOT / 'accessibility/index.html',
    ROOT / 'assets/site.css',
    ROOT / 'assets/site.js',
    ROOT / 'organization.json',
    ROOT / 'surface.json',
    ROOT / 'llms.txt',
    ROOT / 'robots.txt',
    ROOT / 'sitemap.xml',
]

errors = []
for path in PUBLIC_FILES:
    if not path.is_file():
        errors.append(f'missing public file: {path.relative_to(ROOT)}')

org = json.loads((ROOT / 'organization.json').read_text(encoding='utf-8'))
surface = json.loads((ROOT / 'surface.json').read_text(encoding='utf-8'))

if org.get('canonical_hub') != 'https://supracraft.github.io/':
    errors.append('organization.json canonical_hub is not canonical')
if org.get('discovery', {}).get('private_credentials_required') is not False:
    errors.append('public discovery must not require private credentials')
scopes = org.get('interaction_contract', {}).get('navigation_scopes', {})
if scopes.get('organization_internal', {}).get('behavior') != 'same-context':
    errors.append('organization-internal navigation must use same-context behavior')
if scopes.get('external_handoff', {}).get('behavior') != 'new-context':
    errors.append('external handoffs must use new-context behavior')

route_paths = {item.get('path') for item in surface.get('routes', [])}
if route_paths != {'/', '/accessibility/'}:
    errors.append(f'unexpected surface routes: {sorted(route_paths)}')

private_name_pattern = re.compile(r'(?i)\b[a-z0-9_.-]+-private\b')
for path in PUBLIC_FILES:
    if not path.is_file():
        continue
    text = path.read_text(encoding='utf-8')
    match = private_name_pattern.search(text)
    if match:
        errors.append(f'private-looking repository name exposed in {path.relative_to(ROOT)}: {match.group(0)}')

if errors:
    for error in errors:
        print(f'ERROR: {error}')
    raise SystemExit(1)

print('public site contract: PASS')
