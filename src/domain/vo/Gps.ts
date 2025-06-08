export class Gps {
  /**
   * Gps 클래스의 생성자입니다.
   * 위도와 경도 좌표를 초기화합니다.
   *
   * @param latitude 위도
   * @param longitude 경도
   */
  constructor(
    public readonly latitude: number,
    public readonly longitude: number
  ) {}

  /**
   * Gps 객체를 사람이 읽기 쉬운 문자열 형태로 반환합니다.
   * 위도와 경도 정보를 포함합니다.
   * @returns "([위도], [경도])" 형태의 문자열
   */
  toString(): string {
    return `(${this.latitude}, ${this.longitude})`;
  }

  /**
   * 다른 Gps 객체와 현재 객체가 동일한 값을 가지는지 비교합니다.
   * 위도와 경도가 모두 같으면 true를 반환합니다.
   * @param other 비교할 다른 Gps 객체
   * @returns 두 객체가 동일한 값을 가지면 true, 그렇지 않으면 false
   */
  equals(other: Gps): boolean {
    return (
      this.latitude === other.latitude && this.longitude === other.longitude
    );
  }
}
