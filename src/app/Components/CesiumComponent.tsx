"use client";

import React from "react";
import type { CesiumType } from "../types/cesium";
import { Cesium3DTileset, Entity, type Viewer } from "cesium";
import type { Position } from "../types/position";
import { dateToJulianDate } from "../example_utils/date";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { SatellitePosition } from "../utils/satellite";
import * as Cesium from "cesium";

interface CesiumComponentProps {
  CesiumJs?: CesiumType;
  positions: Position[];
  issPositions?: SatellitePosition[];
  groundStations?: {
    name: string;
    latitude: number;
    longitude: number;
    height?: number;
    communicationRange?: number;
    coneAngle?: number;
  }[];
}

export const CesiumComponent = ({
  CesiumJs,
  positions,
  issPositions,
  groundStations = [
    {
      name: "대전 지상국",
      latitude: 36.3504,
      longitude: 127.3845,
      height: 100,
      communicationRange: 1000,
      coneAngle: 45,
    },
    {
      name: "제주 지상국",
      latitude: 33.4996,
      longitude: 126.5312,
      height: 100,
      communicationRange: 1000,
      coneAngle: 45,
    },
  ],
}: CesiumComponentProps) => {
  if (!CesiumJs) return null;

  const cesiumViewer = React.useRef<Viewer | null>(null);
  const cesiumContainerRef = React.useRef<HTMLDivElement>(null);
  const addedScenePrimitives = React.useRef<Cesium3DTileset[]>([]);
  const [isLoaded, setIsLoaded] = React.useState(false);

  // ISS 회전 상태 추가
  const [rotation, setRotation] = React.useState({ yaw: 0, pitch: 0, roll: 0 });
  const issEntityRef = React.useRef<Entity | null>(null);
  // 궤도 따라 움직임 제어
  const [animating, setAnimating] = React.useState(true);
  const [animationSpeed, setAnimationSpeed] = React.useState(10); // 1~100 속도값
  const currentPositionIndexRef = React.useRef<number>(0);

  // 시간 변수 추가
  const startTimeRef = React.useRef<Date>(new Date());
  const elapsedTimeRef = React.useRef<number>(0);
  const clockSettingsRef = React.useRef<{
    startTime: Cesium.JulianDate | null;
    stopTime: Cesium.JulianDate | null;
    currentTime: Cesium.JulianDate | null;
    multiplier: number;
  }>({
    startTime: null,
    stopTime: null,
    currentTime: null,
    multiplier: 10,
  });

  const resetCamera = React.useCallback(async () => {
    if (cesiumViewer.current !== null) {
      const is3D = cesiumViewer.current.scene.mode === Cesium.SceneMode.SCENE3D;

      if (is3D) {
        // 3D 모드: 지구본이 화면 중앙에 오도록 설정
        cesiumViewer.current.scene.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(128, 36, 25000000), // 한반도 쪽에서 지구를 바라보기
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-90),
            roll: 0,
          },
        });

        // 3D 모드의 카메라 제한 완화
        cesiumViewer.current.scene.screenSpaceCameraController.minimumZoomDistance = 1000; // 1km까지 줌인 가능
        cesiumViewer.current.scene.screenSpaceCameraController.maximumZoomDistance = 30000000;
      } else {
        // 2D 모드: 전세계가 보이도록 설정
        cesiumViewer.current.scene.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(0, 0, 40000000), // 적도 0도, 경도 0도 위치
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(0),
            roll: 0,
          },
        });

        // 2D 모드의 카메라 제한
        cesiumViewer.current.scene.screenSpaceCameraController.minimumZoomDistance = 1000;
        cesiumViewer.current.scene.screenSpaceCameraController.maximumZoomDistance = 50000000;
      }
    }
  }, []);

  const cleanUpPrimitives = React.useCallback(() => {
    //On NextJS 13.4+, React Strict Mode is on by default.
    //The block below will remove all added primitives from the scene.
    addedScenePrimitives.current.forEach((scenePrimitive) => {
      if (cesiumViewer.current !== null) {
        cesiumViewer.current.scene.primitives.remove(scenePrimitive);
      }
    });
    addedScenePrimitives.current = [];
  }, []);

  const initializeCesiumJs = React.useCallback(async () => {
    if (cesiumViewer.current !== null) {
      // OSM Buildings는 3D 모드에서만 추가
      if (cesiumViewer.current.scene.mode === Cesium.SceneMode.SCENE3D) {
        const osmBuildingsTileset = await Cesium.createOsmBuildingsAsync();

        //Clean up potentially already-existing primitives.
        cleanUpPrimitives();

        //Adding tile and adding to addedScenePrimitives to keep track and delete in-case of a re-render.
        const osmBuildingsTilesetPrimitive = cesiumViewer.current.scene.primitives.add(osmBuildingsTileset);
        addedScenePrimitives.current.push(osmBuildingsTilesetPrimitive);
      }

      //Position camera per Sandcastle demo
      resetCamera();

      // 모드 변경 이벤트 리스너 추가
      cesiumViewer.current.scene.morphComplete.addEventListener(() => {
        const is3D = cesiumViewer.current?.scene.mode === Cesium.SceneMode.SCENE3D;

        // 2D 모드로 전환시 buildings 제거
        if (!is3D) {
          cleanUpPrimitives();
        } else {
          // 3D 모드로 전환시 buildings 다시 추가
          Cesium.createOsmBuildingsAsync().then((osmBuildingsTileset) => {
            if (cesiumViewer.current) {
              const osmBuildingsTilesetPrimitive = cesiumViewer.current.scene.primitives.add(osmBuildingsTileset);
              addedScenePrimitives.current.push(osmBuildingsTilesetPrimitive);
            }
          });
        }
      });

      //We'll also add our own data here passed down from props as an example
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
  }, [positions, cleanUpPrimitives]);

  const drawISSOrbit = React.useCallback(() => {
    try {
      if (!cesiumViewer.current || !issPositions?.length) return;

      // 모든 ISS 관련 엔티티 제거 - 더 강력한 방식으로 구현
      const entitiesToRemove = ["ISS", "ISS_ORBIT", "ISS_X_AXIS", "ISS_Y_AXIS", "ISS_Z_AXIS"];

      // 1. ID로 명시적 제거 시도
      entitiesToRemove.forEach((id) => {
        try {
          cesiumViewer.current?.entities.removeById(id);
        } catch (e) {
          // 엔티티가 존재하지 않으면 무시
        }
      });

      // 2. 엔티티 컬렉션을 순회하며 ID에 "ISS"가 포함된 모든 엔티티 제거
      const allEntities = [...cesiumViewer.current.entities.values];
      allEntities.forEach((entity) => {
        if (entity.id && String(entity.id).includes("ISS")) {
          try {
            cesiumViewer.current?.entities.remove(entity);
          } catch (e) {
            console.warn("엔티티 제거 실패:", entity.id);
          }
        }
      });

      const orbitPositions = issPositions.map((pos) => Cesium.Cartesian3.fromDegrees(pos.longitude, pos.latitude, pos.height));

      // ISS 궤도 추가 (존재 여부 확인 후)
      if (!cesiumViewer.current.entities.getById("ISS_ORBIT")) {
        cesiumViewer.current.entities.add({
          id: "ISS_ORBIT",
          polyline: {
            positions: orbitPositions,
            width: 2,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.2,
              color: Cesium.Color.BLUE,
            }),
          },
        });
      }

      // ISS 모델 추가 - 재확인 후 추가
      if (!cesiumViewer.current.entities.getById("ISS")) {
        const satelliteScale = 1000; // 모델 크기 조정 (필요에 따라 조정)

        // 부드러운 이동을 위한 SampledPositionProperty 생성
        const issPositionProperty = new Cesium.SampledPositionProperty();

        // 시작 위치 설정
        const startTime = Cesium.JulianDate.fromDate(new Date());
        issPositionProperty.addSample(startTime, orbitPositions[0]);

        // 모든 위치를 샘플로 추가 (시간 간격 계산)
        const orbitDurationSeconds = 5400; // 궤도 주기 90분
        const timeStepSeconds = orbitDurationSeconds / orbitPositions.length;

        // 궤도 전체에 샘플 추가
        for (let i = 0; i < orbitPositions.length; i++) {
          const sampleTime = Cesium.JulianDate.addSeconds(startTime, i * timeStepSeconds, new Cesium.JulianDate());
          issPositionProperty.addSample(sampleTime, orbitPositions[i]);
        }

        // 마지막 지점 추가 (한 바퀴 더)
        const endTime = Cesium.JulianDate.addSeconds(startTime, orbitDurationSeconds, new Cesium.JulianDate());
        issPositionProperty.addSample(endTime, orbitPositions[0]);

        // 보간 설정 (현재 시간에 맞게 위치 계산)
        issPositionProperty.setInterpolationOptions({
          interpolationDegree: 3,
          interpolationAlgorithm: Cesium.LagrangePolynomialApproximation,
        });

        // 시계 설정 저장 (회전 시 초기화 방지)
        clockSettingsRef.current = {
          startTime, // 타입 오류를 방지하기 위해 간단한 할당 사용
          stopTime: endTime,
          currentTime: startTime,
          multiplier: animationSpeed,
        };

        // 시계 설정 업데이트 (null 체크 추가)
        if (clockSettingsRef.current.startTime) {
          cesiumViewer.current.clock.startTime = clockSettingsRef.current.startTime;
        }
        if (clockSettingsRef.current.stopTime) {
          cesiumViewer.current.clock.stopTime = clockSettingsRef.current.stopTime;
        }
        if (clockSettingsRef.current.currentTime) {
          cesiumViewer.current.clock.currentTime = clockSettingsRef.current.currentTime;
        }
        cesiumViewer.current.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
        cesiumViewer.current.clock.multiplier = clockSettingsRef.current.multiplier;

        const issEntity = cesiumViewer.current.entities.add({
          id: "ISS",
          // 부드러운 움직임을 위한 SampledPositionProperty 사용
          position: issPositionProperty,
          // 포인트 표시 대신 3D 모델 사용
          model: {
            uri: "/Cesium_Air.glb", // public 디렉토리의 위성 모델 경로
            minimumPixelSize: 128,
            maximumScale: 20000,
            scale: satelliteScale,
            runAnimations: false, // 애니메이션 비활성화
            heightReference: Cesium.HeightReference.NONE,
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
          // 모델 방향 설정 (위성의 진행 방향 기준 + 사용자 회전)
          orientation: new Cesium.CallbackProperty((time) => {
            if (!issPositions || issPositions.length < 2) return Cesium.Quaternion.IDENTITY;

            // 현재 위치 가져오기
            const currentPosition = issPositionProperty.getValue(time);
            if (!currentPosition) return Cesium.Quaternion.IDENTITY;

            // 약간 미래 시간 계산
            const futureTime = Cesium.JulianDate.addSeconds(time, 1, new Cesium.JulianDate());
            const futurePosition = issPositionProperty.getValue(futureTime);

            if (!futurePosition) return Cesium.Quaternion.IDENTITY;

            // 두 위치가 같으면 기본 방향 리턴
            if (Cesium.Cartesian3.equals(currentPosition, futurePosition)) {
              return Cesium.Quaternion.IDENTITY;
            }

            // 진행 방향과 위 방향으로 회전 계산
            const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(currentPosition);

            // 기본 회전 계산
            const baseRotation = Cesium.Transforms.headingPitchRollQuaternion(currentPosition, new Cesium.HeadingPitchRoll(0, 0, 0));

            // 사용자 회전 적용
            const userRotation = Cesium.Quaternion.fromHeadingPitchRoll(
              new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(rotation.yaw), Cesium.Math.toRadians(rotation.pitch), Cesium.Math.toRadians(rotation.roll))
            );

            // 회전 결합
            return Cesium.Quaternion.multiply(baseRotation, userRotation, new Cesium.Quaternion());
          }, false),
        });

        // 참조 저장
        issEntityRef.current = issEntity;

        // ISS 기준 XYZ 축 추가
        const axisScale = 100000; // 축 길이 (미터 단위)

        // X축 (빨간색)
        if (!cesiumViewer.current.entities.getById("ISS_X_AXIS")) {
          cesiumViewer.current.entities.add({
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
        if (!cesiumViewer.current.entities.getById("ISS_Y_AXIS")) {
          cesiumViewer.current.entities.add({
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
        if (!cesiumViewer.current.entities.getById("ISS_Z_AXIS")) {
          cesiumViewer.current.entities.add({
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
      }
    } catch (error) {
      console.error("ISS 엔티티 생성 중 오류 발생:", error);

      // 심각한 오류 발생 시 ISS 관련 엔티티만 제거 및 로그 출력
      try {
        if (cesiumViewer.current) {
          // 전체 엔티티 제거가 아닌 ISS 관련 엔티티만 제거
          const allEntities = [...cesiumViewer.current.entities.values];
          for (let i = 0; i < allEntities.length; i++) {
            const entity = allEntities[i];
            if (entity.id && String(entity.id).includes("ISS")) {
              cesiumViewer.current.entities.remove(entity);
            }
          }
          console.log("ISS 관련 엔티티가 모두 제거되었습니다. 다시 시도하세요.");
        }
      } catch (cleanupError) {
        console.error("엔티티 정리 중 오류:", cleanupError);
        alert("엔티티 처리 중 오류가 발생했습니다. 페이지를 새로고침 하세요.");
      }
    }
  }, [Cesium, issPositions, rotation]);

  // 지상국 및 통신 범위 추가 함수 수정
  const addGroundStations = React.useCallback(() => {
    if (!cesiumViewer.current) return;

    groundStations.forEach((station) => {
      // 지상국 위치 계산 (고도 포함)
      const stationHeight = station.height || 0;
      const stationPosition = Cesium.Cartesian3.fromDegrees(station.longitude, station.latitude, stationHeight);

      // 지상국 위치 마커는 그대로 유지
      cesiumViewer.current?.entities.add({
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

      cesiumViewer.current?.entities.add({
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
  }, [groundStations]);

  React.useEffect(() => {
    if (cesiumViewer.current === null && cesiumContainerRef.current) {
      Cesium.Ion.defaultAccessToken = `${process.env.NEXT_PUBLIC_CESIUM_TOKEN}`;

      cesiumViewer.current = new Cesium.Viewer(cesiumContainerRef.current, {
        terrain: Cesium.Terrain.fromWorldTerrain(),
        baseLayerPicker: true,
        navigationHelpButton: false,
        homeButton: true,
        geocoder: true,
        animation: false,
        timeline: false,
        shadows: true,
        terrainShadows: Cesium.ShadowMode.ENABLED,
        sceneMode: Cesium.SceneMode.SCENE3D, // 초기 모드를 3D로 설정
        sceneModePicker: true, // 모드 변경 버튼 활성화
      });

      // 시계 설정 - ISS 움직임을 위한 설정
      cesiumViewer.current.clock.shouldAnimate = true;
      cesiumViewer.current.clock.multiplier = 1.0;
      cesiumViewer.current.scene.requestRender();

      // 클록 틱 이벤트 리스너 추가
      cesiumViewer.current.clock.onTick.addEventListener(() => {
        if (animating) {
          cesiumViewer.current?.scene.requestRender();
        }
      });

      // 모델 로드 준비 완료 로그
      console.log("Cesium 초기화 완료, 모델을 표시할 준비가 되었습니다.");

      // 모드 변경 시 카메라 재설정
      cesiumViewer.current.scene.morphComplete.addEventListener(() => {
        resetCamera();
      });

      cesiumViewer.current.scene.globe.enableLighting = true;
      cesiumViewer.current.scene.globe.shadows = Cesium.ShadowMode.ENABLED;

      cesiumViewer.current.clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK_MULTIPLIER;
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (isLoaded) return;
    initializeCesiumJs();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, isLoaded]);

  React.useEffect(() => {
    if (isLoaded && issPositions?.length) {
      drawISSOrbit();
    }
  }, [isLoaded, issPositions, drawISSOrbit]);

  // 지상국 추가 useEffect
  React.useEffect(() => {
    if (isLoaded) {
      addGroundStations();
    }
  }, [isLoaded, addGroundStations]);

  //NOTE: Examples of typing... See above on "import type"
  const entities: Entity[] = [];
  //NOTE: Example of a function that utilizes CesiumJs features
  const julianDate = dateToJulianDate(Cesium, new Date());

  // 회전 적용 함수 (위치 유지를 위한 별도 함수)
  const applyRotation = React.useCallback((newRotation: { yaw: number; pitch: number; roll: number }) => {
    // 현재 시간 저장
    if (cesiumViewer.current) {
      const currentTime = cesiumViewer.current.clock.currentTime;

      // 회전 상태 업데이트
      setRotation(newRotation);

      // 시간을 유지하여 위치 초기화 방지
      // 약간의 지연을 통해 시간 설정이 안정적으로 적용되도록 함
      setTimeout(() => {
        if (cesiumViewer.current && Cesium.JulianDate.lessThan(currentTime, cesiumViewer.current.clock.stopTime)) {
          cesiumViewer.current.clock.currentTime = currentTime;
          cesiumViewer.current.scene.requestRender();
        }
      }, 10);
    } else {
      setRotation(newRotation);
    }
  }, []);

  // Yaw 컨트롤 핸들러
  const handleYawChange = (delta: number) => {
    applyRotation({
      ...rotation,
      yaw: rotation.yaw + delta,
    });
  };

  // Pitch 컨트롤 핸들러
  const handlePitchChange = (delta: number) => {
    applyRotation({
      ...rotation,
      pitch: rotation.pitch + delta,
    });
  };

  // Roll 컨트롤 핸들러
  const handleRollChange = (delta: number) => {
    applyRotation({
      ...rotation,
      roll: rotation.roll + delta,
    });
  };

  // 버튼 컨테이너 스타일 추가
  const buttonContainerStyle: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    right: "20px",
    transform: "translateY(-50%)",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    zIndex: 1000,
  };

  // 회전 컨트롤 스타일
  const rotationControlStyle: React.CSSProperties = {
    position: "absolute",
    bottom: "20px",
    right: "20px",
    transform: "none",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    zIndex: 1000,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: "10px",
    borderRadius: "8px",
    color: "white",
    width: "360px",
  };

  // 회전 버튼 행 스타일
  const rotationRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  };

  // 공통 버튼 스타일 수정
  const buttonStyle: React.CSSProperties = {
    width: "40px",
    height: "40px",
    padding: "0",
    backgroundColor: "rgba(48, 48, 48, 0.8)",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  // 회전 버튼 스타일
  const rotateButtonStyle: React.CSSProperties = {
    width: "40px",
    height: "30px",
    padding: "0",
    backgroundColor: "rgba(48, 48, 48, 0.8)",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
  };

  // 카메라 이동 함수 추가
  const flyToISS = React.useCallback(() => {
    if (!cesiumViewer.current) return;

    const issEntity = cesiumViewer.current.entities.getById("ISS");
    if (!issEntity) return;

    const position = issEntity.position?.getValue(cesiumViewer.current.clock.currentTime);
    if (!position) return;

    // 위성을 화면 중앙에 위치시키고 위에서 바라보기
    cesiumViewer.current.zoomTo(
      issEntity,
      new Cesium.HeadingPitchRange(
        0, // heading
        Cesium.Math.toRadians(-90), // pitch: 위에서 아래로 보기
        2000000 // 거리 (미터)
      )
    );
  }, [Cesium]);

  // 한반도로 이동하는 함수 수정
  const flyToKorea = React.useCallback(() => {
    if (!cesiumViewer.current) return;

    // 한반도 중심점으로 이동
    cesiumViewer.current.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(128, 36, 10000000), // 고도를 더 높임
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-90), // 완전히 수직으로 내려다보기
        roll: 0,
      },
      duration: 2,
    });

    // 카메라 제한 설정
    cesiumViewer.current.scene.screenSpaceCameraController.minimumZoomDistance = 3000000; // 최소 줌 거리 증가
    cesiumViewer.current.scene.screenSpaceCameraController.maximumZoomDistance = 20000000; // 최대 줌 거리 증가

    // 화면 중앙에 오도록 추가 설정
    cesiumViewer.current.scene.camera.constrainedAxis = Cesium.Cartesian3.UNIT_Z;
  }, [Cesium]);

  // 태양 기준 시점으로 이동하는 함수 추가
  const flyToSunView = React.useCallback(() => {
    if (!cesiumViewer.current) return;

    const issEntity = cesiumViewer.current.entities.getById("ISS");
    if (!issEntity) return;

    const position = issEntity.position?.getValue(cesiumViewer.current.clock.currentTime);
    if (!position) return;

    // 현재 시간의 태양 위치 계산
    const sunPosition = Cesium.Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(cesiumViewer.current.clock.currentTime);

    cesiumViewer.current.camera.flyTo({
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
  }, [Cesium]);

  // 애니메이션 제어 스타일
  const animationControlStyle: React.CSSProperties = {
    position: "absolute",
    bottom: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    zIndex: 1000,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: "10px",
    borderRadius: "8px",
    color: "white",
    width: "300px",
  };

  // 애니메이션 속도 변경 시 시계 업데이트
  React.useEffect(() => {
    if (cesiumViewer.current) {
      cesiumViewer.current.clock.multiplier = animationSpeed;
    }
  }, [animationSpeed]);

  // animating 상태 변경 시 시계 설정 업데이트
  React.useEffect(() => {
    if (cesiumViewer.current) {
      cesiumViewer.current.clock.shouldAnimate = animating;
      cesiumViewer.current.scene.requestRender();
    }
  }, [animating]);

  return (
    <>
      <div style={buttonContainerStyle}>
        <button onClick={flyToISS} style={buttonStyle} title="Go to ISS">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 2L9 4V7L6 9L3 9.5V12L6 14L9 16L12 19L15 16L18 14L21 12V9.5L18 9L15 7V4L12 2Z"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="2" stroke="white" strokeWidth="1.5" />
          </svg>
        </button>
        <button onClick={flyToKorea} style={buttonStyle} title="Go to Korea">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
              stroke="white"
              strokeWidth="1.5"
            />
            <path d="M2 12H22" stroke="white" strokeWidth="1.5" />
            <path d="M12 2C14.5013 4.73835 15.9228 8.29203 16 12C15.9228 15.708 14.5013 19.2616 12 22" stroke="white" strokeWidth="1.5" />
          </svg>
        </button>
        <button onClick={flyToSunView} style={buttonStyle} title="Sun View">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="4" stroke="white" strokeWidth="1.5" />
            <path
              d="M12 2V4M12 20V22M2 12H4M20 12H22M4.93 4.93L6.34 6.34M17.66 17.66L19.07 19.07M4.93 19.07L6.34 17.66M17.66 6.34L19.07 4.93"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* ISS 애니메이션 제어 추가 */}
      <div style={animationControlStyle}>
        <div style={{ textAlign: "center", marginBottom: "5px", fontWeight: "bold" }}>ISS 이동 제어</div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={() => setAnimating(!animating)}
            style={{
              ...rotateButtonStyle,
              width: "100px",
              backgroundColor: animating ? "rgba(0, 180, 0, 0.8)" : "rgba(180, 0, 0, 0.8)",
            }}
          >
            {animating ? "정지" : "이동"}
          </button>

          <button
            onClick={() => {
              if (cesiumViewer.current) {
                // 시계를 시작 시간으로 리셋
                cesiumViewer.current.clock.currentTime = cesiumViewer.current.clock.startTime;
                startTimeRef.current = new Date();
                elapsedTimeRef.current = 0;
                currentPositionIndexRef.current = 0;
              }
            }}
            style={{ ...rotateButtonStyle, width: "100px" }}
          >
            초기화
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ width: "50px" }}>속도:</span>
          <input type="range" min="1" max="100" value={animationSpeed} onChange={(e) => setAnimationSpeed(parseInt(e.target.value))} style={{ flex: 1 }} />
          <span style={{ width: "30px", textAlign: "right" }}>{animationSpeed}x</span>
        </div>
      </div>

      {/* ISS 회전 컨트롤 추가 */}
      <div style={rotationControlStyle}>
        <div style={{ textAlign: "center", marginBottom: "5px", fontWeight: "bold" }}>ISS 회전 컨트롤</div>

        {/* Yaw 컨트롤 */}
        <div style={rotationRowStyle}>
          <span style={{ width: "50px" }}>Yaw:</span>
          <button onClick={() => handleYawChange(-5)} style={rotateButtonStyle}>
            -5°
          </button>
          <button onClick={() => handleYawChange(-1)} style={rotateButtonStyle}>
            -1°
          </button>
          <span style={{ width: "40px", textAlign: "center" }}>{rotation.yaw}°</span>
          <button onClick={() => handleYawChange(1)} style={rotateButtonStyle}>
            +1°
          </button>
          <button onClick={() => handleYawChange(5)} style={rotateButtonStyle}>
            +5°
          </button>
        </div>

        {/* Pitch 컨트롤 */}
        <div style={rotationRowStyle}>
          <span style={{ width: "50px" }}>Pitch:</span>
          <button onClick={() => handlePitchChange(-5)} style={rotateButtonStyle}>
            -5°
          </button>
          <button onClick={() => handlePitchChange(-1)} style={rotateButtonStyle}>
            -1°
          </button>
          <span style={{ width: "40px", textAlign: "center" }}>{rotation.pitch}°</span>
          <button onClick={() => handlePitchChange(1)} style={rotateButtonStyle}>
            +1°
          </button>
          <button onClick={() => handlePitchChange(5)} style={rotateButtonStyle}>
            +5°
          </button>
        </div>

        {/* Roll 컨트롤 */}
        <div style={rotationRowStyle}>
          <span style={{ width: "50px" }}>Roll:</span>
          <button onClick={() => handleRollChange(-5)} style={rotateButtonStyle}>
            -5°
          </button>
          <button onClick={() => handleRollChange(-1)} style={rotateButtonStyle}>
            -1°
          </button>
          <span style={{ width: "40px", textAlign: "center" }}>{rotation.roll}°</span>
          <button onClick={() => handleRollChange(1)} style={rotateButtonStyle}>
            +1°
          </button>
          <button onClick={() => handleRollChange(5)} style={rotateButtonStyle}>
            +5°
          </button>
        </div>

        {/* 회전 초기화 버튼 */}
        <button onClick={() => setRotation({ yaw: 0, pitch: 0, roll: 0 })} style={{ ...rotateButtonStyle, width: "100%", marginTop: "5px" }}>
          초기화
        </button>
      </div>

      <div ref={cesiumContainerRef} id="cesium-container" style={{ height: "100vh", width: "100vw" }} />
    </>
  );
};

export default CesiumComponent;
