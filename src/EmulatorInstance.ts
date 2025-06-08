import { setInterval, clearInterval } from "timers";

import { Config } from "./config/Config";
import { GpsInformation } from "./domain/vo/GpsInformation";
import { IServerApiClient } from "./interfaces/IServerApiClient";
import { GpxTrackPoint } from "./utils/GpxParser";
import { GpsDataGenerator } from "./GpsDataGenerator";

/**
 * 단일 차량 에뮬레이터의 생명 주기와 데이터 전송을 관리합니다.
 * GPX 경로 기반 GPS 데이터 생성, 서버 전송, 시동 ON/OFF, 운행 재개 등을 처리합니다.
 */
export class EmulatorInstance {
  private vehicleId: string;
  private config: Config;
  private apiClient: IServerApiClient;
  private gpsGenerator: GpsDataGenerator;
  private generatedGpsDataBuffer: GpsInformation[];

  private onTime: Date | null = null; // 현재 운행의 시작 시간 (ON 요청 시 설정)

  private gpsGeneratorInterval: NodeJS.Timeout | undefined; // GPS 데이터 생성 인터벌 타이머 ID
  private serverSenderInterval: NodeJS.Timeout | undefined; // 서버로 데이터 전송 인터벌 타이머 ID

  private isRunning: boolean = false; // GPS 데이터 생성 및 전송 인터벌 활성 상태
  private isEngineOn: boolean = false; // 차량 시동 ON/OFF 상태

  private gpxTrackPoints: GpxTrackPoint[];

  /**
   * EmulatorInstance의 새 인스턴스를 생성합니다.
   */
  constructor(
    vehicleId: string,
    gpxTrackPoints: GpxTrackPoint[],
    config: Config,
    apiClient: IServerApiClient
  ) {
    this.vehicleId = vehicleId;
    this.gpxTrackPoints = gpxTrackPoints;
    this.config = config;
    this.apiClient = apiClient;
    this.generatedGpsDataBuffer = [];

    // GpsDataGenerator는 인스턴스 생성 시점에 초기화되며, 상태를 유지하여 운행 이어가기를 지원합니다.
    this.gpsGenerator = new GpsDataGenerator(
      this.vehicleId,
      this.gpxTrackPoints,
      Config.EMULATOR_INTERVAL_MS
    );

    console.log(`[${this.vehicleId}] 에뮬레이터 인스턴스 생성됨.`);
  }

