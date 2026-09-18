/* ============================================================
   音频控制
   ============================================================ */
const bootEl = document.getElementById('boot');
const siteEl = document.querySelector('.site');
let openingFinished = false, openingTimer;

const soundToggle = document.getElementById('soundToggle');
const introBgm = document.getElementById('bgmIntro');
const loopBgm = document.getElementById('bgmLoop');
let bgm = introBgm;
let soundEnabled = true;
let audioPending = true;
let audioFailed = false;
let audioVersion = 0;

const sounds = {
    click: new Audio('assets/blackflow/audio/common_click.699390.mp3'),
    glitch: new Audio('assets/blackflow/audio/screen-glitch.9aa4e0.mp3'),
    paper: new Audio('assets/blackflow/audio/paper.df04ef.mp3'),
    modal: new Audio('assets/blackflow/audio/common_modal.4f789a.mp3')
};
introBgm.volume = 1;
loopBgm.volume = 1;
Object.keys(sounds).forEach(function (key) { sounds[key].preload = 'auto'; });

function skipIntroLead() { introBgm.currentTime = 2; }
if (introBgm.readyState >= 1) skipIntroLead();
else introBgm.addEventListener('loadedmetadata', skipIntroLead, { once: true });

function playSound(name, volume) {
    if (!soundEnabled || !sounds[name]) return;
    const sound = sounds[name].cloneNode();
    sound.volume = volume;
    sound.play().catch(function () { });
}

function updateSoundLabel() {
    soundToggle.setAttribute('aria-pressed', String(soundEnabled));
    soundToggle.textContent = audioFailed ? '音源加载失败'
        : !soundEnabled ? '音乐关闭'
            : audioPending ? '点击播放'
                : '音乐开启';
    soundToggle.title = '沉沦者梦呓 · 点击切换音乐与音效';
}

function setSound(enabled) {
    soundEnabled = enabled;
    const version = ++audioVersion;
    audioFailed = false;
    if (!enabled) {
        introBgm.pause();
        loopBgm.pause();
        audioPending = false;
        updateSoundLabel();
        return;
    }
    audioPending = true;
    updateSoundLabel();
    bgm.volume = 1;
    bgm.play().then(function () {
        if (version !== audioVersion || !soundEnabled) return;
        audioPending = false;
        updateSoundLabel();
    }).catch(function (error) {
        if (version !== audioVersion) return;
        audioPending = true;
        audioFailed = error.name !== 'NotAllowedError' && error.name !== 'AbortError';
        updateSoundLabel();
    });
}

introBgm.addEventListener('ended', function () {
    bgm = loopBgm;
    if (soundEnabled) setSound(true);
});

soundToggle.addEventListener('click', function (event) {
    event.stopPropagation();
    setSound(audioPending || audioFailed ? true : !soundEnabled);
});

document.addEventListener('pointerdown', function (event) {
    if (event.target.closest('#soundToggle')) return;
    if (soundEnabled && audioPending && !audioFailed) setSound(true);
});
document.addEventListener('keydown', function () {
    if (soundEnabled && audioPending && !audioFailed) setSound(true);
});

setSound(true);

/* ============================================================
   开场结束
   ============================================================ */
function finishOpening(immediate) {
    if (openingFinished) return;
    openingFinished = true;
    clearTimeout(openingTimer);
    playSound('modal', .08);
    bootEl.classList.add('finishing');
    window.setTimeout(function () {
        siteEl.classList.add('revealed');
        bootEl.classList.add('done');
    }, immediate ? 360 : 900);
}
bootEl.addEventListener('click', function () { finishOpening(true); });
bootEl.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        finishOpening(true);
    }
});
openingTimer = window.setTimeout(function () { finishOpening(false); }, 2550);

/* ============================================================
   数据源与全局状态
   ============================================================ */
const BINGO_DATA = window.BINGO_DATA || [];
const BINGO_F_DATA = window.BINGO_F_DATA || [];

const CELL_COUNT = 25;
const boardEl = document.getElementById('board');
const drawBtn = document.getElementById('drawBtn');
const fTierGrid = document.getElementById('fTierGrid');

const LEVEL_MAP = [
    1, 3, 5, 2, 4,
    2, 4, 1, 3, 5,
    3, 5, 2, 4, 1,
    4, 1, 3, 5, 2,
    5, 2, 4, 1, 3
];

const LEVEL_SCORES = { 1: 50, 2: 80, 3: 80, 4: 120, 5: 200 };
const LINE_SCORE = 600;
const PLATE_BONUS = 20;

let activeLines = 0;
let scoreVisible = true;

const scoreInputs = ['tempFour', 'tempFive', 'tempSix', 'specialEnemyCount']
    .map(function (id) { return document.getElementById(id); });

/* ============================================================
   记录终端（Tracker）
   ============================================================ */
