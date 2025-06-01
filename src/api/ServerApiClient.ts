import axios from "axios";

import { IServerApiClient } from "../interfaces/IServerApiClient";
import { GpsInformation } from "../domain/vo/GpsInformation";
import CommonUtils from "../utils/CommonUtils";

export class ServerApiClient implements IServerApiClient {
  private serverEndpoint: string;
  private mdn: string;
  private tid: string;
  private mid: string;
  private pv: string;
  private did: string;

  constructor(serverEndpoint: string, vehicleId: string) {
    this.serverEndpoint = serverEndpoint;
    this.mdn = vehicleId;
    this.tid = "A001";
    this.mid = "6";
    this.pv = "5";
    this.did = "1";
  }

  /**
   * 서버에 'on' 요청을 보냅니다.
   * @param gpsInformation 초기 GPS 정보
   */
  async sendOnRequest(
    gpsInformation: GpsInformation,
    onTime: Date | null
  ): Promise<number | null> {
    const latTransformed = Math.round(gpsInformation.lat * 1000000).toString();
    const lonTransformed = Math.round(gpsInformation.lon * 1000000).toString();

    const onRequestBody = {
      mdn: this.mdn,
      tid: this.tid,
      mid: this.mid,
      pv: this.pv,
      did: this.did,
      onTime: CommonUtils.formatDateTime(onTime),
      offTime: null,
      gcd: "A",
      lat: latTransformed,
      lon: lonTransformed,
      ang: gpsInformation.direction.toString(),
      spd: gpsInformation.speed.toString(),
      sum: gpsInformation.totalDistance.toString(),
    };

    try {
      const response = await axios.post<{ mdn: number }>(
        `${this.serverEndpoint}/api/v1/vehicle/on`,
        onRequestBody
      );
      console.log(`[${this.mdn}] ON 요청 성공. 상태: ${response.status}`);
      return response.data.mdn;
    } catch (error: any) {
      console.error(`[${this.mdn}] ON 요청 오류: ${error.message}`);
      return null;
    }
  }

  /**
   * 서버에 'off' 요청을 보냅니다.
   * @param gpsInformation 최종 GPS 정보
   */
  async sendOffRequest(
    gpsInformation: GpsInformation,
    onTime: Date | null,
    offTime: Date | null
  ): Promise<void> {
    const latTransformed = Math.round(gpsInformation.lat * 1000000).toString();
    const lonTransformed = Math.round(gpsInformation.lon * 1000000).toString();

    const offRequestBody = {
      mdn: this.mdn,
      tid: this.tid,
      mid: this.mid,
      pv: this.pv,
      did: this.did,
      onTime: CommonUtils.formatDateTime(onTime),
      offTime: CommonUtils.formatDateTime(offTime),
      gcd: "A",
      lat: latTransformed,
      lon: lonTransformed,
      ang: gpsInformation.direction.toString(),
      spd: gpsInformation.speed.toString(),
      sum: gpsInformation.totalDistance.toString(),
    };

    try {
      const response = await axios.post(
        `${this.serverEndpoint}/api/v1/vehicle/off`,
        offRequestBody
      );
      console.log(`[${this.mdn}] OFF 요청 성공. 상태: ${response.status}`);
    } catch (error: any) {
      console.error(`[${this.mdn}] OFF 요청 오류: ${error.message}`);
    }
  }

  /**
   * 버퍼링된 GPS 데이터를 서버로 전송합니다.
   * @param dataToSend 전송할 GPS 정보 배열
   */
  async sendCycleData(dataToSend: GpsInformation[]): Promise<void> {
    if (dataToSend.length === 0) {
      console.log(`[${this.mdn}] 전송할 Cycle 데이터가 없습니다.`);
      return;
    }

    const cList = dataToSend.map((gpsInfo) => ({
      gcd: "A",
      lat: Math.round(gpsInfo.lat * 1000000).toString(),
      lon: Math.round(gpsInfo.lon * 1000000).toString(),
      ang: gpsInfo.direction.toString(),
      spd: gpsInfo.speed.toString(),
      sum: gpsInfo.totalDistance.toString(),
      bat: "12.5",
      sec: gpsInfo.intervalAt.getSeconds().toString(),
    }));

    const cycleRequestBody = {
      mdn: this.mdn,
      tid: this.tid,
      mid: this.mid,
      pv: this.pv,
      did: this.did,
      oTime: CommonUtils.formatDateTime(dataToSend[0].intervalAt),
      cCnt: cList.length.toString(),
      cList: cList,
    };

    try {
      const response = await axios.post<any>(
        `${this.serverEndpoint}/api/v1/vehicle/cycle`,
        cycleRequestBody
      );
      console.log(`[${this.mdn}] 서버 응답 (cycle): ${response.status}`);
    } catch (error: any) {
      console.error(`[${this.mdn}] cycle 데이터 전송 오류: ${error.message}`);
    }
    console.log(
      "------------------------------------------------------------------\n"
    );
  }
}
