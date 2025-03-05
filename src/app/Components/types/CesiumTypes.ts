import type { CesiumType } from "../../types/cesium";
import type { Position } from "../../types/position";
import type { SatellitePosition } from "../../utils/satellite";
import type { Cesium3DTileset, Entity, Viewer, JulianDate } from "cesium";
import * as Cesium from "cesium";

// 지상국 타입 정의
export interface GroundStation {
  name: string;
  latitude: number;
  longitude: number;
  height?: number;
  communicationRange?: number;
  coneAngle?: number;
}

// CesiumComponent 속성 타입 정의
export interface CesiumComponentProps {
  CesiumJs?: CesiumType;
  positions: Position[];
  issPositions?: SatellitePosition[];
  groundStations?: GroundStation[];
}

// 회전 상태 타입 정의
export interface RotationState {
  yaw: number;
  pitch: number;
  roll: number;
}

// 시계 설정 타입 정의
export interface ClockSettings {
  startTime: JulianDate | null;
  stopTime: JulianDate | null;
  currentTime: JulianDate | null;
  multiplier: number;
}

// 뷰어 참조 타입
export interface ViewerRefs {
  cesiumViewer: React.MutableRefObject<Viewer | null>;
  cesiumContainerRef: React.MutableRefObject<HTMLDivElement | null>;
  addedScenePrimitives: React.MutableRefObject<Cesium3DTileset[]>;
  issEntityRef: React.MutableRefObject<Entity | null>;
}
