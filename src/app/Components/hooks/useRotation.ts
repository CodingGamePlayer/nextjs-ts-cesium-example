"use client";

import * as Cesium from "cesium";
import { useCallback } from "react";
import { RotationState } from "../types/CesiumTypes";

/**
 * 모델 회전 관련 기능을 제공하는 커스텀 훅
 * @param cesiumViewer Cesium 뷰어 참조
 * @param rotation 외부에서 관리되는 회전 상태
 * @param setRotation 회전 상태 설정 함수
 * @returns 회전 관련 함수들
 */
export function useRotation(
  cesiumViewer: React.MutableRefObject<Cesium.Viewer | null>,
  rotation: RotationState,
  setRotation: React.Dispatch<React.SetStateAction<RotationState>>
) {
  // 회전 적용 함수 (위치 유지를 위한 별도 함수)
  const applyRotation = useCallback(
    (newRotation: RotationState) => {
      // 현재 시간 저장
      if (cesiumViewer.current) {
        // 회전 전 현재 시간 저장
        const currentTime = cesiumViewer.current.clock.currentTime.clone();

        // 회전 상태 업데이트
        setRotation(newRotation);

        // 회전 후 scene을 강제로 렌더링하여 변경 사항 즉시 적용
        cesiumViewer.current.scene.requestRender();

        // 저장된 시간으로 복원하여 위치 초기화 방지
        setTimeout(() => {
          if (cesiumViewer.current) {
            cesiumViewer.current.clock.currentTime = currentTime;
            cesiumViewer.current.scene.requestRender();
          }
        }, 10);
      } else {
        setRotation(newRotation);
      }
    },
    [cesiumViewer, setRotation]
  );

  // Yaw 컨트롤 핸들러
  const handleYawChange = useCallback(
    (delta: number) => {
      applyRotation({
        ...rotation,
        yaw: rotation.yaw + delta,
      });
    },
    [rotation, applyRotation]
  );

  // Pitch 컨트롤 핸들러
  const handlePitchChange = useCallback(
    (delta: number) => {
      applyRotation({
        ...rotation,
        pitch: rotation.pitch + delta,
      });
    },
    [rotation, applyRotation]
  );

  // Roll 컨트롤 핸들러
  const handleRollChange = useCallback(
    (delta: number) => {
      applyRotation({
        ...rotation,
        roll: rotation.roll + delta,
      });
    },
    [rotation, applyRotation]
  );

  // 회전 초기화 핸들러
  const handleRotationReset = useCallback(() => {
    applyRotation({ yaw: 0, pitch: 0, roll: 0 });
  }, [applyRotation]);

  return {
    applyRotation,
    handleYawChange,
    handlePitchChange,
    handleRollChange,
    handleRotationReset,
  };
}
