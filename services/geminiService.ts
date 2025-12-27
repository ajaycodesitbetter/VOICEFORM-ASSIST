
import { GoogleGenAI, Type } from "@google/genai";
import { GeminiResponse, FormSchema, HistoryEntry, FieldType, FormSource } from "../types";
import { SYSTEM_INSTRUCTION } from "../constants";

export class GeminiService {
  private async callWithRetry(fn: () => Promise<any>, maxRetries = 3, initialDelay = 1000): Promise<any> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        const isQuotaError = error?.message?.includes('429') || error?.status === 429 || error?.message?.includes('RESOURCE_EXHAUSTED');
        if (isQuotaError && i < maxRetries - 1) {
          const delay = initialDelay * Math.pow(2, i);
          console.warn(`Gemini Quota Exceeded (429). Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  async parseFormFromUrl(url: string): Promise<FormSchema> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const prompt = `
      Analyze the web form at URL: ${url}
      
      COMPLEX FORM ANALYSIS TASK:
      1. Use Google Search to find information about the form structure of this specific URL.
      2. Identify all input fields (labels, types, required status).
      3. Detect if the form is MULTI-STEP or DIVIDED INTO SECTIONS.
      4. If complex, create a 'sections' array grouping field IDs logically.
      5. Return a comprehensive FormSchema JSON.
      
      If the exact URL isn't indexable, use your internal knowledge of standard form patterns for this domain.
    `;

    try {
      const response = await this.callWithRetry(() => ai.models.generateContent({
        model: 'gemini-3-pro-image-preview', // Mandatory for googleSearch tool per instructions
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              fields: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    label: { type: Type.STRING },
                    type: { type: Type.STRING, description: "One of: text, number, email, date, phone, select" },
                    helpText: { type: Type.STRING },
                    required: { type: Type.BOOLEAN },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["id", "label", "type"]
                }
              },
              sections: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    fieldIds: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["title", "fieldIds"]
                }
              }
            },
            required: ["id", "title", "fields"]
          }
        }
      }));

      const schema = JSON.parse(response.text || "{}") as FormSchema;
      
      // Extract grounding sources per mandatory instructions
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const sources: FormSource[] = [];
      if (groundingChunks) {
        for (const chunk of groundingChunks) {
          if (chunk.web) {
            sources.push({
              uri: chunk.web.uri,
              title: chunk.web.title || chunk.web.uri
            });
          }
        }
      }
      schema.sources = sources;

      schema.fields = schema.fields.map(f => ({
        ...f,
        id: f.id.replace(/\s+/g, '_').toLowerCase()
      }));
      if (schema.sections) {
        schema.sections = schema.sections.map(s => ({
          ...s,
          fieldIds: s.fieldIds.map(fid => fid.replace(/\s+/g, '_').toLowerCase())
        }));
      }
      return schema;
    } catch (error) {
      console.error("Form Parsing Error:", error);
      throw new Error("Could not parse form from URL.");
    }
  }

  async processInput(
    userInput: string,
    schema: FormSchema,
    currentState: {
      currentFieldIndex: number;
      answers: Record<string, string>;
      awaitingConfirmation: boolean;
      pendingValue: string | null;
      language: string;
      history: HistoryEntry[];
    }
  ): Promise<GeminiResponse> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const currentField = schema.fields[currentState.currentFieldIndex];
    
    const prompt = `
      TARGET LANGUAGE: ${currentState.language}
      CURRENT FIELD: ${currentField?.label} (Type: ${currentField?.type})
      CURRENT ANSWERS SO FAR: ${JSON.stringify(currentState.answers)}
      PENDING VALUE IN BUFFER: "${currentState.pendingValue || 'NONE'}"
      AWAITING CONFIRMATION: ${currentState.awaitingConfirmation}

      USER JUST SAID: "${userInput}"

      TASK:
      1. If AWAITING_CONFIRMATION is true:
         - Positive response -> action: "navigate", navigation: "next", normalizedAnswer: PENDING VALUE.
         - Correction provided -> action: "confirm_answer", normalizedAnswer: [new value].
         - Negative response -> action: "ask_question".
      2. Navigation:
         - Back -> action: "navigate", navigation: "previous".

      CONVERSATION HISTORY:
      ${currentState.history.slice(-5).map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join('\n')}
    `;

    try {
      const response = await this.callWithRetry(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
        },
      }));

      const candidate = response.candidates?.[0];
      if (!candidate) throw new Error("AI_NO_CANDIDATE");
      const text = response.text;
      if (!text) throw new Error("AI_NO_TEXT");

      return JSON.parse(text) as GeminiResponse;
    } catch (error: any) {
      console.error("Gemini Service Error:", error);
      return {
        action: "invalid_answer",
        fieldId: currentField?.id || null,
        normalizedAnswer: null,
        spokenPrompt: currentState.language.startsWith('hi') 
          ? "माफ़ कीजिये, मुझे समझने में दिक्कत हुई। कृपया फिर से कहें।" 
          : "I'm sorry, I had trouble understanding that. Please say it again.",
        meta: { navigation: "stay", reason: "ERROR", valid: false }
      };
    }
  }

  async generateSummaryPrompt(answers: Record<string, string>, schema: FormSchema, language: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const summaryLines = schema.fields
      .map(f => `${f.label}: ${answers[f.id] || "Empty"}`)
      .join(". ");
    
    const prompt = `Summarize these form responses in ${language} for a final review: ${summaryLines}. End by asking if they want to submit or edit a specific field.`;

    try {
      const response = await this.callWithRetry(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          systemInstruction: "Generate a clear, respectful summary. Return only the spoken text.",
        },
      }));
      return response.text || "Please review your answers before submitting.";
    } catch (e) {
      return "Review your answers: " + summaryLines;
    }
  }

  async translateQuestion(fieldLabel: string, helpText: string | undefined, index: number, total: number, language: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const prompt = `Ask for "${fieldLabel}" in ${language}. Helper text: ${helpText || 'None'}. This is field ${index + 1} of ${total}.`;

    try {
      const response = await this.callWithRetry(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          systemInstruction: "Create a natural, concise spoken question for a form. Return only the text.",
        },
      }));
      return response.text || `Question ${index + 1}: ${fieldLabel}`;
    } catch (e) {
      return `Question ${index + 1}: ${fieldLabel}`;
    }
  }
}
