import { formatInTimeZone } from "date-fns-tz";

export default class CommonUtils {
  /**
   * Date 객체를 'yyMMddHHmmss' 형식의 문자열로 포맷팅합니다.
   * @param date 포맷팅할 Date 객체
   * @returns 포맷팅된 날짜/시간 문자열
   */
  static formatDateTime(
    dateValue: Date | null | undefined,
    formatString: string = "yyMMddHHmmss",
    timeZone: string = "Asia/Seoul"
  ): string | undefined {
    if (dateValue instanceof Date) {
      return formatInTimeZone(dateValue, timeZone, formatString);
    }
    return undefined;
  }
}
