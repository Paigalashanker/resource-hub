// ─── Form submission success popup ───
(function () {
  const params = new URLSearchParams(window.location.search);
  if (params.get('submitted') === 'true') {
    // Clean the URL
    window.history.replaceState({}, '', window.location.pathname);

    // Create popup overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;z-index:9999;animation:fadeIn .25s ease';

    const popup = document.createElement('div');
    popup.style.cssText = 'background:var(--bg-secondary,#16171d);color:var(--text-primary,#fff);border:1px solid var(--border);border-radius:20px;padding:36px 32px;text-align:center;max-width:400px;width:90%;box-shadow:var(--shadow);';
    popup.innerHTML = `
      <div style="font-size:44px;margin-bottom:12px;">✅</div>
      <h2 style="margin:0 0 10px;font-size:22px;font-weight:600;">Message Sent!</h2>
      <p style="color:var(--text-secondary,#b2bbc5);margin:0 0 24px;font-size:14.5px;line-height:1.6;">Your message has been submitted successfully. I'll get back to you soon!</p>
      <button id="popupClose" class="btn" style="min-height:40px;padding:10px 28px;">OK</button>
    `;
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    document.getElementById('popupClose').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }
})();

// Basic interactions: theme toggle, nav active link, hamburger menu
(function () {
  // Theme toggle with localStorage persistence
  const THEME_KEY = 'alds_theme';
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light') document.documentElement.classList.add('light-theme');

  const tbtn = document.querySelectorAll('.theme-toggle');
  tbtn.forEach(b => {
    b.addEventListener('click', () => {
      document.documentElement.classList.toggle('light-theme');
      const isLight = document.documentElement.classList.contains('light-theme');
      localStorage.setItem(THEME_KEY, isLight ? 'light' : 'dark');
      tbtn.forEach(btn => { btn.textContent = isLight ? '☀️' : '🌓'; });
    });
    // Set initial icon
    if (document.documentElement.classList.contains('light-theme')) b.textContent = '☀️';
  });

  // Hamburger menu toggle
  const hamburger = document.getElementById('menuToggle');
  const nav = document.querySelector('.nav');
  if (hamburger && nav) {
    hamburger.addEventListener('click', () => {
      nav.classList.toggle('open');
      hamburger.textContent = nav.classList.contains('open') ? '✕' : '☰';
    });
    nav.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        nav.classList.remove('open');
        hamburger.textContent = '☰';
      });
    });
  }

  // Highlight nav link based on location
  const links = document.querySelectorAll('.nav-link');
  links.forEach(a => {
    if (location.pathname.endsWith(a.getAttribute('href'))) {
      links.forEach(x => x.classList.remove('active'));
      a.classList.add('active');
    }
  });

  // Scroll-reveal for .fade-in elements
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.animationPlayState = 'running';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.fade-in').forEach(el => {
      el.style.animationPlayState = 'paused';
      observer.observe(el);
    });
  }
})();

