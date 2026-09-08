# SupraCraft organization hub

This repository is the public source for <https://supracraft.github.io/>.

The hub is intentionally a thin, independently deployable static site:

- organization orientation and public project discovery live here;
- product-specific documentation and task flows remain in each product's public repository;
- project discovery progressively enhances from GitHub's public API and always retains a native GitHub repository-list fallback;
- the site has no runtime dependency on private repositories or private credentials;
- public-site qualification runs entirely on public-safe GitHub Actions.

The shared interaction grammar is versioned as public machine-readable metadata in `organization.json`. Product sites may vendor compatible snapshots while remaining independently operable.
