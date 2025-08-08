import os
import json

# --- Configuration ---
SOURCE_FOLDER = "alpha_data"
OUTPUT_FILE = "stimuli.js"

print(f"Starting script. Looking for files in '{SOURCE_FOLDER}'...")

stimuli_list = []
for filename in sorted(os.listdir(SOURCE_FOLDER)):
    if filename.endswith(".wav"):
        base_name = os.path.splitext(filename)[0]
        lab_filename = f"{base_name}.lab"
        lab_filepath = os.path.join(SOURCE_FOLDER, lab_filename)

        if os.path.exists(lab_filepath):
            with open(lab_filepath, 'r', encoding='utf-8') as f:
                sentence = f.read().strip().replace("'", "\\'")
            
            stimulus_data = {
                "audio": os.path.join(SOURCE_FOLDER, filename).replace("\\", "/"),
                "sentence": sentence,
                # This line is now guaranteed to be correct.
                "filename": base_name 
            }
            stimuli_list.append(stimulus_data)
        else:
            print(f"  [Warning] Skipping {filename} because its partner '{lab_filename}' was not found.")

if not stimuli_list:
    print(f"\nError: No matching .wav/.lab pairs were found in '{SOURCE_FOLDER}'.")
else:
    json_string = json.dumps(stimuli_list, indent=2)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(f"const stimuli = {json_string};")
    print(f"\nSuccess! ✨ Created '{OUTPUT_FILE}' with {len(stimuli_list)} items.")