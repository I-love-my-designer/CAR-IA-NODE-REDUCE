
export enum NodeType {
  ZONE = 'ZONE',
  PROMPT_INPUT = 'PROMPT_INPUT',
  CONST_PROMPT = 'CONST_PROMPT',
  PROMPT_ENHANCER = 'PROMPT_ENHANCER',
  PROMPT_CONCATENATOR = 'PROMPT_CONCATENATOR',
  ARRAY_SPLITTER = 'ARRAY_SPLITTER',
  LIST_SELECTOR = 'LIST_SELECTOR',
  STYLE_SELECTOR = 'STYLE_SELECTOR',
  IMAGE_GENERATOR = 'IMAGE_GENERATOR',
  RESULT_VIEWER = 'RESULT_VIEWER',
  LLM_PROCESSOR = 'LLM_PROCESSOR',
  IMAGE_INPUT = 'IMAGE_INPUT',
  FORMAT_SELECTOR = 'FORMAT_SELECTOR',
  RESOLUTION_SELECTOR = 'RESOLUTION_SELECTOR',
  GENERATE_TRIGGER = 'GENERATE_TRIGGER',
  IMAGE_MODEL_SELECTOR = 'IMAGE_MODEL_SELECTOR',
  COMBO_SELECTOR = 'COMBO_SELECTOR',
  ON_OFF = 'ON_OFF',
  BACKGROUND_REMOVER = 'BACKGROUND_REMOVER',
  POST_PROCESS = 'POST_PROCESS',
  COMPOSITOR = 'COMPOSITOR',
  EXPORT = 'EXPORT'
}

export interface CompositingJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  vehicleImage: string;
  backgroundId: string;
  roughComposite: string;
  finalResult?: string;
  studioNotes?: string;
  rotation?: number;
  imageA?: string;
  imageB?: string;
  imageC?: string;
  
  // Advanced PWA composition layout properties
  vehicleScale?: number;
  vehicleX?: number;
  vehicleY?: number;
  vehicleRotation?: number;
  
  logo?: boolean;
  logoId?: string;
  logoSize?: string;
  logoPosition?: string;
  logoColor?: string;
  
  text?: boolean;
  textValue?: string;
  textFontSize?: string;
  textFontFamily?: string;
  textPosition?: string;
  textColor?: string;
  fontWeight?: string;

  createdAt: any;
  updatedAt: any;
}

export interface WorkspaceStats {
  totalTokens: number;
  totalCost: number;
}

export interface NodeData {
  label?: string;
  note?: string;
  value?: any;
  negative?: string;
  selectedIndex?: number;
  delimiter?: string;
  aspectRatio?: string;
  customAspectRatio?: string;
  resolution?: string;
  model?: string;
  textInputCount?: number;
  imageInputCount?: number;
  imageCount?: number;
  additionalText?: string;
  isProcessing?: boolean;
  tokenCount?: number;
  color?: string;
  labelPosition?: 'top' | 'bottom';
  indications?: string;
  zoneImages?: string[];
  isOn?: boolean;
  [key: string]: any;
}

export interface NodeState {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  w?: number;
  h?: number; 
  data: NodeData;
  inputs: Record<string, string | null>;
  outputs: Record<string, any>;
}

export interface Connection {
  id: string;
  sourceNodeId: string;
  sourceHandle: string;
  targetNodeId: string;
  targetHandle: string;
}

export interface DragState {
  isDragging: boolean;
  isConnecting: boolean;
  isSelecting: boolean;
  isResizing?: boolean;
  resizeDir?: 'e' | 's' | 'se';
  nodeId: string | null;
  handleId: string | null;
  handleType: 'source' | 'target' | null;
  startX: number;
  startY: number;
  initialNodeX: number;
  initialNodeY: number;
  initialNodeW?: number;
  initialNodeH?: number;
  currentMouseX: number;
  currentMouseY: number;
}
