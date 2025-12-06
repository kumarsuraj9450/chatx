import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, Power, Activity } from 'lucide-react';
import { getLiveClient } from '../../services/geminiService';
import { MODELS } from '../../constants';
import { createPcmBlob, decodeAudioData, blobToBase64 } from '../../utils/audioUtils';
import { LiveServerMessage, Modality } from '@google/genai';

const LiveSession: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [status, setStatus] = useState<string>('Ready to connect');
  const [volume, setVolume] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  
  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null); // To store session object
  const frameIntervalRef = useRef<number | null>(null);

  // Initialize Audio Contexts
  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (!inputContextRef.current) {
        inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    }
  };

  const cleanup = () => {
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    if (sessionRef.current) {
        // No explicit close method on session object in some versions, but we stop streams
    }
    // Stop all audio sources
    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();
    
    // Close contexts
    audioContextRef.current?.close();
    inputContextRef.current?.close();
    audioContextRef.current = null;
    inputContextRef.current = null;
    
    setIsConnected(false);
    setStatus('Disconnected');
  };

  const connect = async () => {
    try {
      setStatus('Connecting...');
      initAudio();
      const ai = getLiveClient();

      // Get Mic Stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
              channelCount: 1,
              sampleRate: 16000
          }, 
          video: isVideoEnabled 
      });

      if (isVideoEnabled && videoRef.current) {
          videoRef.current.srcObject = stream;
      }

      // Connect to Gemini Live
      const sessionPromise = ai.live.connect({
        model: MODELS.LIVE,
        callbacks: {
          onopen: () => {
            setStatus('Connected');
            setIsConnected(true);

            // Setup Input Audio Processing
            const source = inputContextRef.current!.createMediaStreamSource(stream);
            const processor = inputContextRef.current!.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
                if (isMuted) return;
                const inputData = e.inputBuffer.getChannelData(0);
                // Calculate volume for visualizer
                let sum = 0;
                for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
                setVolume(Math.sqrt(sum / inputData.length));

                const pcmBlob = createPcmBlob(inputData);
                sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };

            source.connect(processor);
            processor.connect(inputContextRef.current!.destination);
            
            sessionRef.current = sessionPromise;
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Handle Audio Output
            const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData && audioContextRef.current) {
                const ctx = audioContextRef.current;
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                
                try {
                    const audioBuffer = await decodeAudioData(
                        base64ToBytes(audioData),
                        ctx,
                        24000,
                        1
                    );
                    const source = ctx.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(ctx.destination);
                    source.addEventListener('ended', () => sourcesRef.current.delete(source));
                    
                    source.start(nextStartTimeRef.current);
                    nextStartTimeRef.current += audioBuffer.duration;
                    sourcesRef.current.add(source);
                } catch(err) {
                    console.error("Audio decode error", err);
                }
            }

            // Handle Interruptions
            if (msg.serverContent?.interrupted) {
                sourcesRef.current.forEach(s => s.stop());
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            setStatus('Disconnected');
            setIsConnected(false);
          },
          onerror: (e) => {
            console.error("Live API Error", e);
            setStatus('Error occurred');
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
          },
          systemInstruction: "You are a witty and knowledgeable AI assistant. Keep responses concise and conversational."
        }
      });

      // Video Streaming Loop
      if (isVideoEnabled) {
          frameIntervalRef.current = window.setInterval(() => {
              if (!videoRef.current || !canvasRef.current) return;
              const ctx = canvasRef.current.getContext('2d');
              if (!ctx) return;

              canvasRef.current.width = videoRef.current.videoWidth;
              canvasRef.current.height = videoRef.current.videoHeight;
              ctx.drawImage(videoRef.current, 0, 0);

              canvasRef.current.toBlob(async (blob) => {
                  if (blob) {
                      const base64 = await blobToBase64(blob);
                      sessionPromise.then(session => 
                        session.sendRealtimeInput({ 
                            media: { mimeType: 'image/jpeg', data: base64 } 
                        })
                      );
                  }
              }, 'image/jpeg', 0.5); // Low quality for speed
          }, 1000); // 1 FPS for testing stability
      }

    } catch (e) {
      console.error(e);
      setStatus('Connection Failed');
    }
  };

  // Helper for byte conversion inside the component to avoid circular deps if Utils imported oddly
  const base64ToBytes = (base64: string): Uint8Array => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 p-6 relative">
      <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
            <div>
                <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                    <Activity className="text-cyan-400" /> Live Console
                </h2>
                <p className="text-slate-400">Real-time low-latency multimodal interaction.</p>
            </div>
            <div className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${
                isConnected 
                ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
                {status.toUpperCase()}
            </div>
        </div>

        {/* Main Visualizer Area */}
        <div className="flex-1 bg-slate-900 rounded-2xl border border-slate-800 relative overflow-hidden flex items-center justify-center">
            {/* Ambient Background */}
            <div className={`absolute inset-0 transition-opacity duration-1000 ${isConnected ? 'opacity-100' : 'opacity-0'}`}>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/20 rounded-full blur-[100px] animate-pulse"></div>
            </div>

            {isVideoEnabled ? (
                 <video 
                 ref={videoRef} 
                 autoPlay 
                 muted 
                 playsInline
                 className="w-full h-full object-cover relative z-10" 
             />
            ) : (
                <div className="relative z-10 flex flex-col items-center">
                    <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center transition-all duration-300 ${
                        isConnected 
                        ? 'border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.5)]' 
                        : 'border-slate-700'
                    }`}
                    style={{
                        transform: `scale(${1 + volume * 2})`
                    }}
                    >
                        <Mic size={48} className={isConnected ? "text-cyan-400" : "text-slate-600"} />
                    </div>
                    <p className="mt-8 text-slate-500 font-mono tracking-widest text-sm">
                        {isConnected ? "LISTENING..." : "SYSTEM IDLE"}
                    </p>
                </div>
            )}
        </div>

        {/* Controls */}
        <div className="mt-8 flex justify-center gap-6">
            <button
                onClick={() => setIsMuted(!isMuted)}
                className={`p-4 rounded-full border transition-all ${
                    isMuted 
                    ? 'bg-red-500/10 border-red-500/50 text-red-500' 
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
            >
                {isMuted ? <MicOff /> : <Mic />}
            </button>

            <button
                onClick={isConnected ? cleanup : connect}
                className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-105 ${
                    isConnected 
                    ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30' 
                    : 'bg-cyan-500 hover:bg-cyan-400 shadow-cyan-500/30'
                }`}
            >
                <Power size={32} className="text-white" />
            </button>

            <button
                onClick={() => setIsVideoEnabled(!isVideoEnabled)}
                className={`p-4 rounded-full border transition-all ${
                    !isVideoEnabled 
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' 
                    : 'bg-cyan-500/10 border-cyan-500/50 text-cyan-500'
                }`}
            >
                {isVideoEnabled ? <Video /> : <VideoOff />}
            </button>
        </div>
      </div>
    </div>
  );
};

export default LiveSession;