// index.ts - Shared types and interfaces for the application

export interface ElementContent {
  title?: string;
  description?: string;
  trigger?: string;
  mediaUrl?: string;
  mediaType?: string;
  storagePath?: string;
  width?: number;
  height?: number;
  [key: string]: any; // For any additional properties that might be added
}
