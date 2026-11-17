import http from 'node:http';
import { readFile } from 'node:fs/promises';
import next from 'next';

// Local QA only. Serve the worker captured from the build without leaving
// changes in the protected public/sw.js file.
const hostname = '127.0.0.1';
const port = Number(process.env.PORT || 4185);
const worker = await readFile('test-results/redesign/build-sw.js');
const app = next({ dev: false, hostname, port });
await app.prepare();
const handle = app.getRequestHandler();
const server = http.createServer((request, response) => {
  if (request.url?.split('?')[0] === '/sw.js') {
    response.writeHead(200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    response.end(worker);
    return;
  }
  void handle(request, response);
});
server.listen(port, hostname, () => console.log(`Local QA: http://${hostname}:${port}`));
