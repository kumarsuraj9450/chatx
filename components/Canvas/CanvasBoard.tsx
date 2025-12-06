import React, { useState, useRef, useEffect } from 'react';
import { Plus, ZoomIn, ZoomOut, Search, X, ArrowRight, ArrowRightFromLine } from 'lucide-react';
import ChatWindow from './ChatWindow';
import ConnectionLayer from './ConnectionLayer';
import { CanvasNode, CanvasEdge, ChatMessage, CanvasData, ChatMode } from '../../types';
import { CHAT_MODES } from '../../constants';

const INITIAL_NODE_WIDTH = 400;
const INITIAL_NODE_HEIGHT = 600;

interface CanvasBoardProps {
  initialData: CanvasData;
  onSave: (data: Partial<CanvasData>) => void;
  theme: 'light' | 'dark';
}

const CanvasBoard: React.FC<CanvasBoardProps> = ({ initialData, onSave, theme }) => {
  const [nodes, setNodes] = useState<CanvasNode[]>(initialData.nodes);
  const [edges, setEdges] = useState<CanvasEdge[]>(initialData.edges);
  const [viewport, setViewport] = useState(initialData.viewport);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  
  // Canvas Name State
  const [canvasName, setCanvasName] = useState(initialData.name);
  const [isEditingName, setIsEditingName] = useState(false);

  // Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Hover State for Visual Connections
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null); // Ref for the transformed inner div
  const nextZIndex = useRef(Math.max(...(initialData.nodes.length > 0 ? initialData.nodes.map(n => n.zIndex) : [10])) + 1);

  // Sync local name state if prop changes (e.g. switching canvases)
  useEffect(() => {
    setCanvasName(initialData.name);
    setNodes(initialData.nodes);
    setEdges(initialData.edges);
    setViewport(initialData.viewport);
  }, [initialData.id]); // Re-sync when ID changes

  // Auto-save effect with debounce
  useEffect(() => {
      const timer = setTimeout(() => {
          onSave({ nodes, edges, viewport });
      }, 500); // 500ms debounce
      return () => clearTimeout(timer);
  }, [nodes, edges, viewport, onSave]);

  const handleRename = () => {
    setIsEditingName(false);
    if (canvasName.trim() && canvasName !== initialData.name) {
        onSave({ name: canvasName.trim() });
    } else {
        setCanvasName(initialData.name); // Revert if empty
    }
  };

  // --- Workspace Management ---

  const addNode = (
      x: number, 
      y: number, 
      parentId?: string, 
      initialMessages: ChatMessage[] = [], 
      title: string = "New Chat", 
      fromMessageId?: string,
      config?: { chatMode?: ChatMode, isGuidedLearning?: boolean, selectedModel?: string }
  ) => {
    const newNode: CanvasNode = {
      id: Math.random().toString(36).substr(2, 9),
      x,
      y,
      width: INITIAL_NODE_WIDTH,
      height: INITIAL_NODE_HEIGHT,
      zIndex: nextZIndex.current++,
      title,
      messages: initialMessages,
      theme: theme === 'dark' ? 'dark-gray' : 'light',
      parentId,
      chatMode: config?.chatMode || 'standard',
      isGuidedLearning: config?.isGuidedLearning ?? true,
      selectedModel: config?.selectedModel
    };

    setNodes(prev => [...prev, newNode]);

    if (parentId) {
      const newEdge: CanvasEdge = {
        id: `e-${parentId}-${newNode.id}`,
        fromNode: parentId,
        toNode: newNode.id,
        fromMessageId: fromMessageId // Track which message spawned this
      };
      setEdges(prev => [...prev, newEdge]);
    }
  };

  const removeNode = (id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    // CRITICAL: Automatically remove all edges connected to this node
    // This ensures the connecting line is deleted when the chat window is closed/deleted.
    setEdges(prev => prev.filter(e => e.fromNode !== id && e.toNode !== id));
  };

  const updateNode = (id: string, updates: Partial<CanvasNode>) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
  };

  // --- Layering Control ---

  const bringToFront = (id: string) => {
    updateNode(id, { zIndex: nextZIndex.current++ });
  };

  const sendToBack = (id: string) => {
    const minZ = Math.min(...nodes.map(n => n.zIndex));
    updateNode(id, { zIndex: minZ - 1 });
  };

  const bringForward = (id: string) => {
    const node = nodes.find(n => n.id === id);
    if(node) updateNode(id, { zIndex: node.zIndex + 1 });
  };

  const sendBackward = (id: string) => {
    const node = nodes.find(n => n.id === id);
    if(node) updateNode(id, { zIndex: node.zIndex - 1 });
  };

  const handleBranch = (parentId: string, messageIndex: number) => {
    const parentNode = nodes.find(n => n.id === parentId);
    if (!parentNode) return;

    // Slice context up to the branched message
    const contextSlice = parentNode.messages.slice(0, messageIndex + 1);
    
    // Position to the right of parent, slightly offset based on index to minimize overlap
    const startX = parentNode.x + parentNode.width + 150;
    // We try to estimate the Y position of the message to spawn "next" to it visually
    const startY = parentNode.y + Math.min(messageIndex * 100, 400); 

    const messageId = parentNode.messages[messageIndex].id;

    // Inherit configuration from parent
    const config = {
        chatMode: parentNode.chatMode,
        isGuidedLearning: parentNode.isGuidedLearning,
        selectedModel: parentNode.selectedModel
    };

    addNode(startX, startY, parentId, contextSlice, `Branch from ${parentNode.title}`, messageId, config);
  };

  // --- Search & Navigation ---

  const focusNode = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    // 1. Bring window to front
    bringToFront(nodeId);

    // 2. Calculate center position
    
    const screenCenterX = window.innerWidth / 2;
    const screenCenterY = window.innerHeight / 2;
    const nodeCenterX = node.x + node.width / 2;
    const nodeCenterY = node.y + node.height / 2;

    const newViewportX = screenCenterX - (nodeCenterX * viewport.zoom);
    const newViewportY = screenCenterY - (nodeCenterY * viewport.zoom);

    setViewport(prev => ({ ...prev, x: newViewportX, y: newViewportY }));
    
    // 3. Clear search
    setSearchQuery('');
    setIsSearchOpen(false);
  };

  const handleJumpToLast = () => {
    if (nodes.length > 0) {
        // Assume the last node in the array is the most recently created
        const lastNode = nodes[nodes.length - 1];
        focusNode(lastNode.id);
    }
  };

  // --- Canvas Interaction ---

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only handle pan dragging here. Node creation moved to double click.
    if (e.button === 1 || (e.button === 0 && e.shiftKey) || (e.button === 0 && e.target === containerRef.current)) {
      setIsDraggingCanvas(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
     if (e.target === containerRef.current) {
        const bounds = containerRef.current.getBoundingClientRect();
        const canvasX = (e.clientX - bounds.left - viewport.x) / viewport.zoom;
        const canvasY = (e.clientY - bounds.top - viewport.y) / viewport.zoom;
        
        addNode(canvasX - INITIAL_NODE_WIDTH / 2, canvasY - INITIAL_NODE_HEIGHT / 2);
     }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingCanvas) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      setViewport(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDraggingCanvas(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Canvas zooming/panning logic
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomSensitivity = 0.001;
      const delta = -e.deltaY * zoomSensitivity;
      const newZoom = Math.min(Math.max(0.1, viewport.zoom + delta), 3);
      setViewport(prev => ({ ...prev, zoom: newZoom }));
    } else {
        setViewport(prev => ({ ...prev, x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
    }
  };

  const isNodeVisible = (node: CanvasNode) => {
    const viewLeft = -viewport.x / viewport.zoom;
    const viewTop = -viewport.y / viewport.zoom;
    const viewRight = viewLeft + (window.innerWidth / viewport.zoom);
    const viewBottom = viewTop + (window.innerHeight / viewport.zoom);

    return (
      node.x + node.width > viewLeft &&
      node.x < viewRight &&
      node.y + node.height > viewTop &&
      node.y < viewBottom
    );
  };

  return (
    <div 
      className={`relative w-full h-full overflow-hidden select-none transition-colors duration-300 ${theme === 'dark' ? 'bg-[#131314]' : 'bg-slate-50'}`}
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <div 
        className="absolute inset-0 pointer-events-none opacity-20 transition-all duration-300"
        style={{
          backgroundImage: `radial-gradient(${theme === 'dark' ? '#444' : '#94a3b8'} 1px, transparent 1px)`,
          backgroundSize: `${20 * viewport.zoom}px ${20 * viewport.zoom}px`,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`
        }}
      />

      {/* Top Left Controls & Search */}
      <div className="absolute top-4 left-4 z-50 flex gap-2 items-center">
        {/* Editable Canvas Name */}
        <div 
            className={`backdrop-blur border rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-text relative group flex items-center gap-2 ${
                theme === 'dark' ? 'bg-slate-800/80 border-slate-700 text-slate-300' : 'bg-white/80 border-slate-200 text-slate-600 shadow-sm'
            }`}
             title="Double click to rename"
        >
             {isEditingName ? (
                 <input 
                    autoFocus
                    value={canvasName}
                    onChange={(e) => setCanvasName(e.target.value)}
                    onBlur={handleRename}
                    onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                    className="bg-transparent outline-none min-w-[120px]"
                 />
             ) : (
                 <span onDoubleClick={() => setIsEditingName(true)} className="min-w-[50px] inline-block">{canvasName}</span>
             )}
        </div>

        {isSearchOpen ? (
            <div className="relative">
                <div className={`flex items-center rounded-lg border backdrop-blur overflow-hidden transition-all animate-in fade-in zoom-in-95 duration-200 ${
                    theme === 'dark' ? 'bg-slate-800/90 border-slate-600 text-white' : 'bg-white/90 border-slate-300 text-slate-800 shadow-lg'
                }`}>
                    <Search size={16} className="ml-3 opacity-50" />
                    <input 
                        autoFocus
                        className="bg-transparent border-none outline-none px-2 py-2 text-sm w-48 placeholder-opacity-50"
                        placeholder="Find chat window..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={e => { if(e.key === 'Escape') { setIsSearchOpen(false); setSearchQuery(''); } }}
                    />
                    <button onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }} className="p-2 hover:bg-black/10 transition-colors">
                        <X size={14} />
                    </button>
                </div>

                {/* Results Dropdown */}
                {searchQuery && (
                    <div className={`absolute top-full left-0 mt-2 w-72 rounded-xl border shadow-xl overflow-hidden max-h-[60vh] overflow-y-auto custom-scrollbar flex flex-col ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                    }`}>
                        {nodes.filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase())).map(node => (
                            <button 
                                key={node.id}
                                onClick={() => focusNode(node.id)}
                                className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between border-b last:border-0 transition-colors group ${
                                    theme === 'dark' 
                                    ? 'border-slate-700 hover:bg-slate-700 text-slate-200' 
                                    : 'border-slate-100 hover:bg-blue-50 text-slate-700'
                                }`}
                            >
                                <div className="flex flex-col truncate pr-2">
                                    <span className="truncate font-medium group-hover:text-blue-500 transition-colors">{node.title}</span>
                                    <span className="text-[10px] opacity-50 truncate uppercase tracking-wider">{node.chatMode}</span>
                                </div>
                                <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-blue-500" />
                            </button>
                        ))}
                        {nodes.filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                            <div className={`px-4 py-8 text-sm opacity-50 text-center flex flex-col items-center gap-2 ${
                                theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                            }`}>
                                <Search size={24} className="opacity-20" />
                                <span>No chats found</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        ) : (
            <button 
                onClick={() => setIsSearchOpen(true)}
                className={`p-2 rounded-lg border backdrop-blur transition-all ${
                    theme === 'dark' 
                    ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700' 
                    : 'bg-white/80 border-slate-200 text-slate-600 hover:bg-slate-100 shadow-sm'
                }`}
                title="Search chats"
            >
                <Search size={18} />
            </button>
        )}
      </div>

      {/* Top Right Controls: Jump to Last */}
      <div className="absolute top-4 right-4 z-50 flex gap-2">
         <button
             onClick={handleJumpToLast}
             className={`p-2 rounded-lg border backdrop-blur transition-all ${
                 theme === 'dark' 
                 ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700' 
                 : 'bg-white/80 border-slate-200 text-slate-600 hover:bg-slate-100 shadow-sm'
             }`}
             title="Jump to latest chat"
         >
             <ArrowRightFromLine size={18} />
         </button>
      </div>

      {/* Bottom Left: Add New Window Button */}
      <div className="absolute bottom-6 left-6 z-50">
        <button 
            onClick={() => addNode(-viewport.x/viewport.zoom + 200, -viewport.y/viewport.zoom + 200)}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-105 active:scale-95 ${
                theme === 'dark' 
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30' 
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30'
            }`}
            title="Add New Chat Window"
        >
             <Plus size={32} />
        </button>
      </div>

      {/* Bottom Right: Zoom Controls */}
      <div className={`absolute bottom-6 right-6 z-50 flex gap-2 backdrop-blur p-1 rounded-lg border transition-colors ${
          theme === 'dark' ? 'bg-slate-800/80 border-slate-700' : 'bg-white/80 border-slate-200 shadow-sm'
      }`}>
         <button onClick={() => setViewport(v => ({...v, zoom: v.zoom * 0.9}))} className={`p-2 rounded transition-colors ${
             theme === 'dark' ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
         }`}>
            <ZoomOut size={18} />
         </button>
         <span className={`flex items-center text-xs px-2 font-mono ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
             {Math.round(viewport.zoom * 100)}%
         </span>
         <button onClick={() => setViewport(v => ({...v, zoom: v.zoom * 1.1}))} className={`p-2 rounded transition-colors ${
             theme === 'dark' ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
         }`}>
            <ZoomIn size={18} />
         </button>
      </div>

      <div 
        ref={contentRef}
        className="absolute origin-top-left transition-transform duration-75 ease-out"
        style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`
        }}
      >
        <ConnectionLayer 
            nodes={nodes} 
            edges={edges} 
            contentRef={contentRef} 
            viewport={viewport} 
            hoveredNodeId={hoveredNodeId} 
        />

        {nodes.map(node => (
            <div key={node.id} style={{ display: isNodeVisible(node) ? 'block' : 'none' }}>
                <ChatWindow 
                    node={node}
                    scale={viewport.zoom}
                    updateNode={updateNode}
                    removeNode={removeNode}
                    onFocus={() => bringToFront(node.id)}
                    onBranch={handleBranch}
                    layerControls={{
                        bringToFront: () => bringToFront(node.id),
                        sendToBack: () => sendToBack(node.id),
                        bringForward: () => bringForward(node.id),
                        sendBackward: () => sendBackward(node.id)
                    }}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    onJumpToParent={() => node.parentId && focusNode(node.parentId)}
                />
            </div>
        ))}
      </div>
    </div>
  );
};

export default CanvasBoard;