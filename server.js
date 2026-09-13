const { createServer } = require('http');
const { readFile } = require('fs');
const { extname, join, normalize } = require('path');

const root = __dirname;
const port = Number(process.env.PORT) || 3000;
const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml'
};

createServer(async (request, response) => {
    const requestedPath = decodeURIComponent((request.url && request.url.split('?')[0]) || '/');
    const relativePath = requestedPath === '/' ? 'index.html' : requestedPath.replace(/^\/+/, '');
    const filePath = normalize(join(root, relativePath));

    if (!filePath.startsWith(root)) {
        response.writeHead(403).end('Forbidden');
        return;
    }

    readFile(filePath, (error, file) => {
        if (error) {
            response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
            return;
        }
        response.writeHead(200, { 'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream' });
        response.end(file);
    });
}).listen(port, () => {
    console.log(`Resource Hub running at http://localhost:${port}`);
});
