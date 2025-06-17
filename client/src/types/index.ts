// index.ts - Shared types and interfaces for the application

import type { Vector3 } from 'three';

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

export interface ARElement {
  id: string;
  type: string;
  position: {
    x: number;
    y: number;
    z?: number;
  };
  content: ElementContent;
}