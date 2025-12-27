
import { GoogleGenAI, Modality } from "@google/genai";

export class SpeechService {
  private synth: SpeechSynthesis;
  private recognition: any;
  private isListening: boolean = false;
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private hasWarnedQuota: boolean = false;
  private config = {
    speechRate: 1.0,
    highQualityVoice: true
  };

  constructor() {
    this.synth = window.speechSynthesis;
    this.synth.getVoices();

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false; 
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
    }

    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => {
        this.synth.getVoices();
      };
    }
  }

  updateConfig(newConfig: { speechRate?: number; highQualityVoice?: boolean }) {
    this.config = { ...this.config, ...newConfig };
    // Reset warning if settings are toggled
    this.hasWarnedQuota = false;
  }

  private initAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  private decodeBase64(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  private async decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
  ): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }

  private async callGeminiWithRetry(fn: () => Promise<any>, maxRetries = 2, initialDelay = 800): Promise<any> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        // Comprehensive quota error check
        const isQuotaError = 
          error?.message?.includes('429') || 
          error?.status === 429 || 
          error?.message?.includes('RESOURCE_EXHAUSTED') ||
          (error?.error && error.error.code === 429);

        if (isQuotaError && i < maxRetries - 1) {
          const delay = initialDelay * Math.pow(2, i);
          console.warn(`Gemini TTS Quota Exceeded. Retrying in ${delay}ms... (Attempt ${i + 1})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  private async speakWithGemini(text: string, langCode: string, onEnd?: () => void) {
    try {
      this.initAudioContext();
      this.cancelCurrentAudio();

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      let voiceName = 'Zephyr'; 
      if (langCode.startsWith('hi')) voiceName = 'Kore';
      else if (langCode.startsWith('ja')) voiceName = 'Puck';
      else if (langCode.startsWith('es')) voiceName = 'Charon';

      const prompt = `Say this clearly: ${text}`;

      const response = await this.callGeminiWithRetry(() => ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName },
            },
          },
        },
      }));

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio || !this.audioContext) throw new Error("No audio data");

      const audioBuffer = await this.decodeAudioData(
        this.decodeBase64(base64Audio),
        this.audioContext,
        24000,
        1,
      );

      const source = this.audioContext.createBufferSource();
      this.currentSource = source;
      source.buffer = audioBuffer;
      source.playbackRate.value = this.config.speechRate;
      source.connect(this.audioContext.destination);
      source.onended = () => {
        if (this.currentSource === source) this.currentSource = null;
        onEnd?.();
      };
      source.start();
    } catch (error: any) {
      const isQuota = error?.message?.includes('429') || error?.status === 429 || error?.error?.code === 429;
      
      let fallbackText = text;
      if (isQuota && !this.hasWarnedQuota) {
        this.hasWarnedQuota = true;
        const warning = langCode.startsWith('hi') ? "कोटा समाप्त हो गया है। मानक आवाज़ का उपयोग कर रहे हैं। " : "Quota exceeded. Using standard voice. ";
        fallbackText = warning + text;
        console.error("Gemini TTS Quota Exhausted. User notified via speech. Falling back to browser voice.");
      } else {
        console.error("Gemini TTS Failed. Falling back to browser voice:", error);
      }
      
      this.speakWithBrowser(fallbackText, langCode, onEnd);
    }
  }

  private speakWithBrowser(text: string, langCode: string, onEnd?: () => void) {
    // Ensure clean state
    this.synth.cancel();
    this.cancelCurrentAudio();
    
    // Resume synth if it was stuck (common Chrome issue)
    if (this.synth.paused) {
      this.synth.resume();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    utterance.rate = this.config.speechRate;
    
    // Attempt to find a better matching local voice
    const voices = this.synth.getVoices();
    const matchingVoice = voices.find(v => v.lang.startsWith(langCode.split('-')[0]));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    utterance.onend = () => {
      onEnd?.();
    };
    utterance.onerror = (e) => {
      console.error("Browser TTS Error:", e);
      onEnd?.();
    };

    this.synth.speak(utterance);
    
    // Chrome bug: sometimes long utterances stop firing events unless resumed
    const resumeInterval = setInterval(() => {
      if (this.synth.speaking) {
        this.synth.pause();
        this.synth.resume();
      } else {
        clearInterval(resumeInterval);
      }
    }, 10000);
  }

  async speak(text: string, langCode: string = 'en-US', onEnd?: () => void) {
    const canUseGemini = this.config.highQualityVoice && (langCode.startsWith('hi') || langCode.startsWith('ja') || langCode.startsWith('en'));
    if (canUseGemini) {
      await this.speakWithGemini(text, langCode, onEnd);
    } else {
      this.speakWithBrowser(text, langCode, onEnd);
    }
  }

  listen(langCode: string = 'en-US', onInterim?: (text: string) => void): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.recognition) return reject(new Error("Microphone input not supported."));

      let finalTranscript = '';
      this.recognition.lang = langCode;
      
      this.recognition.onstart = () => { this.isListening = true; };
      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
          else interimTranscript += event.results[i][0].transcript;
        }
        if (onInterim) onInterim(interimTranscript || finalTranscript);
      };

      this.recognition.onerror = (event: any) => {
        this.isListening = false;
        reject(event.error);
      };

      this.recognition.onend = () => { 
        this.isListening = false; 
        if (finalTranscript.trim()) resolve(finalTranscript.trim());
        else reject(new Error("No speech detected"));
      };

      try {
        this.recognition.start();
      } catch (e) {
        this.recognition.abort();
        setTimeout(() => { try { this.recognition.start(); } catch (err) { reject(err); } }, 100);
      }
    });
  }

  private cancelCurrentAudio() {
    if (this.currentSource) {
      try { this.currentSource.stop(); } catch (e) {}
      this.currentSource = null;
    }
  }

  cancel(): void {
    this.synth.cancel();
    this.cancelCurrentAudio();
    if (this.recognition) {
      try { this.recognition.abort(); } catch (e) {}
    }
  }
}