const trackerPopover = document.getElementById('trackerPopover');
const trackerInput = document.getElementById('trackerInput');
const trackerProgress = document.getElementById('trackerProgress');
const trackerSaved = document.getElementById('trackerSaved');
const trackerTarget = document.getElementById('trackerTarget');
const trackerSession = new Map();
let activeTracker = null;

function trackerDefault(config) {
    if (config.type === 'counter') return { value: config.min || 0 };
    if (config.type === 'checklist') return { selected: [] };
    return { failed: false };
}
function normalizeTrackerState(raw, config) {
    const fallback = trackerDefault(config);
    if (!raw || typeof raw !== 'object') return fallback;
    if (config.type === 'counter') {
        const n = Math.floor(Number(raw.value));
        return { value: Number.isFinite(n) ? Math.max(config.min || 0, n) : fallback.value };
    }
    if (config.type === 'checklist') {
        const valid = new Set(config.options || []);
        return { selected: Array.isArray(raw.selected) ? [...new Set(raw.selected.filter(x => valid.has(x)))] : [] };
    }
    return { failed: raw.failed === true };
}
function readTrackerState(id, config) {
    return normalizeTrackerState(trackerSession.get(id), config);
}
function trackerAmount(state, config) {
    if (config.type === 'counter') return state.value;
    if (config.type === 'checklist') return state.selected.length;
    return state.failed ? 1 : 0;
}
function trackerStatus(amount, config) {
    if (config.type === 'failure') return { complete: false, plated: false };
    return { complete: amount >= config.target, plated: Boolean(config.platedTarget && amount >= config.platedTarget) };
}
function paintTrackerBadge(cell, state, config) {
    const badge = cell.querySelector('.cell-tracker-badge');
    if (!badge) return;
    const amount = trackerAmount(state, config);
    const status = trackerStatus(amount, config);
    const failed = config.type === 'failure' && state.failed;
    badge.textContent = failed ? '失败'
        : config.type === 'failure' ? '可标记'
            : amount + ' / ' + (config.platedTarget || config.target);
    badge.classList.toggle('failed', failed);
    badge.classList.toggle('complete', status.complete);
    badge.classList.toggle('plated', status.plated);
    cell.classList.toggle('tracker-failed', failed);
    cell.classList.toggle('tracker-complete', status.complete);
    cell.classList.toggle('tracker-plated', status.plated);
}
/* 计数类追踪器：根据计数自动判定普通完成 / 镀层完成 */
function applyCounterCompletion(cell, state, config) {
    if (!config || config.type !== 'counter' && config.type !== 'checklist') return;
    const amount = trackerAmount(state, config);
    const reachedTarget = amount >= config.target;
    const reachedPlated = Boolean(config.platedTarget && amount >= config.platedTarget);

    if (!reachedTarget) {
        cell.classList.remove('selected');
        cell.classList.remove('plate-active');
    } else if (reachedPlated) {
        cell.classList.add('selected');
        cell.classList.add('plate-active');
    } else {
        cell.classList.add('selected');
    }
    updatePlateBadge(cell);
}
function targetText(amount, config) {
    if (config.type === 'failure') return amount ? '状态：已失败' : '状态：条件有效';
    if (config.platedTarget && amount >= config.platedTarget) return '镀层记录已达成';
    if (amount >= config.target) return config.platedTarget ? '普通达成 · 镀层 ' + config.platedTarget + config.unit : '条件已达成';
    return '目标 ' + config.target + (config.unit || '项');
}
function refreshTrackerPanel(state) {
    if (!activeTracker) return;
    const config = activeTracker.config;
    const amount = trackerAmount(state, config);
    const max = config.type === 'failure' ? 1 : (config.platedTarget || config.target);
    const progress = config.type === 'failure' ? (state.failed ? 100 : 0) : Math.min(100, amount / max * 100);
    trackerProgress.style.width = progress + '%';
    trackerTarget.textContent = targetText(amount, config);
    trackerSaved.textContent = config.type === 'failure'
        ? (state.failed ? 'FAILURE RECORDED' : '条件仍然有效')
        : (amount >= config.target ? 'OBSERVATION COMPLETE' : '本盘记录 · 当前 ' + amount + (config.unit || ' 项'));
    if (config.type === 'counter') trackerInput.value = String(state.value);
    if (config.type === 'checklist') {
        document.querySelectorAll('#trackerChecklist .tracker-option').forEach(function (button) {
            const selected = state.selected.includes(button.dataset.value);
            button.classList.toggle('active', selected);
            button.setAttribute('aria-pressed', String(selected));
        });
    }
    if (config.type === 'failure') {
        const toggle = document.getElementById('trackerFailureToggle');
        toggle.textContent = state.failed ? '恢复为可完成' : '标记为失败';
        toggle.classList.toggle('active', state.failed);
        toggle.setAttribute('aria-pressed', String(state.failed));
    }
    boardEl.querySelectorAll('[data-entry-id="' + activeTracker.id + '"]').forEach(function (cell) {
        paintTrackerBadge(cell, state, config);
        applyCounterCompletion(cell, state, config);
    });
}
function saveActiveTracker(state) {
    if (!activeTracker) return;
    const normalized = normalizeTrackerState(state, activeTracker.config);
    trackerSession.set(activeTracker.id, normalized);
    activeTracker.state = normalized;
    refreshTrackerPanel(normalized);
}
function setActiveCounterValue(value) {
    if (!activeTracker || activeTracker.config.type !== 'counter') return;
    saveActiveTracker({ value: value });
    updateSelectedCount();
    checkBingo();
    updateScore();
}
function closeTrackerPanel() {
    if (trackerPopover.hidden) return;
    trackerPopover.hidden = true;
    activeTracker = null;
}
function renderChecklist(config, state) {
    const list = document.getElementById('trackerChecklist');
    list.replaceChildren(...config.options.map(function (option) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'tracker-option';
        button.dataset.value = option;
        button.textContent = option;
        button.classList.toggle('active', state.selected.includes(option));
        button.setAttribute('aria-pressed', String(state.selected.includes(option)));
        button.addEventListener('click', function () {
            if (!activeTracker) return;
            const selected = new Set(activeTracker.state.selected);
            selected.has(option) ? selected.delete(option) : selected.add(option);
            saveActiveTracker({ selected: [...selected] });
            playSound('click', .05);
        });
        return button;
    }));
    list.scrollTop = 0;
}
function openTrackerPanel(cell, entry, event) {
    const config = entry.tracker;
    const state = readTrackerState(entry.id, config);
    const cellRect = cell.getBoundingClientRect();
    const anchorX = (event && event.clientX) || cellRect.right;
    const anchorY = (event && event.clientY) || cellRect.top;
    activeTracker = { id: entry.id, config, state, cell };

    document.getElementById('trackerTitle').textContent = entry.title;
    document.getElementById('trackerCondition').textContent = entry.body;
    document.getElementById('trackerCounterPane').hidden = config.type !== 'counter';
    document.getElementById('trackerChecklistPane').hidden = config.type !== 'checklist';
    document.getElementById('trackerFailurePane').hidden = config.type !== 'failure';

    if (config.type === 'counter') {
        trackerInput.min = String(config.min || 0);
        trackerInput.setAttribute('aria-label', config.label);
        document.getElementById('trackerCounterLabel').textContent = config.label;
    }
    if (config.type === 'checklist') {
        document.getElementById('trackerChecklistLabel').textContent = config.label;
        renderChecklist(config, state);
    }

    refreshTrackerPanel(state);
    trackerPopover.hidden = false;

    requestAnimationFrame(function () {
        const rect = trackerPopover.getBoundingClientRect();
        const margin = 12;
        let left = anchorX + 12;
        let top = anchorY + 12;
        if (left + rect.width > innerWidth - margin) left = innerWidth - rect.width - margin;
        if (top + rect.height > innerHeight - margin) top = innerHeight - rect.height - margin;
        trackerPopover.style.left = Math.max(margin, left) + 'px';
        trackerPopover.style.top = Math.max(margin, top) + 'px';
        if (config.type === 'counter') {
            trackerInput.focus();
            trackerInput.select();
        }
    });
    playSound('paper', .06);
}

