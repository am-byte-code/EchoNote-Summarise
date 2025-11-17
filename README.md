# EchoNote Summarise 🎙️📝
AI powered voice note transcriber, summariser and contextual chatbot that stores everything locally.

## Overview 🔍
EchoNote Summarise is a voice note summarising tool built using Google AI Studio. It lets users record or upload audio, generate transcriptions, create summaries and ask follow up questions about the content. Everything is stored locally to avoid paywalls and to keep user data private. The app was inspired by the need to take notes during DevFest 2025 without relying on paid apps.

## Features ⭐
- 🎤 Record audio or upload files  
- 🧠 Automatic transcription  
- ✨ AI generated summaries  
- 💬 Ask questions using the built in chatbot  
- 💾 Local storage for all notes  
- 🌗 Light and dark theme support  
- ⚡ Fast UI built with Vite and TypeScript  

## Tech Stack 🧰
- TypeScript  
- Vite  
- Google AI Studio (Gemini API)  
- HTML and CSS  
- LocalStorage  

## Project Structure 📁
- `src/` application code  
- `components/` UI components  
- `store/` local data and app state  
- `lib/` AI Studio API helpers  
- `public/` assets  
- `index.html` entry point  

## Screenshots 📸
(Add screenshots here)

## How it Works ⚙️
1. User records or uploads an audio file  
2. App sends the audio to Google AI Studio  
3. Transcription generated  
4. Summary created from transcript  
5. Chatbot answers context based questions  
6. Notes saved locally  

## Run Locally 💻

### Prerequisite  
Node.js installed

### Steps  
1. Install dependencies  
2. Create a `.env.local` file and add your Gemini API key  
3. Start the development server  

App runs at `http://localhost:5173`.

## Deployment 🚀
Deployable to Vercel, Netlify, GitHub Pages or Cloudflare Pages.  
Build using:
Upload the output folder.  
Running locally is also fine for testing or demonstration.

## Why I Built This 🎯
During DevFest 2025, most voice note apps limited usage or pushed subscriptions. I needed a free tool that could capture long talks, generate summaries and allow follow up questions. EchoNote Summarise solves this while keeping everything stored locally.

## Repository 🔗
https://github.com/am-byte-code/EchoNote-Summarise
