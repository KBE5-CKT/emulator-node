import { EmulatorInstance } from "./emulator/EmulatorInstance";

import { Config } from "@/infrastructure/config/Config";
import { ServerApiClient } from "@/infrastructure/extenal/ServerApiClient";
import { GpxParser, GpxTrackPoint } from "@/utils/GpxParser";
import { EmulatorState } from "./emulator/type";
import path from "path";

export class App {
  private emulators: Map<string, EmulatorInstance> = new Map();
  private config: Config;
  private isInitialized: boolean = false;

  constructor() {
    this.config = new Config();
  }

  /**
   * 해당하는 애뮬레이터를 반환합니다.
   * @param emulatorId 애뮬레이터 식별자
   * @returns 해당하는 애뮬레이터 인스턴스 or undefined
   */
  public getEmulators(emulatorId: string): EmulatorInstance | undefined {
    return this.emulators.get(emulatorId);
  }

  /**
   * 에뮬레이터 인스턴스를 초기화합니다.
   * 이 메서드는 App 인스턴스당 한 번 호출되어야 하며, GPX 파일 파싱 및
   * 각 차량 ID에 대한 EmulatorInstance 생성을 담당합니다.
   */
  public async initializeEmulators(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.isInitialized = true;
    console.debug("[Emulator] 애뮬레이터를 초기화하였습니다.");
  }

  /**
   * 모든 에뮬레이터 인스턴스의 시동을 켜고 GPS 데이터 전송을 시작합니다.
   */
  public async start(emulatorId: string, route: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("에뮬레이터 시스템이 초기화되지 않았습니다.");
    }

    const emulator = this.emulators.get(emulatorId);
    if (emulator && emulator.getStatus() !== "pending") {
      console.debug("[Emulator] 기존의 경로로 계속 시작");
      await emulator!.start();
    } else {
      const gpxTrackPoints = await GpxParser.parseGpxFile(
        path.join(process.cwd(), "assets", `${route}.gpx`)
      );

      const apiClient = new ServerApiClient(
        this.config.serverEndpoint,
        emulatorId
      );
      const emulatorInstance = new EmulatorInstance(
        emulatorId,
        route,
        gpxTrackPoints,
        apiClient
      );

      this.emulators.set(emulatorId, emulatorInstance);
      const emulator = this.emulators.get(emulatorId);
      await emulator!.start();
    }

    console.debug("[Emulator] 시동 ON 완료");
  }

  /**
   * 모든 에뮬레이터 인스턴스의 시동을 끄고 GPS 데이터 전송을 중지합니다.
   * 이 메서드가 호출되기 전에 initializeEmulators()가 성공적으로 호출되어야 합니다.
   */
  public async stop(emulatorId: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("에뮬레이터 시스템이 초기화되지 않았습니다.");
    }

    const emulator = this.emulators.get(emulatorId);
    if (!emulator) {
      console.error("[Emulator] 존재하지 않는 애뮬레이터입니다. " + emulatorId);
    }
    await emulator!.stop();
    console.debug("[Emulator] 시동 OFF 완료");
  }

  /**
   * App 인스턴스 내부의 에뮬레이터 상태를 리셋합니다.
   * 서버 종료 시 호출되어 모든 타이머를 해제하고 메모리 참조를 정리합니다.
   */
  public resetApp(): void {
    this.emulators.forEach((emulator) => {
      emulator.stop().catch((error) => {
        console.error(
          `[Emulator] 에뮬레이터 ${emulator.getId()} 중지 중 오류 발생`
        );
      });
    });
    this.emulators.clear();
    this.isInitialized = false;

    console.debug("[Emulator] 애뮬레이터를 리셋하였습니다.");
  }

  public currentStatus(emulatorId: string): EmulatorState {
    const emulator = this.emulators.get(emulatorId);
    if (!emulator) {
      return "pending";
    }

    return emulator.getStatus();
  }

  public currentRoute(emulatorId: string): string {
    const emulator = this.emulators.get(emulatorId);
    if (!emulator) {
      return "";
    }

    return emulator.getRoute();
  }
}
