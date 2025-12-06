import { Modality } from '@google/genai';

export enum ViewMode {
  CANVAS = 'CANVAS',
  LIVE = 'LIVE',
  CREATIVE = 'CREATIVE',
  SETTINGS = 'SETTINGS'
}

export interface Attachment {
  type: 'image' | 'file';
  mimeType: string;
  data: string; // Base64 string (raw)
  name?: string;
  url?: string; // For UI display (blob URL)
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  attachments?: Attachment[];
  timestamp: number;
  isError?: boolean;
}

export interface GeneratorConfig {
  aspectRatio: string;
  resolution: string;
  duration?: string;
}

export interface CreativeResult {
  type: 'image' | 'video';
  url: string;
  prompt: string;
  timestamp: number;
}

export type LiveStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// --- Canvas Types ---

export type ThemeOption = 'black' | 'dark-gray' | 'light';
export type ChatMode = 'standard' | 'thinking' | 'image';

export interface CanvasNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  title: string;
  messages: ChatMessage[];
  theme: ThemeOption;
  parentId?: string;
  chatMode: ChatMode; 
  selectedModel?: string; // Specific model override
  isGuidedLearning: boolean;
}

export interface CanvasEdge {
  id: string;
  fromNode: string;
  toNode: string;
  fromMessageId?: string; // If branched from specific message
}

export interface CanvasState {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  viewport: { x: number; y: number; zoom: number };
}

export interface CanvasData extends CanvasState {
  id: string;
  name: string;
  lastModified: number;
}