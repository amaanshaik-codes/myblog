(() => {
  const root = document.getElementById('status');
  if (!root) return;

  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Element cache
  const $ = (id) => document.getElementById(id);
  const els = {
    loading: $('status-loading'),
    logstream: $('status-logstream'),
    logsInner: $('status-logs-inner'),
    status: $('status-status'),
    grid: $('status-grid'),
    metabar: $('status-metabar'),

    // Boot
    bootLine1: $('boot-line-1'),
    bootCmd1: $('boot-cmd-1'),
    bootCursor1: $('boot-cursor-1'),

    // Meta bar
    metaUptime: $('sys-meta-uptime'),
    metaInstall: $('sys-meta-install'),
    metaTemp: $('sys-meta-temp'),
    metaDb: $('sys-meta-db'),

    // Specs
    specStatus: $('sys-spec-status'),
    specKernel: $('sys-spec-kernel'),
    specRam: $('sys-spec-ram'),

    // KPIs
    cpu: $('sys-cpu'),
    load: $('sys-load'),
    diskPct: $('sys-disk-pct'),
    cores: $('sys-cores'),
    ram: $('sys-ram'),
    ramUsed: $('sys-ram-used'),
    ramTotal: $('sys-ram-total'),

    // Network
    netUp: $('sys-net-up'),
    netDown: $('sys-net-down'),
    netRatio: $('sys-net-ratio'),

    // Disk
    diskRead: $('sys-disk-read'),
    diskWrite: $('sys-disk-write'),

    // Procs
    procs: $('sys-procs'),

    // Canvases
    sparkCpu: $('spark-cpu'),
    sparkRam: $('spark-ram'),
    sparkNet: $('spark-net'),
    sparkDisk: $('spark-disk'),

    // Layout helpers
    terminalWrap: $('status-terminal'),
    timeline: $('status-timeline')
  };

  // WebSocket config
  const WS_URL = root.getAttribute('data-ws-url') || 'wss://hewlett.tail16475c.ts.net/';
  let ws = null;
  let reconnectAttempts = 0;
  const maxReconnects = 15;
  let firstPacket = false;
  let bootComplete = false;
  let logCount = 0;

  // Data buffers for charts
  const BUFFER_SIZE = 60;
  const series = {
    cpu: [],
    ram: [],
    netUp: [],
    netDown: [],
    diskRead: [],
    diskWrite: []
  };

  // Helpers
  function clamp(n, min, max) { return Math.min(Math.max(n, min), max); }
  function toNum(v, fb = 0) {
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : fb;
  }
  function setText(el, v) { if (el) el.textContent = String(v); }
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function formatUptime(sec) {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  }
  function push(arr, v, max = BUFFER_SIZE) {
    arr.push(v);
    if (arr.length > max) arr.shift();
  }
  function cssVar(name, fb) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb;
  }

  // Boot sequence animation
  async function runBootSequence() {
    if (bootComplete) return;
    
    const cmds = [
      { text: 'ssh hewlett@tailnet', delay: 400 },
      { text: './monitor.sh --stream', delay: 600 }
    ];

    for (let i = 0; i < cmds.length; i++) {
      const cmd = cmds[i];
      const target = els.bootCmd1;
      const cursor = els.bootCursor1;
      
      if (!target || !cursor) break;

      // Type command
      if (prefersReducedMotion) {
        target.textContent = cmd.text;
      } else {
        for (let j = 0; j < cmd.text.length; j++) {
          target.textContent += cmd.text[j];
          await sleep(18 + Math.random() * 12);
        }
      }

      await sleep(cmd.delay);

      // After first command, add response and new prompt
      if (i === 0) {
        addLogLine('Connecting to hewlett.tail16475c.ts.net...', 'info');
        await sleep(300);
        addLogLine('Connection established.', 'success');
        await sleep(200);
        addLogLine(`Last login: ${new Date().toLocaleString()}`, 'dim');
        await sleep(150);
        addLogLine('', 'blank');
        
        // New prompt for next command
        const newLine = document.createElement('div');
        newLine.className = 'status-log status-log--boot';
        newLine.innerHTML = `<span class="log-prompt">hewlett@hewlett:~$</span> <span class="log-cmd" id="boot-cmd-2"></span><span class="log-cursor" id="boot-cursor-2">█</span>`;
        els.logsInner?.appendChild(newLine);
        
        // Update refs
        els.bootCmd1 = $('boot-cmd-2');
        els.bootCursor1 = $('boot-cursor-2');
        $('boot-cursor-1')?.classList.add('hide');
      }
    }

    // Final messages before stream starts
    addLogLine('Initializing telemetry stream...', 'info');
    bootComplete = true;
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function addLogLine(text, type = 'data') {
    if (!els.logsInner) return;

    const line = document.createElement('div');
    line.className = `status-log status-log--${type}`;
    
    if (type === 'blank') {
      line.innerHTML = '&nbsp;';
    } else if (type === 'data') {
      // Data log format
      const ts = new Date().toTimeString().slice(0, 8);
      line.innerHTML = `<span class="log-ts">[${ts}]</span> <span class="log-data">${escapeHtml(text)}</span>`;
    } else {
      line.textContent = text;
    }

    els.logsInner.appendChild(line);
    logCount++;

    // Smooth scroll animation
    if (!prefersReducedMotion) {
      requestAnimationFrame(() => {
        if (els.logstream) {
          els.logstream.scrollTo({
            top: els.logstream.scrollHeight,
            behavior: 'smooth'
          });
        }
      });
    } else {
      els.logstream?.scrollTo(0, els.logstream.scrollHeight);
    }

    // Prune old logs (keep last 100)
    while (els.logsInner.children.length > 100) {
      els.logsInner.removeChild(els.logsInner.firstChild);
    }
  }

  // Canvas setup
  function setupCanvas(canvas) {
    if (!canvas) return null;
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  function drawSpark(canvas, values, color, maxHint = null) {
    if (!canvas || !values.length) return;
    const ctx = setupCanvas(canvas);
    if (!ctx) return;

    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;
    ctx.clearRect(0, 0, w, h);

    const maxV = maxHint ?? Math.max(1, ...values);
    const pad = 4;
    const innerW = Math.max(1, w - pad * 2);
    const innerH = Math.max(1, h - pad * 2);

    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    for (let i = 0; i < values.length; i++) {
      const t = values.length === 1 ? 0 : i / (values.length - 1);
      const x = pad + t * innerW;
      const v = clamp(values[i] / (maxV || 1), 0, 1);
      const y = pad + (1 - v) * innerH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Gradient fill
    const grad = ctx.createLinearGradient(0, pad, 0, pad + innerH);
    grad.addColorStop(0, color + '30');
    grad.addColorStop(1, color + '05');
    ctx.lineTo(pad + innerW, pad + innerH);
    ctx.lineTo(pad, pad + innerH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  }

  function drawDualSpark(canvas, vals1, vals2, color1, color2) {
    if (!canvas) return;
    const ctx = setupCanvas(canvas);
    if (!ctx) return;

    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;
    ctx.clearRect(0, 0, w, h);

    const maxV = Math.max(1, ...vals1, ...vals2);
    const pad = 4;
    const innerW = Math.max(1, w - pad * 2);
    const innerH = Math.max(1, h - pad * 2);

    function stroke(vals, color) {
      if (!vals.length) return;
      ctx.beginPath();
      for (let i = 0; i < vals.length; i++) {
        const t = vals.length === 1 ? 0 : i / (vals.length - 1);
        const x = pad + t * innerW;
        const v = clamp(vals[i] / maxV, 0, 1);
        const y = pad + (1 - v) * innerH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    stroke(vals2, color2);
    stroke(vals1, color1);
  }

  // WebSocket
  function setStatus(text, type = 'default') {
    if (els.status) {
      els.status.textContent = text;
      els.status.className = 'status-pill status-' + type;
    }
  }

  function connect() {
    if (typeof WebSocket === 'undefined') {
      setStatus('unsupported', 'error');
      return;
    }

    try {
      ws = new WebSocket(WS_URL);
    } catch {
      scheduleReconnect();
      return;
    }

    setStatus('connecting', 'warn');

    ws.onopen = () => {
      reconnectAttempts = 0;
      setStatus('connected', 'ok');
      runBootSequence();
    };

    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(String(e.data));
        
        enterLiveMode();
        render(d);
        
        // Add log line for incoming data
        if (bootComplete) {
          const summary = `cpu:${toNum(d.core?.cpu_total, 0).toFixed(0)}% ram:${toNum(d.core?.ram_used, 0).toFixed(1)}/${toNum(d.core?.ram_total, 0).toFixed(1)}G net:↑${toNum(d.io?.up, 0).toFixed(0)}↓${toNum(d.io?.down, 0).toFixed(0)}`;
          addLogLine(summary, 'data');
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      setStatus('disconnected', 'error');
      scheduleReconnect();
    };

    ws.onerror = () => {};
  }

  function scheduleReconnect() {
    if (reconnectAttempts >= maxReconnects) {
      setStatus('offline', 'error');
      return;
    }
    reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 20000);
    setTimeout(() => connect(), delay);
  }

  function enterLiveMode() {
    if (firstPacket) return;
    firstPacket = true;
    // Hide loading indicator
    if (els.loading) els.loading.classList.add('hidden');
    root.classList.add('status--live');
    if (els.grid) els.grid.removeAttribute('hidden');
    if (els.metabar) els.metabar.classList.add('is-visible');
  }

  function render(d) {
    const meta = d.metadata || {};
    const health = d.data_health || {};
    const core = d.core || {};
    const io = d.io || {};

    // Parse values
    const cpu = toNum(core.cpu_total, NaN);
    const ramUsed = toNum(core.ram_used, NaN);
    const ramTotal = toNum(core.ram_total, NaN);
    const ramPct = ramTotal > 0 ? (ramUsed / ramTotal) * 100 : NaN;
    const load = toNum(core.load_1m, NaN);
    const temp = toNum(core.temp_c, NaN);
    const diskPct = toNum(core.disk_used_pct, NaN);
    const netUp = toNum(io.up, NaN);
    const netDown = toNum(io.down, NaN);
    const diskRead = toNum(io.disk_read, NaN);
    const diskWrite = toNum(io.disk_write, NaN);

    // Meta bar
    if (Number.isFinite(toNum(meta.uptime_sec, NaN))) {
      setText(els.metaUptime, formatUptime(meta.uptime_sec));
    }
    setText(els.metaInstall, meta.install_date || '--');
    if (Number.isFinite(temp)) {
      setText(els.metaTemp, temp.toFixed(0) + '°C');
    }
    if (health.db_rows !== undefined) {
      setText(els.metaDb, `${health.db_rows} rows`);
    }

    // Specs
    setText(els.specStatus, health.status || '--');
    setText(els.specKernel, meta.kernel || '--');
    if (Number.isFinite(ramTotal)) {
      setText(els.specRam, ramTotal.toFixed(2) + ' GiB');
    }

    // CPU card
    if (Number.isFinite(cpu)) {
      setText(els.cpu, cpu.toFixed(1));
      push(series.cpu, cpu);
    }
    if (Number.isFinite(load)) {
      setText(els.load, load.toFixed(2));
    }
    if (Number.isFinite(diskPct)) {
      setText(els.diskPct, diskPct.toFixed(0) + '%');
    }

    // CPU cores visualization
    if (Array.isArray(core.cpu_cores) && els.cores) {
      els.cores.innerHTML = core.cpu_cores.map((pct, i) => {
        const v = clamp(toNum(pct, 0), 0, 100);
        return `<div class="status-core" style="--pct: ${v}%"><span>${v.toFixed(0)}</span></div>`;
      }).join('');
    }

    // RAM card
    if (Number.isFinite(ramPct)) {
      setText(els.ram, ramPct.toFixed(1));
      push(series.ram, ramPct);
    }
    if (Number.isFinite(ramUsed)) setText(els.ramUsed, ramUsed.toFixed(2));
    if (Number.isFinite(ramTotal)) setText(els.ramTotal, ramTotal.toFixed(2));

    // Network
    if (Number.isFinite(netUp)) {
      setText(els.netUp, netUp.toFixed(1));
      push(series.netUp, netUp);
    }
    if (Number.isFinite(netDown)) {
      setText(els.netDown, netDown.toFixed(1));
      push(series.netDown, netDown);
    }
    if (Number.isFinite(toNum(health.net_io_ratio, NaN))) {
      setText(els.netRatio, health.net_io_ratio.toFixed(2));
    }

    // Disk IO
    if (Number.isFinite(diskRead)) {
      setText(els.diskRead, diskRead.toFixed(1));
      push(series.diskRead, diskRead);
    }
    if (Number.isFinite(diskWrite)) {
      setText(els.diskWrite, diskWrite.toFixed(1));
      push(series.diskWrite, diskWrite);
    }

    // Processes
    if (els.procs && Array.isArray(d.processes)) {
      els.procs.innerHTML = d.processes.slice(0, 5).map(p => {
        const pid = p.pid ?? '--';
        const name = p.name ?? '--';
        const mem = Number.isFinite(toNum(p.mem, NaN)) ? toNum(p.mem, 0).toFixed(1) : '--';
        return `<div class="status-proc" role="row"><div role="cell">${escapeHtml(pid)}</div><div role="cell" class="status-proc-name">${escapeHtml(name)}</div><div role="cell" class="is-right">${escapeHtml(mem)}</div></div>`;
      }).join('');
    }

    // Draw charts
    const accent = cssVar('--sys-accent', '#27ca40');
    drawSpark(els.sparkCpu, series.cpu, accent, 100);
    drawSpark(els.sparkRam, series.ram, accent, 100);
    drawDualSpark(els.sparkNet, series.netUp, series.netDown, accent, '#3b82f6');
    drawDualSpark(els.sparkDisk, series.diskRead, series.diskWrite, '#ff5f56', '#ffbd2e');
  }

  // Resize handler
  function onResize() {
    const accent = cssVar('--sys-accent', '#27ca40');
    drawSpark(els.sparkCpu, series.cpu, accent, 100);
    drawSpark(els.sparkRam, series.ram, accent, 100);
    drawDualSpark(els.sparkNet, series.netUp, series.netDown, accent, '#3b82f6');
    drawDualSpark(els.sparkDisk, series.diskRead, series.diskWrite, '#ff5f56', '#ffbd2e');
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(onResize, 150);
  });

  // Start
  connect();
})();
