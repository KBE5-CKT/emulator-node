import { IGpsDataGenerator } from "./interfaces/IGpsDataGenerator";
import { GpsInformation } from "./domain/vo/GpsInformation";
import { MotionCalculator } from "./utils/MotionCalculator";
import { GpxTrackPoint } from "./utils/GpxParser";

/**
 * GpsDataGenerator 클래스는 GPX 파일에 정의된 경로를 따라 가상의 차량 GPS 데이터를 생성합니다.
 * 이 클래스는 IGpsDataGenerator 인터페이스를 구현하여, GPS 데이터 생성 로직을 캡슐화하고 일관된 API를 제공합니다.
 */
export class GpsDataGenerator implements IGpsDataGenerator {
  // --- 클래스 속성 (Private Fields) ---
  private mdn: string; // 이 에뮬레이터 인스턴스가 담당하는 차량의 MDN (Mobile Directory Number)
  private gpxTrackPoints: GpxTrackPoint[]; // GPX 파일에서 로드된 전체 경로 트랙 포인트 배열
  private emulatorIntervalMs: number; // GPS 데이터를 생성할 주기 (밀리초 단위)
  private random: () => number; // Math.random 함수를 참조하여 위치에 약간의 노이즈를 추가하는 데 사용

  private currentTrackPointIndex: number; // 현재 시뮬레이션 중인 GPX 트랙 포인트의 인덱스
  private nextTrackPointIndex: number; // currentTrackPointIndex 다음의 GPX 트랙 포인트 인덱스 (보간 계산에 사용)
  private step: number; // 현재 구간 (current ~ next 포인트 사이)에서 진행된 보간 단계
  private totalStepsBetweenPoints: number; // 현재 구간을 보간하기 위해 필요한 총 단계 수

  private currentLat: number; // 현재 시뮬레이션 중인 차량의 위도
  private currentLon: number; // 현재 시뮬레이션 중인 차량의 경도
  private previousGpsInfo: GpsInformation | null = null; // 이전 호출에서 생성된 GPS 정보 (속도, 방향, 이동 거리 계산에 사용)
  private totalDistance: number = 0; // 시뮬레이션 시작부터 누적된 총 주행 거리 (미터 단위)

  /**
   * GpsDataGenerator의 생성자입니다.
   * @param mdn 이 인스턴스가 담당할 차량의 MDN (차량 식별자)
   * @param gpxTrackPoints 시뮬레이션에 사용할 GPX 경로 트랙 포인트 배열
   * @param emulatorIntervalMs GPS 데이터를 생성할 주기 (밀리초)
   */
  constructor(
    mdn: string,
    gpxTrackPoints: GpxTrackPoint[],
    emulatorIntervalMs: number
  ) {
    this.mdn = mdn;
    this.gpxTrackPoints = gpxTrackPoints;
    this.emulatorIntervalMs = emulatorIntervalMs;

    this.random = Math.random; // Math.random 함수를 할당하여 필요 시 오버라이드 가능성을 열어둠

    // 초기 인덱스 설정
    this.currentTrackPointIndex = 0;
    this.nextTrackPointIndex = 1;
    this.step = 0;
    this.totalStepsBetweenPoints = 0; // 초기값은 0으로 설정, calculateStepsBetweenPoints에서 계산됨

    // GPX 트랙 포인트 배열의 유효성 검사 (최소 2개 이상이어야 경로 보간 가능)
    if (gpxTrackPoints.length < 2) {
      throw new Error(
        `[${mdn}] GPX 트랙 포인트 배열은 최소 2개 이상이어야 합니다.`
      );
    }
    // 시작 위치를 첫 번째 GPX 트랙 포인트로 설정
    this.currentLat = gpxTrackPoints[0].lat;
    this.currentLon = gpxTrackPoints[0].lon;

    // 첫 번째 구간에 대한 보간 단계 계산
    this.calculateStepsBetweenPoints();
  }

  /**
   * 현재 시점의 총 주행 거리계(누적 이동 거리) 값을 반환합니다.
   * 이 값은 주로 'OFF' 요청과 같이 최종 주행 거리가 필요할 때 사용됩니다.
   * @returns 현재까지의 총 주행 거리 (미터)
   */
  public getTotalDistance(): number {
    return this.totalDistance;
  }

