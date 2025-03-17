export interface GroundStation {
  id?: string;
  name: string;
  latitude: number;
  longitude: number;
  height: number;
  communicationRange: number; // 통신 범위 (km)
  coneAngle: number; // 통신 원뿔 각도 (도)
  color?: string; // 선택적 색상
}

export type GroundStationVisibility = {
  [stationId: string]: boolean;
};
