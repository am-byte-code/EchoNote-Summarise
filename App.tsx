import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Chat } from '@google/genai';
import { MainView, ProjectViewTab, SummaryProject, ChatMessage, TranscriptionSegment, Theme } from './types';
import { generateSummaryFromAudio, createGlobalChat, createProjectChat, sendChatMessageStream } from './services/geminiService';
import { MicIcon, StopIcon, UploadIcon, PlusIcon, TrashIcon, RestoreIcon, SendIcon, BackIcon, SunIcon, MoonIcon, SystemIcon } from './components/Icons';
import { AudioPlayer } from './components/AudioPlayer';

// --- UTILITY FUNCTIONS ---
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });
  
const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
};

// --- UI COMPONENTS ---

const Loader: React.FC<{ message: string }> = ({ message }) => (
  <div className="absolute inset-0 bg-gray-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 text-white">
    <svg className="animate-spin h-10 w-10 text-indigo-400 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <p className="text-lg animate-pulse">{message}</p>
  </div>
);

const EmptyState: React.FC<{ title: string; message: string; onAction: () => void; actionText: string; }> = ({ title, message, onAction, actionText }) => (
    <div className="text-center p-8 mt-16">
        <h3 className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">{title}</h3>
        <p className="mt-2 text-base text-gray-500 dark:text-gray-400">{message}</p>
        <div className="mt-6">
            <button
                type="button"
                onClick={onAction}
                className="inline-flex items-center px-5 py-2.5 border border-transparent shadow-sm text-sm font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-950 focus:ring-indigo-500"
            >
                <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                {actionText}
            </button>
        </div>
    </div>
);

interface SegmentedControlProps<T extends string> {
  options: Record<T, string>;
  selected: T;
  setSelected: (option: T) => void;
}

const SegmentedControl = <T extends string>({ options, selected, setSelected }: SegmentedControlProps<T>) => (
    <div className="flex space-x-1 bg-gray-200 dark:bg-gray-700/80 p-1 rounded-xl">
        {Object.keys(options).map((key) => (
            <button
                key={key}
                onClick={() => setSelected(key as T)}
                className={`w-full px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors focus:outline-none ${
                    selected === key
                        ? 'bg-white dark:bg-gray-200 text-gray-900 shadow-sm'
                        : 'text-gray-600 dark:text-gray-200 hover:bg-gray-300/50 dark:hover:bg-gray-600/50'
                }`}
            >
                {options[key as T].replace('_', ' ')}
            </button>
        ))}
    </div>
);

