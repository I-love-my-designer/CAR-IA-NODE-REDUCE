
import React, { useState, useRef, useCallback, useMemo, useEffect, forwardRef, useImperativeHandle } from 'react';
import { NodeType, NodeState, Connection, DragState, WorkspaceStats, CompositingJob } from '../types';
import { 
  X, Image as ImageIcon, Type, Loader2, Combine, List, Sparkles, Palette, Plus, Minus, Copy, Trash2, Download, Asterisk, GripHorizontal, Upload, FileImage, Check,
  AlignStartHorizontal, AlignEndHorizontal, AlignStartVertical, AlignEndVertical, Monitor, Scan, Play, Cpu, Trash, Layout, ArrowUpToLine, ArrowDownToLine, MousePointer2, ListFilter,
  Columns2, Rows2, ZoomIn, Power, Key, ToggleLeft, ToggleRight, Eye, Scissors, RotateCcw, Undo2,
  ChevronDown, ChevronRight, Layers, Bell
} from 'lucide-react';
import * as GeminiService from '../services/geminiService';
import * as ImageService from '../services/imageService';
import { 
  updateJobStatus, 
  resolveBackgroundUrl, 
  resolveLogoUrl, 
  resolveBackgroundUrlAsync, 
  resolveLogoUrlAsync,
  compressBase64Image
} from '../services/firebaseService';
import firebaseConfig from '../firebase-applet-config.json';

const NODE_WIDTH = 260;
const HEADER_HEIGHT = 54;
const BODY_PADDING_TOP = 12;
const ROW_HEIGHT = 26;

const CAT_COLORS = {
  ZONE: '#fef08a',
  CREATION: '#d946ef',
  MOTEUR_STYLE: '#8b5cf6',
  MOTEUR_RENDU: '#3b82f6',
  MOTEUR_VISION: '#10b981', 
  ACTION: '#f59e0b',
  UTILITY: '#64748b'
};

const FirebaseBackgroundPreview = ({ 
  bgId, 
  imgSrc, 
  layer, 
  className 
}: { 
  bgId: string; 
  imgSrc: string; 
  layer: any; 
  className?: string 
}) => {
  const [resolvedUrl, setResolvedUrl] = useState<string>(imgSrc);

  useEffect(() => {
    let active = true;
    if (bgId) {
      resolveBackgroundUrlAsync(bgId).then(url => {
        if (active && url) {
          setResolvedUrl(url);
        }
      }).catch(err => {
        console.error("Failed to resolve bg url async:", bgId, err);
      });
    } else {
      setResolvedUrl(imgSrc);
    }
    return () => {
      active = false;
    };
  }, [bgId, imgSrc]);

  return (
    <img 
      src={resolvedUrl}
      className={className}
      style={{
        width: layer.fit ? '100%' : 'auto',
        height: layer.fit ? '100%' : 'auto',
        objectFit: layer.fit ? 'cover' : 'contain',
        transform: layer.fit ? 'none' : `scale(${layer.scale})`,
        maxWidth: layer.fit ? 'none' : '100%',
        maxHeight: layer.fit ? 'none' : '100%'
      }}
      referrerPolicy="no-referrer"
    />
  );
};

const FirebaseLogoPreview = ({ 
  logoId, 
  logoSrc,
  logoX, 
  logoY, 
  logoSize,
  logoColor
}: { 
  logoId?: string; 
  logoSrc?: string;
  logoX: number; 
  logoY: number; 
  logoSize: any;
  logoColor?: string;
}) => {
  const [resolvedUrl, setResolvedUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    if (logoSrc) {
      setResolvedUrl(logoSrc);
    } else if (logoId) {
      resolveLogoUrlAsync(logoId).then(url => {
        if (active && url) {
          setResolvedUrl(url);
        }
      }).catch(err => {
        console.error("Failed to resolve logo url async:", logoId, err);
      });
    } else {
      setResolvedUrl('');
    }
    return () => {
      active = false;
    };
  }, [logoId, logoSrc]);

  if (!resolvedUrl) return null;

  const lSize = Number(logoSize) || 120;
  const scaleFactor = 228 / 1024;
  const pxX = logoX * scaleFactor;
  const pxY = logoY * scaleFactor;
  const pxSize = lSize * scaleFactor;

  return (
    <div 
      className="absolute pointer-events-none flex items-center justify-center overflow-hidden"
      style={{
        zIndex: 50,
        left: `${pxX}px`,
        top: `${pxY}px`,
        width: `${pxSize}px`,
        height: `${pxSize}px`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <img 
        src={resolvedUrl}
        className="max-w-full max-h-full object-contain pointer-events-none"
        alt="Logo preset overlay"
        referrerPolicy="no-referrer"
        style={{
          filter: logoColor ? `drop-shadow(0px 0px 1px ${logoColor})` : 'drop-shadow(0px 2px 4px rgba(0,0,0,0.5))',
        }}
      />
    </div>
  );
};

const DEFAULT_NEGATIVE_LLM = 'portrait, face, distorted, messy, low quality, high contrast, extra objects, cluttered, texts, logo, watermark, signs, cars, furniture, numbers, letters, dimensions, text';

const TYPE_CONFIG: Record<string, { label: string, color: string, icon: any }> = {
  [NodeType.ZONE]: { label: 'ZONE', color: CAT_COLORS.ZONE, icon: Layout },
  [NodeType.PROMPT_INPUT]: { label: 'PROMPT', color: CAT_COLORS.CREATION, icon: Type },
  [NodeType.COMBO_SELECTOR]: { label: "COMBO SELECTOR", color: CAT_COLORS.CREATION, icon: ListFilter },
  [NodeType.PROMPT_CONCATENATOR]: { label: 'CONCATENATOR', color: CAT_COLORS.CREATION, icon: Combine },
  [NodeType.LLM_PROCESSOR]: { label: 'LLM PROCESSOR', color: CAT_COLORS.CREATION, icon: Sparkles },
  [NodeType.ARRAY_SPLITTER]: { label: 'ARRAY', color: CAT_COLORS.MOTEUR_STYLE, icon: Asterisk },
  [NodeType.LIST_SELECTOR]: { label: 'LIST SELECTOR', color: CAT_COLORS.MOTEUR_STYLE, icon: List },
  [NodeType.STYLE_SELECTOR]: { label: 'STYLE', color: CAT_COLORS.ACTION, icon: Palette },
  [NodeType.IMAGE_INPUT]: { label: 'REFERENCE IMAGES', color: CAT_COLORS.MOTEUR_VISION, icon: FileImage },
  [NodeType.IMAGE_GENERATOR]: { label: 'IMAGE GENERATOR', color: CAT_COLORS.MOTEUR_RENDU, icon: ImageIcon },
  [NodeType.IMAGE_MODEL_SELECTOR]: { label: "MODÈLE D'IA", color: CAT_COLORS.MOTEUR_RENDU, icon: Cpu },
  [NodeType.FORMAT_SELECTOR]: { label: 'FORMAT', color: CAT_COLORS.MOTEUR_RENDU, icon: Scan },
  [NodeType.RESOLUTION_SELECTOR]: { label: 'RESOLUTION', color: CAT_COLORS.MOTEUR_RENDU, icon: Monitor },
  [NodeType.GENERATE_TRIGGER]: { label: 'TRIGGER', color: CAT_COLORS.UTILITY, icon: Play },
  [NodeType.ON_OFF]: { label: "ON/OFF", color: CAT_COLORS.UTILITY, icon: Power },
  [NodeType.RESULT_VIEWER]: { label: "VIEWER", color: CAT_COLORS.MOTEUR_VISION, icon: Eye },
  [NodeType.BACKGROUND_REMOVER]: { label: "BG REMOVER", color: CAT_COLORS.MOTEUR_VISION, icon: Scissors },
  [NodeType.POST_PROCESS]: { label: "POST-PROCESS", color: CAT_COLORS.ACTION, icon: Scan },
  [NodeType.COMPOSITOR]: { label: "COMPOSITOR", color: CAT_COLORS.ACTION, icon: Layers },
  [NodeType.EXPORT]: { label: "EXPORT", color: CAT_COLORS.UTILITY, icon: Upload },
};

const RATIOS = ['16:9', '4:3', '1:1', '3:4', '9:16'];
const RESOLUTIONS = ['1K', '2K', '4K'];
const MODELS = [
  { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash', maxRes: '1K' },
  { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro', maxRes: '4K' }
];

const STYLES = [
  { name: 'PORTRAITS', prompt: 'Professional portrait photography, high detail, studio lighting, sharp focus, expressive facial features.' },
  { name: 'ART & ILLUSTRATIONS', prompt: 'Stylized digital art illustration, vibrant colors, creative composition, artistic textures.' },
  { name: 'VIDEOGAME ASSETS', prompt: 'High-quality videogame asset, low-poly or high-poly detail, game engine render style, isolated on clean background.' },
  { name: 'NATURE & LANDSCAPES', prompt: 'Epic nature landscape photography, breathtaking scenery, natural daylight, wide angle view.' },
  { name: 'FILMS & PHOTOGRAPHY', prompt: 'Cinematic film still, 35mm film photography texture, high-end production lighting, moody atmosphere.' },
  { name: '3D LOW POLY', prompt: '3D low poly art style, geometric shapes, vibrant pastel colors, isometric perspective, clean render.' },
  { name: 'PHOTO STUDIO PACKSHOT PREMIUM', prompt: 'Premium commercial packshot photography, luxury studio lighting, minimalist composition, crisp details.' },
  { name: 'SCIENCE FICTION & HORROR', prompt: 'Dark sci-fi horror atmosphere, eerie neon lighting, futuristic decay, suspenseful mood.' },
  { name: 'POLAROID', prompt: 'Authentic vintage polaroid photo, soft film grain, nostalgic colors, spontaneous lifestyle vibe.' },
  { name: 'WES ANDERSON', prompt: 'Wes Anderson movie style, perfect symmetry, pastel color palette, whimsical and detailed production design.' }
];

const BACKGROUND_CATALOG: Record<string, Record<string, string>> = {
  "1 URBAN": {
    "CITY (CITY 01...)": "CITY",
    "INDUSTRIAL (INDUS 01...)": "INDUS",
    "NIGHT CITY (SPORT 01...)": "SPORT",
    "PARKING (PARKING 01...)": "PARKING"
  },
  "2 NATURE": {
    "DESERT (DESERT 01...)": "DESERT",
    "FOREST (FOREST 01...)": "FOREST",
    "MOUTAIN (MONTAGNE 01...)": "MONTAGNE",
    "SEASIDE (SEASIDE 01...)": "SEASIDE"
  },
  "3 DESIGN": {
    "OUTSIDE (OUTSIDE 01)": "OUTSIDE",
    "STUDIO (STUDIO 01...)": "STUDIO",
    "CONCRETE (CONCRETE 01...)": "CONCRETE",
    "WOOD (WOOD 01...)": "WOOD"
  },
  "4 MINIMAL": {
    "LANDSCAPE (LANDSCAPE 01...)": "LANDSCAPE",
    "ARCHGITECTURE (ARCHI 01...)": "ARCHI",
    "MATERIALS (MTX 01...)": "MTX",
    "VEGETATION (VGX 01...)": "VGX"
  }
};

const INITIAL_NODES: NodeState[] = [
  // 4-LAYER STRUCTURED COMPOSITING CANVAS (PWA & FIREBASE INTAKES)
  { id: 'bgImages', type: NodeType.IMAGE_INPUT, x: 100, y: 100, w: 260, h: 500, data: { label: 'IMAGE DE FOND (FIREBASE)', images: [], selectedImageIndex: 0, isOn: true, sourceType: 'firebase', firebaseId: 'CITY 01' }, inputs: {}, outputs: {} },
  { id: 'logoImages', type: NodeType.IMAGE_INPUT, x: 390, y: 100, w: 260, h: 500, data: { label: 'IMAGE DU LOGO (FIREBASE)', images: [], selectedImageIndex: 0, isOn: true, sourceType: 'firebase', firebaseId: 'LOGOS/B/BENTLEY_01' }, inputs: {}, outputs: {} },
  
  { id: 'vehicleImages', type: NodeType.IMAGE_INPUT, x: 100, y: 650, w: 260, h: 500, data: { label: 'IMAGE DU VÉHICULE (PWA)', images: [], selectedImageIndex: 0, isOn: true, sourceType: 'upload' }, inputs: {}, outputs: {} },
  { id: 'textNode', type: NodeType.PROMPT_INPUT, x: 390, y: 650, w: 260, h: 320, data: { label: 'TEXTE DU PRESET (PWA)', value: 'BENTLEY GT SPEED', isOn: true }, inputs: {}, outputs: {} },
  
  { id: 'compositor1', type: NodeType.COMPOSITOR, x: 740, y: 200, w: 400, h: 900, data: { label: 'COMPOSITEUR', imageInputCount: 2, layers: [{ scale: 1, x: 0, y: 0, rotation: 0, fit: true }, { scale: 1, x: 0, y: 0, rotation: 0 }], isOn: true, logo: true, text: true, logoSize: '120', logoPosition: '512/320', logoColor: '#ffffff', textFontSize: '40', textPosition: '512/820', textColor: '#ffffff', fontWeight: 'bold', textValue: 'BENTLEY GT SPEED' }, inputs: {}, outputs: {} },
  { id: 'viewer3', type: NodeType.RESULT_VIEWER, x: 1200, y: 200, w: 400, h: 800, data: { label: 'COMPOSITION FINALE AI', isOn: true }, inputs: {}, outputs: {} }
];

const INITIAL_CONNECTIONS: Connection[] = [
  { id: 'c_bg_comp', sourceNodeId: 'bgImages', sourceHandle: 'imageOut', targetNodeId: 'compositor1', targetHandle: 'image0' },
  { id: 'c_vh_comp', sourceNodeId: 'vehicleImages', sourceHandle: 'imageOut', targetNodeId: 'compositor1', targetHandle: 'image1' },
  { id: 'c_logo_comp', sourceNodeId: 'logoImages', sourceHandle: 'imageOut', targetNodeId: 'compositor1', targetHandle: 'logo' },
  { id: 'c_text_comp', sourceNodeId: 'textNode', sourceHandle: 'textOut', targetNodeId: 'compositor1', targetHandle: 'text' },
  { id: 'c_comp_v3', sourceNodeId: 'compositor1', sourceHandle: 'imageOut', targetNodeId: 'viewer3', targetHandle: 'imageIn' }
];


interface NodeGraphProps {
  onStatsChange?: (stats: WorkspaceStats) => void;
}

const DistributeHorizontalIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="7" width="4" height="10" rx="1" />
    <rect x="10" y="4" width="4" height="16" rx="1" />
    <rect x="17" y="9" width="4" height="6" rx="1" />
  </svg>
);

const DistributeVerticalIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="7" y="3" width="10" height="4" rx="1" />
    <rect x="4" y="10" width="16" height="4" rx="1" />
    <rect x="9" y="17" width="6" height="4" rx="1" />
  </svg>
);

const FitViewIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 8V5a2 2 0 0 1 2-2h3" />
    <path d="M16 3h3a2 2 0 0 1 2 2v3" />
    <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
    <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
  </svg>
);

const getContrastColor = (hex: string) => {
  if (!hex || hex === 'transparent') return 'white';
  const color = hex.replace('#', '');
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';
};

const compressImage = (base64: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      const MAX_SIZE = 1200;
      
      if (width > height && width > MAX_SIZE) {
        height *= MAX_SIZE / width;
        width = MAX_SIZE;
      } else if (height > MAX_SIZE) {
        width *= MAX_SIZE / height;
        height = MAX_SIZE;
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png')); 
      } else {
        resolve(base64); // Fallback
      }
    };
    img.src = base64;
  });
};

const PP_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b'
];