// ─── Auto-generate download cards from GitHub repo ───
(function () {
  const GITHUB_USER = 'paigalashanker';
  const GITHUB_REPO = 'resource-hub';
  const DOWNLOAD_PATH = 'assets/downloads';
  const BRANCH = 'main';
  const CACHE_KEY = 'alds_downloads_cache';
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in ms

  const grid = document.getElementById('downloadGrid');
  const searchInput = document.getElementById('searchInput');
  const fileCount = document.getElementById('fileCount');
  const categoryFilters = document.getElementById('categoryFilters');
  if (!grid) return;

  let activeCategory = 'all';

  // ── Cache helpers ──
  function getCached() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(CACHE_KEY); return null; }
      return data;
    } catch { return null; }
  }
  function setCache(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch { }
  }

  // File-type badge labels & icons
  const typeMap = {
    pdf: { label: 'PDF', icon: '📄', cat: 'pdf' },
    zip: { label: 'ZIP', icon: '📦', cat: 'zip' },
    rar: { label: 'RAR', icon: '📦', cat: 'zip' },
    doc: { label: 'DOC', icon: '📝', cat: 'doc' },
    docx: { label: 'DOCX', icon: '📝', cat: 'doc' },
    ppt: { label: 'PPT', icon: '📊', cat: 'doc' },
    pptx: { label: 'PPTX', icon: '📊', cat: 'doc' },
    xls: { label: 'XLS', icon: '📊', cat: 'doc' },
    xlsx: { label: 'XLSX', icon: '📊', cat: 'doc' },
    txt: { label: 'TXT', icon: '📃', cat: 'doc' },
    png: { label: 'PNG', icon: '🖼️', cat: 'img' },
    jpg: { label: 'JPG', icon: '🖼️', cat: 'img' },
    jpeg: { label: 'JPEG', icon: '🖼️', cat: 'img' },
    exe: { label: 'EXE', icon: '⚙️', cat: 'exe' },
    msi: { label: 'MSI', icon: '⚙️', cat: 'exe' },
    apk: { label: 'APK', icon: '📱', cat: 'exe' },
  };

  function getExt(name) {
    const parts = name.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  }

  function prettyName(filename) {
    let name = filename.replace(/\.[^.]+$/, '');
    name = name.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
    return name;
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function buildCard(file) {
    const ext = getExt(file.name);
    const info = typeMap[ext] || { label: ext.toUpperCase() || 'FILE', icon: '📁', cat: 'other' };
    const title = prettyName(file.name);
    const downloadUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${BRANCH}/${DOWNLOAD_PATH}/${encodeURIComponent(file.name)}`;

    const card = document.createElement('div');
    card.className = 'download-card card';
    card.dataset.category = info.cat || 'other';
    card.dataset.ext = ext;
    card.innerHTML = `
      <span class="file-badge">${info.icon} ${info.label}</span>
      <h3 style="margin:14px 0 8px;font-size:18px;">${title}</h3>
      <p style="color:var(--text-secondary); margin-bottom:18px; font-size:13.5px;">
        ${info.label} file · ${formatSize(file.size)}
      </p>
      <a class="btn btn-compact" href="${downloadUrl}" download="${file.name}">Download</a>
    `;
    return card;
  }

  function filterCards() {
    const q = (searchInput ? searchInput.value : '').toLowerCase();
    let visibleCount = 0;
    grid.querySelectorAll('.download-card').forEach(card => {
      const text = (card.textContent || '').toLowerCase();
      const matchQuery = text.includes(q);
      const matchCat = activeCategory === 'all' || card.dataset.category === activeCategory;
      if (matchQuery && matchCat) {
        card.style.display = 'block';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });
    if (fileCount) {
      fileCount.textContent = `${visibleCount} file${visibleCount !== 1 ? 's' : ''}`;
    }
  }

  async function loadDownloads() {
    grid.innerHTML = '<p style="text-align:center;padding:30px;color:var(--text-secondary);">Loading resources…</p>';
    try {
      let downloads = getCached();

      if (!downloads) {
        const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${DOWNLOAD_PATH}?ref=${BRANCH}`;
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error('GitHub API returned ' + res.status);
        const files = await res.json();
        downloads = files.filter(f => f.type === 'file' && !f.name.startsWith('.'));
        setCache(downloads);
      }

      if (downloads.length === 0) {
        grid.innerHTML = '<p style="text-align:center;padding:30px;color:var(--text-secondary);">No downloadable files found yet.</p>';
        if (fileCount) fileCount.textContent = '0 files';
        return;
      }

      if (fileCount) fileCount.textContent = downloads.length + ' file' + (downloads.length !== 1 ? 's' : '');

      grid.innerHTML = '';
      downloads.forEach(file => grid.appendChild(buildCard(file)));

      if (searchInput) {
        searchInput.addEventListener('input', filterCards);
      }

      if (categoryFilters) {
        categoryFilters.querySelectorAll('.category-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            categoryFilters.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeCategory = btn.dataset.category || 'all';
            filterCards();
          });
        });
      }

    } catch (err) {
      console.error('Failed to load downloads:', err);
      grid.innerHTML = `
        <p style="text-align:center; padding:30px; color:var(--text-secondary);">
          Could not load remote files currently. <br>
          <small>Check that the repository is accessible and connected.</small>
        </p>`;
    }
  }

  loadDownloads();
})();

