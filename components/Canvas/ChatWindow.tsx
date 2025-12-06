import React, { useState, useRef, useEffect } from 'react';
import { Send, MoreHorizontal, X, GitBranch, Layers, Palette, User, Bot, Loader2, ArrowUpToLine, ArrowDownToLine, ChevronUp, ChevronDown, Trash2, BrainCircuit, Edit2, Sparkles, Image as ImageIcon, Brain, Check, MessageSquare, CornerUpLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CanvasNode, ChatMessage, ThemeOption, ChatMode } from '../../types';
import { streamChatResponse } from '../../services/geminiService';
import { SYSTEM_PROMPTS, CHAT_MODES, CHAT_MODELS } from '../../constants';

interface ChatWindowProps {
  node: CanvasNode;
  scale: number;
  updateNode: (id: string, updates: Partial<CanvasNode>) => void;
  removeNode: (id: string) => void;
  onFocus: () => void;
  onBranch: (nodeId: string, msgIndex: number) => void;
  layerControls: {
    bringToFront: () => void;
    sendToBack: () => void;
    bringForward: () => void;
    sendBackward: () => void;
  };
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onJumpToParent: () => void;
}

const THEMES = {
  'black': 'bg-black border-slate-800 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)]',
  'dark-gray': 'bg-[#1e1f20] border-[#444746] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)]',
  'light': 'bg-white border-gray-200 text-slate-800 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)]'
};

const MODE_ICONS = {
  'standard': Sparkles,
  'thinking': Brain,
  'image': ImageIcon
};