  /**
   * 현재 GPS 정보를 반환합니다. (주로 OFF 요청 시 사용)
   * 이 메서드는 차량이 정지 상태라고 가정하고 현재 위치와 누적된 총 주행 거리를 제공합니다.
   *
   * @returns 현재 위도, 경도, 누적 주행 거리로 구성된 GpsInformation 객체
   */
  public getCurrentGpsInfo(): GpsInformation {
    return new GpsInformation(
      this.mdn, // 차량 ID
      this.currentLat, // 현재 위도
      this.currentLon, // 현재 경도
      0, // speed: 정지 상태이므로 0
      0, // direction: 정지 상태이므로 0
      this.totalDistance, // totalDistance: 시뮬레이션 시작부터 누적된 총 주행 거리
      new Date() // intervalAt: 현재 시간
    );
  }

  /**
   * 현재 포인트와 다음 포인트 사이의 보간 단계를 계산합니다.
   * GPX 포인트에 시간 정보가 있으면 이를 활용하고, 없으면 거리 기반으로 계산합니다.
   */
  private calculateStepsBetweenPoints(): void {
    // 경로의 끝에 도달했거나 마지막 포인트에 있는 경우, 더 이상 보간할 구간이 없으므로 단계를 1로 설정하고 종료.
    if (this.currentTrackPointIndex >= this.gpxTrackPoints.length - 1) {
      this.totalStepsBetweenPoints = 1;
      return;
    }

    const currentPoint = this.gpxTrackPoints[this.currentTrackPointIndex];
    const nextPoint = this.gpxTrackPoints[this.nextTrackPointIndex];

    // GPX 포인트에 시간(time) 정보가 있다면, 시간 차이를 기준으로 보간 단계를 계산
    if (currentPoint.time && nextPoint.time) {
      const timeDiffMs = nextPoint.time.getTime() - currentPoint.time.getTime();
      // 시간 차이를 에뮬레이터 간격으로 나누어 총 보간 단계를 결정. 최소 1단계는 보장
      this.totalStepsBetweenPoints = Math.max(
        1,
        Math.floor(timeDiffMs / this.emulatorIntervalMs)
      );
    } else {
      // GPX 포인트에 시간 정보가 없다면, 두 포인트 간의 거리를 기준으로 보간 단계를 계산
      // MotionCalculator를 사용하기 위해 임시 GpsInformation 객체 생성 (속도, 방향, 거리 등은 중요하지 않음)
      const mockGpsInfo1 = new GpsInformation(
        this.mdn,
        currentPoint.lat,
        currentPoint.lon,
        0,
        0,
        0,
        new Date()
      );
      const mockGpsInfo2 = new GpsInformation(
        this.mdn,
        nextPoint.lat,
        nextPoint.lon,
        0,
        0,
        0,
        new Date()
      );
      const distance = MotionCalculator.calculateDistance(
        mockGpsInfo1,
        mockGpsInfo2
      );
      // 대략 10미터당 1단계로 가정하여 총 보간 단계를 계산. 최소 1단계는 보장
      this.totalStepsBetweenPoints = Math.max(1, Math.floor(distance / 10));
    }
    this.step = 0; // 새로운 구간이 시작되었으므로 현재 단계를 0으로 초기화
    // console.log(`[${this.mdn}] 새 구간 (${this.currentTrackPointIndex} -> ${this.nextTrackPointIndex}): 총 ${this.totalStepsBetweenPoints} 단계`);
  }

