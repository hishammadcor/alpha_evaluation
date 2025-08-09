// player.js - Custom audio player with next/previous and progress bar

let currentIndex = 0;
const audio = new Audio();
audio.preload = 'none';

const container = document.getElementById('player-container');
container.innerHTML = `
  <div class="audio-player">
    <h2 id="audio-title"></h2>
    <p id="sentence-text" class="prompt-sentence"></p>
    <div class="controls">
      <button id="prev-btn" class="control-btn">Previous</button>
      <button id="play-btn" class="control-btn">Play</button>
      <button id="next-btn" class="control-btn">Next</button>
    </div>
    <div class="progress">
      <span id="current-time">0:00</span>
      <input type="range" id="progress-bar" value="0" min="0" max="100" step="0.1">
      <span id="duration">0:00</span>
    </div>
  </div>
`;

const titleEl = document.getElementById('audio-title');
const sentenceEl = document.getElementById('sentence-text');
const playBtn = document.getElementById('play-btn');
const nextBtn = document.getElementById('next-btn');
const prevBtn = document.getElementById('prev-btn');
const progressBar = document.getElementById('progress-bar');
const currentTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('duration');

function loadStimulus(index) {
  const stim = stimuli[index];
  audio.src = stim.audio;
  titleEl.textContent = stim.filename;
  sentenceEl.textContent = `"${stim.sentence}"`;
  progressBar.value = 0;
  currentTimeEl.textContent = '0:00';
  durationEl.textContent = '0:00';
}

function formatTime(sec) {
  if (isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

playBtn.addEventListener('click', () => {
  if (audio.paused) {
    audio.play();
    playBtn.textContent = 'Pause';
  } else {
    audio.pause();
    playBtn.textContent = 'Play';
  }
});

nextBtn.addEventListener('click', () => {
  currentIndex = (currentIndex + 1) % stimuli.length;
  loadStimulus(currentIndex);
  audio.pause();
  playBtn.textContent = 'Play';
});

prevBtn.addEventListener('click', () => {
  currentIndex = (currentIndex - 1 + stimuli.length) % stimuli.length;
  loadStimulus(currentIndex);
  audio.pause();
  playBtn.textContent = 'Play';
});

audio.addEventListener('timeupdate', () => {
  const progress = (audio.currentTime / audio.duration) * 100;
  progressBar.value = progress;
  currentTimeEl.textContent = formatTime(audio.currentTime);
  durationEl.textContent = formatTime(audio.duration);
});

progressBar.addEventListener('input', () => {
  const time = (progressBar.value / 100) * audio.duration;
  audio.currentTime = time;
});

loadStimulus(currentIndex);

