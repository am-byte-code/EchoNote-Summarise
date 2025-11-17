export enum MainView {
  SUMMARIES = 'SUMMARIES',
  CHAT = 'CHAT',
  RECYCLE_BIN = 'RECYCLE_BIN',
}

export enum ProjectViewTab {
  SUMMARY = 'SUMMARY',
  TRANSCRIPTION = 'TRANSCRIPTION',
  GEMINI = 'GEMINI',
}

export interface TranscriptionSegment {
  speaker: string;
  text: string;
}

export interface SummaryProject {
  id: string; 
  title: string;
  titleEmoji: string;
  summary: string;
  transcription: TranscriptionSegment[];
  audioUrl: string; // will be a temporary blob URL
  audioMimeType: string;
  audioBase64: string; // for storage
  createdAt: string;
}


export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export enum Theme {
    LIGHT = 'LIGHT',
    DARK = 'DARK',
    SYSTEM = 'SYSTEM',
}