
export enum FieldType {
  TEXT = 'text',
  NUMBER = 'number',
  EMAIL = 'email',
  DATE = 'date',
  PHONE = 'phone',
  SELECT = 'select'
}

export interface FormField {
  id: string;
  label: string;
  type: FieldType;
  helpText?: string;
  required?: boolean;
  options?: string[]; // For SELECT type
}

export interface FormSection {
  title: string;
  description?: string;
  fieldIds: string[];
}

export interface FormSource {
  uri: string;
  title: string;
}

export interface FormSchema {
  id: string;
  title: string;
  description: string;
  fields: FormField[];
  sections?: FormSection[]; // Support for multi-step/complex forms
  sources?: FormSource[]; // For Search Grounding URLs
}

export type ActionType = 'ask_question' | 'confirm_answer' | 'navigate' | 'invalid_answer' | 'summary';

export interface HistoryEntry {
  role: 'user' | 'model';
  text: string;
}

export interface SavedSubmission {
  id: string;
  timestamp: string;
  data: Record<string, string>;
}

export interface AppSettings {
  language: string;
  speechRate: number;
  highQualityVoice: boolean;
}

export interface GeminiResponse {
  action: ActionType;
  fieldId: string | null;
  normalizedAnswer: string | null;
  spokenPrompt: string;
  error_details?: string;
  meta: {
    navigation: 'next' | 'previous' | 'stay' | 'done' | null;
    reason: string;
    valid: boolean | null;
  };
}

export interface Language {
  code: string;
  name: string;
  nativeName: string;
}

export interface AppState {
  currentFieldIndex: number;
  answers: Record<string, string>;
  mode: 'idle' | 'busy' | 'listening' | 'finished' | 'fetching' | 'preview';
  lastLog: string;
  language: string;
  settings: AppSettings;
  history: HistoryEntry[];
  pendingValue: string | null;
  interimTranscript: string;
  awaitingConfirmation: boolean;
  savedSubmissions: SavedSubmission[];
  webhookUrl: string;
  activeForm: FormSchema;
}
