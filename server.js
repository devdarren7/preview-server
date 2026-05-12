const express = require('express');
const path = require('path');
const fs = require('fs');

const PREVIEW_DIR = path.resolve(process.env.PREVIEW_DIR || path.join(__dirname, 'preview'));
const PORT = parseInt(process.env.PORT, 10) || 4173;
const HOST = process.env.HOST || '127.0.0.1';

const app = express();

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function formatDate(date) {
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

function getIcon(name, isDir) {
  if (isDir) return '📁';
  const ext = path.extname(name).toLowerCase();
  if (['.html', '.htm'].includes(ext)) return '🌐';
  if (['.mp4', '.webm', '.mov'].includes(ext)) return '🎬';
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) return '🖼️';
  if (['.mp3', '.wav', '.ogg'].includes(ext)) return '🎵';
  if (['.json', '.js', '.css'].includes(ext)) return '📝';
  if (['.md', '.txt'].includes(ext)) return '📄';
  if (['.pdf'].includes(ext)) return '📕';
  return '📄';
}

function getLocalIP() {
  const nets = require('os').networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

function getRecentFiles(dir, base, results = [], depth = 0) {
  if (depth > 3) return results;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const full = path.join(dir, e.name);
      const rel = base + '/' + e.name;
      if (e.isDirectory()) {
        getRecentFiles(full, rel, results, depth + 1);
      } else {
        const ext = path.extname(e.name).toLowerCase();
        if (['.html','.md','.mp4','.png','.jpg','.pdf','.json'].includes(ext)) {
          const stat = fs.statSync(full);
          results.push({ name: e.name, path: rel, modified: stat.mtime, size: stat.size, ext });
        }
      }
    }
  } catch(e) {}
  return results;
}

function renderDirectory(dirPath, urlPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    .filter(e => !e.name.startsWith('.'));

  const dirs = [];
  const files = [];

  for (const e of entries) {
    const stat = fs.statSync(path.join(dirPath, e.name));
    const item = {
      name: e.name,
      isDir: e.isDirectory(),
      size: stat.size,
      modified: stat.mtime
    };
    (item.isDir ? dirs : files).push(item);
  }

  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => b.modified - a.modified);
  const all = [...dirs, ...files];

  const rows = all.map(item => {
    const href = urlPath + item.name + (item.isDir ? '/' : '');
    const icon = getIcon(item.name, item.isDir);
    const size = item.isDir ? '-' : formatSize(item.size);
    const date = formatDate(item.modified);
    return `<tr>
      <td class="icon">${icon}</td>
      <td><a href="${href}">${item.name}${item.isDir ? '/' : ''}</a></td>
      <td class="size">${size}</td>
      <td class="date">${date}</td>
    </tr>`;
  }).join('\n');

  const parent = urlPath !== '/'
    ? `<tr><td class="icon">⬆️</td><td><a href="${path.dirname(urlPath.slice(0, -1))}/">..</a></td><td></td><td></td></tr>`
    : '';

  let recentSection = '';
  if (urlPath === '/') {
    const ip = getLocalIP();
    const baseUrl = `http://${ip}:${PORT}`;
    const recent = getRecentFiles(PREVIEW_DIR, '')
      .sort((a, b) => b.modified - a.modified)
      .slice(0, 15);
    const recentRows = recent.map(f => {
      const icon = getIcon(f.name, false);
      const folder = path.dirname(f.path).replace(/^\//, '') || 'root';
      return `<tr>
        <td class="icon">${icon}</td>
        <td><a href="${f.path}">${f.name}</a> <span class="folder-tag">${folder}</span></td>
        <td class="size">${formatSize(f.size)}</td>
        <td class="date">${formatDate(f.modified)}</td>
      </tr>`;
    }).join('\n');
    recentSection = `
      <div class="recent-section">
        <h2>Recently Updated</h2>
        <table>${recentRows}</table>
      </div>
      <div class="phone-section">
        <h2>View on Phone</h2>
        <p class="phone-url">${baseUrl}</p>
        <img class="qr" src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(baseUrl)}&bgcolor=0a0a0a&color=60a5fa" alt="QR Code" />
      </div>`;
  }

  return `<!DOCTYPE html>
<html><head><title>~/preview${urlPath}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', system-ui, sans-serif; background: #0a0a0a; color: #e0e0e0; padding: 32px; }
  h1 { font-size: 1.2rem; color: #666; margin-bottom: 24px; font-weight: 400; }
  h1 span { color: #60a5fa; }
  h2 { font-size: 0.85rem; font-weight: 600; color: #60a5fa; text-transform: uppercase; letter-spacing: 0.06em; margin: 2.5rem 0 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid #60a5fa22; }
  table { width: 100%; max-width: 900px; border-collapse: collapse; }
  tr { border-bottom: 1px solid #141414; }
  tr:hover { background: #111; }
  td { padding: 10px 12px; }
  .icon { width: 30px; text-align: center; }
  a { color: #60a5fa; text-decoration: none; }
  a:hover { color: #93c5fd; text-decoration: underline; }
  .size { color: #555; text-align: right; width: 80px; font-size: 0.8rem; }
  .date { color: #383838; text-align: right; width: 150px; font-size: 0.8rem; }
  .count { color: #333; font-size: 0.8rem; margin-top: 16px; }
  .empty { color: #555; margin-top: 20px; }
  .folder-tag { background: #1a1a1a; color: #555; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; margin-left: 6px; }
  .recent-section { margin-bottom: 1rem; }
  .phone-section { margin: 2rem 0; }
  .phone-url { font-family: 'SF Mono', 'Fira Code', monospace; color: #60a5fa; font-size: 0.9rem; margin: 0.5rem 0; cursor: pointer; }
  .phone-url:hover { text-decoration: underline; }
  .qr { margin-top: 0.5rem; border-radius: 8px; }
  h2.folders-heading { margin-top: 2.5rem; }
</style>
</head><body>
<h1><span>~/preview</span>${urlPath}</h1>
${recentSection}
${all.length ? `<h2 class="folders-heading">All Folders</h2><table>${parent}${rows}</table>
<p class="count">${dirs.length} folders, ${files.length} files</p>` :
'<p class="empty">Empty directory</p>'}
</body></html>`;
}

