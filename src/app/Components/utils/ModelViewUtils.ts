import * as Cesium from "cesium";
import { ModelViewMode, ModelViewConfig } from "../types/CesiumTypes";

/**
 * 모델 뷰 설정을 위한 유틸리티 함수
 */

// 기본 모델 중심 계산 (모델 또는 엔티티의 boundingSphere 기준)
export const getModelCenter = (viewer: Cesium.Viewer | null, entityId?: string): Cesium.Cartesian3 => {
  if (!viewer) {
    // 기본값 반환 (지구 중심)
    return Cesium.Cartesian3.ZERO;
  }

  // 특정 엔티티가 지정된 경우
  if (entityId) {
    const entity = viewer.entities.getById(entityId);
    if (entity && entity.position) {
      const position = entity.position.getValue(viewer.clock.currentTime);
      if (position) {
        return position;
      }
    }
  }

  // 모든 엔티티에 대한 BoundingSphere 계산
  const entities = viewer.entities.values;
  if (entities.length === 0) {
    // 엔티티가 없으면 현재 카메라 위치 반환
    return viewer.camera.position;
  }

  // 모든 엔티티의 위치로 BoundingSphere 계산
  const positions: Cesium.Cartesian3[] = [];
  for (const entity of entities) {
    if (entity.position) {
      const position = entity.position.getValue(viewer.clock.currentTime);
      if (position) {
        positions.push(position);
      }
    }
  }

  if (positions.length === 0) {
    return viewer.camera.position;
  }

  // BoundingSphere 계산
  const boundingSphere = Cesium.BoundingSphere.fromPoints(positions);
  return boundingSphere.center;
};

// 뷰 모드별 카메라 설정
export const getViewConfiguration = (
  mode: ModelViewMode,
  center: Cesium.Cartesian3,
  distance: number = 1000000 // 기본 거리 (미터)
): ModelViewConfig => {
  // 기본 설정
  const defaultConfig: ModelViewConfig = {
    mode,
    position: undefined,
    heading: 0,
    pitch: 0,
    roll: 0,
    zoom: distance,
  };

  // 모드별 카메라 설정
  switch (mode) {
    case "default":
      // 기본 뷰 - 약간 비스듬한 각도에서 바라보기
      return {
        ...defaultConfig,
        heading: Cesium.Math.toRadians(30),
        pitch: Cesium.Math.toRadians(-30),
      };

    case "front":
      // 정면 뷰
      return {
        ...defaultConfig,
        heading: 0,
        pitch: 0,
      };

    case "back":
      // 후면 뷰
      return {
        ...defaultConfig,
        heading: Cesium.Math.toRadians(180),
        pitch: 0,
      };

    case "top":
      // 상단 뷰
      return {
        ...defaultConfig,
        heading: 0,
        pitch: Cesium.Math.toRadians(-90),
      };

    case "bottom":
      // 하단 뷰
      return {
        ...defaultConfig,
        heading: 0,
        pitch: Cesium.Math.toRadians(90),
      };

    case "left":
      // 좌측 뷰
      return {
        ...defaultConfig,
        heading: Cesium.Math.toRadians(-90),
        pitch: 0,
      };

    case "right":
      // 우측 뷰
      return {
        ...defaultConfig,
        heading: Cesium.Math.toRadians(90),
        pitch: 0,
      };

    case "sunView":
      // 태양 방향 뷰
      return {
        ...defaultConfig,
        heading: Cesium.Math.toRadians(45),
        pitch: Cesium.Math.toRadians(-35),
      };

    case "towardsSun":
      // 태양 방향 뷰
      return {
        ...defaultConfig,
        heading: Cesium.Math.toRadians(45),
        pitch: Cesium.Math.toRadians(-35),
      };

    default:
      return defaultConfig;
  }
};

// 모델 뷰 적용 함수
export const applyModelView = (
  viewer: Cesium.Viewer | null,
  config: ModelViewConfig,
  entityId?: string,
  duration: number = 1.5 // 카메라 이동 시간 (초)
): void => {
  if (!viewer) {
    return;
  }

  // 모델 중심 계산
  const center = getModelCenter(viewer, entityId);

  // 뷰 설정 가져오기
  const viewConfig = getViewConfiguration(config.mode, center, config.zoom);

  // 카메라 이동 계산
  const offset = new Cesium.HeadingPitchRange(viewConfig.heading || 0, viewConfig.pitch || 0, viewConfig.zoom || 1000000);

  // 카메라 이동 실행
  if (entityId) {
    const entity = viewer.entities.getById(entityId);
    if (entity) {
      viewer.zoomTo(entity, offset);
    } else {
      viewer.zoomTo(viewer.entities, offset);
    }
  } else {
    viewer.zoomTo(viewer.entities, offset);
  }

  // 추가 카메라 설정 (필요시)
  if (viewConfig.roll) {
    // roll이 읽기 전용 속성이므로 setView를 사용해 카메라 설정을 변경
    const currentPosition = viewer.camera.position;
    const currentHeading = viewer.camera.heading;
    const currentPitch = viewer.camera.pitch;

    viewer.camera.setView({
      destination: currentPosition,
      orientation: {
        heading: currentHeading,
        pitch: currentPitch,
        roll: viewConfig.roll,
      },
    });
  }

  // 씬 업데이트 요청
  viewer.scene.requestRender();
};
