
import React from 'react';

interface HeaderProps {
  status: string;
  isBusy: boolean;
  onOpenSettings: () => void;
}

const Header: React.FC<HeaderProps> = ({ status, isBusy, onOpenSettings }) => {
  return (
    <header 
      className="border-b-4 border-yellow-400 p-6 bg-zinc-900 flex justify-between items-center z-50 sticky top-0"
      role="banner"
    >
      <div className="flex flex-col">
        <h1 className="text-4xl font-black uppercase tracking-tighter text-yellow-400 leading-none">
          VoiceForm Assist
        </h1>
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1" aria-label="Application Type">
          Bilingual Accessible Assistant
        </p>
      </div>
      
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-4" aria-label={`System Status: ${status}`}>
          <div 
            className={`h-3 w-3 rounded-full ${isBusy ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}
            aria-hidden="true"
          />
          <span 
            className={`text-sm font-black uppercase tracking-widest ${isBusy ? 'text-red-500' : 'text-zinc-400'}`} 
            role="status"
            aria-live="polite"
          >
            {status}
          </span>
        </div>

        <button 
          onClick={onOpenSettings}
          className="p-3 bg-zinc-800 border-2 border-zinc-700 hover:border-yellow-400 hover:text-yellow-400 transition-all active:scale-95 group"
          aria-label="Open voice and application settings"
          title="Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-90 transition-transform duration-300" aria-hidden="true">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
      </div>
    </header>
  );
};

export default Header;