// -- IoT (NPTEL) folder browser and reading-only PDF viewer --
(function () {
  const grid = document.getElementById('iotGrid');
  if (!grid) return;

  const status = document.getElementById('iotStatus');
  const search = document.getElementById('iotSearch');
  const breadcrumb = document.getElementById('driveBreadcrumb');
  const viewer = document.getElementById('pdfViewer');
  const frame = document.getElementById('pdfFrame');
  const viewerTitle = document.getElementById('pdfViewerTitle');
  const closeViewer = document.getElementById('pdfViewerClose');
  let archive = null;
  let currentItems = [];
  let folderPath = [];

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  }

  function folderAtPath() {
    let items = archive.folders;
    let folder = null;
    folderPath.forEach(name => {
      folder = items.find(item => item.name === name);
      items = folder && folder.items ? folder.items : [];
    });
    return folder;
  }

  function renderBreadcrumb() {
    breadcrumb.innerHTML = '<button class="breadcrumb-button" data-depth="-1">IoT (NPTEL)</button>';
    folderPath.forEach((name, index) => {
      breadcrumb.insertAdjacentHTML('beforeend', `<span class="breadcrumb-separator">/</span><button class="breadcrumb-button" data-depth="${index}">${escapeHtml(name)}</button>`);
    });
    breadcrumb.querySelectorAll('.breadcrumb-button').forEach(button => button.addEventListener('click', () => {
      const depth = Number(button.dataset.depth);
      folderPath = depth < 0 ? [] : folderPath.slice(0, depth + 1);
      showFolder();
    }));
  }

  function itemIcon(item) { return item.type === 'folder' ? '📁' : item.type === 'pdf' ? '📄' : '📝'; }

  function openPdf(item) {
    if (item.type !== 'pdf' || !item.path) return;
    viewerTitle.textContent = item.name;
    frame.src = `${item.path}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`;
    viewer.hidden = false;
    document.body.classList.add('viewer-open');
    closeViewer.focus();
  }

  function closePdf() {
    viewer.hidden = true;
    frame.src = 'about:blank';
    document.body.classList.remove('viewer-open');
  }

  function renderItems(items) {
    grid.innerHTML = '';
    if (!items.length) {
      grid.innerHTML = '<p class="drive-empty">This folder has no mirrored files yet.</p>';
      return;
    }
    items.forEach(item => {
      const card = document.createElement('article');
      card.className = 'drive-item';
      const isFolder = item.type === 'folder';
      const canRead = item.type === 'pdf' && item.path;
      card.innerHTML = `<div class="drive-item-icon" aria-hidden="true">${itemIcon(item)}</div><div class="drive-item-copy"><h2>${escapeHtml(item.name)}</h2><p>${isFolder ? 'Folder' : (item.type || 'File').toUpperCase()}</p></div><button class="drive-item-action" type="button" ${canRead || isFolder ? '' : 'disabled'}>${isFolder ? 'Open folder' : canRead ? 'Read PDF' : 'Unavailable'}</button>`;
      const action = card.querySelector('button');
      if (isFolder) action.addEventListener('click', () => { folderPath = [...folderPath, item.name]; showFolder(); });
      if (canRead) action.addEventListener('click', () => openPdf(item));
      grid.appendChild(card);
    });
  }

  function showFolder() {
    const folder = folderAtPath();
    currentItems = folderPath.length ? (folder ? folder.items || [] : []) : [...archive.folders.map(folder => ({ ...folder, type: 'folder' })), ...archive.files];
    renderBreadcrumb();
    filterItems();
  }

  function filterItems() {
    const query = search.value.trim().toLowerCase();
    const visible = currentItems.filter(item => item.name.toLowerCase().includes(query));
    renderItems(visible);
    status.textContent = `${visible.length} item${visible.length === 1 ? '' : 's'}${query ? ' matching your search' : ''}`;
  }

  closeViewer.addEventListener('click', closePdf);
  viewer.addEventListener('click', event => { if (event.target === viewer) closePdf(); });
  search.addEventListener('input', filterItems);
  document.body.classList.add('frontend-protected');
  document.addEventListener('keydown', event => {
    if (!viewer.hidden && event.key === 'Escape') closePdf();
    const key = event.key.toLowerCase();
    const blockedShortcut = event.key === 'F12' || (event.ctrlKey || event.metaKey) && ['s', 'p', 'u'].includes(key) || (event.ctrlKey || event.metaKey) && event.shiftKey && ['i', 'j', 'c'].includes(key);
    if (blockedShortcut) event.preventDefault();
  });
  document.addEventListener('contextmenu', event => event.preventDefault());
  document.addEventListener('dragstart', event => event.preventDefault());

  fetch('assets/data/iot-nptel.json', { cache: 'no-store' })
    .then(response => { if (!response.ok) throw new Error('Manifest unavailable'); return response.json(); })
    .then(data => { archive = data; showFolder(); })
    .catch(() => { status.textContent = 'Archive manifest unavailable.'; grid.innerHTML = '<p class="drive-empty">Add assets/data/iot-nptel.json to load this archive.</p>'; });
})();

