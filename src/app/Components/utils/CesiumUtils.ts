import * as Cesium from "cesium";
import { Cesium3DTileset, Viewer } from "cesium";
import { ViewerRefs } from "../types/CesiumTypes";

// 카메라 초기화 함수
export const resetCamera = (cesiumViewer: Viewer | null) => {
  if (cesiumViewer !== null) {
    const is3D = cesiumViewer.scene.mode === Cesium.SceneMode.SCENE3D;

    if (is3D) {
      // 3D 모드: 지구본이 화면 중앙에 오도록 설정
      cesiumViewer.scene.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(128, 36, 25000000), // 한반도 쪽에서 지구를 바라보기
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-90),
          roll: 0,
        },
      });

      // 3D 모드의 카메라 제한 완화
      cesiumViewer.scene.screenSpaceCameraController.minimumZoomDistance = 1000; // 1km까지 줌인 가능
      cesiumViewer.scene.screenSpaceCameraController.maximumZoomDistance = 30000000;
    } else {
      // 2D 모드: 전세계가 보이도록 설정
      cesiumViewer.scene.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(0, 0, 40000000), // 적도 0도, 경도 0도 위치
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(0),
          roll: 0,
        },
      });

      // 2D 모드의 카메라 제한
      cesiumViewer.scene.screenSpaceCameraController.minimumZoomDistance = 1000;
      cesiumViewer.scene.screenSpaceCameraController.maximumZoomDistance = 50000000;
    }
  }
};

// 프리미티브 정리 함수
export const cleanUpPrimitives = (refs: ViewerRefs) => {
  //On NextJS 13.4+, React Strict Mode is on by default.
  //The block below will remove all added primitives from the scene.
  refs.addedScenePrimitives.current.forEach((scenePrimitive) => {
    if (refs.cesiumViewer.current !== null) {
      refs.cesiumViewer.current.scene.primitives.remove(scenePrimitive);
    }
  });
  refs.addedScenePrimitives.current = [];
};

// ISS로 카메라 이동 함수
export const flyToISS = (cesiumViewer: Viewer | null) => {
  if (!cesiumViewer) return;

  const issEntity = cesiumViewer.entities.getById("ISS");
  if (!issEntity) return;

  const position = issEntity.position?.getValue(cesiumViewer.clock.currentTime);
  if (!position) return;

  // 위성을 화면 중앙에 위치시키고 위에서 바라보기
  cesiumViewer.zoomTo(
    issEntity,
    new Cesium.HeadingPitchRange(
      0, // heading
      Cesium.Math.toRadians(-90), // pitch: 위에서 아래로 보기
      2000000 // 거리 (미터)
    )
  );
};

// 한반도로 이동하는 함수
export const flyToKorea = (cesiumViewer: Viewer | null) => {
  if (!cesiumViewer) return;

  // 한반도 중심점으로 이동
  cesiumViewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(128, 36, 10000000), // 고도를 더 높임
    orientation: {
      heading: 0,
      pitch: Cesium.Math.toRadians(-90), // 완전히 수직으로 내려다보기
      roll: 0,
    },
    duration: 2,
  });

  // 카메라 제한 설정
  cesiumViewer.scene.screenSpaceCameraController.minimumZoomDistance = 3000000; // 최소 줌 거리 증가
  cesiumViewer.scene.screenSpaceCameraController.maximumZoomDistance = 20000000; // 최대 줌 거리 증가

  // 화면 중앙에 오도록 추가 설정
  cesiumViewer.scene.camera.constrainedAxis = Cesium.Cartesian3.UNIT_Z;
};

// 태양 기준 시점으로 이동하는 함수
export const flyToSunView = (cesiumViewer: Viewer | null) => {
  if (!cesiumViewer) return;

  const issEntity = cesiumViewer.entities.getById("ISS");
  if (!issEntity) return;

  const position = issEntity.position?.getValue(cesiumViewer.clock.currentTime);
  if (!position) return;

  // 현재 시간의 태양 위치 계산
  const sunPosition = Cesium.Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(cesiumViewer.clock.currentTime);

  cesiumViewer.camera.flyTo({
    destination: Cesium.Cartesian3.add(
      position,
      Cesium.Cartesian3.multiplyByScalar(Cesium.Cartesian3.normalize(sunPosition, new Cesium.Cartesian3()), 2000000, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
    ),
    orientation: {
      direction: Cesium.Cartesian3.normalize(Cesium.Cartesian3.subtract(position, sunPosition, new Cesium.Cartesian3()), new Cesium.Cartesian3()),
      up: Cesium.Cartesian3.normalize(position, new Cesium.Cartesian3()),
    },
    duration: 2,
  });
};
