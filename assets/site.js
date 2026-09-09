(() => {
  const STORAGE_KEY = 'supracraft-theme';
  const THEMES = new Set(['system', 'light', 'dark']);
  const THEME_OPTIONS = [
    { value: 'system', label: 'System', icon: '<svg class="theme-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3.5" y="4.5" width="17" height="12" rx="2"></rect><path d="M8 20h8M12 16.5V20"></path></svg>' },
    { value: 'light', label: 'Light', icon: '<svg class="theme-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3.5"></circle><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"></path></svg>' },
    { value: 'dark', label: 'Dark', icon: '<svg class="theme-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15.8 3.5a8.5 8.5 0 1 0 4.7 14.6 7 7 0 0 1-4.7-14.6Z"></path></svg>' }
  ];
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  function readPreference() {
    try {
      const value = window.localStorage.getItem(STORAGE_KEY);
      return THEMES.has(value) ? value : 'system';
    } catch (_) {
      return 'system';
    }
  }

  function effectiveTheme(preference) {
    if (preference === 'light' || preference === 'dark') return preference;
    return media.matches ? 'dark' : 'light';
  }

  function syncControls(preference) {
    const fallback = document.getElementById('theme-select');
    if (fallback && fallback.value !== preference) fallback.value = preference;
    document.querySelectorAll('input[name="supracraft-theme-choice"]').forEach(control => {
      control.checked = control.value === preference;
    });
  }

  function applyPreference(preference, persist = false) {
    const normalized = THEMES.has(preference) ? preference : 'system';
    if (normalized === 'system') delete root.dataset.theme;
    else root.dataset.theme = normalized;
    root.style.colorScheme = normalized === 'system' ? 'light dark' : normalized;

    if (persist) {
      try { window.localStorage.setItem(STORAGE_KEY, normalized); } catch (_) {}
    }

    syncControls(normalized);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const mode = effectiveTheme(normalized);
      const value = getComputedStyle(root).getPropertyValue('--browser-theme-color').trim();
      if (value) meta.setAttribute('content', value);
      meta.dataset.effectiveTheme = mode;
    }
  }

  function upgradeThemeControl() {
    const select = document.getElementById('theme-select');
    const wrapper = select?.closest('.theme-control');
    if (!select || !wrapper || wrapper.matches('fieldset')) return null;

    const fieldset = document.createElement('fieldset');
    fieldset.className = 'theme-control theme-segmented';
    fieldset.dataset.themeControl = 'segmented';

    const legend = document.createElement('legend');
    legend.className = 'sr-only';
    legend.textContent = 'Theme';
    fieldset.append(legend);

    const options = document.createElement('span');
    options.className = 'theme-options';
    const preference = readPreference();

    for (const option of THEME_OPTIONS) {
      const label = document.createElement('label');
      label.className = 'theme-option';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'supracraft-theme-choice';
      input.value = option.value;
      input.setAttribute('aria-label', option.label);
      input.checked = option.value === preference;

      const face = document.createElement('span');
      face.className = 'theme-option-face';
      face.innerHTML = option.icon;
      const tooltip = document.createElement('span');
      tooltip.className = 'theme-tooltip';
      tooltip.setAttribute('aria-hidden', 'true');
      tooltip.textContent = option.label;
      face.append(tooltip);
      label.append(input, face);
      options.append(label);
    }

    fieldset.append(options);
    wrapper.replaceWith(fieldset);
    return fieldset;
  }

  function bindTheme() {
    const segmented = upgradeThemeControl();
    if (segmented) {
      segmented.querySelectorAll('input[name="supracraft-theme-choice"]').forEach(control => {
        control.addEventListener('change', () => {
          if (control.checked) applyPreference(control.value, true);
        });
      });
    } else {
      const fallback = document.getElementById('theme-select');
      if (fallback) fallback.addEventListener('change', () => applyPreference(fallback.value, true));
    }
    applyPreference(readPreference(), false);
  }

  function externalIndicator() {
    const indicator = document.createElement('span');
    indicator.className = 'external-link-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    indicator.textContent = '↗';
    const note = document.createElement('span');
    note.className = 'sr-only';
    note.textContent = ' (opens in a new tab or window)';
    return [indicator, note];
  }

  function makeExternalLink(url, label) {
    const link = document.createElement('a');
    link.className = 'external-link';
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.append(document.createTextNode(`${label} `), ...externalIndicator());
    return link;
  }

  function makeOrganizationLink(url, label) {
    const link = document.createElement('a');
    link.href = url;
    link.textContent = label;
    return link;
  }

  function isOrganizationSite(url) {
    try {
      const target = new URL(url);
      return target.protocol === 'https:' && target.hostname === 'supracraft.github.io';
    } catch (_) {
      return false;
    }
  }

  function repoCard(repo) {
    const article = document.createElement('article');
    article.className = 'repo-item';
    const title = document.createElement('h4');
    title.textContent = repo.name;
    const description = document.createElement('p');
    description.textContent = repo.description || 'Public SupraCraft repository.';
    const meta = document.createElement('div');
    meta.className = 'repo-meta';
    if (repo.language) {
      const language = document.createElement('span');
      language.textContent = repo.language;
      meta.append(language);
    }
    if (repo.fork) {
      const fork = document.createElement('span');
      fork.textContent = 'Fork';
      meta.append(fork);
    }
    const actions = document.createElement('div');
    actions.className = 'card-actions';
    if (repo.homepage && isOrganizationSite(repo.homepage)) {
      actions.append(makeOrganizationLink(repo.homepage, 'Project site'));
    }
    actions.append(makeExternalLink(repo.html_url, 'Source'));
    article.append(title, description, meta, actions);
    return article;
  }

  function enhanceFeatured(repo) {
    const card = document.querySelector(`[data-project="${CSS.escape(repo.name)}"]`);
    if (!card) return;
    const actions = card.querySelector('[data-project-actions]');
    if (!actions) return;
    if (repo.homepage && isOrganizationSite(repo.homepage) && !actions.querySelector('a[data-live-project-site]')) {
      const projectLink = makeOrganizationLink(repo.homepage, 'Visit project site');
      projectLink.dataset.liveProjectSite = 'true';
      projectLink.className = 'project-site-link';
      actions.prepend(projectLink);
    }
  }

  async function loadRepositories() {
    const list = document.querySelector('[data-repository-list]');
    const status = document.getElementById('repository-status');
    if (!list || !status) return;
    try {
      const response = await fetch('https://api.github.com/orgs/SupraCraft/repos?type=public&sort=full_name&per_page=100', {
        headers: { Accept: 'application/vnd.github+json' }
      });
      if (!response.ok) throw new Error(`repository request returned ${response.status}`);
      const repos = await response.json();
      const visible = repos
        .filter(repo => !repo.archived && !['.github', 'supracraft.github.io'].includes(repo.name))
        .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

      list.replaceChildren(...visible.map(repoCard));
      visible.forEach(enhanceFeatured);
      status.textContent = visible.length
        ? `${visible.length} public ${visible.length === 1 ? 'repository' : 'repositories'}`
        : '';
    } catch (_) {
      status.textContent = '';
    }
  }

  applyPreference(readPreference(), false);
  const onReady = () => {
    bindTheme();
    loadRepositories();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady, { once: true });
  else onReady();

  const onSystemChange = () => {
    if (readPreference() === 'system') applyPreference('system', false);
  };
  if (typeof media.addEventListener === 'function') media.addEventListener('change', onSystemChange);
  else if (typeof media.addListener === 'function') media.addListener(onSystemChange);
})();
