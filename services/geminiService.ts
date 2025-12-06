import { GoogleGenAI, Type } from "@google/genai";
import { MODELS, CHAT_MODES } from "../constants";
import { Attachment } from "../types";

// Helper to ensure API Key is present
const getClient = () => {
  const key = process.env.API_KEY;
  if (!key) throw new Error("API_KEY not found in environment.");
  return new GoogleGenAI({ apiKey: key });
};

// --- CHAT ---
export const streamChatResponse = async (
  history: { role: string; parts: { text: string }[] }[],
  message: string,
  mode: 'standard' | 'thinking' | 'image',
  modelNameOverride: string | undefined,
  systemInstruction: string,
  attachments: Attachment[] = [],
  onChunk: (text: string, image?: string) => void
) => {
  const ai = getClient();
  
  // 1. Determine base model from Mode or Override
  let modelName = modelNameOverride || CHAT_MODES.STANDARD.model;
  
  if (!modelNameOverride) {
      if (mode === 'thinking') modelName = CHAT_MODES.THINKING.model;
      if (mode === 'image') modelName = CHAT_MODES.IMAGE.model;
  }

  // 2. Configure based on Mode (Thinking Config etc.)
  let config: any = {
    systemInstruction: systemInstruction,
  };

  if (mode === 'thinking') {
    config.thinkingConfig = { thinkingBudget: CHAT_MODES.THINKING.thinkingBudget };
  } 
  
  const chat = ai.chats.create({
    model: modelName, 
    history: history,
    config: config
  });

  // Construct message with optional attachments (multimodal inputs)
  let msgContent: any = message;
  
  if (attachments.length > 0) {
     msgContent = [
       ...attachments.map(att => ({ 
           inlineData: { 
               mimeType: att.mimeType, 
               data: att.data 
           } 
       })),
       { text: message }
     ];
  }

  const result = await chat.sendMessageStream({ message: msgContent });
  
  for await (const chunk of result) {
    // 1. Text Content
    if (chunk.text) {
      onChunk(chunk.text);
    }
    
    // 2. Generated Images (for Image Mode)
    const parts = chunk.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.mimeType.startsWith('image')) {
          const base64Image = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          onChunk('', base64Image);
        }
      }
    }
  }
};

// --- IMAGE ---
export const generateImage = async (prompt: string, aspectRatio: string = "1:1", size: string = "1K") => {
  const ai = getClient();
  // gemini-2.5-flash-image does not support imageSize parameter
  const response = await ai.models.generateContent({
    model: MODELS.IMAGE_GEN, 
    contents: { parts: [{ text: prompt }] },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio,
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image generated");
};

// --- VIDEO (VEO) ---
export const generateVideo = async (prompt: string, aspectRatio: string = "16:9") => {
  if ((window as any).aistudio && typeof (window as any).aistudio.hasSelectedApiKey === 'function') {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) {
        throw new Error("API_KEY_REQUIRED");
      }
  }

  const ai = getClient(); 

  let operation = await ai.models.generateVideos({
    model: MODELS.VIDEO,
    prompt: prompt,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: aspectRatio as any
    }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!videoUri) throw new Error("No video generated");

  const res = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
  if (!res.ok) throw new Error("Failed to download video");
  
  const blob = await res.blob();
  return URL.createObjectURL(blob);
};

// --- LIVE API Helper ---
export const getLiveClient = () => {
    return getClient();
};