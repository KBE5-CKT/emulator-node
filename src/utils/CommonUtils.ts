export default class CommonUtils {
  /**
   * Date 객체를 'YYMMDDHHmmss' 형식의 문자열로 포맷팅합니다.
   * @param date 포맷팅할 Date 객체
   * @returns 포맷팅된 날짜/시간 문자열
   */
  static formatDateTime(date: Date | null): string {
    if (!date) {
      return "";
    }

    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }
}
