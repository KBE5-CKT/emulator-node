import { setInterval, clearInterval } from "timers";

// Config
import { Config } from "./config/Config";

// VO (Value Objects)
import { GpsInformation } from "./domain/vo/GpsInformation";

// Interfaces for Dependency Injection
import { IGpsDataGenerator } from "./interfaces/IGpsDataGenerator";
import { IServerApiClient } from "./interfaces/IServerApiClient";

import { GpxTrackPoint } from "./utils/GpxParser";
import CommonUtils from "./utils/CommonUtils";

export class EmulatorInstance {
  private vehicleId: string;
  private config: Config; // Config 인스턴스를 유지
  private apiClient: IServerApiClient; // 인터페이스 타입으로 변경
  private gpsGenerator: IGpsDataGenerator; // 인터페이스 타입으로 변경
  private generatedGpsDataBuffer: GpsInformation[];

  private onTime: Date | null = null;
  private offTime: Date | null = null;
  private gpsGeneratorInterval: NodeJS.Timeout | undefined;
  private serverSenderInterval: NodeJS.Timeout | undefined;

  constructor(
    vehicleId: string,
    gpxTrackPoints: GpxTrackPoint[], // GpsDataGenerator 생성 시 필요
    config: Config, // Config 인스턴스를 직접 받음
    apiClient: IServerApiClient,
    gpsGenerator: IGpsDataGenerator
  ) {
    this.vehicleId = vehicleId;
    this.config = config; // 저장
    this.apiClient = apiClient;
    this.gpsGenerator = gpsGenerator;
    this.generatedGpsDataBuffer = [];

    console.log(`[${this.vehicleId}] 에뮬레이터 인스턴스 생성됨.`);
  }

  /**
   * 에뮬레이션 프로세스를 시작합니다.
   * 'on' 요청을 보내고 GPS 데이터 생성 및 전송 인터벌을 설정합니다.
   */
  async start(): Promise<void> {
    console.log(`[${this.vehicleId}] 에뮬레이션 시작 중...`);

    try {
      const onTime = new Date();
      this.onTime = onTime;

      // 1. 'on' 요청 보내기
      const initialGpsInfo = this.gpsGenerator.getCurrentGpsInfo();
      await this.apiClient.sendOnRequest(initialGpsInfo, onTime);

      // 2. 주기적인 GPS 데이터 생성
      this.gpsGeneratorInterval = setInterval(() => {
        const gpsData = this.gpsGenerator.generateNextGpsData();
        if (gpsData) {
          this.generatedGpsDataBuffer.push(gpsData);
        } else if (this.gpsGeneratorInterval) {
          // 경로 끝에 도달하면 GPS 생성 중지
          console.log(
            `[${this.vehicleId}] GPX 경로 끝에 도달하여 GPS 데이터 생성을 중지합니다.`
          );
          clearInterval(this.gpsGeneratorInterval);
          this.gpsGeneratorInterval = undefined;
          // 남은 버퍼 데이터 전송 후 OFF 요청
          this.sendBufferedGpsData(true);
        }
      }, Config.EMULATOR_INTERVAL_MS);

      // 3. 주기적인 서버 데이터 전송
      this.serverSenderInterval = setInterval(() => {
        this.sendBufferedGpsData();
      }, Config.SERVER_SEND_INTERVAL_MS); // Config의 static 상수 사용
    } catch (error: any) {
      console.error(
        `[${this.vehicleId}] 에뮬레이션 시작 중 치명적인 오류 발생: ${error.message}`
      );
      this.stop();
    }
  }

  /**
   * 버퍼링된 GPS 데이터를 서버로 전송하고 버퍼를 비웁니다.
   * @param isLastSend 마지막 전송인지 여부 (경로 종료 시 OFF 요청 트리거)
   */
  private async sendBufferedGpsData(
    isLastSend: boolean = false
  ): Promise<void> {
    const dataToSend: GpsInformation[] = [...this.generatedGpsDataBuffer];
    this.generatedGpsDataBuffer = []; // 버퍼 비우기

    if (dataToSend.length > 0) {
      await this.apiClient.sendCycleData(dataToSend);
    } else {
      console.log(
        `[${this.vehicleId}] 주기 전송 시간 동안 생성된 GPS 데이터가 없습니다. 전송을 건너뜜.`
      );
    }

    // 마지막 전송인 경우 OFF 요청 트리거
    if (isLastSend) {
      console.log(
        `[${this.vehicleId}] 마지막 데이터 전송 후 OFF 요청을 보냅니다.`
      );

      const offTime = new Date();
      this.offTime = offTime;

      await this.apiClient.sendOffRequest(
        this.gpsGenerator.getCurrentGpsInfo(),
        this.onTime,
        this.offTime
      );
      this.stop(); // 모든 작업 완료 후 에뮬레이터 중지
    }
  }

  /**
   * 에뮬레이터의 모든 인터벌을 중지하고 정리합니다.
   */
  stop(): void {
    console.log(`[${this.vehicleId}] 에뮬레이션 중지 중...`);
    if (this.gpsGeneratorInterval) {
      clearInterval(this.gpsGeneratorInterval);
      this.gpsGeneratorInterval = undefined;
      console.log(`[${this.vehicleId}] GPS 생성 인터벌 중지됨.`);
    }
    if (this.serverSenderInterval) {
      clearInterval(this.serverSenderInterval);
      this.serverSenderInterval = undefined;
      console.log(`[${this.vehicleId}] 서버 전송 인터벌 중지됨.`);
    }
    console.log(`[${this.vehicleId}] 에뮬레이션이 완전히 중지되었습니다.`);
  }
}