trackerInput.addEventListener('input', function () {
    if (trackerInput.value !== '') setActiveCounterValue(trackerInput.value);
});
trackerInput.addEventListener('change', function () {
    setActiveCounterValue(trackerInput.value);
});
document.getElementById('trackerMinus').addEventListener('click', function () {
    if (activeTracker) setActiveCounterValue(Number(trackerInput.value) - 1);
});
document.getElementById('trackerPlus').addEventListener('click', function () {
    if (activeTracker) setActiveCounterValue(Number(trackerInput.value) + 1);
});
document.getElementById('trackerFailureToggle').addEventListener('click', function () {
    if (!activeTracker || activeTracker.config.type !== 'failure') return;
    const failed = !activeTracker.state.failed;
    saveActiveTracker({ failed: failed });
    if (failed) {
        boardEl.querySelectorAll('[data-entry-id="' + activeTracker.id + '"]').forEach(function (cell) {
            setCellSelected(cell, false);
        });
        updateSelectedCount();
        checkBingo();
        updateScore();
    }
    playSound(failed ? 'glitch' : 'paper', .06);
});
document.getElementById('trackerClose').addEventListener('click', closeTrackerPanel);
document.addEventListener('pointerdown', function (event) {
    if (!trackerPopover.hidden && !trackerPopover.contains(event.target) && !event.target.closest('.has-tracker')) {
        closeTrackerPanel();
    }
});
document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeTrackerPanel();
});
window.addEventListener('resize', closeTrackerPanel);