const PostProcessFields: React.FC<{
  node: NodeState;
  setNodes: React.Dispatch<React.SetStateAction<NodeState[]>>;
  resolveValue: (nodeId: string, handleId: string) => any;
  handleAction: (nodeId: string) => Promise<void>;
  isRightPanel?: boolean;
}> = ({ node, setNodes, resolveValue, handleAction, isRightPanel = false }) => {
  const image = resolveValue(node.id, 'imageIn');
  const postProcesses = node.data.postProcesses || [];
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);
  const [selectedPPId, setSelectedPPId] = useState<string | null>(null);
  const expandedId = node.data.expandedPPId !== undefined ? node.data.expandedPPId : (postProcesses[0]?.id || null);
  const containerRef = useRef<HTMLDivElement>(null);

  const setExpandedId = (id: string | null) => {
    setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, expandedPPId: id } } : n));
  };

  const updatePP = (id: string, updates: Partial<any>) => {
    setNodes(ns => ns.map(n => n.id === node.id ? {
      ...n,
      data: {
        ...n.data,
        postProcesses: n.data.postProcesses.map((pp: any) => pp.id === id ? { ...pp, ...updates } : pp)
      }
    } : n));
  };

  const addPP = (type: 'text' | 'image') => {
    const nextId = (postProcesses.length + 1);
    const newPP = {
      id: `pp-${Date.now()}`,
      label: `POST-PROCESS ${String(nextId).padStart(2, '0')}`,
      active: true,
      color: PP_COLORS[(nextId - 1) % PP_COLORS.length],
      x: 0.5,
      y: 0.5,
      size: 1.0,
      inputType: type === 'text' ? 'text' : 'logo',
      textValue: '',
      logoUrl: null,
      prompt: 'Perfectly integrated material texture, perspective and lighting',
      mode: 'extrude',
      surface: 'wall',
      orientation: 'vertical', // 'vertical' (standing) or 'horizontal' (lying)
      rotation: 0,
      skewX: 0,
      skewY: 0
    };
    setNodes(ns => ns.map(n => n.id === node.id ? {
      ...n,
      data: { ...n.data, postProcesses: [...(n.data.postProcesses || []), newPP] }
    } : n));
    setExpandedId(newPP.id);
  };

  const removePP = (id: string) => {
    setNodes(ns => ns.map(n => n.id === node.id ? {
      ...n,
      data: { ...n.data, postProcesses: n.data.postProcesses.filter((pp: any) => pp.id !== id) }
    } : n));
  };

  const handlePPDrag = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const pp = postProcesses.find((p: any) => p.id === id);
    if (!pp) return;
    const initialX = pp.x;
    const initialY = pp.y;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) / rect.width;
      const dy = (moveEvent.clientY - startY) / rect.height;
      updatePP(id, {
        x: Math.max(0, Math.min(1, initialX + dx)),
        y: Math.max(0, Math.min(1, initialY + dy))
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div className="flex flex-col h-full space-y-2">
      {/* Main Viewer */}
      <div 
        ref={containerRef}
        className="relative rounded-xl border border-white/10 overflow-hidden group select-none aspect-square w-full shadow-inner checkerboard"
        onMouseDown={e => e.stopPropagation()}
      >
        {image ? (
          <img src={image} className="w-full h-full object-contain" alt="Process target" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/5 uppercase font-black text-2xl">NO IMAGE</div>
        )}

        {/* Overlays */}
        {postProcesses.map((pp: any, idx: number) => {
          if (!pp.active) return null;
          const boxSize = (pp.size * 0.2) * 100; // default 1/5th = 20%
          const connectedVal = resolveValue(node.id, pp.inputType === 'text' ? `text${idx}` : `logo${idx}`);
          const val = (connectedVal !== null && connectedVal !== undefined && connectedVal !== "") ? connectedVal : (pp.inputType === 'text' ? pp.textValue : (pp.inputType === 'logo' ? pp.logoUrl : null));

          const userScale = pp.size || 1.0;
          const unitPercentage = userScale * 0.25; 

          let finalW = unitPercentage;
          let finalH = unitPercentage;

          if (pp.inputType === 'text') {
            const textVal = String(val || "");
            const ratio = 9.2; // Adjusted ratio for a tighter fit to characters
            finalW = (Math.max(1, textVal.length) / ratio) * userScale * 0.25;
            finalH = (userScale * 0.25) / 5;
          }

          return (
            <div 
              key={pp.id}
              className={`absolute border-2 cursor-move flex items-center justify-center transition-all group/box select-none overflow-hidden ${pp.surface === 'floor' ? 'shadow-[0_10px_20px_-10px_rgba(255,255,255,0.2)]' : ''}`}
              style={{
                left: `${pp.x * 100}%`,
                top: `${pp.y * 100}%`,
                width: `${Math.max(5, finalW * 100)}%`,
                height: `${Math.max(2, finalH * 100)}%`,
                transform: `translate(-50%, -50%) ${pp.surface === 'floor' ? 'perspective(1000px) rotateX(15deg)' : ''}`,
                borderColor: pp.color,
                backgroundColor: `${pp.color}10`,
                zIndex: selectedPPId === pp.id ? 50 : 40 - idx,
              }}
              onMouseDown={(e) => {
                setSelectedPPId(pp.id);
                setExpandedId(pp.id);
                handlePPDrag(pp.id, e);
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none [container-type:size] w-full h-full">
                {pp.inputType === 'logo' && val ? (
                   <img 
                     src={val} 
                     className={`w-full h-full object-contain ${pp.mode === 'cutout' ? 'brightness-0' : 'brightness-200'}`} 
                     draggable="false"
                     onDragStart={e => e.preventDefault()}
                     alt="Logo" 
                   />
                ) : pp.inputType === 'text' ? (
                   <span 
                     className={`font-black text-center whitespace-nowrap px-1 leading-none ${pp.mode === 'cutout' ? 'text-black' : 'text-white'}`} 
                     style={{ 
                       fontSize: '90cqh', 
                       textShadow: pp.mode === 'extrude' ? '0 1px 2px rgba(0,0,0,0.5)' : 'none'
                     }}
                   >
                     {val || "TEXT"}
                   </span>
                ) : null}
              </div>
              {/* Corner indicators */}
              <div className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2" style={{ borderColor: pp.color }} />
              <div className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2" style={{ borderColor: pp.color }} />
              <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2" style={{ borderColor: pp.color }} />
              <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2" style={{ borderColor: pp.color }} />
            </div>
          );
        })}
      </div>

      {/* Options Panel */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar" onMouseDown={e => e.stopPropagation()}>
        {postProcesses.map((pp: any, idx: number) => (
          <div key={pp.id} className={`p-2 rounded-xl border transition-all ${pp.active ? 'bg-white/5 border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.2)]' : 'bg-transparent border-white/5 opacity-50'}`}>
            <div 
              className="flex items-center gap-2 mb-0.5 cursor-pointer"
              onClick={() => setExpandedId(expandedId === pp.id ? null : pp.id)}
            >
              <div className="p-0.5 rounded hover:bg-white/5 transition-colors">
                {expandedId === pp.id ? <ChevronDown size={12} className="text-white/40" /> : <ChevronRight size={12} className="text-white/40" />}
              </div>

              {/* Color and Selector */}
              <div className="relative">
                <button 
                  onClick={(e) => { e.stopPropagation(); setColorPickerOpen(colorPickerOpen === pp.id ? null : pp.id); }}
                  onMouseDown={e => e.stopPropagation()}
                  className="w-4 h-4 rounded-md border border-white/20 shadow-inner"
                  style={{ backgroundColor: pp.color }}
                />
                {colorPickerOpen === pp.id && (
                  <div className="absolute top-6 left-0 z-50 bg-gray-900 border border-white/10 p-2 rounded-xl shadow-2xl grid grid-cols-6 gap-1 w-[140px]">
                    {PP_COLORS.map(c => (
                      <button 
                        key={c}
                        onClick={() => { updatePP(pp.id, { color: c }); setColorPickerOpen(null); }}
                        className="w-4 h-4 rounded-sm border border-transparent hover:border-white transition-all shadow-sm"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <span className="text-[9px] font-black uppercase tracking-widest text-white/80 shrink-0">{pp.label}</span>

              {/* Toggle and Delete in Header */}
              <div className="flex items-center gap-1.5 shrink-0 ml-auto" onMouseDown={e => e.stopPropagation()}>
                <button onClick={(e) => { e.stopPropagation(); updatePP(pp.id, { active: !pp.active }); }} className={`p-1 rounded-lg transition-all ${pp.active ? 'bg-blue-500 text-white' : 'bg-white/5 text-white/40'}`}>
                  <Eye size={10} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); removePP(pp.id); }} className="p-1 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all">
                  <Trash2 size={10} />
                </button>
              </div>
            </div>

            {expandedId === pp.id && (
              <div className="space-y-1.5 pt-0.5 border-t border-white/5 mt-0.5">
                {/* Mode Switch */}
                <div 
                  className="flex backdrop-blur-xl bg-white/5 rounded-lg border border-white/5 p-0.5 h-6 w-full"
                  onMouseDown={e => e.stopPropagation()}
                >
                  {['extrude', 'cutout'].map(m => (
                    <button 
                      key={m}
                      onClick={() => updatePP(pp.id, { mode: m })}
                      className={`flex-1 rounded-[4px] text-[7px] font-black uppercase transition-all ${pp.mode === m ? 'bg-white/10 text-white shadow-xl' : 'text-white/30 hover:text-white/50'}`}
                    >
                      {m === 'extrude' ? 'EXTRUDER' : 'TROUER'}
                    </button>
                  ))}
                </div>

                <div className="space-y-0.5">
                  <span className="text-[7px] font-black text-white/30 uppercase tracking-widest leading-none">PLACEMENT</span>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => updatePP(pp.id, { surface: 'wall' })}
                      className={`flex-1 rounded-[4px] py-1 text-[7px] font-black uppercase transition-all border ${pp.surface !== 'floor' ? 'bg-white/10 text-white border-white/20' : 'text-white/30 border-transparent hover:text-white/50'}`}
                    >
                      MUR
                    </button>
                    <button 
                      onClick={() => updatePP(pp.id, { surface: 'floor' })}
                      className={`flex-1 rounded-[4px] py-1 text-[7px] font-black uppercase transition-all border ${pp.surface === 'floor' ? 'bg-white/10 text-white border-white/20' : 'text-white/30 border-transparent hover:text-white/50'}`}
                    >
                      SOL
                    </button>
                  </div>
                </div>

                <div className="space-y-0.5">
                  <div className="flex justify-between items-end">
                    <span className="text-[7px] font-black text-white/30 uppercase tracking-widest leading-none">SIZE ({pp.size.toFixed(2)})</span>
                    <input 
                      type="number" step="0.01" min="0.5" max="2.0" value={pp.size} 
                      onChange={e => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v)) updatePP(pp.id, { size: v });
                      }}
                      onBlur={e => {
                        const v = parseFloat(e.target.value);
                        if (isNaN(v)) updatePP(pp.id, { size: 1.0 });
                        else updatePP(pp.id, { size: Math.max(0.5, Math.min(2.0, v)) });
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const target = e.target as HTMLInputElement;
                          const v = parseFloat(target.value);
                          if (!isNaN(v)) updatePP(pp.id, { size: Math.max(0.5, Math.min(2.0, v)) });
                          target.blur();
                        }
                      }}
                      onMouseDown={e => e.stopPropagation()}
                      className="bg-transparent text-[8px] text-right font-bold text-white/50 w-12 outline-none" 
                    />
                  </div>
                  <input 
                    type="range" min="0.5" max="2.0" step="0.01" value={pp.size}
                    onChange={e => updatePP(pp.id, { size: parseFloat(e.target.value) })}
                    onMouseDown={e => e.stopPropagation()}
                    className="w-full accent-blue-500 h-1 bg-white/5 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-[1.5] space-y-0.5 overflow-hidden">
                    <div className="flex items-center gap-1.5 h-3">
                      <button 
                        onClick={() => updatePP(pp.id, { inputType: 'text' })}
                        className={`w-3.5 h-3.5 flex-shrink-0 rounded-sm border flex items-center justify-center transition-all ${pp.inputType === 'text' ? 'bg-blue-500 border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]' : 'bg-black/40 border-white/20 hover:border-white/40'}`}
                      >
                        {pp.inputType === 'text' && <div className="w-1.5 h-1.5 bg-white rounded-[1px]" />}
                      </button>
                      <span className="text-[7px] font-black text-white/30 uppercase tracking-widest leading-none">TEXTE</span>
                    </div>
                    <input 
                      className={`w-full h-8 bg-black/60 border rounded-lg px-2 text-[9px] text-white font-medium outline-none transition-all ${pp.inputType === 'text' ? 'border-white/20' : 'border-white/5 opacity-30 cursor-not-allowed'}`}
                      placeholder="Texte..."
                      value={pp.textValue}
                      onChange={e => pp.inputType === 'text' && updatePP(pp.id, { textValue: e.target.value })}
                      onMouseDown={e => e.stopPropagation()}
                      readOnly={pp.inputType !== 'text'}
                    />
                  </div>
                  <div className="flex-1 space-y-0.5 flex flex-col">
                    <div className="flex items-center gap-1.5 h-3">
                      <button 
                        onClick={() => updatePP(pp.id, { inputType: 'logo' })}
                        className={`w-3.5 h-3.5 flex-shrink-0 rounded-sm border flex items-center justify-center transition-all ${pp.inputType === 'logo' ? 'bg-blue-500 border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]' : 'bg-black/40 border-white/20 hover:border-white/40'}`}
                      >
                        {pp.inputType === 'logo' && <div className="w-1.5 h-1.5 bg-white rounded-[1px]" />}
                      </button>
                      <span className="text-[7px] font-black text-white/30 uppercase tracking-widest leading-none">LOGO</span>
                    </div>
                    <div 
                      className={`w-full h-8 bg-black/60 border border-dashed rounded-lg flex items-center justify-center transition-all cursor-pointer group ${pp.inputType === 'logo' ? (pp.logoUrl ? 'border-blue-500/50' : 'border-white/20 hover:border-white/40') : 'border-white/5 opacity-30 cursor-not-allowed'}`}
                      onMouseDown={e => e.stopPropagation()}
                      onClick={() => {
                        if (pp.inputType !== 'logo') return;
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (e: any) => {
                          const file = e.target.files[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (re) => {
                              updatePP(pp.id, { logoUrl: re.target?.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        };
                        input.click();
                      }}
                    >
                      {pp.logoUrl ? (
                        <img src={pp.logoUrl} className={`w-full h-full object-contain p-1 ${pp.inputType !== 'logo' ? 'grayscale opacity-20' : ''}`} alt="Logo preview" />
                      ) : (
                        <Upload size={10} className={`transition-colors ${pp.inputType === 'logo' ? 'text-white/20 group-hover:text-white/40' : 'text-white/5'}`} />
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[7px] font-black text-white/30 uppercase tracking-widest leading-none">AI INSTRUCTIONS (PROMPT)</span>
                  <textarea 
                    className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 text-[9px] text-white font-medium outline-none h-12 resize-none"
                    value={pp.prompt}
                    onChange={e => updatePP(pp.id, { prompt: e.target.value })}
                    onMouseDown={e => e.stopPropagation()}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="shrink-0 flex gap-2" onMouseDown={e => e.stopPropagation()}>
        <button 
          onClick={() => addPP('text')}
          className="flex-1 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-2 hover:bg-white/10 transition-all group"
        >
          <Plus size={14} className="text-magenta-500" />
          <span className="text-[8px] font-black uppercase tracking-widest">TEXTE</span>
          <Minus size={14} className="text-magenta-500 opacity-20" />
        </button>
        <button 
          onClick={() => addPP('image')}
          className="flex-1 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-2 hover:bg-white/10 transition-all group"
        >
          <Plus size={14} className="text-blue-500" />
          <span className="text-[8px] font-black uppercase tracking-widest">IMAGE</span>
          <Minus size={14} className="text-blue-500 opacity-20" />
        </button>
      </div>
    </div>
  );
};

// Simple IndexedDB Key-Value store for images to bypass localStorage limitations
const ImageCacheDB = {
  dbPromise: null as Promise<IDBDatabase> | null,
  getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open('NodeGenImageCache', 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore('images');
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
    return this.dbPromise;
  },
  async get(key: string): Promise<string | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction('images', 'readonly');
        const store = transaction.objectStore('images');
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<boolean> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction('images', 'readwrite');
        const store = transaction.objectStore('images');
        const request = store.put(value, key);
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  },
  async remove(key: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction('images', 'readwrite');
        const store = transaction.objectStore('images');
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
      });
    } catch {}
  }
};

const isBase64OrHeavyBinary = (val: any): boolean => {
  if (typeof val !== 'string') return false;
  if (val.startsWith('http://') || val.startsWith('https://')) return false;
  if (val.startsWith('dbref:')) return false;
  if (val.startsWith('data:')) return true;
  if (val.length > 5000 && !val.includes(' ')) return true;
  return false;
};

const deepExtractAndCacheBinaries = async (obj: any, basePath: string): Promise<any> => {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    if (isBase64OrHeavyBinary(obj)) {
      await ImageCacheDB.set(basePath, obj);
      return basePath;
    }
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return await Promise.all(obj.map((item, idx) => deepExtractAndCacheBinaries(item, `${basePath}[${idx}]`)));
  }
  
  if (typeof obj === 'object') {
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
      newObj[key] = await deepExtractAndCacheBinaries(obj[key], `${basePath}.${key}`);
    }
    return newObj;
  }
  
  return obj;
};

const deepRestoreBinaries = async (obj: any): Promise<any> => {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    if (obj.startsWith('dbref:')) {
      const dbImg = await ImageCacheDB.get(obj);
      return dbImg || '';
    }
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return await Promise.all(obj.map(item => deepRestoreBinaries(item)));
  }
  
  if (typeof obj === 'object') {
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
      newObj[key] = await deepRestoreBinaries(obj[key]);
    }
    return newObj;
  }
  
  return obj;
};

const prepareNodesForStorage = async (nodesList: NodeState[]): Promise<NodeState[]> => {
  const prepared = await Promise.all(nodesList.map(async (n) => {
    const node = { ...n };
    const cachedData = await deepExtractAndCacheBinaries(node.data, `dbref:${node.id}_data`);
    const cachedOutputs = await deepExtractAndCacheBinaries(node.outputs, `dbref:${node.id}_outputs`);
    return { ...node, data: cachedData, outputs: cachedOutputs };
  }));
  return prepared;
};

export const NodeGraph = forwardRef<{ undo: () => void, exportToJSON: (fileName?: string) => void, importFromJSON: (data: any) => void, injectJob: (job: CompositingJob) => void }, NodeGraphProps>(({ onStatsChange }, ref) => {
  const [view, setView] = useState(() => {
    try {
      const saved = localStorage.getItem('node_graph_view');
      return saved ? JSON.parse(saved) : { x: 50, y: 50, zoom: 0.35 };
    } catch (e) {
      console.warn("Erreur lors du chargement de la vue:", e);
      return { x: 50, y: 50, zoom: 0.35 };
    }
  });
  const [activeJob, setActiveJob] = useState<CompositingJob | null>(null);
  const [selectedBgCat, setSelectedBgCat] = useState<string>("1 URBAN");
  const [selectedBgSubcat, setSelectedBgSubcat] = useState<string>("CITY (CITY 01...)");
  const [selectedBgIndex, setSelectedBgIndex] = useState<string>("01");
  const [autoProcessingState, setAutoProcessingState] = useState<'idle' | 'running_pre' | 'running_bg_image' | 'running_compositing' | 'saving' | 'error'>('idle');
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'reset' | 'clearCache' | null;
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: null,
    title: '',
    message: '',
  });
  const canAlign = selectedNodeIds.length >= 2;
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [hoveredHandle, setHoveredHandle] = useState<{nodeId: string, handleId: string} | null>(null);
  const [dragState, setDragState] = useState<DragState>({ 
    isDragging: false, isConnecting: false, isSelecting: false, isResizing: false,
    nodeId: null, handleId: null, handleType: null, 
    startX: 0, startY: 0, initialNodeX: 0, initialNodeY: 0, 
    currentMouseX: 0, currentMouseY: 0 
  });
  
  const generateId = useCallback((prefix: string = 'node') => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }, []);

  const [nodes, setNodes] = useState<NodeState[]>(() => {
    try {
      const saved = localStorage.getItem('node_graph_nodes');
      const backup = localStorage.getItem('node_graph_nodes_backup');
      const dataToParse = saved || backup;
      
      if (dataToParse) {
        const parsed = JSON.parse(dataToParse);
        if (Array.isArray(parsed)) {
          // Reset processing state on load to prevent getting stuck
          return parsed.map((n: any) => {
            const node = { ...n };
            if (node.id === 'bgRemover' || node.type === NodeType.BACKGROUND_REMOVER) {
              node.type = NodeType.IMAGE_INPUT;
              node.data = {
                ...node.data,
                label: 'Image B (véhicule)',
                images: node.data.images || []
              };
            }
            return {
              ...node,
              data: { ...node.data, isProcessing: false }
            };
          });
        }
      }
      return INITIAL_NODES;
    } catch (e) {
      console.error("Critical error during node restoration:", e);
      return INITIAL_NODES;
    }
  });

  const [storageStatus, setStorageStatus] = useState<'ok' | 'warning' | 'error'>('ok');

  const [connections, setConnections] = useState<Connection[]>(() => {
    try {
      const saved = localStorage.getItem('node_graph_connections');
      const backup = localStorage.getItem('node_graph_connections_backup');
      const dataToParse = saved || backup;
      
      if (dataToParse) {
        const parsed = JSON.parse(dataToParse);
        if (Array.isArray(parsed)) {
          console.log("Workspace: Connections restored successfully.");
          return parsed;
        }
      }
      return INITIAL_CONNECTIONS;
    } catch (e) {
      console.error("Critical error during connections restoration:", e);
      return INITIAL_CONNECTIONS;
    }
  });
  const [history, setHistory] = useState<{ nodes: NodeState[], connections: Connection[] }[]>([]);
  const canvasRef = useRef<HTMLDivElement>(null);

  const saveToHistory = useCallback(() => {
    setHistory(prev => {
      const newState = { nodes: JSON.parse(JSON.stringify(nodes)), connections: JSON.parse(JSON.stringify(connections)) };
      const newHistory = [...prev, newState];
      if (newHistory.length > 50) return newHistory.slice(1);
      return newHistory;
    });
  }, [nodes, connections]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const lastState = history[history.length - 1];
    setNodes(lastState.nodes);
    setConnections(lastState.connections);
    setHistory(prev => prev.slice(0, -1));
  }, [history]);

  const exportToJSON = useCallback((fileName?: string) => {
    const defaultName = `workspace_${new Date().toISOString().split('T')[0]}`;
    const finalName = (fileName || defaultName).trim();
    
    const data = {
      nodes,
      connections,
      view,
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${finalName.endsWith('.json') ? finalName : finalName + '.json'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [nodes, connections, view]);

  const importFromJSON = useCallback((data: any) => {
    try {
      if (data.nodes && Array.isArray(data.nodes)) {
        saveToHistory();
        setNodes(data.nodes);
        if (data.connections && Array.isArray(data.connections)) {
          setConnections(data.connections);
        }
        if (data.view) {
          setView(data.view);
        }
        console.log("Workspace imported successfully.");
      }
    } catch (err) {
      console.error("Error importing workspace:", err);
      alert("Erreur lors de l'importation du fichier JSON.");
    }
  }, [saveToHistory]);

  const injectJob = useCallback((job: CompositingJob) => {
    saveToHistory();
    setActiveJob(job);
    setNodes(nds => {
      // Sort target destination nodes (IMAGE_INPUT and COMPOSITOR) from left to right to use as position fallback
      const targetNodes = nds.filter(node => node.type === NodeType.IMAGE_INPUT || node.type === NodeType.COMPOSITOR);
      const sortedByX = [...targetNodes].sort((a, b) => a.x - b.x);

      return nds.map(node => {
        const posIndex = sortedByX.findIndex(n => n.id === node.id);
        
        // Helper to strip French accents, convert to uppercase, and trim
        const normalizeStr = (str: string) => {
          return str
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase()
            .trim();
        };

        const labelStr = normalizeStr(node.data.label || '');

        let bgScore = 0;
        let fgScore = 0;
        let compScore = 0;

        // Semantic Category Keyword Matches (extremely high weight)
        if (labelStr.includes('FOND') || labelStr.includes('BACKGROUND') || labelStr.includes('DECOR') || labelStr.includes('ARRIERE') || labelStr.includes('BACKDROP')) {
          bgScore += 30;
        }
        if (labelStr.includes('VEHICUL') || labelStr.includes('VEHICLE') || labelStr.includes('VOITURE') || labelStr.includes('CAR') || labelStr.includes('DETOUR')) {
          fgScore += 30;
        }
        if (labelStr.includes('COMPO') || labelStr.includes('COMPOSITION') || labelStr.includes('COMPOSITOR') || labelStr.includes('REFERENCE') || labelStr.includes('REF')) {
          compScore += 30;
        }

        // Generic Number/Letter Matches (medium matching weight)
        if (labelStr.includes('IMAGE 1') || labelStr.includes('IMAGE 01') || labelStr.includes('IMAGE_1') || labelStr.includes('IMAGE A') || labelStr.includes('IMAGE_A')) {
          bgScore += 10;
        }
        if (labelStr.includes('IMAGE 2') || labelStr.includes('IMAGE 02') || labelStr.includes('IMAGE_2') || labelStr.includes('IMAGE B') || labelStr.includes('IMAGE_B')) {
          fgScore += 10;
        }
        if (labelStr.includes('IMAGE 3') || labelStr.includes('IMAGE 03') || labelStr.includes('IMAGE_3') || labelStr.includes('IMAGE C') || labelStr.includes('IMAGE_C')) {
          compScore += 10;
        }

        // Specific absolute fallback matches (system node IDs)
        if (node.id === 'refImages') bgScore += 200;
        if (node.id === 'bgRemover') fgScore += 200;
        if (node.id === 'compositor1') compScore += 200;

        // Decide category based on maximum matching score
        let isBgNode = false;
        let isFgNode = false;
        let isCompNode = false;

        const maxScore = Math.max(bgScore, fgScore, compScore);
        if (maxScore > 0) {
          if (bgScore === maxScore) {
            isBgNode = true;
          } else if (fgScore === maxScore) {
            isFgNode = true;
          } else if (compScore === maxScore) {
            isCompNode = true;
          }
        } else {
          // Absolute position fallback when no keyword matches
          if (posIndex === 0 && sortedByX.length >= 2) {
            isBgNode = true;
          } else if (posIndex === 1 && sortedByX.length >= 2) {
            isFgNode = true;
          } else if (posIndex === 2 && sortedByX.length >= 3) {
            isCompNode = true;
          }
        }

        console.log(`[Target Injection Debug] "${node.data.label}" labelStr="${labelStr}" Category scores -> BG: ${bgScore}, FG: ${fgScore}, COMPO: ${compScore} => isBg=${isBgNode}, isFg=${isFgNode}, isCompo=${isCompNode}`);

        if (isBgNode && node.type === NodeType.IMAGE_INPUT) {
          const rawBg = (job as any).imageA || job.backgroundId || '';
          const bgImg = resolveBackgroundUrl(rawBg);
          const newImages = bgImg ? [bgImg] : [];
          return {
            ...node,
            outputs: { imageOut: bgImg || node.outputs.imageOut },
            data: {
              ...node.data,
              images: newImages,
              selectedImageIndex: bgImg ? 0 : 0,
              isProcessing: false
            }
          };
        }

        if (isFgNode && node.type === NodeType.IMAGE_INPUT) {
          const fgImg = (job as any).imageB || job.vehicleImage || '';
          const newImages = fgImg ? [fgImg] : [];
          return {
            ...node,
            outputs: { imageOut: fgImg || node.outputs.imageOut },
            data: {
              ...node.data,
              images: newImages,
              selectedImageIndex: fgImg ? 0 : 0,
              isProcessing: false
            }
          };
        }

        if (isCompNode) {
          const imgC = (job as any).imageC || (job as any).roughComposite || '';
          if (node.type === NodeType.IMAGE_INPUT) {
            const newImages = imgC ? [imgC] : [];
            return {
              ...node,
              outputs: { imageOut: imgC || node.outputs.imageOut },
              data: {
                ...node.data,
                images: newImages,
                selectedImageIndex: imgC ? 0 : 0,
                isProcessing: false
              }
            };
          } else if (node.type === NodeType.COMPOSITOR) {
            const baseLayers = node.data.layers || [
              { scale: 1, x: 0, y: 0, rotation: 0, fit: true }, 
              { scale: 1, x: 0, y: 0, rotation: 0 }
            ];
            const newLayers = [...baseLayers];
            
            if (newLayers[1]) {
              const vScale = job.vehicleScale !== undefined ? job.vehicleScale : (newLayers[1].scale || 1);
              const vX = job.vehicleX !== undefined ? job.vehicleX : (newLayers[1].x || 0);
              const vY = job.vehicleY !== undefined ? job.vehicleY : (newLayers[1].y || 0);
              const vRotation = job.vehicleRotation !== undefined ? job.vehicleRotation 
                : (job.rotation !== undefined ? job.rotation : (newLayers[1].rotation || 0));
              
              newLayers[1] = {
                ...newLayers[1],
                scale: vScale,
                x: vX,
                y: vY,
                rotation: vRotation,
                fit: false
              };
            }

            return {
              ...node,
              outputs: { imageOut: imgC || node.outputs.imageOut },
              data: {
                ...node.data,
                backgroundId: job.backgroundId,
                layers: newLayers,
                
                // Advanced PWA composition properties
                vehicleScale: job.vehicleScale,
                vehicleX: job.vehicleX,
                vehicleY: job.vehicleY,
                vehicleRotation: job.vehicleRotation !== undefined ? job.vehicleRotation : job.rotation,
                
                logo: job.logo,
                logoId: job.logoId,
                logoSize: job.logoSize,
                logoPosition: job.logoPosition,
                logoColor: job.logoColor,
                
                text: job.text,
                textValue: job.textValue,
                textFontSize: job.textFontSize,
                textFontFamily: job.textFontFamily,
                textPosition: job.textPosition,
                textColor: job.textColor,
                fontWeight: job.fontWeight,
                
                isProcessing: false
              }
            };
          }
        }

        // Select backdrop matching backgroundId in combo1 (COMBO_SELECTOR)
        if (node.id === 'combo1' && job.backgroundId) {
          const comboManual = node.data.additionalText || "";
          const del = node.data.delimiter || '*';
          const items = comboManual.split(del).map(s => s.trim()).filter(s => s.length > 0);
          
          const matchIdx = items.findIndex(item => item.toUpperCase().includes(job.backgroundId.toUpperCase()));
          return {
            ...node,
            outputs: {},
            data: {
              ...node.data,
              selectedIndex: matchIdx !== -1 ? matchIdx : node.data.selectedIndex,
              isProcessing: false
            }
          };
        }

        if (node.id === 'llm1' || node.id === 'imageGen') {
          return {
            ...node,
            outputs: {},
            data: {
              ...node.data,
              isProcessing: false
            }
          };
        }

        return node;
      });
    });
    console.log("Job data injected into graph:", job.id);
  }, [saveToHistory]);

  useImperativeHandle(ref, () => ({
    undo,
    exportToJSON,
    importFromJSON,
    injectJob
  }));

  const resetWorkspace = () => {
    localStorage.removeItem('node_graph_nodes');
    localStorage.removeItem('node_graph_connections');
    localStorage.removeItem('node_graph_view');
    localStorage.removeItem('node_graph_nodes_backup');
    localStorage.removeItem('node_graph_connections_backup');
    setNodes(INITIAL_NODES);
    setConnections(INITIAL_CONNECTIONS);
    setView({ x: 80, y: 150, zoom: 0.45 });
  };

  // Persistence logic with debounce and backup redundancy using IndexedDB for binary content
  const persistenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialized = useRef<boolean>(false);

  // Set as initialized after restoring the DB references
  useEffect(() => {
    const savedVersion = localStorage.getItem('node_graph_version');
    const CURRENT_VERSION = '1.6'; // Force version upgrade reset, clearing all old backups

    if (savedVersion !== CURRENT_VERSION) {
      console.log("Upgrading workspace to version", CURRENT_VERSION);
      resetWorkspace();
      localStorage.setItem('node_graph_version', CURRENT_VERSION);
      isInitialized.current = true;
      return; // Stop and do not load old records/backups
    }

    const loadAndRestore = async () => {
      try {
        const saved = localStorage.getItem('node_graph_nodes');
        const backup = localStorage.getItem('node_graph_nodes_backup');
        const dataToParse = saved || backup;
        
        if (dataToParse) {
          const parsed = JSON.parse(dataToParse);
          if (Array.isArray(parsed)) {
            // Restore images from IndexedDB
            const restored = await Promise.all(parsed.map(async (n: any) => {
              const node = { ...n };
              const restoredData = await deepRestoreBinaries(node.data);
              const restoredOutputs = await deepRestoreBinaries(node.outputs);
              
              // FORCE MIGRATION: If node is 'refImages', update its label
              if (node.id === 'refImages') {
                restoredData.label = 'IMAGE 1 (FOND)';
              }
              
              // FORCE MIGRATION: If node is 'bgRemover' or type is BACKGROUND_REMOVER,
              // force its type to IMAGE_INPUT and name to 'IMAGE 2 (VEHICULE)'.
              if (node.id === 'bgRemover' || node.type === NodeType.BACKGROUND_REMOVER) {
                node.type = NodeType.IMAGE_INPUT;
                restoredData.label = 'IMAGE 2 (VEHICULE)';
                if (!restoredData.images) {
                  restoredData.images = [];
                }
              }

              // FORCE MIGRATION: If node is 'compositor1', update its label to 'IMAGE 3 (COMPOSITION)'
              if (node.id === 'compositor1') {
                restoredData.label = 'IMAGE 3 (COMPOSITION)';
              }

              return {
                ...node,
                outputs: restoredOutputs,
                data: { ...restoredData, isProcessing: false }
              };
            }));
            
            setNodes(restored);
            console.log("Workspace: High-res images restored from IndexedDB cache and migrations applied.");
          }
        }
      } catch (e) {
        console.error("Failed to restore DB references:", e);
      } finally {
        isInitialized.current = true;
      }
    };

    loadAndRestore();
  }, []);

  const saveToPersistence = useCallback((nodesToSave: NodeState[], connectionsToSave: Connection[], viewToSave: any) => {
    if (!isInitialized.current) return;
    if (persistenceTimerRef.current) clearTimeout(persistenceTimerRef.current);
    
    persistenceTimerRef.current = setTimeout(async () => {
      try {
        const preparedNodes = await prepareNodesForStorage(nodesToSave);
        const nodesJson = JSON.stringify(preparedNodes);
        const connJson = JSON.stringify(connectionsToSave);
        const viewJson = JSON.stringify(viewToSave);
        
        localStorage.setItem('node_graph_nodes', nodesJson);
        localStorage.setItem('node_graph_connections', connJson);
        localStorage.setItem('node_graph_view', viewJson);
        setStorageStatus('ok');
      } catch (e) {
        if (e instanceof Error && e.name === 'QuotaExceededError') {
          console.warn("Storage Quota Exceeded despite IndexedDB cache. Clearing local backups.");
          setStorageStatus('warning');
          try {
            localStorage.removeItem('node_graph_nodes_backup');
            localStorage.removeItem('node_graph_connections_backup');
          } catch (e2) {
            console.error("Failed to clear backup keys", e2);
          }
        }
      }
    }, 1000);
  }, []);

  useEffect(() => {
    saveToPersistence(nodes, connections, view);
  }, [nodes, connections, view, saveToPersistence]);

  // Force save on page close
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Avoid raw large saves on unload to prevent QuotaExceeded crashes
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [nodes, connections, view]);

  const bringToFront = useCallback((nodeId: string) => {
    setNodes(prev => {
      const nodeIndex = prev.findIndex(n => n.id === nodeId);
      if (nodeIndex === -1) return prev;
      const newNodes = [...prev];
      const [node] = newNodes.splice(nodeIndex, 1);
      newNodes.push(node);
      return newNodes;
    });
  }, []);

  const resolveValue = useCallback((nodeId: string, handleId: string, visited: Set<string> = new Set()): any => {
    try {
      const contextId = `${nodeId}:${handleId}`;
      if (visited.has(contextId)) return null;
      visited.add(contextId);

      const conn = connections.find(c => c.targetNodeId === nodeId && c.targetHandle === handleId);
      if (conn) {
        const src = nodes.find(n => n.id === conn.sourceNodeId);
        if (src) {
          const sourceHandle = conn.sourceHandle;
          if (src.type === NodeType.ON_OFF) {
            if (!src.data?.isOn) return null;
            return resolveValue(src.id, 'textIn', visited);
          }
          if (src.type === NodeType.PROMPT_INPUT) {
            return src.data?.isOn !== false ? src.data?.value : null;
          }
          if (src.type === NodeType.IMAGE_INPUT) {
            const imgs = src.data?.images || [];
            if (imgs.length === 0) return [];
            const idx = src.data?.selectedImageIndex !== undefined ? src.data?.selectedImageIndex : -1;
            if (idx >= 0 && idx < imgs.length) return [imgs[idx]];
            return imgs;
          }
          if (src.type === NodeType.LLM_PROCESSOR && sourceHandle === 'textOut') return src.outputs?.textOut;
          if (src.type === NodeType.STYLE_SELECTOR) {
            const idx = src.data?.selectedIndex || 0;
            return STYLES[idx]?.prompt || "";
          }
          if (src.type === NodeType.FORMAT_SELECTOR) return src.data?.aspectRatio;
          if (src.type === NodeType.RESOLUTION_SELECTOR) return src.data?.resolution;
          if (src.type === NodeType.IMAGE_MODEL_SELECTOR) return src.data?.model || 'gemini-3-pro-preview';
          if (src.type === NodeType.RESULT_VIEWER && sourceHandle === 'imageOut') return resolveValue(src.id, 'imageIn', visited);
          if (src.type === NodeType.ARRAY_SPLITTER && sourceHandle === 'arrayOut') {
              const rawText = resolveValue(src.id, 'textIn', visited);
              if (typeof rawText === 'string') {
                const del = src.data?.delimiter || '*';
                return rawText.split(del).map(s => s.trim()).filter(s => s.length > 0);
              }
          }
          if (src.type === NodeType.LIST_SELECTOR && sourceHandle === 'itemOut') {
              const arr = resolveValue(src.id, 'arrayIn', visited);
              if (Array.isArray(arr)) return arr[src.data?.selectedIndex || 0];
          }
          if (src.type === NodeType.COMBO_SELECTOR && sourceHandle === 'textOut') {
              const cText = resolveValue(src.id, 'textIn', visited) || "";
              const lText = src.data?.additionalText || "";
              const del = src.data?.delimiter || '*';
              const fText = (cText + (cText && lText && !cText.trim().endsWith(del) ? del : "") + lText).trim();
              const items = fText.split(del).map(s => s.trim()).filter(s => s.length > 0);
              return items[src.data?.selectedIndex || 0] || null;
          }
          if (src.type === NodeType.PROMPT_CONCATENATOR && sourceHandle === 'textOut') {
              const textParts = [];
              for(let i = 0; i < (src.data?.textInputCount || 1); i++) {
                const val = resolveValue(src.id, `text${i}`, visited);
                if (val) textParts.push(val);
              }
              return textParts.join('\n\n');
          }
          if (src.type === NodeType.IMAGE_GENERATOR) {
            if (sourceHandle === 'imageOut') {
              const imgs = src.outputs?.imagesOut || [];
              const idx = src.data?.selectedImageIndex || 0;
              return imgs[idx] || src.outputs?.imageOut;
            }
            if (sourceHandle === 'textOut' || sourceHandle === 'fullPromptOut') {
              const base = resolveValue(src.id, 'promptIn', visited) || src.data?.promptValue || "";
              const textParts = [base];
              for(let i=0; i<(src.data?.textInputCount || 0); i++) {
                const t = resolveValue(src.id, `text${i}`, visited) || src.data?.[`textValue${i}`];
                if (t) textParts.push(t);
              }
              return textParts.filter(Boolean).join(' ');
            }
            if (sourceHandle === 'negOut') {
              return resolveValue(src.id, 'negIn', visited) || src.data?.negative || "";
            }
          }
          if (src.type === NodeType.BACKGROUND_REMOVER && sourceHandle === 'imageOut') {
              return src.outputs?.imageOut;
          }
          if (src.type === NodeType.COMPOSITOR && sourceHandle === 'imageOut') {
              return src.outputs?.imageOut;
          }
          return src.outputs?.[sourceHandle];
        }
      }
    } catch (e) {
      console.error("Erreur lors de resolveValue:", e);
    }
    return null;
  }, [nodes, connections]);

  const calculateNodeTokens = useCallback((node: NodeState): number => {
    try {
      switch (node.type) {
        case NodeType.PROMPT_INPUT: return Math.ceil((node.data?.value?.length || 0) / 4);
        case NodeType.IMAGE_INPUT: return (node.data?.images?.length || 0) * 100;
        case NodeType.STYLE_SELECTOR: {
          const idx = node.data?.selectedIndex || 0;
          return Math.ceil((STYLES[idx]?.prompt?.length || 0) / 4);
        }
        case NodeType.PROMPT_CONCATENATOR:
          let concatLen = 0;
          for (let i = 0; i < (node.data?.textInputCount || 0); i++) {
             const val = resolveValue(node.id, `text${i}`);
             if (val && typeof val === 'string') concatLen += val.length;
          }
          return Math.ceil(concatLen / 4);
        case NodeType.LLM_PROCESSOR:
          let llmInputLen = (node.data?.negative?.length || 0);
          for (let i = 0; i < (node.data?.textInputCount || 0); i++) {
            const val = resolveValue(node.id, `text${i}`);
            if (val && typeof val === 'string') llmInputLen += val.length;
          }
          const sysVal = resolveValue(node.id, 'sysIn');
          if (sysVal && typeof sysVal === 'string') llmInputLen += sysVal.length;
          return Math.ceil(llmInputLen / 4) + 10;
        case NodeType.IMAGE_GENERATOR:
          const currentModel = resolveValue(node.id, 'modelIn') || node.data?.model;
          let base = (currentModel === 'gemini-3-pro-preview') ? 1000 : (currentModel === 'imagen-4.0-generate-001' ? 500 : 200);
          let resMult = (resolveValue(node.id, 'resolutionIn') || node.data?.resolution) === '4K' ? 4 : ((resolveValue(node.id, 'resolutionIn') || node.data?.resolution) === '2K' ? 2 : 1);
          return base * resMult * (node.data?.imageCount || 1);
        case NodeType.COMBO_SELECTOR:
          const comboInput = resolveValue(node.id, 'textIn');
          const comboManual = node.data?.additionalText || "";
          const inputLen = (typeof comboInput === 'string' ? comboInput.length : 0);
          return Math.ceil((inputLen + comboManual.length) / 4);
        case NodeType.RESULT_VIEWER: return 0;
        case NodeType.BACKGROUND_REMOVER: return 150;
        case NodeType.POST_PROCESS: return 1200; // Complex edit task
        case NodeType.COMPOSITOR: return (node.data.imageInputCount || 2) * 50;
        case NodeType.EXPORT: return 0;
        default: return 0;
      }
    } catch (e) {
      console.error("Erreur lors du calcul des tokens:", e);
      return 0;
    }
  }, [nodes, resolveValue]);

  const stats = useMemo(() => {
    const totalTokens = nodes.filter(n => n.type !== NodeType.ZONE).reduce((acc, node) => acc + calculateNodeTokens(node), 0);
    const totalCost = (totalTokens / 1000) * 0.015;
    return { totalTokens, totalCost };
  }, [nodes, calculateNodeTokens]);

  useEffect(() => {
    if (onStatsChange) onStatsChange(stats);
  }, [stats, onStatsChange]);

  // Auto-reset Background Remover when input changes
  const lastResolvedInputs = useRef<Record<string, string>>({});

  useEffect(() => {
    let hasChanges = false;
    const nextNodes = nodes.map(node => {
      if (node.type === NodeType.BACKGROUND_REMOVER) {
        const currentInput = resolveValue(node.id, 'imageIn');
        const currentInputKey = Array.isArray(currentInput) ? currentInput[0] : currentInput;
        
        // Use a ref to track the last resolved input and avoid deep comparison of large strings in each effect run
        if (currentInputKey !== node.data.lastImageIn) {
          hasChanges = true;
          return {
            ...node,
            outputs: { ...node.outputs, imageOut: undefined },
            data: { ...node.data, lastImageIn: currentInputKey }
          };
        }
      }
      return node;
    });

    if (hasChanges) {
      setNodes(nextNodes);
    }
  }, [nodes, resolveValue]);

  const deleteNode = useCallback((nodeId: string) => {
    saveToHistory();
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setConnections(prev => prev.filter(c => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId));
    setSelectedNodeIds([]);
  }, [saveToHistory]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent deletion when typing in inputs
      const activeElement = document.activeElement;
      const isInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA' || activeElement?.getAttribute('contenteditable') === 'true';
      
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        undo();
        return;
      }
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isInput) return;
        
        if (selectedConnectionId) {
          saveToHistory();
          setConnections(prev => prev.filter(c => c.id !== selectedConnectionId));
          setSelectedConnectionId(null);
        } else if (selectedNodeIds.length > 0) {
          saveToHistory();
          selectedNodeIds.forEach(id => deleteNode(id));
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedConnectionId, selectedNodeIds, deleteNode, undo]);

  const duplicateNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    saveToHistory();
    const newId = generateId();
    const newNode: NodeState = { ...JSON.parse(JSON.stringify(node)), id: newId, x: node.x + 50, y: node.y + 50, outputs: {} };
    setNodes(prev => [...prev, newNode]);
    setConnections(prev => [...prev, ...connections.filter(c => c.targetNodeId === nodeId).map(c => ({ ...c, id: `c-${Date.now()}-${Math.random()}`, targetNodeId: newId }))]);
    setSelectedNodeIds([newId]);
    bringToFront(newId);
  }, [nodes, connections, bringToFront]);

  const alignNodes = useCallback((direction: 'left' | 'top' | 'right' | 'bottom') => {
    if (selectedNodeIds.length < 2) return;
    const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
    let targetValue: number;
    setNodes(nds => {
      switch (direction) {
        case 'left': targetValue = Math.min(...selectedNodes.map(n => n.x)); return nds.map(n => selectedNodeIds.includes(n.id) ? { ...n, x: targetValue } : n);
        case 'top': targetValue = Math.min(...selectedNodes.map(n => n.y)); return nds.map(n => selectedNodeIds.includes(n.id) ? { ...n, y: targetValue } : n);
        case 'right': targetValue = Math.max(...selectedNodes.map(n => n.x + (n.w || NODE_WIDTH))); return nds.map(n => selectedNodeIds.includes(n.id) ? { ...n, x: targetValue - (n.w || NODE_WIDTH) } : n);
        case 'bottom': targetValue = Math.max(...selectedNodes.map(n => n.y + (n.h || 200))); return nds.map(n => selectedNodeIds.includes(n.id) ? { ...n, y: targetValue - (n.h || 200) } : n);
        default: return nds;
      }
    });
  }, [selectedNodeIds, nodes]);

  const distributeNodes = useCallback((direction: 'horizontal' | 'vertical') => {
    if (selectedNodeIds.length < 2) return;
    const selectedNodesInOrder = nodes.filter(n => selectedNodeIds.includes(n.id) && n.type !== NodeType.ZONE).sort((a, b) => direction === 'horizontal' ? a.x - b.x : a.y - b.y);
    if (selectedNodesInOrder.length < 2) return;
    const GAP = 30;
    let currentPos = direction === 'horizontal' ? selectedNodesInOrder[0].x : selectedNodesInOrder[0].y;
    setNodes(nds => nds.map(n => {
      const idx = selectedNodesInOrder.findIndex(sn => sn.id === n.id);
      if (idx === -1) return n;
      if (idx === 0) return n;
      const prev = selectedNodesInOrder[idx - 1];
      const newPos = currentPos + (direction === 'horizontal' ? (prev.w || NODE_WIDTH) : (prev.h || 200)) + GAP;
      currentPos = newPos;
      return direction === 'horizontal' ? { ...n, x: newPos } : { ...n, y: newPos };
    }));
  }, [selectedNodeIds, nodes]);

  const smartRemoveInput = (nodeId: string, type: 'text' | 'image') => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const count = type === 'text' ? (node.data.textInputCount || 0) : (node.data.imageInputCount || 0);
    if (count <= 0) return;
    if (type === 'text' && (node.type === NodeType.LLM_PROCESSOR || node.type === NodeType.PROMPT_CONCATENATOR) && count <= 1) return;
    let emptyIdx = -1;
    for (let i = 0; i < count; i++) {
      const handleId = `${type}${i}`;
      if (!connections.some(c => c.targetNodeId === nodeId && c.targetHandle === handleId)) { emptyIdx = i; break; }
    }
    const idxToRemove = emptyIdx === -1 ? count - 1 : emptyIdx;
    setConnections(prev => prev.filter(c => !(c.targetNodeId === nodeId && c.targetHandle === `${type}${idxToRemove}`)).map(c => {
      if (c.targetNodeId === nodeId && c.targetHandle.startsWith(type)) {
        const hIdx = parseInt(c.targetHandle.replace(type, ''));
        if (hIdx > idxToRemove) return { ...c, targetHandle: `${type}${hIdx - 1}` };
      }
      return c;
    }));
    setNodes(ns => ns.map(n => n.id === nodeId ? { ...n, data: { ...n.data, [`${type}InputCount`]: count - 1 } } : n));
  };

  const generateLayoutSketch = async (nodeId: string, imgUrl: string, processes: any[]): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(imgUrl); return; }
        
        ctx.drawImage(img, 0, 0);
        
        const currentNode = nodes.find(n => n.id === nodeId);
        const allPP = currentNode?.data.postProcesses || [];
        
        for (const p of processes) {
          if (!p.active) continue;
          const originalIdx = allPP.findIndex((orig: any) => orig.id === p.id);
          const cx = p.x * canvas.width;
          const cy = p.y * canvas.height;
          const boxSize = (p.size || 1.0) * 0.25 * canvas.width;
          
          ctx.save();
          ctx.translate(cx, cy);
          if (p.orientation === 'horizontal') {
            ctx.scale(1, 0.4); 
          }
          
          const isLogo = p.inputType === 'logo';
          const val = isLogo ? (p.logoUrl || resolveValue(nodeId, `logo${originalIdx}`)) : (resolveValue(nodeId, `text${originalIdx}`) || p.textValue);

          if (isLogo && val) {
            const logoImg = new Image();
            logoImg.crossOrigin = "anonymous";
            await new Promise((resLogo) => {
              logoImg.onload = () => {
                const ratio = logoImg.width / logoImg.height;
                let w = boxSize;
                let h = boxSize / ratio;
                if (h > boxSize) { h = boxSize; w = h * ratio; }
                if (p.mode === 'cutout') {
                  // Draw black silhouette for engraving
                  ctx.fillStyle = 'black';
                  ctx.globalAlpha = 0.8;
                  ctx.fillRect(-w/2, -h/2, w, h);
                } else {
                  ctx.drawImage(logoImg, -w/2, -h/2, w, h);
                }
                resLogo(null);
              };
              logoImg.src = val;
            });
          } else if (val) {
            ctx.font = `900 ${Math.round(boxSize * 0.25)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = p.mode === 'cutout' ? 'black' : 'white';
            ctx.fillText(String(val), 0, 0);
          }
          ctx.restore();
        }
        
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = imgUrl;
    });
  };

  const handleAction = async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (node.type === NodeType.GENERATE_TRIGGER) {
      const targets = connections.filter(c => c.sourceNodeId === nodeId && c.sourceHandle === 'generateOut').map(c => c.targetNodeId);
      targets.forEach(handleAction);
      return;
    }
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, isProcessing: true } } : n));
    try {
      if (node.type === NodeType.LLM_PROCESSOR) {
        const parts = [];
        for(let i=0; i<(node.data.textInputCount || 1); i++) parts.push(resolveValue(nodeId, `text${i}`));
        const imgs = [];
        for(let i=0; i<(node.data.imageInputCount || 0); i++) { const v = resolveValue(nodeId, `image${i}`); if (Array.isArray(v)) imgs.push(...v); else if (v) imgs.push(v); }
        const res = await GeminiService.processLLM(parts.filter(Boolean).join('\n\n'), resolveValue(nodeId, 'sysIn'), imgs, [resolveValue(nodeId, 'negIn'), node.data.negative].filter(Boolean).join(', '));
        setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, outputs: { ...n.outputs, textOut: res }, data: { ...n.data, isProcessing: false } } : n));
      } else if (node.type === NodeType.IMAGE_GENERATOR) {
        const style = resolveValue(nodeId, 'styleIn');
        const base = resolveValue(nodeId, 'promptIn') || node.data.promptValue || "";
        const neg = resolveValue(nodeId, 'negIn') || node.data.negative || "";
        
        const textParts = [base];
        for(let i=0; i<(node.data.textInputCount || 0); i++) {
          const t = resolveValue(nodeId, `text${i}`) || node.data[`textValue${i}`];
          if (t) textParts.push(t);
        }
        const fullPrompt = textParts.filter(Boolean).join(' ');

        const dynamicImages = [];
        for(let i=0; i<(node.data.imageInputCount || 1); i++) {
          const v = resolveValue(nodeId, `image${i}`);
          if (Array.isArray(v)) dynamicImages.push(...v);
          else if (v) dynamicImages.push(v);
        }

        const inputs = {
          ref: dynamicImages,
          original: [],
          style: []
        };

        const imgs = await GeminiService.generateImage(style ? `${style}\n\n${fullPrompt}` : fullPrompt, { 
          aspectRatio: resolveValue(nodeId, 'formatIn') || node.data.aspectRatio, 
          model: resolveValue(nodeId, 'modelIn') || node.data.model, 
          negative: neg, 
          resolution: resolveValue(nodeId, 'resolutionIn') || node.data.resolution, 
          imageCount: node.data.imageCount || 1,
          images: inputs
        });
        setNodes(nds => nds.map(n => n.id === nodeId ? { 
          ...n, 
          outputs: { 
            ...n.outputs, 
            imageOut: imgs[0], 
            imagesOut: imgs,
            textOut: fullPrompt,
            negOut: neg
          }, 
          data: { ...n.data, isProcessing: false, selectedImageIndex: 0 } 
        } : n));
      } else if (node.type === NodeType.COMPOSITOR) {
        const imageCount = node.data.imageInputCount || 2;
        const layers = node.data.layers || [];
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const POS_SCALE = 1024 / 228; 

          for (let i = 0; i < imageCount; i++) {
            let imgVal = resolveValue(nodeId, `image${i}`);
            if (i === 0 && node.data.backgroundId) {
              imgVal = await resolveBackgroundUrlAsync(node.data.backgroundId);
            }
            if (!imgVal) continue;
            const imgSrc = Array.isArray(imgVal) ? imgVal[0] : imgVal;
            if (!imgSrc) continue;
            const layer = layers[i] || { scale: 1, x: 0, y: 0, rotation: 0 };
            await new Promise((resolve) => {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.onload = () => {
                ctx.save();
                // Translate using the scaling factor relative to the 228px preview area
                ctx.translate(canvas.width / 2 + layer.x * POS_SCALE, canvas.height / 2 + layer.y * POS_SCALE);
                ctx.rotate((layer.rotation * Math.PI) / 180);
                
                const ratio = (layer.fit) 
                  ? Math.max(canvas.width / img.width, canvas.height / img.height)
                  : Math.min(canvas.width / img.width, canvas.height / img.height);
                
                const finalScale = layer.fit ? 1 : layer.scale;
                ctx.scale(finalScale, finalScale);
                
                const w = img.width * ratio;
                const h = img.height * ratio;
                ctx.drawImage(img, -w / 2, -h / 2, w, h);
                ctx.restore();
                resolve(null);
              };
              img.onerror = () => resolve(null);
              img.src = imgSrc;
            });
          }

          // Render logo overlay if active
          if (node.data.logo && node.data.logoId) {
            const logoUrl = await resolveLogoUrlAsync(node.data.logoId);
            if (logoUrl) {
              await new Promise((resolve) => {
                const logoImg = new Image();
                logoImg.crossOrigin = 'anonymous';
                logoImg.onload = () => {
                  let logoX = 512;
                  let logoY = 512;
                  if (node.data.logoPosition && typeof node.data.logoPosition === 'string') {
                    const parts = node.data.logoPosition.split('/');
                    if (parts.length === 2) {
                      logoX = Number(parts[0]) || 512;
                      logoY = Number(parts[1]) || 512;
                    }
                  }
                  const lSize = Number(node.data.logoSize) || 120;
                  
                  ctx.save();
                  if (node.data.logoColor) {
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = lSize;
                    tempCanvas.height = lSize;
                    const tempCtx = tempCanvas.getContext('2d');
                    if (tempCtx) {
                      tempCtx.drawImage(logoImg, 0, 0, lSize, lSize);
                      tempCtx.globalCompositeOperation = 'source-in';
                      tempCtx.fillStyle = node.data.logoColor;
                      tempCtx.fillRect(0, 0, lSize, lSize);
                      ctx.drawImage(tempCanvas, logoX - lSize / 2, logoY - lSize / 2);
                    } else {
                      ctx.drawImage(logoImg, logoX - lSize / 2, logoY - lSize / 2, lSize, lSize);
                    }
                  } else {
                    ctx.drawImage(logoImg, logoX - lSize / 2, logoY - lSize / 2, lSize, lSize);
                  }
                  ctx.restore();
                  resolve(null);
                };
                logoImg.onerror = () => resolve(null);
                logoImg.src = logoUrl;
              });
            }
          }

          // Render text overlay if active
          if (node.data.text && node.data.textValue) {
            let textX = 512;
            let textY = 800;
            if (node.data.textPosition && typeof node.data.textPosition === 'string') {
              const parts = node.data.textPosition.split('/');
              if (parts.length === 2) {
                textX = Number(parts[0]) || 512;
                textY = Number(parts[1]) || 800;
              }
            }
            const fSize = Number(node.data.textFontSize) || 32;
            
            ctx.save();
            ctx.font = `${node.data.fontWeight || 'bold'} ${fSize}px ${node.data.textFontFamily || 'sans-serif'}`;
            ctx.fillStyle = node.data.textColor || '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 2;
            ctx.fillText(node.data.textValue, textX, textY);
            ctx.restore();
          }

          const result = canvas.toDataURL('image/png');
          setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, outputs: { ...n.outputs, imageOut: result, imagesOut: [result] }, data: { ...n.data, isProcessing: false } } : n));
        } else {
          setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, isProcessing: false } } : n));
        }
      } else if (node.type === NodeType.BACKGROUND_REMOVER) {
        const localImages = node.data.images || [];
        const selectedIdx = node.data.selectedImageIndex || 0;
        const localImg = localImages[selectedIdx];
        const connectedImg = resolveValue(nodeId, 'imageIn');
        let img = localImg || (Array.isArray(connectedImg) ? connectedImg[0] : connectedImg);

        if (img) {
          const result = await ImageService.removeImageBackground(img);
          setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, outputs: { ...n.outputs, imageOut: result }, data: { ...n.data, isProcessing: false } } : n));
        } else {
          setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, isProcessing: false } } : n));
        }
      } else if (node.type === NodeType.EXPORT) {
        const imageVal = resolveValue(nodeId, 'imageIn');
        if (!imageVal) {
          throw new Error("Aucune image source connectée à l'entrée EXPORT.");
        }
        const imgSource = Array.isArray(imageVal) ? imageVal[0] : imageVal;
        const destinationType = node.data.destinationType || 'firestore';
        const targetJobId = node.data.targetJobId || activeJob?.id || '';
        const customCollection = node.data.customCollection || 'exports';
        const customUrl = node.data.customUrl || '';

        if (destinationType === 'firestore') {
          if (!targetJobId) {
            throw new Error("Aucun ID de Job spécifié pour l'export Firestore. Veuillez l'indiquer ou charger le job actif.");
          }
          console.log(`[EXPORT Node] Compressing and uploading image to Firestore: ${customCollection}/${targetJobId}`);
          
          let optimizedBase64 = imgSource;
          try {
            optimizedBase64 = await compressBase64Image(imgSource, 1200, 1200, 0.85);
          } catch (compressErr) {
            console.warn("Base64 compression failed, using original size:", compressErr);
          }
          
          await updateJobStatus(targetJobId, 'completed', { finalResult: optimizedBase64 });
          alert(`Image exportée avec succès sur Firestore pour le Job ${targetJobId} !`);
          setActiveJob(null);
        } else {
          if (!customUrl) {
            throw new Error("Veuillez indiquer l'URL API cible de votre PWA.");
          }
          console.log(`[EXPORT Node] Sending POST request to URL: ${customUrl}`);
          
          const response = await fetch(customUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              image: imgSource,
              jobId: targetJobId,
              timestamp: Date.now()
            })
          });
          
          if (!response.ok) {
            throw new Error(`Échec de l'envoi HTTP (${response.status} : ${response.statusText})`);
          }
          alert(`Image transmise avec succès à l'API ${customUrl} !`);
        }

        setNodes(nds => nds.map(n => n.id === nodeId ? { 
          ...n, 
          outputs: { ...n.outputs, imageOut: imgSource }, 
          data: { ...n.data, isProcessing: false } 
        } : n));
      } else if (node.type === NodeType.POST_PROCESS) {
        let img = resolveValue(node.id, 'imageIn');
        if (Array.isArray(img)) img = img[0];
        
        if (img) {
          const processes = node.data.postProcesses || [];
          const activeProcesses = processes.filter((p: any) => p.active);
          
          if (activeProcesses.length > 0) {
            const toBase64 = async (url: string): Promise<string> => {
              if (!url || url.startsWith('data:')) return url;
              try {
                const response = await fetch(url);
                const blob = await response.blob();
                return new Promise((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.onerror = reject;
                  reader.readAsDataURL(blob);
                });
              } catch (e) {
                console.warn("Base64 conversion failed:", url, e);
                return url;
              }
            };

            const bgBase64 = await toBase64(img);
            
            // Create reference map with highlighted regions
            const canvas = document.createElement('canvas');
            canvas.width = 1000;
            canvas.height = 1000;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
              const bgImg = new Image();
              bgImg.crossOrigin = "anonymous";
              
              // Load background into canvas with timeout
              const loadPromise = new Promise((resolve) => {
                const timeout = setTimeout(() => {
                  console.warn("Reference bg load timeout");
                  resolve(null);
                }, 4000);
                bgImg.onload = () => { clearTimeout(timeout); resolve(bgImg); };
                bgImg.onerror = () => { clearTimeout(timeout); resolve(null); };
              });
              bgImg.src = bgBase64;
              await loadPromise;
              ctx.drawImage(bgImg, 0, 0, 1000, 1000);
            }

            const instructions = activeProcesses.map((p: any, idx: number) => {
              const allPP = node.data.postProcesses || [];
              const originalIdx = allPP.findIndex((orig: any) => orig.id === p.id);
              const isLogo = p.inputType === 'logo';
              const val = isLogo ? (p.logoUrl || resolveValue(node.id, `logo${originalIdx}`)) : (resolveValue(node.id, `text${originalIdx}`) || p.textValue);
              
              if (!val) return null;

              const cx = Math.round(p.x * 1000);
              const cy = Math.round(p.y * 1000);
              
              const userScale = p.size || 1.0;
              const unitSize = userScale * 250; 

              let finalWidth = unitSize;
              let finalHeight = unitSize;

              if (!isLogo) {
                const textVal = String(val);
                finalWidth = (textVal.length / 9.2) * unitSize;
                finalHeight = unitSize / 5;
              }

              const hw = Math.round(finalWidth / 2);
              const hh = Math.round(finalHeight / 2);
              
              // Draw on reference canvas
              if (ctx) {
                ctx.strokeStyle = p.color || '#ff0000';
                ctx.lineWidth = 12;
                ctx.strokeRect(cx - hw, cy - hh, finalWidth, finalHeight);
                ctx.fillStyle = (p.color || '#ff0000') + '20';
                ctx.fillRect(cx - hw, cy - hh, finalWidth, finalHeight);
              }

              const ymin = Math.max(0, cy - hh);
              const xmin = Math.max(0, cx - hw);
              const ymax = Math.min(1000, cy + hh);
              const xmax = Math.min(1000, cx + hw);
              
              const orientationPromt = p.surface === 'floor' ? 'HORIZONTAL (Laying flat on the ground plane perspective)' : 'VERTICAL (Fixed standing on the wall surface)';
              
              if (!isLogo) {
                return `ITEM_${idx + 1} (Text):
- CONTENT: "${val}"
- TARGET_ZONE [ymin, xmin, ymax, xmax]: [${ymin}, ${xmin}, ${ymax}, ${xmax}]
- ORIENTATION: ${orientationPromt}
- EFFECT: ${p.mode === 'extrude' ? '3D Realistic Embossing' : 'Material Engraving'}`;
              } else {
                const currentLogoRefIdx = activeProcesses.slice(0, idx).filter((prev: any) => prev.inputType === 'logo').length + 1;
                return `ITEM_${idx + 1} (Logo):
- LOGO_IMAGE: Use LOGO_IMAGE_${currentLogoRefIdx}
- TARGET_ZONE [ymin, xmin, ymax, xmax]: [${ymin}, ${xmin}, ${ymax}, ${xmax}]
- ORIENTATION: ${orientationPromt}`;
              }
            }).filter(Boolean).join('\n\n');

            const additionalImagesRaw = await Promise.all(activeProcesses
              .map(async (p: any) => {
                if (p.inputType !== 'logo') return null;
                const allPP = node.data.postProcesses || [];
                const originalIdx = allPP.findIndex((orig: any) => orig.id === p.id);
                const lUrl = p.logoUrl || resolveValue(node.id, `logo${originalIdx}`);
                if (lUrl) return await toBase64(lUrl);
                return null;
              }));
            const additionalImages = additionalImagesRaw.filter(Boolean) as string[];

            try {
              const result = await GeminiService.generateImage(`TASK: Precision Material Brand Integration.
TARGET: BACKGROUND_IMAGE (Concrete environment).

I have provided a Reference Image where branding zones are marked with COLORED RECTANGLES. 
YOU MUST replace these rectangles with photorealistic material-integrated branding.

Branding Specs:
${instructions}

RULES:
1. NO TECHNICAL MARKS: Final image MUST NOT contain boxes, frames, labels, or guide lines. 
2. GROUND PERSPECTIVE: HORIZONTAL items must match the floor perspective.
3. OUTPUT: High-quality photographic composite.`, {
                model: 'gemini-3-pro-image-preview', 
                images: { 
                  original: [bgBase64], 
                  ref: [canvas.toDataURL('image/jpeg', 0.8), ...additionalImages] 
                }
              });

              if (result && result.length > 0) {
                setNodes(nds => nds.map(n => n.id === node.id ? { ...n, outputs: { ...n.outputs, imageOut: result[0] }, data: { ...n.data, isProcessing: false } } : n));
              } else {
                console.error("Gemini failed to return result");
                setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, isProcessing: false } } : n));
              }
            } catch (err) {
              console.error("Generation error:", err);
              setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, isProcessing: false } } : n));
            }
          } else {
            console.error('Gemini post-process returned empty result');
            setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, isProcessing: false } } : n));
          }
        } else {
          setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, isProcessing: false } } : n));
        }
      }
    } catch (e) { 
      console.error("Action Error:", e);
      setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, isProcessing: false } } : n)); 
    }
  };

  const lastTriggeredJobIdRef = useRef<string | null>(null);
  const prevProcessingRef = useRef<Record<string, boolean>>({});
  const lastCompletedJobIdRef = useRef<string | null>(null);

  // 1. Auto-trigger the generation workflow on new active job arrival
  useEffect(() => {
    if (activeJob && activeJob.status !== 'completed' && activeJob.id !== lastTriggeredJobIdRef.current) {
      lastTriggeredJobIdRef.current = activeJob.id;
      
      console.log("Automating Flow: Automatically triggering generation layout for job:", activeJob.id);
      const timer = setTimeout(async () => {
        // Find GENERATE_TRIGGER / trigger node
        const triggerNode = nodes.find(n => n.type === NodeType.GENERATE_TRIGGER);
        if (triggerNode) {
          console.log("Automating Flow: Activating trigger node:", triggerNode.id);
          await handleAction(triggerNode.id);
        } else {
          // Fallback: Find image generator напрямую
          const genNode = nodes.find(n => n.type === NodeType.IMAGE_GENERATOR);
          if (genNode) {
            console.log("Automating Flow: Activating image generator directly:", genNode.id);
            await handleAction(genNode.id);
          }
        }
      }, 1000); // 1s buffer for image assets to mount visually on the nodes canvas

      return () => clearTimeout(timer);
    }
  }, [activeJob?.id, nodes]);

  // 2. Auto-send generated output to PWA/mobile app as soon as generation completes
  useEffect(() => {
    if (!activeJob) {
      prevProcessingRef.current = {};
      return;
    }

    const genNode = nodes.find(n => n.type === NodeType.IMAGE_GENERATOR);
    if (genNode) {
      const isCurrentlyProcessing = !!genNode.data.isProcessing;
      const wasProcessing = !!prevProcessingRef.current[genNode.id];
      
      // Update process history ref
      prevProcessingRef.current[genNode.id] = isCurrentlyProcessing;

      // Detect transition from processing to finished with active image
      if (wasProcessing && !isCurrentlyProcessing && genNode.outputs?.imageOut && activeJob.id !== lastCompletedJobIdRef.current) {
        lastCompletedJobIdRef.current = activeJob.id;
        const resultImg = genNode.outputs.imageOut;
        
        console.log("Automating Flow: Node finished generating. Auto-sending image to PWA for Job ID:", activeJob.id);
        (async () => {
          try {
            await updateJobStatus(activeJob.id, 'completed', { finalResult: resultImg });
            console.log("Automating Flow: Successfully sent image output to PWA!");
            setActiveJob(null);
          } catch (e) {
            console.error("Automating Flow: Failed to push output to Firestore:", e);
          }
        })();
      }
    }
  }, [nodes, activeJob]);

  const getHandlePos = (nodeId: string, handleId: string, isSource: boolean) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    const hConfig = getHandleConfig(node);
    const handles = isSource ? hConfig.outputs : hConfig.inputs;
    const index = handles.findIndex((h: any) => h.id === handleId);
    const nW = node.type === NodeType.ON_OFF ? NODE_WIDTH/2 : (node.w || NODE_WIDTH);
    return { x: isSource ? node.x + nW : node.x, y: node.y + HEADER_HEIGHT + BODY_PADDING_TOP + (index * ROW_HEIGHT) + (ROW_HEIGHT / 2) };
  };

  const getHandleConfig = (node: NodeState) => {
    const color = TYPE_CONFIG[node.type]?.color || '#fff';
    const pad = (n: number) => String(n).padStart(2, '0');
    
    switch (node.type) {
      case NodeType.PROMPT_INPUT: return { outputs: [{ id: 'textOut', label: 'Texte', color }] };
      case NodeType.IMAGE_INPUT: return { inputs: [{ id: 'imageIn', label: 'Image', color: CAT_COLORS.MOTEUR_VISION }], outputs: [{ id: 'imageOut', label: 'Images', color: CAT_COLORS.MOTEUR_VISION }] };
      case NodeType.STYLE_SELECTOR: return { outputs: [{ id: 'styleOut', label: 'Style', color: CAT_COLORS.ACTION }] };
      case NodeType.FORMAT_SELECTOR: return { outputs: [{ id: 'formatOut', label: 'Format', color: CAT_COLORS.MOTEUR_RENDU }] };
      case NodeType.RESOLUTION_SELECTOR: return { outputs: [{ id: 'resolutionOut', label: 'Résolution', color: CAT_COLORS.MOTEUR_RENDU }] };
      case NodeType.IMAGE_MODEL_SELECTOR: return { outputs: [{ id: 'modelOut', label: 'Modèle', color: CAT_COLORS.MOTEUR_RENDU }] };
      case NodeType.LLM_PROCESSOR:
        const llmIn = [{ id: 'sysIn', label: 'Système', color: CAT_COLORS.CREATION }];
        for(let i=0; i<(node.data.textInputCount || 1); i++) llmIn.push({ id: `text${i}`, label: `TEXTE ${pad(i+1)}`, color: CAT_COLORS.CREATION });
        for(let i=0; i<(node.data.imageInputCount || 0); i++) llmIn.push({ id: `image${i}`, label: `IMAGE ${pad(i+1)}`, color: CAT_COLORS.MOTEUR_VISION });
        llmIn.push({ id: 'negIn', label: 'Négatif', color: '#ef4444' });
        return { inputs: llmIn, outputs: [{ id: 'textOut', label: 'Texte', color }] };
      case NodeType.ARRAY_SPLITTER: return { inputs: [{ id: 'textIn', label: 'Texte', color: CAT_COLORS.CREATION }], outputs: [{ id: 'arrayOut', label: 'Tableau', color: CAT_COLORS.MOTEUR_STYLE }] };
      case NodeType.LIST_SELECTOR: return { inputs: [{ id: 'arrayIn', label: 'Tableau', color: CAT_COLORS.MOTEUR_STYLE }], outputs: [{ id: 'itemOut', label: 'Texte', color: CAT_COLORS.CREATION }] };
      case NodeType.COMBO_SELECTOR: return { inputs: [{ id: 'textIn', label: 'Texte', color: CAT_COLORS.CREATION }], outputs: [{ id: 'textOut', label: 'Texte', color: CAT_COLORS.CREATION }] };
      case NodeType.ON_OFF: return { inputs: [{ id: 'textIn', label: 'Texte', color: CAT_COLORS.CREATION }], outputs: [{ id: 'textOut', label: 'Flux', color: CAT_COLORS.UTILITY }] };
      case NodeType.PROMPT_CONCATENATOR:
        const concatIn = [];
        for(let i=0; i<(node.data.textInputCount || 2); i++) concatIn.push({ id: `text${i}`, label: `TEXTE ${pad(i+1)}`, color: CAT_COLORS.CREATION });
        return { inputs: concatIn, outputs: [{ id: 'textOut', label: 'Texte', color: '#fff' }] };
      case NodeType.IMAGE_GENERATOR:
        const genIn = [];
        const imgInputCount = node.data.imageInputCount || 1;
        for(let i = 0; i < imgInputCount; i++) {
          const label = imgInputCount === 1 ? 'Image 1' : `IMAGE ${pad(i+1)}`;
          genIn.push({ id: `image${i}`, label, color: CAT_COLORS.MOTEUR_VISION });
        }
        
        const txtInputCount = node.data.textInputCount || 0;
        for(let i = 0; i < txtInputCount; i++) {
          genIn.push({ id: `text${i}`, label: `TEXTE ${pad(i+1)}`, color: CAT_COLORS.CREATION });
        }

        genIn.push({ id: 'promptIn', label: 'Texte', color: '#fff' });
        genIn.push({ id: 'negIn', label: 'Neg', color: '#ff4444' });
        genIn.push({ id: 'styleIn', label: 'Style', color: CAT_COLORS.ACTION });
        genIn.push({ id: 'modelIn', label: 'Modèle', color: CAT_COLORS.MOTEUR_RENDU });
        genIn.push({ id: 'formatIn', label: 'Format', color: CAT_COLORS.MOTEUR_RENDU });
        genIn.push({ id: 'resolutionIn', label: 'Résolution', color: CAT_COLORS.MOTEUR_RENDU });
        genIn.push({ id: 'executeIn', label: 'GÉNÉRER', color: CAT_COLORS.UTILITY });
        return { 
          inputs: genIn, 
          outputs: [
            { id: 'imageOut', label: 'Image', color: CAT_COLORS.MOTEUR_VISION },
            { id: 'imagesOut', label: 'Images', color: CAT_COLORS.MOTEUR_VISION },
            { id: 'textOut', label: 'Texte', color: '#fff' },
            { id: 'negOut', label: 'Neg', color: '#ff4444' }
          ] 
        };
      case NodeType.GENERATE_TRIGGER: return { outputs: [{ id: 'generateOut', label: 'GÉNÉRER', color: CAT_COLORS.UTILITY }] };
      case NodeType.RESULT_VIEWER: return { inputs: [{ id: 'imageIn', label: 'Image', color: CAT_COLORS.MOTEUR_VISION }], outputs: [{ id: 'imageOut', label: 'Image', color: CAT_COLORS.MOTEUR_VISION }] };
      case NodeType.BACKGROUND_REMOVER: return { inputs: [{ id: 'imageIn', label: 'Image', color: CAT_COLORS.MOTEUR_VISION }], outputs: [{ id: 'imageOut', label: 'Image', color: CAT_COLORS.MOTEUR_VISION }] };
      case NodeType.POST_PROCESS:
        const ppIn = [{ id: 'imageIn', label: 'Image', color: CAT_COLORS.MOTEUR_VISION }];
        (node.data.postProcesses || []).forEach((pp: any, i: number) => {
          if (pp.inputType === 'logo') ppIn.push({ id: `logo${i}`, label: `LOGO ${i+1}`, color: CAT_COLORS.MOTEUR_VISION });
          else ppIn.push({ id: `text${i}`, label: `TEXTE ${i+1}`, color: CAT_COLORS.CREATION });
        });
        return { inputs: ppIn, outputs: [{ id: 'imageOut', label: 'Image', color: CAT_COLORS.MOTEUR_VISION }] };
      case NodeType.COMPOSITOR:
        return {
          inputs: [
            { id: 'image0', label: 'FOND (IMAGE 1)', color: CAT_COLORS.MOTEUR_VISION },
            { id: 'image1', label: 'VÉHICULE (IMAGE 2)', color: CAT_COLORS.MOTEUR_VISION },
            { id: 'logo', label: 'LOGO (Lien/Image)', color: CAT_COLORS.MOTEUR_VISION },
            { id: 'text', label: 'TEXTE (Optionnel)', color: CAT_COLORS.CREATION }
          ],
          outputs: [{ id: 'imageOut', label: 'Image', color: CAT_COLORS.MOTEUR_VISION }]
        };
      case NodeType.EXPORT:
        return {
          inputs: [{ id: 'imageIn', label: 'Image Source', color: CAT_COLORS.MOTEUR_VISION }],
          outputs: [{ id: 'imageOut', label: 'Image Pass', color: CAT_COLORS.MOTEUR_VISION }]
        };
      default: return { inputs: [], outputs: [] };
    }
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };



  const renderConcatenatorFields = (node: NodeState, isRightPanel: boolean = false) => {
    const textCount = node.data.textInputCount || 2;
    
    const getCombinedText = () => {
      const textParts = [];
      for(let i = 0; i < textCount; i++) {
        const val = resolveValue(node.id, `text${i}`);
        if (val) textParts.push(val);
      }
      return textParts.join('\n\n');
    };

    const isCopied = copiedId === node.id;

    return (
      <div className="space-y-3 flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-1">
          <span className="text-[7px] font-black text-white/30 uppercase tracking-widest">RESULTAT CUMULÉ</span>
          <button 
            onClick={() => handleCopyText(getCombinedText(), node.id)}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-all ${isCopied ? 'bg-green-500/20 text-green-400' : 'hover:bg-white/10 text-white/40'}`}
          >
            {isCopied ? <Check size={10} /> : <Copy size={10} />}
            <span className="text-[8px] font-bold uppercase">{isCopied ? 'COPIÉ' : 'COPIER'}</span>
          </button>
        </div>

        <div className={`flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar ${isRightPanel ? 'h-96' : ''}`}>
          {Array.from({ length: textCount }).map((_, i) => {
            const val = resolveValue(node.id, `text${i}`);
            return (
              <div key={i} className="space-y-1">
                <span className="text-[7px] font-black text-white/30 uppercase">INPUT {i+1}</span>
                <div className="bg-black/60 border border-white/10 rounded-lg p-2 text-[9px] text-white/70 font-medium line-clamp-2 leading-tight">
                  {val || <span className="text-white/10 italic">...</span>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
          <button onClick={() => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, textInputCount: (n.data.textInputCount || 2) + 1 } } : n))} className="p-1 hover:bg-magenta-500/20 rounded text-magenta-500"><Plus size={10} /></button>
          <span className="text-[7px] font-black text-white/50 uppercase">CHAMPS TEXTE</span>
          <button onClick={() => smartRemoveInput(node.id, 'text')} className="p-1 hover:bg-magenta-500/20 rounded text-magenta-500"><Minus size={10} /></button>
        </div>
      </div>
    );
  };

  // --- NODE RENDERERS ---

  const renderLLMProcessorFields = (node: NodeState, isRightPanel: boolean = false) => {
    const textCount = node.data.textInputCount || 1;
    return (
      <div className="space-y-4 flex flex-col h-full overflow-hidden">
        <div className={`flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar ${isRightPanel ? 'h-[500px]' : ''}`}>
          <div className="space-y-2">
            <span className="text-[7px] font-black text-white/30 uppercase">SYSTEM INSTRUCTION</span>
            <div className="bg-black/60 border border-white/10 rounded-lg p-2 text-[9px] text-white/70 font-medium line-clamp-2 italic">
              {resolveValue(node.id, 'sysIn') || "Professional creative director..."}
            </div>
          </div>
          <div className="space-y-2">
            <span className="text-[7px] font-black text-white/30 uppercase tracking-widest">TEXT INPUTS ({textCount})</span>
            {Array.from({ length: textCount }).map((_, i) => (
              <div key={`txt-${i}`} className="bg-black/40 border border-white/5 rounded-lg p-2 text-[8px] text-white/60 line-clamp-1">
                {resolveValue(node.id, `text${i}`) || "Empty..."}
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <span className="text-[7px] font-black text-white/30 uppercase tracking-widest">NEGATIVE CONSTRAINTS</span>
            <textarea 
              className="w-full bg-black/60 border border-white/10 rounded-lg p-2 text-[9px] text-white font-medium outline-none h-16 resize-none"
              value={node.data.negative}
              onChange={e => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, negative: e.target.value } } : n))}
            />
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <div className="flex-1 flex items-center justify-between gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
            <button onClick={() => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, textInputCount: (n.data.textInputCount || 0) + 1 } } : n))} className="p-1 hover:bg-white/10 rounded text-white/60"><Plus size={10} /></button>
            <span className="text-[7px] font-black text-white/30 uppercase">TEXT</span>
            <button onClick={() => smartRemoveInput(node.id, 'text')} className="p-1 hover:bg-white/10 rounded text-white/60"><Minus size={10} /></button>
          </div>
          <div className="flex-1 flex items-center justify-between gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
            <button onClick={() => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, imageInputCount: (n.data.imageInputCount || 0) + 1 } } : n))} className="p-1 hover:bg-white/10 rounded text-white/60"><Plus size={10} /></button>
            <span className="text-[7px] font-black text-white/30 uppercase">IMAGE</span>
            <button onClick={() => smartRemoveInput(node.id, 'image')} className="p-1 hover:bg-white/10 rounded text-white/60"><Minus size={10} /></button>
          </div>
        </div>
      </div>
    );
  };

  const renderImageGeneratorFields = (node: NodeState, isRightPanel: boolean = false) => {
    const isModelConnected = connections.some(c => c.targetNodeId === node.id && c.targetHandle === 'modelIn');
    const isFormatConnected = connections.some(c => c.targetNodeId === node.id && c.targetHandle === 'formatIn');
    const isResolutionConnected = connections.some(c => c.targetNodeId === node.id && c.targetHandle === 'resolutionIn');

    return (
      <div className="space-y-3 flex flex-col h-full overflow-y-auto pr-1 custom-scrollbar">
        {node.data.isProcessing && (
          <div className="shrink-0 h-10 bg-black/40 rounded-xl border border-white/10 flex items-center justify-center gap-3 relative overflow-hidden group/process shadow-inner">
            <div className="absolute inset-x-0 bottom-0 h-[1px] bg-emerald-500/30 animate-pulse" />
            <Loader2 size={14} className="text-emerald-500 animate-spin" />
            <span className="text-[7px] font-black uppercase tracking-[0.2em] text-emerald-500/60">RENDU EN COURS</span>
          </div>
        )}
        
        {/* Text Prompt Inputs (Manual + Connected) */}
        <div className="space-y-3 py-2 border-t border-white/5">
          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <span className="text-[7px] font-black text-white/30 tracking-[0.2em] uppercase">PROMPT PRINCIPAL</span>
              {resolveValue(node.id, 'promptIn') && <span className="text-[6px] font-bold text-emerald-500 uppercase">CONNECTÉ</span>}
            </div>
            <textarea 
              value={resolveValue(node.id, 'promptIn') || node.data.promptValue || ''}
              onChange={e => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, promptValue: e.target.value } } : n))}
              placeholder="Entrez votre prompt ici..."
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-[10px] text-white/80 font-medium outline-none h-[420px] resize-none focus:border-white/20 transition-all custom-scrollbar shrink-0"
              readOnly={!!resolveValue(node.id, 'promptIn')}
            />
          </div>

          {Array.from({ length: node.data.textInputCount || 0 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-[7px] font-black text-white/30 tracking-[0.2em] uppercase">TEXTE {i + 1}</span>
                {resolveValue(node.id, `text${i}`) && <span className="text-[6px] font-bold text-emerald-500 uppercase">CONNECTÉ</span>}
              </div>
              <input 
                type="text"
                value={resolveValue(node.id, `text${i}`) || node.data[`textValue${i}`] || ''}
                onChange={e => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, [`textValue${i}`]: e.target.value } } : n))}
                placeholder={`Texte additionnel ${i + 1}...`}
                className="w-full h-10 bg-black/40 border border-white/10 rounded-xl px-3 text-[10px] text-white/80 font-medium outline-none focus:border-white/20 transition-all shrink-0"
                readOnly={!!resolveValue(node.id, `text${i}`)}
              />
            </div>
          ))}
        </div>

        {/* Negative Prompt */}
        <div className="space-y-2 py-2 border-t border-white/5">
          <div className="flex justify-between items-center px-1">
            <span className="text-[7px] font-black text-white/30 tracking-[0.2em] uppercase">PROMPT NEGATIF</span>
            {resolveValue(node.id, 'negIn') && <span className="text-[6px] font-bold text-emerald-500 uppercase">CONNECTÉ</span>}
          </div>
          <textarea 
            value={resolveValue(node.id, 'negIn') || node.data.negative || ''}
            onChange={e => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, negative: e.target.value } } : n))}
            placeholder="Élément à exclure..."
            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-[10px] text-white/80 font-medium outline-none h-16 resize-none focus:border-white/20 transition-all custom-scrollbar shrink-0"
            readOnly={!!resolveValue(node.id, 'negIn')}
          />
        </div>
        
        <div className="space-y-3 py-2 border-t border-white/5">
          {!isModelConnected && (
            <div className="space-y-1.5">
              <span className="text-[7px] font-black text-white/30 uppercase tracking-[0.2em]">MODÈLE IA</span>
              <div className="grid grid-cols-1 gap-1">
                {MODELS.map(m => (
                  <button 
                    key={m.id} 
                    onClick={() => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, model: m.id } } : n))}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all ${node.data.model === m.id ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-white/5 border-white/5 text-white/40 hover:border-white/10'}`}
                  >
                    <Cpu size={10} />
                    <span className="text-[8px] font-black uppercase tracking-wider">{m.name}</span>
                    {node.data.model === m.id && <Check size={10} className="ml-auto" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isFormatConnected && (
            <div className="space-y-1.5">
              <span className="text-[7px] font-black text-white/30 uppercase tracking-[0.2em]">FORMAT</span>
              <div className="grid grid-cols-5 gap-1">
                {RATIOS.map(r => (
                  <button 
                    key={r} 
                    onClick={() => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, aspectRatio: r } } : n))}
                    className={`h-7 rounded-lg border flex items-center justify-center text-[8px] font-black transition-all ${node.data.aspectRatio === r ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-white/5 border-white/5 text-white/40 hover:border-white/10'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isResolutionConnected && (
            <div className="space-y-1.5">
              <span className="text-[7px] font-black text-white/30 uppercase tracking-[0.2em]">RÉSOLUTION</span>
              <div className="grid grid-cols-3 gap-1">
                {(() => {
                  const maxResLimit = getResolutionLimit(node.id, node.type, node.data);
                  return RESOLUTIONS.map(r => {
                    const disabled = isResDisabled(r, maxResLimit);
                    return (
                      <button 
                        key={r} 
                        disabled={disabled}
                        onClick={() => !disabled && setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, resolution: r } } : n))}
                        className={`h-7 rounded-lg border flex items-center justify-center text-[8px] font-black transition-all ${node.data.resolution === r ? 'bg-sky-500/20 border-sky-500/50 text-sky-400' : (disabled ? 'bg-white/5 border-transparent text-white/10 cursor-not-allowed opacity-20' : 'bg-white/5 border-white/5 text-white/40 hover:border-white/10')}`}
                      >
                        {r}
                      </button>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          <div className="space-y-2 pt-1 border-t border-white/5">
            <div className="flex gap-1">
              <div className="flex-1 flex items-center justify-between gap-1 bg-white/5 px-2 py-1.5 rounded-lg border border-white/10">
                <button onClick={() => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, textInputCount: (n.data.textInputCount || 0) + 1 } } : n))} className="p-0.5 hover:bg-white/10 rounded text-emerald-500"><Plus size={10} /></button>
                <span className="text-[6px] font-black text-white/30 uppercase tracking-tighter">+ TXT -</span>
                <button onClick={() => smartRemoveInput(node.id, 'text')} className="p-0.5 hover:bg-white/10 rounded text-emerald-500"><Minus size={10} /></button>
              </div>
              <div className="flex-1 flex items-center justify-between gap-1 bg-white/5 px-2 py-1.5 rounded-lg border border-white/10">
                <button onClick={() => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, imageInputCount: (n.data.imageInputCount || 1) + 1 } } : n))} className="p-0.5 hover:bg-white/10 rounded text-emerald-500"><Plus size={10} /></button>
                <span className="text-[6px] font-black text-white/30 uppercase tracking-tighter">+ IMG -</span>
                <button onClick={() => smartRemoveInput(node.id, 'image')} className="p-0.5 hover:bg-white/10 rounded text-emerald-500"><Minus size={10} /></button>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: node.data.textInputCount || 0 }).map((_, i) => (
                <div key={i} className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[5px] font-black uppercase">
                  T{i + 1}
                </div>
              ))}
              {Array.from({ length: node.data.imageInputCount || 1 }).map((_, i) => (
                <div key={i} className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[5px] font-black uppercase">
                  I{i + 1}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <span className="text-[7px] font-black text-white/30 uppercase tracking-[0.2em]">QUANTITÉ</span>
            <div className="grid grid-cols-4 gap-1">
              {[1, 2, 4, 8].map(q => (
                <button 
                  key={q} 
                  onClick={() => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, imageCount: q } } : n))}
                  className={`h-7 rounded-lg border flex items-center justify-center text-[8px] font-black transition-all ${node.data.imageCount === q ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' : 'bg-white/5 border-white/5 text-white/40 hover:border-white/10'}`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2 shrink-0">
          <span className="text-[7px] font-black text-white/30 uppercase tracking-widest">NEGATIVE PROMPT</span>
          <textarea 
            className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-[9px] text-white font-medium outline-none h-16 resize-none"
            placeholder="Éléments à éviter..."
            value={node.data.negative || ''}
            onChange={e => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, negative: e.target.value } } : n))}
          />
        </div>

        <div className="pt-3 border-t border-white/10 mt-3 space-y-3">
          {activeJob && (
            <div className="flex items-center gap-2 px-2 py-1 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <Bell size={10} className="text-blue-400" />
              <span className="text-[8px] font-black uppercase text-blue-400">JOB ACTIF : {activeJob.id.slice(0, 8)}</span>
            </div>
          )}
          
          <button 
            onClick={async () => {
              await handleAction(node.id);
            }}
            disabled={node.data.isProcessing}
            className="w-full h-10 bg-sky-600 hover:bg-sky-500 text-white rounded-xl flex items-center justify-center gap-2 font-black text-[9px] uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-50"
          >
            {node.data.isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
            GÉNÉRER
          </button>
          
          {activeJob && (
            <button 
              onClick={() => setActiveJob(null)}
              className="w-full py-1 text-[8px] text-white/20 hover:text-white/40 uppercase font-black"
            >
              Annuler le Job en cours
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderComboSelectorFields = (node: NodeState, isRightPanel: boolean = false) => {
    const comboInput = resolveValue(node.id, 'textIn') || "";
    const comboManual = node.data.additionalText || "";
    const del = node.data.delimiter || '*';
    const combined = (comboInput + (comboInput && comboManual && !comboInput.trim().endsWith(del) ? del : "") + comboManual).trim();
    const items = combined.split(del).map(s => s.trim()).filter(s => s.length > 0);
    const selectedIdx = node.data.selectedIndex || 0;

    return (
      <div className="space-y-3 flex flex-col h-full overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl relative group">
          <List size={14} className="text-white/30" />
          <select 
            className="flex-1 bg-transparent text-[10px] font-black uppercase text-white outline-none cursor-pointer appearance-none"
            value={selectedIdx}
            onChange={e => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, selectedIndex: parseInt(e.target.value) } } : n))}
          >
            {items.map((item, i) => (
              <option key={i} value={i} className="bg-[#1e1e24] text-white">{item.substring(0, 30)}{item.length > 30 ? '...' : ''}</option>
            ))}
            {items.length === 0 && <option value={0} className="bg-[#1e1e24] text-white">AUCUN ÉLÉMENT</option>}
          </select>
        </div>
        <div className="space-y-2">
          <span className="text-[7px] font-black text-white/30 uppercase">MANUAL LIST ({del} separator)</span>
          <textarea 
            className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-[9px] text-white/70 font-medium outline-none resize-none h-24"
            value={node.data.additionalText}
            onChange={e => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, additionalText: e.target.value } } : n))}
          />
        </div>
      </div>
    );
  };

  const renderListSelectorFields = (node: NodeState) => {
    const arr = resolveValue(node.id, 'arrayIn') || [];
    const selectedIdx = node.data.selectedIndex || 0;
    return (
      <div className="space-y-3">
        <select 
          className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-[10px] font-black uppercase text-white outline-none"
          value={selectedIdx}
          onChange={e => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, selectedIndex: parseInt(e.target.value) } } : n))}
        >
          {Array.isArray(arr) && arr.map((item: string, i: number) => (
            <option key={i} value={i} className="bg-[#1e1e24] text-white">{item}</option>
          ))}
          {!Array.isArray(arr) || arr.length === 0 ? <option className="bg-[#1e1e24] text-white">VIDE</option> : null}
        </select>
      </div>
    );
  };

  const renderExportFields = (node: NodeState) => {
    const connectedRefImg = resolveValue(node.id, 'imageIn');
    const targetJobId = node.data.targetJobId || activeJob?.id || '';
    const destinationType = node.data.destinationType || 'firestore';
    const customUrl = node.data.customUrl || '';
    const customCollection = node.data.customCollection || 'exports';

    return (
      <div className="space-y-4 flex flex-col h-full overflow-y-auto pr-1">
        <div className="space-y-1">
          <span className="text-[7px] font-black text-white/30 uppercase tracking-[0.2em]">SOURCE D'IMAGE DE COMPOSITION</span>
          {connectedRefImg ? (
            <div className="flex items-center gap-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <Check size={12} />
              <span className="text-[8px] font-black uppercase">IMAGE CONNECTÉE - PRÊTE À L'EXPORT</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[8px] font-black uppercase">AUCUNE IMAGE SOURCE CONNECTÉE</span>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <span className="text-[7px] font-black text-white/30 uppercase tracking-[0.2em]">DESTINATION EXPORT</span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, destinationType: 'firestore' } } : n))}
              className={`py-2 rounded-lg border text-[8px] font-black uppercase transition-all ${destinationType === 'firestore' ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'bg-white/5 border-white/5 text-white/40 hover:border-white/10'}`}
            >
              FIRESTORE (PWA SYNC)
            </button>
            <button
              onClick={() => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, destinationType: 'api' } } : n))}
              className={`py-2 rounded-lg border text-[8px] font-black uppercase transition-all ${destinationType === 'api' ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' : 'bg-white/5 border-white/5 text-white/40 hover:border-white/10'}`}
            >
              API WEBHOOK (HTTP POST)
            </button>
          </div>
        </div>

        {destinationType === 'firestore' ? (
          <div className="space-y-3 p-3 bg-white/5 border border-white/10 rounded-xl">
            <div className="space-y-1">
              <span className="text-[7px] font-black text-white/40 uppercase">COLLECTION</span>
              <input
                className="w-full bg-black/40 border border-white/5 rounded-lg px-2.5 py-1.5 text-[9px] text-white/90 outline-none"
                value={customCollection}
                onChange={e => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, customCollection: e.target.value } } : n))}
                placeholder="Ex : exports"
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-[7px] font-black text-white/40 uppercase">ID DU DOCUMENT / JOB</span>
                {activeJob?.id === targetJobId && targetJobId && (
                  <span className="text-[6px] font-black text-blue-400 uppercase">JOB ACTIF</span>
                )}
              </div>
              <input
                className="w-full bg-black/40 border border-white/5 rounded-lg px-2.5 py-1.5 text-[9px] text-white/90 outline-none font-mono"
                value={targetJobId}
                onChange={e => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, targetJobId: e.target.value } } : n))}
                placeholder="ID du Job (Firestore)"
              />
              {activeJob && targetJobId !== activeJob.id && (
                <button
                  type="button"
                  onClick={() => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, targetJobId: activeJob.id } } : n))}
                  className="text-[7px] font-bold text-blue-400 hover:underline inline-block mt-0.5 text-left"
                >
                  Charger ID du job actif : {activeJob.id.slice(0, 8)}...
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3 p-3 bg-white/5 border border-white/10 rounded-xl">
            <div className="space-y-1">
              <span className="text-[7px] font-black text-white/40 uppercase">URL API CIBLE (REÇOIT LE BASE64)</span>
              <input
                className="w-full bg-black/40 border border-white/5 rounded-lg px-2.5 py-1.5 text-[9px] text-white/90 outline-none font-mono"
                value={customUrl}
                onChange={e => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, customUrl: e.target.value } } : n))}
                placeholder="https://votre-pwa-endpoint.com/api/save"
              />
            </div>
          </div>
        )}

        <div className="pt-2">
          <button
            onClick={() => handleAction(node.id)}
            disabled={node.data.isProcessing || !connectedRefImg}
            className={`w-full h-11 rounded-xl flex items-center justify-center gap-2 font-black text-[9px] uppercase tracking-widest transition-all shadow-lg active:scale-95 ${node.data.isProcessing ? 'bg-white/5 text-white/20' : connectedRefImg ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-white/5 text-white/10 cursor-not-allowed'}`}
          >
            {node.data.isProcessing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Dépôt en cours...
              </>
            ) : (
              <>
                <Upload size={14} />
                EXPORTER L'IMAGE
              </>
            )}
          </button>
        </div>

        <div className="text-[7px] font-semibold text-white/10 leading-relaxed p-2 bg-white/5 border border-white/5 rounded-lg font-mono">
          <div>DB: {firebaseConfig.projectId}</div>
          <div>FORMAT: BASE64 (JPEG COMPRESSÉ OPTIMISÉ)</div>
        </div>
      </div>
    );
  };

  const renderArraySplitterFields = (node: NodeState, isRightPanel: boolean = false) => {
    return (
      <div className="space-y-2">
        <span className="text-[7px] font-black text-white/30 uppercase">SÉPARATEUR</span>
        <input 
          className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white font-black"
          value={node.data.delimiter}
          onChange={e => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, delimiter: e.target.value } } : n))}
        />
      </div>
    );
  };

  const renderStyleSelectorFields = (node: NodeState) => (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {STYLES.map((s, i) => (
          <button 
            key={i} 
            onClick={() => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, selectedIndex: i } } : n))}
            className={`px-2 py-1 rounded text-[7px] font-black uppercase tracking-tighter transition-all ${node.data.selectedIndex === i ? 'bg-amber-500 text-black' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );

  const renderModelSelectorFields = (node: NodeState) => (
    <div className="grid grid-cols-1 gap-1.5">
      {MODELS.map(m => (
        <button 
          key={m.id} 
          onClick={() => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, model: m.id } } : n))}
          className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition-all ${node.data.model === m.id ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-white/5 border-white/5 text-white/40 hover:border-white/10'}`}
        >
          <Cpu size={14} />
          <span className="text-[9px] font-black uppercase tracking-widest">{m.name}</span>
          {node.data.model === m.id && <Check size={12} className="ml-auto" />}
        </button>
      ))}
    </div>
  );

  const renderFormatSelectorFields = (node: NodeState) => (
    <div className="grid grid-cols-3 gap-1.5">
      {RATIOS.map(r => (
        <button 
          key={r} 
          onClick={() => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, aspectRatio: r } } : n))}
          className={`h-10 rounded-xl border flex items-center justify-center text-[9px] font-black transition-all ${node.data.aspectRatio === r ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-white/5 border-white/5 text-white/40'}`}
        >
          {r}
        </button>
      ))}
    </div>
  );

  const getResolutionLimit = (nodeId: string, nodeType: string, nodeData: any) => {
    let currentModelId = nodeData?.model;
    if (nodeType === NodeType.IMAGE_GENERATOR) {
      currentModelId = resolveValue(nodeId, 'modelIn') || nodeData?.model;
    } else if (nodeType === NodeType.RESOLUTION_SELECTOR) {
      const connectionsToGen = connections.filter(c => c.sourceNodeId === nodeId && c.sourceHandle === 'resolutionOut');
      if (connectionsToGen.length > 0) {
        const targetNode = nodes.find(n => n.id === connectionsToGen[0].targetNodeId);
        if (targetNode) {
          currentModelId = resolveValue(targetNode.id, 'modelIn') || targetNode.data?.model;
        }
      }
    }
    const model = MODELS.find(m => m.id === currentModelId) || MODELS[0];
    return model.maxRes || '1K';
  };

  const isResDisabled = (res: string, maxRes: string) => {
    if (maxRes === '4K') return false;
    if (maxRes === '2K' && res === '4K') return true;
    if (maxRes === '1K' && (res === '2K' || res === '4K')) return true;
    return false;
  };

  const renderResolutionSelectorFields = (node: NodeState) => {
    const maxResLimit = getResolutionLimit(node.id, node.type, node.data);
    
    return (
      <div className="space-y-4">
        {node.type === NodeType.RESOLUTION_SELECTOR && (
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-3 block text-center">LIMITATION : {maxResLimit}</label>
        )}
        <div className="grid grid-cols-3 gap-1.5">
          {RESOLUTIONS.map(r => {
            const disabled = isResDisabled(r, maxResLimit);
            return (
              <button 
                key={r} 
                disabled={disabled}
                onClick={() => {
                  if (!disabled) {
                    setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, resolution: r } } : n));
                  }
                }}
                className={`h-10 rounded-xl border flex items-center justify-center text-[9px] font-black transition-all ${node.data.resolution === r ? 'bg-sky-500/20 border-sky-500 text-sky-400' : (disabled ? 'bg-white/5 border-transparent text-white/10 cursor-not-allowed opacity-20' : 'bg-white/5 border-white/5 text-white/40 hover:border-white/20')}`}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderOnOffFields = (node: NodeState) => (
    <div className="flex-1 flex flex-col items-center justify-center">
      <button 
        onClick={() => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, isOn: !n.data.isOn } } : n))}
        className={`w-full h-12 rounded-xl flex items-center justify-center gap-3 transition-all ${node.data.isOn ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'bg-red-500/10 text-red-500/40 border border-red-500/10'}`}
      >
        <Power size={16} />
        <span className="text-[10px] font-black uppercase tracking-widest">{node.data.isOn ? 'ACTIF' : 'INACTIF'}</span>
      </button>
    </div>
  );

  const renderBackgroundRemoverFields = (node: NodeState, isRightPanel: boolean = false) => {
    const localImages = node.data.images || [];
    const selectedIdx = node.data.selectedImageIndex || 0;
    const localImg = localImages[selectedIdx];
    const connectedImg = resolveValue(node.id, 'imageIn');
    const img = localImg || (Array.isArray(connectedImg) ? connectedImg[0] : connectedImg);
    const result = node.outputs.imageOut;
    
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      
      const fileList = Array.from(files);
      let processedCount = 0;
      const newImages: string[] = [];

      fileList.forEach((file: File) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const result = event.target?.result as string;
          if (result) {
            const compressed = await compressImage(result);
            newImages.push(compressed);
          }
          processedCount++;
          
          if (processedCount === fileList.length) {
            saveToHistory();
            setNodes(ns => ns.map(n => n.id === node.id ? { 
              ...n, 
              data: { ...n.data, images: [...(n.data.images || []), ...newImages] } 
            } : n));
          }
        };
        reader.readAsDataURL(file);
      });
      e.target.value = '';
    };
    
    return (
      <div className="flex-1 flex flex-col gap-3 overflow-hidden">
        {/* Input Preview (Top) */}
        <div className="h-32 rounded-xl border border-white/10 overflow-hidden relative group shrink-0 checkerboard">
          {img ? (
            <img src={img} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-white/10">
              <ImageIcon size={24} strokeWidth={1} />
              <span className="text-[7px] font-black uppercase tracking-widest">INPUT IMAGE</span>
            </div>
          )}
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 rounded text-[6px] font-black text-white/40 uppercase tracking-widest border border-white/5">SOURCE</div>
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
             <div className="relative">
                <input type="file" multiple accept="image/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white text-black rounded-lg text-[8px] font-black uppercase tracking-widest">
                  <Upload size={10} />
                  IMPORTER
                </div>
             </div>
          </div>
        </div>

        {/* Local Image Grid (like Reference Images) */}
        {localImages.length > 0 && (
          <div className="grid grid-cols-4 gap-2 max-h-24 overflow-y-auto custom-scrollbar pr-1 shrink-0">
            {localImages.map((lImg: string, idx: number) => (
              <div 
                key={idx} 
                onClick={() => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, selectedImageIndex: idx } } : n))}
                className={`aspect-square rounded-lg overflow-hidden border relative group/thumb cursor-pointer transition-all checkerboard ${idx === selectedIdx ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-white/10 opacity-50 hover:opacity-100'}`}
              >
                <img src={lImg} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setNodes(ns => ns.map(n => n.id === node.id ? { 
                      ...n, 
                      data: { 
                        ...n.data, 
                        images: localImages.filter((_:any,i:number) => i !== idx),
                        selectedImageIndex: idx === selectedIdx ? 0 : (idx < selectedIdx ? Math.max(0, selectedIdx - 1) : selectedIdx)
                      } 
                    } : n));
                  }} 
                  className="absolute top-0 right-0 p-1 bg-red-500 text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity z-20"
                >
                  <Trash size={8}/>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Generate Button (Middle) */}
        <button 
          onClick={() => handleAction(node.id)} 
          disabled={node.data.isProcessing || !img}
          className={`w-full h-10 rounded-xl flex items-center justify-center gap-2 transition-all border shrink-0 ${node.data.isProcessing ? 'bg-white/5 border-white/10 text-white/20' : img ? 'bg-sky-500/20 border-sky-500/40 text-sky-400 hover:bg-sky-500/30' : 'bg-white/5 border-white/5 text-white/10 cursor-not-allowed'}`}
        >
          {node.data.isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Scissors size={14} />}
          <span className="text-[9px] font-black uppercase tracking-widest">{node.data.isProcessing ? 'TRAITEMENT...' : 'GÉNÉRER'}</span>
        </button>

        {/* Output Preview (Bottom) */}
        <div className="flex-1 rounded-xl border border-white/10 overflow-hidden relative group min-h-[100px] checkerboard">
          {result ? (
            <img src={result} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-white/5">
              <Scissors size={32} strokeWidth={1} />
              <span className="text-[7px] font-black uppercase tracking-widest">RÉSULTAT PNG</span>
            </div>
          )}
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 rounded text-[6px] font-black text-white/40 uppercase tracking-widest border border-white/5">DÉTOURAGE</div>
          {node.data.isProcessing && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-20">
              <Loader2 size={24} className="text-white/20 animate-spin" />
            </div>
          )}
        </div>

        {result && (
          <div className="flex justify-center shrink-0">
            <a href={result} download="removed-bg.png" className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-all w-full justify-center">
              <Download size={12} /> TÉLÉCHARGER
            </a>
          </div>
        )}
      </div>
    );
  };

  const renderCompositorFields = (node: NodeState, isRightPanel: boolean = false) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const imageCount = node.data.imageInputCount || 2;
    const layers = node.data.layers || Array.from({ length: imageCount }, () => ({ scale: 1, x: 0, y: 0, rotation: 0 }));

    const updateLayer = (idx: number, updates: any) => {
      const newLayers = [...layers];
      while (newLayers.length <= idx) newLayers.push({ scale: 1, x: 0, y: 0, rotation: 0 });
      newLayers[idx] = { ...newLayers[idx], ...updates };
      setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, layers: newLayers } } : n));
    };

    const updateNodeData = (updates: any) => {
      setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, ...updates } } : n));
    };

    const handleAdd = () => {
      saveToHistory();
      setNodes(nds => nds.map(n => n.id === node.id ? { 
        ...n, 
        data: { 
          ...n.data, 
          imageInputCount: (n.data.imageInputCount || 2) + 1,
          layers: [...(n.data.layers || Array.from({ length: n.data.imageInputCount || 2 }, () => ({ scale: 1, x: 0, y: 0, rotation: 0 }))), { scale: 1, x: 0, y: 0, rotation: 0 }]
        } 
      } : n));
    };

    const handleRemove = () => {
      if ((node.data.imageInputCount || 2) <= 1) return;
      saveToHistory();
      smartRemoveInput(node.id, 'image');
      setNodes(nds => nds.map(n => n.id === node.id ? { 
        ...n, 
        data: { 
          ...n.data, 
          imageInputCount: Math.max(1, (n.data.imageInputCount || 2) - 1),
          layers: (n.data.layers || []).slice(0, -1)
        } 
      } : n));
    };

    const expandedLayers = node.data.expandedLayers || { 0: true };
    const toggleLayerExpanded = (idx: number) => {
      setNodes(nds => nds.map(n => n.id === node.id ? { 
        ...n, 
        data: { 
          ...n.data, 
          expandedLayers: { ...expandedLayers, [idx]: !expandedLayers[idx] } 
        } 
      } : n));
    };

    return (
      <div className={`flex flex-col h-full space-y-3 overflow-hidden ${isRightPanel ? 'min-h-[600px]' : ''}`}>
        <div className="shrink-0 aspect-square w-[228px] mx-auto rounded-xl overflow-hidden border border-white/10 relative shadow-inner checkerboard">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {Array.from({ length: imageCount }).map((_, i) => {
              let img = resolveValue(node.id, `image${i}`);
              if (i === 0 && node.data.backgroundId) {
                img = resolveBackgroundUrl(node.data.backgroundId);
              }
              const layer = layers[i] || { scale: 1, x: 0, y: 0, rotation: 0 };
              if (!img) return null;
              const imgSrc = Array.isArray(img) ? img[0] : img;
              if (!imgSrc) return null;

              return (
                <div 
                  key={i}
                  className="absolute inset-0 transition-transform pointer-events-none flex items-center justify-center overflow-hidden"
                  style={{
                    zIndex: i + 1,
                    transform: `translate(${layer.x}px, ${layer.y}px) rotate(${layer.rotation}deg)`
                  }}
                >
                  <FirebaseBackgroundPreview 
                    bgId={i === 0 ? node.data.backgroundId : ''} 
                    imgSrc={imgSrc} 
                    layer={layer} 
                    className="max-w-none transition-transform" 
                  />
                </div>
              );
            })}

            {/* Logo overlay */}
            {node.data.logo && node.data.logoId && (
              (() => {
                let logoX = 512;
                let logoY = 512;
                if (node.data.logoPosition && typeof node.data.logoPosition === 'string') {
                  const parts = node.data.logoPosition.split('/');
                  if (parts.length === 2) {
                    logoX = Number(parts[0]) || 512;
                    logoY = Number(parts[1]) || 512;
                  }
                }
                return (
                  <FirebaseLogoPreview 
                    logoId={node.data.logoId} 
                    logoX={logoX} 
                    logoY={logoY} 
                    logoSize={node.data.logoSize} 
                    logoColor={node.data.logoColor} 
                  />
                );
              })()
            )}
            
            {/* Text overlay */}
            {node.data.text && node.data.textValue && (
              (() => {
                let textX = 512;
                let textY = 800;
                if (node.data.textPosition && typeof node.data.textPosition === 'string') {
                  const parts = node.data.textPosition.split('/');
                  if (parts.length === 2) {
                    textX = Number(parts[0]) || 512;
                    textY = Number(parts[1]) || 800;
                  }
                }
                const fSize = Number(node.data.textFontSize) || 32;
                const scaleFactor = 228 / 1024;
                const pxX = textX * scaleFactor;
                const pxY = textY * scaleFactor;
                const pxFontSize = fSize * scaleFactor;
                
                return (
                  <div 
                    className="absolute text-center select-none pointer-events-none"
                    style={{
                      left: `${pxX}px`,
                      top: `${pxY}px`,
                      zIndex: 11,
                      transform: 'translate(-50%, -50%)',
                      fontSize: `${pxFontSize}px`,
                      color: node.data.textColor || '#ffffff',
                      fontFamily: node.data.textFontFamily || 'sans-serif',
                      fontWeight: node.data.fontWeight || 'bold',
                      textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {node.data.textValue}
                  </div>
                );
              })()
            )}
          </div>
          {node.data.isProcessing && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[50]">
              <Loader2 size={24} className="text-white animate-spin" />
            </div>
          )}
        </div>

        <div className={`flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar ${isRightPanel ? 'h-96' : ''}`}>
          {Array.from({ length: imageCount }).map((_, i) => {
            const layer = layers[i] || { scale: 1, x: 0, y: 0, rotation: 0 };
            const isExpanded = !!expandedLayers[i];

            return (
              <div key={i} className="p-2 bg-white/5 border border-white/10 rounded-xl space-y-2">
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleLayerExpanded(i)}
                >
                  <div className="flex items-center gap-2">
                    <div className="p-0.5 rounded hover:bg-white/5 transition-colors">
                      {isExpanded ? <ChevronDown size={10} className="text-white/40" /> : <ChevronRight size={10} className="text-white/40" />}
                    </div>
                    <span className="text-[8px] font-black uppercase text-emerald-500 tracking-widest">LAYER {pad(i+1)}</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); updateLayer(i, { scale: 1, x: 0, y: 0, rotation: 0, fit: i === 0 }); }}
                      className="p-1 hover:bg-white/10 rounded transition-colors"
                      title="Reset parameters"
                    >
                      <RotateCcw size={8} className="text-white/40 hover:text-white" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); updateLayer(i, { fit: !layer.fit }); }}
                      className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest transition-all ${layer.fit ? 'bg-emerald-500 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
                    >
                      FIT
                    </button>
                    {resolveValue(node.id, `image${i}`) ? <Check size={8} className="text-emerald-500" /> : <div className="w-2 h-2 rounded-full bg-white/10" />}
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="space-y-2 pt-1 border-t border-white/5 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center h-3">
                        <span className="text-[7px] font-black text-white/30 uppercase tracking-widest">ÉCHELLE</span>
                        <div className="flex items-center gap-1">
                          <input 
                            type="number" step="0.01" value={layer.scale} 
                            onChange={e => updateLayer(i, { scale: parseFloat(e.target.value) || 0 })} 
                            className={`bg-transparent text-[8px] text-right font-bold text-white/50 w-12 outline-none ${layer.fit ? 'opacity-30' : ''}`}
                            onMouseDown={e => e.stopPropagation()}
                            disabled={layer.fit}
                          />
                          <span className={`text-[7px] font-bold text-white/30 uppercase ${layer.fit ? 'opacity-30' : ''}`}>%</span>
                        </div>
                      </div>
                      <input 
                        type="range" min="0.5" max="1.5" step="0.01" value={layer.scale} 
                        onChange={e => updateLayer(i, { scale: parseFloat(e.target.value) })} 
                        onMouseDown={e => e.stopPropagation()} 
                        className={`w-full accent-emerald-500 h-1 bg-white/5 rounded-lg appearance-none cursor-pointer ${layer.fit ? 'opacity-30 pointer-events-none' : ''}`}
                        disabled={layer.fit}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center h-3">
                          <span className="text-[7px] font-black text-white/30 uppercase tracking-widest">POSITION X</span>
                          <div className="flex items-center gap-1">
                            <input 
                              type="number" value={layer.x} 
                              onChange={e => updateLayer(i, { x: parseInt(e.target.value) || 0 })} 
                              className="bg-transparent text-[8px] text-right font-bold text-white/50 w-12 outline-none" 
                              onMouseDown={e => e.stopPropagation()}
                            />
                            <span className="text-[7px] font-bold text-white/30 uppercase">PX</span>
                          </div>
                        </div>
                        <input type="range" min="-75" max="75" step="1" value={layer.x} onChange={e => updateLayer(i, { x: parseInt(e.target.value) })} onMouseDown={e => e.stopPropagation()} className="w-full accent-emerald-500 h-1 bg-white/5 rounded-lg appearance-none cursor-pointer" />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center h-3">
                          <span className="text-[7px] font-black text-white/30 uppercase tracking-widest">POSITION Y</span>
                          <div className="flex items-center gap-1">
                            <input 
                              type="number" value={layer.y} 
                              onChange={e => updateLayer(i, { y: parseInt(e.target.value) || 0 })} 
                              className="bg-transparent text-[8px] text-right font-bold text-white/50 w-12 outline-none" 
                              onMouseDown={e => e.stopPropagation()}
                            />
                            <span className="text-[7px] font-bold text-white/30 uppercase">PX</span>
                          </div>
                        </div>
                        <input type="range" min="-75" max="75" step="1" value={layer.y} onChange={e => updateLayer(i, { y: parseInt(e.target.value) })} onMouseDown={e => e.stopPropagation()} className="w-full accent-emerald-500 h-1 bg-white/5 rounded-lg appearance-none cursor-pointer" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center h-3">
                        <span className="text-[7px] font-black text-white/30 uppercase tracking-widest">ROTATION</span>
                        <div className="flex items-center gap-1">
                          <input 
                            type="number" step="0.1" value={layer.rotation} 
                            onChange={e => updateLayer(i, { rotation: parseFloat(e.target.value) || 0 })} 
                            className="bg-transparent text-[8px] text-right font-bold text-white/50 w-12 outline-none" 
                            onMouseDown={e => e.stopPropagation()}
                          />
                          <span className="text-[7px] font-bold text-white/30 uppercase">°</span>
                        </div>
                      </div>
                      <input type="range" min="-180" max="180" step="1" value={layer.rotation} onChange={e => updateLayer(i, { rotation: parseFloat(e.target.value) })} onMouseDown={e => e.stopPropagation()} className="w-full accent-emerald-500 h-1 bg-white/5 rounded-lg appearance-none cursor-pointer" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* PWA Injected Overlays Panel & Simulator */}
          <div className="p-2 bg-emerald-500/5 border border-emerald-500/10 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Sparkles size={11} className="text-emerald-400 animate-pulse" />
                <span className="text-[8px] font-black uppercase text-emerald-400 tracking-widest">
                  SIMULATEUR / CONTRÔLEUR PWA
                </span>
              </div>
              <span className="text-[7px] font-mono px-1 py-0.5 bg-emerald-400/10 text-emerald-300 rounded uppercase">
                Active
              </span>
            </div>

            {/* Background input */}
            <div className="space-y-1 bg-[#121216] border border-white/5 p-3 rounded-xl mt-1">
              <label className="text-[7.5px] font-black text-white/40 uppercase tracking-widest block">
                Arrière-plan PWA (Background ID)
              </label>
              <div className="flex gap-1.5 mt-1">
                <input
                  type="text"
                  placeholder="e.g. CITY 01"
                  value={node.data.backgroundId || ''}
                  onChange={e => {
                    updateNodeData({ backgroundId: e.target.value });
                  }}
                  onMouseDown={e => e.stopPropagation()}
                  className="w-full bg-black/40 border border-white/5 rounded-lg px-2 py-1 text-[8px] font-mono text-white outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>

            {/* Logo Settings */}
            <div className="space-y-1.5 border-t border-white/5 pt-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[7.5px] font-black text-white/60 uppercase tracking-widest">
                  COUCHE LOGO
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateNodeData({ logo: !node.data.logo });
                  }}
                  onMouseDown={e => e.stopPropagation()}
                  className={`px-1.5 py-0.5 rounded text-[6.5px] font-black uppercase tracking-wider transition-all ${node.data.logo ? 'bg-emerald-500 text-white' : 'bg-white/5 text-white/40'}`}
                >
                  {node.data.logo ? 'ACTIF' : 'INACTIF'}
                </button>
              </div>

              {node.data.logo && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="space-y-1">
                    <span className="text-[6.5px] font-black text-white/30 uppercase tracking-widest block">
                      Logo GCS URI / URL
                    </span>
                    <input
                      type="text"
                      placeholder="gs://bucket/path.png"
                      value={node.data.logoId || ''}
                      onChange={e => updateNodeData({ logoId: e.target.value })}
                      onMouseDown={e => e.stopPropagation()}
                      className="w-full bg-black/40 border border-white/5 rounded-lg px-1.5 py-0.5 text-[7px] font-mono text-white outline-none focus:border-emerald-500/50"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="space-y-0.5">
                      <span className="text-[6.5px] font-black text-white/30 uppercase tracking-widest block">
                        Taille PX
                      </span>
                      <input
                        type="text"
                        placeholder="120"
                        value={node.data.logoSize || ''}
                        onChange={e => updateNodeData({ logoSize: e.target.value })}
                        onMouseDown={e => e.stopPropagation()}
                        className="w-full bg-black/40 border border-white/5 rounded-lg px-1 py-0.5 text-[8px] font-mono text-white text-center outline-none"
                      />
                    </div>
                    <div className="space-y-0.5 col-span-2">
                      <span className="text-[6.5px] font-black text-white/30 uppercase tracking-widest block">
                        Position (X/Y sur 1024)
                      </span>
                      <input
                        type="text"
                        placeholder="512/512"
                        value={node.data.logoPosition || ''}
                        onChange={e => updateNodeData({ logoPosition: e.target.value })}
                        onMouseDown={e => e.stopPropagation()}
                        className="w-full bg-black/40 border border-white/5 rounded-lg px-1 py-0.5 text-[8px] font-mono text-white text-center outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[6.5px] font-black text-white/30 uppercase tracking-widest block">
                      Couleur du Filtre Logo (Hex)
                    </span>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        placeholder="#ffffff"
                        value={node.data.logoColor || ''}
                        onChange={e => updateNodeData({ logoColor: e.target.value })}
                        onMouseDown={e => e.stopPropagation()}
                        className="flex-1 bg-black/40 border border-white/5 rounded-lg px-1.5 py-0.5 text-[8px] font-mono text-white outline-none"
                      />
                      {node.data.logoColor && (
                        <div 
                          className="w-4 h-4 rounded border border-white/10 self-center shrink-0" 
                          style={{ backgroundColor: node.data.logoColor }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Text Settings */}
            <div className="space-y-1.5 border-t border-white/5 pt-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[7.5px] font-black text-white/60 uppercase tracking-widest">
                  COUCHE TEXTE
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateNodeData({ text: !node.data.text });
                  }}
                  onMouseDown={e => e.stopPropagation()}
                  className={`px-1.5 py-0.5 rounded text-[6.5px] font-black uppercase tracking-wider transition-all ${node.data.text ? 'bg-emerald-500 text-white' : 'bg-white/5 text-white/40'}`}
                >
                  {node.data.text ? 'ACTIF' : 'INACTIF'}
                </button>
              </div>

              {node.data.text && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="space-y-1">
                    <span className="text-[6.5px] font-black text-white/30 uppercase tracking-widest block">
                      Valeur du texte
                    </span>
                    <input
                      type="text"
                      placeholder="BENTLEY GT SPEED"
                      value={node.data.textValue || ''}
                      onChange={e => updateNodeData({ textValue: e.target.value })}
                      onMouseDown={e => e.stopPropagation()}
                      className="w-full bg-black/40 border border-white/5 rounded-lg px-1.5 py-0.5 text-[8px] text-white outline-none focus:border-emerald-500/50"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="space-y-0.5">
                      <span className="text-[6.5px] font-black text-white/30 uppercase tracking-widest block">
                        Font Size
                      </span>
                      <input
                        type="text"
                        placeholder="32"
                        value={node.data.textFontSize || ''}
                        onChange={e => updateNodeData({ textFontSize: e.target.value })}
                        onMouseDown={e => e.stopPropagation()}
                        className="w-full bg-black/40 border border-white/5 rounded-lg px-1 py-0.5 text-[8px] font-mono text-white text-center outline-none"
                      />
                    </div>
                    <div className="space-y-0.5 col-span-2">
                      <span className="text-[6.5px] font-black text-white/30 uppercase tracking-widest block">
                        Position (X/Y sur 1024)
                      </span>
                      <input
                        type="text"
                        placeholder="512/800"
                        value={node.data.textPosition || ''}
                        onChange={e => updateNodeData({ textPosition: e.target.value })}
                        onMouseDown={e => e.stopPropagation()}
                        className="w-full bg-black/40 border border-white/5 rounded-lg px-1 py-0.5 text-[8px] font-mono text-white text-center outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[6.5px] font-black text-white/30 uppercase tracking-widest block">
                      Couleur du texte (Hex)
                    </span>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        placeholder="#ffffff"
                        value={node.data.textColor || ''}
                        onChange={e => updateNodeData({ textColor: e.target.value })}
                        onMouseDown={e => e.stopPropagation()}
                        className="flex-1 bg-black/40 border border-white/5 rounded-lg px-1.5 py-0.5 text-[8px] font-mono text-white outline-none"
                      />
                      {node.data.textColor && (
                        <div 
                          className="w-4 h-4 rounded border border-white/10 self-center shrink-0" 
                          style={{ backgroundColor: node.data.textColor }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 flex gap-2 pt-2 border-t border-white/5">
          <button onClick={handleAdd} className="flex-1 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-2 hover:bg-white/10 transition-all group">
            <Plus size={14} className="text-emerald-500" />
            <span className="text-[8px] font-black uppercase tracking-widest">IMAGE</span>
            <Plus size={14} className="text-emerald-500 opacity-20" />
          </button>
          <button onClick={handleRemove} className="flex-1 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-2 hover:bg-white/10 transition-all group">
            <Minus size={14} className="text-white/40" />
            <span className="text-[8px] font-black uppercase tracking-widest">RETIRER</span>
            <Minus size={14} className="text-white/10" />
          </button>
        </div>
      </div>
    );
  };

  const renderResultViewerFields = (node: NodeState) => {
    const img = resolveValue(node.id, 'imageIn');
    return (
      <div className="flex-1 flex flex-col gap-3 overflow-hidden">
        <div className="shrink-0 aspect-square w-full rounded-xl border border-white/10 overflow-hidden relative group checkerboard">
          {img ? (
            <img src={img} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-white/10">
              <ImageIcon size={48} strokeWidth={1} />
              <span className="text-[8px] font-black uppercase tracking-widest">EN ATTENTE DE RENDU</span>
            </div>
          )}
          {img && (
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
              <a href={img} download="generated-image.png" className="p-2 bg-black/60 rounded-full text-white/60 hover:text-white backdrop-blur-md border border-white/10"><Download size={14}/></a>
            </div>
          )}
        </div>
        {img && (
          <div className="flex justify-center shrink-0 pb-2">
            <a href={img} download="viewer-export.png" className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-all w-full justify-center">
              <Download size={12} /> TÉLÉCHARGER L'IMAGE
            </a>
          </div>
        )}
      </div>
    );
  };

  const renderImageInputFields = (node: NodeState, isRightPanel: boolean = false) => {
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      
      const fileList = Array.from(files);
      let processedCount = 0;
      const newImages: string[] = [];

      fileList.forEach((file: File) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const result = event.target?.result as string;
          if (result) {
            const compressed = await compressImage(result);
            newImages.push(compressed);
          }
          processedCount++;
          
          if (processedCount === fileList.length) {
            saveToHistory();
            setNodes(ns => ns.map(n => n.id === node.id ? { 
              ...n, 
              outputs: { imageOut: newImages[0] },
              data: { ...n.data, images: [...(n.data.images || []), ...newImages], selectedImageIndex: (n.data.images || []).length } 
            } : n));
          }
        };
        reader.onerror = () => {
          processedCount++;
          console.error("Erreur lors de la lecture du fichier:", file.name);
        };
        reader.readAsDataURL(file);
      });
      e.target.value = '';
    };

    const images = node.data.images || [];
    const selectedIdx = node.data.selectedImageIndex ?? 0;
    const selectedImage = images[selectedIdx];

    const labelStr = node.data.label?.toUpperCase() || '';
    const isBgNode = labelStr.includes('FOND') || labelStr.includes('BACKGROUND') || labelStr.includes('DECOR') || labelStr.includes('ARRIERE') || labelStr.includes('BACKDROP');
    const isLogoNode = labelStr.includes('LOGO') || labelStr.includes('FILIGRANE') || labelStr.includes('WATERMARK');

    const sourceType = node.data.sourceType || 'upload';
    const firebaseId = node.data.firebaseId || '';

    const setSourceType = (type: 'upload' | 'firebase') => {
      saveToHistory();
      setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, sourceType: type } } : n));
    };

    const handleFirebaseIdChange = (val: string) => {
      setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, firebaseId: val } } : n));
    };

    const handleResolveFirebaseAsset = async (customId?: string) => {
      const idToResolve = customId || firebaseId;
      if (!idToResolve) return;
      saveToHistory();
      
      setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, isProcessing: true } } : n));
      try {
        let url = '';
        if (isLogoNode) {
          url = await resolveLogoUrlAsync(idToResolve);
        } else {
          url = await resolveBackgroundUrlAsync(idToResolve);
        }
        
        if (url) {
          setNodes(ns => ns.map(n => {
            if (n.id === node.id) {
              const existingImages = n.data.images || [];
              const existsIdx = existingImages.indexOf(url);
              let nextIdx = existsIdx;
              let nextImages = [...existingImages];
              if (existsIdx === -1) {
                nextImages.push(url);
                nextIdx = nextImages.length - 1;
              }
              return {
                ...n,
                outputs: { imageOut: url },
                data: {
                  ...n.data,
                  images: nextImages,
                  selectedImageIndex: nextIdx,
                  firebaseId: idToResolve,
                  isProcessing: false
                }
              };
            }
            return n;
          }));
        } else {
          setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, isProcessing: false } } : n));
        }
      } catch (err) {
        console.error("Error resolving firebase asset:", err);
        setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, isProcessing: false } } : n));
      }
    };

    const subcats = BACKGROUND_CATALOG[selectedBgCat] ? Object.keys(BACKGROUND_CATALOG[selectedBgCat]) : [];
    const indexes = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

    return (
      <div className="space-y-3 flex flex-col h-full overflow-hidden">
        {/* Source Mode Selector */}
        <div className="flex bg-black/40 border border-white/10 rounded-xl p-1 gap-1 shrink-0">
          <button
            onClick={() => setSourceType('upload')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all ${sourceType === 'upload' ? 'bg-emerald-500 text-white shadow-md' : 'text-white/40 hover:text-white'}`}
          >
            <Upload size={10} /> Local PWA (Upload)
          </button>
          <button
            onClick={() => setSourceType('firebase')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all ${sourceType === 'firebase' ? 'bg-emerald-500 text-white shadow-md' : 'text-white/40 hover:text-white'}`}
          >
            <Sparkles size={10} /> Firebase Storage
          </button>
        </div>

        {/* Firebase Live Storage Reference Panel */}
        {sourceType === 'firebase' && (
          <div className="bg-[#121216]/90 border border-white/5 rounded-xl p-3.5 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={12} className="text-emerald-400 animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-wider text-white">
                  {isLogoNode ? "Logo (Firebase)" : "Environnement (Firebase)"}
                </span>
              </div>
              {node.data.isProcessing && (
                <span className="text-[7px] text-white/40 font-bold uppercase animate-pulse">Chargement...</span>
              )}
            </div>

            <div className="space-y-1">
              <span className="text-[7px] font-black text-white/30 uppercase tracking-widest block">ID / Chemin d'accès Storage</span>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder={isLogoNode ? "e.g. LOGOS/B/BENTLEY_01" : "e.g. CITY 01"}
                  value={firebaseId}
                  onChange={(e) => handleFirebaseIdChange(e.target.value)}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-2.5 py-1 text-[9px] font-bold text-white outline-none"
                />
                <button
                  onClick={() => handleResolveFirebaseAsset()}
                  disabled={node.data.isProcessing || !firebaseId}
                  className="px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-[8px] font-black uppercase tracking-widest rounded-lg transition-transform active:scale-95 disabled:opacity-50"
                >
                  Charger
                </button>
              </div>
              <p className="text-[6px] text-white/40 leading-normal pt-1">
                Entrez l'identifiant exact (ex: <code>CITY 01</code> ou <code>LOGOS/B/BENTLEY_01</code>) ou l'URI complète (ex: <code>gs://...</code>) pour charger le média correspondant.
              </p>
            </div>

            {/* Quick Catalog Choice Assist for Backgrounds */}
            {isBgNode && (
              <div className="border-t border-white/5 pt-2.5 space-y-2">
                <span className="text-[7.5px] font-black text-white/50 uppercase tracking-widest block">Assistant de Sélection :</span>
                <div className="grid grid-cols-1 gap-2">
                  <div className="space-y-1">
                    <span className="text-[6px] font-bold text-white/30 uppercase tracking-widest">Catégorie</span>
                    <select 
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-2 py-1 text-[8px] font-bold text-white outline-none cursor-pointer"
                      value={selectedBgCat}
                      onChange={(e) => {
                        const newCat = e.target.value;
                        setSelectedBgCat(newCat);
                        const keys = Object.keys(BACKGROUND_CATALOG[newCat] || {});
                        if (keys.length > 0) {
                          setSelectedBgSubcat(keys[0]);
                        }
                      }}
                    >
                      {Object.keys(BACKGROUND_CATALOG).map(cat => (
                        <option key={cat} value={cat} className="bg-[#1e1e24] text-white text-[8px]">{cat}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-1">
                    <div className="col-span-2 space-y-1">
                      <span className="text-[6px] font-bold text-white/30 uppercase tracking-widest">Famille</span>
                      <select 
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-1.5 py-1 text-[8px] font-bold text-white outline-none cursor-pointer"
                        value={selectedBgSubcat}
                        onChange={(e) => setSelectedBgSubcat(e.target.value)}
                      >
                        {subcats.map(sub => (
                          <option key={sub} value={sub} className="bg-[#1e1e24] text-white text-[8px]">{sub}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[6px] font-bold text-white/30 uppercase tracking-widest">Index</span>
                      <select 
                        className="w-full bg-[#121216] border border-white/10 rounded-xl px-1 py-1 text-[8px] font-bold text-white outline-none cursor-pointer text-center"
                        value={selectedBgIndex}
                        onChange={(e) => setSelectedBgIndex(e.target.value)}
                      >
                        {indexes.map(idx => (
                          <option key={idx} value={idx} className="bg-[#1e1e24] text-white text-[8px]">{idx}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    const prefix = BACKGROUND_CATALOG[selectedBgCat]?.[selectedBgSubcat] || 'CITY';
                    const filename = `${prefix} ${selectedBgIndex}`;
                    handleResolveFirebaseAsset(filename);
                  }}
                  className="w-full py-1.5 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white text-[7.5px] font-black uppercase tracking-widest rounded-lg transition-transform active:scale-95 shadow-md flex items-center justify-center gap-1"
                >
                  <FileImage size={10} /> Appliquer & Charger
                </button>
              </div>
            )}

            {/* Quick Logo selection assist panel */}
            {isLogoNode && (
              <div className="border-t border-white/5 pt-2.5 space-y-2">
                <span className="text-[7.5px] font-black text-white/50 uppercase tracking-widest block">Présélections de Logo :</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {['LOGOS/B/BENTLEY_01', 'LOGOS/P/PORSCHE_02'].map(lId => {
                    const name = lId.split('/').pop()?.replace('_01', '').replace('_02', '') || '';
                    return (
                      <button
                        key={lId}
                        onClick={() => handleResolveFirebaseAsset(lId)}
                        className="py-1 bg-white/5 hover:bg-emerald-500/10 hover:text-emerald-300 rounded text-[7px] font-black uppercase tracking-wider transition-all border border-white/5"
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Local PWA Upload Panel */}
        {sourceType === 'upload' && (
          <div className="h-16 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-white/5 transition-colors cursor-pointer relative group shrink-0">
            <input type="file" multiple accept="image/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
            <Upload size={14} className="text-white/20 group-hover:text-emerald-500 transition-colors" />
            <span className="text-[8px] font-black text-white/30 uppercase tracking-tighter text-center px-4 leading-none">AJOUTER DES SOURCES IMAGE (UPLOAD EN UNIQUE)</span>
          </div>
        )}

        {/* Image Preview & active status display */}
        {selectedImage && (
          <div className="relative group shrink-0">
            <div className="aspect-video w-full rounded-xl overflow-hidden border border-white/20 shadow-2xl checkerboard">
              <img src={selectedImage} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-emerald-500 text-[6px] font-black uppercase text-white tracking-widest shadow-lg flex items-center gap-1">
                <Check size={6} />
                IMAGE DE FLUX ACTIVE
              </div>
            </div>
          </div>
        )}

        {/* Thumbnail Selector list */}
        <div className={`grid grid-cols-4 gap-2 overflow-y-auto custom-scrollbar pr-1 ${isRightPanel ? 'h-96' : 'flex-1'}`}>
          {images.map((img: string, idx: number) => (
            <div 
              key={idx} 
              onClick={() => {
                saveToHistory();
                setNodes(ns => ns.map(n => n.id === node.id ? { 
                  ...n, 
                  outputs: { imageOut: img },
                  data: { ...n.data, selectedImageIndex: idx } 
                } : n));
              }}
              className={`aspect-square rounded-lg overflow-hidden border relative group/thumb shadow-lg cursor-pointer transition-all checkerboard ${idx === selectedIdx ? 'border-emerald-500 ring-2 ring-emerald-500/20 z-10 scale-105' : 'border-white/10 opacity-50 hover:opacity-100 hover:border-white/30'}`}
            >
              <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  saveToHistory();
                  setNodes(ns => ns.map(n => n.id === node.id ? { 
                    ...n, 
                    data: { 
                      ...n.data, 
                      images: images.filter((_:any,i:number) => i !== idx),
                      selectedImageIndex: idx === selectedIdx ? 0 : (idx < selectedIdx ? Math.max(0, selectedIdx - 1) : selectedIdx)
                    } 
                  } : n));
                }} 
                className="absolute top-0 right-0 p-1 bg-red-500 text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity z-20"
              >
                <Trash size={8}/>
              </button>
            </div>
          ))}
        </div>
        
        <div className="flex items-center justify-between gap-1 bg-white/5 p-1 rounded-lg border border-white/10 mt-auto">
          <button onClick={() => {}} className="p-1 hover:bg-emerald-500/20 rounded text-emerald-500"><Plus size={10} /></button>
          <span className="text-[7px] font-black text-white/50 uppercase">IMAGE DE FLUX</span>
          <button onClick={() => smartRemoveInput(node.id, 'image')} className="p-1 hover:bg-emerald-500/20 rounded text-emerald-500"><Minus size={10} /></button>
        </div>
      </div>
    );
  };

  const renderGenerateTriggerFields = (node: NodeState) => (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
      <button onClick={() => handleAction(node.id)} className={`w-full h-16 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all shadow-lg active:scale-95 ${node.data.isProcessing ? 'bg-amber-500/20 border-amber-500/40 text-amber-500' : 'bg-amber-500/10 border-amber-500/20 text-amber-500/80 hover:bg-amber-500/20 hover:border-amber-500/40 hover:text-amber-400'}`}>
        {node.data.isProcessing ? <Loader2 size={24} className="animate-spin" /> : <><Play size={24} fill="currentColor" /><span className="text-[8px] font-black uppercase tracking-widest">GÉNÉRER</span></>}
      </button>
    </div>
  );

  // --- INTERACTION HANDLERS ---

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const zoomSpeed = 0.001;
    const delta = -e.deltaY;
    const newZoom = Math.min(Math.max(view.zoom + delta * zoomSpeed, 0.1), 3);
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const newX = mouseX - (mouseX - view.x) * (newZoom / view.zoom);
    const newY = mouseY - (mouseY - view.y) * (newZoom / view.zoom);
    
    setView({ x: newX, y: newY, zoom: newZoom });
  }, [view]);

  const zones = useMemo(() => nodes.filter(n => n.type === NodeType.ZONE), [nodes]);
  const regularNodes = useMemo(() => nodes.filter(n => n.type !== NodeType.ZONE), [nodes]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#070708] select-none">
      {storageStatus !== 'ok' && (
        <div className="absolute top-4 left-[260px] right-[380px] bg-red-950/95 border border-red-500/50 rounded-2xl p-4 z-[200] flex items-center justify-between backdrop-blur-md shadow-2xl">
          <div className="flex items-center gap-3">
            <span className="text-xl animate-pulse">⚠️</span>
            <div>
              <h4 className="text-[10px] font-black text-red-400 uppercase tracking-widest leading-tight">Attention : Espace de stockage saturé</h4>
              <p className="text-[9px] text-white/50 leading-normal mt-0.5">Le navigateur ne peut plus enregistrer les images volumineuses. Vos connexions sont protégées, mais nous recommandons de vider le cache.</p>
            </div>
          </div>
          <button 
            onClick={() => {
              saveToHistory();
              const cleaned = nodes.map(n => {
                const cleanedData = { ...n.data };
                delete cleanedData.images;
                delete cleanedData.zoneImages;
                delete cleanedData.resultImage;
                delete cleanedData.base64;
                delete cleanedData.logoUrl;
                delete cleanedData.lastImageIn;
                return {
                  ...n,
                  outputs: {},
                  data: cleanedData
                };
              });
              setNodes(cleaned);
              
              try {
                // Perform a deep cleaning of all keys on the origin (wipes Firestore backups + ghost keys)
                const connStr = JSON.stringify(connections);
                const viewStr = JSON.stringify(view);
                localStorage.clear();
                localStorage.setItem('node_graph_nodes', JSON.stringify(cleaned));
                localStorage.setItem('node_graph_connections', connStr);
                localStorage.setItem('node_graph_view', viewStr);
                localStorage.setItem('node_graph_version', '1.2');
              } catch (err) {
                console.error("Local storage hard write failed", err);
              }

              try {
                indexedDB.deleteDatabase('NodeGenImageCache');
                ImageCacheDB.dbPromise = null;
              } catch (e) {
                console.error("Failed to delete IndexedDB database", e);
              }
              setStorageStatus('ok');
            }}
            className="px-4 h-8 bg-red-500 hover:bg-red-400 text-black text-[9px] font-black uppercase tracking-widest rounded-lg transition-colors shrink-0 whitespace-nowrap shadow-lg active:scale-95"
          >
            Vider le Cache d'Images
          </button>
        </div>
      )}
      <div className="absolute top-0 left-0 h-full w-[240px] bg-[#0c0c0e]/98 backdrop-blur-3xl border-r border-white/5 z-50 p-6 flex flex-col gap-6">
        <div className="flex-1 overflow-y-auto space-y-6 scrollbar-none pr-1">
          <div><label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-3 block">WORKSPACE BLOCKS</label>
            <div className="space-y-1.5">
              {[
                { 
                  type: NodeType.PROMPT_INPUT, 
                  label: 'NODE', 
                  h: 400, 
                  data: { label: 'PROMPT', value: '', textInputCount: 1, imageInputCount: 0, delimiter: '*', selectedIndex: 0, resolution: '1K', model: 'gemini-3-pro-image-preview', aspectRatio: '1:1', imageCount: 1, negative: '', isOn: true } 
                },
                { 
                  type: NodeType.IMAGE_INPUT, 
                  label: 'IMAGE REFERENCE', 
                  w: NODE_WIDTH, 
                  h: 400, 
                  data: { label: 'REFERENCE IMAGES', selectedIndex: 0, images: [], isOn: true } 
                },
                { 
                  type: NodeType.COMPOSITOR, 
                  label: 'COMPOSER', 
                  w: NODE_WIDTH * 2, 
                  h: NODE_WIDTH * 3, 
                  data: { label: 'COMPOSITOR', selectedIndex: 0, images: [], isOn: true, imageInputCount: 2, layers: [{ scale: 1, x: 0, y: 0, rotation: 0, fit: true }, { scale: 1, x: 0, y: 0, rotation: 0 }], expandedLayers: { 0: true } } 
                },
                { 
                  type: NodeType.RESULT_VIEWER, 
                  label: 'VIEWER', 
                  w: NODE_WIDTH * 2, 
                  h: NODE_WIDTH * 3, 
                  data: { label: 'VIEWER', selectedIndex: 0, images: [], isOn: true } 
                },
                { 
                  type: NodeType.IMAGE_GENERATOR, 
                  label: 'IMAGE GENERATOR', 
                  w: NODE_WIDTH, 
                  h: 680, 
                  data: { label: 'IMAGE GENERATOR', delimiter: '*', selectedIndex: 0, resolution: '1K', model: 'gemini-3-pro-image-preview', aspectRatio: '1:1', imageCount: 4, images: [], negative: 'bad quality', additionalText: '', isOn: true, selectedImageIndex: 0 } 
                }
              ].map(item => {
                const cfg = TYPE_CONFIG[item.type];
                return (
                  <button 
                    key={item.type} 
                    onClick={() => { 
                      saveToHistory(); 
                      const newNode: NodeState = { 
                        id: `node-${Date.now()}`, 
                        type: item.type, 
                        x: (600-view.x)/view.zoom, 
                        y: (400-view.y)/view.zoom, 
                        w: item.w || NODE_WIDTH, 
                        h: item.h, 
                        data: { ...item.data, label: item.label }, 
                        inputs: {}, 
                        outputs: {} 
                      }; 
                      setNodes(p => [...p, newNode]); 
                      setSelectedNodeIds([newNode.id]); 
                    }} 
                    className="w-full h-10 bg-[#121216] border border-white/5 rounded-xl flex items-center px-4 gap-4 hover:border-white/20 transition-all group shadow-xl"
                  >
                    {React.createElement(cfg.icon, { size: 16, style: { color: cfg.color }, className: "group-hover:scale-110 transition-transform flex items-center justify-center" })}
                    <span className="text-[9px] font-black uppercase text-white tracking-[0.1em] text-left pointer-events-none leading-none">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="pt-6 border-t border-white/5 space-y-4">
          <button 
            onClick={() => {
              setConfirmModal({
                isOpen: true,
                type: 'reset',
                title: 'Réinitialiser tout le workspace ?',
                message: 'Cette action supprimera tous vos blocs, connexions et configurations pour restaurer l\'état initial par défaut de l\'application (4 couches d\'image de fond, véhicule, logo et texte).'
              });
            }}
            className="w-full h-10 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center px-4 gap-4 hover:bg-red-500/20 hover:border-red-500/40 transition-all group shadow-xl"
          >
            <RotateCcw size={16} className="text-red-500 group-hover:rotate-[-180deg] transition-transform duration-500" />
            <span className="text-[9px] font-black uppercase text-red-500 tracking-[0.1em]">RÉINITIALISER WORKSPACE</span>
          </button>

          <button 
            onClick={() => {
              setConfirmModal({
                isOpen: true,
                type: 'clearCache',
                title: 'Libérer le stockage local ?',
                message: 'Vider le cache d\'images supprimera les fichiers binaires temporaires de votre navigateur pour éviter toute saturation. Vos blocs, liens et textes de configuration resteront parfaitement conservés.'
              });
            }}
            className={`w-full h-10 rounded-xl flex items-center px-4 gap-4 transition-all group shadow-xl border ${
              storageStatus !== 'ok' 
                ? 'bg-amber-500/20 border-amber-500/40 hover:bg-amber-500/30 text-amber-500 animate-pulse' 
                : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:border-white/10'
            }`}
          >
            <Trash2 size={16} className={storageStatus !== 'ok' ? 'text-amber-500' : 'text-white/40 group-hover:text-white'} />
            <span className="text-[9px] font-black uppercase tracking-[0.1em]">
              {storageStatus !== 'ok' ? "LIBÉRER STOCKAGE (REQUIS)" : "VIDER LE CACHE D'IMAGES"}
            </span>
          </button>
          
          <div className="border-t border-white/5 pt-4">
            <label className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 block transition-colors text-white/40`}>DISPOSITION</label>
            <div className="grid grid-cols-4 gap-2">
              {[ { icon: AlignStartVertical, dir: 'left' }, { icon: AlignStartHorizontal, dir: 'top' }, { icon: AlignEndVertical, dir: 'right' }, { icon: AlignEndHorizontal, dir: 'bottom' } ].map((item, idx) => <button key={idx} onClick={() => { saveToHistory(); alignNodes(item.dir as any); }} disabled={!canAlign} className={`aspect-square rounded-xl border flex items-center justify-center transition-all ${canAlign ? 'bg-[#121216] border-white text-white shadow-lg' : 'bg-transparent border-white/10 text-white/40 opacity-40 cursor-not-allowed'}`}><item.icon size={20} /></button>)}
              <button onClick={() => { saveToHistory(); distributeNodes('horizontal'); }} disabled={!canAlign} className={`aspect-square rounded-xl border flex items-center justify-center transition-all ${canAlign ? 'bg-[#121216] border-white text-white shadow-lg' : 'bg-transparent border-white/10 text-white/40 opacity-40 cursor-not-allowed'}`} title="Distribution Horizontale"><DistributeHorizontalIcon size={20} /></button>
              <button onClick={() => { saveToHistory(); distributeNodes('vertical'); }} disabled={!canAlign} className={`aspect-square rounded-xl border flex items-center justify-center transition-all ${canAlign ? 'bg-[#121216] border-white text-white shadow-lg' : 'bg-transparent border-white/10 text-white/40 opacity-40 cursor-not-allowed'}`} title="Distribution Verticale"><DistributeVerticalIcon size={20} /></button>
              <button onClick={() => setView(v => ({ ...v, zoom: Math.min(v.zoom * 1.2, 3) }))} className="aspect-square rounded-xl border flex items-center justify-center transition-all bg-[#121216] border-white/10 text-white/60 hover:text-white"><ZoomIn size={20} /></button>
              <button onClick={() => setView({ x: 50, y: 50, zoom: 0.35 })} className="aspect-square rounded-xl border flex items-center justify-center transition-all bg-[#121216] border-white/10 text-white/60 hover:text-white"><FitViewIcon size={20} /></button>
            </div>
          </div>
        </div>
      </div>
      <div ref={canvasRef} className="absolute inset-0 z-0" onWheel={onWheel} onMouseDown={(e) => { const rect = canvasRef.current!.getBoundingClientRect(); const mouseX = (e.clientX - rect.left - view.x) / view.zoom; const mouseY = (e.clientY - rect.top - view.y) / view.zoom; if (e.button === 0 && (e.metaKey || e.ctrlKey)) setDragState(d => ({ ...d, isDragging: true, isSelecting: false, isResizing: false, nodeId: null, startX: e.clientX, startY: e.clientY, initialNodeX: view.x, initialNodeY: view.y })); else if (e.button === 0) { if (e.target === canvasRef.current) { setDragState(d => ({ ...d, isSelecting: true, isDragging: false, isResizing: false, startX: mouseX, startY: mouseY, currentMouseX: mouseX, currentMouseY: mouseY })); setSelectedNodeIds([]); setSelectedConnectionId(null); } } }} onMouseMove={(e) => { const rect = canvasRef.current!.getBoundingClientRect(); const mouseX = (e.clientX - rect.left - view.x) / view.zoom; const mouseY = (e.clientY - rect.top - view.y) / view.zoom; if (dragState.isResizing && dragState.nodeId) { const dx = (e.clientX - dragState.startX) / view.zoom; const dy = (e.clientY - dragState.startY) / view.zoom; setNodes(nds => nds.map(n => { if (n.id === dragState.nodeId) { let newW = n.w || NODE_WIDTH; let newH = n.h || 200; if (dragState.resizeDir?.includes('e')) newW = Math.max(100, (dragState.initialNodeW || 200) + dx); if (dragState.resizeDir?.includes('s')) newH = Math.max(100, (dragState.initialNodeH || 150) + dy); return { ...n, w: newW, h: newH }; } return n; })); } else if (dragState.isDragging) { if (dragState.nodeId === null) setView(v => ({ ...v, x: dragState.initialNodeX + (e.clientX - dragState.startX), y: dragState.initialNodeY + (e.clientY - dragState.startY) })); else setNodes(nds => nds.map(n => selectedNodeIds.includes(n.id) ? { ...n, x: n.x + (mouseX - dragState.currentMouseX), y: n.y + (mouseY - dragState.currentMouseY) } : n)); } if (dragState.isSelecting || dragState.isConnecting || (dragState.isDragging && dragState.nodeId) || dragState.isResizing) setDragState(d => ({ ...d, currentMouseX: mouseX, currentMouseY: mouseY })); }} onMouseUp={() => { if (dragState.isSelecting) { const x1 = Math.min(dragState.startX, dragState.currentMouseX); const x2 = Math.max(dragState.startX, dragState.currentMouseX); const y1 = Math.min(dragState.startY, dragState.currentMouseY); const y2 = Math.max(dragState.startY, dragState.currentMouseY); setSelectedNodeIds(nodes.filter(n => n.type !== NodeType.ZONE && n.x < x2 && n.x + (n.w || NODE_WIDTH) > x1 && n.y < y2 && n.y + (n.h || 200) > y1).map(n => n.id)); } else if (dragState.isConnecting && hoveredHandle) { setConnections(p => [...p.filter(c => !(c.targetNodeId === hoveredHandle.nodeId && c.targetHandle === hoveredHandle.handleId)), { id: `c-${Date.now()}`, sourceNodeId: dragState.nodeId!, sourceHandle: dragState.handleId!, targetNodeId: hoveredHandle.nodeId, targetHandle: hoveredHandle.handleId }]); } setDragState(d => ({ ...d, isDragging: false, isConnecting: false, isSelecting: false, isResizing: false, handleId: null, nodeId: null })); setHoveredHandle(null); }}>
        <div className="absolute inset-0 origin-top-left pointer-events-none" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
          {zones.map(node => {
            const isSelected = selectedNodeIds.includes(node.id);
            const contrastColor = getContrastColor(node.data.color || CAT_COLORS.ZONE);
            const isBottom = node.data.labelPosition === 'bottom';
            return (
              <div key={node.id} className={`absolute rounded-3xl pointer-events-auto transition-all ${isSelected ? 'ring-[6px] ring-white shadow-[0_0_80px_rgba(255,255,255,0.7)]' : ''}`} style={{ transform: `translate(${node.x}px, ${node.y}px)`, width: node.w || 780, height: node.h || 780, backgroundColor: node.data.color || CAT_COLORS.ZONE, opacity: 1, border: `2px solid ${node.data.color || CAT_COLORS.ZONE}` }} onClick={(e) => { e.stopPropagation(); setSelectedNodeIds([node.id]); bringToFront(node.id); }}>
                <div className={`absolute left-2 right-2 h-10 flex items-center px-3 rounded-lg border pointer-events-auto cursor-grab active:cursor-grabbing ${isBottom ? 'bottom-2' : 'top-2'}`} style={{ backgroundColor: 'rgba(0,0,0,0.05)', borderColor: contrastColor }} onMouseDown={(e) => { 
                  e.stopPropagation(); 
                  if (!selectedNodeIds.includes(node.id)) {
                    setSelectedNodeIds([node.id]);
                  }
                  bringToFront(node.id); 
                  const rect = canvasRef.current!.getBoundingClientRect(); 
                  const mouseX = (e.clientX - rect.left - view.x) / view.zoom; 
                  const mouseY = (e.clientY - rect.top - view.y) / view.zoom; 
                  setDragState(d => ({ ...d, isDragging: true, nodeId: node.id, startX: e.clientX, startY: e.clientY, initialNodeX: node.x, initialNodeY: node.y, currentMouseX: mouseX, currentMouseY: mouseY })); 
                }}>
                  <span className="text-[16px] font-black uppercase tracking-widest truncate" style={{ color: contrastColor }}>{node.data.label}</span>
                </div>
                <div className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize group/rez" onMouseDown={(e) => { e.stopPropagation(); setDragState(d => ({ ...d, isResizing: true, resizeDir: 'e', nodeId: node.id, startX: e.clientX, startY: e.clientY, initialNodeW: node.w || 780 })); }}><div className="w-1 h-full mx-auto bg-white/0 group-hover/rez:bg-white/20 transition-colors" /></div>
                <div className="absolute left-0 bottom-0 right-0 h-4 cursor-ns-resize group/rez" onMouseDown={(e) => { e.stopPropagation(); setDragState(d => ({ ...d, isResizing: true, resizeDir: 's', nodeId: node.id, startY: e.clientY, initialNodeH: node.h || 780 })); }}><div className="h-1 w-full my-auto bg-white/0 group-hover/rez:bg-white/20 transition-colors" /></div>
              </div>
            );
          })}
          <svg className="absolute inset-0 overflow-visible pointer-events-none">
            {connections.map(c => {
              const start = getHandlePos(c.sourceNodeId, c.sourceHandle, true);
              const end = getHandlePos(c.targetNodeId, c.targetHandle, false);
              const srcNode = nodes.find(n=>n.id===c.sourceNodeId);
              const targetNode = nodes.find(n=>n.id===c.targetNodeId);
              if (!srcNode || !targetNode) return null;
              const hCfg = getHandleConfig(srcNode);
              const sourceHandle = hCfg.outputs?.find(h => h.id === c.sourceHandle);
              const color = c.targetHandle === 'negIn' ? '#ef4444' : (sourceHandle?.color || '#fff');
              const cpOffset = Math.min(100, Math.max(20, Math.abs(end.x - start.x) / 2));
              const isDashed = (srcNode?.data.isOn === false);
              return (<g key={c.id} className="cursor-pointer pointer-events-auto" onClick={(e) => { e.stopPropagation(); setSelectedConnectionId(c.id); setSelectedNodeIds([]); }}><path d={`M ${start.x} ${start.y} C ${start.x + cpOffset} ${start.y}, ${end.x - cpOffset} ${end.y}, ${end.x} ${end.y}`} stroke="transparent" strokeWidth="20" fill="none" /><path d={`M ${start.x} ${start.y} C ${start.x + cpOffset} ${start.y}, ${end.x - cpOffset} ${end.y}, ${end.x} ${end.y}`} stroke={color} strokeWidth={selectedConnectionId === c.id ? "5" : "2"} strokeDasharray={isDashed ? "5,5" : "0"} fill="none" opacity={selectedConnectionId === c.id ? "1" : "0.5"} /></g>);
            })}
            {dragState.isConnecting && <line x1={getHandlePos(dragState.nodeId!, dragState.handleId!, true).x} y1={getHandlePos(dragState.nodeId!, dragState.handleId!, true).y} x2={dragState.currentMouseX} y2={dragState.currentMouseY} stroke="#fff" strokeWidth="2" strokeDasharray="4" />}
          </svg>
          {regularNodes.map(node => {
            const isSelected = selectedNodeIds.includes(node.id);
            const hConfig = getHandleConfig(node);
            const cfg = TYPE_CONFIG[node.type];
            const nodeTokens = calculateNodeTokens(node);
            const nW = node.type === NodeType.ON_OFF ? NODE_WIDTH/2 : (node.w || NODE_WIDTH);
            return (
              <div key={node.id} className={`absolute bg-[#1e1e24] border-2 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] pointer-events-auto transition-all ${isSelected ? 'border-white ring-4 ring-white/10' : 'border-white/20'}`} style={{ transform: `translate(${node.x}px, ${node.y}px)`, width: nW, height: node.h, display: 'flex', flexDirection: 'column' }} onMouseDown={(e) => { 
                const target = e.target as HTMLElement; 
                if (target.closest('.resize-handle') || target.closest('.interactive-field') || target.closest('.handle-trigger') || target.closest('.toggle-btn')) return; 
                e.stopPropagation(); 
                if (!selectedNodeIds.includes(node.id)) {
                  setSelectedNodeIds([node.id]);
                }
                bringToFront(node.id); 
                const rect = canvasRef.current!.getBoundingClientRect(); 
                const mouseX = (e.clientX - rect.left - view.x) / view.zoom; 
                const mouseY = (e.clientY - rect.top - view.y) / view.zoom; 
                setDragState(d => ({ ...d, isDragging: true, isResizing: false, nodeId: node.id, startX: e.clientX, startY: e.clientY, initialNodeX: node.x, initialNodeY: node.y, currentMouseX: mouseX, currentMouseY: mouseY })); 
              }}>
                <div className="px-4 h-[54px] shrink-0 flex items-center border-b border-white/10 rounded-t-2xl relative" style={{ backgroundColor: `${cfg.color}25` }}>
                  <div className="flex-1 flex flex-col justify-center min-w-0 pr-2">
                    <span className="text-[8px] font-black uppercase tracking-widest opacity-60" style={{ color: cfg.color }}>{cfg.label}</span>
                    <div className="flex items-center gap-2">{React.createElement(cfg.icon, { size: 12, style: { color: cfg.color } })}<span className="text-[10px] font-black uppercase text-white truncate tracking-widest">{node.data.label}</span></div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {(node.type === NodeType.POST_PROCESS || node.type === NodeType.IMAGE_GENERATOR || node.type === NodeType.LLM_PROCESSOR || node.type === NodeType.COMPOSITOR) && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleAction(node.id); }}
                        disabled={node.data.isProcessing}
                        className={`p-1.5 rounded-lg transition-all border ${node.data.isProcessing ? 'bg-white/5 border-white/5 text-white/20' : 'bg-blue-500/10 border-blue-500/20 text-blue-500 hover:bg-blue-500 hover:text-white shadow-[0_0_10px_rgba(59,130,246,0.15)]'}`}
                      >
                        {node.data.isProcessing ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} fill="currentColor" />}
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); const newNode = { ...JSON.parse(JSON.stringify(node)), id: generateId('node'), x: node.x + 40, y: node.y + 40 }; setNodes(nds => [...nds, newNode]); setSelectedNodeIds([newNode.id]); }} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white border border-white/5 transition-all"><Copy size={10} /></button>
                    <button onClick={(e) => { e.stopPropagation(); setNodes(nds => nds.filter(n => n.id !== node.id)); setConnections(cs => cs.filter(c => c.sourceNodeId !== node.id && c.targetNodeId !== node.id)); }} className="p-1.5 rounded-lg bg-red-500/5 hover:bg-red-500 text-red-500/60 hover:text-white border border-red-500/10 transition-all"><X size={10} /></button>
                  </div>


                </div>
                <div className="relative pt-3 pb-2 flex-1 flex flex-col overflow-hidden">
                  <div className="absolute left-0 top-3 flex flex-col w-full pointer-events-none z-10">{hConfig.inputs?.map(h => {
                    const isHovered = hoveredHandle?.nodeId === node.id && hoveredHandle?.handleId === h.id;
                    const connectedConn = connections.find(c=>c.targetNodeId===node.id && c.targetHandle===h.id);
                    const isActive = connectedConn && (nodes.find(n=>n.id===connectedConn.sourceNodeId)?.data.isOn !== false);
                    return (
                      <div key={h.id} className="h-[26px] flex items-center pl-2 pointer-events-none group">
                        <div className="handle-trigger w-12 h-12 -ml-6 pointer-events-auto flex items-center justify-center cursor-crosshair z-20" onMouseEnter={() => dragState.isConnecting && setHoveredHandle({ nodeId: node.id, handleId: h.id })} onMouseLeave={() => setHoveredHandle(null)}>
                          <div className={`rounded-full border-2 border-[#1e1e24] transition-all duration-200 flex items-center justify-center ${isActive ? 'bg-white' : 'bg-[#333]'} ${isHovered ? 'w-5 h-5 scale-125 shadow-[0_0_15px_rgba(255,255,255,0.5)]' : 'w-3 h-3'}`} style={{ borderColor: h.color }}>{isActive && <div className="w-[3px] h-[3px] bg-[#1e1e24] rounded-full" />}</div>
                        </div>
                        <span className="text-[8px] ml-0 font-black text-white/50 uppercase">{h.label}</span>
                      </div>
                    );
                  })}</div>
                  <div className="absolute right-0 top-3 flex flex-col w-full items-end pointer-events-none z-10">{hConfig.outputs?.map(h => {
                    const isActiveSource = dragState.isConnecting && dragState.nodeId === node.id && dragState.handleId === h.id;
                    const isConnected = connections.some(c=>c.sourceNodeId===node.id && c.sourceHandle===h.id);
                    const isOn = node.data.isOn !== false;
                    return (
                      <div key={h.id} className="h-[26px] flex items-center pr-2 pointer-events-auto group">
                        {node.type === NodeType.PROMPT_INPUT && h.id === 'textOut' && (
                          <button onClick={(e) => { e.stopPropagation(); setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, isOn: !isOn } } : n)); }} className={`toggle-btn mr-1.5 flex items-center transition-colors ${isOn ? 'text-emerald-500' : 'text-white/20'}`}>
                            {isOn ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                          </button>
                        )}
                        <span className={`text-[8px] mr-2 font-black uppercase transition-colors ${isOn ? 'text-white/50' : 'text-white/10'}`}>{h.label}</span>
                        <div className="handle-trigger w-12 h-12 -mr-6 pointer-events-auto flex items-center justify-center cursor-crosshair z-20" onMouseDown={(e) => { e.stopPropagation(); setDragState(d => ({ ...d, isConnecting: true, nodeId: node.id, handleId: h.id })); }}>
                          <div className={`rounded-full border-2 border-[#1e1e24] transition-all duration-200 flex items-center justify-center ${isConnected ? 'bg-white' : 'bg-[#333]'} ${isActiveSource ? 'w-5 h-5 scale-125 shadow-[0_0_15px_rgba(255,255,255,0.5)]' : 'w-3 h-3'}`} style={{ borderColor: h.color, opacity: isOn ? 1 : 0.3 }}>{isConnected && <div className="w-[3px] h-[3px] bg-[#1e1e24] rounded-full" />}</div>
                        </div>
                      </div>
                    );
                  })}</div>
                  <div className="shrink-0" style={{ height: Math.max(hConfig.inputs?.length || 0, hConfig.outputs?.length || 0) * ROW_HEIGHT }} />
                  <div className="px-4 mt-2 flex-1 flex flex-col overflow-hidden space-y-3">
                    {node.type === NodeType.PROMPT_INPUT && (<textarea className="interactive-field w-full bg-black/60 border border-white/10 rounded-xl p-3 text-[9px] text-white font-medium outline-none resize-none leading-relaxed flex-1 shadow-inner" value={node.data.value} onChange={e => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, value: e.target.value } } : n))} />)}
                    {node.type === NodeType.PROMPT_CONCATENATOR && renderConcatenatorFields(node)}
                    {node.type === NodeType.LLM_PROCESSOR && renderLLMProcessorFields(node)}
                    {node.type === NodeType.IMAGE_GENERATOR && renderImageGeneratorFields(node)}
                    {node.type === NodeType.COMBO_SELECTOR && renderComboSelectorFields(node)}
                    {node.type === NodeType.GENERATE_TRIGGER && renderGenerateTriggerFields(node)}
                    {node.type === NodeType.IMAGE_INPUT && renderImageInputFields(node)}
                    {node.type === NodeType.LIST_SELECTOR && renderListSelectorFields(node)}
                    {node.type === NodeType.ARRAY_SPLITTER && renderArraySplitterFields(node)}
                    {node.type === NodeType.STYLE_SELECTOR && renderStyleSelectorFields(node)}
                    {node.type === NodeType.IMAGE_MODEL_SELECTOR && renderModelSelectorFields(node)}
                    {node.type === NodeType.FORMAT_SELECTOR && renderFormatSelectorFields(node)}
                    {node.type === NodeType.RESOLUTION_SELECTOR && renderResolutionSelectorFields(node)}
                    {node.type === NodeType.ON_OFF && renderOnOffFields(node)}
                    {node.type === NodeType.RESULT_VIEWER && renderResultViewerFields(node)}
                    {node.type === NodeType.BACKGROUND_REMOVER && renderBackgroundRemoverFields(node)}
                    {node.type === NodeType.POST_PROCESS && <PostProcessFields node={node} setNodes={setNodes} resolveValue={resolveValue} handleAction={handleAction} />}
                    {node.type === NodeType.COMPOSITOR && renderCompositorFields(node)}
                    {node.type === NodeType.EXPORT && renderExportFields(node)}
                  </div>
                </div>
                {(node.type === NodeType.LLM_PROCESSOR || node.type === NodeType.IMAGE_GENERATOR || node.type === NodeType.GENERATE_TRIGGER || node.type === NodeType.POST_PROCESS || node.type === NodeType.COMPOSITOR || node.type === NodeType.EXPORT) && (<button onClick={() => handleAction(node.id)} className="w-full h-[44px] shrink-0 border-t border-white/10 text-[9px] font-black uppercase tracking-[0.2em] transition-all rounded-b-2xl shadow-sm bg-white/5 text-white/50 hover:text-white hover:bg-white/10">{node.data.isProcessing ? <Loader2 size={12} className="animate-spin mx-auto"/> : (node.type === NodeType.EXPORT ? "EXPORTER" : "GÉNÉRER")}</button>)}
                <div className="resize-handle absolute bottom-0 left-0 w-full h-3 cursor-ns-resize flex items-center justify-center group/resize z-[60]" onMouseDown={(e) => { e.stopPropagation(); setDragState(d => ({ ...d, isResizing: true, resizeDir: 's', isDragging: false, nodeId: node.id, startY: e.clientY, initialNodeH: node.h || 200 })); }}><GripHorizontal size={10} className="text-white/20 group-hover/resize:text-white/60 transition-colors" /></div>
              </div>
            );
          })}
        </div>
      </div>
      <div className={`absolute top-0 right-0 h-full w-[360px] bg-[#0c0c0e] border-l border-white/10 z-[100] shadow-2xl transition-transform duration-300 ${selectedNodeIds.length === 1 ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedNodeIds.length === 1 && (() => {
          const node = nodes.find(n => n.id === selectedNodeIds[0]);
          if (!node) return null;
          return (
            <div className="h-full flex flex-col">
              <div className="p-6 border-b border-white/10 flex items-center justify-between"><div><h3 className="text-[10px] font-black text-white uppercase tracking-widest">{node.data.label}</h3><span className="text-[8px] font-bold text-white/30 uppercase">{TYPE_CONFIG[node.type].label}</span></div><button onClick={() => setSelectedNodeIds([])} className="p-2 hover:bg-white/10 rounded-full text-white/40 transition-colors"><X size={16}/></button></div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
                {node.type === NodeType.ZONE ? (<div className="space-y-6"><div className="space-y-2"><label className="text-[9px] font-black uppercase text-white/40 tracking-widest">Nom de la Zone</label><input className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-[11px] font-bold text-white outline-none" value={node.data.label} onChange={e => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, label: e.target.value } } : n))} /></div><div className="space-y-2"><label className="text-[9px] font-black uppercase text-white/40 tracking-widest">Couleur</label><div className="grid grid-cols-5 gap-2">{['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#ddd6fe'].map(c => <button key={c} onClick={() => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, color: c } } : n))} className="w-full aspect-square rounded-lg border border-white/10" style={{ backgroundColor: c }} />)}</div></div></div>) : (
                  <>
                    <div className="space-y-2"><label className="text-[9px] font-black uppercase text-white/40 tracking-widest">Nom du Bloc</label><input className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-[11px] font-bold text-white outline-none" value={node.data.label} onChange={e => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, label: e.target.value } } : n))} /></div>
                    {node.type === NodeType.PROMPT_INPUT && (<div className="space-y-2"><label className="text-[9px] font-black uppercase text-white/40 tracking-widest">Contenu</label><textarea className="interactive-field w-full h-80 bg-black/60 border border-white/10 rounded-xl p-4 text-[11px] text-white/90 outline-none resize-none" value={node.data.value} onChange={e => setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, value: e.target.value } } : n))} /></div>)}
                    {node.type === NodeType.COMBO_SELECTOR && renderComboSelectorFields(node, true)}
                    {node.type === NodeType.PROMPT_CONCATENATOR && renderConcatenatorFields(node, true)}
                    {node.type === NodeType.LLM_PROCESSOR && renderLLMProcessorFields(node, true)}
                    {node.type === NodeType.IMAGE_GENERATOR && renderImageGeneratorFields(node, true)}
                    {node.type === NodeType.ARRAY_SPLITTER && renderArraySplitterFields(node, true)}
                    {node.type === NodeType.IMAGE_INPUT && renderImageInputFields(node, true)}
                    {node.type === NodeType.STYLE_SELECTOR && renderStyleSelectorFields(node)}
                    {node.type === NodeType.IMAGE_MODEL_SELECTOR && renderModelSelectorFields(node)}
                    {node.type === NodeType.FORMAT_SELECTOR && renderFormatSelectorFields(node)}
                    {node.type === NodeType.RESOLUTION_SELECTOR && renderResolutionSelectorFields(node)}
                    {node.type === NodeType.GENERATE_TRIGGER && renderGenerateTriggerFields(node)}
                    {node.type === NodeType.BACKGROUND_REMOVER && renderBackgroundRemoverFields(node, true)}
                    {node.type === NodeType.COMPOSITOR && renderCompositorFields(node, true)}
                    {node.type === NodeType.EXPORT && renderExportFields(node)}
                    {node.type === NodeType.POST_PROCESS && <PostProcessFields node={node} setNodes={setNodes} resolveValue={resolveValue} handleAction={handleAction} isRightPanel={true} />}
                    {node.type === NodeType.RESULT_VIEWER && renderResultViewerFields(node)}
                  </>
                )}
              </div>
              <div className="p-6 bg-black/40 border-t border-white/5 space-y-3 shrink-0">
                {(node.type === NodeType.BACKGROUND_REMOVER || node.type === NodeType.POST_PROCESS || node.type === NodeType.COMPOSITOR || node.type === NodeType.EXPORT) && (
                  <button 
                    onClick={() => handleAction(node.id)} 
                    disabled={node.data.isProcessing || (node.type !== NodeType.COMPOSITOR && node.type !== NodeType.EXPORT && !resolveValue(node.id, 'imageIn'))}
                    className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 transition-all border ${node.data.isProcessing ? 'bg-white/5 border-white/10 text-white/20' : (node.type === NodeType.COMPOSITOR || node.type === NodeType.EXPORT || resolveValue(node.id, 'imageIn')) ? 'bg-sky-500/20 border-sky-500/40 text-sky-400 hover:bg-sky-500/30' : 'bg-white/5 border-white/5 text-white/10 cursor-not-allowed'}`}
                  >
                    {node.data.isProcessing ? <Loader2 size={16} className="animate-spin" /> : (node.type === NodeType.BACKGROUND_REMOVER ? <Scissors size={16} /> : (node.type === NodeType.COMPOSITOR ? <Layers size={16} /> : (node.type === NodeType.EXPORT ? <Upload size={16} /> : <ImageIcon size={16} />)))}
                    <span className="text-[11px] font-black uppercase tracking-widest">{node.data.isProcessing ? 'TRAITEMENT...' : (node.type === NodeType.EXPORT ? 'EXPORTER' : 'GÉNÉRER')}</span>
                  </button>
                )}
                <div className="grid grid-cols-2 gap-3"><button onClick={() => { saveToHistory(); duplicateNode(node.id); }} className="flex items-center justify-center gap-2 py-3 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-all"><Copy size={12} /> DUPLIQUER</button><button onClick={() => deleteNode(node.id)} className="flex items-center justify-center gap-2 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500 hover:text-white transition-all"><Trash2 size={12} /> SUPPRIMER</button></div></div>
            </div>
          );
        })()}
      </div>
      
      {/* Visual Confirmation Dialog Modal (Iframe Safety Bypass) */}
      {confirmModal.isOpen && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-[99999] flex items-center justify-center p-4">
          <div className="bg-[#0e0e12] border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col gap-5 text-left">
            <div className="flex flex-col gap-2">
              <h4 className="text-[12px] font-black uppercase tracking-[0.2em] text-red-500">{confirmModal.title}</h4>
              <p className="text-[10px] text-white/70 leading-relaxed font-semibold">{confirmModal.message}</p>
            </div>
            
            <div className="flex gap-3 justify-end pt-1">
              <button
                onClick={() => setConfirmModal({ isOpen: false, type: null, title: '', message: '' })}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[9px] font-black uppercase text-white tracking-[0.1em] transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  try {
                    if (confirmModal.type === 'reset') {
                      resetWorkspace();
                    } else if (confirmModal.type === 'clearCache') {
                      saveToHistory();
                      const cleaned = nodes.map(n => {
                        const cleanedData = { ...n.data };
                        delete cleanedData.images;
                        delete cleanedData.zoneImages;
                        delete cleanedData.resultImage;
                        delete cleanedData.base64;
                        delete cleanedData.logoUrl;
                        delete cleanedData.lastImageIn;
                        return {
                          ...n,
                          outputs: {},
                          data: cleanedData
                        };
                      });
                      setNodes(cleaned);

                      try {
                        const connStr = JSON.stringify(connections);
                        const viewStr = JSON.stringify(view);
                        localStorage.clear();
                        localStorage.setItem('node_graph_nodes', JSON.stringify(cleaned));
                        localStorage.setItem('node_graph_connections', connStr);
                        localStorage.setItem('node_graph_view', viewStr);
                        localStorage.setItem('node_graph_version', '1.5');
                      } catch (err) {
                        console.error("Local storage hard write failed", err);
                      }

                      try {
                        indexedDB.deleteDatabase('NodeGenImageCache');
                        ImageCacheDB.dbPromise = null;
                      } catch (e) {
                        console.error("Failed to delete IndexedDB database", e);
                      }
                      setStorageStatus('ok');
                    }
                  } catch (err) {
                    console.error("Confirmation action execution error:", err);
                  } finally {
                    setConfirmModal({ isOpen: false, type: null, title: '', message: '' });
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-xl text-[9px] font-black uppercase text-white tracking-[0.1em] transition-all cursor-pointer"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
