export const MODELS = {
  CHAT: 'gemini-2.5-flash',
  REASONING: 'gemini-2.5-flash', // Uses thinking config
  IMAGE_GEN: 'gemini-2.5-flash-image',
  VIDEO: 'veo-3.1-fast-generate-preview',
  VIDEO_HQ: 'veo-3.1-generate-preview',
  LIVE: 'gemini-2.5-flash-native-audio-preview-09-2025',
  TTS: 'gemini-2.5-flash-preview-tts'
};

export const CHAT_MODES = {
  STANDARD: { id: 'standard', label: 'Standard', model: 'gemini-2.5-flash' },
  THINKING: { id: 'thinking', label: 'Deep Thinking', model: 'gemini-3-pro-preview', thinkingBudget: 32768 },
  IMAGE: { id: 'image', label: 'Image Creation', model: 'gemini-2.5-flash-image' }
};

export const CHAT_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro' }
];

export const SYSTEM_PROMPTS = {
  STANDARD: `You are a helpful, expert AI assistant. Use Markdown for formatting.`,
  GUIDED: `You are a helpful, expert AI assistant. Use Markdown for formatting. 
CRITICAL: At the very end of your response, you must provide 3 short, relevant follow-up questions or actions for the user. 
Format these suggestions strictly as a JSON array inside a <suggestions> XML tag. 
Example: 
... your response text ...
<suggestions>["Tell me more", "Explain this concept", "Give an example"]</suggestions>`
};

export const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"];
export const RESOLUTIONS_IMAGE = ["1K", "2K"];
export const RESOLUTIONS_VIDEO = ["720p", "1080p"];