  /**
   * GPX 경로를 따라 다음 시점의 GPS 데이터를 생성하고 반환합니다.
   * 이 메서드는 에뮬레이터의 주기적인 실행(interval)마다 호출됩니다.
   * @returns 다음 시점의 GpsInformation 객체. 경로의 끝에 도달하면 null을 반환.
   */
  public generateNextGpsData(): GpsInformation | null {
    // --- 경로 종료 조건 확인 ---
    // 현재 인덱스가 마지막 포인트에 도달했고, 현재 구간의 모든 단계를 완료했다면 경로 종료
    if (
      this.currentTrackPointIndex >= this.gpxTrackPoints.length - 1 &&
      this.step >= this.totalStepsBetweenPoints
    ) {
      // 경로의 끝에 도달했음을 알림
      return null;
    }

    // --- 현재 구간의 시작/끝 포인트 가져오기 ---
    const currentPoint = this.gpxTrackPoints[this.currentTrackPointIndex];
    const nextPoint = this.gpxTrackPoints[this.nextTrackPointIndex];

    // --- 보간 진행률 계산 ---
    const progress =
      this.totalStepsBetweenPoints > 0
        ? this.step / this.totalStepsBetweenPoints // 현재 단계 / 총 단계
        : 1; // 단일 단계 구간일 경우 진행률은 1 (즉시 다음 포인트로 이동)

    // --- 위도, 경도 보간 ---
    this.currentLat =
      currentPoint.lat + (nextPoint.lat - currentPoint.lat) * progress;
    this.currentLon =
      currentPoint.lon + (nextPoint.lon - currentPoint.lon) * progress;

    // 약간의 무작위 노이즈를 추가하여 좀 더 현실적인 움직임을 시뮬레이션
    this.currentLat += (this.random() - 0.5) * 0.0001; // -0.00005 ~ +0.00005 범위의 노이즈
    this.currentLon += (this.random() - 0.5) * 0.0001; // -0.00005 ~ +0.00005 범위의 노이즈

    const timestamp = new Date(); // 현재 GPS 데이터 생성 시간

    // GpsInformation 객체에 담을 속도, 방향, 이동 거리를 계산하기 위한 변수 선언
    let currentSpeed: number = 0;
    let currentDirection: number = 0;
    let segmentDistance: number = 0; // 이번 구간 (current interval)의 이동 거리

    // 이전 GPS 정보가 존재할 경우에만 속도, 방향, 이동 거리 계산
    if (this.previousGpsInfo) {
      // MotionCalculator가 계산을 위해 필요한 GpsInformation 객체를 임시로 생성
      // 이 임시 객체는 속도, 방향, totalDistance가 0이어도 계산에 영향을 주지 않습니다.
      const tempCurrentGpsInfo = new GpsInformation(
        this.mdn,
        this.currentLat,
        this.currentLon,
        0, // 임시 속도 (아직 계산 전)
        0, // 임시 방향 (아직 계산 전)
        0, // 임시 totalDistance (이번 구간의 값)
        timestamp
      );

      // 이전 위치와 현재 위치 간의 이동 거리 계산 (미터)
      segmentDistance = MotionCalculator.calculateDistance(
        this.previousGpsInfo,
        tempCurrentGpsInfo
      );
      // 이전 위치와 현재 위치 간의 속도 계산 (km/h 스케일)
      currentSpeed = MotionCalculator.calculateSpeed(
        this.previousGpsInfo,
        tempCurrentGpsInfo
      );
      // 이전 위치와 현재 위치 간의 방향(방위) 계산 (0-360도)
      currentDirection = MotionCalculator.calculateDirection(
        this.previousGpsInfo,
        tempCurrentGpsInfo
      );

      // GpsDataGenerator 내부의 총 주행 거리계(totalDistance)를 업데이트
      this.totalDistance += segmentDistance;
    }

    // --- 최종 GpsInformation 객체 생성 ---
    // 계산된 속도, 방향, 그리고 현재까지 누적된 총 주행 거리계 값을 GpsInformation 생성자에 전달
    const newGpsInfo: GpsInformation = new GpsInformation(
      this.mdn,
      this.currentLat,
      this.currentLon,
      currentSpeed, // 계산된 속도
      currentDirection, // 계산된 방향
      this.totalDistance, // 현재까지 누적된 총 주행 거리
      timestamp
    );

    // 현재 생성된 GPS 정보를 다음 번 계산을 위해 `previousGpsInfo`에 저장
    this.previousGpsInfo = newGpsInfo;

    // --- 구간 이동 및 다음 구간 계산 ---
    this.step++; // 현재 구간에서의 단계를 증가
    if (this.step >= this.totalStepsBetweenPoints) {
      // 현재 구간의 모든 단계를 완료했다면, 다음 GPX 트랙 포인트로 이동
      this.currentTrackPointIndex = this.nextTrackPointIndex;
      this.nextTrackPointIndex++;
      this.step = 0; // 새 구간이 시작되었으므로 단계 초기화
      // 전체 경로의 끝에 도달하지 않았다면, 다음 구간에 대한 보간 단계를 미리 계산
      if (this.currentTrackPointIndex < this.gpxTrackPoints.length - 1) {
        this.calculateStepsBetweenPoints();
      }
    }
    return newGpsInfo; // 새로 생성된 GPS 정보 객체 반환
  }

  /**
   * GPX 경로의 끝에 도달했는지 확인합니다.
   * @returns 경로의 끝에 도달했으면 true, 아직 남은 경로가 있으면 false
   */
  public isEndOfPath(): boolean {
    // 현재 인덱스가 마지막 포인트에 도달했고, 해당 구간의 모든 단계를 완료했다면 true 반환
    return (
      this.currentTrackPointIndex >= this.gpxTrackPoints.length - 1 &&
      this.step >= this.totalStepsBetweenPoints
    );
  }
}
