// experiment.js - FINAL CLASSIC SCRIPT VERSION

// --- SAVE & RESUME LOGIC ---
const STORAGE_KEY = 'alpha-evaluation-progress';

function getParticipantId(jspsych_instance) {
  let pid = localStorage.getItem(STORAGE_KEY + '_pid');
  if (!pid) {
    pid = jspsych_instance.randomization.randomID(10);
    localStorage.setItem(STORAGE_KEY + '_pid', pid);
  }
  return pid;
}

function saveData(data) {
  const dataString = JSON.stringify(data);
  localStorage.setItem(STORAGE_KEY, dataString);
}

function loadData() {
  const dataString = localStorage.getItem(STORAGE_KEY);
  return dataString ? JSON.parse(dataString) : null;
}

// 1. Initialize jsPsych
const jsPsych = initJsPsych({
  on_trial_finish: function() {
    saveData(jsPsych.data.get().values());
  },
  on_finish: function() {
    const participant_id = getParticipantId(jsPsych);
    jsPsych.data.get().localSave('csv', `results_${participant_id}.csv`);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY + '_pid');
  },
  // We need to tell jsPsych where our target div is
  display_element: 'jspsych-target' 
});

// 2. Prepare the timeline
const participant_id = getParticipantId(jsPsych);
const saved_data = loadData();
if (saved_data) { jsPsych.data.addData(saved_data); }
const completed_trials = saved_data ? saved_data.map(trial => trial.audio_filename) : [];
const stimuli_to_run = stimuli.filter(stimulus => !completed_trials.includes(stimulus.filename));

let timeline = [];

const preload = {
  type: jsPsychPreload,
  audio: stimuli_to_run.map(s => s.audio)
};
timeline.unshift(preload);

if (stimuli_to_run.length > 0) {
  let welcome_message = `
    <div class="content">
      <h2>Welcome to the Survey</h2>
      <p>Your task is to decide if the sentence you read matches what was said in the audio.</p>
      <p>Your progress is saved automatically, so you can close the tab and return later to continue.</p>
    </div>
  `;
  if (saved_data && completed_trials.length > 0) {
    welcome_message = `
      <div class="content">
        <h2>Welcome Back!</h2>
        <p>You have completed ${completed_trials.length} out of ${stimuli.length} questions.</p>
        <p>We'll start you right where you left off.</p>
      </div>
    `;
  }
  const instructions = {
    type: jsPsychHtmlButtonResponse, // This will now work correctly
    stimulus: welcome_message,
    choices: ['Begin']
  };
  timeline.push(instructions);

  const main_trials = {
    timeline: [{
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
      data: {
        participant_id: participant_id,
        task: 'audio-match',
        sentence: jsPsych.timelineVariable('sentence'),
        audio_filename: jsPsych.timelineVariable('filename')
      }
    }],
    timeline_variables: stimuli_to_run,
    randomize_order: true

  };

  timeline.push(main_trials);
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

// 3. Run the experiment
jsPsych.run(timeline);
