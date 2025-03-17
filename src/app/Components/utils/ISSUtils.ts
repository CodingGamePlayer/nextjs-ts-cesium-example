import * as Cesium from "cesium";
import { Viewer } from "cesium";
import { SatellitePosition } from "../../utils/satellite";
import { RotationState } from "../types/CesiumTypes";

// ISS 궤도 그리기 함수
export const drawISSOrbit = (cesiumViewer: Viewer | null, issPositions: SatellitePosition[] | undefined, rotation: RotationState, animationSpeed: number) => {
  console.log("🚀 ~ drawISSOrbit ~ issPositions:", issPositions);
  try {
    if (!cesiumViewer || !issPositions?.length) return;

    // 모든 ISS 관련 엔티티 제거 - 더 강력한 방식으로 구현
    const entitiesToRemove = ["ISS", "ISS_ORBIT", "ISS_X_AXIS", "ISS_Y_AXIS", "ISS_Z_AXIS"];

    // 1. ID로 명시적 제거 시도
    entitiesToRemove.forEach((id) => {
      try {
        cesiumViewer.entities.removeById(id);
      } catch (e) {
        // 엔티티가 존재하지 않으면 무시
      }
    });

    // 2. 엔티티 컬렉션을 순회하며 ID에 "ISS"가 포함된 모든 엔티티 제거
    const allEntities = [...cesiumViewer.entities.values];
    allEntities.forEach((entity) => {
      if (entity.id && String(entity.id).includes("ISS")) {
        try {
          cesiumViewer.entities.remove(entity);
        } catch (e) {
          console.warn("엔티티 제거 실패:", entity.id);
        }
      }
    });

    // 궤도 위치 계산 (시간당 정확한 위치 매핑)
    const orbitPositions = issPositions.map((pos) => Cesium.Cartesian3.fromDegrees(pos.longitude, pos.latitude, pos.height));

    // ISS 궤도 추가 (존재 여부 확인 후)
    if (!cesiumViewer.entities.getById("ISS_ORBIT")) {
      cesiumViewer.entities.add({
        id: "ISS_ORBIT",
        polyline: {
          positions: orbitPositions,
          width: 2,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.2,
            color: Cesium.Color.BLUE,
          }),
          // 고도를 정확하게 추적하기 위한 설정 추가
          clampToGround: false,
        },
      });
    }

    // 이 곳에 'issEntity'를 선언하여 결과를 저장
    let issEntity = null;

    // ISS 모델 추가 - 재확인 후 추가
    if (!cesiumViewer.entities.getById("ISS")) {
      const satelliteScale = 1000; // 모델 크기 조정 (필요에 따라 조정)

      // 부드러운 이동을 위한 SampledPositionProperty 생성
      const issPositionProperty = new Cesium.SampledPositionProperty();

      // 정확한 보간을 위한 옵션 설정
      issPositionProperty.setInterpolationOptions({
        interpolationDegree: 3,
        interpolationAlgorithm: Cesium.LagrangePolynomialApproximation,
      });

      // 현재 시간과 가장 가까운 위치 찾기
      const now = new Date();
      let closestPositionIndex = 0;
      let minTimeDiff = Number.MAX_VALUE;

      for (let i = 0; i < issPositions.length; i++) {
        const timeDiff = Math.abs(issPositions[i].epoch.getTime() - now.getTime());
        if (timeDiff < minTimeDiff) {
          minTimeDiff = timeDiff;
          closestPositionIndex = i;
        }
      }

      // 시작 시간 설정
      const startTime = Cesium.JulianDate.fromDate(issPositions[0].epoch);
      const endTime = Cesium.JulianDate.fromDate(issPositions[issPositions.length - 1].epoch);

      // 현재 시간에 가장 가까운 시간 찾기
      const currentPositionTime = Cesium.JulianDate.fromDate(issPositions[closestPositionIndex].epoch);

      // 시간 간격 계산 - 각 위치의 실제 시간 사용
      for (let i = 0; i < issPositions.length; i++) {
        const sampleTime = Cesium.JulianDate.fromDate(issPositions[i].epoch);
        issPositionProperty.addSample(sampleTime, orbitPositions[i]);
      }

      // 시계 설정 저장
      const clockSettings = {
        startTime,
        stopTime: endTime,
        currentTime: currentPositionTime, // 현재 시간에 가장 가까운 위치의 시간으로 설정
        multiplier: animationSpeed,
      };

      // 시계 설정 적용
      cesiumViewer.clock.startTime = clockSettings.startTime;
      cesiumViewer.clock.stopTime = clockSettings.stopTime;
      cesiumViewer.clock.currentTime = clockSettings.currentTime;
      cesiumViewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
      cesiumViewer.clock.multiplier = clockSettings.multiplier;

      // orientation 콜백 함수 수정
      const orientationCallback = new Cesium.CallbackProperty((time) => {
        if (!issPositions || issPositions.length < 2) return Cesium.Quaternion.IDENTITY;

        // 현재 위치 가져오기
        const currentPosition = issPositionProperty.getValue(time);
        if (!currentPosition) return Cesium.Quaternion.IDENTITY;

        // 약간 미래 시간 계산
        const futureTime = Cesium.JulianDate.addSeconds(time, 1, new Cesium.JulianDate());
        const futurePosition = issPositionProperty.getValue(futureTime);

        if (!futurePosition) return Cesium.Quaternion.IDENTITY;

        // 진행 방향과 위 방향으로 회전 계산
        const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(currentPosition);

        // 기본 회전 계산
        const baseRotation = Cesium.Transforms.headingPitchRollQuaternion(currentPosition, new Cesium.HeadingPitchRoll(0, 0, 0));

        // 사용자 회전 적용 - 여기서 rotation 참조를 직접 사용하지 않고 전역 변수로 활용
        const userRotation = Cesium.Quaternion.fromHeadingPitchRoll(
          new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(rotation.yaw), Cesium.Math.toRadians(rotation.pitch), Cesium.Math.toRadians(rotation.roll))
        );

        // 회전 결합
        return Cesium.Quaternion.multiply(baseRotation, userRotation, new Cesium.Quaternion());
      }, false);

      // 엔티티 생성 시 orientation 속성에 콜백 함수 할당
      issEntity = cesiumViewer.entities.add({
        id: "ISS",
        position: issPositionProperty,
        orientation: orientationCallback,
        // 포인트 표시 대신 3D 모델 사용
        model: {
          uri: "/Cesium_Air.glb", // public 디렉토리의 위성 모델 경로
          minimumPixelSize: 128,
          maximumScale: 20000,
          scale: satelliteScale,
          runAnimations: false, // 애니메이션 비활성화
          heightReference: Cesium.HeightReference.NONE, // 높이 참조 명시적 설정
          color: Cesium.Color.WHITE,
          silhouetteColor: Cesium.Color.WHITE,
          silhouetteSize: 2.0,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 20000000),
        },
        label: {
          text: "ISS",
          font: "14pt sans-serif",
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -9),
        },
      });

      // ISS 기준 XYZ 축 추가
      addISSAxes(cesiumViewer, issEntity, orbitPositions);

      return { issEntity, clockSettings };
    }
  } catch (error) {
    console.error("ISS 엔티티 생성 중 오류 발생:", error);

    // 심각한 오류 발생 시 ISS 관련 엔티티만 제거 및 로그 출력
    try {
      if (cesiumViewer) {
        // 전체 엔티티 제거가 아닌 ISS 관련 엔티티만 제거
        const allEntities = [...cesiumViewer.entities.values];
        for (let i = 0; i < allEntities.length; i++) {
          const entity = allEntities[i];
          if (entity.id && String(entity.id).includes("ISS")) {
            cesiumViewer.entities.remove(entity);
          }
        }
        console.log("ISS 관련 엔티티가 모두 제거되었습니다. 다시 시도하세요.");
      }
    } catch (cleanupError) {
      console.error("엔티티 정리 중 오류:", cleanupError);
      alert("엔티티 처리 중 오류가 발생했습니다. 페이지를 새로고침 하세요.");
    }
  }

  return null;
};

