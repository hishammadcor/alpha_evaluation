/* experiment.js - survey with resume and progress */

const STORAGE_KEY = 'alpha-evaluation-progress';

function getParticipantId(jspsych_instance) {
  let pid = localStorage.getItem(STORAGE_KEY + '_pid');
  if (!pid) {
    pid = jspsych_instance.randomization.randomID(10);
    localStorage.setItem(STORAGE_KEY + '_pid', pid);
  }
  return pid;
}

function saveData(trial) {
  const existing = localStorage.getItem(STORAGE_KEY);
  const dataArray = existing ? JSON.parse(existing) : [];
  dataArray.push(trial);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dataArray));

  fetch('/save-progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trial)
  }).catch(err => console.error('Save failed:', err));
}

function loadData(jspsych_instance) {
  const dataString = localStorage.getItem(STORAGE_KEY);
  const dataArray = dataString ? JSON.parse(dataString) : [];
  dataArray.forEach(trial => jspsych_instance.data.addData(trial));
  return dataArray;
}

let participant_id;

const jsPsych = initJsPsych({
  show_progress_bar: true,
  auto_update_progress_bar: false,
  on_trial_finish: function() {
    saveData(jsPsych.data.getLastTrialData().values()[0]);
  },
  on_finish: function() {
    fetch('/save-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant_id, complete: true, data: jsPsych.data.get().values() })
    }).catch(err => console.error('Final save failed:', err));
    jsPsych.data.get().localSave('csv', `results_${participant_id}.csv`);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY + '_pid');
  },
  display_element: 'jspsych-target'
});

const loadingMessage = document.createElement('div');
loadingMessage.id = 'loading-message';
loadingMessage.innerHTML = '<p style="font-size: 1.2em;">Loading next audio...</p>';
loadingMessage.style.display = 'none';
document.body.appendChild(loadingMessage);

participant_id = getParticipantId(jsPsych);
const saved_data = loadData(jsPsych);
const completed_trials = saved_data
  .filter(trial => trial.task === 'audio-match')
  .map(trial => trial.audio_filename);
const survey_completed = saved_data.some(trial => trial.task === 'post-survey');
const stimuli_to_run = stimuli.filter(stimulus => !completed_trials.includes(stimulus.filename));

const total_questions = stimuli.length + 1; // +1 for final survey
let progressCount = completed_trials.length + (survey_completed ? 1 : 0);

let timeline = [];

const preload = {
  type: jsPsychPreload,
  audio: stimuli_to_run.map(s => s.audio)
};
timeline.push(preload);

if (stimuli_to_run.length > 0 || !survey_completed) {
  let welcome_message = `
    <div class="content">
      <h2>Welcome to the Survey</h2>
      <p>Your task is to decide if the sentence you read matches what was said in the audio.</p>
      <p>Your progress is saved automatically, so you can close the tab and return later to continue.</p>
    </div>
  `;
  if (stimuli_to_run.length === 0 && !survey_completed) {
    welcome_message = `
      <div class="content">
        <h2>Welcome Back!</h2>
        <p>You finished the audio portion previously. Please answer a few final questions to complete the survey.</p>
      </div>
    `;
  } else if (completed_trials.length > 0) {
    welcome_message = `
      <div class="content">
        <h2>Welcome Back!</h2>
        <p>You have completed ${completed_trials.length} out of ${stimuli.length} questions.</p>
        <p>We'll start you right where you left off.</p>
      </div>
    `;
  }
  const instructions = {
    type: jsPsychHtmlButtonResponse,
    stimulus: welcome_message,
    choices: ['Begin']
  };
  timeline.push(instructions);
}

if (stimuli_to_run.length > 0) {
  const main_trial = {
    type: jsPsychAudioButtonResponse,
    stimulus: jsPsych.timelineVariable('audio'),
    choices: ['Yes', 'No', 'Not Sure'],
    prompt: () => {
      const sentence = jsPsych.timelineVariable('sentence');
      const filename = jsPsych.timelineVariable('filename');
      return `<div class="prompt-container">
                <p>Does the following sentence match what you heard in the audio: <b>${filename}</b>?</p>
                <p class="prompt-sentence">"${sentence}"</p>
              </div>`;
    },
    on_start: () => {
      const msg = document.getElementById('loading-message');
      if (msg) msg.style.display = 'block';
    },
    on_load: () => {
      const msg = document.getElementById('loading-message');
      if (msg) msg.style.display = 'none';
    },
    on_finish: () => {
      progressCount++;
      jsPsych.setProgressBar(progressCount / total_questions);
    },
    data: {
      participant_id: participant_id,
      task: 'audio-match',
      sentence: jsPsych.timelineVariable('sentence'),
      audio_filename: jsPsych.timelineVariable('filename')
    }
  };

  const main_trials = {
    timeline: [main_trial],
    timeline_variables: stimuli_to_run,
    randomize_order: true
  };
  timeline.push(main_trials);
}

if (!survey_completed) {
  const survey_block = {
    type: jsPsychSurveyMultiChoice,
    questions: [
      {
        prompt: 'Did the audio play clearly?',
        name: 'audio_clear',
        options: ['Yes', 'No', 'Unsure'],
        required: true
      },
      {
        prompt: 'Would you participate again?',
        name: 'participate_again',
        options: ['Yes', 'No', 'Maybe'],
        required: true
      }
    ],
    data: {
      participant_id: participant_id,
      task: 'post-survey'
    },
    on_finish: () => {
      progressCount++;
      jsPsych.setProgressBar(progressCount / total_questions);
    }
  };
  timeline.push(survey_block);
}

const end_screen = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="content">
      <h2>Survey Complete!</h2>
      <p>Thank you for your participation.</p>
      <p>If you have finished all questions, the data file will now download automatically. If you see this screen on your first visit, it means you have already completed this survey in this browser.</p>
    </div>
  `,
  choices: ['Finish']
};
timeline.push(end_screen);

jsPsych.run(timeline);
jsPsych.setProgressBar(progressCount / total_questions);
