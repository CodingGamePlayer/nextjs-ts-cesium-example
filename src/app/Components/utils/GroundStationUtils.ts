import * as Cesium from "cesium";
import { Viewer } from "cesium";
import { GroundStation } from "../types/CesiumTypes";

// 지상국 및 통신 범위 추가 함수
export const addGroundStations = (cesiumViewer: Viewer | null, groundStations: GroundStation[]) => {
  if (!cesiumViewer) return;

  groundStations.forEach((station) => {
    // 지상국 위치 계산 (고도 포함)
    const stationHeight = station.height || 0;
    const stationPosition = Cesium.Cartesian3.fromDegrees(station.longitude, station.latitude, stationHeight);

    // 지상국 위치 마커는 그대로 유지
    cesiumViewer.entities.add({
      name: station.name,
      position: stationPosition,
      billboard: {
        image:
          "data:image/svg+xml;base64," +
          btoa(`
          <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="14" fill="#3498db" stroke="white" stroke-width="2"/>
            <path d="M16 6 L16 26 M6 16 L26 16" stroke="white" stroke-width="2"/>
          </svg>
        `),
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        scale: 1,
      },
      label: {
        text: station.name,
        font: "14px sans-serif",
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -10),
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
      },
    });

    // 통신 범위 원뿔 수정
    const coneAngle = Cesium.Math.toRadians(station.coneAngle || 45);
    const range = (station.communicationRange || 1000) * 500; // km를 m로 변환

    // 원뿔의 높이를 절반으로 하여 지표면에서 시작하도록 조정
    const coneHeight = range;
    const conePosition = Cesium.Cartesian3.fromDegrees(
      station.longitude,
      station.latitude,
      stationHeight + coneHeight / 2 // 원뿔의 중심을 높이의 절반만큼 올림
    );

    cesiumViewer.entities.add({
      name: `${station.name} 통신범위`,
      position: conePosition,
      cylinder: {
        length: coneHeight,
        topRadius: range * Math.tan(coneAngle),
        bottomRadius: 0,
        material: Cesium.Color.BLUE.withAlpha(0.2),
        outline: true,
        outlineColor: Cesium.Color.BLUE.withAlpha(0.8),
        outlineWidth: 2,
      },
      orientation: Cesium.Transforms.headingPitchRollQuaternion(conePosition, new Cesium.HeadingPitchRoll(0, Cesium.Math.toRadians(0), 0)),
    });
  });
};
