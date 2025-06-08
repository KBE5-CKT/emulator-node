import { Config } from "./config/Config";
import { GpxParser, GpxTrackPoint } from "./utils/GpxParser";
import { EmulatorInstance } from "./EmulatorInstance";
import { ServerApiClient } from "./api/ServerApiClient";

export class App {
  private emulators: EmulatorInstance[] = [];
  private config: Config;
  private gpxTrackPoints: GpxTrackPoint[] = [];
  private isInitialized: boolean = false;

  constructor() {
    this.config = new Config();
  }

  public getEmulators(): EmulatorInstance[] {
    return this.emulators;
  }

  /**
   * 에뮬레이터 인스턴스를 초기화합니다.
   * 이 메서드는 App 인스턴스당 한 번 호출되어야 하며, GPX 파일 파싱 및
   * 각 차량 ID에 대한 EmulatorInstance 생성을 담당합니다.
   */
  public async initializeEmulators(): Promise<void> {
    if (this.isInitialized) {
      console.warn(
        "[App] 에뮬레이터 인스턴스가 이미 초기화되어 있습니다. 다시 초기화하지 않습니다."
      );
      return;
    }

    console.log("[App] GPX 파일 파싱 및 에뮬레이터 인스턴스 초기화 시작...");
    try {
      this.gpxTrackPoints = await GpxParser.parseGpxFile(
        this.config.gpxFilePath
      );

      if (this.gpxTrackPoints.length < 2) {
        const errorMsg = `[App ERROR] GPX 파일 '${this.config.gpxFilePath}'은 시뮬레이션을 위해 최소 2개 이상의 트랙 포인트를 포함해야 합니다.`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      const vehicleId = this.config.vehicleIds[0];
      if (!vehicleId) {
        const errorMsg =
          "[App ERROR] Config에 설정된 vehicleIds가 없습니다. 최소 하나 이상의 차량 ID가 필요합니다.";
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      const apiClient = new ServerApiClient(
        this.config.serverEndpoint,
        vehicleId
      );
      const emulator = new EmulatorInstance(
        vehicleId,
        this.gpxTrackPoints,
        this.config,
        apiClient
      );
      this.emulators.push(emulator);

      this.isInitialized = true;
      console.log(
        `[App] 단일 에뮬레이터 인스턴스 (ID: ${vehicleId}) 준비 완료.`
      );
    } catch (error) {
      console.error("[App ERROR] 에뮬레이터 초기화 실패:", error);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * 모든 에뮬레이터 인스턴스의 시동을 켜고 GPS 데이터 전송을 시작합니다.
   * 이 메서드가 호출되기 전에 initializeEmulators()가 성공적으로 호출되어야 합니다.
   */
  public async startAllEmulators(): Promise<void> {
    if (!this.isInitialized || this.emulators.length === 0) {
      console.warn(
        "[App] 에뮬레이터가 초기화되지 않았거나 인스턴스가 없습니다. 시동 ON 요청을 무시합니다."
      );
      throw new Error("에뮬레이터가 초기화되지 않았습니다.");
    }

    for (const emulator of this.emulators) {
      await emulator.start();
    }
    console.log(`[App] 모든 에뮬레이터 인스턴스가 시동 ON을 완료했습니다.`);
  }

  /**
   * 모든 에뮬레이터 인스턴스의 시동을 끄고 GPS 데이터 전송을 중지합니다.
   * 이 메서드가 호출되기 전에 initializeEmulators()가 성공적으로 호출되어야 합니다.
   */
  public async stopAllEmulators(): Promise<void> {
    if (!this.isInitialized || this.emulators.length === 0) {
      console.warn(
        "[App] 에뮬레이터가 초기화되지 않았거나 인스턴스가 없습니다. 시동 OFF 요청을 무시합니다."
      );
      return;
    }

    for (const emulator of this.emulators) {
      await emulator.stop();
    }
    console.log("[App] 모든 에뮬레이터 인스턴스가 시동 OFF를 완료했습니다.");
  }

  /**
   * App 인스턴스 내부의 에뮬레이터 상태를 리셋합니다.
   * 서버 종료 시 호출되어 모든 타이머를 해제하고 메모리 참조를 정리합니다.
   */
  public resetApp(): void {
    console.log(
      "[App] App 인스턴스 내부의 모든 에뮬레이터 및 데이터 리셋 시작..."
    );
    this.emulators.forEach((emulator) => {
      if (emulator.getIsRunning() || emulator.getIsEngineOn()) {
        emulator.hardStop();
      }
    });
    this.emulators = [];
    this.gpxTrackPoints = [];
    this.isInitialized = false;

    console.log(
      "[App] App 인스턴스 내부의 모든 에뮬레이터 및 데이터가 성공적으로 리셋되었습니다."
    );
  }
}
