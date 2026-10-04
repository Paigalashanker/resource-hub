const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'assets/js/script.js'), 'utf8');

// A deliberately non-parsing DOM: dynamic cards must be built as nodes, not
// HTML. Static placeholders and escaped breadcrumb markup are recorded.
class Element {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    this.listeners = {};
    this.htmlWrites = [];
    this.value = '';
    this.hidden = true;
    this.className = '';
    this.classList = {
      add: (...names) => { this.className += ` ${names.join(' ')}`; },
      remove: (...names) => { this.className = this.className.split(' ').filter(n => !names.includes(n)).join(' '); },
      contains: name => this.className.split(' ').includes(name),
      toggle: (name, force) => {
        const active = force ?? !this.classList.contains(name);
        this.classList[active ? 'add' : 'remove'](name);
        return active;
      }
    };
  }
  set innerHTML(value) { this.htmlWrites.push(value); this.children = []; this._text = ''; }
  insertAdjacentHTML(position, value) { this.htmlWrites.push(value); }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return (this._text || '') + this.children.map(n => n.textContent).join(''); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  removeAttribute(name) { delete this.attributes[name]; }
  appendChild(node) { this.children.push(node); return node; }
  append(...nodes) { nodes.forEach(node => this.appendChild(node)); }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
  click() { (this.listeners.click || []).forEach(listener => listener({ target: this })); }
  focus() {}
  querySelectorAll(selector) {
    const result = [];
    for (const child of this.children) {
      if (selector.startsWith('.') ? child.classList.contains(selector.slice(1)) : child.tagName === selector) result.push(child);
      result.push(...child.querySelectorAll(selector));
    }
    return result;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

async function render({ downloads, projects, archive, cached = false, origin = 'https://campus.example' } = {}) {
  const ids = {};
  const add = name => { ids[name] = new Element(); };
  if (downloads) ['downloadGrid', 'fileCount'].forEach(add);
  if (projects) ['projectList', 'projectGrid'].forEach(add);
  if (archive) ['iotGrid', 'iotStatus', 'iotSearch', 'driveBreadcrumb', 'pdfViewer', 'pdfFrame', 'pdfViewerTitle', 'pdfViewerClose'].forEach(add);
  const storage = new Map();
  if (cached) {
    if (downloads) storage.set('alds_downloads_cache', JSON.stringify({ ts: Date.now(), data: downloads }));
    if (projects) storage.set('alds_projects_cache', JSON.stringify({ ts: Date.now(), data: projects }));
  }
  const responses = { 'assets/data/downloads.json': downloads, 'assets/data/projects.json': projects, 'assets/data/iot-nptel.json': archive };
  const opened = [];
  const errors = [];
  const location = { href: `${origin}/resource-hub/index.html`, origin, search: '', pathname: '/resource-hub/index.html' };
  const document = {
    body: new Element('body'), documentElement: new Element('html'),
    createElement: tag => new Element(tag), getElementById: id => ids[id] || null,
    querySelectorAll: () => [], querySelector: () => null, addEventListener() {}
  };
  const context = vm.createContext({
    document, location, URL, URLSearchParams,
    window: { location, addEventListener() {}, open: (...args) => opened.push(args), setTimeout },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    fetch: async url => ({ ok: responses[url] !== undefined, json: async () => responses[url] }),
    console: { error: (...args) => errors.push(args) }
  });
  vm.runInContext(script, context, { filename: 'script.js' });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(errors, [], 'rendering should not fail');
  return { ids, opened, context };
}

const payload = '\"><img src=x onerror=alert(1)><script>alert(2)</script>';
const unsafe = [
  'javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java\nscript:alert(1)',
  '\tjavascript:alert(1)', 'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox(1)', 'file:///etc/passwd', 'blob:https://campus.example/id',
  'java%73cript:alert(1)', '%6aavascript%3Aalert(1)',
  'http://external.example/file.pdf',
  'https://user:password@external.example/file.pdf', 'https:\\external.example/file.pdf'
];

test('URL policy blocks unsafe and obfuscated schemes, allowing deployed resource URLs', async () => {
  const { context } = await render({ origin: 'http://localhost:8080' });
  for (const value of unsafe) assert.equal(vm.runInContext(`siteContent.url(${JSON.stringify(value)})`, context), null, value);
  assert.equal(vm.runInContext('siteContent.url("//external.example/file.pdf")', context), null);
  for (const value of ['assets/downloads/Notes%20A.pdf', '../images/project.png', '/assets/100%25.pdf', 'https://github.com/example/repo', 'http://localhost:8080/resource.pdf']) {
    assert.equal(vm.runInContext(`siteContent.url(${JSON.stringify(value)})`, context), new URL(value, 'http://localhost:8080/resource-hub/index.html').href, value);
  }
});

test('cached download titles, descriptions, extension badges and URLs cannot inject HTML', async () => {
  const downloads = unsafe.map(url => ({ name: `name${payload}.pdf`, description: payload, url }));
  downloads.push({ name: `name.${payload}`, description: payload, url: `https://files.example/a?name=${payload}` });
  const { ids } = await render({ downloads, cached: true });
  assert.equal(ids.downloadGrid.children.length, downloads.length);
  ids.downloadGrid.children.forEach((card, index) => {
    assert.deepEqual(card.htmlWrites, []);
    assert.equal(card.querySelector('p').textContent, payload);
    assert.equal(card.querySelectorAll('script').length, 0);
    assert.equal(card.querySelectorAll('img').length, 0);
    if (index < unsafe.length) assert.equal(card.querySelectorAll('a').length, 0);
  });
  const link = ids.downloadGrid.children.at(-1).querySelector('a');
  assert.equal(link.getAttribute('href'), new URL(downloads.at(-1).url).href);
  assert.equal(link.getAttribute('onerror'), null);
});

for (const cached of [false, true]) {
  test(`project fields remain literal and unsafe links/images are omitted (${cached ? 'cache' : 'JSON'})`, async () => {
    const projects = unsafe.map(url => ({ title: payload, description: payload, tech: payload, image: url, github: url, demo: url }));
    projects.push({ title: payload, description: payload, tech: payload, image: `https://images.example/a?text=${payload}`, github: 'https://github.com/example/repo', demo: 'demo.html' });
    const { ids } = await render({ projects, cached });
    ids.projectList.children.forEach((card, index) => {
      assert.deepEqual(card.htmlWrites, []);
      assert.equal(card.querySelector('h3').textContent, payload);
      assert.equal(card.querySelector('p').textContent, payload);
      assert.equal(card.querySelector('span').textContent, payload);
      assert.equal(card.querySelectorAll('script').length, 0);
      if (index < unsafe.length) {
        assert.equal(card.querySelectorAll('img').length, 0);
        assert.equal(card.querySelectorAll('a').length, 0);
      } else {
        assert.equal(card.querySelector('img').getAttribute('alt'), payload);
        assert.equal(card.querySelector('img').getAttribute('onerror'), null);
        assert.equal(card.querySelectorAll('a').length, 2);
      }
    });
    ids.projectGrid.children.forEach(card => {
      assert.deepEqual(card.htmlWrites, []);
      assert.equal(card.querySelector('h4').textContent, payload);
      assert.equal(card.querySelectorAll('img').length, 0);
      assert.equal(card.querySelector('a').getAttribute('href'), 'projects.html');
    });
  });
}

test('IoT type/name fields are literal; unsafe file paths and folder sources never open', async () => {
  const archive = {
    folders: unsafe.map(source => ({ name: payload, source, items: [] })),
    files: [...unsafe.map(path => ({ name: payload, type: 'pdf', path })), { name: payload, type: payload, path: 'https://files.example/doc.pdf' }]
  };
  const { ids, opened } = await render({ archive });
  ids.iotGrid.children.forEach((card, index) => {
    assert.deepEqual(card.htmlWrites, []);
    assert.equal(card.querySelector('h2').textContent, payload);
    assert.equal(card.querySelectorAll('script').length, 0);
    const action = card.querySelector('button');
    if (index >= archive.folders.length) assert.equal(action.disabled, true);
    action.click(); // Even forcibly dispatched clicks cannot open unsafe URLs.
  });
  assert.equal(ids.iotGrid.children.at(-1).querySelector('p').textContent, payload.toUpperCase());
  assert.deepEqual(opened, []);
});

test('repository manifests render and Google Drive preview links still open as view links', async () => {
  const manifest = name => JSON.parse(fs.readFileSync(path.join(root, 'assets/data', name), 'utf8'));
  const downloads = manifest('downloads.json');
  const projects = manifest('projects.json');
  const archive = manifest('iot-nptel.json');
  const { ids, opened } = await render({ downloads, projects, archive });
  assert.equal(ids.downloadGrid.children.length, downloads.length);
  ids.downloadGrid.children.forEach(card => assert.ok(card.querySelector('a')));
  assert.equal(ids.projectList.children.length, projects.length);
  assert.equal(ids.projectGrid.children.length, Math.min(3, projects.length));
  ids.projectList.children.forEach(card => {
    assert.ok(card.querySelector('img'));
    assert.ok(card.querySelector('a'));
  });
  const folderIndex = archive.folders.findIndex(folder => folder.items.length);
  ids.iotGrid.children[folderIndex].querySelector('button').click();
  const folder = archive.folders[folderIndex];
  const fileIndex = folder.items.findIndex(item => ['pdf', 'docx'].includes(item.type) && item.path);
  ids.iotGrid.children[fileIndex].querySelector('button').click();
  assert.equal(opened[0][0], folder.items[fileIndex].path.replace(/\/preview(?:[?#].*)?$/, '/view'));
  assert.equal(opened[0][2], 'noopener,noreferrer');
});

test('relative IoT documents, external folders and escaped folder breadcrumbs work', async () => {
  const archive = {
    folders: [
      { name: payload, items: [{ name: 'Notes.pdf', type: 'pdf', path: 'assets/downloads/Notes.pdf' }] },
      { name: 'External', items: [], source: 'https://drive.google.com/open?id=valid' }
    ], files: []
  };
  const { ids, opened } = await render({ archive });
  ids.iotGrid.children[1].querySelector('button').click();
  assert.equal(opened[0][0], archive.folders[1].source);
  ids.iotGrid.children[0].querySelector('button').click();
  assert.ok(ids.driveBreadcrumb.htmlWrites.at(-1).includes('&lt;script&gt;'));
  assert.ok(!ids.driveBreadcrumb.htmlWrites.at(-1).includes('<script>'));
  ids.iotGrid.children[0].querySelector('button').click();
  assert.equal(opened[1][0], 'https://campus.example/resource-hub/assets/downloads/Notes.pdf');
});