  /**
   * 에뮬레이터의 시동을 켜고 (ON 요청 전송), GPS 데이터 생성 및 전송을 시작합니다.
   * 항상 이전 중단 지점부터 운행을 재개합니다.
   * @throws {Error} GPS 정보를 가져올 수 없거나, 시동 ON/시작 중 오류 발생 시
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn(
        `[${this.vehicleId}] 시동 ON 요청 무시: 에뮬레이터가 이미 실행 중입니다.`
      );
      return;
    }

    console.log(`[${this.vehicleId}] 시동 ON 요청 처리 시작...`);

    try {
      // 이전에 ON 요청이 없었다면 현재 시각을 운행 시작 시간으로 설정합니다.
      if (this.onTime === null) {
        console.warn(
          `[${this.vehicleId}] 이전 운행 정보가 없어 현재 시각을 운행 시작 시간으로 설정합니다.`
        );
        this.onTime = new Date();
      } else {
        console.log(
          `[${this.vehicleId}] 에뮬레이션 이어가기: 이전 지점부터 운행을 재개합니다.`
        );
      }

      const currentGpsInfo = this.gpsGenerator.getCurrentGpsInfo();
      if (!currentGpsInfo) {
        console.error(
          `[${this.vehicleId}] 현재 GPS 정보가 없어 ON 요청을 보낼 수 없습니다. 시동 실패.`
        );
        this.hardStop();
        throw new Error("GPS 정보 부족으로 시동 ON에 실패했습니다.");
      }

      await this.apiClient.sendOnRequest(currentGpsInfo, this.onTime);
      this.isEngineOn = true;
      this.isRunning = true;
      this.startIntervals();

      console.log(
        `[${this.vehicleId}] 시동 ON 요청 성공. 에뮬레이터 운행 시작.`
      );
    } catch (error: any) {
      console.error(
        `[${this.vehicleId}] 시동 ON 및 에뮬레이션 시작 중 오류 발생: ${error.message}`,
        error
      );
      this.hardStop();
      throw error;
    }
  }

  /**
   * 에뮬레이터의 시동을 끄고 (OFF 요청 전송), GPS 데이터 생성 및 전송을 중지합니다.
   * 운행 상태는 유지되어 다음 시동 ON 시 이어갈 수 있습니다.
   * 버퍼에 남아있는 모든 GPS 데이터를 최종적으로 전송합니다.
   * @throws {Error} OFF 요청 전송 실패 시
   */
  async stop(): Promise<void> {
    if (!this.isEngineOn) {
      console.warn(
        `[${this.vehicleId}] 시동 OFF 요청 무시: 시동이 이미 꺼진 상태입니다.`
      );
      return;
    }

    console.log(`[${this.vehicleId}] 시동 OFF 요청 처리 시작...`);
    this.stopIntervals(); // 모든 인터벌 중지
    this.isRunning = false; // GPS 데이터 생성 및 전송 중지

    try {
      // 시동 OFF 직전까지 생성된 남아있는 버퍼 데이터를 최종 전송합니다.
      if (this.generatedGpsDataBuffer.length > 0) {
        console.log(
          `[${this.vehicleId}] 시동 OFF 전 남아있는 GPS 데이터 (${this.generatedGpsDataBuffer.length}개) 최종 전송.`
        );
        await this.apiClient.sendCycleData(this.generatedGpsDataBuffer);
        this.generatedGpsDataBuffer = []; // 전송 후 버퍼 비우기
      }

      const offTime = new Date();
      const currentGpsInfo = this.gpsGenerator.getCurrentGpsInfo();

      // 서버에 시동 OFF 요청을 전송합니다.
      await this.apiClient.sendOffRequest(currentGpsInfo, this.onTime, offTime);

      this.isEngineOn = false; // 시동 꺼짐 상태로 변경
      console.log(
        `[${this.vehicleId}] 시동 OFF 요청 성공. 에뮬레이터 운행 중지.`
      );
    } catch (error: any) {
      console.error(
        `[${this.vehicleId}] 시동 OFF 요청 실패: ${error.message}`,
        error
      );
      this.isEngineOn = false; // 오류가 발생했더라도 시동은 꺼진 것으로 간주
      throw error;
    }
  }

  /**
   * GPX 경로 끝에 도달했을 때 호출되어 운행을 정상적으로 종료합니다.
   * 시동 OFF 요청은 보내지 않으며, Generator를 초기화하여 다음 운행을 처음부터 시작할 준비를 합니다.
   */
  private async endTripNormally(): Promise<void> {
    console.log(
      `[${this.vehicleId}] GPX 경로 완료: 운행 정상 종료 처리 시작...`
    );

    this.stopIntervals();
    this.isRunning = false;

    // 남아있는 버퍼 데이터가 있다면 최종 전송 (sendBufferedGpsData를 isFinalSend=true로 호출)
    await this.sendBufferedGpsData(true);

    // GpsDataGenerator를 초기화하여 다음 운행을 처음부터 시작할 수 있도록 준비합니다.
    this.gpsGenerator = new GpsDataGenerator(
      this.vehicleId,
      this.gpxTrackPoints,
      Config.EMULATOR_INTERVAL_MS
    );
    this.onTime = null; // 운행이 끝났으므로 onTime 초기화
    this.isEngineOn = false; // 운행 종료 시 시동도 꺼진 것으로 간주

    console.log(`[${this.vehicleId}] 운행이 정상적으로 종료되었습니다.`);
  }

