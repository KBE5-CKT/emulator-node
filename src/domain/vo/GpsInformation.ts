export class GpsInformation {
  public vehicleId: string;
  public lat: number;
  public lon: number;
  public speed: number; // 현재 시점의 속도 (km/h 스케일)
  public direction: number; // 현재 시점의 방향 (0-360도)
  public totalDistance: number; // 시뮬레이션 시작부터의 누적 총 주행 거리 (미터)
  public intervalAt: Date; // GPS 정보가 생성된 시간

  /**
   * GPS 정보를 담는 Value Object의 생성자입니다.
   * @param vehicleId 차량 고유 ID (MDN)
   * @param lat 위도
   * @param lon 경도
   * @param speed 현재 속도 (km/h 스케일, 0-255)
   * @param direction 현재 방향 (0-360도)
   * @param totalDistance 시뮬레이션 시작부터 누적된 총 주행 거리 (미터)
   * @param intervalAt GPS 정보 생성 시간
   */
  constructor(
    vehicleId: string,
    lat: number,
    lon: number,
    speed: number,
    direction: number,
    totalDistance: number,
    intervalAt: Date
  ) {
    this.vehicleId = vehicleId;
    this.lat = lat;
    this.lon = lon;
    this.speed = speed;
    this.direction = direction;
    this.totalDistance = totalDistance;
    this.intervalAt = intervalAt;
  }
}
