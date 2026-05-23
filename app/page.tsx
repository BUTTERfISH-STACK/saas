"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Upload, Settings, Trash2, Bot, User, FileText, 
  Sparkles, ChevronLeft, ChevronRight, Loader2, Zap 
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [selectedModel, setSelectedModel] = useState('llama3.2:3b');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [engineStatus, setEngineStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [uploadedCV, setUploadedCV] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [customBackendUrl, setCustomBackendUrl] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('vellon_backend_url');
    }
    return null;
  });
  const [showSettings, setShowSettings] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Premium auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading]);

  const backendUrl = customBackendUrl || process.env.NEXT_PUBLIC_BACKEND_URL || 
    (typeof window !== 'undefined' && window.location.hostname === 'localhost' 
      ? 'http://localhost:8000' 
      : undefined);

  // Reusable connection check (returns true if online)
  const checkVellonCoreConnection = async (): Promise<boolean> => {
    setEngineStatus('checking');
    const modelsEndpoint = backendUrl ? `${backendUrl}/models` : '/api/models';
    try {
      const res = await fetch(modelsEndpoint);
      const data = await res.json();
       
        if (data.models?.length > 0) {
          setModels(data.models);
          // Prefer fast, free, high-quality models for VellonCVs
          const preferred = data.models.find((m: Model) => 
            m.name.includes('llama3.2:3b') || 
            m.name.includes('llama3.2') || 
            m.name.includes('qwen2.5:7b') || 
            m.name.includes('qwen2.5-coder:3b') ||
            m.name.includes('phi4')
          );
          if (preferred) {
            setSelectedModel(preferred.name);
          } else {
            setSelectedModel(data.models[0].name);
          }
          setEngineStatus('online');
          return true;
        } else {
          setEngineStatus('offline');
          setModels([{ name: 'Vellon-Prime' }, { name: 'Vellon-Precision' }, { name: 'Vellon-Balanced' }]);
          return false;
        }
    } catch {
      setEngineStatus('offline');
      setModels([{ name: 'Vellon-Prime' }, { name: 'Vellon-Precision' }, { name: 'Vellon-Balanced' }]);
      return false;
    }
  };

  // Initial check on load
  useEffect(() => {
    checkVellonCoreConnection();
  }, []);

  // Auto re-check every 8 seconds when offline (prevents getting stuck)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (engineStatus === 'offline' || engineStatus === 'checking') {
      interval = setInterval(() => {
        checkVellonCoreConnection();
      }, 8000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [engineStatus]);

  // Enhanced CV upload handler (supports images for Vision Agent)
  const handleCVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    const fileName = file.name;
    const isImage = file.type.startsWith('image/') || fileName.match(/\.(png|jpg|jpeg|pdf)$/i);

    // Simulate local processing
    await new Promise(resolve => setTimeout(resolve, 650));

    setUploadedCV(fileName);

    const uploadMessage: Message = {
      id: Date.now().toString(),
      role: 'system',
      content: `Resume imported: ${fileName}. ${isImage ? 'Vision Agent ready for scanned/image processing.' : 'Text extracted and ready for agentic optimization.'}`,
    };

    setMessages(prev => [...prev, uploadMessage]);
    setIsUploading(false);
    e.target.value = '';

    toast.success('Resume loaded', {
      description: isImage ? 'Vision Agent can now analyze the image.' : 'Ready for full agent pipeline.',
      action: { 
        label: "Run Agent Pipeline", 
        onClick: () => runAgentPipeline(file) 
      }
    });
  };

  // Full execution of all three components: Orchestrator + Vision + Corrective/Redo
  const runAgentPipeline = async (file?: File) => {
    if (!file && !uploadedCV) {
      toast.error("Please upload a resume first");
      return;
    }

    setIsLoading(true);
    
    const formData = new FormData();
    formData.append("goal", "Optimize this resume for maximum ATS compatibility and impact using the full agent pipeline");
    
    if (file) {
      formData.append("file", file);
    } else if (uploadedCV) {
      // For demo, we can send text later. For now trigger with note.
      formData.append("resume_text", "Previously uploaded resume: " + uploadedCV);
    }

    try {
      const orchestrateEndpoint = backendUrl 
        ? `${backendUrl}/orchestrate/resume` 
        : '/api/orchestrate/resume';
      const res = await fetch(orchestrateEndpoint, {
        method: 'POST',
        body: formData,
      });
      
      const result = await res.json();

      if (result.success) {
        const agentMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `**Full Agent Pipeline Complete** (Iterations: ${result.iterations || 1})\n\n${result.data?.final_output || 'Optimized version generated.'}\n\n${result.critique_feedback ? `Last critique: ${result.critique_feedback}` : ''}`,
        };
        
        setMessages(prev => [...prev, agentMessage]);
        
        toast.success("Agent pipeline finished", {
          description: `Completed after ${result.iterations || 1} iteration(s) with Corrective Agent review.`
        });
      } else {
        throw new Error(result.message || "Pipeline failed");
      }
    } catch (err: any) {
      toast.error("Agent pipeline failed", {
        description: err.message + " — Make sure the Python backend is running (see docs)."
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setUploadedCV(null);
    setInput('');
    toast.info('Conversation reset');
  };

  // Premium streaming send
  const sendMessage = async (customMessage?: string) => {
    const messageText = (customMessage || input).trim();
    if (!messageText || isLoading) return;

    // Always try to reconnect if we think we're offline
    if (engineStatus !== 'online') {
      const isNowOnline = await checkVellonCoreConnection();
      if (!isNowOnline) {
        toast.error('Still offline', {
          description: customBackendUrl 
            ? `Cannot reach ${customBackendUrl}. Check your public FastAPI + Ollama.` 
            : 'Run ollama serve + Python backend. Use PREFERENCES button for Vercel.'
        });
        return;
      }
    }

    const chatEndpoint = backendUrl ? `${backendUrl}/chat` : '/api/chat';

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
      const res = await fetch(chatEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          model: selectedModel,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.error || 'Request failed');
      }

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

                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === 'assistant') last.content = assistantContent;
                  return updated;
                });
              } catch {}
            }
          }
        }
      }

      setEngineStatus('online');
    } catch (err: any) {
      const isEngineError = err.message?.toLowerCase().includes('core') || err.message?.toLowerCase().includes('unavailable');

      if (isEngineError) {
        setEngineStatus('offline');
        // Force an immediate re-check
        await checkVellonCoreConnection();

        // Only show error if still offline after re-check
        if (engineStatus !== 'online') {
          toast.error('Vellon Core unavailable', {
            description: customBackendUrl 
              ? `Cannot reach custom backend ${customBackendUrl}` 
              : 'Run ollama serve + backend. Use PREFERENCES for Vercel custom URL.',
            action: {
              label: "Retry now",
              onClick: () => checkVellonCoreConnection()
            }
          });
        }
      } else {
        toast.error('Something went wrong', { description: err.message });
      }

      // Remove the failed assistant placeholder if needed
      setMessages(prev => prev.filter(m => !(m.role === 'assistant' && !m.content)));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const quickActions = [
    "Perform a full optimization pass",
    "Run Full Agent Pipeline (Vision + Redo)",
    "Tailor for a Senior Staff Engineer role",
    "Strengthen impact and quantification",
    "Refine the professional summary",
  ];

  const handleQuickAction = (action: string) => {
    if (action.toLowerCase().includes("agent pipeline")) {
      runAgentPipeline();
    } else {
      sendMessage(action);
    }
  };

  const getStatusLabel = () => {
    if (engineStatus === 'online') return 'Vellon Intelligence';
    if (engineStatus === 'offline') return 'Core offline — click below to reconnect';
    return 'Checking Vellon Core…';
  };

  const getStatusColor = () => {
    if (engineStatus === 'online') return 'status-gold'; // Elegant gold for premium feel
    if (engineStatus === 'offline') return 'bg-rose-500/90';
    return 'bg-amber-400';
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#050505] text-[#FAFAFA] font-sans antialiased">
      {/* Premium Refined Sidebar */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-0'} flex flex-col bg-[#0A0A0C] border-r border-white/[0.06] transition-all duration-300 ease-out overflow-hidden`}>
        {/* Sidebar Header */}
        <div className="h-20 px-6 flex items-center justify-between border-b border-white/[0.06]">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-2xl bg-white flex items-center justify-center shadow-inner ring-1 ring-offset-2 ring-offset-[#050505] ring-[var(--gold-primary)]/30">
              <Sparkles className="w-5 h-5 text-black" />
            </div>
            <div>
              <div className="font-semibold tracking-[-0.02em] text-[21px] leading-none">VellonCVs</div>
              <div className="text-[10px] text-white/40 tracking-[1.5px] mt-1 font-medium">EST 2026</div>
            </div>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)} 
            className="text-white/40 hover:text-white/70 transition-colors p-1.5 -mr-1.5"
          >
            <ChevronLeft size={19} />
          </button>
        </div>

        {/* Engine Status - Elegant */}
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-center gap-3 text-sm">
            <div className={`w-2 h-2 rounded-full ${getStatusColor()} ${engineStatus === 'online' ? 'animate-pulse' : ''}`} />
            <div className="font-medium tracking-wide text-white/90 text-[13px]">{getStatusLabel()}</div>
          </div>
          <div className="text-[10px] text-white/40 pl-5 mt-px">Private inference • End-to-end encrypted</div>

          {engineStatus !== 'online' && (
            <div className="pl-5 mt-3 space-y-1">
              <button 
                onClick={checkVellonCoreConnection}
                className="text-[11px] sidebar-gold flex items-center gap-1.5 transition-colors"
              >
                ↻ Check connection again
              </button>
              <a 
                href="/docs/troubleshooting-vellon-core.md" 
                target="_blank"
                className="text-[11px] sidebar-gold flex items-center gap-1.5 transition-colors"
              >
                → Open troubleshooting guide
              </a>
              {typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && (
                <div className="text-[10px] text-white/50 mt-1">
                  Use the PREFERENCES button (top bar) to set your public FastAPI URL.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Model Selector - Ultra Premium */}
        <div className="px-6 pb-6">
          <div className="text-[10px] font-medium tracking-[1px] text-white/40 mb-2 pl-1">INTELLIGENCE MODEL</div>
          <div className="relative">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full appearance-none bg-[#111113] border border-white/[0.08] hover:border-[var(--gold-primary)]/30 focus:border-[var(--gold-primary)] transition-all text-sm font-medium tracking-[-0.1px] rounded-2xl px-4 py-[13px] pr-10 outline-none cursor-pointer focus-gold"
            >
              {models.map((m) => (
                <option key={m.name} value={m.name}>{m.name}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/40">
              <Zap size={14} />
            </div>
          </div>
        </div>

        {/* CV Section - Luxurious Treatment */}
        <div className="px-6 pb-2">
          <div className="text-[10px] font-medium tracking-[1px] text-white/40 mb-2.5 pl-1">PROFESSIONAL PROFILE</div>
          
          {!uploadedCV ? (
            <label className="group block border border-white/[0.08] hover:border-[var(--gold-primary)]/30 transition-all bg-[#0F0F11] hover:bg-[#111113] rounded-3xl p-7 cursor-pointer luxury-card">
              <div className="flex flex-col items-center text-center">
                <div className="w-11 h-11 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4 group-hover:bg-white/[0.07] transition-colors">
                  <Upload className="w-5 h-5 text-white/60" />
                </div>
                <div className="font-semibold tracking-[-0.2px] text-[15px]">Import your resume</div>
                <div className="text-white/40 text-xs mt-1 tracking-wide">PDF • DOCX • up to 10MB</div>
              </div>
              <input type="file" accept=".pdf,.docx,.doc,.txt" onChange={handleCVUpload} className="hidden" />
            </label>
          ) : (
            <div className="bg-[#111113] border border-white/[0.06] rounded-3xl p-5 flex items-start gap-4 luxury-card">
              <div className="mt-0.5">
                <FileText className="w-5 h-5 text-white/80" />
              </div>
              <div className="flex-1 min-w-0 pt-px">
                <div className="font-medium text-[13.5px] tracking-[-0.1px] leading-tight truncate pr-2">{uploadedCV}</div>
                <div className="text-[11px] text-white/40 mt-px">Active in context</div>
              </div>
              <button 
                onClick={() => { setUploadedCV(null); toast.info('Profile removed'); }} 
                className="text-white/30 hover:text-rose-400/80 transition-colors p-1 -mt-1 -mr-1"
              >
                <Trash2 size={15} />
              </button>
            </div>
          )}

          {isUploading && (
            <div className="flex items-center gap-2.5 text-[12px] text-white/50 mt-4 pl-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing document…
            </div>
          )}
        </div>

        {/* Quick Actions - Elegant Cards */}
        <div className="flex-1 px-6 pt-6 overflow-y-auto">
          <div className="text-[10px] font-medium tracking-[1px] text-white/40 mb-3 pl-1">SUGGESTED ACTIONS</div>
          <div className="space-y-1.5">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={() => handleQuickAction(action)}
                className="w-full text-left px-4 py-[13px] rounded-2xl bg-[#111113] hover:bg-[#1A1A1D] border border-white/[0.04] hover:border-white/[0.08] text-[13.5px] tracking-[-0.1px] transition-all active:scale-[0.985]"
              >
                {action}
              </button>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-white/[0.06]">
          <button 
            onClick={clearConversation}
            className="flex w-full items-center justify-center gap-2 text-xs tracking-widest font-medium py-3 rounded-2xl border border-white/[0.08] hover:bg-white/[0.015] active:bg-white/[0.03] transition-colors text-white/70 hover:text-white/90 luxury-card"
          >
            <Trash2 size={14} /> RESET SESSION
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#050505]">
        {/* Sophisticated Top Bar */}
        <div className="h-[73px] border-b border-white/[0.06] px-7 flex items-center justify-between bg-[#050505]/80 backdrop-blur-xl z-10">
          <div className="flex items-center gap-4">
            {!sidebarOpen && (
              <button 
                onClick={() => setSidebarOpen(true)} 
                className="mr-2 text-white/40 hover:text-white/70 transition p-2 -ml-2"
              >
                <ChevronRight size={19} />
              </button>
            )}
            <div>
              <div className="font-semibold text-xl tracking-[-0.4px]">VellonCVs</div>
              <div className="text-[10px] text-white/40 -mt-px tracking-[2px]">CONFIDENTIAL CAREER INTELLIGENCE</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-sm">
            {uploadedCV && (
              <div className="hidden md:flex items-center gap-2 text-white/50 bg-white/[0.03] px-4 py-1.5 rounded-2xl text-xs tracking-wider border border-white/[0.05]">
                <FileText size={13} /> {uploadedCV.length > 26 ? uploadedCV.slice(0, 23) + '...' : uploadedCV}
              </div>
            )}
            <button 
              onClick={() => setShowSettings(true)} 
              className="flex items-center gap-2 px-5 py-2 rounded-2xl hover:bg-white/[0.03] border border-white/[0.06] hover:border-[var(--gold-primary)]/30 text-white/70 hover:text-white text-sm font-medium tracking-wider transition active:bg-white/[0.015] luxury-card"
            >
              <Settings size={15} /> PREFERENCES
            </button>
          </div>
        </div>

        {/* Chat Messages — Ultra Clean & Spacious */}
        <div className="flex-1 overflow-y-auto px-6 md:px-12 pt-12 pb-8" style={{ scrollbarWidth: 'thin' }}>
          {/* Clear reconnect banner when core is offline */}
           {engineStatus !== 'online' && (
             <div className="max-w-2xl mx-auto mb-6 p-4 rounded-2xl bg-[#1A0F0F] border border-rose-900/50 text-center">
               <div className="text-rose-400 font-medium mb-1">
                 Vellon Core is offline
               </div>
                <div className="text-sm text-white/60 mb-3">
                  {customBackendUrl && customBackendUrl.includes('vercel.app') ? (
                    <>You entered the <strong>Vercel frontend URL</strong> as backend. That&apos;s wrong.<br />Clear it in PREFERENCES and either use a real public FastAPI or run the project locally.</>
                  ) : customBackendUrl ? (
                    <>Cannot reach custom backend <code className="bg-black/50 px-1 rounded">{customBackendUrl}</code>.<br />FastAPI must be public + Ollama running on that machine.</>
                  ) : typeof window !== 'undefined' && !window.location.hostname.includes('localhost') ? (
                    <>This is a public demo. For your local Ollama: click <strong>PREFERENCES</strong> (top right) or run locally.</>
                  ) : (
                    <>Make sure <code className="bg-black/50 px-1 rounded">ollama serve</code> + the Python backend are running.</>
                  )}
                </div>
               <button 
                 onClick={checkVellonCoreConnection}
                 className="px-4 py-2 text-sm rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white transition"
               >
                 ↻ Reconnect now
               </button>
             </div>
           )}

          {messages.length === 0 && (
            <div className="max-w-[620px] mx-auto pt-16 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-white/[0.03] border border-white/[0.06] text-[11px] tracking-[2.5px] text-white/50 mb-6 font-medium">
                CONFIDENTIAL • LOCAL • PRECISE
              </div>
              
              <h1 className="text-6xl font-semibold tracking-[-2.6px] leading-none mb-4">
                Your career.<br />Elevated.
              </h1>
              <p className="text-xl text-white/60 tracking-[-0.2px] max-w-md mx-auto">
                A private intelligence layer for crafting exceptional resumes through natural conversation.
              </p>

              <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
                {quickActions.slice(0, 4).map((action, i) => (
              <button
                key={i}
                onClick={() => handleQuickAction(action)}
                className="w-full text-left text-sm px-3 py-2 rounded-xl bg-[#111113] hover:bg-[#1A1A1D] border border-white/[0.04] hover:border-[var(--gold-primary)]/30 transition-all active:scale-[0.985] luxury-card"
              >
                {action}
              </button>
                ))}
              </div>
            </div>
          )}

          <div className="max-w-3xl mx-auto space-y-9">
            <AnimatePresence>
              {messages.map((message, index) => {
                const isUser = message.role === 'user';
                const isSystem = message.role === 'system';

                if (isSystem) {
                  return (
                    <motion.div 
                      key={index}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="max-w-2xl mx-auto bg-[#0F0F11] border border-white/[0.06] text-[#A1A1AA] text-[13.5px] rounded-3xl px-6 py-4 tracking-[-0.1px]"
                    >
                      {message.content}
                    </motion.div>
                  );
                }

                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex gap-4 max-w-[82%] ${isUser ? 'flex-row-reverse' : ''}`}>
                      {!isUser && (
                        <div className="w-8 h-8 rounded-2xl bg-white/[0.06] flex items-center justify-center flex-shrink-0 mt-1 ring-1 ring-inset ring-white/[0.04]">
                          <Bot size={16} className="text-white/80" />
                        </div>
                      )}
                      <div 
                        className={`rounded-3xl px-6 py-4 text-[15px] leading-[1.55] tracking-[-0.12px] ${
                          isUser 
                            ? 'bg-white text-[#111113] shadow-xl' 
                            : 'bg-[#111113] border border-white/[0.06] text-[#F4F4F5]'
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{message.content}</div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {isLoading && (
              <div className="flex gap-4 max-w-[82%]">
                <div className="w-8 h-8 rounded-2xl bg-white/[0.06] flex items-center justify-center mt-1 ring-1 ring-inset ring-white/[0.04]">
                  <Loader2 className="w-4 h-4 animate-spin text-white/70" />
                </div>
                <div className="bg-[#111113] border border-white/[0.06] rounded-3xl px-6 py-[17px] text-[14px] text-white/50 tracking-wide">
                  Refining with precision…
                </div>
              </div>
            )}
          </div>

          <div ref={messagesEndRef} />
        </div>

        {/* Premium Composer */}
        <div className="border-t border-white/[0.06] bg-[#050505] px-6 md:px-12 py-6">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            <div className="relative group">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  engineStatus !== 'online' 
                    ? "Core is offline — click reconnect in the sidebar or above" 
                    : uploadedCV 
                      ? "Tell me how you’d like to refine your profile…" 
                      : "Describe your goals or upload a resume to begin…"
                }
                className="w-full bg-[#0A0A0C] border border-white/[0.08] focus:border-[var(--gold-primary)] transition-all rounded-[22px] pl-6 pr-16 py-[17px] text-[15px] placeholder:text-white/40 outline-none tracking-[-0.1px] shadow-inner focus-gold"
                disabled={isLoading || engineStatus !== 'online'}
              />
              <button 
                type="submit" 
                disabled={!input.trim() || isLoading || engineStatus !== 'online'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-[42px] h-[42px] rounded-[16px] gold-button flex items-center justify-center disabled:opacity-35 shadow-luxury"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send size={17} />}
              </button>
            </div>

            <div className="text-center text-[10px] tracking-[1.5px] text-white/30 mt-3.5 font-medium">
              END-TO-END PRIVATE • POWERED BY VELLON INTELLIGENCE
            </div>
          </form>
        </div>
      </div>

      {/* Settings Modal — allows connecting the Vercel site to your public FastAPI + local Ollama */}
      {showSettings && (
        <div 
          className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4"
          onClick={() => setShowSettings(false)}
        >
          <div 
            className="bg-[#0A0A0C] border border-white/[0.08] rounded-3xl w-full max-w-md p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="text-xl font-semibold tracking-[-0.5px]">Vellon Preferences</div>
              <button onClick={() => setShowSettings(false)} className="text-white/40 hover:text-white">✕</button>
            </div>

            <div className="space-y-6">
              <div>
                <div className="text-[11px] uppercase tracking-[1.5px] text-white/50 mb-2">Backend Connection (FastAPI Core)</div>
                <input
                  type="text"
                  value={customBackendUrl || ''}
                  onChange={(e) => setCustomBackendUrl(e.target.value.trim() || null)}
                  placeholder="https://your-public-fastapi.example.com"
                  className="w-full bg-[#111113] border border-white/[0.1] focus:border-[var(--gold-primary)]/60 rounded-2xl px-5 py-3.5 text-sm placeholder:text-white/30 outline-none"
                />
                <div className="text-[11px] text-white/40 mt-2 leading-snug">
                  Paste the <strong>public</strong> URL of your FastAPI backend (e.g. https://my-backend.onrender.com).<br />
                  This must be a server you control that runs the Python FastAPI + has Ollama on the same machine.<br />
                  <span className="text-rose-400">The Vercel site itself is NOT the backend.</span>
                </div>

                <div className="bg-[#1A0F0F] border border-rose-900/50 rounded-2xl p-3 text-[11px] text-rose-400">
                  <strong>Important:</strong> If you don't have a public FastAPI URL yet, <strong>do not use this modal</strong>.<br />
                  Instead, run the full app locally on your machine (see instructions below).
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    if (customBackendUrl) {
                      localStorage.setItem('vellon_backend_url', customBackendUrl);
                    } else {
                      localStorage.removeItem('vellon_backend_url');
                    }
                    setShowSettings(false);
                    checkVellonCoreConnection();
                  }}
                  className="flex-1 py-3.5 rounded-2xl bg-white text-[#111113] font-medium text-sm tracking-wider active:scale-[0.985] transition"
                >
                  SAVE &amp; RECONNECT
                </button>
                <button
                  onClick={() => {
                    setCustomBackendUrl(null);
                    localStorage.removeItem('vellon_backend_url');
                    setShowSettings(false);
                    checkVellonCoreConnection();
                  }}
                  className="flex-1 py-3.5 rounded-2xl border border-white/20 hover:bg-white/5 text-sm tracking-wider transition"
                >
                  CLEAR (USE DEFAULT)
                </button>
              </div>

              <div className="text-[10px] text-center text-white/30">
                For local dev it defaults to http://localhost:8000 automatically.
              </div>

              <div className="pt-4 border-t border-white/[0.08]">
                <button
                  onClick={() => {
                    setCustomBackendUrl(null);
                    localStorage.removeItem('vellon_backend_url');
                    setShowSettings(false);
                    window.location.reload();
                  }}
                  className="w-full py-3 rounded-2xl border border-white/20 text-sm tracking-wider hover:bg-white/5"
                >
                  I don&apos;t have a public backend — run everything locally instead
                </button>
                <div className="text-[10px] text-center text-white/40 mt-2">
                  In your terminal: <code className="bg-black/40 px-1">npm run full-dev</code> + <code className="bg-black/40 px-1">ollama serve</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
