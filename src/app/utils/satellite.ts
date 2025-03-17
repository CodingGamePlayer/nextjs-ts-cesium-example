import * as satellite from "satellite.js";
import { EciVec3 } from "satellite.js";

export interface SatellitePosition {
  longitude: number;
  latitude: number;
  height: number;
  epoch: Date;
}

/**
 * TLE 데이터로부터 위성 궤도를 계산합니다.
 * 현재 시간 기준 20분 전부터 2시간 후까지의 위치를 계산합니다.
 *
 * @param tleLine1 TLE 첫 번째 줄
 * @param tleLine2 TLE 두 번째 줄
 * @param referenceTime 기준 시간 (기본값: 현재 시간)
 * @param steps 계산할 위치의 수 (기본값: 100)
 * @returns 계산된 위성 위치의 배열
 */
export function calculateSatelliteOrbit(tleLine1: string, tleLine2: string, referenceTime: Date = new Date(), steps: number = 100): SatellitePosition[] {
  const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
  if (!satrec) {
    throw new Error("TLE 데이터 파싱 실패");
  }

  // 현재 시간 기준 계산 시간 범위 설정
  const pastMinutes = 20; // 과거 20분
  const futureMinutes = 120; // 미래 2시간
  const totalTimeRangeMinutes = pastMinutes + futureMinutes; // 총 140분의 시간 범위

  // 시작 시간 (현재 시간의 20분 전)
  const startTime = new Date(referenceTime.getTime() - pastMinutes * 60 * 1000);

  // 각 스텝 사이의 시간 간격 (밀리초)
  const stepMs = (totalTimeRangeMinutes * 60 * 1000) / steps;

  const positions: SatellitePosition[] = [];

  for (let i = 0; i < steps; i++) {
    const time = new Date(startTime.getTime() + stepMs * i);

    try {
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
    } catch (error) {
      console.warn(`위치 계산 오류 (시간: ${time.toISOString()}):`, error);
      // 오류가 발생해도 계속 진행
    }
  }

  return positions;
}
