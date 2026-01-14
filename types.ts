
export enum ToolMode {
  HOME = 'HOME',
  READ = 'READ',
  SPLIT = 'SPLIT',
  MERGE = 'MERGE',
  CONVERT_DOC = 'CONVERT_DOC',
  EDIT = 'EDIT',
  TRANSLATE = 'TRANSLATE',
  PHOTO_TO_PDF = 'PHOTO_TO_PDF'
}

export interface FileData {
  id: string;
  file: File;
  name: string;
  size: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}
