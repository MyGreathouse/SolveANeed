import http from 'node:http';
const routes = [['/auth/v1', 'http://127.0.0.1:9999'], ['/rest/v1', 'http://127.0.0.1:3001']];
http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, {'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}); return res.end(); }
  const r = routes.find(([p]) => req.url.startsWith(p));
  if (!r) { res.writeHead(404); return res.end('no route'); }
  const target = new URL(r[1] + req.url.slice(r[0].length));
  const p = http.request(target, { method: req.method, headers: { ...req.headers, host: target.host } }, (up) => {
    res.writeHead(up.statusCode, { ...up.headers, 'access-control-allow-origin': '*' }); up.pipe(res);
  });
  p.on('error', (e) => { res.writeHead(502); res.end(String(e)); });
  req.pipe(p);
}).listen(54321, () => console.log('gateway up'));
