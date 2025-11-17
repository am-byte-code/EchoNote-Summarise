import { GoogleGenAI, Type, Chat } from "@google/genai";
import { SummaryProject, TranscriptionSegment } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const summarySchema = {
  type: Type.OBJECT,
  properties: {
    transcription: {
      type: Type.ARRAY,
      description: 'The full, accurate transcription of the audio, with speaker labels for each segment. e.g., "Speaker 1", "Speaker 2".',
      items: {
        type: Type.OBJECT,
        properties: {
          speaker: { type: Type.STRING, description: 'The identified speaker label.' },
          text: { type: Type.STRING, description: 'The transcribed text for this speaker segment.' },
        },
        required: ['speaker', 'text'],
      },
    },
    summary: {
      type: Type.STRING,
      description: 'A concise, well-structured summary of the transcription in English, capturing the key points.',
    },
    title: {
      type: Type.STRING,
      description: 'A short, descriptive title for the recording in English, ideally under 6 words.'
    },
    titleEmoji: {
        type: Type.STRING,
        description: 'A single, relevant emoji that represents the content or tone of the recording.'
    }
  },
  required: ['transcription', 'summary', 'title', 'titleEmoji'],
};

export const generateSummaryFromAudio = async (audioBase64: string, mimeType: string) => {
  const audioPart = {
    inlineData: {
      data: audioBase64,
      mimeType,
    },
  };

  const textPart = {
    text: `This audio can be in any language. 
First, auto-detect the language of the audio. 
Second, provide a full and accurate transcription of the audio in its original language. You MUST identify and label different speakers (e.g., "Speaker 1", "Speaker 2").
Third, create a concise summary of the content in English.
Fourth, create a short, descriptive title for the recording in English.
Finally, suggest a single, relevant emoji for the title.
Please respond in the requested JSON format.`,
  };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: [audioPart, textPart] },
    config: {
      responseMimeType: 'application/json',
      responseSchema: summarySchema,
    },
  });

  const jsonString = response.text.trim();
  const result = JSON.parse(jsonString);
  
  return {
    title: result.title,
    summary: result.summary,
    transcription: result.transcription as TranscriptionSegment[],
    titleEmoji: result.titleEmoji,
  };
};

export const createGlobalChat = (projects: SummaryProject[], deletedProjects: SummaryProject[]) => {
  const activeProjectsContext = projects.length > 0
    ? `Here are the user's current summaries:\n${projects.map(p => `- Title: "${p.title}" (Summary: ${p.summary})`).join('\n')}`
    : "The user currently has no active summaries.";

  const deletedProjectsContext = deletedProjects.length > 0
    ? `Here are the items in the user's recycle bin:\n${deletedProjects.map(p => `- Title: "${p.title}"`).join('\n')}`
    : "The user's recycle bin is empty.";

  const systemInstruction = `You are the built-in AI assistant for the "EchoNote Summarizer" application.
Your ONLY purpose is to help users with their notes and the app's features.
You are strictly forbidden from answering any general knowledge questions or engaging in conversations unrelated to the user's summaries or the app itself.
If the user asks a question outside of your scope (e.g., "What is the capital of France?", "Tell me a joke"), you MUST politely decline and remind them of your purpose. For example, say: "I can only answer questions about your notes and summaries within the EchoNote app. How can I help you with your recordings?"

You have access to the following information about the user's data:

1.  **Active Summaries**:
${activeProjectsContext}

2.  **Recycle Bin**:
${deletedProjectsContext}

Use this information to answer questions about their notes. You can count items, search for keywords in titles and summaries, and compare notes.`;

  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction,
    },
  });
};


export const createProjectChat = (project: SummaryProject) => {
  const transcriptionText = project.transcription.map(t => `${t.speaker}: ${t.text}`).join('\n');
  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: `You are a helpful assistant analyzing an audio recording.
      The user is asking questions about a recording with the title: "${project.title}".
      
      Here is the full transcription of the recording:
      ---
      ${transcriptionText}
      ---
      
      And here is a summary:
      ---
      ${project.summary}
      ---
      
      Your task is to answer the user's questions based ONLY on the provided transcription and summary. Do not invent information. If the answer is not in the text, say that you cannot find the information in the recording.`,
    },
  });
};

export const sendChatMessage = async (chat: Chat, message: string): Promise<string> => {
  const response = await chat.sendMessage({ message });
  return response.text;
};

export const sendChatMessageStream = async (chat: Chat, message: string, onChunk: (chunk: string) => void) => {
    const stream = await chat.sendMessageStream({ message });
    for await (const chunk of stream) {
        onChunk(chunk.text);
    }
};