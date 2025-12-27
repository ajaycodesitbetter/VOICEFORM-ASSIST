
# VoiceForm Assist

An accessibility-first, voice-guided form assistant. It uses Gemini to interpret spoken intent, normalize answers, and automate form completion in a bilingual (English/Hindi) environment.

## Tech Stack
- React (with the new JSX runtime)
- Vite + TypeScript
- Tailwind CSS
- Google AI Studio / Gemini (`@google/genai`)
- Browser Web Speech APIs (speech synthesis + recognition)

## Local Setup

1. **Clone and install**
   ```bash
   git clone https://github.com/ajaycodesitbetter/VOICEFORM-ASSIST.git
   cd VOICEFORM-ASSIST
   npm install
   ```

2. **Set your API key (recommended: `.env.local`)**
   Create a `.env.local` file in the project root:
   ```env
   API_KEY=your_gemini_api_key_here
   ```
   `.env.local` is git-ignored, so your key will not be committed.

3. **Run the development server**
   ```bash
   npm run dev
   ```
   Then open the URL Vite prints in the terminal (usually `http://localhost:5173`).

## Deployment (Netlify)

1. **Connect GitHub**
   - Create a new site from Git → select `ajaycodesitbetter/VOICEFORM-ASSIST`.

2. **Build settings**
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`

3. **Environment variables**
   - In the Netlify site dashboard, go to **Site settings → Environment variables**.
   - Add:
     - `API_KEY` = your Google AI Studio API key.
   - Trigger a new deploy.

## How to Use

1. Open the deployed app (Netlify URL) or run it locally.
2. Optionally paste a **Google Form or public form URL** into the "External Form Bridge" field and click **Fetch** to let Gemini infer the form structure.
3. Click **Start Session** to begin a voice-driven run-through of the form.
4. Speak your answers when prompted. The assistant will:
   - Interpret your speech,
   - Normalize values (dates, phone numbers, etc.),
   - Confirm answers before moving on when needed.
5. At the end, it will generate a **spoken summary** and ask you to say **"Confirm"** or choose fields to edit.
6. Submissions are stored locally in the browser and can optionally be sent to a Google Sheets webhook you configure.

## Key Features
- **Voice Control** – 100% voice-driven navigation and data entry.
- **Bilingual** – Seamless switching between English and Hindi TTS/STT.
- **Form Fetching** – Paste any Google Form or public URL to turn it into a voice experience.
- **Brutalist UI** – High-contrast, accessibility-focused design with keyboard-first focus management.
- **Local History** – Recent submissions stored in localStorage with quick copy-to-clipboard.

## Notes
- Best experienced in modern Chromium-based browsers with microphone access enabled.
- Speech accuracy depends on the browser's STT engine and your mic environment.
- Do **not** commit your real `API_KEY` to source control; keep it only in `.env.local` and Netlify environment variables.
