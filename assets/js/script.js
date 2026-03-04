// Basic interactions: theme toggle, nav active link
(function(){
  // Theme toggle
  const tbtn = document.querySelectorAll('.theme-toggle');
  tbtn.forEach(b=>{
    b.addEventListener('click', ()=>{
      document.documentElement.classList.toggle('light-theme');
    });
  });

  // Highlight nav link based on location
  const links = document.querySelectorAll('.nav-link');
  links.forEach(a => {
    if(location.pathname.endsWith(a.getAttribute('href'))) {
      links.forEach(x=>x.classList.remove('active'));
      a.classList.add('active');
    }
  });
})();

// ─── Auto-generate download cards from GitHub repo ───
(function(){
  const GITHUB_USER = 'paigalashanker';
  const GITHUB_REPO = 'resource-hub';
  const DOWNLOAD_PATH = 'assets/downloads';
  const BRANCH = 'main'; // change to 'master' if needed
  const CACHE_KEY = 'alds_downloads_cache';
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in ms

  const grid = document.getElementById('downloadGrid');
  const searchInput = document.getElementById('searchInput');
  const fileCount = document.getElementById('fileCount');
  if (!grid) return;

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
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
  }

  // File-type badge labels & icons
  const typeMap = {
    pdf:  { label: 'PDF',  icon: '📄' },
    zip:  { label: 'ZIP',  icon: '📦' },
    rar:  { label: 'RAR',  icon: '📦' },
    doc:  { label: 'DOC',  icon: '📝' },
    docx: { label: 'DOCX', icon: '📝' },
    ppt:  { label: 'PPT',  icon: '📊' },
    pptx: { label: 'PPTX', icon: '📊' },
    xls:  { label: 'XLS',  icon: '📊' },
    xlsx: { label: 'XLSX', icon: '📊' },
    txt:  { label: 'TXT',  icon: '📃' },
    png:  { label: 'PNG',  icon: '🖼️' },
    jpg:  { label: 'JPG',  icon: '🖼️' },
    jpeg: { label: 'JPEG', icon: '🖼️' },
    exe:  { label: 'EXE',  icon: '⚙️' },
    msi:  { label: 'MSI',  icon: '⚙️' },
    apk:  { label: 'APK',  icon: '📱' },
  };

  function getExt(name) {
    const parts = name.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  }

  function prettyName(filename) {
    // Remove extension, replace dashes/underscores with spaces, trim
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
    const info = typeMap[ext] || { label: ext.toUpperCase() || 'FILE', icon: '📁' };
    const title = prettyName(file.name);
    // Raw GitHub download URL
    const downloadUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${BRANCH}/${DOWNLOAD_PATH}/${encodeURIComponent(file.name)}`;

    const card = document.createElement('div');
    card.className = 'download-card card';
    card.style.padding = '22px';
    card.innerHTML = `
      <span class="file-badge">${info.icon} ${info.label}</span>
      <h3 style="font-size:20px; margin:8px 0 6px;">${title}</h3>
      <p style="color:var(--text-secondary,#4d4b63); margin-bottom:12px; font-size:14px;">
        ${info.label} file · ${formatSize(file.size)}
      </p>
      <a class="btn" href="${downloadUrl}" download="${file.name}">Download</a>
    `;
    return card;
  }

  async function loadDownloads() {
    grid.innerHTML = '<p style="text-align:center;padding:30px;">Loading resources…</p>';
    try {
      // Try cache first
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
        grid.innerHTML = '<p>No downloadable files found yet.</p>';
        if (fileCount) fileCount.textContent = '0 files';
        return;
      }

      if (fileCount) fileCount.textContent = downloads.length + ' file' + (downloads.length !== 1 ? 's' : '');

      grid.innerHTML = '';
      downloads.forEach(file => grid.appendChild(buildCard(file)));

      // Wire up search
      if (searchInput) {
        searchInput.addEventListener('input', () => {
          const q = searchInput.value.toLowerCase();
          grid.querySelectorAll('.download-card').forEach(card => {
            const text = (card.textContent || '').toLowerCase();
            card.style.display = text.includes(q) ? 'block' : 'none';
          });
        });
      }

    } catch (err) {
      console.error('Failed to load downloads:', err);
      grid.innerHTML = `
        <p style="text-align:center; padding:30px; color:#e55;">
          Could not load files. <br>
          <small>Check that the repo is public and the branch name is correct.</small>
        </p>`;
    }
  }

  loadDownloads();
})();