/* ============================================================
   说明面板同步
   ============================================================ */
function boardAudioSetup() {
    document.getElementById('board').addEventListener('click', function (event) {
        const cell = event.target.closest('.cell');
        if (!cell) return;
        const frontEl = cell.querySelector('.cell-front .cell-text');
        const backEl = cell.querySelector('.cell-back .cell-text');
        const plateEl = cell.querySelector('.cell-plate .cell-text');
        document.getElementById('detailTitle').textContent = frontEl ? frontEl.textContent : '';
        document.getElementById('detailBody').textContent = (backEl && backEl.textContent) ? backEl.textContent : '此词条没有额外条件。';
        const plateBox = document.getElementById('detailPlate');
        if (plateEl && plateEl.textContent.trim()) {
            plateBox.textContent = '◈ 镀层：' + plateEl.textContent;
            plateBox.style.display = 'block';
        } else {
            plateBox.style.display = 'none';
        }
        const stateLabel = cell.classList.contains('plate-active') ? '镀层显示'
            : cell.classList.contains('selected') ? '已选中'
                : '未选中';
        document.getElementById('detailMeta').textContent = 'NODE ' + cell.dataset.index + ' / ' + stateLabel;
    });
    document.getElementById('drawBtn').addEventListener('click', function () {
        document.getElementById('detailTitle').textContent = '新的探索档案已生成';
        document.getElementById('detailBody').textContent = '点击格子标记完成，鼠标滚轮切换镀层内容，右键打开记录终端。';
        document.getElementById('detailMeta').textContent = 'OBSERVATION / 词条档案';
        document.getElementById('detailPlate').style.display = 'none';
    });
}
boardAudioSetup();

/* ============================================================
   抽取与渲染
   ============================================================ */
function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function pickEntries(levels) {
    const byLevel = {};
    BINGO_DATA.forEach(function (x) {
        if (!x || typeof x.title !== 'string' || !x.title.trim()) return;
        const lv = Math.min(5, Math.max(1, Number(x.level) || 1));
        const item = {
            id: x.id,
            title: x.title.trim(),
            body: (x.body || '').trim(),
            plated: (x.plated || '').trim(),
            tracker: x.tracker && typeof x.tracker === 'object' ? {
                type: ['counter', 'checklist', 'failure'].includes(x.tracker.type) ? x.tracker.type : 'counter',
                label: String(x.tracker.label || '观测记录'),
                unit: String(x.tracker.unit || ''),
                target: Math.max(1, Math.floor(Number(x.tracker.target) || 1)),
                platedTarget: x.tracker.platedTarget ? Math.max(1, Math.floor(Number(x.tracker.platedTarget))) : null,
                min: Math.max(0, Math.floor(Number(x.tracker.min) || 0)),
                options: Array.isArray(x.tracker.options) ? x.tracker.options.map(String) : []
            } : null,
            level: lv
        };
        (byLevel[lv] = byLevel[lv] || []).push(item);
    });

    const pools = {};
    for (let lv = 1; lv <= 5; lv++) {
        const base = byLevel[lv] ? shuffle(byLevel[lv].slice()) : [];
        const need = levels.filter(function (l) { return l === lv; }).length;
        const full = [];
        if (!base.length) {
            for (let i = 0; i < need; i++) {
                full.push({ id: -1, title: '？', body: '', plated: '', level: lv, tracker: null });
            }
        } else {
            while (full.length < need) {
                const chunk = shuffle(base.slice());
                if (full.length && chunk.length > 1 && chunk[0].id === full[full.length - 1].id) {
                    const t = chunk[0]; chunk[0] = chunk[1]; chunk[1] = t;
                }
                full.push.apply(full, chunk);
            }
        }
        pools[lv] = full;
    }

    const ptr = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    return levels.map(function (lv) {
        const pool = pools[lv];
        const item = pool[ptr[lv]++] || { id: -1, title: '？', body: '', plated: '', level: lv, tracker: null };
        return item;
    });
}

function updatePlateBadge(cell) {
    const badge = cell.querySelector('.cell-plate-badge');
    if (!badge) return;
    badge.textContent = cell.classList.contains('plate-active') ? '已镀层' : '可镀层';
}

