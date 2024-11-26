import { RefObject } from 'react';

export interface Position {
  x: number;
  y: number;
}

export interface DrawToolsConfig {
  containerRef: RefObject<HTMLDivElement>;
  scale: number;
  gridSize?: number;
}

export class DrawTools {
  private container: HTMLDivElement | null;
  private scale: number;
  private gridSize: number;

  constructor(config: DrawToolsConfig) {
    this.container = config.containerRef.current;
    this.scale = config.scale;
    this.gridSize = config.gridSize || 20;
  }

  calculateGridPosition(clientX: number, clientY: number): Position {
    if (!this.container) return { x: 0, y: 0 };

    const bounds = this.container.getBoundingClientRect();
    const x = ((clientX - bounds.left) / bounds.width) * 100;
    const y = ((clientY - bounds.top) / bounds.height) * 100;

    // Snap to grid if grid size is set
    const snapX = Math.round(x / this.gridSize) * this.gridSize;
    const snapY = Math.round(y / this.gridSize) * this.gridSize;

    return {
      x: Math.max(0, Math.min(100, snapX)),
      y: Math.max(0, Math.min(100, snapY))
    };
  }

  updateScale(newScale: number) {
    this.scale = newScale;
  }

  getContainerBounds() {
    return this.container?.getBoundingClientRect();
  }
}

export const createDrawTools = (config: DrawToolsConfig) => {
  return new DrawTools(config);
};
