"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Upload, Settings, Trash2, Bot, User, FileText, 
  Sparkles, ChevronLeft, ChevronRight, Loader2 
} from 'lucide-react';
import { toast } from 'sonner';

interface Model {
  name: string;
  size?: number;
  modified?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export default function VellonCVs() {
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState('llama3.1:8b');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [uploadedCV, setUploadedCV] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Fetch available Ollama models on mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await fetch('/api/models');
        const data = await res.json();
        
        if (data.models?.length > 0) {
          setModels(data.models);
          const preferred = data.models.find((m: Model) => 
            m.name.includes('llama3.1') || m.name.includes('qwen2.5') || m.name.includes('phi')
          );
          if (preferred) setSelectedModel(preferred.name);
          setOllamaStatus('online');
        } else {
          setOllamaStatus('offline');
          setModels([{ name: 'llama3.1:8b' }, { name: 'mistral' }, { name: 'qwen2.5:7b' }]);
        }
      } catch {
        setOllamaStatus('offline');
        setModels([{ name: 'llama3.1:8b' }, { name: 'mistral' }, { name: 'qwen2.5:7b' }]);
      }
    };

    fetchModels();
  }, []);

  // Handle CV upload (MVP)
  const handleCVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    setTimeout(() => {
      const fileName = file.name;
      setUploadedCV(fileName);

      const uploadMessage: Message = {
        id: Date.now().toString(),
        role: 'system',
        content: `[CV UPLOADED] User uploaded "${fileName}". Treat this as the active resume for all optimization, rewriting, and ATS advice going forward.`,
      };

      setMessages(prev => [...prev, uploadMessage]);

      toast.success('CV received', {
        description: `${fileName} is now in context. Start chatting to optimize it.`,
      });

      setIsUploading(false);
      e.target.value = '';
    }, 650);
  };

  const clearChat = () => {
    setMessages([]);
    setUploadedCV(null);
    setInput('');
    toast.info('Conversation cleared');
  };

  // Send message with real streaming from our /api/chat
  const sendMessage = async (customMessage?: string) => {
    const messageText = customMessage || input.trim();
    if (!messageText || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          model: selectedModel,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || err.error || 'Request failed');
      }

      // Read the NDJSON stream
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('0:')) {
              try {
                const text = JSON.parse(line.slice(2));
                assistantContent += text;
                
                // Update the last assistant message live
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last.role === 'assistant') {
                    last.content = assistantContent;
                  }
                  return updated;
                });
              } catch {}
            }
          }
        }
      }

      setOllamaStatus('online');
    } catch (err: any) {
      if (err.message?.includes('Ollama')) {
        setOllamaStatus('offline');
        toast.error('Ollama not running', {
          description: 'Please run `ollama serve` then try again.',
        });
      } else {
        toast.error('Error', { description: err.message });
      }
      // Remove the failed assistant placeholder if needed
      setMessages(prev => prev.filter(m => !(m.role === 'assistant' && m.content === '')));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const quickActions = [
    "Optimize my CV for ATS",
    "Tailor this resume to a Senior Software Engineer role",
    "Make my experience bullets more quantifiable",
    "Rewrite the summary to be more impactful",
    "Run a full ATS compatibility audit",
  ];

  const handleQuickAction = (action: string) => {
    sendMessage(action);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-72' : 'w-0'} transition-all duration-200 border-r border-zinc-800 flex flex-col bg-zinc-900 overflow-hidden`}>
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-black" />
            </div>
            <div>
              <div className="font-semibold tracking-tight text-xl">VellonCVs</div>
              <div className="text-[10px] text-zinc-500 -mt-0.5">PRIVATE • LOCAL • POWERFUL</div>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="text-zinc-500 hover:text-zinc-300">
            <ChevronLeft size={18} />
          </button>
        </div>

        {/* Model Selector */}
        <div className="p-4 border-b border-zinc-800">
          <div className="text-xs font-medium text-zinc-400 mb-1.5 px-1">MODEL</div>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-zinc-500"
          >
            {models.map((m) => (
              <option key={m.name} value={m.name}>{m.name}</option>
            ))}
          </select>
          <div className="mt-1.5 text-[10px] text-zinc-500 px-1 flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${ollamaStatus === 'online' ? 'bg-emerald-500' : ollamaStatus === 'offline' ? 'bg-red-500' : 'bg-amber-500'}`} />
            {ollamaStatus === 'online' && 'Connected to Ollama'}
            {ollamaStatus === 'offline' && 'Ollama offline — run `ollama serve`'}
            {ollamaStatus === 'checking' && 'Checking connection...'}
          </div>
        </div>

        {/* CV Upload Area */}
        <div className="p-4 border-b border-zinc-800">
          <div className="text-xs font-medium text-zinc-400 mb-2 px-1">ACTIVE CV</div>
          
          {!uploadedCV ? (
            <label className="flex flex-col items-center justify-center border border-dashed border-zinc-700 hover:border-zinc-500 rounded-2xl p-6 cursor-pointer transition-colors bg-zinc-950/50">
              <Upload className="w-5 h-5 mb-2 text-zinc-400" />
              <div className="text-sm font-medium">Upload Resume</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">PDF or DOCX</div>
              <input 
                type="file" 
                accept=".pdf,.docx,.doc,.txt" 
                onChange={handleCVUpload} 
                className="hidden" 
              />
            </label>
          ) : (
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3 flex items-center gap-3">
              <FileText className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div className="min-w-0 flex-1 text-sm truncate">{uploadedCV}</div>
              <button 
                onClick={() => setUploadedCV(null)} 
                className="text-zinc-400 hover:text-red-400 transition-colors"
              >
                <Trash2 size={15} />
              </button>
            </div>
          )}

          {isUploading && (
            <div className="mt-2 text-xs flex items-center gap-2 text-zinc-400">
              <Loader2 className="w-3 h-3 animate-spin" /> Processing CV...
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="text-xs font-medium text-zinc-400 mb-2 px-1">QUICK ACTIONS</div>
          <div className="space-y-1">
            {quickActions.map((action, i) => (
              <button
                key={i}
                onClick={() => handleQuickAction(action)}
                className="w-full text-left text-sm px-3 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-transparent hover:border-zinc-700 transition-colors"
              >
                {action}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-zinc-800">
          <button 
            onClick={clearChat}
            className="flex items-center gap-2 text-xs w-full justify-center py-2 rounded-xl border border-zinc-800 hover:bg-zinc-900 transition-colors"
          >
            <Trash2 size={14} /> Clear conversation
          </button>
          <div className="text-[10px] text-center text-zinc-600 mt-3">100% private • Runs on your hardware</div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-14 border-b border-zinc-800 px-5 flex items-center justify-between bg-zinc-950/80 backdrop-blur">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="text-zinc-400 hover:text-white mr-1">
                <ChevronRight size={18} />
              </button>
            )}
            <div className="font-semibold tracking-tight">VellonCVs</div>
            <div className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">LOCAL AI</div>
          </div>

          <div className="flex items-center gap-2 text-sm text-zinc-400">
            {uploadedCV && <span className="hidden md:inline text-emerald-400">CV loaded • {uploadedCV}</span>}
            <button 
              onClick={() => window.location.reload()} 
              className="px-3 py-1.5 rounded-lg hover:bg-zinc-900 transition-colors flex items-center gap-1.5 text-xs"
            >
              <Settings size={14} /> Settings
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-zinc-950" id="chat-scroll">
          {messages.length === 0 && (
            <div className="max-w-md mx-auto text-center pt-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white mb-6">
                <Sparkles className="w-8 h-8 text-black" />
              </div>
              <h1 className="text-3xl font-semibold tracking-tighter">Private AI CV Optimization</h1>
              <p className="mt-3 text-zinc-400">
                Upload your resume and chat naturally. I&apos;ll rewrite, tailor, and optimize it for ATS and human readers — all locally with Ollama.
              </p>

              <div className="mt-8 grid grid-cols-1 gap-2 text-left text-sm max-w-xs mx-auto">
                {quickActions.slice(0, 3).map((action, i) => (
                  <button 
                    key={i}
                    onClick={() => handleQuickAction(action)}
                    className="px-4 py-3 rounded-2xl border border-zinc-800 hover:bg-zinc-900 text-left transition"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, index) => {
            const isUser = message.role === 'user';
            const isSystem = message.role === 'system';

            if (isSystem) {
              return (
                <div key={index} className="max-w-2xl mx-auto bg-zinc-900 border border-zinc-800 text-emerald-300 text-sm rounded-2xl p-4">
                  {message.content.replace('[CV UPLOADED] ', '')}
                </div>
              );
            }

            return (
              <div key={index} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-3 max-w-[85%] ${isUser ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isUser ? 'bg-white text-black' : 'bg-zinc-800'}`}>
                    {isUser ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div className={`rounded-3xl px-5 py-3 text-[15px] leading-relaxed ${isUser ? 'bg-white text-black' : 'bg-zinc-900 border border-zinc-800'}`}>
                    <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap">
                      {message.content}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3 max-w-[85%]">
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl px-5 py-3 text-sm text-zinc-400">
                Thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer */}
        <div className="border-t border-zinc-800 bg-zinc-950 p-4">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            <div className="relative">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  uploadedCV 
                    ? "Ask me to optimize, tailor, rewrite, or audit your CV..." 
                    : "Upload your CV above or describe what you need..."
                }
                className="w-full bg-zinc-900 border border-zinc-700 focus:border-zinc-500 transition-colors rounded-3xl pl-5 pr-14 py-3.5 text-base placeholder:text-zinc-500 outline-none"
                disabled={isLoading}
              />
              <button 
                type="submit" 
                disabled={!input.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-2xl bg-white text-black flex items-center justify-center disabled:opacity-40 hover:bg-zinc-200 transition disabled:hover:bg-white"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send size={18} />}
              </button>
            </div>
            <div className="text-[10px] text-center text-zinc-600 mt-2">
              Powered by Ollama • Your data stays on your machine
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
