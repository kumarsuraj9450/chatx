import React from 'react';
import { MessageSquare, Zap, Image as ImageIcon, LayoutGrid, Plus, FolderKanban, Sun, Moon } from 'lucide-react';
import { ViewMode, CanvasData } from '../types';

interface SidebarProps {
  currentMode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  canvases: CanvasData[];
  activeCanvasId: string;
  onCreateCanvas: () => void;
  onSelectCanvas: (id: string) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  currentMode, 
  onModeChange,
  canvases,
  activeCanvasId,
  onCreateCanvas,
  onSelectCanvas,
  theme,
  onToggleTheme
}) => {
  const navItems = [
    { mode: ViewMode.CANVAS, icon: LayoutGrid, label: 'Canvas' },
    { mode: ViewMode.LIVE, icon: Zap, label: 'Live' },
    { mode: ViewMode.CREATIVE, icon: ImageIcon, label: 'Creative' },
  ];

  return (
    <div className={`w-16 md:w-20 border-r flex flex-col items-center py-6 flex-shrink-0 z-50 transition-colors duration-300 ${
        theme === 'dark' 
        ? 'bg-[#0b0c0d] border-slate-800' 
        : 'bg-white border-slate-200'
    }`}>
      <div className="flex items-center justify-center mb-8">
        <div className="w-10 h-10 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <span className="text-white font-bold text-xl">G</span>
        </div>
      </div>

      <nav className="w-full space-y-4 px-2 flex flex-col items-center mb-6">
        {navItems.map((item) => (
          <button
            key={item.mode}
            onClick={() => onModeChange(item.mode)}
            title={item.label}
            className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-200 group relative ${
              currentMode === item.mode
                ? 'bg-cyan-500/20 text-cyan-500'
                : theme === 'dark' 
                    ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' 
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
            }`}
          >
            <item.icon className={`w-6 h-6 ${currentMode === item.mode ? 'stroke-2' : 'stroke-1.5'}`} />
            <span className={`absolute left-14 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border z-50 ${
                theme === 'dark'
                ? 'bg-slate-800 text-white border-slate-700'
                : 'bg-white text-slate-700 border-slate-200 shadow-sm'
            }`}>
                {item.label}
            </span>
          </button>
        ))}
      </nav>

      {/* Divider */}
      <div className={`w-8 h-px mb-6 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`}></div>

      {/* Add New Canvas - Fixed at top of list */}
      <div className="px-2 mb-3">
        <button
            onClick={onCreateCanvas}
            className={`w-10 h-10 rounded-full flex items-center justify-center border border-dashed transition-all group relative ${
                theme === 'dark'
                ? 'border-slate-600 text-slate-500 hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-cyan-500/10'
                : 'border-slate-300 text-slate-400 hover:text-cyan-600 hover:border-cyan-500/50 hover:bg-cyan-50'
            }`}
        >
            <Plus size={18} />
             <span className={`absolute left-12 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border z-50 ${
                theme === 'dark'
                ? 'bg-slate-800 text-white border-slate-700'
                : 'bg-white text-slate-700 border-slate-200 shadow-sm'
            }`}>
                New Canvas
            </span>
        </button>
      </div>

      {/* Canvases List */}
      <div className="flex-1 w-full px-2 flex flex-col items-center space-y-3 overflow-y-auto custom-scrollbar">
         {canvases.map(canvas => (
             <button
                key={canvas.id}
                onClick={() => onSelectCanvas(canvas.id)}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold border transition-all relative group flex-shrink-0 ${
                    canvas.id === activeCanvasId && currentMode === ViewMode.CANVAS
                    ? 'bg-slate-800 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                    : theme === 'dark'
                        ? 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                        : 'bg-slate-100 border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700'
                }`}
             >
                {canvas.name.substring(0, 2).toUpperCase()}
                
                {/* Tooltip */}
                <span className={`absolute left-12 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border z-50 ${
                    theme === 'dark'
                    ? 'bg-slate-800 text-white border-slate-700'
                    : 'bg-white text-slate-700 border-slate-200 shadow-sm'
                }`}>
                    {canvas.name}
                </span>
             </button>
         ))}
      </div>

      <div className="mt-auto pb-4 pt-4 flex flex-col gap-3">
        {/* Theme Toggle */}
        <button
            onClick={onToggleTheme}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                theme === 'dark'
                ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
            theme === 'dark'
            ? 'bg-slate-800 border border-slate-700 text-slate-400'
            : 'bg-slate-100 border border-slate-200 text-slate-500'
        }`}>
            AI
        </div>
      </div>
    </div>
  );
};

export default Sidebar;