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

    case "isometric":
      // 등각 뷰 (45도 회전, 35도 경사)
      return {
        ...defaultConfig,
        heading: Cesium.Math.toRadians(45),
        pitch: Cesium.Math.toRadians(-35),
      };

    case "custom":
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

// 멀티뷰 구성을 위한 뷰 모드 배열 반환
export const getAvailableViewModes = (): ModelViewMode[] => {
  return ["default", "front", "back", "top", "bottom", "left", "right", "isometric"];
};

// 모델의 바운딩 박스 표시 함수
export const toggleBoundingBox = (viewer: Cesium.Viewer | null, entityId: string | undefined, show: boolean): void => {
  if (!viewer) return;

  // 기존 바운딩 박스 엔티티 제거
  const existingBoundingBox = viewer.entities.getById("model-bounding-box");
  if (existingBoundingBox) {
    viewer.entities.remove(existingBoundingBox);
  }

  if (!show) return;

  // 타겟 엔티티가 있는 경우에만 바운딩 박스 표시
  if (entityId) {
    const entity = viewer.entities.getById(entityId);
    if (entity && entity.position) {
      // 현재 시간에 대한 엔티티 위치 가져오기
      const position = entity.position.getValue(viewer.clock.currentTime);
      if (!position) return;

      // 모델의 크기 추정 (간단한 예: 엔티티의 크기에 따라 조정 필요)
      let modelSize = 100000; // 기본 크기 (미터)

      // 엔티티에 모델이 있는 경우 모델 크기 사용
      if (entity.model && entity.model.scale) {
        const scale = entity.model.scale.getValue(viewer.clock.currentTime);
        if (scale) {
          modelSize = 100000 * scale; // 스케일에 따라 크기 조정
        }
      }

      // 바운딩 박스 추가
      viewer.entities.add({
        id: "model-bounding-box",
        position: position,
        box: {
          dimensions: new Cesium.Cartesian3(modelSize, modelSize, modelSize),
          outline: true,
          outlineColor: Cesium.Color.YELLOW,
          outlineWidth: 2,
          fill: false,
        },
      });
    }
  }
};

// 와이어프레임 모드 설정 함수
export const setWireframeMode = (viewer: Cesium.Viewer | null, enabled: boolean): void => {
  if (!viewer) return;

  // 씬의 모든 프리미티브에 대해 와이어프레임 모드 설정
  const scene = viewer.scene;

  try {
    // 글로브 와이어프레임 모드 설정
    scene.globe.undergroundColor = enabled ? Cesium.Color.BLACK.withAlpha(0.1) : Cesium.Color.BLACK.withAlpha(1.0);

    // 전체 씬에 와이어프레임 모드 적용
    if (scene.primitives) {
      const primitives = scene.primitives;
      const length = primitives.length;

      for (let i = 0; i < length; i++) {
        const primitive = primitives.get(i);
        if (primitive && primitive.appearance) {
          // @ts-ignore - 직접 타입 체크보다 프로퍼티 설정 시도
          if (typeof primitive.appearance.wireframe !== "undefined") {
            // @ts-ignore
            primitive.appearance.wireframe = enabled;
          }
        }
      }
    }

    // 엔티티의 모델에 대해서도 와이어프레임 설정 시도
    viewer.entities.values.forEach((entity) => {
      if (entity.model) {
        // @ts-ignore - Model에 직접 와이어프레임 속성이 없으므로 설정 시도만
        if (entity.model.appearance) {
          // @ts-ignore
          entity.model.appearance.wireframe = enabled;
        }
      }
    });

    // 글로브에 대한 와이어프레임 모드 설정 - Cesium 내부 구현에 의존하는 부분은 제거
    // 글로브 와이어프레임 모드를 대체할 수 있는 안전한 방법
    if (enabled) {
      // 와이어프레임 효과를 시뮬레이션하기 위한 대체 방법
      scene.globe.translucency.enabled = true;
      scene.globe.translucency.frontFaceAlpha = 0.1;
      scene.globe.showGroundAtmosphere = false;
    } else {
      // 일반 모드로 복원
      scene.globe.translucency.enabled = false;
      scene.globe.showGroundAtmosphere = true;
    }

    // 3D Tiles에 대한 와이어프레임 모드 설정
    if (scene.globe) {
      scene.globe.depthTestAgainstTerrain = !enabled;
    }

    // 변경사항 렌더링 요청
    scene.requestRender();
  } catch (error) {
    console.warn("와이어프레임 모드 설정 중 오류 발생:", error);
  }
};

// 모델 하이라이트 효과 적용 함수
export const highlightModel = (viewer: Cesium.Viewer | null, entityId: string | undefined, highlight: boolean): void => {
  if (!viewer || !entityId) return;

  const entity = viewer.entities.getById(entityId);
  if (!entity) return;

  // 기존 하이라이트 효과 제거
  const existingHighlight = viewer.entities.getById("model-highlight-effect");
  if (existingHighlight) {
    viewer.entities.remove(existingHighlight);
  }

  if (!highlight) return;

  // 엔티티 위치 가져오기
  if (entity.position) {
    const position = entity.position.getValue(viewer.clock.currentTime);
    if (!position) return;

    // 하이라이트 효과 (글로우 이펙트) 추가
    viewer.entities.add({
      id: "model-highlight-effect",
      position: position,
      ellipsoid: {
        radii: new Cesium.Cartesian3(150000, 150000, 150000),
        material: new Cesium.ColorMaterialProperty(Cesium.Color.YELLOW.withAlpha(0.3)),
        outline: true,
        outlineColor: Cesium.Color.YELLOW.withAlpha(0.5),
        outlineWidth: 3,
        slicePartitions: 8,
        stackPartitions: 8,
      },
    });
  }
};
