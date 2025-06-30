import { GpsInformation } from "@/domain/vo/GpsInformation";
import { Gps } from "@/domain/vo/Gps";
import { GpsWithTime } from "@/domain/vo/GpsWithTime";

import { IGpsDataGenerator } from "./IGpsDataGenerator";
import { MotionCalculator } from "./MotionCalculator";

import { GpxTrackPoint } from "@/utils/GpxParser";

/**
 * GpsDataGenerator 클래스는 GPX 파일 경로를 따라 가상의 차량 GPS 데이터를 생성합니다.
 * IGpsDataGenerator 인터페이스를 구현하여 데이터 생성 로직을 캡슐화합니다.
 */
export class GpsDataGenerator implements IGpsDataGenerator {
  // --- 상수 정의 ---
  private static readonly MIN_GPX_POINTS = 2;
  private static readonly ASSUMED_SPEED_MPS = 50; // 약 180km/h
  private static readonly POSITION_NOISE_MAGNITUDE = 0.0001; // 작은 위치 노이즈

  private mdn: string;
  private gpxTrackPoints: GpxTrackPoint[];
  private emulatorIntervalMs: number;
  private random: () => number;

  private currentTrackPointIndex: number;
  private nextTrackPointIndex: number;
  private step: number;
  private totalStepsBetweenPoints: number;

  private currentLat: number;
  private currentLon: number;
  private previousGpsWithTime: GpsWithTime | null = null;
  private totalDistance: number = 0;

  /**
   * GpsDataGenerator의 생성자입니다.
   * @param mdn 이 인스턴스가 담당할 차량의 MDN
   * @param gpxTrackPoints 시뮬레이션에 사용할 GPX 경로 트랙 포인트 배열
   * @param emulatorIntervalMs GPS 데이터 생성 주기 (밀리초)
   */
  constructor(
    mdn: string,
    gpxTrackPoints: GpxTrackPoint[],
    emulatorIntervalMs: number
  ) {
    this.mdn = mdn;
    this.gpxTrackPoints = gpxTrackPoints;
    this.emulatorIntervalMs = emulatorIntervalMs;
    this.random = Math.random;

    this.currentTrackPointIndex = 0;
    this.nextTrackPointIndex = 1;
    this.step = 0;
    this.totalStepsBetweenPoints = 0; // 초기값 설정

    if (gpxTrackPoints.length < GpsDataGenerator.MIN_GPX_POINTS) {
      throw new Error(
        `[${mdn}] GPX 트랙 포인트 배열은 최소 ${GpsDataGenerator.MIN_GPX_POINTS}개 이상이어야 합니다.`
      );
    }
    // 초기 위치는 첫 번째 GPX 포인트로 설정
    this.currentLat = gpxTrackPoints[0].lat;
    this.currentLon = gpxTrackPoints[0].lon;

    // 첫 번째 구간에 대한 스텝 계산
    this.calculateStepsBetweenPoints();
  }

  /**
   * 현재 시점의 총 주행 거리계(누적 이동 거리) 값을 반환합니다.
   * @returns 현재까지의 총 주행 거리 (미터)
   */
  public getTotalDistance(): number {
    return this.totalDistance;
  }

  /**
   * 현재 GPS 정보를 반환합니다. (주로 'OFF' 요청 시 사용)
   * 이 메서드는 GpsInformation DTO를 반환하며, 정지 상태를 가정합니다.
   * @returns 현재 위도, 경도, 누적 주행 거리로 구성된 GpsInformation 객체
   */
  public getCurrentGpsInfo(): GpsInformation {
    return new GpsInformation(
      this.mdn,
      this.currentLat,
      this.currentLon,
      0, // 정지 상태 가정 (속도)
      0, // 정지 상태 가정 (방향)
      this.totalDistance,
      new Date()
    );
  }

  /**
   * 현재 포인트와 다음 포인트 사이의 보간 단계를 계산합니다.
   * GPX에 시간 정보가 없으면 거리 기반으로 단계를 추정합니다.
   */
  private calculateStepsBetweenPoints(): void {
    if (this.currentTrackPointIndex >= this.gpxTrackPoints.length - 1) {
      this.totalStepsBetweenPoints = 1;
      return;
    }

    const currentPoint = this.gpxTrackPoints[this.currentTrackPointIndex];
    const nextPoint = this.gpxTrackPoints[this.nextTrackPointIndex];

    // GPX 포인트에 시간 정보가 있다면 시간 차이를 기준으로 스텝 계산
    if (currentPoint.time && nextPoint.time) {
      const timeDiffMs = nextPoint.time.getTime() - currentPoint.time.getTime();

      this.totalStepsBetweenPoints = Math.max(
        1,
        Math.floor(timeDiffMs / this.emulatorIntervalMs)
      );
    } else {
      // 시간 정보가 없다면 거리와 가상 속도(ASSUMED_SPEED_MPS)를 기준으로 스텝 계산
      const distance = MotionCalculator.calculateDistance(
        this.createGpsFromGpx(currentPoint),
        this.createGpsFromGpx(nextPoint)
      );

      const estimatedTimeMs =
        (distance / GpsDataGenerator.ASSUMED_SPEED_MPS) * 1000;

      this.totalStepsBetweenPoints = Math.max(
        1,
        Math.round(estimatedTimeMs / this.emulatorIntervalMs)
      );
    }
    this.step = 0;
  }

