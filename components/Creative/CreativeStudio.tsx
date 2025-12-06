import React, { useState } from 'react';
import { Image as ImageIcon, Video, Wand2, Download, AlertCircle, Loader2, Key } from 'lucide-react';
import { generateImage, generateVideo } from '../../services/geminiService';
import { ASPECT_RATIOS } from '../../constants';
import { CreativeResult } from '../../types';

const CreativeStudio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<CreativeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showKeySelector, setShowKeySelector] = useState(false);

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    setError(null);
    setResult(null);
    setShowKeySelector(false);

    try {
      if (activeTab === 'image') {
        const url = await generateImage(prompt, aspectRatio);
        setResult({
            type: 'image',
            url,
            prompt,
            timestamp: Date.now()
        });
      } else {
        const url = await generateVideo(prompt, aspectRatio);
        setResult({
            type: 'video',
            url,
            prompt,
            timestamp: Date.now()
        });
      }
    } catch (e: any) {
      console.error(e);
      if (e.message === 'API_KEY_REQUIRED') {
        setShowKeySelector(true);
        setError("Payment-enabled API Key required for Veo models.");
      } else {
        setError(e.message || "Generation failed");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const openKeySelector = async () => {
    if ((window as any).aistudio && (window as any).aistudio.openSelectKey) {
        await (window as any).aistudio.openSelectKey();
        // Clear error and retry prompt usually works if user selected key
        setError(null);
        setShowKeySelector(false);
    }
  };

  return (
    <div className="flex h-full bg-slate-950 overflow-hidden">
        {/* Left Control Panel */}
        <div className="w-96 bg-slate-900 border-r border-slate-800 p-6 flex flex-col overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-6">Creative Studio</h2>

            {/* Tabs */}
            <div className="flex bg-slate-800 p-1 rounded-xl mb-8">
                <button
                    onClick={() => setActiveTab('image')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === 'image' 
                        ? 'bg-slate-700 text-white shadow-sm' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                    <div className="flex items-center justify-center gap-2">
                        <ImageIcon size={16} /> Image
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('video')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === 'video' 
                        ? 'bg-slate-700 text-white shadow-sm' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                    <div className="flex items-center justify-center gap-2">
                        <Video size={16} /> Video (Veo)
                    </div>
                </button>
            </div>

            {/* Form */}
            <div className="space-y-6">
                <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Prompt</label>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={activeTab === 'image' ? "A futuristic city in the clouds..." : "A cinematic drone shot of a waterfall..."}
                        className="w-full h-32 bg-slate-800 border border-slate-700 rounded-xl p-3 text-slate-200 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 outline-none resize-none placeholder-slate-500"
                    />
                </div>

                <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Aspect Ratio</label>
                    <div className="grid grid-cols-3 gap-2">
                        {ASPECT_RATIOS.map(ratio => (
                            <button
                                key={ratio}
                                onClick={() => setAspectRatio(ratio)}
                                className={`py-2 text-sm rounded-lg border transition-all ${
                                    aspectRatio === ratio
                                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                                }`}
                            >
                                {ratio}
                            </button>
                        ))}
                    </div>
                </div>

                {showKeySelector && (
                    <div className="p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-xl">
                        <p className="text-yellow-200 text-sm mb-3">Veo requires a paid API key.</p>
                        <button 
                            onClick={openKeySelector}
                            className="w-full py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                        >
                            <Key size={16} /> Select API Key
                        </button>
                        <a 
                            href="https://ai.google.dev/gemini-api/docs/billing" 
                            target="_blank" 
                            rel="noreferrer"
                            className="block text-center text-xs text-yellow-400/70 mt-2 hover:underline"
                        >
                            Billing Documentation
                        </a>
                    </div>
                )}

                <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !prompt}
                    className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-900/20 flex items-center justify-center gap-2"
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="animate-spin" size={20} /> Generating...
                        </>
                    ) : (
                        <>
                            <Wand2 size={20} /> Generate {activeTab === 'image' ? 'Image' : 'Video'}
                        </>
                    )}
                </button>
            </div>
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 p-6 flex flex-col">
            <div className="flex-1 bg-slate-900 rounded-2xl border border-slate-800 flex items-center justify-center relative overflow-hidden group">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-20" 
                     style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #334155 1px, transparent 0)', backgroundSize: '24px 24px' }}>
                </div>

                {isGenerating ? (
                    <div className="text-center z-10">
                        <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-slate-400 animate-pulse">
                            {activeTab === 'image' ? 'Dreaming up pixels...' : 'Rendering frames (this may take a minute)...'}
                        </p>
                    </div>
                ) : result ? (
                    <div className="relative w-full h-full flex items-center justify-center p-4">
                        {result.type === 'image' ? (
                            <img src={result.url} alt={result.prompt} className="max-w-full max-h-full rounded-lg shadow-2xl" />
                        ) : (
                            <video src={result.url} controls autoPlay loop className="max-w-full max-h-full rounded-lg shadow-2xl" />
                        )}
                        
                        <a 
                            href={result.url} 
                            download={`gemini-gen-${Date.now()}.${result.type === 'image' ? 'png' : 'mp4'}`}
                            className="absolute bottom-8 right-8 p-3 bg-slate-900/80 backdrop-blur text-white rounded-full hover:bg-slate-800 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Download size={24} />
                        </a>
                    </div>
                ) : (
                    <div className="text-center text-slate-600 z-10 max-w-sm">
                        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Wand2 size={32} className="opacity-50" />
                        </div>
                        <p className="font-medium mb-1">Canvas Empty</p>
                        <p className="text-sm">Enter a prompt in the sidebar to start creating with Gemini's advanced media models.</p>
                    </div>
                )}
                
                {error && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500/10 border border-red-500/50 text-red-50 px-4 py-2 rounded-lg flex items-center gap-2">
                        <AlertCircle size={16} />
                        <span className="text-sm">{error}</span>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default CreativeStudio;