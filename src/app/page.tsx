"use client";

import CesiumComponent from "./Components/CesiumComponent";
import CesiumWrapper from "./Components/CesiumWrapper";
import { calculateSatelliteOrbit } from "./Components/utils/satellite";
import type { Position } from "./Components/types/CesiumTypes";

// ISS의 TLE 데이터 (실제 사용시에는 최신 데이터로 업데이트 필요)
const ISS_TLE_LINE1 = "1 25544U 98067A   21086.52438556  .00001448  00000-0  34473-4 0  9998";
const ISS_TLE_LINE2 = "2 25544  51.6435 114.6349 0003448 236.0557 256.6114 15.48955396276555";

export default function Page() {
  const issPositions = calculateSatelliteOrbit(ISS_TLE_LINE1, ISS_TLE_LINE2);
  const positions: Position[] = [];

  return (
    <CesiumWrapper>
      <CesiumComponent positions={positions} issPositions={issPositions} />
    </CesiumWrapper>
  );
}
