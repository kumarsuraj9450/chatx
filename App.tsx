import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import CanvasBoard from './components/Canvas/CanvasBoard';
import LiveSession from './components/Live/LiveSession';
import CreativeStudio from './components/Creative/CreativeStudio';
import { ViewMode, CanvasData } from './types';

const App: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<ViewMode>(ViewMode.CANVAS);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  
  // Initialize with one default canvas
  const [canvases, setCanvases] = useState<CanvasData[]>([
      {
          id: 'main-canvas',
          name: 'Main Board',
          nodes: [],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 },
          lastModified: Date.now()
      }
  ]);
  const [activeCanvasId, setActiveCanvasId] = useState<string>('main-canvas');

  const handleModeChange = (mode: ViewMode) => {
      // If user selects Chat from sidebar, we map it to CANVAS
      if (mode.toString() === 'CHAT') {
          setCurrentMode(ViewMode.CANVAS);
      } else {
          setCurrentMode(mode);
      }
  };

  const handleCreateCanvas = () => {
      // Create new canvas immediately with a default name
      const newId = Date.now().toString();
      const newCanvas: CanvasData = {
          id: newId,
          name: `Canvas ${canvases.length + 1}`,
          nodes: [],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 },
          lastModified: Date.now()
      };
      setCanvases(prev => [...prev, newCanvas]);
      setActiveCanvasId(newId);
      setCurrentMode(ViewMode.CANVAS);
  };

  const handleSelectCanvas = (id: string) => {
      setActiveCanvasId(id);
      setCurrentMode(ViewMode.CANVAS);
  };

  const handleSaveCanvas = (id: string, data: Partial<CanvasData>) => {
      setCanvases(prev => prev.map(c => 
          c.id === id 
          ? { ...c, ...data, lastModified: Date.now() } 
          : c
      ));
  };

  const activeCanvas = canvases.find(c => c.id === activeCanvasId) || canvases[0];

  return (
    <div className={`flex h-screen w-screen overflow-hidden font-sans ${theme === 'dark' ? 'bg-black text-slate-200' : 'bg-slate-50 text-slate-800'}`}>
      <Sidebar 
          currentMode={currentMode} 
          onModeChange={handleModeChange}
          canvases={canvases}
          activeCanvasId={activeCanvasId}
          onCreateCanvas={handleCreateCanvas}
          onSelectCanvas={handleSelectCanvas}
          theme={theme}
          onToggleTheme={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
      />
      
      <main className="flex-1 h-full relative overflow-hidden">
        {currentMode === ViewMode.CANVAS && (
            <CanvasBoard 
                key={activeCanvas.id} // Forces re-mount when switching canvases
                initialData={activeCanvas} 
                onSave={(data) => handleSaveCanvas(activeCanvas.id, data)}
                theme={theme}
            />
        )}
        {currentMode === ViewMode.LIVE && <LiveSession />}
        {currentMode === ViewMode.CREATIVE && <CreativeStudio />}
      </main>
    </div>
  );
};

export default App;