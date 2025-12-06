import React, { useEffect, useState } from 'react';
import { CanvasNode, CanvasEdge } from '../../types';

interface ConnectionLayerProps {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  contentRef: React.RefObject<HTMLDivElement>;
  viewport: { x: number; y: number; zoom: number };
  hoveredNodeId: string | null;
}

const ConnectionLayer: React.FC<ConnectionLayerProps> = ({ nodes, edges, contentRef, viewport, hoveredNodeId }) => {
  const [paths, setPaths] = useState<{ id: string, d: string, isHighlighted: boolean, isDimmed: boolean }[]>([]);

  useEffect(() => {
    // Recalculate paths whenever nodes move, edges change, or viewport updates
    const newPaths = edges.map(edge => {
        const fromNode = nodes.find(n => n.id === edge.fromNode);
        const toNode = nodes.find(n => n.id === edge.toNode);
        
        // If either node is missing (e.g. deleted), skip rendering
        if (!fromNode || !toNode) return null;

        // Highlighting Logic
        const isHighlighted = hoveredNodeId === edge.toNode || hoveredNodeId === edge.fromNode;
        // If something is hovered but it's not this edge, dim it
        const isDimmed = hoveredNodeId !== null && !isHighlighted;

        // Default Anchor: Center-Right of Source Node
        let startX = fromNode.x + fromNode.width;
        let startY = fromNode.y + (fromNode.height / 2);

        // Precise Anchor: Specific Message Bubble
        if (edge.fromMessageId) {
            const msgEl = document.getElementById(`msg-${fromNode.id}-${edge.fromMessageId}`);
            
            // Check if element exists and is actually rendered (visible)
            // Virtualized nodes (display: none) will have 0 width/height
            if (msgEl && contentRef.current) {
                const msgRect = msgEl.getBoundingClientRect();
                
                if (msgRect.width > 0 && msgRect.height > 0) {
                     const contentRect = contentRef.current.getBoundingClientRect();
                     const scale = viewport.zoom;
                     
                     // Convert Screen Coordinates back to Canvas Local Coordinates
                     startX = (msgRect.right - contentRect.left) / scale;
                     startY = (msgRect.top - contentRect.top + (msgRect.height / 2)) / scale;
                }
            }
        }

        // Target Anchor: Top-Left Header area of Target Node
        const endX = toNode.x;
        const endY = toNode.y + 28; // Approx center of header height

        // Calculate Bezier Control Points for smooth S-curve
        const dist = Math.abs(endX - startX);
        const controlOffset = Math.min(dist * 0.5, 150); // Cap the curve depth

        const cp1x = startX + controlOffset;
        const cp1y = startY;
        const cp2x = endX - controlOffset;
        const cp2y = endY;

        return {
            id: edge.id,
            d: `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`,
            isHighlighted,
            isDimmed
        };
    }).filter(Boolean) as { id: string, d: string, isHighlighted: boolean, isDimmed: boolean }[];

    setPaths(newPaths);
  }, [nodes, edges, viewport, contentRef, hoveredNodeId]);

  return (
    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible z-0">
      <style>
        {`
          @keyframes drawLine {
            from { stroke-dashoffset: 1; }
            to { stroke-dashoffset: 0; }
          }
          .animate-draw {
            stroke-dasharray: 1;
            stroke-dashoffset: 1;
            animation: drawLine 0.8s ease-out forwards;
          }
        `}
      </style>
      <defs>
          <marker 
            id="arrowhead" 
            markerWidth="10" 
            markerHeight="7" 
            refX="9" 
            refY="3.5" 
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" opacity="0.6" />
          </marker>
           <marker 
            id="arrowhead-highlight" 
            markerWidth="10" 
            markerHeight="7" 
            refX="9" 
            refY="3.5" 
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#06b6d4" opacity="1" />
          </marker>
      </defs>
      {paths.map(path => (
        <path
          key={path.id}
          d={path.d}
          pathLength="1"
          stroke={path.isHighlighted ? "#06b6d4" : "#64748b"}
          strokeWidth={path.isHighlighted ? "3" : "2"}
          strokeOpacity={path.isHighlighted ? "1" : (path.isDimmed ? "0.1" : "0.4")}
          fill="none"
          markerEnd={path.isHighlighted ? "url(#arrowhead-highlight)" : "url(#arrowhead)"}
          className="transition-all duration-200 ease-linear animate-draw" 
          style={{ zIndex: path.isHighlighted ? 100 : 0 }}
        />
      ))}
    </svg>
  );
};

export default ConnectionLayer;