function renderBoard(entries) {
    const frag = document.createDocumentFragment();

    entries.forEach(function (entry, index) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'cell enter'
            + (entry.body ? '' : ' no-body')
            + (entry.plated ? ' has-plate' : '')
            + (entry.tracker ? ' has-tracker' : '');
        cell.setAttribute('aria-pressed', 'false');
        cell.setAttribute('aria-label',
            entry.title
            + (entry.body ? '：' + entry.body : '')
            + (entry.plated ? '｜镀层：' + entry.plated : '')
            + (entry.tracker ? '｜右键打开' + entry.tracker.label : ''));
        cell.dataset.index = String(index + 1).padStart(2, '0');
        cell.dataset.level = String(entry.level || 1);
        cell.dataset.entryId = String(entry.id !== undefined ? entry.id : -1);
        cell.style.setProperty('--col', index % 5);
        cell.style.setProperty('--row', Math.floor(index / 5));
        cell.style.animationDelay = (index * 20) + 'ms';

        const mark = document.createElement('i');
        mark.className = 'cell-mark';

        const front = document.createElement('span');
        front.className = 'cell-face cell-front';
        front.innerHTML = '<span class="cell-text"></span>';
        front.firstChild.textContent = entry.title;

        const back = document.createElement('span');
        back.className = 'cell-face cell-back';
        back.innerHTML = '<span class="cell-text"></span>';
        back.firstChild.textContent = entry.body;

        cell.append(mark, front, back);

        // 层级数字
        const levelTag = document.createElement('span');
        levelTag.className = 'cell-level';
        levelTag.textContent = String(entry.level || 1);
        cell.appendChild(levelTag);

        // 记录终端
        if (entry.tracker) {
            const trackerBadge = document.createElement('span');
            trackerBadge.className = 'cell-tracker-badge';
            cell.appendChild(trackerBadge);
            cell.dataset.trackerType = entry.tracker.type;
            paintTrackerBadge(cell, readTrackerState(entry.id, entry.tracker), entry.tracker);
            cell.addEventListener('contextmenu', function (event) {
                event.preventDefault();
                event.stopPropagation();
                openTrackerPanel(cell, entry, event);
            });
            cell.addEventListener('keydown', function (event) {
                if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                    event.preventDefault();
                    openTrackerPanel(cell, entry, event);
                }
            });
        }

        // 镀层
        if (entry.plated) {
            const plate = document.createElement('span');
            plate.className = 'cell-plate';
            plate.innerHTML = '<span class="cell-text"></span>';
            plate.firstChild.textContent = entry.plated;
            cell.appendChild(plate);

            const badge = document.createElement('span');
            badge.className = 'cell-plate-badge';
            badge.textContent = '可镀层';
            cell.appendChild(badge);

            // 滚轮切换镀层内容 / 原本内容
            cell.addEventListener('wheel', function (ev) {
                ev.preventDefault();
                ev.stopPropagation();
                cell.classList.toggle('plate-active');
                updatePlateBadge(cell);
                if (cell.classList.contains('selected')) updateScore();
                playSound('paper', .05);
            }, { passive: false });
        }

        cell.addEventListener('click', function (ev) { handleCellClick(cell, ev); });
        cell.addEventListener('animationend', function (ev) {
            if (ev.animationName === 'cellIn') {
                cell.classList.remove('enter');
                cell.style.animationDelay = '';
            }
        });

        frag.appendChild(cell);
    });

    boardEl.replaceChildren(frag);
}

function spawnRipple(cell, ev) {
    const rect = cell.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const r = document.createElement('span');
    r.className = 'ripple';
    const x = (ev && ev.clientX) ? ev.clientX - rect.left : rect.width / 2;
    const y = (ev && ev.clientY) ? ev.clientY - rect.top : rect.height / 2;
    Object.assign(r.style, { width: size + 'px', height: size + 'px', left: x + 'px', top: y + 'px' });
    cell.appendChild(r);
    r.addEventListener('animationend', function () { r.remove(); });
}

/* 只做选中 / 取消选中，镀层内容由滚轮控制 */
function setCellSelected(cell, selected) {
    cell.classList.toggle('selected', selected);
    cell.setAttribute('aria-pressed', String(selected));
    updatePlateBadge(cell);
}

function handleCellClick(cell, ev) {
    if (cell.classList.contains('tracker-failed')) {
        playSound('glitch', .055);
        spawnRipple(cell, ev);
        return;
    }
    // 计数类标记：完成状态由计数自动判定，不响应点击
    if (cell.dataset.trackerType === 'counter' || cell.dataset.trackerType === 'checklist') {
        return;
    }
    playSound('click', .075);
    spawnRipple(cell, ev);
    cell.classList.remove('bounce');
    void cell.offsetWidth;
    cell.classList.add('bounce');

    const next = !cell.classList.contains('selected');
    setCellSelected(cell, next);

    updateSelectedCount();
    checkBingo();
    updateScore();
}

function updateSelectedCount() {
    const n = boardEl.querySelectorAll('.cell.selected').length;
    document.getElementById('selectedCount').textContent = String(n).padStart(2, '0') + ' / 25';
}

