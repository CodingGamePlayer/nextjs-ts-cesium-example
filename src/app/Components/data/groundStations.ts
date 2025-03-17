import { GroundStation } from "../types/GroundStationTypes";

export const groundStations: GroundStation[] = [
  {
    id: "daejeon",
    name: "대전 지상국",
    latitude: 36.3504,
    longitude: 127.3845,
    height: 100,
    communicationRange: 2000,
    coneAngle: 45,
    color: "#4CAF50", // 녹색
  },
  // 필요에 따라 더 많은 지상국 추가 가능
];
