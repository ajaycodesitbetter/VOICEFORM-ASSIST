
# VoiceForm Assist

AI‑powered voice assistant that fills forms for you.

VoiceForm Assist is a web app designed to help **people with disabilities, low digital literacy, or temporary impairments** complete online forms using only their **voice**. It combines the Google Gemini API with browser speech technology to turn any form into an accessible, conversational experience.

Live demo: **https://voiceform-assist.netlify.app/**

---

## Why this project matters

Online forms gate access to **education, jobs, healthcare, government services, and banking**. For many people, they are hard or impossible to use:

- Motor impairments make typing and accurate mouse control painful.
- Low vision or cognitive load makes complex UIs overwhelming.
- Language barriers make English‑only interfaces stressful.

VoiceForm Assist reduces this friction by:

- Letting users **speak naturally** instead of typing.
- Guiding them step‑by‑step with clear, high‑contrast UI + audio.
- Supporting **English and Hindi**, so people can answer in the language that feels comfortable.
- Allowing organizations to plug in **their existing forms and Google Sheets** instead of rebuilding everything.

The goal is simple: **more people can complete important forms successfully and independently.**

---

## What it can do

- **Voice‑only form filling**  
  Users answer each question by speaking; the assistant interprets, normalizes, and inserts the answer.

- **Works with *any* public form URL**  
  Paste a **Google Form** or other public form link into the app. Gemini analyzes the page and builds an internal schema so the voice flow matches that form.

- **Google Sheets webhook integration**  
  Add a Google Apps Script / webhook URL, and submissions are sent directly to a Sheet or backend.  
  This allows:
  - NGOs to log beneficiary data
  - Clinics to collect intake forms
  - Schools to collect registrations, feedback, etc.

- **Bilingual voice experience (English / Hindi)**  
  Both the questions and confirmations can be spoken and understood in English or Hindi, making the experience more inclusive in multilingual environments.

- **Local submission history**  
  Recent submissions are stored in the browser (localStorage) so they can be reviewed, copied as JSON, or deleted.

- **Accessible brutalist UI**  
  High contrast, big typography, keyboard‑friendly focus states—designed so users and facilitators can quickly see what’s happening.

---

## Tech Stack

- **Frontend:** React (with the modern JSX runtime) + Vite + TypeScript
- **Styling:** Tailwind CSS
- **AI:** Google AI Studio / Gemini via `@google/genai`
- **Speech:** Browser Web Speech APIs (speech synthesis + recognition), plus Gemini TTS fallback
- **Hosting:** Netlify

---

## Getting started (local development)

1. **Clone and install**

   ```bash
   git clone https://github.com/ajaycodesitbetter/VOICEFORM-ASSIST.git
   cd VOICEFORM-ASSIST
   npm install
   ```

2. **Configure your Gemini API key** (recommended: `.env.local`)

   Create a `.env.local` file in the project root:

   ```env
   API_KEY=your_gemini_api_key_here
   ```

   `.env.local` is git‑ignored, so your key will not be committed.

3. **Run the dev server**

   ```bash
   npm run dev
   ```

   Then open the URL Vite prints in the terminal (usually `http://localhost:5173`).

---

## Deployment (Netlify)

1. **Connect GitHub**
   - In Netlify, create a new site from Git.
   - Select `ajaycodesitbetter/VOICEFORM-ASSIST`.

2. **Build settings**
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`

3. **Environment variables**
   - In the Netlify site dashboard, go to **Site settings → Environment variables**.
   - Add:
     - `API_KEY` = your Google AI Studio API key.
   - Trigger a new deploy.

---

## How to use the app

1. **Open the app**  
   Visit the deployed site or run it locally.

2. **(Optional) Attach a custom form**  
   In the **External Form Bridge** input, paste a public URL (for example, a Google Form) and click **Fetch**.  
   Gemini will analyze the form and build a structured schema (fields, labels, hints).

3. **Start a voice session**  
   Click **Start Session** and grant microphone access.

4. **Answer with your voice**  
   For each field, the assistant:
   - Speaks a clear question
   - Listens for your response
   - Normalizes / interprets the answer (e.g., dates, phone numbers)
   - Optionally asks for confirmation ("Did I get that right?")

5. **Review and confirm**  
   At the end, it reads back a summary of all answers.  
   You can:
   - Say **"Confirm"** to submit
   - Or choose any field to edit and re‑answer.

6. **Store data**  
   - Submissions are stored in localStorage so they can be viewed and copied as JSON.
   - If you’ve configured a Google Sheets webhook, each submission is also POSTed there.

---

## Connecting to Google Sheets (webhook)

VoiceForm Assist can POST submissions to any HTTPS endpoint. A common pattern is:

1. Create a **Google Apps Script** bound to a Sheet.
2. Expose it as a **web app** that accepts POST requests.
3. Paste that web app URL into the **Google Sheets Webhook** field in the UI.

On each successful submission, the app sends a JSON payload like:

```json
{
  "timestamp": "2025-01-01T12:34:56.789Z",
  "name": "...",
  "phone": "...",
  "email": "..."
}
```

The script can then write these values into your Sheet. This makes it easy for NGOs, schools, clinics, or community centers to collect responses without extra infrastructure.

---

## Social impact and accessibility

VoiceForm Assist is intentionally built with **real‑world constraints** in mind:

- **For people with motor disabilities**  
  Filling out long forms with a keyboard or touchscreen can be exhausting or impossible. A voice‑driven flow reduces physical effort and can be used with assistive hardware.

- **For low‑vision users and elders**  
  Large typography, high contrast, and spoken prompts reduce the need for precise visual focus. A facilitator can also operate the interface while the user simply responds out loud.

- **For multilingual communities**  
  Support for English and Hindi lowers the barrier for users who are not comfortable reading or writing in English. This is especially useful in community centers, clinics, and government outreach programs.

- **For organizations with limited tech resources**  
  Instead of hiring developers to rebuild forms, they can plug in a **link to existing forms and a Google Sheet**, instantly getting a more accessible intake workflow.

By combining AI, speech, and simple web technologies, VoiceForm Assist aims to:

- Increase **completion rates** for important forms
- Reduce **dependence on intermediaries** for people with disabilities
- Make it easier for NGOs and public services to run **inclusive digital programs**

---

## Contributing

Ideas, bug reports, and accessibility feedback are welcome.

- Open an issue in the GitHub repo.
- Suggest new languages, accessibility improvements, or better form flows.

If you work with a community that struggles with digital forms and want to adapt this project, feel free to fork it or open a discussion.

---

## License

This project is licensed under the MIT License. See `LICENSE` for details.