  /**
   * 에뮬레이터의 모든 작업을 강제로 중지하고 상태를 초기화합니다.
   * 주로 오류 발생 시나 서버 종료 시 호출됩니다. ON/OFF 요청은 보내지 않습니다.
   */
  public hardStop(): void {
    console.log(`[${this.vehicleId}] 에뮬레이터 강제 중지 및 초기화 중...`);
    this.stopIntervals();
    this.isRunning = false;
    this.isEngineOn = false;
    this.onTime = null;
    this.generatedGpsDataBuffer = []; // 버퍼 비우기

    // GpsDataGenerator를 초기화하여 다음 시작 시 항상 처음부터 시작하도록 준비합니다.
    this.gpsGenerator = new GpsDataGenerator(
      this.vehicleId,
      this.gpxTrackPoints,
      Config.EMULATOR_INTERVAL_MS
    );
    console.log(`[${this.vehicleId}] 에뮬레이터 강제 중지 및 초기화 완료.`);
  }

  /**
   * GPS 데이터 생성 및 서버 전송 인터벌을 시작합니다.
   */
  private startIntervals(): void {
    if (this.gpsGeneratorInterval || this.serverSenderInterval) {
      console.warn(
        `[${this.vehicleId}] 인터벌이 이미 활성화되어 있습니다. 중복 시작 요청 무시.`
      );
      return;
    }

    // GPS 데이터 생성 인터벌 설정
    this.gpsGeneratorInterval = setInterval(() => {
      const gpsData = this.gpsGenerator.generateNextGpsData();
      if (gpsData) {
        this.generatedGpsDataBuffer.push(gpsData);
      } else {
        // GPX 경로 끝에 도달하면 운행을 정상 종료 처리합니다.
        console.log(
          `[${this.vehicleId}] GPX 경로 끝에 도달. 운행 종료 처리 시작.`
        );
        this.stopIntervals(); // 먼저 생성 인터벌 중지
        this.endTripNormally();
      }
    }, Config.EMULATOR_INTERVAL_MS);

    // 서버 전송 인터벌 설정
    this.serverSenderInterval = setInterval(() => {
      this.sendBufferedGpsData();
    }, Config.SERVER_SEND_INTERVAL_MS);

    console.log(`[${this.vehicleId}] 에뮬레이션 인터벌이 시작되었습니다.`);
  }

  /**
   * GPS 데이터 생성 및 서버 전송 인터벌을 중지합니다.
   */
  private stopIntervals(): void {
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
  }

  /**
   * 버퍼링된 GPS 데이터를 서버로 전송하고 버퍼를 비웁니다.
   * @param isFinalSend - true이면 마지막 전송임을 나타냅니다.
   */
  private async sendBufferedGpsData(
    isFinalSend: boolean = false
  ): Promise<void> {
    if (this.generatedGpsDataBuffer.length === 0) {
      if (!isFinalSend) {
        console.log(
          `[${this.vehicleId}] 주기 전송 시간 동안 생성된 GPS 데이터가 없어 전송을 건너뜜.`
        );
      }
      return;
    }

    const dataToSend: GpsInformation[] = [...this.generatedGpsDataBuffer];
    this.generatedGpsDataBuffer = [];

    try {
      await this.apiClient.sendCycleData(dataToSend);
      console.log(
        `[${this.vehicleId}] GPS 주기 데이터 ${dataToSend.length}개 전송 완료.`
      );
    } catch (error: any) {
      console.error(
        `[${this.vehicleId}] 주기 데이터 전송 실패: ${error.message}`,
        error
      );
    }

    if (isFinalSend) {
      console.log(`[${this.vehicleId}] 모든 GPX 데이터 최종 전송 처리 완료.`);
    }
  }

  /**
   * 현재 에뮬레이터가 GPS 데이터를 생성하고 전송 중인지 여부를 반환합니다.
   */
  public getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * 현재 에뮬레이터의 시동이 켜져 있는지 여부를 반환합니다.
   */
  public getIsEngineOn(): boolean {
    return this.isEngineOn;
  }
}
