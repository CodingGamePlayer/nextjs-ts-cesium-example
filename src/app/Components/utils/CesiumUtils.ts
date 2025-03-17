import * as Cesium from "cesium";
import { Viewer } from "cesium";

// 카메라 이동 함수
export const flyToISS = (cesiumViewer: Viewer | null, enableTracking: boolean = false) => {
  if (!cesiumViewer) return;

  const issEntity = cesiumViewer.entities.getById("ISS");
  if (!issEntity) return;

  const position = issEntity.position?.getValue(cesiumViewer.clock.currentTime);
  if (!position) return;

  // 위성을 화면 중앙에 위치시키고 위에서 바라보기
  cesiumViewer
    .zoomTo(
      issEntity,
      new Cesium.HeadingPitchRange(
        0, // heading
        Cesium.Math.toRadians(-90), // pitch: 위에서 아래로 보기
        4000000 // 거리 (미터)
      )
    )
    .then(() => {
      // 추적 활성화 옵션이 true인 경우 ISS 엔티티 추적 시작
      if (enableTracking) {
        cesiumViewer.trackedEntity = issEntity;
      }
    });
};

// 엔티티 추적 중지 함수
export const stopTracking = (cesiumViewer: Viewer | null) => {
  if (!cesiumViewer) return;
  cesiumViewer.trackedEntity = undefined;
};
