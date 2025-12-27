
# VoiceForm Assist

An accessibility-first, voice-guided form assistant. It uses Gemini to interpret spoken intent, normalize answers, and automate form completion in a bilingual (English/Hindi) environment.

## Local Setup

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Set your API Key**:
    Create a `.env` file in the root directory:
    ```env
    API_KEY=your_gemini_api_key_here
    ```

3.  **Run development server**:
    ```bash
    npm run dev
    ```

## Deployment (Netlify)

1.  **Connect GitHub**: Push this repository to GitHub and connect it to a New Site on Netlify.
2.  **Build Settings**:
    *   **Build Command**: `npm run build`
    *   **Publish Directory**: `dist`
3.  **Environment Variables**:
    *   Go to **Site Settings > Environment Variables**.
    *   Add `API_KEY` with your Google AI Studio API key.

## Key Features
- **Voice Control**: 100% voice-driven navigation and data entry.
- **Bilingual**: Seamless switching between English and Hindi TTS/STT.
- **Form Fetching**: Paste any Google Form or public URL to turn it into a voice experience.
- **Brutalist UI**: High-contrast, accessibility-focused design with keyboard-first focus management.
