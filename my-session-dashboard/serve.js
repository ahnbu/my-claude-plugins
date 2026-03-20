/**
 * serve.js — 세션 대시보드 로컬 서버
 * - 기존 index.html 즉시 서빙 (프로그레스바 주입)
 * - SSE로 빌드 진행 상황 전송
 * - 빌드 완료 후 브라우저 리로드
 * - 리로드 후 5초 뒤 자동 종료
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

const PLUGIN_DIR = __dirname;
// build.js: path.join(__dirname, "..", "output", "session-dashboard")
// → my-claude-plugins/output/session-dashboard/index.html (PLUGIN_DIR 한 단계 위)
const OUTPUT_HTML = path.join(PLUGIN_DIR, '..', 'output', 'session-dashboard', 'index.html');

// ── SSE 클라이언트 관리 ──────────────────────────────────────────────
let sseClients = [];
let buildDone = false;

function sendSSE(event, data) {
  const msg = event === 'message'
    ? `data: ${data}\n\n`
    : `event: ${event}\ndata: ${data}\n\n`;
  sseClients.forEach(res => {
    try { res.write(msg); } catch (_) {}
  });
}

// ── 프로그레스 오버레이 (기존 HTML에 주입) ──────────────────────────
const PROGRESS_OVERLAY = `
<div id="build-progress" style="position:fixed;top:0;left:0;right:0;z-index:9999;
  background:#1a1a2e;border-bottom:2px solid #8b5cf6;padding:8px 16px;
  display:flex;align-items:center;gap:12px;font-size:13px;color:#ccc;font-family:sans-serif;box-shadow:0 2px 8px #0008">
  <div style="flex:1">
    <div style="background:#333;border-radius:4px;height:6px;overflow:hidden">
      <div id="bp-bar" style="background:#8b5cf6;height:100%;width:0%;transition:width 0.4s ease"></div>
    </div>
  </div>
  <span id="bp-text" style="white-space:nowrap">업데이트 확인 중...</span>
</div>
<script>
(function(){
  var es = new EventSource('/events');
  var bar = document.getElementById('bp-bar');
  var txt = document.getElementById('bp-text');
  var overlay = document.getElementById('build-progress');
  es.onmessage = function(e){ txt.textContent = e.data; };
  es.addEventListener('progress', function(e){ bar.style.width = e.data + '%'; });
  es.addEventListener('reload', function(){ es.close(); location.reload(); });
  es.addEventListener('no-update', function(){
    if(overlay){ overlay.remove(); }
    es.close();
  });
  es.onerror = function(){ if(overlay){ overlay.remove(); } };
})();
</script>
`;

// ── 첫 실행 로딩 페이지 ──────────────────────────────────────────────
const LOADING_PAGE = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>세션 대시보드 로딩 중...</title>
<style>
* { box-sizing: border-box; }
body {
  margin: 0; background: #0d1117; color: #ccc;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; height: 100vh; gap: 16px;
}
h2 { color: #8b5cf6; margin: 0; font-size: 20px; }
.bar-wrap { width: 320px; background: #333; border-radius: 4px; height: 8px; overflow: hidden; }
.bar { background: #8b5cf6; height: 100%; width: 0%; transition: width 0.4s ease; }
#status { font-size: 13px; color: #888; }
</style>
</head>
<body>
<h2>세션 대시보드 빌드 중...</h2>
<div class="bar-wrap"><div class="bar" id="bp-bar"></div></div>
<div id="status">초기화 중...</div>
<script>
(function(){
  var es = new EventSource('/events');
  var bar = document.getElementById('bp-bar');
  var txt = document.getElementById('status');
  es.onmessage = function(e){ txt.textContent = e.data; };
  es.addEventListener('progress', function(e){ bar.style.width = e.data + '%'; });
  es.addEventListener('reload', function(){ es.close(); location.reload(); });
  es.addEventListener('no-update', function(){ es.close(); location.reload(); });
})();
</script>
</body>
</html>
`;

// ── HTTP 라우터 ──────────────────────────────────────────────────────
function handleRequest(req, res) {
  // SSE 엔드포인트
  if (req.url === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write(': connected\n\n');

    // 빌드가 이미 완료된 경우 → 즉시 no-update 전송
    if (buildDone) {
      res.write('event: no-update\ndata: \n\n');
      res.end();
      return;
    }

    sseClients.push(res);
    req.on('close', () => {
      sseClients = sseClients.filter(r => r !== res);
    });
    return;
  }

  // 메인 페이지
  if (req.url === '/' || req.url === '/index.html') {
    if (fs.existsSync(OUTPUT_HTML)) {
      let html = fs.readFileSync(OUTPUT_HTML, 'utf8');
      // <body> 태그 바로 뒤에 오버레이 주입
      html = html.replace(/(<body[^>]*>)/, `$1${PROGRESS_OVERLAY}`);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } else {
      // 첫 실행 (HTML 없음) → 로딩 페이지
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(LOADING_PAGE);
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
}

// ── 빌드 실행 ──────────────────────────────────────────────────────
function runBuild(server) {
  const buildJs = path.join(PLUGIN_DIR, 'build.js');

  if (!fs.existsSync(buildJs)) {
    console.error('[serve] build.js를 찾을 수 없습니다:', buildJs);
    sendSSE('message', '⚠ build.js를 찾을 수 없습니다');
    sendSSE('no-update', '');
    return;
  }

  let progress = 5;
  sendSSE('progress', progress);
  sendSSE('message', '세션 파일 스캔 중...');

  const child = spawn(process.execPath, [buildJs], {
    cwd: PLUGIN_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });

  child.stdout.on('data', chunk => {
    const lines = chunk.toString().split('\n');
    lines.forEach(line => {
      line = line.trim();
      if (!line) return;
      console.log('[build]', line);

      // 진행률 휴리스틱
      if (/스캔|scan|읽|read/i.test(line)) {
        progress = Math.max(progress, 20);
      } else if (/처리|process|파싱|pars/i.test(line)) {
        progress = Math.min(progress + 10, 80);
      } else if (/✅|완료|done|생성|writ/i.test(line)) {
        progress = 95;
      }
      sendSSE('progress', String(progress));
      sendSSE('message', line);
    });
  });

  child.stderr.on('data', chunk => {
    const text = chunk.toString().trim();
    if (text) {
      console.error('[build err]', text);
      sendSSE('message', `⚠ ${text.split('\n')[0]}`);
    }
  });

  child.on('close', code => {
    if (code === 0) {
      sendSSE('progress', '100');
      sendSSE('message', '빌드 완료! 새로고침 중...');

      setTimeout(() => {
        buildDone = true;
        sendSSE('reload', '');

        // 브라우저 리로드 후 5초 뒤 서버 종료
        setTimeout(() => {
          console.log('[serve] 서버 종료.');
          server.close();
          process.exit(0);
        }, 5000);
      }, 400);
    } else {
      console.error('[serve] 빌드 실패, 종료코드:', code);
      sendSSE('message', `❌ 빌드 실패 (코드: ${code})`);
      sendSSE('no-update', '');
    }
  });
}

// ── 서버 시작 ──────────────────────────────────────────────────────
const server = http.createServer(handleRequest);

// host 미지정 → 0.0.0.0 (모든 인터페이스): IPv4/IPv6 둘 다 수용
// Windows에서 localhost가 ::1로 해석될 경우에도 SSE 연결 성공
server.listen(0, () => {
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}`;
  console.log(`[serve] 서버 실행: ${url}`);

  // 브라우저 열기 (Windows) — "" 빈 타이틀로 URL 모호성 방지
  exec(`start "" "${url}"`, err => {
    if (err) console.error('[serve] 브라우저 열기 실패:', err.message);
  });

  // 800ms 후 빌드 시작 (브라우저가 먼저 페이지 로드할 시간)
  setTimeout(() => runBuild(server), 800);
});

server.on('error', err => {
  console.error('[serve] 서버 오류:', err.message);
  process.exit(1);
});

process.on('uncaughtException', err => {
  console.error('[serve] 미처리 예외:', err.message, err.stack);
});