app.use((req, res, next) => {
  const reqPath = path.join(PREVIEW_DIR, decodeURIComponent(req.path));

  if (!reqPath.startsWith(PREVIEW_DIR)) return res.status(403).send('Forbidden');

  if (fs.existsSync(reqPath) && fs.statSync(reqPath).isDirectory()) {
    const indexFile = path.join(reqPath, 'index.html');
    if (req.path !== '/' && !req.query.browse && fs.existsSync(indexFile)) {
      return res.sendFile(indexFile);
    }
    const urlPath = req.path.endsWith('/') ? req.path : req.path + '/';
    return res.send(renderDirectory(reqPath, urlPath));
  }

  next();
});

app.use((req, res, next) => {
  if (!req.path.endsWith('.md')) return next();
  const filePath = path.join(PREVIEW_DIR, decodeURIComponent(req.path));
  if (!filePath.startsWith(PREVIEW_DIR)) return res.status(403).send('Forbidden');
  if (!fs.existsSync(filePath)) return next();

  const raw = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(req.path);
  res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${fileName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', system-ui, sans-serif; background: #0a0a0a; color: #b0b0b0; padding: 2rem; font-size: 15px; }
  .container { max-width: 820px; margin: 0 auto; }
  .topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #1a1a1a; }
  .back { color: #555; text-decoration: none; font-size: 0.8rem; letter-spacing: 0.03em; transition: color 0.2s; }
  .back:hover { color: #60a5fa; }
  .filename { color: #333; font-size: 0.8rem; font-family: 'SF Mono', 'Fira Code', monospace; }
  .md h1 { font-size: 1.8rem; font-weight: 700; color: #f0f0f0; margin: 2rem 0 1rem; letter-spacing: -0.02em; }
  .md h1:first-child { margin-top: 0; }
  .md h2 { font-size: 1.25rem; font-weight: 600; color: #60a5fa; margin: 2.5rem 0 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid #60a5fa22; }
  .md h3 { font-size: 1.05rem; font-weight: 600; color: #e0e0e0; margin: 1.8rem 0 0.5rem; }
  .md h4 { font-size: 0.95rem; font-weight: 600; color: #ccc; margin: 1.5rem 0 0.4rem; }
  .md p { margin: 0.6rem 0; line-height: 1.75; }
  .md ul, .md ol { margin: 0.6rem 0 0.6rem 1.5rem; }
  .md li { margin: 0.35rem 0; line-height: 1.7; }
  .md li::marker { color: #60a5fa; }
  .md code { background: #60a5fa12; color: #60a5fa; padding: 0.15rem 0.45rem; border-radius: 4px; font-size: 0.85em; font-family: 'SF Mono', 'Fira Code', monospace; }
  .md pre { background: #111; border: 1px solid #1e1e1e; border-radius: 10px; padding: 1.2rem; overflow-x: auto; margin: 1rem 0; position: relative; }
  .md pre code { background: none; color: #ccc; padding: 0; font-size: 0.85rem; }
  .md a { color: #60a5fa; text-decoration: none; border-bottom: 1px solid #60a5fa33; transition: all 0.2s; }
  .md a:hover { color: #93c5fd; border-bottom-color: #93c5fd; }
  .md blockquote { border-left: 3px solid #60a5fa; padding: 0.75rem 1rem; color: #888; margin: 1rem 0; background: #60a5fa08; border-radius: 0 8px 8px 0; }
  .md table { border-collapse: collapse; margin: 1rem 0; width: 100%; border-radius: 8px; overflow: hidden; }
  .md th { background: #141414; color: #e0e0e0; font-weight: 600; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; padding: 0.6rem 0.85rem; text-align: left; border-bottom: 2px solid #60a5fa33; }
  .md td { padding: 0.55rem 0.85rem; border-bottom: 1px solid #1a1a1a; }
  .md tr:hover td { background: #ffffff05; }
  .md hr { border: none; height: 1px; background: linear-gradient(to right, transparent, #222, transparent); margin: 2.5rem 0; }
  .md strong { color: #e8e8e8; font-weight: 600; }
  .md em { color: #999; font-style: italic; }
  .md img { max-width: 100%; border-radius: 10px; margin: 0.75rem 0; border: 1px solid #1a1a1a; }
  .md h2 + ul, .md h2 + ol, .md h3 + ul, .md h3 + ol { margin-top: 0.5rem; }
  ::selection { background: #60a5fa33; color: #fff; }
</style>
<script src="https://cdn.jsdelivr.net/npm/marked@12/marked.min.js"><\/script>
</head><body>
<div class="container">
<div class="topbar">
  <a class="back" href="./?browse">&larr; back to folder</a>
  <span class="filename">${fileName}</span>
</div>
<div class="md" id="content"></div>
</div>
<script>
const raw = ${JSON.stringify(raw)};
document.getElementById('content').innerHTML = marked.parse(raw);
</script>
</body></html>`);
});

app.use(express.static(PREVIEW_DIR));

app.use((req, res) => {
  res.status(404).send('Not found');
});

app.listen(PORT, HOST, () => {
  console.log(`Preview server running at http://${HOST}:${PORT}`);
  console.log(`Serving files from ${PREVIEW_DIR}`);
});
