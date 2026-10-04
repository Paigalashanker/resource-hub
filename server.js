const { createServer } = require('http');
const { readFile, realpath, stat } = require('fs/promises');
const { extname, isAbsolute, relative, resolve, sep } = require('path');

const publicFiles = new Set([
    'index.html', 'about.html', 'contact.html', 'disclaimer.html',
    'downloads.html', 'google845af6e47eaa2c61.html', 'iot.html',
    'privacy.html', 'projects.html', 'terms.html', 'robots.txt', 'sitemap.xml'
]);
const assetTypes = {
    css: new Set(['.css']),
    js: new Set(['.js']),
    img: new Set(['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp', '.ico']),
    data: new Set(['.json']),
    downloads: new Set(['.pdf', '.docx'])
};
const privateSegments = new Set([
    'private', 'source', 'src', 'secrets', 'node_modules', 'tests', 'test'
]);
const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml'
};

function isPublicPath(path) {
    const segments = path.split('/');
    if (segments.some(segment => !segment || segment.startsWith('.') || privateSegments.has(segment.toLowerCase()))) {
        return false;
    }
    if (publicFiles.has(path)) return true;
    return segments.length >= 3 && segments[0] === 'assets' &&
        Object.hasOwn(assetTypes, segments[1]) &&
        assetTypes[segments[1]].has(extname(path).toLowerCase());
}

function isContained(root, path) {
    const difference = relative(root, path);
    return difference !== '..' && !difference.startsWith(`..${sep}`) && !isAbsolute(difference);
}

function createStaticServer({ root = __dirname } = {}) {
    root = resolve(root);
    return createServer(async (request, response) => {
        response.setHeader('X-Content-Type-Options', 'nosniff');
        response.setHeader('Referrer-Policy', 'no-referrer');
        response.setHeader('X-Frame-Options', 'DENY');

        const finish = (status, message) => {
            response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end(request.method === 'HEAD' ? undefined : message);
        };
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            response.setHeader('Allow', 'GET, HEAD');
            finish(405, 'Method not allowed');
            return;
        }

        let requestedPath;
        try {
            requestedPath = decodeURIComponent((request.url || '/').split('?')[0]);
        } catch {
            finish(400, 'Bad request');
            return;
        }
        if (!requestedPath.startsWith('/') || requestedPath.includes('\\') || requestedPath.includes('\0')) {
            finish(400, 'Bad request');
            return;
        }
        const relativePath = requestedPath === '/' ? 'index.html' : requestedPath.slice(1);
        const filePath = resolve(root, relativePath);
        if (!isContained(root, filePath) || !isPublicPath(relativePath)) {
            finish(403, 'Forbidden');
            return;
        }

        try {
            const canonicalRoot = await realpath(root);
            const canonicalPath = await realpath(filePath);
            const canonicalRelative = relative(canonicalRoot, canonicalPath).split(sep).join('/');
            if (!isContained(canonicalRoot, canonicalPath) || !isPublicPath(canonicalRelative)) {
                finish(403, 'Forbidden');
                return;
            }
            const metadata = await stat(canonicalPath);
            if (!metadata.isFile()) {
                finish(404, 'Not found');
                return;
            }
            const file = request.method === 'HEAD' ? undefined : await readFile(canonicalPath);
            response.writeHead(200, {
                'Content-Type': mimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream',
                'Content-Length': file ? file.length : metadata.size
            });
            response.end(file);
        } catch {
            finish(404, 'Not found');
        }
    });
}

module.exports = { createStaticServer };

if (require.main === module) {
    const port = Number(process.env.PORT) || 3000;
    const host = process.env.HOST || '127.0.0.1';
    createStaticServer().listen(port, host, () => {
        console.log(`Resource Hub running at http://${host}:${port}`);
    });
}
