export class GpsWithTime {
  /**
   * GpsWithTime 클래스의 생성자입니다.
   * 위도, 경도, 그리고 해당 GPS 정보가 측정된 시간을 초기화합니다.
   *
   * @param latitude 위도
   * @param longitude 경도
   * @param intervalAt GPS 정보가 측정된 시간 (Date 객체)
   */
  constructor(
    public readonly latitude: number,
    public readonly longitude: number,
    public readonly intervalAt: Date
  ) {}

  /**
   * GpsWithTime 객체를 사람이 읽기 쉬운 문자열 형태로 반환합니다.
   * 위도, 경도, 시간 정보를 포함합니다.
   * @returns "([위도], [경도]) at [ISO 형식 시간]" 형태의 문자열
   */
  toString(): string {
    return `(${this.latitude}, ${
      this.longitude
    }) at ${this.intervalAt.toISOString()}`;
  }

  /**
   * 다른 GpsWithTime 객체와 현재 객체가 동일한 값을 가지는지 비교합니다.
   * 위도, 경도, 그리고 시간(Date 객체의 시간 값)이 모두 같으면 true를 반환합니다.
   * @param other 비교할 다른 GpsWithTime 객체
   * @returns 두 객체가 동일한 값을 가지면 true, 그렇지 않으면 false
   */
  equals(other: GpsWithTime): boolean {
    return (
      this.latitude === other.latitude &&
      this.longitude === other.longitude &&
      this.intervalAt.getTime() === other.intervalAt.getTime() // Date 객체는 getTime()으로 값 비교
    );
  }
}
