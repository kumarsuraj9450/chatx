import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Loader2, Bot, User } from 'lucide-react';
import { ChatMessage, Attachment } from '../../types';
import { streamChatResponse } from '../../services/geminiService';
import { blobToBase64 } from '../../utils/audioUtils';
import { SYSTEM_PROMPTS } from '../../constants';

const ChatArea: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;

    // Prepare attachments for UI state
    const uiAttachments: Attachment[] | undefined = previewUrl ? [{
        type: 'image',
        mimeType: selectedImage?.type || 'image/png',
        data: '', // Base64 not strictly needed for local preview
        url: previewUrl
    }] : undefined;

    const userMsgId = Date.now().toString();
    const newUserMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      text: input,
      timestamp: Date.now(),
      attachments: uiAttachments
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInput('');
    setIsLoading(true);

    // Prepare attachments for API
    const apiAttachments: Attachment[] = [];
    if (selectedImage) {
        try {
            const b64 = await blobToBase64(selectedImage);
            apiAttachments.push({
                type: 'image',
                mimeType: selectedImage.type,
                data: b64
            });
        } catch (e) {
            console.error("Failed to convert image", e);
        }
    }
    
    // Reset image state
    setSelectedImage(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Prepare history for API
    const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
    }));

    // Placeholder for bot message
    const botMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
        id: botMsgId,
        role: 'model',
        text: '',
        timestamp: Date.now()
    }]);

    try {
        let accumulatedText = '';
        await streamChatResponse(
            history, 
            newUserMsg.text, 
            'thinking',
            undefined,
            SYSTEM_PROMPTS.STANDARD,
            apiAttachments,
            (chunk) => {
                accumulatedText += chunk;
                setMessages(prev => prev.map(m => 
                    m.id === botMsgId ? { ...m, text: accumulatedText } : m
                ));
            }
        );
    } catch (error) {
        console.error(error);
        setMessages(prev => prev.map(m => 
            m.id === botMsgId ? { ...m, text: "Sorry, I encountered an error processing your request.", isError: true } : m
        ));
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-900/20 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/20 rounded-full blur-[120px]"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex items-center justify-between">
          <div>
              <h2 className="text-lg font-semibold text-white">Gemini Pro 3.0</h2>
              <p className="text-xs text-slate-400">Reasoning & Multimodal Chat</p>
          </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 z-10 custom-scrollbar">
        {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60">
                <Bot className="w-16 h-16 mb-4" />
                <p>Start a conversation with Gemini.</p>
            </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start max-w-3xl mx-auto ${
              msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                msg.role === 'user' ? 'bg-cyan-600 ml-4' : 'bg-indigo-600 mr-4'
            }`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            
            <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                    className={`rounded-2xl p-4 shadow-sm ${
                        msg.role === 'user'
                        ? 'bg-cyan-600/20 border border-cyan-500/30 text-cyan-50 rounded-tr-none'
                        : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-none'
                    } ${msg.isError ? 'border-red-500/50 bg-red-900/10' : ''}`}
                >
                    {msg.attachments && msg.attachments.map((att, idx) => (
                        att.type === 'image' && att.url ? (
                            <img key={idx} src={att.url} alt="User upload" className="max-w-xs rounded-lg mb-3 border border-white/10" />
                        ) : null
                    ))}
                    <div className="whitespace-pre-wrap leading-relaxed">
                        {msg.text || (isLoading && msg.id === messages[messages.length - 1].id ? <span className="animate-pulse">Thinking...</span> : '')}
                    </div>
                </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-slate-900/80 border-t border-slate-800 z-20">
        <div className="max-w-3xl mx-auto flex flex-col space-y-3">
            {previewUrl && (
                <div className="relative inline-block w-20 h-20 rounded-lg overflow-hidden border border-cyan-500/50 group">
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button 
                        onClick={() => { setSelectedImage(null); setPreviewUrl(null); }}
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <span className="text-white text-xs">Remove</span>
                    </button>
                </div>
            )}
            <div className="flex items-end gap-2 bg-slate-800/50 p-2 rounded-xl border border-slate-700 focus-within:border-cyan-500/50 transition-colors">
                <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleImageSelect}
                    className="hidden"
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors"
                >
                    <ImageIcon size={20} />
                </button>
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    placeholder="Type a message..."
                    className="flex-1 bg-transparent border-none text-slate-200 placeholder-slate-500 resize-none focus:ring-0 max-h-32 py-2"
                    rows={1}
                />
                <button
                    onClick={handleSend}
                    disabled={isLoading || (!input.trim() && !selectedImage)}
                    className="p-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-900/20"
                >
                    {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                </button>
            </div>
            <div className="text-center text-xs text-slate-500">
                Gemini may display inaccurate info, including about people, so double-check its responses.
            </div>
        </div>
      </div>
    </div>
  );
};

export default ChatArea;