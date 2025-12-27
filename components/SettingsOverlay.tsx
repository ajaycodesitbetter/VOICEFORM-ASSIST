
import React from 'react';
import { AppSettings, Language } from '../types';
import { SUPPORTED_LANGUAGES } from '../constants';

interface SettingsOverlayProps {
  settings: AppSettings;
  onUpdate: (newSettings: AppSettings) => void;
  onClose: () => void;
}

const SettingsOverlay: React.FC<SettingsOverlayProps> = ({ settings, onUpdate, onClose }) => {
  return (
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div className="w-full max-w-xl bg-zinc-900 border-8 border-yellow-400 p-8 shadow-[0_0_100px_rgba(255,255,0,0.2)]">
        <div className="flex justify-between items-center mb-10">
          <h2 id="settings-title" className="text-5xl font-black uppercase tracking-tighter text-yellow-400">Settings</h2>
          <button 
            onClick={onClose}
            className="p-4 bg-zinc-800 text-zinc-400 hover:text-white border-2 border-zinc-700 font-black uppercase text-xs transition-all active:scale-95"
            aria-label="Close settings overlay"
          >
            Close [Esc]
          </button>
        </div>

        <div className="space-y-10">
          {/* Language Selection */}
          <section aria-labelledby="lang-label">
            <label id="lang-label" className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-3">Preferred Language</label>
            <select 
              value={settings.language}
              onChange={(e) => onUpdate({ ...settings, language: e.target.value })}
              className="w-full p-5 bg-black border-4 border-zinc-700 focus:border-yellow-400 text-xl font-black uppercase outline-none transition-all appearance-none cursor-pointer"
              aria-label="Select application language"
            >
              {SUPPORTED_LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.nativeName} ({lang.name})</option>
              ))}
            </select>
          </section>

          {/* Speech Rate Selection */}
          <section aria-labelledby="rate-label">
            <div className="flex justify-between items-end mb-3">
              <label id="rate-label" className="block text-xs font-black uppercase tracking-widest text-zinc-500">Speech Rate</label>
              <span className="text-yellow-400 font-black text-xl" aria-live="polite" aria-label={`Current speech rate is ${settings.speechRate.toFixed(1)} times normal speed`}>{settings.speechRate.toFixed(1)}x</span>
            </div>
            <input 
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={settings.speechRate}
              onChange={(e) => onUpdate({ ...settings, speechRate: parseFloat(e.target.value) })}
              className="w-full h-4 bg-black border-2 border-zinc-700 appearance-none cursor-pointer accent-yellow-400"
              aria-label="Adjust voice assistant speed"
            />
            <div className="flex justify-between text-[9px] font-black uppercase text-zinc-600 mt-2 tracking-widest" aria-hidden="true">
              <span>Slower</span>
              <span>Normal</span>
              <span>Faster</span>
            </div>
          </section>

          {/* High Quality Voice Toggle */}
          <section>
            <button 
              onClick={() => onUpdate({ ...settings, highQualityVoice: !settings.highQualityVoice })}
              className={`w-full p-5 border-4 flex justify-between items-center transition-all ${
                settings.highQualityVoice 
                ? 'border-yellow-400 bg-yellow-400/10 text-white' 
                : 'border-zinc-700 bg-black text-zinc-600'
              }`}
              role="switch"
              aria-checked={settings.highQualityVoice}
              aria-label="Toggle high quality AI voice generator"
            >
              <div className="text-left">
                <span className="block font-black uppercase text-lg tracking-tight">AI Voice Quality</span>
                <span className="block text-[10px] uppercase tracking-widest opacity-60">Use Gemini TTS where supported</span>
              </div>
              <div className={`w-12 h-6 border-2 flex items-center p-1 ${settings.highQualityVoice ? 'border-yellow-400 justify-end bg-yellow-400' : 'border-zinc-700 justify-start'}`} aria-hidden="true">
                <div className={`w-4 h-4 ${settings.highQualityVoice ? 'bg-black' : 'bg-zinc-700'}`} />
              </div>
            </button>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-zinc-800 text-center">
          <p className="text-[10px] font-black uppercase text-zinc-600 tracking-[0.2em]">All settings are saved locally</p>
        </div>
      </div>
    </div>
  );
};

export default SettingsOverlay;
