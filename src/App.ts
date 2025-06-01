// src/App.ts
import { Config } from "./config/Config";
import { GpxParser, GpxTrackPoint } from "./utils/GpxParser";
import { EmulatorInstance } from "./EmulatorInstance";
import { ServerApiClient } from "./api/ServerApiClient"; // 실제 구현체 임포트
import { GpsDataGenerator } from "./GpsDataGenerator"; // 실제 구현체 임포트

export class App {
  private emulators: EmulatorInstance[] = [];
  private config: Config;

  constructor() {
    this.config = new Config(); // 애플리케이션 시작 시 Config 인스턴스 생성
    this.setupShutdownHandlers();
  }

  private setupShutdownHandlers(): void {
    const shutdown = (signal: string) => {
      console.log(`${signal} 신호 수신: 모든 에뮬레이터를 중지합니다.`);
      this.emulators.forEach((emulator: EmulatorInstance) => emulator.stop());
      process.exit(0);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  }

  public async start(): Promise<void> {
    console.log("애플리케이션 시작 중...");
    try {
      const gpxTrackPoints = await GpxParser.parseGpxFile(
        this.config.gpxFilePath
      );

      if (gpxTrackPoints.length < 2) {
        console.error(
          `오류: GPX 파일 '${this.config.gpxFilePath}'은 시뮬레이션을 위해 최소 2개 이상의 트랙 포인트를 포함해야 합니다.`
        );
        process.exit(1);
      }

      for (const vehicleId of this.config.vehicleIds) {
        const apiClient = new ServerApiClient(
          this.config.serverEndpoint,
          vehicleId
        );
        const gpsGenerator = new GpsDataGenerator(
          vehicleId,
          gpxTrackPoints,
          Config.EMULATOR_INTERVAL_MS
        );

        const emulator = new EmulatorInstance(
          vehicleId,
          gpxTrackPoints,
          this.config,
          apiClient,
          gpsGenerator
        );
        this.emulators.push(emulator);
        await emulator.start();
      }

      console.log("모든 에뮬레이터 인스턴스가 시작되었습니다.");
      console.log(
        "컨테이너가 중지되거나 각 차량의 GPX 경로가 완료될 때까지 실행됩니다."
      );
    } catch (error) {
      console.error("애플리케이션 시작 실패:", error);
      process.exit(1);
    }
  }
}
