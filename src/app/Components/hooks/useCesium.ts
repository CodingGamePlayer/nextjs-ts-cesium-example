"use client";

import * as Cesium from "cesium";
import { Entity, Viewer } from "cesium";
import { useCallback, useRef, useState } from "react";
import { ViewerRefs } from "../types/CesiumTypes";

export function useCesium() {
  // 뷰어 관련 참조
  const cesiumViewer = useRef<Viewer | null>(null);
  const cesiumContainerRef = useRef<HTMLDivElement>(null);
  const issEntityRef = useRef<Entity | null>(null);

  // 상태 관리
  const [isLoaded, setIsLoaded] = useState(false);

  // 뷰어 참조 객체
  const viewerRefs: ViewerRefs = {
    cesiumViewer,
    cesiumContainerRef,
    issEntityRef,
  };

  // Cesium 초기화 함수
  const initializeCesium = useCallback((animationSpeed: number = 10, animating: boolean = true) => {
    if (cesiumViewer.current === null && cesiumContainerRef.current) {
      Cesium.Ion.defaultAccessToken = `${process.env.NEXT_PUBLIC_CESIUM_TOKEN}`;

      cesiumViewer.current = new Cesium.Viewer(cesiumContainerRef.current, {
        terrain: Cesium.Terrain.fromWorldTerrain(),
        baseLayerPicker: false,
        navigationHelpButton: false,
        homeButton: false,
        geocoder: false,
        animation: false,
        timeline: false,
        shadows: false,
        terrainShadows: Cesium.ShadowMode.DISABLED,
        sceneMode: Cesium.SceneMode.SCENE3D,
        sceneModePicker: false,
        creditContainer: document.createElement("div"),
        orderIndependentTranslucency: true,
        fullscreenButton: false,
        infoBox: false,
        shouldAnimate: true,
        selectionIndicator: false,
      });

      // 크레딧 표시 완전히 비활성화
      hideCesiumCredits(cesiumViewer.current);

      // 시계 설정 - ISS 움직임을 위한 설정
      cesiumViewer.current.clock.shouldAnimate = animating;
      cesiumViewer.current.clock.multiplier = animationSpeed;
      cesiumViewer.current.scene.requestRender();

      // 클록 틱 이벤트 리스너 추가
      cesiumViewer.current.clock.onTick.addEventListener(() => {
        if (animating) {
          cesiumViewer.current?.scene.requestRender();
        }
      });

      cesiumViewer.current.scene.globe.enableLighting = true;
      cesiumViewer.current.scene.globe.shadows = Cesium.ShadowMode.ENABLED;

      cesiumViewer.current.clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK_MULTIPLIER;

      // 스크롤 줌 관련 설정
      cesiumViewer.current.scene.screenSpaceCameraController.enableZoom = true; // 줌 활성화
      cesiumViewer.current.scene.screenSpaceCameraController.zoomEventTypes = [Cesium.CameraEventType.WHEEL, Cesium.CameraEventType.PINCH]; // 휠과 핀치 모두 줌 이벤트로 설정
      cesiumViewer.current.scene.screenSpaceCameraController.minimumZoomDistance = 10000; // 최소 줌 거리 (m)
      cesiumViewer.current.scene.screenSpaceCameraController.maximumZoomDistance = 10000000; // 최대 줌 거리 (m)

      console.log("Cesium 초기화 완료, 모델을 표시할 준비가 되었습니다.");
      return true;
    }
    return false;
  }, []);

  // 크레딧 표시 비활성화 함수
  const hideCesiumCredits = (viewer: Cesium.Viewer) => {
    if (viewer.cesiumWidget.creditContainer) {
      // 1. 크레딧 컨테이너 스타일 숨김
      (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = "none";

      // 2. 크레딧 컨테이너 요소 제거 시도
      try {
        const creditContainer = viewer.cesiumWidget.creditContainer;
        if (creditContainer.parentNode) {
          creditContainer.parentNode.removeChild(creditContainer);
        }
      } catch (e) {
        console.log("크레딧 컨테이너 제거 중 오류 발생", e);
      }
    }

    // 3. 크레딧 표시 관련 설정 변경 (타입 안전한 방법)
    try {
      // @ts-ignore - Cesium 내부 API에 접근
      if (viewer._creditContainer) {
        // @ts-ignore
        viewer._creditContainer.style.display = "none";
      }

      // @ts-ignore - Cesium 내부 API에 접근
      if (viewer.creditDisplay) {
        // @ts-ignore
        if (viewer.creditDisplay.container) {
          // @ts-ignore
          viewer.creditDisplay.container.style.display = "none";
        }
        // @ts-ignore
        if (viewer.creditDisplay._creditContainer) {
          // @ts-ignore
          viewer.creditDisplay._creditContainer.style.display = "none";
        }
        // @ts-ignore
        viewer.creditDisplay._creditsToDisplay = {};
        // @ts-ignore
        viewer.creditDisplay._defaultCredit = undefined;
      }

      // @ts-ignore
      if (viewer._cesiumWidget && viewer._cesiumWidget.creditDisplay) {
        // @ts-ignore
        viewer._cesiumWidget.creditDisplay.container.style.display = "none";
        // @ts-ignore
        viewer._cesiumWidget.creditDisplay._creditsToDisplay = {};
      }
    } catch (e) {
      console.log("크레딧 표시 비활성화 중 오류 발생", e);
    }

    // 4. CSS로 크레딧 관련 요소 숨김
    const style = document.createElement("style");
    style.innerHTML = `
      .cesium-credit-container, .cesium-credit-expand-link, .cesium-credit-text, 
      .cesium-widget-credits, .cesium-credit-imageContainer, .cesium-credit-lightbox,
      .cesium-credit-lightbox-overlay, .cesium-credit-lightbox-title, .cesium-credit-lightbox-content,
      .cesium-credit-lightbox-description, .cesium-credit-lightbox-close,
      [class*="cesium-credit"], [id*="cesium-credit"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        height: 0 !important;
        width: 0 !important;
        pointer-events: none !important;
        position: absolute !important;
        overflow: hidden !important;
        z-index: -9999 !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        max-height: 0 !important;
        max-width: 0 !important;
        clip: rect(0, 0, 0, 0) !important;
        clip-path: inset(50%) !important;
      }
      
      /* Cesium ion 로고 및 워터마크 제거 */
      .cesium-viewer-bottom, .cesium-viewer-bottom *, 
      .cesium-viewer-cesiumInspectorContainer, .cesium-viewer-cesium3DTilesInspectorContainer,
      [class*="cesium-viewer-bottom"], [id*="cesium-viewer-bottom"],
      .cesium-widget-credits, .cesium-widget-credits *,
      [class*="cesium-widget-credits"], [id*="cesium-widget-credits"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
      }
    `;
    document.head.appendChild(style);

    // 5. 하단 컨테이너 직접 제거
    setTimeout(() => {
      try {
        // 모든 가능한 크레딧 관련 요소 선택
        const bottomElements = document.querySelectorAll(".cesium-viewer-bottom");
        bottomElements.forEach((element) => {
          // 요소를 제거하는 대신 스타일만 변경
          (element as HTMLElement).style.display = "none";
          (element as HTMLElement).style.visibility = "hidden";
          (element as HTMLElement).style.opacity = "0";
          (element as HTMLElement).style.height = "0";
          (element as HTMLElement).style.overflow = "hidden";
        });

        // 크레딧 컨테이너 선택
        const creditElements = document.querySelectorAll(".cesium-credit-container, .cesium-widget-credits");
        creditElements.forEach((element) => {
          // 요소를 제거하는 대신 스타일만 변경
          (element as HTMLElement).style.display = "none";
          (element as HTMLElement).style.visibility = "hidden";
          (element as HTMLElement).style.opacity = "0";
          (element as HTMLElement).style.height = "0";
          (element as HTMLElement).style.overflow = "hidden";
        });
      } catch (e) {
        console.log("하단 컨테이너 스타일 변경 중 오류 발생", e);
      }
    }, 500);
  };

  // 외부에서 사용할 초기화 함수
  const initializeCesiumJs = useCallback(
    async (positions: any[], animationSpeed: number = 10, animating: boolean = true) => {
      const initialized = initializeCesium(animationSpeed, animating);

      if (initialized && cesiumViewer.current) {
        // 위치 데이터 추가
        positions.forEach((p) => {
          cesiumViewer.current?.entities.add({
            position: Cesium.Cartesian3.fromDegrees(p.lng, p.lat),
            ellipse: {
              semiMinorAxis: 50000.0,
              semiMajorAxis: 50000.0,
              height: 0,
              material: Cesium.Color.RED.withAlpha(0.5),
              outline: true,
              outlineColor: Cesium.Color.BLACK,
            },
          });
        });

        setIsLoaded(true);
      }
    },
    [initializeCesium]
  );

  return {
    viewerRefs,
    isLoaded,
    setIsLoaded,
    initializeCesiumJs,
  };
}
