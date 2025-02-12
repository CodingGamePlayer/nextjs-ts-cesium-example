import * as satellite from "satellite.js";
import { EciVec3 } from "satellite.js";

export interface SatellitePosition {
  longitude: number;
  latitude: number;
  height: number;
  epoch: Date;
}

export function calculateSatelliteOrbit(
  tleLine1: string,
  tleLine2: string,
  startTime: Date = new Date(),
  steps: number = 100,
  periodMinutes: number = 90
): SatellitePosition[] {
  const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
  if (!satrec) {
    throw new Error("TLE 데이터 파싱 실패");
  }

  const positions: SatellitePosition[] = [];
  const stepMs = (periodMinutes * 60 * 1000) / steps;

  for (let i = 0; i < steps; i++) {
    const time = new Date(startTime.getTime() + stepMs * i);

    const positionAndVelocity = satellite.propagate(satrec, time);
    if (!positionAndVelocity.position) continue;

    const gmst = satellite.gstime(time);
    const position = satellite.eciToGeodetic(positionAndVelocity.position as EciVec3<number>, gmst);

    positions.push({
      longitude: satellite.degreesLong(position.longitude),
      latitude: satellite.degreesLat(position.latitude),
      height: position.height * 1000, // km를 m로 변환
      epoch: time,
    });
  }

  return positions;
}