// ─── Auto-generate project cards from projects.json ───
(function () {
  const GITHUB_USER = 'paigalashanker';
  const GITHUB_REPO = 'resource-hub';
  const BRANCH = 'main';
  const JSON_PATH = 'assets/data/projects.json';
  const CACHE_KEY = 'alds_projects_cache';
  const CACHE_TTL = 5 * 60 * 1000;

  const fullGrid = document.getElementById('projectList');
  const previewGrid = document.getElementById('projectGrid');
  if (!fullGrid && !previewGrid) return;

  function getCached() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(CACHE_KEY); return null; }
      return data;
    } catch { return null; }
  }
  function setCache(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch { }
  }

  function buildFullCard(p) {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = `
      <img src="${p.image}" alt="${p.title}" loading="lazy">
      <h3>${p.title}</h3>
      <p>${p.description}</p>
      ${p.tech ? `<div class="project-tags"><span>${p.tech}</span></div>` : ''}
      <div style="display:flex; gap:10px; margin: 0 22px 20px; flex-wrap:wrap;">
        ${p.github ? `<a class="btn btn-compact btn-outline" href="${p.github}" target="_blank" rel="noopener">GitHub</a>` : ''}
        ${p.demo ? `<a class="btn btn-compact" href="${p.demo}" target="_blank" rel="noopener">Live Demo</a>` : ''}
      </div>
    `;
    return card;
  }

  function buildPreviewCard(p) {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = `
      <img src="${p.image}" alt="${p.title}" loading="lazy">
      <h4>${p.title}</h4>
      <p>${p.description}</p>
      <a href="projects.html" class="link">View Details &rarr;</a>
    `;
    return card;
  }

  async function loadProjects() {
    if (fullGrid) fullGrid.innerHTML = '<p style="text-align:center;padding:30px;color:var(--text-secondary);">Loading projects…</p>';
    if (previewGrid) previewGrid.innerHTML = '<p style="text-align:center;padding:30px;color:var(--text-secondary);">Loading…</p>';

    try {
      let projects = getCached();

      if (!projects) {
        try {
          const url = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${BRANCH}/${JSON_PATH}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error('Failed to fetch from GitHub: ' + res.status);
          projects = await res.json();
        } catch (fetchErr) {
          // Local fallback
          const localRes = await fetch(JSON_PATH);
          if (localRes.ok) {
            projects = await localRes.json();
          } else {
            throw fetchErr;
          }
        }
        if (projects) setCache(projects);
      }

      if (!projects || projects.length === 0) {
        const msg = '<p style="text-align:center;color:var(--text-secondary);">No projects added yet.</p>';
        if (fullGrid) fullGrid.innerHTML = msg;
        if (previewGrid) previewGrid.innerHTML = msg;
        return;
      }

      // Full grid on projects.html
      if (fullGrid) {
        fullGrid.innerHTML = '';
        projects.forEach(p => fullGrid.appendChild(buildFullCard(p)));
      }

      // Preview grid on index.html (show first 3)
      if (previewGrid) {
        previewGrid.innerHTML = '';
        projects.slice(0, 3).forEach(p => previewGrid.appendChild(buildPreviewCard(p)));
      }

    } catch (err) {
      console.error('Failed to load projects:', err);
      const errMsg = `<p style="text-align:center; padding:30px; color:var(--text-muted);">Could not load projects.</p>`;
      if (fullGrid) fullGrid.innerHTML = errMsg;
      if (previewGrid) previewGrid.innerHTML = errMsg;
    }
  }

  loadProjects();
})();

