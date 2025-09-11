// AreaMarkingStyles.ts - Types and interfaces for the area marking system

export interface AreaColor {
  name: string;
  value: string;
  hover: string;
  bgOpacity: string;
  borderOpacity: string;
}

export interface AreaCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
}

export interface AreaDimensions {
  width: string;
  length: string;
  height: string;
  area: string;
}

export interface MarkedArea {
  id: string;
  name: string;
  color: string;
  category: string;
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
  dimensions?: AreaDimensions;
  notes?: string;
  tags?: string[];
  isLocked?: boolean;
  showMeasurements?: boolean;
  isHidden?: boolean;
  createdAt?: Date;
}

export interface AreaMarkingSystemProps {
  isActive: boolean;
  setIsActive: (active: boolean) => void;
  markedAreas: MarkedArea[];
  onAreaMarked: (area: MarkedArea) => void;
  onAreaUpdated: (area: MarkedArea) => void;
  onAreaDeleted: (areaId: string) => void;
  isViewMode3D?: boolean;
}

export interface NewAreaDetails {
  name: string;
  color: string;
  category: string;
  notes: string;
  tags: string[];
  isLocked: boolean;
  showMeasurements: boolean;
}