export interface DataItem {
  args: string[];
  start_line: number;
  end_line: number;
  used_functions?: Record<string, string | { file?: string; methods?: string[] }>;
  methods?: Record<string, DataItem>;
  'is_api_endpoint'?: boolean;
  isApiEndpoint?: boolean;
}

export interface OutputMeta {
  version: string;
  lastModified: number;
  size: number;
  file?: string;
}

export interface OutputData {
  files: Record<string, Record<string, DataItem>>;
  file_meta?: Record<string, FileMeta>;
  fileMeta?: Record<string, FileMeta>;
  config?: {
    scan_root?: string;
    focus_root?: string;
    scanRoot?: string;
    focusRoot?: string;
  };
  _meta?: OutputMeta;
}

export interface FileMeta {
  is_router?: boolean;
  isRouter?: boolean;
  module?: string;
}

export interface DataFileInfo {
  name: string;
  size: number;
  lastModified: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface UsedReference {
  targetName: string;
  module: string;
  normalizedModule: string;
  sourceLabel: string;
  targetMethods?: string[];
}

export interface ItemBox {
  id: string;
  name: string;
  type: 'class' | 'function';
  args: string[];
  methods?: string[];
  isApiEndpoint?: boolean;
  position: Position;
  size: Size;
  fileId: string;
  filePath: string;
  moduleKey: string;
  usedRefs: UsedReference[];
}

export interface FileBox {
  id: string;
  path: string;
  moduleKey: string;
  displayName: string;
  isRouter?: boolean;
  position: Position;
  size: Size;
  items: ItemBox[];
}

export interface ConnectionAnchor {
  fileId: string;
  filePath: string;
  itemId: string;
  relativePosition: Position;
  size: Size;
}

export interface ConnectionPlan {
  id: string;
  from: ConnectionAnchor;
  to: ConnectionAnchor;
  label: string;
  pathOffset: number;
}

export interface ConnectionRender {
  id: string;
  from: string;
  to: string;
  fromPos: Position;
  toPos: Position;
  label: string;
  pathOffset: number;
}

export interface VisualizerLayout {
  fileBoxes: FileBox[];
  connections: ConnectionPlan[];
  canvasBounds: Size;
}

export interface ViewBox {
  x: number;
  y: number;
}
