
import React, { useState, useRef, useEffect } from 'react';
import { Send, MoreHorizontal, X, GitBranch, Layers, Palette, User, Bot, Loader2, ArrowUpToLine, ArrowDownToLine, ChevronUp, ChevronDown, Trash2, BrainCircuit, Edit2, Sparkles, Image as ImageIcon, Brain, Check, MessageSquare, CornerUpLeft, Paperclip, FileText, File as FileIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CanvasNode, ChatMessage, ThemeOption, ChatMode, Attachment } from '../../types';
import { streamChatResponse } from '../../services/geminiService';
import { SYSTEM_PROMPTS, CHAT_MODES, CHAT_MODELS } from '../../constants';
import { blobToBase64 } from '../../utils/audioUtils';

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
  
  // File Upload State
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const windowRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dimsStartRef = useRef({ w: 0, h: 0 });

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    isNearBottomRef.current = distanceToBottom < 100;
  };

  useEffect(() => {
    const lastMessage = node.messages[node.messages.length - 1];
    if (!lastMessage) return;

    if (lastMessage.role === 'user') {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        isNearBottomRef.current = true;
    } 
    else if (isNearBottomRef.current) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [node.messages]);

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
    onFocus(); 
    setIsResizing(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    dimsStartRef.current = { w: node.width, h: node.height }; 
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = (e.clientX - dragStartRef.current.x) / scale;
        const dy = (e.clientY - dragStartRef.current.y) / scale;
        updateNode(node.id, { x: dimsStartRef.current.w + dx, y: dimsStartRef.current.h + dy });
      }
      if (isResizing) {
        const dx = (e.clientX - dragStartRef.current.x) / scale;
        const dy = (e.clientY - dragStartRef.current.y) / scale;
        
        const newWidth = Math.max(350, dimsStartRef.current.w + dx);
        const newHeight = Math.max(450, dimsStartRef.current.h + dy);

        updateNode(node.id, { width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => { 
        setIsDragging(false); 
        setIsResizing(false); 
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, node.id, scale, updateNode]);

  // --- File Handling ---

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          processFiles(Array.from(e.target.files));
      }
      // Reset input so same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processFiles = async (files: File[]) => {
      const newAttachments: Attachment[] = [];
      
      for (const file of files) {
          try {
              const base64Raw = await blobToBase64(file);
              const url = URL.createObjectURL(file);
              const type = file.type.startsWith('image/') ? 'image' : 'file';
              
              newAttachments.push({
                  type,
                  mimeType: file.type,
                  data: base64Raw,
                  name: file.name,
                  url
              });
          } catch (err) {
              console.error("Error processing file", file.name, err);
          }
      }
      setPendingAttachments(prev => [...prev, ...newAttachments]);
  };

  const removeAttachment = (index: number) => {
      setPendingAttachments(prev => {
          const newAtt = [...prev];
          URL.revokeObjectURL(newAtt[index].url || '');
          newAtt.splice(index, 1);
          return newAtt;
      });
  };

  const handleSend = async (msgText: string = input) => {
    if ((!msgText.trim() && pendingAttachments.length === 0) || isLoading) return;
    
    // Snapshot current attachments and clear pending
    const attachmentsToSend = [...pendingAttachments];
    setPendingAttachments([]);
    setInput('');

    const userMsg: ChatMessage = { 
        id: Date.now().toString(), 
        role: 'user', 
        text: msgText, 
        timestamp: Date.now(),
        attachments: attachmentsToSend 
    };

    const newMessages = [...node.messages, userMsg];
    updateNode(node.id, { messages: newMessages });
    setIsLoading(true);

    const botMsgId = (Date.now() + 1).toString();
    const botMsgPlaceholder: ChatMessage = { id: botMsgId, role: 'model', text: '', timestamp: Date.now() };
    updateNode(node.id, { messages: [...newMessages, botMsgPlaceholder] });

    try {
        const history = newMessages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
        const systemPrompt = node.isGuidedLearning ? SYSTEM_PROMPTS.GUIDED : SYSTEM_PROMPTS.STANDARD;
        
        let accumulated = '';
        
        await streamChatResponse(
            history, 
            userMsg.text, 
            node.chatMode, 
            node.selectedModel, 
            systemPrompt, 
            attachmentsToSend, 
            (chunk, image) => {
                if (chunk) accumulated += chunk;
                // If image generated (e.g. from inline tool), we could handle it here. 
                // Currently services/geminiService chunks image separately as "image" arg.
                
                updateNode(node.id, { 
                  messages: [...newMessages, { 
                    ...botMsgPlaceholder, 
                    text: accumulated,
                    // If the response includes generated images via inline data
                    attachments: image ? [{ type: 'image', mimeType: 'image/png', data: image.split(',')[1] || image, url: image }] : undefined
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
      className={`absolute flex flex-col rounded-3xl border overflow-visible pointer-events-auto ${currentThemeClass} ${isDragging ? 'select-none cursor-grabbing' : ''} ${isResizing ? 'select-none' : ''}`}
      style={{
        left: node.x, top: node.y, width: node.width, height: node.height, zIndex: node.zIndex,
        transitionProperty: (isDragging || isResizing) ? 'none' : 'background-color, border-color, box-shadow, color',
        transitionDuration: '200ms',
        willChange: (isDragging || isResizing) ? 'width, height, left, top' : 'auto'
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
                         
                         {/* Menu Content (Model, Guided Learning, Layers, Theme, Delete) */}
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

                         <div className="px-4 py-2 border-t border-gray-200/10">
                            <div className="flex items-center justify-between p-2">
                                <span className="flex items-center gap-2 text-sm opacity-90">
                                    <BrainCircuit size={16} className="opacity-70" />
                                    Guided Learning
                                </span>
                                <button 
                                    onClick={() => updateNode(node.id, { isGuidedLearning: !node.isGuidedLearning })}
                                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all border ${
                                        node.isGuidedLearning 
                                        ? (isLight ? 'bg-blue-600 text-white border-blue-600' : 'bg-cyan-500 text-white border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.3)]') 
                                        : (isLight ? 'bg-gray-100 text-gray-500 border-gray-200' : 'bg-white/5 text-gray-400 border-white/10')
                                    }`}
                                >
                                    {node.isGuidedLearning ? 'ON' : 'OFF'}
                                </button>
                            </div>
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

      {/* Messages Area */}
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
             <div key={msg.id} className={`group relative flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                 
                 <div className={`relative max-w-[90%] ${msg.role === 'model' ? 'w-full' : ''}`}>
                     
                     {msg.role === 'user' ? (
                         <div id={`msg-${node.id}-${msg.id}`} className={`px-5 py-3 rounded-[2rem] rounded-tr-sm text-sm leading-relaxed ${
                             isLight 
                             ? 'bg-[#f0f4f9] text-[#1f1f1f]' 
                             : 'bg-[#2f3031] text-gray-100'
                         }`}>
                             {/* Display User Attachments */}
                             {msg.attachments && msg.attachments.length > 0 && (
                                 <div className="flex flex-wrap gap-2 mb-2">
                                     {msg.attachments.map((att, i) => (
                                         att.type === 'image' ? (
                                             <img key={i} src={att.url} alt="Uploaded" className="max-w-[150px] max-h-[150px] rounded-lg border border-black/10" />
                                         ) : (
                                             <div key={i} className="flex items-center gap-2 bg-black/10 px-3 py-2 rounded-lg text-xs">
                                                 <FileText size={16} />
                                                 <span className="truncate max-w-[150px]">{att.name || 'File'}</span>
                                             </div>
                                         )
                                     ))}
                                 </div>
                             )}
                             {msg.text}
                         </div>
                     ) : (
                         <div id={`msg-${node.id}-${msg.id}`} className={`text-sm leading-relaxed ${isLight ? 'text-[#374151]' : 'text-gray-200'}`}>
                             {/* Display Model Attachments (Generated Images) */}
                             {msg.attachments && msg.attachments.length > 0 && msg.attachments.map((att, i) => (
                                 <div key={i} className="mb-4 rounded-xl overflow-hidden border border-white/10 shadow-lg inline-block">
                                     <img src={att.url} alt="Generated" className="max-w-full h-auto" />
                                 </div>
                             ))}

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

                     {msg.role === 'model' && !msg.isError && (
                         <div className="mt-3 pl-1">
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

      {/* Input Area */}
      <div className={`p-4 no-drag relative z-10 ${isLight ? 'bg-white' : 'bg-[#1e1f20]'}`}>
          
          {/* File Previews */}
          {pendingAttachments.length > 0 && (
              <div className="flex gap-2 mb-2 px-2 overflow-x-auto pb-1 custom-scrollbar">
                  {pendingAttachments.map((att, i) => (
                      <div key={i} className="relative group/preview flex-shrink-0">
                          {att.type === 'image' ? (
                              <img src={att.url} alt="preview" className="w-16 h-16 object-cover rounded-lg border border-white/10" />
                          ) : (
                              <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/30 rounded-lg flex flex-col items-center justify-center text-blue-400">
                                  <FileText size={20} />
                                  <span className="text-[8px] truncate max-w-full px-1 mt-1">{att.name?.split('.').pop()?.toUpperCase()}</span>
                              </div>
                          )}
                          <button
                              onClick={() => removeAttachment(i)}
                              className="absolute -top-1 -right-1 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover/preview:opacity-100 transition-opacity hover:bg-red-500"
                          >
                              <X size={10} />
                          </button>
                      </div>
                  ))}
              </div>
          )}

          <div className={`flex items-center gap-3 px-4 py-3 rounded-full transition-all ${
              isLight 
              ? 'bg-[#f0f4f9] hover:bg-[#e9eef6] focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100' 
              : 'bg-[#2f3031] hover:bg-[#37393b] focus-within:bg-[#1e1f20] focus-within:ring-1 focus-within:ring-gray-600'
          }`}>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className={`p-1.5 rounded-full transition-colors ${isLight ? 'text-gray-400 hover:text-blue-600 hover:bg-blue-50' : 'text-gray-500 hover:text-cyan-400 hover:bg-cyan-900/20'}`}
                title="Attach file"
              >
                  <Paperclip size={18} />
              </button>
              <input 
                 type="file" 
                 multiple 
                 ref={fileInputRef} 
                 className="hidden" 
                 onChange={handleFileSelect}
                 accept="image/*,application/pdf,text/*"
              />

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
                disabled={isLoading || (!input.trim() && pendingAttachments.length === 0)}
                className={`p-2 rounded-full transition-all ${
                    input.trim() || pendingAttachments.length > 0
                    ? (isLight ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white text-black hover:bg-gray-200') 
                    : 'bg-transparent text-gray-400 cursor-default'
                }`}
              >
                  <Send size={16} />
              </button>
          </div>
      </div>

      {/* Resize Handle - Larger hit area for easier resizing */}
      <div 
        onMouseDown={handleResizeStart}
        className="absolute bottom-0 right-0 w-8 h-8 cursor-nwse-resize flex items-end justify-end p-1.5 opacity-0 hover:opacity-100 transition-opacity no-drag group z-20"
        title="Resize"
      >
          <div className={`w-4 h-4 rounded-br-sm border-r-2 border-b-2 transition-colors ${
              isLight ? 'border-gray-400 group-hover:border-blue-500' : 'border-gray-500 group-hover:border-cyan-400'
          }`}></div>
      </div>
    </div>
  );
};

export default ChatWindow;
