(function () {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const STORAGE = {
    bookmarks: 'campusvault_bookmarks_v1',
    recent: 'campusvault_recent_v1',
    quizHistory: 'campusvault_quiz_history_v1',
    events: 'campusvault_events_v1'
  };

  function loadJSON(key, fallback = []) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }

  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { }
  }

  function canonicalUrl(pathname, params) {
    const url = new URL(pathname, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
      });
    }
    return url.toString();
  }

  function trackEvent(name, payload = {}) {
    const entry = { name, payload, at: new Date().toISOString() };
    const history = loadJSON(STORAGE.events, []);
    history.unshift(entry);
    saveJSON(STORAGE.events, history.slice(0, 100));
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: name, ...payload });
  }

  function toast(message) {
    let stack = $('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      document.body.appendChild(stack);
    }
    const item = document.createElement('div');
    item.className = 'toast';
    item.textContent = message;
    stack.appendChild(item);
    setTimeout(() => item.remove(), 2400);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    }
  }

  async function shareItem({ title, text, url, eventName = 'resource_share' }) {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        trackEvent(eventName, { method: 'native', url });
        toast('Share sheet opened');
        return;
      } catch {
        // fall back
      }
    }
    const copied = await copyText(url);
    if (copied) {
      trackEvent(eventName, { method: 'copy', url });
      toast('Link copied');
    }
  }

  function whatsappShare({ title, description, url }) {
    const message = `📚 ${title}\n\n${description || 'I found this useful resource on CampusVault.'}\n\nCheck it out:\n${url}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank', 'noopener');
    trackEvent('whatsapp_share', { url, title });
  }

  function toggleBookmark(resourceId) {
    const existing = loadJSON(STORAGE.bookmarks, []);
    const updated = existing.includes(resourceId)
      ? existing.filter(id => id !== resourceId)
      : [...existing, resourceId];
    saveJSON(STORAGE.bookmarks, updated);
    return updated.includes(resourceId);
  }

  function isBookmarked(resourceId) {
    return loadJSON(STORAGE.bookmarks, []).includes(resourceId);
  }

  function markRecent(resourceId) {
    const recent = loadJSON(STORAGE.recent, []);
    const updated = [resourceId, ...recent.filter(id => id !== resourceId)].slice(0, 20);
    saveJSON(STORAGE.recent, updated);
  }

  function slug(text) {
    return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  function updateMobileNav() {
    const hamburger = $('#menuToggle');
    const nav = $('.nav');
    if (!hamburger || !nav) return;
    const toggle = () => {
      const open = nav.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', String(open));
      hamburger.textContent = open ? '✕' : '☰';
    };
    hamburger.addEventListener('click', toggle);
    $$('.nav-link', nav).forEach(link => link.addEventListener('click', () => {
      nav.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      hamburger.textContent = '☰';
    }));
  }

  function markActiveNav() {
    const current = window.location.pathname.split('/').pop() || 'index.html';
    $$('.nav-link').forEach(link => {
      const href = link.getAttribute('href');
      link.classList.toggle('active', href === current || (current === '' && href === 'index.html'));
    });
  }

  function setupGlobalSearch() {
    const form = $('#globalSearchForm');
    const input = $('#globalSearchInput');
    if (!form || !input) return;
    form.addEventListener('submit', event => {
      event.preventDefault();
      const q = input.value.trim();
      window.location.href = q ? `resources.html?q=${encodeURIComponent(q)}` : 'resources.html';
    });
  }

  function setupRequestForm() {
    const form = $('#requestResourceForm');
    if (!form) return;
    form.addEventListener('submit', event => {
      event.preventDefault();
      trackEvent('resource_request_submitted', {
        type: $('#requestType') ? $('#requestType').value : 'other'
      });
      toast('Request saved locally. Connect backend to receive submissions.');
      form.reset();
    });
  }

  async function fetchData(path, fallback = []) {
    try {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) throw new Error('fetch failed');
      return await response.json();
    } catch {
      return fallback;
    }
  }

  async function mountResourceLibrary() {
    const root = $('#resourceGrid');
    if (!root) return;

    const resources = await fetchData('assets/data/resources.json');
    const search = $('#resourceSearch');
    const count = $('#resourceCount');
    const empty = $('#resourceEmpty');
    const filters = {
      branch: $('#filterBranch'),
      semester: $('#filterSemester'),
      subject: $('#filterSubject'),
      unit: $('#filterUnit'),
      type: $('#filterType')
    };

    const params = new URLSearchParams(window.location.search);
    if (params.get('q') && search) search.value = params.get('q');

    const options = key => ['All', ...new Set(resources.map(item => item[key] || 'All'))];
    Object.entries(filters).forEach(([key, select]) => {
      if (!select) return;
      options(key).forEach(value => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = value;
        select.appendChild(opt);
      });
    });

    const byId = new Map(resources.map(item => [item.id, item]));

    function matches(resource) {
      const q = (search?.value || '').trim().toLowerCase();
      const text = [resource.title, resource.description, resource.subject, resource.type, resource.unit].join(' ').toLowerCase();
      if (q && !text.includes(q)) return false;
      for (const [key, select] of Object.entries(filters)) {
        if (select && select.value !== 'All' && (resource[key] || 'All') !== select.value) return false;
      }
      return true;
    }

    function resourceUrl(item) {
      return canonicalUrl('resources.html', { resource: item.id });
    }

    function render(list) {
      root.replaceChildren();
      if (count) count.textContent = `${list.length} resource${list.length === 1 ? '' : 's'}`;
      empty.hidden = list.length > 0;

      list.forEach(item => {
        const card = document.createElement('article');
        card.className = 'resource-card';
        card.id = `resource-${item.id}`;
        const link = item.url || '';
        const titleUrl = resourceUrl(item);
        const related = (item.related || []).map(id => byId.get(id)).filter(Boolean);

        card.innerHTML = `
          <h3>${item.title}</h3>
          <p>${item.description}</p>
          <div class="tag-row">
            <span class="tag">${item.branch}</span>
            <span class="tag">Sem ${item.semester}</span>
            <span class="tag">${item.subject}</span>
            <span class="tag">${item.unit}</span>
            <span class="tag">${item.type}</span>
            ${item.placeholder ? '<span class="tag">Placeholder</span>' : ''}
          </div>
          ${related.length ? `<div class="status-note">Related: ${related.map(r => `<a href="resources.html?resource=${encodeURIComponent(r.id)}">${r.title}</a>`).join(' • ')}</div>` : ''}
          <div class="card-actions">
            ${link ? `<a class="btn" href="${link}" target="_blank" rel="noopener" data-open-resource>Open</a>` : '<button class="btn btn-ghost" type="button" disabled>Open unavailable</button>'}
            <button class="btn btn-outline" type="button" data-share>Share</button>
            <button class="btn btn-outline" type="button" data-copy>Copy link</button>
            <button class="btn btn-outline" type="button" data-whatsapp>WhatsApp</button>
            <button class="btn btn-ghost" type="button" data-save>${isBookmarked(item.id) ? 'Saved' : 'Save'}</button>
          </div>
          <div class="status-note">Direct link: <a href="${titleUrl}">${titleUrl}</a></div>
        `;

        $('[data-open-resource]', card)?.addEventListener('click', () => {
          markRecent(item.id);
          trackEvent('resource_view', { id: item.id, type: item.type });
          trackEvent('resource_download', { id: item.id, source: item.source });
        });

        $('[data-share]', card)?.addEventListener('click', () => {
          shareItem({
            title: item.title,
            text: item.shareDescription || 'I found this useful resource on CampusVault.',
            url: titleUrl,
            eventName: 'resource_share'
          });
        });

        $('[data-copy]', card)?.addEventListener('click', async () => {
          const ok = await copyText(titleUrl);
          if (ok) {
            trackEvent('resource_share', { method: 'copy', id: item.id });
            toast('Resource link copied');
          }
        });

        $('[data-whatsapp]', card)?.addEventListener('click', () => whatsappShare({
          title: item.title,
          description: item.shareDescription || 'I found this useful resource on CampusVault.',
          url: titleUrl
        }));

        $('[data-save]', card)?.addEventListener('click', event => {
          const saved = toggleBookmark(item.id);
          event.currentTarget.textContent = saved ? 'Saved' : 'Save';
          toast(saved ? 'Saved to dashboard' : 'Removed from saved');
        });

        root.appendChild(card);
      });

      const deepId = params.get('resource');
      if (deepId) {
        const target = document.getElementById(`resource-${CSS.escape(deepId)}`);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          target.style.borderColor = 'var(--accent)';
          setTimeout(() => { target.style.borderColor = ''; }, 2400);
        }
      }
    }

    const refresh = () => render(resources.filter(matches));
    [search, ...Object.values(filters)].forEach(field => field && field.addEventListener('input', refresh));
    refresh();
  }

  async function mountHomeCollections() {
    const popular = $('#popularResources');
    const trending = $('#trendingQuizzes');
    const featuredProjects = $('#featuredProjects');
    if (!popular && !trending && !featuredProjects) return;

    const [resources, quizzes, projects] = await Promise.all([
      fetchData('assets/data/resources.json'),
      fetchData('assets/data/quizzes.json'),
      fetchData('assets/data/projects.json')
    ]);

    if (popular) {
      popular.replaceChildren();
      resources.filter(item => !item.placeholder).slice(0, 4).forEach(item => {
        const card = document.createElement('article');
        card.className = 'category-card';
        card.innerHTML = `<h3>${item.title}</h3><p>${item.description}</p><a class="btn btn-outline" href="resources.html?resource=${encodeURIComponent(item.id)}">Open resource</a>`;
        popular.appendChild(card);
      });
    }

    if (trending) {
      trending.replaceChildren();
      quizzes.slice(0, 3).forEach(quiz => {
        const card = document.createElement('article');
        card.className = 'quiz-card';
        card.innerHTML = `<h3>${quiz.title}</h3><p>${quiz.subject} • ${quiz.difficulty}</p><a class="btn btn-outline" href="quizzes.html?quiz=${encodeURIComponent(quiz.id)}">Start quiz</a>`;
        trending.appendChild(card);
      });
    }

    if (featuredProjects) {
      featuredProjects.replaceChildren();
      projects.slice(0, 3).forEach(project => {
        const card = document.createElement('article');
        card.className = 'project-card';
        card.innerHTML = `
          <h3>${project.title}</h3>
          <p>${project.description}</p>
          <div class="meta-row"><span class="meta-chip">${project.category || 'Project'}</span><span class="meta-chip">${project.tech || 'Tech stack listed in project'}</span></div>
          <a class="btn btn-outline" href="projects.html#${slug(project.title)}">View project</a>`;
        featuredProjects.appendChild(card);
      });
    }
  }

  async function mountProjects() {
    const root = $('#projectList');
    if (!root) return;
    const projects = await fetchData('assets/data/projects.json');
    root.replaceChildren();

    projects.forEach(project => {
      const card = document.createElement('article');
      card.className = 'project-card';
      const projectLink = canonicalUrl('projects.html', { project: project.id || slug(project.title) });
      card.id = slug(project.title);
      card.innerHTML = `
        <h3>${project.title}</h3>
        <p>${project.description}</p>
        <div class="meta-row">
          <span class="meta-chip">${project.category || 'General'}</span>
          <span class="meta-chip">${project.difficulty || 'Student level'}</span>
          <span class="meta-chip">${project.tech || 'Tech listed'}</span>
        </div>
        <div class="card-actions">
          ${project.github ? `<a class="btn" href="${project.github}" target="_blank" rel="noopener" data-project-view>Source</a>` : ''}
          <button type="button" class="btn btn-outline" data-share-project>Share</button>
          <button type="button" class="btn btn-outline" data-share-project-wa>WhatsApp</button>
        </div>
      `;

      $('[data-project-view]', card)?.addEventListener('click', () => trackEvent('project_view', { title: project.title }));
      $('[data-share-project]', card)?.addEventListener('click', () => {
        shareItem({ title: project.title, text: project.description, url: projectLink, eventName: 'project_share' });
      });
      $('[data-share-project-wa]', card)?.addEventListener('click', () => {
        whatsappShare({ title: project.title, description: project.description, url: projectLink });
      });

      root.appendChild(card);
    });
  }

  async function mountQuizzes() {
    const library = $('#quizLibrary');
    const player = $('#quizPlayer');
    if (!library || !player) return;

    const quizzes = await fetchData('assets/data/quizzes.json');
    const params = new URLSearchParams(window.location.search);

    function renderLibrary() {
      library.replaceChildren();
      quizzes.forEach(quiz => {
        const card = document.createElement('article');
        card.className = 'quiz-card';
        card.innerHTML = `
          <h3>${quiz.title}</h3>
          <p>${quiz.category} • ${quiz.difficulty} • ${quiz.questions.length} questions</p>
          <div class="card-actions">
            <button class="btn" type="button" data-start="${quiz.id}">Start quiz</button>
            <button class="btn btn-outline" type="button" data-share="${quiz.id}">Share</button>
          </div>
        `;
        $('[data-start]', card).addEventListener('click', () => startQuiz(quiz.id));
        $('[data-share]', card).addEventListener('click', () => {
          const link = canonicalUrl('quizzes.html', { quiz: quiz.id });
          shareItem({ title: quiz.title, text: 'Try this quiz on CampusVault', url: link, eventName: 'quiz_share' });
        });
        library.appendChild(card);
      });
    }

    function startQuiz(quizId) {
      const quiz = quizzes.find(item => item.id === quizId);
      if (!quiz) return;
      trackEvent('quiz_started', { quiz: quizId });
      let index = 0;
      let score = 0;

      const renderQuestion = () => {
        const item = quiz.questions[index];
        const progress = Math.round(((index + 1) / quiz.questions.length) * 100);
        player.innerHTML = `
          <div class="card">
            <div class="meta-row"><span class="meta-chip">Question ${index + 1}/${quiz.questions.length}</span><span class="meta-chip">${quiz.subject}</span></div>
            <div class="progress" aria-label="Quiz progress"><span style="width:${progress}%"></span></div>
            <h3>${item.question}</h3>
            <div class="grid" style="grid-template-columns:repeat(1,minmax(0,1fr)); margin-top:.6rem;">
              ${item.options.map((option, optionIndex) => `<button class="btn btn-outline" type="button" data-option="${optionIndex}">${option}</button>`).join('')}
            </div>
          </div>
        `;

        $$('[data-option]', player).forEach(button => {
          button.addEventListener('click', () => {
            const selected = Number(button.dataset.option);
            if (selected === item.answer) score += 1;
            index += 1;
            if (index < quiz.questions.length) {
              renderQuestion();
            } else {
              renderResult();
            }
          });
        });
      };

      const renderResult = () => {
        const total = quiz.questions.length;
        const resultLink = canonicalUrl('quizzes.html', { quiz: quiz.id });
        trackEvent('quiz_completed', { quiz: quiz.id, score, total });

        const history = loadJSON(STORAGE.quizHistory, []);
        history.unshift({ quizId: quiz.id, title: quiz.title, score, total, at: new Date().toISOString() });
        saveJSON(STORAGE.quizHistory, history.slice(0, 20));

        player.innerHTML = `
          <div class="card">
            <h3>🎉 Your score: ${score}/${total}</h3>
            <p>${score >= Math.ceil(total * 0.7) ? 'Great work!' : 'Keep practicing and retry this quiz.'}</p>
            <div class="card-actions">
              <button class="btn" type="button" id="retryQuiz">Retry quiz</button>
              <button class="btn btn-outline" type="button" id="shareQuizResult">Share result</button>
              <button class="btn btn-outline" type="button" id="nextQuiz">Next quiz</button>
            </div>
          </div>
        `;

        $('#retryQuiz').addEventListener('click', () => startQuiz(quiz.id));
        $('#nextQuiz').addEventListener('click', () => {
          const currentIndex = quizzes.findIndex(item => item.id === quiz.id);
          const next = quizzes[(currentIndex + 1) % quizzes.length];
          startQuiz(next.id);
        });
        $('#shareQuizResult').addEventListener('click', () => {
          const text = `🎉 I scored ${score}/${total} on CampusVault! Can you beat me?`;
          shareItem({ title: `${quiz.title} result`, text, url: resultLink, eventName: 'quiz_share' });
        });
      };

      renderQuestion();
    }

    renderLibrary();
    if (params.get('quiz')) startQuiz(params.get('quiz'));
  }

  async function mountDashboard() {
    const savedRoot = $('#savedResources');
    const recentRoot = $('#recentResources');
    const quizRoot = $('#quizHistory');
    if (!savedRoot && !recentRoot && !quizRoot) return;

    const resources = await fetchData('assets/data/resources.json');
    const byId = new Map(resources.map(item => [item.id, item]));

    if (savedRoot) {
      const saved = loadJSON(STORAGE.bookmarks, []);
      savedRoot.replaceChildren();
      if (!saved.length) {
        savedRoot.innerHTML = '<div class="empty-state">No saved resources yet. Use the Save button in Resources.</div>';
      } else {
        saved.forEach(id => {
          const item = byId.get(id);
          if (!item) return;
          const card = document.createElement('article');
          card.className = 'info-card';
          card.innerHTML = `<h3>${item.title}</h3><p>${item.description}</p><a class="btn btn-outline" href="resources.html?resource=${encodeURIComponent(item.id)}">Open</a>`;
          savedRoot.appendChild(card);
        });
      }
    }

    if (recentRoot) {
      const recent = loadJSON(STORAGE.recent, []);
      recentRoot.replaceChildren();
      if (!recent.length) {
        recentRoot.innerHTML = '<div class="empty-state">No recent activity yet.</div>';
      } else {
        recent.slice(0, 6).forEach(id => {
          const item = byId.get(id);
          if (!item) return;
          const row = document.createElement('article');
          row.className = 'info-card';
          row.innerHTML = `<h3>${item.title}</h3><p>${item.subject} • ${item.type}</p>`;
          recentRoot.appendChild(row);
        });
      }
    }

    if (quizRoot) {
      const history = loadJSON(STORAGE.quizHistory, []);
      quizRoot.replaceChildren();
      if (!history.length) {
        quizRoot.innerHTML = '<div class="empty-state">No quiz attempts yet.</div>';
      } else {
        history.slice(0, 8).forEach(entry => {
          const row = document.createElement('article');
          row.className = 'info-card';
          row.innerHTML = `<h3>${entry.title}</h3><p>Score ${entry.score}/${entry.total} • ${new Date(entry.at).toLocaleString()}</p>`;
          quizRoot.appendChild(row);
        });
      }
    }
  }

  function mountAIPlayground() {
    const form = $('#aiPromptForm');
    const output = $('#aiOutput');
    if (!form || !output) return;

    const AIService = window.CampusVaultAIService || {
      async run({ tool, prompt }) {
        return {
          status: 'placeholder',
          text: `CampusVault AI backend is not connected yet.\n\nTool: ${tool}\nPrompt: ${prompt}\n\nConnect this UI to your secure backend API route to generate real responses.`
        };
      }
    };

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const tool = $('#aiTool').value;
      const prompt = $('#aiPrompt').value.trim();
      if (!prompt) return;
      output.textContent = 'Generating response...';
      const result = await AIService.run({ tool, prompt });
      output.textContent = result.text;
      trackEvent('ai_tool_used', { tool });
    });

    $$('[data-ai-action]').forEach(button => {
      button.addEventListener('click', () => {
        const prompt = button.dataset.aiAction;
        $('#aiPrompt').value = prompt;
        $('#aiPrompt').focus();
      });
    });
  }

  function mountIotArchive() {
    const grid = $('#iotGrid');
    if (!grid) return;

    const status = $('#iotStatus');
    const search = $('#iotSearch');
    const breadcrumb = $('#driveBreadcrumb');
    const viewer = $('#pdfViewer');
    const frame = $('#pdfFrame');
    const viewerTitle = $('#pdfViewerTitle');
    const closeViewer = $('#pdfViewerClose');

    let archive = null;
    let currentItems = [];
    let folderPath = [];
    let viewerTrigger = null;

    function escapeHtml(value) {
      return String(value).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
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
      $$('.breadcrumb-button', breadcrumb).forEach(button => {
        button.addEventListener('click', () => {
          const depth = Number(button.dataset.depth);
          folderPath = depth < 0 ? [] : folderPath.slice(0, depth + 1);
          showFolder();
        });
      });
    }

    function openPdf(item) {
      viewerTrigger = document.activeElement;
      viewerTitle.textContent = item.name;
      frame.src = `${item.path}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`;
      viewer.hidden = false;
      document.body.classList.add('viewer-open', 'frontend-protected');
      closeViewer.focus();
    }

    function closePdf() {
      viewer.hidden = true;
      frame.src = 'about:blank';
      document.body.classList.remove('viewer-open', 'frontend-protected');
      if (viewerTrigger) viewerTrigger.focus();
    }

    function itemIcon(item) {
      if (item.type === 'folder') return '📁';
      if (item.type === 'pdf') return '📄';
      return '📝';
    }

    function renderItems(items) {
      grid.replaceChildren();
      if (!items.length) {
        grid.innerHTML = '<div class="empty-state">This folder has no mirrored files yet.</div>';
        return;
      }

      items.forEach(item => {
        const row = document.createElement('article');
        row.className = 'drive-item';
        const isFolder = item.type === 'folder';
        const canRead = item.type === 'pdf' && item.path;
        row.innerHTML = `
          <div aria-hidden="true">${itemIcon(item)}</div>
          <div class="drive-item-copy"><h2>${escapeHtml(item.name)}</h2><p>${isFolder ? 'Folder' : item.type || 'File'}</p></div>
          <button class="drive-item-action" type="button" ${isFolder || canRead ? '' : 'disabled'}>${isFolder ? 'Open folder' : canRead ? 'Read PDF' : 'Unavailable'}</button>
        `;
        const action = $('.drive-item-action', row);
        if (isFolder) action.addEventListener('click', () => { folderPath = [...folderPath, item.name]; showFolder(); });
        if (canRead) action.addEventListener('click', () => openPdf(item));
        grid.appendChild(row);
      });
    }

    function filterItems() {
      const query = (search.value || '').trim().toLowerCase();
      const visible = currentItems.filter(item => item.name.toLowerCase().includes(query));
      renderItems(visible);
      status.textContent = `${visible.length} item${visible.length === 1 ? '' : 's'}${query ? ' matching your search' : ''}`;
    }

    function showFolder() {
      const folder = folderAtPath();
      currentItems = folderPath.length
        ? (folder ? folder.items || [] : [])
        : [...archive.folders.map(folder => ({ ...folder, type: 'folder' })), ...archive.files];
      renderBreadcrumb();
      filterItems();
    }

    closeViewer.addEventListener('click', closePdf);
    viewer.addEventListener('click', event => { if (event.target === viewer) closePdf(); });
    document.addEventListener('keydown', event => { if (!viewer.hidden && event.key === 'Escape') closePdf(); });
    search.addEventListener('input', filterItems);

    fetch('assets/data/iot-nptel.json', { cache: 'no-store' })
      .then(response => {
        if (!response.ok) throw new Error('missing');
        return response.json();
      })
      .then(data => {
        archive = data;
        showFolder();
      })
      .catch(() => {
        status.textContent = 'Archive manifest unavailable.';
        grid.innerHTML = '<div class="empty-state">Add assets/data/iot-nptel.json to load this archive.</div>';
      });
  }

  function setupAdPlaceholders() {
    $$('[data-ad-slot]').forEach(slot => {
      slot.innerHTML = '<div class="status-note">Ad placeholder (non-intrusive). Connect AdSense unit ID when ready.</div>';
    });
  }

  updateMobileNav();
  markActiveNav();
  setupGlobalSearch();
  setupRequestForm();
  setupAdPlaceholders();

  Promise.all([
    mountHomeCollections(),
    mountResourceLibrary(),
    mountProjects(),
    mountQuizzes(),
    mountDashboard()
  ]).catch(() => { });

  mountAIPlayground();
  mountIotArchive();
})();
