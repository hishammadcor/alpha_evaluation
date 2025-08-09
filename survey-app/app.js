/* eslint-disable no-console */

const DATASET_FOLDER = 'data/alpha_data';
const MANIFEST_PATH = `${DATASET_FOLDER}/manifest.json`;
const STORAGE_KEY = `abx-survey-state:v1:${DATASET_FOLDER}`;

const $ = (sel) => document.querySelector(sel);

const loadingEl = $('#loading');
const emptyStateEl = $('#emptyState');
const doneStateEl = $('#doneState');
const cardEl = $('#surveyCard');
const participantInfoEl = $('#participantInfo');
const questionEl = $('#question');
const sentenceEl = $('#sentence');
const audioEl = $('#audioPlayer');
const progressTextEl = $('#progressText');
const resetBtn = $('#resetBtn');
const downloadBtn = $('#downloadBtn');
const restartBtn = $('#restartBtn');

function generateAnonymousId() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const length = 9;
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function shuffleInPlace(array, rng) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Seeded RNG based on xorshift32 for deterministic shuffle per participant
function createSeededRng(seedString) {
  let seed = 0;
  for (let i = 0; i < seedString.length; i++) {
    seed = (seed << 5) - seed + seedString.charCodeAt(i);
    seed |= 0;
  }
  let x = seed || 123456789;
  return function rng() {
    // xorshift32
    x ^= x << 13; x |= 0;
    x ^= x >>> 17; x |= 0;
    x ^= x << 5; x |= 0;
    const t = (x >>> 0) / 4294967296;
    return t;
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse state', e);
    return null;
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

function nowIso() {
  return new Date().toISOString();
}

function buildCsv(responses) {
  const headers = [
    'participant_id',
    'timestamp_iso',
    'index',
    'audio_filename',
    'audio_path',
    'sentence',
    'response'
  ];
  const escapeCsv = (val) => {
    if (val == null) return '';
    const s = String(val);
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [headers.join(',')];
  for (const r of responses) {
    lines.push([
      r.participantId,
      r.timestampIso,
      r.index,
      r.audioFilename,
      r.audioPath,
      r.sentence,
      r.response
    ].map(escapeCsv).join(','));
  }
  return lines.join('\n');
}

function triggerCsvDownload(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function fetchManifest() {
  const res = await fetch(MANIFEST_PATH, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load manifest: ${res.status}`);
  return res.json();
}

function initUiEvents(onAnswer) {
  document.querySelectorAll('button.answer').forEach((btn) => {
    btn.addEventListener('click', () => {
      const value = btn.getAttribute('data-answer');
      onAnswer(value);
    });
  });
  resetBtn.addEventListener('click', resetState);
  restartBtn.addEventListener('click', resetState);
}

function showSection(section) {
  loadingEl.hidden = section !== 'loading';
  emptyStateEl.hidden = section !== 'empty';
  doneStateEl.hidden = section !== 'done';
  cardEl.hidden = section !== 'card';
}

function updateQuestionUi(state) {
  const { tasks, currentIndex } = state;
  const total = tasks.length;
  if (currentIndex >= total) {
    showSection('done');
    return;
  }
  const task = tasks[currentIndex];
  const q = `Does the following sentence match what you heard in the audio: ${task.audioFilename}?`;
  questionEl.textContent = q;
  sentenceEl.textContent = task.sentence;
  audioEl.src = task.audioPath;
  audioEl.currentTime = 0;
  progressTextEl.textContent = `Question ${currentIndex + 1} of ${total}`;
}

async function main() {
  showSection('loading');

  let manifest;
  try {
    manifest = await fetchManifest();
  } catch (e) {
    console.error(e);
    showSection('empty');
    return;
  }

  const pairs = Array.isArray(manifest?.pairs) ? manifest.pairs : [];
  if (pairs.length === 0) {
    showSection('empty');
    return;
  }

  let state = loadState();
  if (!state) {
    const participantId = generateAnonymousId();
    const rng = createSeededRng(participantId);
    const tasks = shuffleInPlace(pairs.map((p) => ({
      audioPath: p.audio,
      audioFilename: p.filename || (p.audio?.split('/').pop() ?? ''),
      sentence: p.sentence,
    })), rng);
    state = {
      participantId,
      tasks,
      currentIndex: 0,
      responses: [],
      startedAtIso: nowIso(),
      completedAtIso: null,
    };
    saveState(state);
  }

  participantInfoEl.textContent = `Participant: ${state.participantId}`;

  initUiEvents((answer) => {
    const idx = state.currentIndex;
    const task = state.tasks[idx];
    const responseRecord = {
      participantId: state.participantId,
      timestampIso: nowIso(),
      index: idx,
      audioFilename: task.audioFilename,
      audioPath: task.audioPath,
      sentence: task.sentence,
      response: answer,
    };
    state.responses.push(responseRecord);
    state.currentIndex += 1;

    if (state.currentIndex >= state.tasks.length) {
      state.completedAtIso = nowIso();
      saveState(state);
      showSection('done');
      const csv = buildCsv(state.responses);
      const fname = `results_${state.participantId}.csv`;
      triggerCsvDownload(fname, csv);
      downloadBtn.onclick = () => triggerCsvDownload(fname, csv);
      return;
    }

    saveState(state);
    updateQuestionUi(state);
  });

  showSection('card');
  updateQuestionUi(state);
}

main();