const ThemeSwitcher: React.FC<{ theme: Theme; setTheme: (theme: Theme) => void }> = ({ theme, setTheme }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const themeOptions = {
        [Theme.LIGHT]: { icon: SunIcon, label: 'Light' },
        [Theme.DARK]: { icon: MoonIcon, label: 'Dark' },
        [Theme.SYSTEM]: { icon: SystemIcon, label: 'System' },
    };

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);
    
    const CurrentIcon = themeOptions[theme].icon;

    return (
        <div className="relative" ref={wrapperRef}>
            <button onClick={() => setIsOpen(!isOpen)} className="p-2 rounded-full text-gray-500 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700 hover:text-gray-800 dark:hover:text-white transition-colors" aria-label="Switch theme">
                <CurrentIcon className="w-5 h-5" />
            </button>
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-36 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg z-50">
                    {Object.entries(themeOptions).map(([key, { icon: Icon, label }]) => (
                         <button
                            key={key}
                            onClick={() => { setTheme(key as Theme); setIsOpen(false); }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                                theme === key ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700'
                            }`}
                        >
                            <Icon className="w-4 h-4" />
                            {label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};


// --- MAIN APP ---
function App() {
  const [mainView, setMainView] = useState<MainView>(MainView.SUMMARIES);
  const [projects, setProjects] = useState<SummaryProject[]>([]);
  const [deletedProjects, setDeletedProjects] = useState<SummaryProject[]>([]);
  const [activeProject, setActiveProject] = useState<SummaryProject | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState<string | null>(null);

  // Theme State
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('theme') as Theme) || Theme.SYSTEM
  );

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Chat State
  const generalChatRef = useRef<Chat | null>(null);
  
    // --- THEME LOGIC ---
    useEffect(() => {
        const root = window.document.documentElement;
        const isDark = theme === Theme.DARK || (theme === Theme.SYSTEM && window.matchMedia('(prefers-color-scheme: dark)').matches);
        
        root.classList.toggle('dark', isDark);
        localStorage.setItem('theme', theme);

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            if (theme === Theme.SYSTEM) {
                root.classList.toggle('dark', mediaQuery.matches);
            }
        };
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [theme]);


  // --- LOCAL STORAGE & APP LOGIC ---

  // Load projects from local storage on initial render
  useEffect(() => {
    try {
      const storedProjects = localStorage.getItem('echo-note-projects');
      const storedDeletedProjects = localStorage.getItem('echo-note-deleted-projects');
      if (storedProjects) {
        setProjects(JSON.parse(storedProjects));
      }
      if (storedDeletedProjects) {
        setDeletedProjects(JSON.parse(storedDeletedProjects));
      }
    } catch (error) {
      console.error("Failed to load projects from local storage", error);
    }
  }, []);

  useEffect(() => {
    generalChatRef.current = createGlobalChat(projects, deletedProjects);
  }, [projects, deletedProjects]);
  
  // Save projects to local storage whenever they change
  useEffect(() => {
    localStorage.setItem('echo-note-projects', JSON.stringify(projects));
  }, [projects]);
  
  useEffect(() => {
    localStorage.setItem('echo-note-deleted-projects', JSON.stringify(deletedProjects));
  }, [deletedProjects]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => audioChunksRef.current.push(event.data);
      recorder.onstop = handleProcessRecording;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error starting recording:", err);
      alert("Microphone access was denied. Please allow microphone access in your browser settings.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };
  
  const handleProcessRecording = async () => {
    setIsLoading('Processing audio...');
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    const audioBase64 = await fileToBase64(new File([audioBlob], "recording.webm"));
    processAudio(audioBase64, 'audio/webm', audioBlob);
  };
  
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsModalOpen(false);
      setIsLoading('Uploading and processing file...');
      const audioBase64 = await fileToBase64(file);
      processAudio(audioBase64, file.type, file);
    }
  };
  
  const processAudio = async (base64: string, mimeType: string, blob: Blob) => {
    try {
      setIsLoading('Transcribing and summarizing...');
      const { title, summary, transcription, titleEmoji } = await generateSummaryFromAudio(base64, mimeType);
      
      const newProject: SummaryProject = {
        id: new Date().toISOString(),
        title,
        summary,
        transcription,
        titleEmoji,
        audioUrl: URL.createObjectURL(blob), // This is temporary for immediate playback
        audioMimeType: mimeType,
        audioBase64: base64, // This is stored
        createdAt: new Date().toISOString(),
      };
      
      setProjects(prev => [newProject, ...prev].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setActiveProject(newProject);
    } catch (error) {
      console.error('Error processing audio:', error);
      alert('Failed to process audio. Please try again.');
    } finally {
      setIsLoading(null);
      setIsModalOpen(false);
    }
  };
  
  const deleteProject = (id: string) => {
    const projectToDelete = projects.find(p => p.id === id);
    if (projectToDelete) {
        setProjects(projects.filter(p => p.id !== id));
        setDeletedProjects(prev => [projectToDelete, ...prev]);
    }
  };

  const restoreProject = (id: string) => {
      const projectToRestore = deletedProjects.find(p => p.id === id);
      if (projectToRestore) {
        setDeletedProjects(deletedProjects.filter(p => p.id !== id));
        setProjects(prev => [...prev, projectToRestore].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }
  };
  
  const permanentlyDeleteProject = (id: string) => {
      setDeletedProjects(deletedProjects.filter(p => p.id !== id));
  };

  // --- RENDER LOGIC ---
  const renderMainContent = () => {
      if (activeProject) {
        return <ProjectDetailView project={activeProject} onBack={() => setActiveProject(null)} />;
      }
      switch (mainView) {
        case MainView.SUMMARIES:
            return projects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 p-4">
                    {projects.map(p => (
                        <div key={p.id} className="relative bg-white dark:bg-zinc-800/50 rounded-2xl p-5 flex flex-col justify-between border border-gray-200 dark:border-zinc-700/80 hover:border-indigo-500/50 transition-all duration-300 cursor-pointer group" onClick={() => setActiveProject(p)}>
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-1">{p.title} <span className="text-lg">{p.titleEmoji}</span></h3>
                                <p className="text-gray-500 dark:text-zinc-400 text-xs mb-3">{new Date(p.createdAt).toLocaleString()}</p>
                                <p className="text-gray-700 dark:text-zinc-300 text-sm leading-relaxed line-clamp-4">{p.summary}</p>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); deleteProject(p.id); }} className="absolute top-3 right-3 text-gray-400 dark:text-zinc-500 hover:text-red-400 p-2 rounded-full hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100">
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        </div>
                    ))}
                </div>
            ) : <EmptyState title="No Summaries Yet" message="Get started by recording or uploading an audio file." onAction={() => setIsModalOpen(true)} actionText="New Summary"/>;
        case MainView.CHAT:
          return (
            <div className="flex flex-col flex-grow p-4">
                <ChatInterface chatRef={generalChatRef} placeholder="Chat with Gemini..." />
            </div>
          );
        case MainView.RECYCLE_BIN:
             return deletedProjects.length > 0 ? (
                <div className="p-4 space-y-3">
                    {deletedProjects.map(p => (
                        <div key={p.id} className="bg-white dark:bg-zinc-800/50 rounded-2xl p-4 flex items-center justify-between border border-gray-200 dark:border-zinc-700/80">
                            <div>
                                <h3 className="font-semibold text-gray-900 dark:text-white">{p.title}</h3>
                                <p className="text-gray-500 dark:text-zinc-400 text-sm">Created: {new Date(p.createdAt).toLocaleString()}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => restoreProject(p.id)} className="p-2 text-green-500 hover:text-green-600 rounded-full hover:bg-green-500/10"><RestoreIcon className="w-5 h-5"/></button>
                                <button onClick={() => permanentlyDeleteProject(p.id)} className="p-2 text-red-500 hover:text-red-600 rounded-full hover:bg-red-500/10"><TrashIcon className="w-5 h-5"/></button>
                            </div>
                        </div>
                    ))}
                </div>
             ) : <div className="text-center p-8 mt-16 text-gray-500 dark:text-gray-400">Recycle bin is empty.</div>;
        default: return null;
      }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-200 font-sans flex flex-col">
      {isLoading && <Loader message={isLoading} />}
      
      {!activeProject && (
          <header className="bg-white/70 dark:bg-gray-950/70 backdrop-blur-lg sticky top-0 z-30 border-b border-gray-200 dark:border-white/10">
            <div className="max-w-4xl mx-auto px-4">
              <div className="flex items-center justify-between py-4">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">EchoNote <span className="text-2xl">🎙️</span></h1>
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:block w-full max-w-sm">
                        <SegmentedControl<MainView> options={MainView} selected={mainView} setSelected={setMainView} />
                    </div>
                    <ThemeSwitcher theme={theme} setTheme={setTheme} />
                  </div>
              </div>
              <div className="sm:hidden pb-3">
                 <SegmentedControl<MainView> options={MainView} selected={mainView} setSelected={setMainView} />
              </div>
            </div>
          </header>
      )}

      <main className={`flex-grow max-w-4xl w-full mx-auto ${mainView === MainView.CHAT && !activeProject ? 'flex flex-col' : 'overflow-y-auto'}`}>
        {renderMainContent()}
      </main>

      {!activeProject && mainView === MainView.SUMMARIES && (
        <button onClick={() => setIsModalOpen(true)} className="fixed bottom-6 right-6 bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 transition-transform hover:scale-105 z-20" aria-label="Create new summary">
          <PlusIcon className="w-6 h-6" />
        </button>
      )}
      
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-40" onClick={() => setIsModalOpen(false)}>
            <div className="bg-white dark:bg-zinc-800 rounded-t-2xl p-6 w-full max-w-lg border-t border-gray-200 dark:border-zinc-700" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 text-center">New Summary</h2>
                <div className="space-y-4">
                    <button 
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`w-full flex items-center justify-center gap-3 p-4 rounded-xl text-lg font-semibold transition-all duration-300 ${isRecording ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                    >
                        {isRecording ? <><StopIcon className="w-6 h-6" /> Stop Recording</> : <><MicIcon className="w-6 h-6" /> Record Audio</>}
                    </button>
                    {isRecording && <div className="text-center text-indigo-500 dark:text-indigo-400 animate-pulse font-medium">Recording...</div>}
                    <div className="relative flex items-center py-2">
                        <div className="flex-grow border-t border-gray-300 dark:border-zinc-600"></div>
                        <span className="flex-shrink mx-4 text-gray-500 dark:text-zinc-400 text-sm">OR</span>
                        <div className="flex-grow border-t border-gray-300 dark:border-zinc-600"></div>
                    </div>
                    <label htmlFor="file-upload" className="w-full flex items-center justify-center gap-3 p-4 rounded-xl text-lg font-semibold bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-600 text-gray-800 dark:text-white cursor-pointer transition-colors">
                        <UploadIcon className="w-6 h-6" />
                        Upload from File
                    </label>
                    <input id="file-upload" type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

// --- DETAIL VIEW & CHAT COMPONENTS ---
const ProjectDetailView: React.FC<{ project: SummaryProject; onBack: () => void; }> = ({ project, onBack }) => {
    const [activeTab, setActiveTab] = useState<ProjectViewTab>(ProjectViewTab.SUMMARY);
    const [audioUrl, setAudioUrl] = useState<string>('');
    const projectChatRef = useRef<Chat | null>(null);

    useEffect(() => {
        projectChatRef.current = createProjectChat(project);
        
        // Create a blob URL from the stored base64 data
        const audioBlob = base64ToBlob(project.audioBase64, project.audioMimeType);
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        return () => {
            // Clean up the object URL on component unmount
            URL.revokeObjectURL(url);
        };
    }, [project]);

    const renderTabContent = () => {
        switch(activeTab) {
            case ProjectViewTab.SUMMARY:
                return <div className="prose prose-invert max-w-none p-5 bg-white dark:bg-zinc-800/50 rounded-2xl whitespace-pre-wrap text-gray-700 dark:text-gray-300">{project.summary}</div>;
            case ProjectViewTab.TRANSCRIPTION:
                const speakerColors = ['text-cyan-500 dark:text-cyan-400', 'text-pink-500 dark:text-pink-400', 'text-green-500 dark:text-green-400', 'text-yellow-500 dark:text-yellow-400', 'text-orange-500 dark:text-orange-400', 'text-purple-500 dark:text-purple-400'];
                const getSpeakerColor = (speaker: string) => {
                    const speakerNum = parseInt(speaker.replace(/[^0-9]/g, ''), 10);
                    if (!isNaN(speakerNum) && speakerNum > 0) {
                        return speakerColors[(speakerNum - 1) % speakerColors.length];
                    }
                    return 'text-gray-800 dark:text-gray-300';
                };
                return (
                    <div className="p-5 bg-white dark:bg-zinc-800/50 rounded-2xl space-y-3 text-gray-700 dark:text-gray-300">
                        {project.transcription.map((segment, index) => (
                            <p key={index} className="leading-relaxed">
                                <span className={`font-semibold ${getSpeakerColor(segment.speaker)}`}>{segment.speaker}: </span>
                                {segment.text}
                            </p>
                        ))}
                    </div>
                );
            case ProjectViewTab.GEMINI:
                return <ChatInterface chatRef={projectChatRef} placeholder={`Ask about "${project.title}"...`} />;
        }
    };
    
    return (
        <div className="flex flex-col h-full max-h-[calc(100vh-1rem)] p-2 sm:p-4">
            <header className="flex items-center p-2 mb-4">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors mr-2">
                    <BackIcon className="w-6 h-6" />
                </button>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white truncate">{project.title} <span className="text-2xl">{project.titleEmoji}</span></h2>
            </header>
            
            <div className="flex-grow flex flex-col min-h-0 mb-4 px-2">
                {renderTabContent()}
            </div>
            
            <footer className="sticky bottom-0 left-0 right-0 p-2 mt-auto">
                <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl p-4 rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl space-y-4">
                    {audioUrl ? <AudioPlayer audioUrl={audioUrl} /> : <div className="text-center text-sm text-gray-500 dark:text-gray-400 p-2">Loading audio...</div>}
                    <SegmentedControl<ProjectViewTab> 
                        options={ProjectViewTab}
                        selected={activeTab}
                        setSelected={setActiveTab}
                    />
                </div>
            </footer>
        </div>
    );
};

const ChatInterface: React.FC<{ chatRef: React.MutableRefObject<Chat | null>; placeholder: string; }> = ({ chatRef, placeholder }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || !chatRef.current || isThinking) return;

        const userMessage: ChatMessage = { role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsThinking(true);
        
        const modelResponse: ChatMessage = { role: 'model', text: ''};
        setMessages(prev => [...prev, modelResponse]);

        try {
            await sendChatMessageStream(chatRef.current, input, (chunk) => {
                setMessages(prev => {
                    const lastMessage = prev[prev.length - 1];
                    if (lastMessage?.role === 'model') {
                        lastMessage.text += chunk;
                        return [...prev.slice(0, -1), lastMessage];
                    }
                    return prev;
                });
            });
        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => {
                const lastMessage = prev[prev.length - 1];
                if(lastMessage?.role === 'model') {
                    lastMessage.text = "Sorry, something went wrong.";
                    return [...prev.slice(0, -1), lastMessage];
                }
                return prev;
            });
        } finally {
            setIsThinking(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-800/50 rounded-2xl">
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xl px-4 py-2 rounded-2xl ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-none'}`}>
                            <p className="whitespace-pre-wrap">{msg.text}{msg.role === 'model' && isThinking && index === messages.length - 1 ? '...' : ''}</p>
                        </div>
                    </div>
                ))}
                <div ref={chatEndRef}></div>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-white/10">
                <div className="flex items-center bg-gray-100 dark:bg-zinc-700/80 rounded-full pr-2">
                    <input
                        type="text" value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={placeholder}
                        className="w-full bg-transparent p-3 pl-5 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-zinc-400 focus:outline-none"
                        disabled={isThinking}
                    />
                    <button 
                        onClick={handleSend} disabled={isThinking || !input.trim()} 
                        className="p-2 rounded-full bg-indigo-600 text-white disabled:bg-gray-300 dark:disabled:bg-zinc-600 disabled:text-gray-500 dark:disabled:text-zinc-400 enabled:hover:bg-indigo-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-zinc-700/80"
                        aria-label="Send message"
                    >
                        <SendIcon className="w-5 h-5"/>
                    </button>
                </div>
            </div>
        </div>
    );
};


export default App;
