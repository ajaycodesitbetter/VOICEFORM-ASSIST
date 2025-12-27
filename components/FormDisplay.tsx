
import React from 'react';
import { FormSchema } from '../types';

interface FormDisplayProps {
  schema: FormSchema;
  currentFieldIndex: number;
  answers: Record<string, string>;
  pendingValue: string | null;
  awaitingConfirmation: boolean;
}

const FormDisplay: React.FC<FormDisplayProps> = ({ 
  schema, 
  currentFieldIndex, 
  answers, 
  pendingValue, 
  awaitingConfirmation 
}) => {
  return (
    <div className="p-12 space-y-16 max-w-4xl mx-auto" role="form">
      <div className="border-l-[12px] border-yellow-400 pl-10 py-6 mb-20 bg-zinc-900/50">
        <h2 className="text-7xl font-black mb-2 tracking-tighter uppercase leading-none">{schema.title}</h2>
        <p className="text-3xl text-zinc-500 font-bold tracking-tight">{schema.description}</p>
      </div>

      <div className="space-y-12">
        {schema.fields.map((field, index) => {
          const isActive = index === currentFieldIndex;
          const isCompleted = answers[field.id] !== undefined;
          const isPending = isActive && awaitingConfirmation && pendingValue;
          
          return (
            <div 
              key={field.id}
              className={`p-10 border-8 transition-all duration-300 relative ${
                isActive ? 'border-yellow-400 bg-zinc-900 scale-105 shadow-[20px_20px_0_#000000] z-10' : 
                isCompleted ? 'border-zinc-800 opacity-30 grayscale' : 'border-zinc-900 opacity-10'
              }`}
            >
              <div className="flex justify-between items-start mb-6">
                <label className={`text-4xl font-black uppercase tracking-tighter ${isActive ? 'text-yellow-400' : 'text-zinc-600'}`}>
                  {field.label}
                  {field.required && <span className="text-red-500 ml-2">*</span>}
                </label>
                {isCompleted && <span className="bg-green-600 text-white px-4 py-2 text-sm font-black uppercase">Confirmed</span>}
                {isPending && <span className="bg-yellow-400 text-black px-4 py-2 text-sm font-black uppercase animate-pulse">Verify?</span>}
              </div>
              
              <div 
                className={`mt-6 min-h-[5rem] text-6xl font-black flex items-center break-words ${
                  isPending ? 'text-yellow-400/50 italic' : 
                  isCompleted ? 'text-white' : 
                  isActive ? 'text-zinc-700' : 'text-zinc-900'
                }`}
              >
                {answers[field.id] || pendingValue || (isActive ? 'Waiting for voice...' : '—')}
              </div>

              {isActive && field.helpText && (
                <div className="mt-10 pt-6 border-t-4 border-zinc-800">
                  <p className="text-2xl text-zinc-500 font-bold uppercase tracking-tight">
                    Tip: {field.helpText}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FormDisplay;
