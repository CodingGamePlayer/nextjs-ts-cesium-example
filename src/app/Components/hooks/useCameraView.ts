"use client";

import * as Cesium from "cesium";
import { useCallback, useEffect } from "react";
import { ModelViewConfig, ModelViewMode, RotationState } from "../types/CesiumTypes";
import { applyModelView } from "../utils/ModelViewUtils";

// 파일 맨 위, 다른 import 문 다음에 추가
declare global {
  interface Window {
    sunDebugLogged?: boolean;
  }
}

/**
 * 카메라 뷰 관련 기능을 제공하는 커스텀 훅
 */
export function useCameraView(
  cesiumViewer: React.MutableRefObject<Cesium.Viewer | null>,
  issEntityRef: React.MutableRefObject<Cesium.Entity | null>,
  currentViewMode: ModelViewMode,
  setCurrentViewMode: React.Dispatch<React.SetStateAction<ModelViewMode>>,
  zoomLevel: number,
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>,
  trackingEnabled: boolean,
  setTrackingEnabled: React.Dispatch<React.SetStateAction<boolean>>,
  rotation: RotationState
) {
  // 뷰 모드별 설정 적용
  const configureViewSettings = useCallback(
    (mode: ModelViewMode) => {
      if (!cesiumViewer.current) return;

      // 모든 뷰에 대한 기본 설정
      cesiumViewer.current.scene.globe.enableLighting = true;

      // 하단 뷰에 대한 특별한 설정
      if (mode === "bottom") {
        // 렌더링 품질 향상
        cesiumViewer.current.scene.postProcessStages.fxaa.enabled = true; // 안티앨리어싱 활성화

        if (cesiumViewer.current.scene.primitives && issEntityRef.current) {
          // 씬의 다른 요소들의 밝기를 줄임
          cesiumViewer.current.scene.globe.translucency.enabled = true;
          cesiumViewer.current.scene.globe.translucency.frontFaceAlpha = 0;
        }

        // 다중 조명 설정 (모델을 여러 방향에서 비추도록)
        const time = cesiumViewer.current.clock.currentTime;
        if (issEntityRef.current) {
          const issPosition = issEntityRef.current.position?.getValue(time);

          if (issPosition) {
            // 하단에서 위로 향하는 주 조명
            cesiumViewer.current.scene.light = new Cesium.DirectionalLight({
              direction: Cesium.Cartesian3.normalize(
                new Cesium.Cartesian3(0, 0, 1), // 아래에서 위로
                new Cesium.Cartesian3()
              ),
              intensity: 5.0, // 더 밝게
              color: Cesium.Color.WHITE,
            });

            // 조명 효과 강화를 위한 추가 설정
            cesiumViewer.current.scene.globe.enableLighting = true;
            cesiumViewer.current.scene.shadowMap.enabled = true;
            cesiumViewer.current.scene.shadowMap.softShadows = true;

            // 모델을 더 선명하게 하는 설정
            try {
              // @ts-ignore - 내부 속성 접근
              if (cesiumViewer.current.scene.model && cesiumViewer.current.scene.model.silhouetteSize) {
                // @ts-ignore
                cesiumViewer.current.scene.model.silhouetteSize = 1.0;
                // @ts-ignore
                cesiumViewer.current.scene.model.silhouetteColor = Cesium.Color.WHITE;
              }
            } catch (e) {
              console.log("모델 강조 설정 중 오류", e);
            }
          }
        }
      } else {
        // 다른 뷰에서는 기본 설정으로 복원
        cesiumViewer.current.scene.light = new Cesium.SunLight();
        cesiumViewer.current.scene.globe.depthTestAgainstTerrain = true;
        cesiumViewer.current.scene.globe.translucency.enabled = false;
        cesiumViewer.current.scene.shadowMap.enabled = false;
      }
    },
    [cesiumViewer, issEntityRef]
  );

  // 뷰 모드 변경 핸들러
  const handleViewModeChange = useCallback(
    (mode: ModelViewMode) => {
      // 조건 검사 제거 - 항상 뷰 모드 상태 업데이트
      setCurrentViewMode(mode);

      // 뷰 모드에 따른 특수 설정 적용
      configureViewSettings(mode);

      // 모드에 해당하는 뷰 적용
      const viewConfig: ModelViewConfig = {
        mode,
        zoom: zoomLevel,
      };

      // ISS가 있다면 해당 엔티티에 초점을 맞춥니다
      if (issEntityRef.current && cesiumViewer.current) {
        // 먼저 추적을 중지하여 카메라 설정이 가능하도록 함
        cesiumViewer.current.trackedEntity = undefined;

        // 현재 시간 기준 ISS 위치 획득
        const currentTime = cesiumViewer.current.clock.currentTime;
        const issPosition = issEntityRef.current.position?.getValue(currentTime);
        const issOrientation = issEntityRef.current.orientation?.getValue(currentTime);

        if (issPosition && issOrientation) {
          // 뷰 모드에 따른 오프셋 방향과 각도 설정
          let headingRadians = 0;
          let pitchRadians = 0;
          // 뷰 모드에 따른 줌 레벨 설정 (하단 뷰만 더 가깝게)
          let currentZoomLevel = zoomLevel;

          // 태양 방향 벡터를 상위 스코프에 정의
          let toSunDirection: Cesium.Cartesian3 | undefined;

          // 태양 관련 뷰 계산 부분만 수정
          if (mode === "sunView" || mode === "towardsSun") {
            try {
              // 현재 시간에 대한 태양 위치 계산 (더 간단한 방법)
              const julianDate = cesiumViewer.current.clock.currentTime;
              const sunPositionInECI = Cesium.Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(julianDate);

              // 단일 변환으로 ECEF 좌표계로 변환
              const icrfToFixed = Cesium.Transforms.computeIcrfToFixedMatrix(julianDate);

              if (icrfToFixed && issPosition) {
                // 태양 위치를 ECEF 좌표계로 변환
                const sunPositionInECEF = new Cesium.Cartesian3();
                Cesium.Matrix3.multiplyByVector(icrfToFixed, sunPositionInECI, sunPositionInECEF);

                // 태양 방향 (정규화된 방향 벡터)
                toSunDirection = new Cesium.Cartesian3();
                Cesium.Cartesian3.subtract(sunPositionInECEF, issPosition, toSunDirection);
                Cesium.Cartesian3.normalize(toSunDirection, toSunDirection);
              }
            } catch (error) {
              console.error("태양 위치 계산 오류:", error);
            }
          }

          // 기본 방향 설정 (rotation 고려 전)
          switch (mode) {
            case "front":
              headingRadians = Cesium.Math.toRadians(270);
              pitchRadians = 0;
              break;
            case "back":
              headingRadians = Cesium.Math.toRadians(90);
              pitchRadians = 0;
              break;
            case "left":
              headingRadians = Cesium.Math.toRadians(180);
              pitchRadians = 0;
              break;
            case "right":
              headingRadians = 0;
              pitchRadians = 0;
              break;
            case "top":
              headingRadians = 0;
              pitchRadians = Cesium.Math.toRadians(-90);
              break;
            case "bottom":
              headingRadians = Cesium.Math.toRadians(0);
              pitchRadians = Cesium.Math.toRadians(90);
              currentZoomLevel = zoomLevel * 0.7;
              break;
            case "sunView": // 태양에서 모델을 바라보는 뷰
              if (toSunDirection) {
                // 태양 방향의 역방향으로 카메라 설정 (태양에서 모델로 보는 시점)
                const inverseSunDirection = Cesium.Cartesian3.negate(toSunDirection, new Cesium.Cartesian3());

                // 엔티티 위치를 기준으로 수직 정렬하는 방식으로 계산
                const headingPitchRoll = calculateHeadingPitchFromDirection(inverseSunDirection, issPosition, true);
                headingRadians = headingPitchRoll.heading;
                pitchRadians = headingPitchRoll.pitch;

                // 태양 뷰는 좀 더 멀리서 보기
                currentZoomLevel = zoomLevel * 1.2;
              }
              break;
            case "towardsSun": // 모델에서 태양을 바라보는 뷰
              if (toSunDirection) {
                // 태양 방향으로 카메라 설정 (모델에서 태양을 바라보는 시점)
                // 엔티티 위치를 기준으로 수직 정렬
                const headingPitchRoll = calculateHeadingPitchFromDirection(toSunDirection, issPosition, true);
                headingRadians = headingPitchRoll.heading;
                pitchRadians = headingPitchRoll.pitch;
              }
              break;
            case "default":
            default:
              headingRadians = Cesium.Math.toRadians(45);
              pitchRadians = Cesium.Math.toRadians(-30);
              break;
          }

          // 모델 회전 상태를 카메라 방향에 적용
          // yaw(y축), pitch(x축), roll(z축) 회전을 카메라 heading과 pitch에 반영
          if (mode !== "top" && mode !== "bottom" && mode !== "sunView" && mode !== "towardsSun") {
            // yaw 조정 (수평 회전) - 기존 heading에 yaw 회전 추가
            headingRadians += Cesium.Math.toRadians(rotation.yaw);

            // pitch 조정 (수직 회전) - 기존 pitch에 pitch 회전 적용
            pitchRadians += Cesium.Math.toRadians(rotation.pitch);
          }

          // 추적 활성화
          setTrackingEnabled(true);

          // 카메라 오프셋 계산 - 뷰 모드별 줌 레벨 적용
          const cameraOffset = new Cesium.HeadingPitchRange(headingRadians, pitchRadians, currentZoomLevel);

          // 오프셋 적용
          cesiumViewer.current.scene.camera.lookAt(issPosition, cameraOffset);

          // 다시 트래킹 모드로 설정
          cesiumViewer.current.trackedEntity = issEntityRef.current;

          // 지속적인 카메라 조정을 위한 이벤트 리스너
          const cameraTrackingListener = () => {
            if (!trackingEnabled || !cesiumViewer.current || !issEntityRef.current) return;

            const time = cesiumViewer.current.clock.currentTime;
            const position = issEntityRef.current.position?.getValue(time);
            const orientation = issEntityRef.current.orientation?.getValue(time);

            // 현재 모드가 태양 관련 모드인 경우에만 특별 처리
            if ((mode === "sunView" || mode === "towardsSun") && position) {
              try {
                // 현재 시간 기준 태양 위치 계산
                const julianDate = time;
                const sunPositionInECI = Cesium.Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(julianDate);
                const icrfToFixed = Cesium.Transforms.computeIcrfToFixedMatrix(julianDate);

                if (icrfToFixed) {
                  // 태양 위치를 ECEF 좌표계로 변환
                  const sunPositionInECEF = new Cesium.Cartesian3();
                  Cesium.Matrix3.multiplyByVector(icrfToFixed, sunPositionInECI, sunPositionInECEF);

                  // 태양 방향 벡터 계산 (ISS에서 태양으로의 방향)
                  const toSunDirection = Cesium.Cartesian3.subtract(sunPositionInECEF, position, new Cesium.Cartesian3());
                  Cesium.Cartesian3.normalize(toSunDirection, toSunDirection);

                  if (mode === "towardsSun") {
                    // ----- 태양 바라보기 모드 개선 -----

                    // 동서남북 기준으로 변환 행렬 계산
                    const transform = Cesium.Transforms.eastNorthUpToFixedFrame(position);

                    // 태양 방향을 로컬 좌표계로 변환
                    const invTransform = Cesium.Matrix4.inverse(transform, new Cesium.Matrix4());
                    const localSunDir = Cesium.Matrix4.multiplyByPointAsVector(invTransform, toSunDirection, new Cesium.Cartesian3());
                    Cesium.Cartesian3.normalize(localSunDir, localSunDir);

                    // 카메라가 태양을 가리키도록 heading과 pitch 계산
                    const heading = Math.atan2(localSunDir.x, localSunDir.y);
                    const horizontalDistance = Math.sqrt(localSunDir.x * localSunDir.x + localSunDir.y * localSunDir.y);
                    const pitch = Math.atan2(localSunDir.z, horizontalDistance);

                    // 카메라 설정 (엔티티 중심에 고정)
                    cesiumViewer.current.scene.camera.lookAt(position, new Cesium.HeadingPitchRange(heading, pitch, zoomLevel));

                    // 디버깅용 태양 방향 표시 (선택 사항)
                    if (cesiumViewer.current.entities.getById("sunDirection")) {
                      cesiumViewer.current.entities.removeById("sunDirection");
                    }

                    const endPoint = Cesium.Cartesian3.add(
                      position,
                      Cesium.Cartesian3.multiplyByScalar(toSunDirection, 100000, new Cesium.Cartesian3()),
                      new Cesium.Cartesian3()
                    );

                    cesiumViewer.current.entities.add({
                      id: "sunDirection",
                      name: "태양 방향",
                      polyline: {
                        positions: [position, endPoint],
                        width: 2,
                        material: new Cesium.ColorMaterialProperty(Cesium.Color.YELLOW),
                      },
                    });

                    console.log("태양 방향으로 카메라 업데이트:", {
                      heading: Cesium.Math.toDegrees(heading),
                      pitch: Cesium.Math.toDegrees(pitch),
                      localSunDir,
                    });
                  } else if (mode === "sunView") {
                    // ----- 태양에서 보기 모드 개선 -----

                    // 태양에서 ISS를 바라보는 방향
                    const fromSunDirection = Cesium.Cartesian3.negate(toSunDirection, new Cesium.Cartesian3());

                    // 동서남북 기준으로 변환 행렬 계산
                    const transform = Cesium.Transforms.eastNorthUpToFixedFrame(position);

                    // 태양 방향을 로컬 좌표계로 변환
                    const invTransform = Cesium.Matrix4.inverse(transform, new Cesium.Matrix4());
                    const localSunDir = Cesium.Matrix4.multiplyByPointAsVector(invTransform, fromSunDirection, new Cesium.Cartesian3());
                    Cesium.Cartesian3.normalize(localSunDir, localSunDir);

                    // 카메라가 태양 방향의 반대를 가리키도록 heading과 pitch 계산
                    const heading = Math.atan2(localSunDir.x, localSunDir.y);
                    const horizontalDistance = Math.sqrt(localSunDir.x * localSunDir.x + localSunDir.y * localSunDir.y);
                    const pitch = Math.atan2(localSunDir.z, horizontalDistance);

                    // 카메라 설정 (엔티티 중심에 고정)
                    cesiumViewer.current.scene.camera.lookAt(position, new Cesium.HeadingPitchRange(heading, pitch, zoomLevel * 1.2));
                  }

                  return;
                }
              } catch (error) {
                console.error("태양 방향 업데이트 오류:", error);
              }
            }

            // 태양 관련 모드가 아닌 경우의 코드:
            // 변수 추가
            let currentHeadingRadians = headingRadians;
            let currentPitchRadians = pitchRadians;

            if (position && orientation) {
              cesiumViewer.current.scene.camera.lookAt(position, new Cesium.HeadingPitchRange(currentHeadingRadians, currentPitchRadians, currentZoomLevel));
            }
          };

          // 기존 리스너 제거 및 새 리스너 등록
          cesiumViewer.current.scene.preRender.removeEventListener(cameraTrackingListener);
          cesiumViewer.current.scene.preRender.addEventListener(cameraTrackingListener);

          // 즉시 한 번 렌더링 요청하여 카메라 위치 업데이트
          cesiumViewer.current.scene.requestRender();
        }
      } else {
        // ISS가 없으면 일반적인 뷰 적용
        applyModelView(cesiumViewer.current, viewConfig);
      }
    },
    [zoomLevel, trackingEnabled, issEntityRef, cesiumViewer, configureViewSettings, setCurrentViewMode, setTrackingEnabled, rotation]
  );

  // calculateHeadingPitchFromDirection 함수를 수정하여 엔티티 기준 수직 정렬 구현
  const calculateHeadingPitchFromDirection = (direction: Cesium.Cartesian3, position?: Cesium.Cartesian3, isSunView = false) => {
    // 태양 뷰가 아닌 일반 뷰에서는 기존 방식 유지
    if (!isSunView || !position) {
      const east = Cesium.Cartesian3.UNIT_X;
      const north = Cesium.Cartesian3.UNIT_Y;
      const up = Cesium.Cartesian3.UNIT_Z;

      // 기존 계산 로직...
      const pitchDot = Cesium.Cartesian3.dot(direction, up);
      const pitch = Math.asin(pitchDot);

      const horizontalDir = Cesium.Cartesian3.subtract(
        direction,
        Cesium.Cartesian3.multiplyByScalar(up, pitchDot, new Cesium.Cartesian3()),
        new Cesium.Cartesian3()
      );

      if (Cesium.Cartesian3.magnitude(horizontalDir) < 0.0000001) {
        return { heading: 0, pitch };
      }

      Cesium.Cartesian3.normalize(horizontalDir, horizontalDir);

      const headingDot = Cesium.Cartesian3.dot(horizontalDir, north);
      let heading = Math.acos(Cesium.Math.clamp(headingDot, -1.0, 1.0));

      const eastDot = Cesium.Cartesian3.dot(horizontalDir, east);
      if (eastDot < 0) {
        heading = 2 * Math.PI - heading;
      }

      return { heading, pitch };
    }

    // 태양 뷰에서는 엔티티 위치를 기준으로 수직 정렬
    // 지구 중심에서 엔티티까지의 방향을 '위쪽' 방향으로 사용
    const entityUp = Cesium.Cartesian3.normalize(Cesium.Cartesian3.clone(position), new Cesium.Cartesian3());

    // 태양 방향과 엔티티 '위쪽' 방향이 평행한 경우 (거의 수직으로 태양이 위/아래에 있는 경우)
    const dotProduct = Math.abs(Cesium.Cartesian3.dot(direction, entityUp));
    if (dotProduct > 0.99) {
      // 거의 평행이면 임의의 수직 방향 선택
      const anyPerpendicular = new Cesium.Cartesian3(entityUp.y, -entityUp.x, 0);
      Cesium.Cartesian3.normalize(anyPerpendicular, anyPerpendicular);

      // direction이 entityUp과 같은 방향이면 pitch는 90도, 반대 방향이면 -90도
      const pitchSign = Cesium.Cartesian3.dot(direction, entityUp) > 0 ? 1 : -1;
      return {
        heading: 0, // 임의의 방향
        pitch: (pitchSign * Math.PI) / 2, // 90도 또는 -90도
      };
    }

    // 태양 방향과 수직인 '오른쪽' 방향 계산 (수직으로 정렬하기 위함)
    const right = Cesium.Cartesian3.cross(entityUp, direction, new Cesium.Cartesian3());
    Cesium.Cartesian3.normalize(right, right);

    // 새로운 '앞' 방향 계산 (오른쪽과 위쪽에 모두 수직)
    const forward = Cesium.Cartesian3.cross(right, entityUp, new Cesium.Cartesian3());
    Cesium.Cartesian3.normalize(forward, forward);

    // 엔티티 로컬 좌표계에서 direction의 방향 계산
    const rightDot = Cesium.Cartesian3.dot(direction, right);
    const forwardDot = Cesium.Cartesian3.dot(direction, forward);
    const upDot = Cesium.Cartesian3.dot(direction, entityUp);

    // heading (수평 방향) 계산
    let heading = Math.atan2(rightDot, forwardDot);

    // pitch (수직 방향) 계산
    const horizontalLen = Math.sqrt(rightDot * rightDot + forwardDot * forwardDot);
    let pitch = Math.atan2(upDot, horizontalLen);

    return { heading, pitch };
  };

  // 카메라 위치 업데이트 함수
  const updateCameraPosition = useCallback(() => {
    if (!cesiumViewer.current || !issEntityRef.current || !trackingEnabled) return;

    // 현재 선택된 뷰 모드에 따라 카메라 위치 다시 계산
    handleViewModeChange(currentViewMode);
  }, [currentViewMode, trackingEnabled, handleViewModeChange, cesiumViewer, issEntityRef]);

  // 줌 레벨 변경 핸들러 (완전히 새로운 접근)
  const handleZoomChange = useCallback(
    (value: number) => {
      // 이 함수는 외부에서 호출되어 상태를 변경하는 유일한 위치
      if (cesiumViewer.current && issEntityRef.current) {
        // 먼저 줌 값만 직접 카메라에 적용
        const currentTime = cesiumViewer.current.clock.currentTime;
        const issPosition = issEntityRef.current.position?.getValue(currentTime);

        if (issPosition) {
          try {
            // 현재 카메라 설정 가져오기
            const currentHeading = cesiumViewer.current.camera.heading;
            const currentPitch = cesiumViewer.current.camera.pitch;

            // 카메라에 직접 줌 적용 (상태 변경 없이)
            cesiumViewer.current.scene.camera.lookAt(issPosition, new Cesium.HeadingPitchRange(currentHeading, currentPitch, value));

            // 카메라 설정 후에만 상태 업데이트
            setZoomLevel(value);
          } catch (error) {
            console.error("줌 적용 오류:", error);
          }
        } else {
          // 일반적인 상태 업데이트만
          setZoomLevel(value);
        }
      } else {
        // 뷰어나 ISS가 없을 때도 상태는 업데이트
        setZoomLevel(value);
      }
    },
    [cesiumViewer, issEntityRef, setZoomLevel]
  );

  return {
    configureViewSettings,
    handleViewModeChange,
    updateCameraPosition,
    handleZoomChange, // applyZoomToCamera 제거
  };
}
