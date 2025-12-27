
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import FormDisplay from './components/FormDisplay';
import SettingsOverlay from './components/SettingsOverlay';
import { GeminiService } from './services/geminiService';
import { SpeechService } from './services/speechService';
import { SAMPLE_FORM } from './constants';
import { GeminiResponse, AppState, SavedSubmission, AppSettings } from './types';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  var aistudio: AIStudio;
}

const YES_REGEX = /confirm|pukka|paka|nischit|yes|haan|bilkul|theek|sahi|ok|yeah|yup|agree|correct|हाँ|सही|बिलकुल|ठीक|कन्फर्म|पक्का/i;

const DEFAULT_SETTINGS: AppSettings = {
  language: 'en-US',
  speechRate: 1.0,
  highQualityVoice: true
};

const App: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [formUrl, setFormUrl] = useState('');
  const sessionRef = useRef(0);

  const [appState, setAppState] = useState<AppState>({
    currentFieldIndex: 0,
    answers: {},
    mode: 'idle',
    lastLog: 'System ready. Select a form or fetch a new one.',
    language: 'en-US',
    settings: DEFAULT_SETTINGS,
    history: [],
    pendingValue: null,
    interimTranscript: '',
    awaitingConfirmation: false,
    savedSubmissions: [],
    webhookUrl: '',
    activeForm: SAMPLE_FORM
  });

  const stateRef = useRef(appState);
  useEffect(() => {
    stateRef.current = appState;
  }, [appState]);

  const [showSummary, setShowSummary] = useState(false);
  const geminiRef = useRef<GeminiService | null>(null);
  const speechRef = useRef<SpeechService | null>(null);

  useEffect(() => {
    geminiRef.current = new GeminiService();
    speechRef.current = new SpeechService();
    
    const localSubs = localStorage.getItem('voiceform_submissions');
    const localWebhook = localStorage.getItem('voiceform_webhook');
    const localSettings = localStorage.getItem('voiceform_settings');
    const parsedSettings = localSettings ? JSON.parse(localSettings) : DEFAULT_SETTINGS;
    
    speechRef.current.updateConfig({
      speechRate: parsedSettings.speechRate,
      highQualityVoice: parsedSettings.highQualityVoice
    });

    setAppState(prev => ({ 
      ...prev, 
      savedSubmissions: localSubs ? JSON.parse(localSubs) : [],
      webhookUrl: localWebhook || '',
      settings: parsedSettings,
      language: parsedSettings.language
    } as AppState));

    return () => speechRef.current?.cancel();
  }, []);

  const handleUpdateSettings = (newSettings: AppSettings) => {
    localStorage.setItem('voiceform_settings', JSON.stringify(newSettings));
    setAppState(prev => ({ ...prev, settings: newSettings, language: newSettings.language } as AppState));
    speechRef.current?.updateConfig({
      speechRate: newSettings.speechRate,
      highQualityVoice: newSettings.highQualityVoice
    });
  };

  const handleFetchForm = async () => {
    if (!formUrl) return;

    if (typeof window.aistudio !== 'undefined') {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await window.aistudio.openSelectKey();
      }
    }

    setAppState(prev => ({ ...prev, mode: 'fetching', lastLog: 'Parsing form structure via Gemini 3 Pro...' }));
    try {
      const parsedSchema = await geminiRef.current!.parseFormFromUrl(formUrl);
      setAppState(prev => ({ 
        ...prev, 
        mode: 'preview', 
        activeForm: parsedSchema, 
        lastLog: `Ready: ${parsedSchema.title}` 
      }));
      setFormUrl('');
    } catch (e) {
      setAppState(prev => ({ 
        ...prev, 
        mode: 'idle', 
        lastLog: 'Form analysis failed. Please try a different URL.' 
      }));
    }
  };

  const addHistory = (role: 'user' | 'model', text: string) => {
    setAppState(prev => ({
      ...prev,
      history: [...prev.history, { role, text }].slice(-10)
    } as AppState));
  };

  const isSessionActive = () => ['busy', 'listening', 'finished'].includes(stateRef.current.mode);

  const handleNextStep = useCallback(async (customPrompt?: string) => {
    if (!speechRef.current || !geminiRef.current) return;

    const currentSessionId = sessionRef.current;
    const state = stateRef.current;
    
    if (!isSessionActive() && !customPrompt) return;

    const { currentFieldIndex, answers, language, awaitingConfirmation, pendingValue, activeForm } = state;
    setAppState(prev => ({ ...prev, mode: 'busy', interimTranscript: '' } as AppState));
    
    if (currentFieldIndex >= activeForm.fields.length && !customPrompt && !awaitingConfirmation) {
      setAppState(prev => ({ ...prev, lastLog: 'Generating Summary...' } as AppState));
      const summaryPrompt = await geminiRef.current!.generateSummaryPrompt(answers, activeForm, language);
      
      if (sessionRef.current !== currentSessionId) return;

      setShowSummary(true);
      await speechRef.current!.speak(summaryPrompt, language, async () => {
        if (sessionRef.current !== currentSessionId) return;

        setAppState(prev => ({ ...prev, mode: 'listening', lastLog: 'Waiting for "Confirm" or "Edit [Field]"' } as AppState));
        try {
          const userInput = await speechRef.current?.listen(language, (txt) => {
            if (sessionRef.current === currentSessionId) {
              setAppState(s => ({ ...s, interimTranscript: txt }));
            }
          });
          
          if (sessionRef.current !== currentSessionId) return;
          if (!userInput) return;
          
          addHistory('user', userInput);

          if (YES_REGEX.test(userInput)) {
             await submitForm(currentSessionId);
          } else {
             const res = await geminiRef.current!.processInput(userInput, activeForm, { ...stateRef.current, history: [...stateRef.current.history, { role: 'user', text: userInput }] });
             if (sessionRef.current === currentSessionId) handleGeminiAction(res, null, currentSessionId);
          }
        } catch (e) {
          if (sessionRef.current === currentSessionId) {
            setAppState(prev => ({ ...prev, mode: 'idle', lastLog: 'Review interrupted.' } as AppState));
          }
        }
      });
      return;
    }

    const currentField = activeForm.fields[currentFieldIndex];
    let questionText = customPrompt;
    if (!questionText) {
      setAppState(prev => ({ ...prev, lastLog: `Field: ${currentField.label}` } as AppState));
      questionText = await geminiRef.current!.translateQuestion(currentField.label, currentField.helpText, currentFieldIndex, activeForm.fields.length, language);
    }
    
    if (sessionRef.current !== currentSessionId) return;

    setAppState(prev => ({ ...prev, lastLog: awaitingConfirmation ? `Verify: ${pendingValue}` : `Question: ${currentField.label}` } as AppState));
    addHistory('model', questionText);
    
    await speechRef.current!.speak(questionText, language, async () => {
      if (sessionRef.current !== currentSessionId) return;
      
      setAppState(prev => ({ ...prev, mode: 'listening', lastLog: 'Listening...', interimTranscript: '' } as AppState));
      
      try {
        const userInput = await speechRef.current?.listen(language, (txt) => {
           if (sessionRef.current === currentSessionId) {
              setAppState(s => ({ ...s, interimTranscript: txt }));
           }
        });
        
        if (sessionRef.current !== currentSessionId) return;
        if (!userInput) return;
        
        addHistory('user', userInput);
        setAppState(prev => ({ ...prev, mode: 'busy', lastLog: `Interpreting answer...`, interimTranscript: '' } as AppState));

        const latestState = stateRef.current;
        if (latestState.awaitingConfirmation && YES_REGEX.test(userInput)) {
          const fieldId = activeForm.fields[latestState.currentFieldIndex].id;
          const valToSave = latestState.pendingValue || "";
          
          setAppState(prev => ({
            ...prev,
            answers: { ...prev.answers, [fieldId]: valToSave },
            currentFieldIndex: prev.currentFieldIndex + 1,
            pendingValue: null,
            awaitingConfirmation: false,
            mode: 'busy'
          } as AppState));
          setTimeout(() => handleNextStep(), 100);
          return;
        }

        const res: GeminiResponse = await geminiRef.current!.processInput(
          userInput,
          activeForm,
          { ...latestState, history: latestState.history }
        );

        if (sessionRef.current === currentSessionId) {
          handleGeminiAction(res, latestState.pendingValue, currentSessionId);
        }
      } catch (error: any) {
        if (sessionRef.current !== currentSessionId) return;
        
        setAppState(prev => ({ ...prev, lastLog: `Speech not detected.` } as AppState));
        const retryMessage = language.startsWith('hi') ? "क्षमा करें, फिर से बोलें।" : "Sorry, please say that again.";
        await speechRef.current?.speak(retryMessage, language, () => {
          if (sessionRef.current === currentSessionId) handleNextStep(questionText);
        });
      }
    });
  }, []);

  const handleGeminiAction = (res: GeminiResponse, currentPending: string | null, sessionId: number) => {
    if (sessionRef.current !== sessionId) return;

    const { activeForm } = stateRef.current;

    if (res.fieldId && res.action === 'ask_question') {
      const targetIndex = activeForm.fields.findIndex(f => f.id === res.fieldId);
      if (targetIndex !== -1) {
        setAppState(prev => ({
          ...prev,
          currentFieldIndex: targetIndex,
          awaitingConfirmation: false,
          pendingValue: null,
          mode: 'busy'
        } as AppState));
        setShowSummary(false);
        setTimeout(() => handleNextStep(res.spokenPrompt), 100);
        return;
      }
    }

    switch (res.action) {
      case 'confirm_answer':
        setAppState(prev => ({ ...prev, pendingValue: res.normalizedAnswer, awaitingConfirmation: true, mode: 'busy' } as AppState));
        setTimeout(() => handleNextStep(res.spokenPrompt), 100);
        break;
      case 'navigate':
        if (res.meta.navigation === 'next') {
          const fieldId = activeForm.fields[stateRef.current.currentFieldIndex].id;
          const finalVal = res.normalizedAnswer || currentPending || "";
          setAppState(prev => ({
            ...prev,
            currentFieldIndex: prev.currentFieldIndex + 1,
            answers: { ...prev.answers, [fieldId]: finalVal },
            awaitingConfirmation: false,
            pendingValue: null,
            mode: 'busy'
          } as AppState));
          setTimeout(() => handleNextStep(), 100);
        } else if (res.meta.navigation === 'previous') {
          setAppState(prev => ({ ...prev, currentFieldIndex: Math.max(0, prev.currentFieldIndex - 1), awaitingConfirmation: false, pendingValue: null, mode: 'busy' } as AppState));
          setTimeout(() => handleNextStep(), 100);
        } else if (res.meta.navigation === 'done') {
          submitForm(sessionId);
        } else {
          handleNextStep(res.spokenPrompt);
        }
        break;
      case 'invalid_answer':
      case 'ask_question':
        handleNextStep(res.spokenPrompt);
        break;
      case 'summary':
        setAppState(prev => ({ ...prev, currentFieldIndex: activeForm.fields.length }));
        setTimeout(() => handleNextStep(), 100);
        break;
      default:
        handleNextStep();
    }
  };

  const submitForm = async (sessionId: number) => {
    if (sessionRef.current !== sessionId) return;

    const { answers, language, webhookUrl } = stateRef.current;
    setAppState(prev => ({ ...prev, mode: 'busy', lastLog: 'Storing responses...' } as AppState));
    
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timestamp: new Date().toISOString(), ...answers })
        });
      } catch (e) { console.error("Webhook submission failed", e); }
    }

    const newSub: SavedSubmission = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleString(),
      data: { ...answers }
    };

    const successMsg = language.startsWith('hi') ? "सफलतापूर्वक जमा किया गया।" : "Submission successful.";
    await speechRef.current?.speak(successMsg, language);
    
    if (sessionRef.current !== sessionId) return;

    setAppState(prev => {
      const updatedSubs = [newSub, ...prev.savedSubmissions];
      localStorage.setItem('voiceform_submissions', JSON.stringify(updatedSubs));
      return { 
        ...prev, 
        mode: 'idle',
        currentFieldIndex: 0,
        answers: {},
        history: [],
        pendingValue: null,
        interimTranscript: '',
        awaitingConfirmation: false,
        lastLog: 'Success! Form submitted to database.',
        savedSubmissions: updatedSubs
      } as AppState;
    });
    setShowSummary(false);
  };

  const startForm = async () => {
    sessionRef.current++;
    
    setAppState(prev => ({ 
      ...prev, 
      currentFieldIndex: 0, 
      answers: {}, 
      history: [], 
      mode: 'busy', 
      lastLog: 'Initializing...', 
      pendingValue: null, 
      awaitingConfirmation: false, 
      interimTranscript: '' 
    } as AppState));
    
    setShowSummary(false);
    const welcome = appState.language.startsWith('hi') ? "नमस्ते, शुरू करते हैं।" : "Welcome. Let's begin the form.";
    
    const currentSessionId = sessionRef.current;
    await speechRef.current?.speak(welcome, appState.language, () => {
      if (sessionRef.current === currentSessionId) {
        setTimeout(() => handleNextStep(), 300);
      }
    });
  };

  const copyToClipboard = (data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    alert("Record copied to clipboard.");
  };

  const deleteSubmission = (id: string) => {
    setAppState(prev => {
      const updated = prev.savedSubmissions.filter(s => s.id !== id);
      localStorage.setItem('voiceform_submissions', JSON.stringify(updated));
      return { ...prev, savedSubmissions: updated } as AppState;
    });
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-mono selection:bg-yellow-400 selection:text-black">
      <Header 
        status={appState.mode === 'listening' ? 'Listening' : appState.mode === 'busy' ? 'Thinking' : appState.mode === 'fetching' ? 'Analyzing' : appState.mode === 'preview' ? 'Ready' : 'Idle'} 
        isBusy={isSessionActive() || appState.mode === 'fetching'} 
        onOpenSettings={() => setShowSettings(true)}
      />

      {showSettings && <SettingsOverlay settings={appState.settings} onUpdate={handleUpdateSettings} onClose={() => setShowSettings(false)} />}

      <main className="flex-1 overflow-y-auto pb-64">
        {appState.mode === 'idle' && !showSummary && (
          <div className="bg-zinc-900 border-b-8 border-yellow-400 p-12 shadow-2xl">
            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-8">
                <div>
                   <label className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-2 block">Current Workspace</label>
                   <div className="p-6 bg-black border-4 border-yellow-400">
                      <h2 className="text-3xl font-black text-yellow-400 uppercase tracking-tighter leading-none mb-2">{appState.activeForm.title}</h2>
                      <p className="text-zinc-500 text-xs font-bold uppercase">{appState.activeForm.fields.length} Fields Configured</p>
                      {appState.activeForm !== SAMPLE_FORM && (
                        <button onClick={() => setAppState(prev => ({...prev, activeForm: SAMPLE_FORM}))} className="mt-4 bg-zinc-800 px-4 py-2 text-[10px] uppercase font-black text-zinc-400 hover:text-white border border-zinc-700">Restore Default</button>
                      )}
                   </div>
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-black uppercase tracking-widest text-zinc-500 block">External Form Bridge</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Paste Form URL here..." 
                      value={formUrl} 
                      onChange={(e) => setFormUrl(e.target.value)} 
                      className="flex-1 p-5 bg-black border-4 border-zinc-800 text-lg font-mono text-zinc-300 focus:border-yellow-400 outline-none transition-colors" 
                    />
                    <button 
                      onClick={handleFetchForm}
                      disabled={!formUrl}
                      className="px-8 bg-zinc-800 border-4 border-zinc-800 hover:border-yellow-400 hover:text-yellow-400 disabled:opacity-20 font-black uppercase"
                    >
                      Fetch
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-end">
                <button onClick={startForm} className="group relative w-full p-12 bg-yellow-400 text-black text-6xl font-black uppercase shadow-[12px_12px_0_#000000] hover:bg-white hover:shadow-[16px_16px_0_#000000] active:translate-y-2 active:shadow-none transition-all">
                  Start Session
                </button>
                <div className="mt-8 pt-8 border-t border-zinc-800">
                   <label className="block text-[10px] font-black uppercase text-zinc-600 mb-2">Google Sheets Webhook (Optional)</label>
                   <input type="text" placeholder="https://script.google.com/..." value={appState.webhookUrl} onChange={(e) => { localStorage.setItem('voiceform_webhook', e.target.value); setAppState(prev => ({...prev, webhookUrl: e.target.value} as AppState))}} className="w-full p-3 bg-black border-2 border-zinc-800 text-[10px] font-mono text-zinc-500 focus:border-yellow-400 outline-none" />
                </div>
              </div>
            </div>
          </div>
        )}

        {appState.mode === 'fetching' && (
          <div className="flex flex-col items-center justify-center py-40 space-y-10">
            <div className="w-32 h-32 border-[16px] border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-5xl font-black uppercase text-yellow-400 tracking-tighter animate-pulse">Scanning DOM Elements...</div>
          </div>
        )}

        {appState.mode === 'preview' && (
          <div className="p-12 max-w-4xl mx-auto">
            <div className="bg-zinc-900 border-8 border-yellow-400 p-12 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 bg-yellow-400 text-black font-black uppercase text-xs">AI Discovery Result</div>
              <h2 className="text-6xl font-black text-yellow-400 uppercase tracking-tighter mb-4">{appState.activeForm.title}</h2>
              <p className="text-2xl text-white font-bold mb-10 opacity-60">{appState.activeForm.description}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                {appState.activeForm.fields.slice(0, 6).map(f => (
                  <div key={f.id} className="border-l-4 border-zinc-800 pl-4">
                    <span className="text-zinc-600 text-[10px] font-black uppercase">{f.type}</span>
                    <p className="font-bold text-xl">{f.label}</p>
                  </div>
                ))}
                {appState.activeForm.fields.length > 6 && <div className="text-zinc-700 italic font-black">+ {appState.activeForm.fields.length - 6} more fields detected</div>}
              </div>

              <div className="flex gap-4">
                <button onClick={startForm} className="flex-1 p-8 bg-yellow-400 text-black text-3xl font-black uppercase hover:bg-white transition-colors shadow-[8px_8px_0_#000000]">Accept & Start</button>
                <button onClick={() => setAppState(prev => ({...prev, mode: 'idle'}))} className="px-12 bg-zinc-800 text-zinc-400 font-black uppercase hover:text-white transition-colors border-4 border-zinc-700">Reject</button>
              </div>
            </div>
          </div>
        )}

        {isSessionActive() && !showSummary && <FormDisplay schema={appState.activeForm} currentFieldIndex={appState.currentFieldIndex} answers={appState.answers} pendingValue={appState.pendingValue} awaitingConfirmation={appState.awaitingConfirmation} />}

        {showSummary && (
          <div className="p-12 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-20 duration-500">
             <div className="border-8 border-yellow-400 p-12 bg-zinc-900 shadow-2xl">
                <h2 className="text-7xl font-black mb-12 uppercase text-yellow-400 tracking-tighter">Review Results</h2>
                <div className="space-y-8">
                  {appState.activeForm.fields.map(f => (
                    <button key={f.id} onClick={() => handleGeminiAction({ action: 'ask_question', fieldId: f.id, normalizedAnswer: null, spokenPrompt: `Updating ${f.label}. Please provide new value.`, meta: { navigation: 'stay', reason: 'manual_edit', valid: true }}, null, sessionRef.current)} className="w-full text-left group border-b-4 border-zinc-800 pb-6 hover:bg-zinc-800 transition-colors px-4">
                       <span className="text-zinc-600 uppercase text-xs font-black block tracking-widest mb-2 group-hover:text-yellow-400">{f.label}</span>
                       <span className="text-white font-black text-4xl group-hover:text-yellow-400 transition-colors">{appState.answers[f.id] || "—"}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-16 p-10 bg-black border-4 border-dashed border-yellow-400/30 text-center">
                   <p className="text-3xl text-white font-black uppercase tracking-tighter">Say "Confirm" to Finalize</p>
                </div>
             </div>
          </div>
        )}

        <section className="mt-32 px-12 max-w-6xl mx-auto mb-48">
           <h2 className="text-6xl font-black uppercase text-zinc-900 tracking-tighter mb-12">Session History</h2>
           <div className="space-y-8">
              {appState.savedSubmissions.length === 0 && <div className="text-zinc-800 text-4xl font-black uppercase opacity-20 italic">No records found.</div>}
              {appState.savedSubmissions.map(sub => (
                <div key={sub.id} className="bg-zinc-900 border-4 border-zinc-800 p-10 hover:border-yellow-400 transition-colors">
                  <div className="flex justify-between items-center mb-8 border-b-2 border-zinc-800 pb-6">
                     <span className="text-zinc-500 font-black text-sm uppercase tracking-widest">{sub.timestamp}</span>
                     <div className="flex gap-4">
                        <button onClick={() => copyToClipboard(sub.data)} className="text-yellow-400 hover:text-white font-black uppercase text-xs border-2 border-yellow-400/20 px-4 py-2">Copy JSON</button>
                        <button onClick={() => deleteSubmission(sub.id)} className="text-red-600 hover:text-white font-black uppercase text-xs border-2 border-red-600/20 px-4 py-2">Delete</button>
                     </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                     {Object.entries(sub.data).map(([k, v]) => (
                       <div key={k}>
                         <span className="text-zinc-700 uppercase text-[10px] font-black block mb-1 tracking-tighter">{k}</span>
                         <span className="text-zinc-300 font-bold text-2xl">{v}</span>
                       </div>
                     ))}
                  </div>
                </div>
              ))}
           </div>
        </section>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-10 bg-black border-t-8 border-yellow-400 z-[100] shadow-[0_-20px_50px_rgba(0,0,0,0.8)]">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-12">
          <div className="flex-1 w-full overflow-hidden">
            <div className="flex items-center gap-4 mb-3">
              <div className={`h-4 w-4 rounded-full bg-yellow-400 ${isSessionActive() ? 'animate-ping' : ''}`} />
              <div className="text-xs font-black text-yellow-400 uppercase tracking-[0.3em]">Assistant Status: {appState.mode}</div>
            </div>
            <div className="text-5xl font-black text-white tracking-tighter truncate leading-tight" role="status">
              {appState.interimTranscript ? <span className="text-yellow-400">" {appState.interimTranscript} "</span> : appState.lastLog}
            </div>
          </div>
          
          {isSessionActive() && (
            <div className="flex gap-4 shrink-0">
              <button onClick={() => { if(confirm("Restart?")) startForm(); }} className="px-10 py-5 bg-zinc-800 text-white text-2xl font-black uppercase shadow-[6px_6px_0_#000000] border-2 border-zinc-700 hover:bg-zinc-700 transition-all">Restart</button>
              <button onClick={() => { if(confirm("Quit session?")) setAppState(s => ({...s, mode: 'idle'})); }} className="px-10 py-5 bg-red-600 text-white text-2xl font-black uppercase shadow-[6px_6px_0_#000000] border-2 border-red-800 hover:bg-red-500 transition-all">Stop</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