// ISS 축 추가 함수
const addISSAxes = (cesiumViewer: Viewer, issEntity: Cesium.Entity, orbitPositions: Cesium.Cartesian3[]) => {
  const axisScale = 100000; // 축 길이 (미터 단위)

  // X축 (빨간색)
  if (!cesiumViewer.entities.getById("ISS_X_AXIS")) {
    cesiumViewer.entities.add({
      id: "ISS_X_AXIS",
      polyline: {
        positions: new Cesium.CallbackProperty((time: Cesium.JulianDate) => {
          const issPosition = issEntity.position?.getValue(time);
          if (!issPosition) return [orbitPositions[0], orbitPositions[0]];

          // 현재 ISS의 회전 행렬 가져오기
          const orientation = issEntity.orientation?.getValue(time);
          if (!orientation) return [issPosition, issPosition];

          // 현재 회전을 적용한 축 방향 계산
          const modelMatrix = Cesium.Matrix4.fromTranslationQuaternionRotationScale(issPosition, orientation, new Cesium.Cartesian3(1, 1, 1));

          // X축 방향 (1,0,0)을 모델 회전에 맞게 변환
          const xAxis = new Cesium.Cartesian3(axisScale, 0, 0);
          const rotatedXAxis = Cesium.Matrix4.multiplyByPoint(modelMatrix, xAxis, new Cesium.Cartesian3());

          return [issPosition, rotatedXAxis];
        }, false),
        width: 2,
        material: Cesium.Color.RED,
      },
      position: new Cesium.CallbackProperty((time: Cesium.JulianDate) => {
        const issPosition = issEntity.position?.getValue(time);
        if (!issPosition) return orbitPositions[0];

        const orientation = issEntity.orientation?.getValue(time);
        if (!orientation) return issPosition;

        const modelMatrix = Cesium.Matrix4.fromTranslationQuaternionRotationScale(issPosition, orientation, new Cesium.Cartesian3(1, 1, 1));

        const xAxis = new Cesium.Cartesian3(axisScale, 0, 0);
        const rotatedXAxis = Cesium.Matrix4.multiplyByPoint(modelMatrix, xAxis, new Cesium.Cartesian3());

        return Cesium.Cartesian3.midpoint(issPosition, rotatedXAxis, new Cesium.Cartesian3());
      }, false) as any,
      label: {
        text: "X",
        font: "14pt sans-serif",
        fillColor: Cesium.Color.YELLOW,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        pixelOffset: new Cesium.Cartesian2(0, 0),
        eyeOffset: new Cesium.Cartesian3(0, 0, -10000),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        show: true,
      },
    });
  }

  // Y축 (초록색)
  if (!cesiumViewer.entities.getById("ISS_Y_AXIS")) {
    cesiumViewer.entities.add({
      id: "ISS_Y_AXIS",
      polyline: {
        positions: new Cesium.CallbackProperty((time: Cesium.JulianDate) => {
          const issPosition = issEntity.position?.getValue(time);
          if (!issPosition) return [orbitPositions[0], orbitPositions[0]];

          // 현재 ISS의 회전 행렬 가져오기
          const orientation = issEntity.orientation?.getValue(time);
          if (!orientation) return [issPosition, issPosition];

          // 현재 회전을 적용한 축 방향 계산
          const modelMatrix = Cesium.Matrix4.fromTranslationQuaternionRotationScale(issPosition, orientation, new Cesium.Cartesian3(1, 1, 1));

          // Y축 방향 (0,1,0)을 모델 회전에 맞게 변환
          const yAxis = new Cesium.Cartesian3(0, axisScale, 0);
          const rotatedYAxis = Cesium.Matrix4.multiplyByPoint(modelMatrix, yAxis, new Cesium.Cartesian3());

          return [issPosition, rotatedYAxis];
        }, false),
        width: 2,
        material: Cesium.Color.GREEN,
      },
      position: new Cesium.CallbackProperty((time: Cesium.JulianDate) => {
        const issPosition = issEntity.position?.getValue(time);
        if (!issPosition) return orbitPositions[0];

        const orientation = issEntity.orientation?.getValue(time);
        if (!orientation) return issPosition;

        const modelMatrix = Cesium.Matrix4.fromTranslationQuaternionRotationScale(issPosition, orientation, new Cesium.Cartesian3(1, 1, 1));

        const yAxis = new Cesium.Cartesian3(0, axisScale, 0);
        const rotatedYAxis = Cesium.Matrix4.multiplyByPoint(modelMatrix, yAxis, new Cesium.Cartesian3());

        return Cesium.Cartesian3.midpoint(issPosition, rotatedYAxis, new Cesium.Cartesian3());
      }, false) as any,
      label: {
        text: "Y",
        font: "14pt sans-serif",
        fillColor: Cesium.Color.YELLOW,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        pixelOffset: new Cesium.Cartesian2(0, 0),
        eyeOffset: new Cesium.Cartesian3(0, 0, -10000),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        show: true,
      },
    });
  }

  // Z축 (파란색)
  if (!cesiumViewer.entities.getById("ISS_Z_AXIS")) {
    cesiumViewer.entities.add({
      id: "ISS_Z_AXIS",
      polyline: {
        positions: new Cesium.CallbackProperty((time: Cesium.JulianDate) => {
          const issPosition = issEntity.position?.getValue(time);
          if (!issPosition) return [orbitPositions[0], orbitPositions[0]];

          // 현재 ISS의 회전 행렬 가져오기
          const orientation = issEntity.orientation?.getValue(time);
          if (!orientation) return [issPosition, issPosition];

          // 현재 회전을 적용한 축 방향 계산
          const modelMatrix = Cesium.Matrix4.fromTranslationQuaternionRotationScale(issPosition, orientation, new Cesium.Cartesian3(1, 1, 1));

          // Z축 방향 (0,0,1)을 모델 회전에 맞게 변환
          const zAxis = new Cesium.Cartesian3(0, 0, axisScale);
          const rotatedZAxis = Cesium.Matrix4.multiplyByPoint(modelMatrix, zAxis, new Cesium.Cartesian3());

          return [issPosition, rotatedZAxis];
        }, false),
        width: 2,
        material: Cesium.Color.BLUE,
      },
      position: new Cesium.CallbackProperty((time: Cesium.JulianDate) => {
        const issPosition = issEntity.position?.getValue(time);
        if (!issPosition) return orbitPositions[0];

        const orientation = issEntity.orientation?.getValue(time);
        if (!orientation) return issPosition;

        const modelMatrix = Cesium.Matrix4.fromTranslationQuaternionRotationScale(issPosition, orientation, new Cesium.Cartesian3(1, 1, 1));

        const zAxis = new Cesium.Cartesian3(0, 0, axisScale);
        const rotatedZAxis = Cesium.Matrix4.multiplyByPoint(modelMatrix, zAxis, new Cesium.Cartesian3());

        return Cesium.Cartesian3.midpoint(issPosition, rotatedZAxis, new Cesium.Cartesian3());
      }, false) as any,
      label: {
        text: "Z",
        font: "14pt sans-serif",
        fillColor: Cesium.Color.YELLOW,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        pixelOffset: new Cesium.Cartesian2(0, 0),
        eyeOffset: new Cesium.Cartesian3(0, 0, -10000),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        show: true,
      },
    });
  }
};
