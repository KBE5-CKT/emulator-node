export class GpsInformation {
    public vehicleId: string;
    public latitude: number;
    public longitude: number;
    public altitude: number;
    public speed: number;
    public direction: number;
    public distance: number; // 현재 Interval 동안 이동한 거리
    public totalOdometer: number; // 총 누적 주행 거리 (새로 추가)
    public intervalAt: Date; // 발생 시각

    constructor(
        vehicleId: string,
        latitude: number,
        longitude: number,
        altitude: number,
        speed: number,
        direction: number,
        distance: number,
        totalOdometer: number, // 생성자에 totalOdometer 추가
        intervalAt: Date
    ) {
        this.vehicleId = vehicleId;
        this.latitude = latitude;
        this.longitude = longitude;
        this.altitude = altitude;
        this.speed = speed;
        this.direction = direction;
        this.distance = distance;
        this.totalOdometer = totalOdometer; // 필드 할당
        this.intervalAt = intervalAt;
    }

    toString(): string {
        return `GpsInformation{vehicleId='${this.vehicleId}', lat=${this.latitude}, lon=${this.longitude}, alt=${this.altitude}, speed=${this.speed}, direction=${this.direction}, distance=${this.distance}, totalOdometer=${this.totalOdometer}, timestamp=${this.intervalAt.toISOString()}}`;
    }
}