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
    ROOT / 'assets/hero-craft.css',
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
index = (ROOT / 'index.html').read_text(encoding='utf-8')
accessibility = (ROOT / 'accessibility/index.html').read_text(encoding='utf-8')

if org.get('canonical_hub') != 'https://supracraft.github.io/':
    errors.append('organization.json canonical_hub is not canonical')
if org.get('public_repository_catalog') != 'https://github.com/orgs/SupraCraft/repositories':
    errors.append('organization.json repository catalog is not canonical')
resources = org.get('resources', {})
if resources.get('surface') != 'https://supracraft.github.io/surface.json':
    errors.append('organization.json must expose the surface map')
if resources.get('agent_orientation') != 'https://supracraft.github.io/llms.txt':
    errors.append('organization.json must expose agent orientation')

if surface.get('canonical') != 'https://supracraft.github.io/':
    errors.append('surface.json canonical URL is not canonical')
route_paths = {item.get('path') for item in surface.get('routes', [])}
if route_paths != {'/', '/accessibility/'}:
    errors.append(f'unexpected surface routes: {sorted(route_paths)}')
accessibility_route = next((item for item in surface.get('routes', []) if item.get('path') == '/accessibility/'), {})
if accessibility_route.get('secondary') is not True:
    errors.append('accessibility route must remain secondary')

machine_resources = surface.get('machine_resources', {})
if machine_resources != {
    'organization': '/organization.json',
    'surface': '/surface.json',
    'agent_orientation': '/llms.txt',
}:
    errors.append('surface.json machine resource map is incomplete')

# Human UI should expose useful public facts, not implementation/governance scaffolding.
leak_phrases = [
    'without JavaScript',
    "GitHub's public API",
    'For tools and automation',
    'interaction grammar',
    'release lifecycle',
    'task flows',
    'same-tab navigation',
    'external handoff',
    'Automated qualification',
    'performance budgets',
    'native HTML semantics',
]
for path, text in ((ROOT / 'index.html', index), (ROOT / 'accessibility/index.html', accessibility)):
    for phrase in leak_phrases:
        if phrase.lower() in text.lower():
            errors.append(f'human-surface implementation detail exposed in {path.relative_to(ROOT)}: {phrase}')

nav_match = re.search(r'<nav class="site-nav".*?</nav>', index, flags=re.DOTALL)
if not nav_match:
    errors.append('index.html primary navigation not found')
elif '/accessibility/' in nav_match.group(0):
    errors.append('accessibility must not be a primary-navigation destination')

body = index.split('<body>', 1)[-1]
for machine_path in ('/organization.json', '/surface.json', '/llms.txt'):
    if machine_path in body:
        errors.append(f'machine resource must not be visibly linked from the human body: {machine_path}')
if 'class="accessibility-disclosure"' not in index:
    errors.append('index.html must retain a compact secondary accessibility disclosure')
if '<link rel="describedby" href="/surface.json"' not in index:
    errors.append('index.html must retain non-visual machine discovery metadata')

# The current organization hero is an ordinary image whose alt text carries the
# same workbench/vise metaphor as the visible artwork. Keep this contract tied
# to meaning, not to obsolete SVG-internal classes from previous hero concepts.
hero_match = re.search(r'<img\b[^>]*class="hero-craft"[^>]*>', index)
if not hero_match:
    errors.append('current workbench hero image missing')
else:
    hero_tag = hero_match.group(0)
    if 'src="/assets/brand/supracraft-hero.svg"' not in hero_tag:
        errors.append('workbench hero must use the canonical organization hero asset')
    alt_match = re.search(r'alt="([^"]+)"', hero_tag)
    alt = alt_match.group(1).lower() if alt_match else ''
    if not alt or 'precision workbench' not in alt or 'vise' not in alt:
        errors.append('workbench hero alt text must communicate the precision workbench/vise metaphor')

# The human copy must independently carry the core identity if artwork is not rendered.
for phrase in ('Shared craftsmanship', 'The workbench is shared. The projects are their own worlds.'):
    if phrase not in index:
        errors.append(f'human copy missing organization identity phrase: {phrase}')

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
