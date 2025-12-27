
import { FormSchema, FieldType, Language } from './types';

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en-US', name: 'English', nativeName: 'English' },
  { code: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'es-ES', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr-FR', name: 'French', nativeName: 'Français' },
  { code: 'de-DE', name: 'German', nativeName: 'Deutsch' },
  { code: 'ja-JP', name: 'Japanese', nativeName: '日本語' },
  { code: 'it-IT', name: 'Italian', nativeName: 'Italiano' },
  { code: 'pt-BR', name: 'Portuguese', nativeName: 'Portुकीस (Brasil)' }
];

export const SYSTEM_INSTRUCTION = `
You are the logic engine for VoiceForm Assist. You extract structured data from spoken conversation.
NO PERSONALITY. NO EXTRA CHATTER.

CRITICAL TASK: 
Identify the user's intent and extract the value for the current form field.

Rules:
1. Normalization: If a user says "My name is John Doe", extract "John Doe". If they say "I am 25 years old", extract "25".
2. Confirmation & Correction State: 
   - If "Awaiting Confirmation" is true:
     - Positive input (yes, okay, correct, haan, sahi) -> action: "navigate", meta.navigation: "next".
     - Correction Provided (e.g., "No, it's Jane", "Actually it is 24", "Galat, Jane hai") -> 
       Identify the NEW value ("Jane" or "24"), return action: "confirm_answer", normalizedAnswer: [new value], spokenPrompt: "Okay, [new value]. Correct?".
     - Pure Negation (No, Galat) -> action: "ask_question", spokenPrompt: "My apologies. What is the correct [Field Label]?".
   - If "Awaiting Confirmation" is false:
     - User provides data -> action: "confirm_answer", normalizedAnswer: [extracted value], spokenPrompt: "You said [extracted value]. Correct?".

3. Spoken Prompts:
   - Always confirm values. "You said [value]. Correct?"
   - For Hindi: "[value]? क्या यह सही है?"

4. Review Mode:
   - User can say "Edit [Field]" or "Submit".
   - "Edit Name" -> action: "ask_question", fieldId: "full_name".
   - "Submit" -> action: "navigate", meta.navigation: "done".

Output ONLY valid JSON:
{
  "action": "ask_question | confirm_answer | navigate | invalid_answer | summary",
  "fieldId": "string_id_or_null",
  "normalizedAnswer": "string_val_or_null",
  "spokenPrompt": "Short question or confirmation text.",
  "meta": {
    "navigation": "next | previous | stay | done | null",
    "reason": "debug info",
    "valid": true | false | null
  }
}
`;

export const WEBHOOK_GUIDE = `
To use Google Sheets:
1. Open a Google Sheet.
2. Extensions > Apps Script.
3. Paste code to handle doPost(e) and append to sheet.
4. Deploy as Web App for "Anyone".
`;

export const SAMPLE_FORM: FormSchema = {
  id: 'patient-onboarding',
  title: 'Patient Intake Form',
  description: 'Initial registration for the community health center.',
  fields: [
    {
      id: 'full_name',
      label: 'Full Name',
      type: FieldType.TEXT,
      helpText: 'Please state your first and last name clearly.',
      required: true
    },
    {
      id: 'age',
      label: 'Age',
      type: FieldType.NUMBER,
      helpText: 'How many years old are you?',
      required: true
    },
    {
      id: 'email',
      label: 'Email Address',
      type: FieldType.EMAIL,
      helpText: 'We will use this to send you appointment reminders.',
      required: true
    },
    {
      id: 'date_of_birth',
      label: 'Date of Birth',
      type: FieldType.DATE,
      helpText: 'The day, month, and year you were born.',
      required: true
    },
    {
      id: 'blood_type',
      label: 'Blood Type',
      type: FieldType.SELECT,
      options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      helpText: 'Select your blood group if you know it.'
    }
  ]
};