// ─── Daily Quote Widget (Quotable API) ───
(function () {
  const textEl = document.getElementById('quoteText');
  const authorEl = document.getElementById('quoteAuthor');
  const refreshBtn = document.getElementById('quoteRefresh');
  if (!textEl) return;

  async function fetchQuote() {
    textEl.textContent = 'Loading inspiration...';
    authorEl.textContent = '';
    try {
      const res = await fetch('https://api.quotable.io/random?maxLength=120');
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      textEl.textContent = data.content;
      authorEl.textContent = '— ' + data.author;
    } catch {
      // Fallback quotes
      const fallback = [
        { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
        { text: 'Talk is cheap. Show me the code.', author: 'Linus Torvalds' },
        { text: 'First, solve the problem. Then, write the code.', author: 'John Johnson' },
        { text: 'Code is like humor. When you have to explain it, it\'s bad.', author: 'Cory House' },
        { text: 'Simplicity is the soul of efficiency.', author: 'Austin Freeman' }
      ];
      const q = fallback[Math.floor(Math.random() * fallback.length)];
      textEl.textContent = q.text;
      authorEl.textContent = '— ' + q.author;
    }
  }

  fetchQuote();
  if (refreshBtn) refreshBtn.addEventListener('click', fetchQuote);
})();

// ─── Weather Widget (OpenWeatherMap) ───
(function () {
  const body = document.getElementById('weatherBody');
  if (!body) return;

  const OWM_KEY = 'a599d692c1df51d7286f37b8d1ed33ac';

  function renderWeather(data) {
    const temp = Math.round(data.main.temp);
    const desc = data.weather[0].description;
    const icon = data.weather[0].icon;
    const city = data.name;
    const humidity = data.main.humidity;
    const wind = Math.round(data.wind.speed * 3.6);
    const feelsLike = Math.round(data.main.feels_like);

    body.innerHTML = `
      <div class="weather-main">
        <img src="https://openweathermap.org/img/wn/${icon}@2x.png" alt="${desc}" width="54" height="54">
        <div>
          <div class="weather-temp">${temp}°C</div>
          <div class="weather-desc">${desc}</div>
        </div>
      </div>
      <div class="weather-location">📍 ${city}</div>
      <div class="weather-details">
        <span>🌡️ Feels ${feelsLike}°C</span>
        <span>💧 ${humidity}%</span>
        <span>💨 ${wind} km/h</span>
      </div>
    `;
  }

  async function loadWeather(lat, lon) {
    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OWM_KEY}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      renderWeather(data);
    } catch {
      body.innerHTML = '<p class="weather-loading">Could not load weather.</p>';
    }
  }

  async function loadByCity(city) {
    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${OWM_KEY}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      renderWeather(data);
    } catch {
      body.innerHTML = '<p class="weather-loading">Could not load weather.</p>';
    }
  }

  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => loadWeather(pos.coords.latitude, pos.coords.longitude),
      () => loadByCity('Tirupati,IN'),
      { timeout: 5000 }
    );
  } else {
    loadByCity('Tirupati,IN');
  }
})();

// ─── Programming Joke Widget (JokeAPI) ───
(function () {
  const jokeBody = document.getElementById('jokeBody');
  const refreshBtn = document.getElementById('jokeRefresh');
  if (!jokeBody) return;

  async function fetchJoke() {
    jokeBody.innerHTML = '<p style="color:var(--text-muted);">Loading joke...</p>';
    try {
      const res = await fetch('https://v2.jokeapi.dev/joke/Programming?blacklistFlags=nsfw,religious,political,racist,sexist,explicit&type=twopart');
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      if (data.type === 'twopart') {
        jokeBody.innerHTML = `
          <p class="joke-setup">${data.setup}</p>
          <p class="joke-punchline">${data.delivery}</p>
        `;
      } else {
        jokeBody.innerHTML = `<p class="joke-setup">${data.joke}</p>`;
      }
    } catch {
      jokeBody.innerHTML = '<p class="joke-setup">Why do programmers prefer dark mode?</p><p class="joke-punchline">Because light attracts bugs! 🐛</p>';
    }
  }

  fetchJoke();
  if (refreshBtn) refreshBtn.addEventListener('click', fetchJoke);
})();

// ─── Visitor Counter (CountAPI) ───
(function () {
  const countEl = document.getElementById('visitorCount');
  if (!countEl) return;

  async function updateCount() {
    try {
      const res = await fetch('https://api.countapi.xyz/hit/paigalashanker-resource-hub/visits');
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      countEl.textContent = data.value.toLocaleString();
    } catch {
      let count = parseInt(localStorage.getItem('rh_visit_count') || '0', 10);
      count++;
      localStorage.setItem('rh_visit_count', String(count));
      countEl.textContent = count.toLocaleString();
    }
  }

  updateCount();
})();
