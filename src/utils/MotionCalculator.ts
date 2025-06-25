import { Gps } from "../domain/vo/Gps";
import { GpsWithTime } from "../domain/vo/GpsWithTime";

/**
 * MotionCalculator 클래스는 두 GPS 지점 간의 거리, 속도, 방향을 계산하는 유틸리티 메서드를 제공합니다.
 * 이 클래스는 순수 함수로 구성되며, 외부 상태에 의존하지 않습니다.
 */
export class MotionCalculator {
  // --- 공통 상수 정의 ---
  private static readonly EARTH_RADIUS = 6_371_000.0; // 지구 반지름 (미터)

  // --- 속도 계산 관련 상수 ---
  private static readonly MPS_TO_KMH_SCALE = 3.6; // 초속(m/s)을 시속(km/h)으로 변환하는 스케일
  private static readonly EXPECTED_MAX_SPEED_KMH = 200.0; // 속도 스케일링을 위한 예상 최대 속도 (km/h)

  // --- 클램핑 및 스케일링 범위 상수 ---
  private static readonly DISTANCE_MIN = 0;
  private static readonly DISTANCE_MAX = 9_999_999; // 최대 거리 (미터)
  private static readonly SPEED_MIN = 0;
  private static readonly SPEED_MAX = 255; // 최대 속도 (스케일링 후)
  private static readonly DIRECTION_MIN = 0;
  private static readonly DIRECTION_MAX = 360; // 최대 방향 (도)

  /**
   * Haversine 공식을 사용하여 지구 표면상 두 GPS 지점 간의 최단 거리를 계산합니다.
   *
   * @param previous 이전 GPS 지점 (위도, 경도)
   * @param current 현재 GPS 지점 (위도, 경도)
   * @return 두 지점 간의 이동 거리 (미터 단위, 0 ~ 9,999,999 범위로 제한)
   */
  public static calculateDistance(previous: Gps, current: Gps): number {
    // 동일 지점인 경우 거리 0
    if (
      previous.longitude === current.longitude &&
      previous.latitude === current.latitude
    ) {
      return MotionCalculator.DISTANCE_MIN;
    }

    const lat1 = previous.latitude;
    const lon1 = previous.longitude;
    const lat2 = current.latitude;
    const lon2 = current.longitude;

    const toRadians = (deg: number) => deg * (Math.PI / 180);

    const latDistance = toRadians(lat2 - lat1);
    const lonDistance = toRadians(lon2 - lon1);

    const a =
      Math.sin(latDistance / 2) * Math.sin(latDistance / 2) +
      Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(lonDistance / 2) *
        Math.sin(lonDistance / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = MotionCalculator.EARTH_RADIUS * c;
    // 결과 클램핑
    return Math.max(
      MotionCalculator.DISTANCE_MIN,
      Math.min(Math.floor(distance), MotionCalculator.DISTANCE_MAX)
    );
  }

  /**
   * 이동 거리와 시간 차이를 기반으로 속도를 계산하고, 이를 0 ~ 255 범위로 스케일링합니다.
   * 결과는 km/h 단위로 해석됩니다.
   *
   * @param previous 이전 GPS 정보 (위치 및 시간)
   * @param current 현재 GPS 정보 (위치 및 시간)
   * @return 스케일된 속도 (정수형, 0 ~ 255 범위)
   */
  public static calculateSpeed(
    previous: GpsWithTime,
    current: GpsWithTime
  ): number {
    const distanceMeters = MotionCalculator.calculateDistance(
      new Gps(previous.latitude, previous.longitude),
      new Gps(current.latitude, current.longitude)
    );

    // 시간 차이 계산 (밀리초)
    const timeMillis =
      current.intervalAt.getTime() - previous.intervalAt.getTime();
    if (timeMillis <= 0) {
      return MotionCalculator.SPEED_MIN; // 시간 차이가 없거나 음수면 속도는 0
    }

    const speedMps = distanceMeters / (timeMillis / 1000.0);
    const speedKmh = speedMps * MotionCalculator.MPS_TO_KMH_SCALE;

    // 속도 스케일링
    const scaledSpeed =
      (speedKmh / MotionCalculator.EXPECTED_MAX_SPEED_KMH) *
      MotionCalculator.SPEED_MAX;

    // 결과 클램핑
    return Math.max(
      MotionCalculator.SPEED_MIN,
      Math.min(Math.floor(scaledSpeed), MotionCalculator.SPEED_MAX)
    );
  }

  /**
   * 방위각(북쪽을 기준으로 시계 방향으로 측정된 각도) 계산 공식을 사용하여 두 지점 간의 방향을 계산합니다.
   *
   * @param previous 이전 GPS 지점 (위도, 경도)
   * @param current 현재 GPS 지점 (위도, 경도)
   * @return 방위각 (도, 0 ~ 360 범위)
   */
  public static calculateDirection(previous: Gps, current: Gps): number {
    const lat1 = previous.latitude;
    const lon1 = previous.longitude;
    const lat2 = current.latitude;
    const lon2 = current.longitude;

    // 동일 지점인 경우 방향 0
    if (lat1 === lat2 && lon1 === lon2) {
      return MotionCalculator.DIRECTION_MIN;
    }

    const toRadians = (deg: number) => deg * (Math.PI / 180);
    const toDegrees = (rad: number) => rad * (180 / Math.PI);

    const radLat1 = toRadians(lat1);
    const radLat2 = toRadians(lat2);
    const deltaLon = toRadians(lon2 - lon1);

    const y = Math.sin(deltaLon) * Math.cos(radLat2);
    const x =
      Math.cos(radLat1) * Math.sin(radLat2) -
      Math.sin(radLat1) * Math.cos(radLat2) * Math.cos(deltaLon);

    let bearing = toDegrees(Math.atan2(y, x));
    // 방위각을 0-360 범위로 정규화
    bearing =
      (bearing + MotionCalculator.DIRECTION_MAX) %
      MotionCalculator.DIRECTION_MAX;

    // 결과 클램핑
    return Math.max(
      MotionCalculator.DIRECTION_MIN,
      Math.min(Math.floor(bearing), MotionCalculator.DIRECTION_MAX)
    );
  }
}