function checkBingo() {
    const cells = [...boardEl.children];
    const active = cells.map(function (c) { return c.classList.contains('selected'); });

    const patterns = [];
    for (let r = 0; r < 5; r++) patterns.push({ cells: [0, 1, 2, 3, 4].map(function (c) { return r * 5 + c; }), type: 'row', pos: 10 + r * 20 });
    for (let c = 0; c < 5; c++) patterns.push({ cells: [0, 1, 2, 3, 4].map(function (r) { return r * 5 + c; }), type: 'col', pos: 10 + c * 20 });
    patterns.push(
        { cells: [0, 6, 12, 18, 24], type: 'diag', angle: '45deg' },
        { cells: [4, 8, 12, 16, 20], type: 'diag', angle: '-45deg' }
    );

    const wins = patterns.filter(function (p) { return p.cells.every(function (i) { return active[i]; }); });
    activeLines = wins.length;

    cells.forEach(function (c) { c.classList.remove('winning'); });
    wins.forEach(function (w) {
        w.cells.forEach(function (i) { cells[i].classList.add('winning'); });
    });

    const layer = document.getElementById('bingoLines');
    const oldCount = layer.children.length;
    layer.replaceChildren(...wins.map(function (w) {
        const line = document.createElement('i');
        line.className = 'bingo-line ' + (w.type === 'col' ? 'vertical' : w.type === 'diag' ? 'diagonal' : '');
        if (w.type === 'row') line.style.setProperty('--y', w.pos + '%');
        if (w.type === 'col') line.style.setProperty('--x', w.pos + '%');
        if (w.type === 'diag') line.style.setProperty('--angle', w.angle);
        return line;
    }));

    if (wins.length > oldCount) {
        const burst = document.getElementById('bingoBurst');
        burst.classList.remove('active');
        void burst.offsetWidth;
        burst.classList.add('active');
    }
}

/* ============================================================
   总分计算（实时更新到中央虚影）
   ============================================================ */
function normalizedScoreInput(input) {
    if (!input) return 0;
    const n = Math.floor(Number(input.value));
    const value = Number.isFinite(n) ? Math.min(99, Math.max(0, n)) : 0;
    input.value = String(value);
    return value;
}

function formatScore(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function updateScore() {
    let termScore = 0;
    let platedBonus = 0;

    boardEl.querySelectorAll('.cell.selected').forEach(function (cell) {
        const lv = parseInt(cell.dataset.level, 10) || 1;
        termScore += LEVEL_SCORES[lv] || 0;
        if (cell.classList.contains('plate-active')) platedBonus += PLATE_BONUS;
    });

    const bingoScore = activeLines * LINE_SCORE;

    const four = normalizedScoreInput(document.getElementById('tempFour'));
    const five = normalizedScoreInput(document.getElementById('tempFive'));
    const six = normalizedScoreInput(document.getElementById('tempSix'));
    const special = normalizedScoreInput(document.getElementById('specialEnemyCount'));

    const recruitScore = four * 10 + five * 20 + six * 50;
    const specialScore = special * 20;
    const extraScore = recruitScore + specialScore;

    const fCount = fTierGrid.querySelectorAll('.f-card.selected').length;
    const coefficient = fCount * 0.05;

    const subtotal = termScore + bingoScore + platedBonus + extraScore;
    const total = subtotal * (1 + coefficient);

    const formatted = formatScore(total);
    const overlay = document.getElementById('totalScoreOverlay');
    if (overlay) overlay.textContent = formatted;

    const bottom = document.getElementById('totalScoreBottom');
    if (bottom) bottom.textContent = formatted;

    const topValue = document.getElementById('totalScoreTopValue');
    if (topValue) topValue.textContent = formatted;
}

/* ============================================================
   F 级额外得分系数表
   ============================================================ */
function renderFTier() {
    const frag = document.createDocumentFragment();

    BINGO_F_DATA.forEach(function (entry, index) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'f-card';
        card.dataset.id = entry.id;
        card.dataset.coefficient = String(entry.coefficient || .05);
        card.dataset.index = 'F' + String(index + 1).padStart(2, '0');
        card.setAttribute('aria-pressed', 'false');
        card.setAttribute('aria-label', entry.title + '：' + entry.body + '；完成后得分系数 +' + (entry.coefficient || .05));

        const front = document.createElement('span');
        front.className = 'f-card-face f-card-front';
        const frontText = document.createElement('span');
        frontText.className = 'f-card-text';
        frontText.textContent = entry.title;
        front.appendChild(frontText);

        const back = document.createElement('span');
        back.className = 'f-card-face f-card-back';
        const backText = document.createElement('span');
        backText.className = 'f-card-text';
        backText.textContent = entry.body;
        back.appendChild(backText);

        card.append(front, back);

        card.addEventListener('click', function () {
            const selected = !card.classList.contains('selected');
            card.classList.toggle('selected', selected);
            card.setAttribute('aria-pressed', String(selected));

            const count = fTierGrid.querySelectorAll('.f-card.selected').length;
            document.getElementById('fTierStatus').textContent =
                '已完成 ' + count + ' / ' + BINGO_F_DATA.length + ' · 当前系数 +' + (count * .05).toFixed(2);

            document.getElementById('detailMeta').textContent = 'EXTRA COEFFICIENT / F 级词条';
            document.getElementById('detailTitle').textContent = entry.title;
            document.getElementById('detailBody').textContent = entry.body;
            document.getElementById('detailPlate').style.display = 'none';

            updateScore();
            playSound('click', .065);
        });

        frag.appendChild(card);
    });

    fTierGrid.replaceChildren(frag);
}