const ChatWindow: React.FC<ChatWindowProps> = ({ node, scale, updateNode, removeNode, onFocus, onBranch, layerControls, onMouseEnter, onMouseLeave, onJumpToParent }) => {
  const [input, setInput] = useState('');
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(node.title);
  
  const windowRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dimsStartRef = useRef({ w: 0, h: 0 });

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // If within 100px of the bottom, consider it "stuck" to bottom
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    isNearBottomRef.current = distanceToBottom < 100;
  };

  // Smart Auto-Scroll
  useEffect(() => {
    const lastMessage = node.messages[node.messages.length - 1];
    if (!lastMessage) return;

    // 1. Always scroll to bottom if the last message is from the user (to show their input)
    if (lastMessage.role === 'user') {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        isNearBottomRef.current = true;
    } 
    // 2. If receiving AI response (streaming), only scroll if user was already at the bottom
    else if (isNearBottomRef.current) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [node.messages]);

  // --- Parsing Suggestions (Guided Learning) ---
  const getDisplayContent = (text: string) => {
    return text.replace(/<suggestions>[\s\S]*?<\/suggestions>/, '').trim();
  };

  const getSuggestions = (text: string): string[] => {
    const match = text.match(/<suggestions>(.*?)<\/suggestions>/s);
    if (!match) return [];
    try {
        return JSON.parse(match[1]);
    } catch {
        return [];
    }
  };

  // --- Drag & Resize Logic ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.no-drag')) return;
    e.stopPropagation();
    onFocus();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    dimsStartRef.current = { w: node.x, h: node.y };
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    dimsStartRef.current = { w: node.width, h: node.height };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Use the passed scale prop instead of reading DOM
      if (isDragging) {
        const dx = (e.clientX - dragStartRef.current.x) / scale;
        const dy = (e.clientY - dragStartRef.current.y) / scale;
        updateNode(node.id, { x: dimsStartRef.current.w + dx, y: dimsStartRef.current.h + dy });
      }
      if (isResizing) {
        const dx = (e.clientX - dragStartRef.current.x) / scale;
        const dy = (e.clientY - dragStartRef.current.y) / scale;
        updateNode(node.id, { width: Math.max(350, dimsStartRef.current.w + dx), height: Math.max(450, dimsStartRef.current.h + dy) });
      }
    };
    const handleMouseUp = () => { setIsDragging(false); setIsResizing(false); };
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, node.id, scale, updateNode]);

  const handleSend = async (msgText: string = input) => {
    if (!msgText.trim() || isLoading) return;
    
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: msgText, timestamp: Date.now() };
    const newMessages = [...node.messages, userMsg];
    updateNode(node.id, { messages: newMessages });
    setInput('');
    setIsLoading(true);

    const botMsgId = (Date.now() + 1).toString();
    const botMsgPlaceholder: ChatMessage = { id: botMsgId, role: 'model', text: '', timestamp: Date.now() };
    updateNode(node.id, { messages: [...newMessages, botMsgPlaceholder] });

    try {
        const history = newMessages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
        const systemPrompt = node.isGuidedLearning ? SYSTEM_PROMPTS.GUIDED : SYSTEM_PROMPTS.STANDARD;
        
        let accumulated = '';
        let accumulatedImages: string[] = [];

        await streamChatResponse(
            history, 
            userMsg.text, 
            node.chatMode, 
            node.selectedModel, // Pass the explicit model override if selected
            systemPrompt, 
            [], 
            (chunk, image) => {
                if (chunk) accumulated += chunk;
                if (image) accumulatedImages.push(image);
                
                updateNode(node.id, { 
                  messages: [...newMessages, { 
                    ...botMsgPlaceholder, 
                    text: accumulated,
                    images: accumulatedImages.length > 0 ? accumulatedImages : undefined
                  }] 
                });
            }
        );
    } catch (e) {
        updateNode(node.id, { messages: [...newMessages, { ...botMsgPlaceholder, text: "Error generating response.", isError: true }] });
    } finally {
        setIsLoading(false);
    }
  };

  const handleTitleSubmit = () => {
      if(tempTitle.trim()) {
          updateNode(node.id, { title: tempTitle });
      }
      setIsEditingTitle(false);
  };

  const currentThemeClass = THEMES[node.theme];
  const isLight = node.theme === 'light';
  const CurrentModeIcon = MODE_ICONS[node.chatMode] || Sparkles;

  return (
    <div
      ref={windowRef}
      className={`absolute flex flex-col rounded-3xl border overflow-visible ${currentThemeClass} ${isDragging || isResizing ? 'select-none cursor-grabbing' : ''}`}
      style={{
        left: node.x, top: node.y, width: node.width, height: node.height, zIndex: node.zIndex,
        // CRITICAL: Only transition theme colors, NOT geometry (left/top/width/height) for smooth dragging
        transitionProperty: 'background-color, border-color, box-shadow, color',
        transitionDuration: '200ms'
      }}
      onMouseDown={handleMouseDown}
      onClick={onFocus}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Minimal Header */}
      <div className={`h-16 flex items-center justify-between px-5 cursor-grab active:cursor-grabbing border-b ${
          isLight ? 'border-transparent' : 'border-white/5'
      }`}>
         <div className="flex flex-col no-drag flex-1 mr-4">
            {isEditingTitle ? (
                <input 
                    type="text" 
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    onBlur={handleTitleSubmit}
                    onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
                    autoFocus
                    className={`text-sm font-semibold bg-transparent border-b focus:outline-none ${isLight ? 'text-gray-900 border-blue-500' : 'text-gray-100 border-blue-500'}`}
                />
            ) : (
                <div 
                    onDoubleClick={() => { setTempTitle(node.title); setIsEditingTitle(true); }}
                    className="cursor-text flex items-center gap-2 group/title"
                >
                    <span className={`text-sm font-semibold block ${isLight ? 'text-gray-800' : 'text-gray-200'}`}>{node.title}</span>
                    {node.parentId && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onJumpToParent(); }}
                            className="opacity-0 group-hover/title:opacity-100 transition-opacity p-1 rounded hover:bg-white/10"
                            title="Go to parent"
                        >
                            <CornerUpLeft size={12} className={isLight ? 'text-gray-400' : 'text-gray-500'} />
                        </button>
                    )}
                </div>
            )}
         </div>
         
         <div className="flex items-center gap-2 no-drag">
             {/* Mode Selector Pill */}
             <div className={`flex items-center rounded-full px-1 py-1 ${
                 isLight ? 'bg-gray-100' : 'bg-[#2b2c2e]'
             }`}>
                {Object.values(CHAT_MODES).map((mode) => {
                    const Icon = MODE_ICONS[mode.id as ChatMode];
                    const isActive = node.chatMode === mode.id;
                    return (
                        <button
                            key={mode.id}
                            onClick={() => updateNode(node.id, { chatMode: mode.id as ChatMode })}
                            className={`p-1.5 rounded-full transition-all ${
                                isActive 
                                ? (isLight ? 'bg-white shadow-sm text-blue-600' : 'bg-[#444746] text-cyan-200') 
                                : (isLight ? 'text-gray-400 hover:text-gray-600' : 'text-gray-500 hover:text-gray-300')
                            }`}
                            title={mode.label}
                        >
                            <Icon size={14} strokeWidth={2.5} />
                        </button>
                    );
                })}
             </div>

             {/* Menu Toggle */}
             <button 
                onClick={() => setShowMenu(!showMenu)} 
                className={`p-2 rounded-full transition-colors relative ${isLight ? 'hover:bg-gray-100 text-gray-400' : 'hover:bg-white/10 text-gray-500'}`}
             >
                 <MoreHorizontal size={18} />
                 {showMenu && (
                     <div className={`absolute top-full right-0 mt-2 w-64 rounded-2xl shadow-xl border overflow-hidden py-2 z-50 ${isLight ? 'bg-white border-gray-100 text-gray-700' : 'bg-[#1e1f20] border-[#444746] text-gray-200'}`}>
                         
                         {/* Model Selection Dropdown */}
                         <div className="px-4 py-2">
                             <span className="text-xs font-bold opacity-50 uppercase tracking-wider block mb-2">Model</span>
                             <div className="space-y-1">
                                 {CHAT_MODELS.map(m => (
                                     <button
                                        key={m.id}
                                        onClick={() => updateNode(node.id, { selectedModel: m.id })}
                                        className={`w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between ${
                                            (node.selectedModel === m.id || (!node.selectedModel && node.chatMode === 'standard' && m.id === CHAT_MODES.STANDARD.model)) 
                                            ? (isLight ? 'bg-blue-50 text-blue-600' : 'bg-cyan-500/10 text-cyan-400') 
                                            : (isLight ? 'hover:bg-gray-50' : 'hover:bg-white/5')
                                        }`}
                                     >
                                         {m.name}
                                         {(node.selectedModel === m.id || (!node.selectedModel && node.chatMode === 'standard' && m.id === CHAT_MODES.STANDARD.model)) && <Check size={12} />}
                                     </button>
                                 ))}
                             </div>
                         </div>

                         {/* Guided Learning Toggle */}
                         <div className="px-4 py-2 border-t border-gray-200/10">
                            <button 
                                onClick={() => updateNode(node.id, { isGuidedLearning: !node.isGuidedLearning })}
                                className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-gray-50' : 'hover:bg-white/5'}`}
                            >
                                <span className="flex items-center gap-2 text-sm">
                                    <BrainCircuit size={16} className="opacity-70" />
                                    Guided Learning
                                </span>
                                <div className={`w-8 h-4 rounded-full relative transition-colors ${node.isGuidedLearning ? 'bg-cyan-500' : 'bg-gray-500/50'}`}>
                                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${node.isGuidedLearning ? 'left-4.5' : 'left-0.5'}`}></div>
                                </div>
                            </button>
                         </div>

                         <div className="px-4 py-2 text-xs font-bold opacity-50 uppercase tracking-wider border-t border-gray-200/10 mt-2">Window Controls</div>
                         <div className="p-1">
                            <button onClick={() => { layerControls.bringToFront(); setShowMenu(false); }} className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center gap-3 ${isLight ? 'hover:bg-gray-50' : 'hover:bg-white/5'}`}>
                                <ArrowUpToLine size={16} className="opacity-70" /> Bring to Front
                            </button>
                            <button onClick={() => { layerControls.sendToBack(); setShowMenu(false); }} className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center gap-3 ${isLight ? 'hover:bg-gray-50' : 'hover:bg-white/5'}`}>
                                <ArrowDownToLine size={16} className="opacity-70" /> Send to Back
                            </button>
                         </div>
                         
                         <div className="px-4 py-2 text-xs font-bold opacity-50 uppercase tracking-wider mt-2 border-t border-gray-200/10">Theme</div>
                         <div className="flex px-4 py-2 gap-3">
                             <button onClick={() => updateNode(node.id, { theme: 'black' })} className="w-8 h-8 rounded-full bg-black border border-gray-700 ring-offset-2 hover:scale-110 transition-transform" title="Black"></button>
                             <button onClick={() => updateNode(node.id, { theme: 'dark-gray' })} className="w-8 h-8 rounded-full bg-[#1e1f20] border border-gray-600 ring-offset-2 hover:scale-110 transition-transform" title="Dark Gray"></button>
                             <button onClick={() => updateNode(node.id, { theme: 'light' })} className="w-8 h-8 rounded-full bg-white border border-gray-300 ring-offset-2 hover:scale-110 transition-transform" title="Light"></button>
                         </div>

                         <div className="p-1 mt-2 border-t border-gray-200/10">
                            <button onClick={() => removeNode(node.id)} className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center gap-3 text-red-500 ${isLight ? 'hover:bg-red-50' : 'hover:bg-red-500/10'}`}>
                                <Trash2 size={16} /> Delete Window
                            </button>
                         </div>
                     </div>
                 )}
             </button>
         </div>
      </div>

      {/* Messages Area - Minimalist */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto px-4 py-4 space-y-6 custom-scrollbar no-drag ${isLight ? 'bg-white' : 'bg-[#1e1f20]'}`}
        onWheel={(e) => e.stopPropagation()}
      >
         {node.messages.length === 0 && (
             <div className="h-full flex flex-col items-center justify-center opacity-30 select-none">
                 <CurrentModeIcon size={48} className="mb-4" />
                 <p className="text-sm font-medium">
                     {node.chatMode === 'image' ? 'Describe an image to generate' : 'Start your conversation'}
                 </p>
             </div>
         )}

         {node.messages.map((msg, idx) => (
             <div key={msg.id} id={`msg-${node.id}-${msg.id}`} className={`group relative flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                 
                 {/* Message Content */}
                 <div className={`relative max-w-[90%] ${msg.role === 'model' ? 'w-full' : ''}`}>
                     
                     {msg.role === 'user' ? (
                         // User Bubble: Rounded Pill
                         <div className={`px-5 py-3 rounded-[2rem] rounded-tr-sm text-sm leading-relaxed ${
                             isLight 
                             ? 'bg-[#f0f4f9] text-[#1f1f1f]' 
                             : 'bg-[#2f3031] text-gray-100'
                         }`}>
                             {msg.text}
                         </div>
                     ) : (
                         // AI Content: Clean Text + Images
                         <div className={`text-sm leading-relaxed ${isLight ? 'text-[#374151]' : 'text-gray-200'}`}>
                             {/* Generated Images */}
                             {msg.images && msg.images.map((img, i) => (
                                 <div key={i} className="mb-4 rounded-xl overflow-hidden border border-white/10 shadow-lg">
                                     <img src={img} alt="Generated" className="w-full h-auto" />
                                 </div>
                             ))}

                             {/* Text */}
                             {msg.text && (
                                <ReactMarkdown 
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        code({node, inline, className, children, ...props}: any) {
                                            const match = /language-(\w+)/.exec(className || '')
                                            return !inline ? (
                                                <div className="bg-[#1e1f20] border border-white/10 rounded-lg p-3 my-3 overflow-x-auto">
                                                    <code {...props} className="text-xs font-mono text-blue-300">
                                                        {children}
                                                    </code>
                                                </div>
                                            ) : (
                                                <code {...props} className="bg-black/20 px-1.5 py-0.5 rounded text-xs font-mono">
                                                    {children}
                                                </code>
                                            )
                                        },
                                        p: ({children}) => <p className="mb-3 last:mb-0">{children}</p>,
                                        ul: ({children}) => <ul className="list-disc ml-5 mb-3 space-y-1">{children}</ul>,
                                        li: ({children}) => <li>{children}</li>
                                    }}
                                >
                                    {getDisplayContent(msg.text)}
                                </ReactMarkdown>
                             )}
                         </div>
                     )}

                     {/* Suggestions & Branching (Model Only) */}
                     {msg.role === 'model' && !msg.isError && (
                         <div className="mt-3 pl-1">
                             {/* Guided Learning Chips */}
                             {!isLoading && idx === node.messages.length - 1 && getSuggestions(msg.text).length > 0 && node.isGuidedLearning && (
                                 <div className="flex flex-wrap gap-2 mb-3">
                                     {getSuggestions(msg.text).map((suggestion, i) => (
                                         <button 
                                            key={i}
                                            onClick={() => handleSend(suggestion)}
                                            className={`text-xs px-4 py-2 rounded-xl transition-all text-left flex items-center gap-2 ${
                                                isLight 
                                                ? 'bg-[#f0f4f9] hover:bg-[#dfe4ea] text-[#444746]' 
                                                : 'bg-[#2f3031] hover:bg-[#3c4043] text-gray-300'
                                            }`}
                                         >
                                             <Sparkles size={12} className="opacity-50" />
                                             {suggestion}
                                         </button>
                                     ))}
                                 </div>
                             )}

                             {/* Branch Button */}
                             <button
                                onClick={(e) => { e.stopPropagation(); onBranch(node.id, idx); }}
                                className={`flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors opacity-0 group-hover:opacity-100 ${
                                    isLight 
                                    ? 'text-gray-400 hover:text-blue-600' 
                                    : 'text-gray-600 hover:text-cyan-400'
                                }`}
                            >
                                <GitBranch size={12} />
                                Branch Context
                            </button>
                         </div>
                     )}
                 </div>
             </div>
         ))}
         {isLoading && (
             <div className="flex items-start gap-3 animate-pulse">
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                     node.chatMode === 'thinking' 
                     ? 'bg-purple-500/20 text-purple-400' 
                     : (isLight ? 'bg-blue-100 text-blue-600' : 'bg-cyan-500/20 text-cyan-400')
                 }`}>
                     {node.chatMode === 'thinking' ? <Brain size={16} /> : <Loader2 size={16} className="animate-spin" />}
                 </div>
                 <span className="text-xs font-medium opacity-50 mt-2">
                     {node.chatMode === 'thinking' ? 'Reasoning...' : (node.chatMode === 'image' ? 'Creating...' : 'Gemini is thinking...')}
                 </span>
             </div>
         )}
         <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Floating Pill */}
      <div className={`p-4 no-drag relative z-10 ${isLight ? 'bg-white' : 'bg-[#1e1f20]'}`}>
          <div className={`flex items-center gap-3 px-4 py-3 rounded-full transition-all ${
              isLight 
              ? 'bg-[#f0f4f9] hover:bg-[#e9eef6] focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100' 
              : 'bg-[#2f3031] hover:bg-[#37393b] focus-within:bg-[#1e1f20] focus-within:ring-1 focus-within:ring-gray-600'
          }`}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={
                    node.chatMode === 'image' 
                    ? "Describe image to generate..." 
                    : (node.chatMode === 'thinking' ? "Ask a complex question..." : "Message Gemini...")
                }
                className={`flex-1 bg-transparent outline-none text-sm ${isLight ? 'text-gray-800 placeholder-gray-500' : 'text-gray-100 placeholder-gray-500'}`}
              />
              <button 
                onClick={() => handleSend()}
                disabled={isLoading || !input.trim()}
                className={`p-2 rounded-full transition-all ${
                    input.trim() 
                    ? (isLight ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white text-black hover:bg-gray-200') 
                    : 'bg-transparent text-gray-400 cursor-default'
                }`}
              >
                  <Send size={16} />
              </button>
          </div>
      </div>

      {/* Resize Handle */}
      <div 
        onMouseDown={handleResizeStart}
        className="absolute bottom-1 right-1 w-6 h-6 cursor-se-resize flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity no-drag"
      >
          <div className={`w-2 h-2 rounded-full ${isLight ? 'bg-gray-400' : 'bg-gray-600'}`}></div>
      </div>
    </div>
  );
};

export default ChatWindow;