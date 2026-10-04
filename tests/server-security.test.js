const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { mkdtemp, mkdir, writeFile, symlink, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { createStaticServer } = require('../server');

let temporaryDirectory;
let server;

before(async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'resource-hub-security-'));
    const root = join(temporaryDirectory, 'public');
    const sibling = join(temporaryDirectory, 'public-private');
    for (const directory of ['assets/css', 'assets/js', 'assets/img', 'assets/data', 'assets/downloads', 'assets/downloads/private', '.git', 'src']) {
        await mkdir(join(root, directory), { recursive: true });
    }
    await mkdir(sibling);
    const files = {
        'index.html': '<h1>Public home</h1>',
        'about.html': '<h1>About</h1>',
        'robots.txt': 'User-agent: *',
        'sitemap.xml': '<urlset/>',
        'assets/css/style.css': 'body { color: red; }',
        'assets/js/script.js': 'console.log("public");',
        'assets/img/a picture.png': 'image',
        'assets/data/downloads.json': '[]',
        'assets/downloads/a document.pdf': 'public PDF',
        'assets/downloads/document.docx': 'public DOCX',
        'assets/downloads/private/secret.pdf': 'secret',
        'assets/downloads/.secret.pdf': 'secret',
        'assets/downloads/passwords.txt': 'secret',
        '.git/config': 'secret',
        '.env': 'secret',
        'package.json': 'secret',
        'server.js': 'secret',
        'src/index.html': 'secret',
        'unpublished.html': 'secret'
    };
    await Promise.all(Object.entries(files).map(([path, contents]) => writeFile(join(root, path), contents)));
    await writeFile(join(sibling, 'secret.pdf'), 'sibling secret');
    await symlink(join(sibling, 'secret.pdf'), join(root, 'assets/downloads/escape.pdf'));
    await symlink(join(root, '.env'), join(root, 'assets/downloads/internal.pdf'));
    await symlink(sibling, join(root, 'assets/downloads/linked'));
    await symlink(join(root, 'assets/downloads/a document.pdf'), join(root, 'assets/downloads/public-link.pdf'));
    server = createStaticServer({ root });
    assert.equal(server.listening, false);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
});

after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
});

function request(path, method = 'GET') {
    return new Promise((resolve, reject) => {
        const req = http.request({ host: '127.0.0.1', port: server.address().port, path, method }, response => {
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString() }));
        });
        req.on('error', reject);
        req.end();
    });
}

test('explicit public files, ordinary assets and document downloads remain available', async () => {
    for (const [path, type] of [
        ['/', 'text/html'], ['/about.html?version=1', 'text/html'],
        ['/robots.txt', 'text/plain'], ['/sitemap.xml', 'application/xml'],
        ['/assets/css/style.css', 'text/css'], ['/assets/js/script.js', 'text/javascript'],
        ['/assets/img/a%20picture.png', 'image/png'], ['/assets/data/downloads.json', 'application/json'],
        ['/assets/downloads/a%20document.pdf', 'application/pdf'],
        ['/assets/downloads/document.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        ['/assets/downloads/public-link.pdf', 'application/pdf']
    ]) {
        const result = await request(path);
        assert.equal(result.status, 200, path);
        assert.ok(result.headers['content-type'].startsWith(type), path);
        assert.ok(result.body.length > 0, path);
    }
});

test('HEAD returns GET metadata without a body, including errors', async () => {
    const get = await request('/assets/downloads/a%20document.pdf');
    const head = await request('/assets/downloads/a%20document.pdf', 'HEAD');
    assert.equal(head.status, 200);
    assert.equal(head.body, '');
    assert.equal(head.headers['content-length'], get.headers['content-length']);
    assert.equal(head.headers['content-type'], get.headers['content-type']);
    const denied = await request('/package.json', 'HEAD');
    assert.equal(denied.status, 403);
    assert.equal(denied.body, '');
});

test('private files and raw traversal paths are denied without URL normalization', async () => {
    for (const path of [
        '/.git/config', '/%2egit/config', '/.env', '/package.json', '/server.js',
        '/src/index.html', '/unpublished.html', '/assets/downloads/private/secret.pdf',
        '/assets/downloads/.secret.pdf', '/assets/downloads/passwords.txt',
        '/../public-private/secret.pdf', '/%2e%2e/public-private/secret.pdf',
        '/assets/downloads/../../../public-private/secret.pdf',
        '/assets/downloads/%2e%2e%2f%2e%2e%2f%2e%2e%2fpublic-private/secret.pdf',
        '//assets/css/style.css', '/assets/../index.html'
    ]) {
        const result = await request(path);
        assert.equal(result.status, 403, path);
        assert.equal(result.body, 'Forbidden', path);
    }
});

test('escaping and private-target symlinks are denied', async () => {
    for (const path of ['/assets/downloads/escape.pdf', '/assets/downloads/internal.pdf', '/assets/downloads/linked/secret.pdf']) {
        assert.equal((await request(path)).status, 403, path);
    }
});

test('malformed escapes and invalid path forms return 400 and server stays alive', async () => {
    for (const path of ['/%', '/%ZZ', '/%E0%A4%A', '/%FF', '/assets%00/css/style.css', '/assets%5ccss/style.css', 'http://example.com/index.html']) {
        assert.equal((await request(path)).status, 400, path);
        assert.equal((await request('/')).status, 200);
    }
});

test('only GET and HEAD are accepted', async () => {
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'TRACE']) {
        const result = await request('/', method);
        assert.equal(result.status, 405, method);
        assert.equal(result.headers.allow, 'GET, HEAD', method);
    }
});

test('security headers accompany success, missing files and failures', async () => {
    for (const [path, method, status] of [
        ['/', 'GET', 200], ['/assets/css/missing.css', 'GET', 404],
        ['/server.js', 'GET', 403], ['/%', 'GET', 400], ['/', 'POST', 405]
    ]) {
        const result = await request(path, method);
        assert.equal(result.status, status);
        assert.equal(result.headers['x-content-type-options'], 'nosniff');
        assert.equal(result.headers['referrer-policy'], 'no-referrer');
        assert.equal(result.headers['x-frame-options'], 'DENY');
    }
});