/* ============================================================
   抽取
   ============================================================ */
function draw() {
    closeTrackerPanel();
    trackerSession.clear();

    playSound('glitch', .07);
    const frame = document.querySelector('.board-frame');
    frame.classList.remove('drawing');
    void frame.offsetWidth;
    frame.classList.add('drawing');
    setTimeout(function () { frame.classList.remove('drawing'); }, 780);

    renderBoard(pickEntries(LEVEL_MAP));
    document.getElementById('bingoLines').replaceChildren();
    updateSelectedCount();

    activeLines = 0;
    updateScore();

    document.getElementById('archiveId').textContent =
        'BF-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
}

/* ============================================================
   导出 / 导入
   ============================================================ */
function exportBoard() {
    if (!boardEl.children.length) return;

    const cells = [...boardEl.children].map(function (cell) {
        const frontEl = cell.querySelector('.cell-front .cell-text');
        const backEl = cell.querySelector('.cell-back .cell-text');
        const plateEl = cell.querySelector('.cell-plate .cell-text');
        return {
            id: Number(cell.dataset.entryId),
            level: Number(cell.dataset.level) || 1,
            title: frontEl ? frontEl.textContent : '',
            body: backEl ? backEl.textContent : '',
            plated: plateEl ? plateEl.textContent : '',
            selected: cell.classList.contains('selected'),
            plateActive: cell.classList.contains('plate-active')
        };
    });

    const trackers = {};
    trackerSession.forEach(function (state, id) {
        trackers[String(id)] = state;
    });

    const data = {
        version: 3,
        exportedAt: new Date().toISOString(),
        archiveId: document.getElementById('archiveId').textContent,
        cells: cells,
        trackers: trackers,
        fSelected: [...fTierGrid.querySelectorAll('.f-card.selected')].map(function (card) { return card.dataset.id; }),
        extras: {
            tempFour: document.getElementById('tempFour').value,
            tempFive: document.getElementById('tempFive').value,
            tempSix: document.getElementById('tempSix').value,
            specialEnemyCount: document.getElementById('specialEnemyCount').value
        }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const now = new Date();
    const stamp = now.getFullYear()
        + String(now.getMonth() + 1).padStart(2, '0')
        + String(now.getDate()).padStart(2, '0')
        + '-'
        + String(now.getHours()).padStart(2, '0')
        + String(now.getMinutes()).padStart(2, '0')
        + String(now.getSeconds()).padStart(2, '0');
    link.href = url;
    link.download = 'bingo-board-' + stamp + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    playSound('modal', .08);
}

function importBoard(file) {
    const reader = new FileReader();
    reader.onload = function (event) {
        try {
            const raw = JSON.parse(event.target.result);
            const source = Array.isArray(raw) ? raw : (raw && raw.cells);
            if (!Array.isArray(source) || !source.length) throw new Error('文件中没有找到词条数据');

            const imported = source.slice(0, CELL_COUNT);
            while (imported.length < CELL_COUNT) {
                imported.push({ level: LEVEL_MAP[imported.length] || 1, title: '？', body: '', plated: '' });
            }

            const flags = imported.map(function (item) {
                return {
                    selected: Boolean(item && item.selected),
                    plateActive: Boolean(item && item.plateActive)
                };
            });

            const entries = imported.map(function (item, index) {
                const value = item && typeof item === 'object' ? item : {};
                const id = Number(value.id);
                const catalog = BINGO_DATA.find(function (entry) {
                    return Number(entry.id) === id && entry.title === value.title;
                });
                const level = Math.min(5, Math.max(1, Number(value.level) || LEVEL_MAP[index] || 1));
                if (catalog) {
                    return {
                        id: catalog.id,
                        level: level,
                        title: catalog.title,
                        body: catalog.body || '',
                        plated: catalog.plated || '',
                        tracker: catalog.tracker || null
                    };
                }
                return {
                    id: Number.isFinite(id) ? id : -1,
                    level: level,
                    title: typeof value.title === 'string' && value.title.trim() ? value.title : '？',
                    body: typeof value.body === 'string' ? value.body : '',
                    plated: typeof value.plated === 'string' ? value.plated : '',
                    tracker: null
                };
            });

            closeTrackerPanel();
            trackerSession.clear();

            if (raw && raw.trackers && typeof raw.trackers === 'object') {
                entries.forEach(function (entry) {
                    if (!entry.tracker) return;
                    const saved = raw.trackers[String(entry.id)];
                    if (saved) trackerSession.set(entry.id, normalizeTrackerState(saved, entry.tracker));
                });
            }

            renderBoard(entries);

            // 恢复选中 / 滚轮显示状态（失败记录会强制清空选中）
            [...boardEl.children].forEach(function (cell, index) {
                const entry = entries[index];
                if (!entry.tracker) {
                    setCellSelected(cell, flags[index].selected);
                    if (flags[index].plateActive) cell.classList.add('plate-active');
                    updatePlateBadge(cell);
                    return;
                }
                if (entry.tracker.type === 'counter' || entry.tracker.type === 'checklist') {
                    // 计数类：由计数自动判定完成状态
                    applyCounterCompletion(cell, readTrackerState(entry.id, entry.tracker), entry.tracker);
                    return;
                }
                if (entry.tracker.type === 'failure') {
                    const failed = readTrackerState(entry.id, entry.tracker).failed;
                    setCellSelected(cell, !failed && flags[index].selected);
                    if (flags[index].plateActive) cell.classList.add('plate-active');
                    updatePlateBadge(cell);
                    return;
                }
                setCellSelected(cell, flags[index].selected);
                if (flags[index].plateActive) cell.classList.add('plate-active');
                updatePlateBadge(cell);
            });

            // 恢复 F 级选择
            if (raw && Array.isArray(raw.fSelected)) {
                const selected = new Set(raw.fSelected.map(String));
                fTierGrid.querySelectorAll('.f-card').forEach(function (card) {
                    const active = selected.has(card.dataset.id);
                    card.classList.toggle('selected', active);
                    card.setAttribute('aria-pressed', String(active));
                });
            }
            const fCount = fTierGrid.querySelectorAll('.f-card.selected').length;
            document.getElementById('fTierStatus').textContent = fCount
                ? '已完成 ' + fCount + ' / ' + BINGO_F_DATA.length + ' · 当前系数 +' + (fCount * .05).toFixed(2)
                : '每完成一项，最终得分系数 +0.05';

            // 恢复额外积分输入
            if (raw && raw.extras && typeof raw.extras === 'object') {
                scoreInputs.forEach(function (input) {
                    if (Object.prototype.hasOwnProperty.call(raw.extras, input.id)) {
                        input.value = String(raw.extras[input.id]);
                    }
                });
            }
            scoreInputs.forEach(normalizedScoreInput);

            document.getElementById('archiveId').textContent =
                raw && typeof raw.archiveId === 'string' ? raw.archiveId.slice(0, 32) : 'BF-IMPORT';
            document.getElementById('bingoLines').replaceChildren();
            updateSelectedCount();
            checkBingo();
            updateScore();

            document.getElementById('detailMeta').textContent = 'ARCHIVE IMPORT / 档案已恢复';
            document.getElementById('detailTitle').textContent = '表格与记录导入成功';
            document.getElementById('detailBody').textContent = '已恢复格子状态、词条记录、F 级选择和额外积分输入。';
            document.getElementById('detailPlate').style.display = 'none';

            playSound('modal', .08);
        } catch (error) {
            alert('导入失败：' + error.message);
        }
    };
    reader.onerror = function () { alert('导入失败：无法读取文件'); };
    reader.readAsText(file);
}

/* ============================================================
   事件绑定与初始化
   ============================================================ */
drawBtn.addEventListener('click', draw);

/* 计分开关（仅控制显示，不影响计算） */
document.getElementById('scoreToggle').addEventListener('click', function () {
    scoreVisible = !scoreVisible;
    this.setAttribute('aria-pressed', String(scoreVisible));
    this.textContent = scoreVisible ? '计分: 开' : '计分: 关';
    document.getElementById('totalScoreOverlay').classList.toggle('hidden', !scoreVisible);
});

document.getElementById('exportBtn').addEventListener('click', exportBoard);
document.getElementById('importBtn').addEventListener('click', function () {
    document.getElementById('importFile').click();
});
document.getElementById('importFile').addEventListener('change', function (event) {
    const file = event.target.files && event.target.files[0];
    if (file) importBoard(file);
    event.target.value = '';
});

/* 额外积分输入变化时自动重算 */
scoreInputs.forEach(function (input) {
    input.addEventListener('input', updateScore);
    input.addEventListener('change', updateScore);
});

renderFTier();

/* ============================================================
   按 S 键：总分定格到页面最上方 / 再按一次恢复
   ============================================================ */
let totalScorePinned = false;
document.addEventListener('keydown', function (event) {
    const tag = event.target && event.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target.isContentEditable) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key !== 's' && event.key !== 'S') return;

    event.preventDefault();
    totalScorePinned = !totalScorePinned;
    document.getElementById('totalScoreTop').classList.toggle('show', totalScorePinned);
    playSound('modal', .06);
});

draw();