  /**
   * GPX 경로를 따라 다음 시점의 GPS 데이터를 생성하고 반환합니다.
   * @returns 다음 시점의 GpsInformation 객체, 경로의 끝에 도달하면 null을 반환합니다.
   */
  public generateNextGpsData(): GpsInformation | null {
    this.advanceToNextStepOrSegment();

    if (this.isEndOfPath()) {
      return null;
    }

    const currentPoint = this.gpxTrackPoints[this.currentTrackPointIndex];
    const timestamp = new Date();

    // 다음 GPX 포인트가 아직 남아있다면 (일반적인 보간 상황)
    if (this.nextTrackPointIndex < this.gpxTrackPoints.length) {
      const nextPoint = this.gpxTrackPoints[this.nextTrackPointIndex];
      this.interpolateAndAddNoise(currentPoint, nextPoint);
    } else {
      this.currentLat +=
        (this.random() - 0.5) * GpsDataGenerator.POSITION_NOISE_MAGNITUDE;
      this.currentLon +=
        (this.random() - 0.5) * GpsDataGenerator.POSITION_NOISE_MAGNITUDE;
    }

    const { speed, direction, segmentDistance } =
      this.calculateMotionMetrics(timestamp);

    this.totalDistance += segmentDistance;

    const newGpsInfo: GpsInformation = new GpsInformation(
      this.mdn,
      this.currentLat,
      this.currentLon,
      speed,
      direction,
      this.totalDistance,
      timestamp
    );

    this.previousGpsWithTime = new GpsWithTime(
      this.currentLat,
      this.currentLon,
      timestamp
    );

    return newGpsInfo;
  }

  /**
   * GPX 경로의 끝에 도달했는지 확인합니다.
   * `nextTrackPointIndex`가 모든 `trkpt`를 소진했는지 (배열 길이와 같거나 큰지)
   * 그리고 현재 구간(마지막 `trkpt` 지점)의 스텝까지 모두 완료되었는지 확인합니다.
   * @returns 경로의 끝에 도달했으면 true, 아니면 false
   */
  public isEndOfPath(): boolean {
    return (
      this.nextTrackPointIndex >= this.gpxTrackPoints.length &&
      this.step >= this.totalStepsBetweenPoints
    );
  }

  // --- 내부 헬퍼 메서드 ---

  /**
   * GpxTrackPoint에서 Gps 객체를 생성합니다.
   * @param point 변환할 GpxTrackPoint
   * @returns 생성된 Gps 객체
   */
  private createGpsFromGpx(point: GpxTrackPoint): Gps {
    return new Gps(point.lat, point.lon);
  }

  /**
   * 현재 위치를 보간하고 약간의 노이즈를 추가합니다.
   * @param currentPoint 현재 구간의 시작 GPX 트랙 포인트
   * @param nextPoint 현재 구간의 다음 GPX 트랙 포인트
   */
  private interpolateAndAddNoise(
    currentPoint: GpxTrackPoint,
    nextPoint: GpxTrackPoint
  ): void {
    // totalStepsBetweenPoints가 0인 경우는 없도록 calculateStepsBetweenPoints에서 최소 1을 보장함
    const progress = this.step / this.totalStepsBetweenPoints;

    this.currentLat =
      currentPoint.lat + (nextPoint.lat - currentPoint.lat) * progress;
    this.currentLon =
      currentPoint.lon + (nextPoint.lon - currentPoint.lon) * progress;

    // 노이즈 추가
    this.currentLat +=
      (this.random() - 0.5) * GpsDataGenerator.POSITION_NOISE_MAGNITUDE;
    this.currentLon +=
      (this.random() - 0.5) * GpsDataGenerator.POSITION_NOISE_MAGNITUDE;
  }

  /**
   * 이전 GpsWithTime과 현재 위치를 기반으로 속도, 방향, 구간 거리를 계산합니다.
   * @param timestamp 현재 데이터 생성 시간
   * @returns 계산된 속도, 방향, 구간 거리 객체
   */
  private calculateMotionMetrics(timestamp: Date): {
    speed: number;
    direction: number;
    segmentDistance: number;
  } {
    let speed: number = 0;
    let direction: number = 0;
    let segmentDistance: number = 0;

    if (this.previousGpsWithTime) {
      const currentGpsWithTime = new GpsWithTime(
        this.currentLat,
        this.currentLon,
        timestamp
      );

      segmentDistance = MotionCalculator.calculateDistance(
        new Gps(
          this.previousGpsWithTime.latitude,
          this.previousGpsWithTime.longitude
        ),
        new Gps(currentGpsWithTime.latitude, currentGpsWithTime.longitude)
      );
      speed = MotionCalculator.calculateSpeed(
        this.previousGpsWithTime,
        currentGpsWithTime
      );
      direction = MotionCalculator.calculateDirection(
        new Gps(
          this.previousGpsWithTime.latitude,
          this.previousGpsWithTime.longitude
        ),
        new Gps(currentGpsWithTime.latitude, currentGpsWithTime.longitude)
      );
    }
    return { speed, direction, segmentDistance };
  }

  /**
   * 현재 구간의 진행 단계를 증가시키고, 필요 시 다음 GPX 트랙 포인트로 이동합니다.
   * 이 메서드는 데이터를 생성하기 전에 호출되어야 합니다.
   */
  private advanceToNextStepOrSegment(): void {
    this.step++;

    if (this.step >= this.totalStepsBetweenPoints) {
      if (this.nextTrackPointIndex >= this.gpxTrackPoints.length) {
        return;
      }

      this.currentTrackPointIndex = this.nextTrackPointIndex;
      this.nextTrackPointIndex++;
      this.step = 0;

      if (this.nextTrackPointIndex < this.gpxTrackPoints.length) {
        this.calculateStepsBetweenPoints();
      } else {
        this.totalStepsBetweenPoints = 1;
      }
    }
  }
}
