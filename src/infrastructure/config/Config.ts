import * as dotenv from "dotenv";

dotenv.config();

export class Config {
  public readonly serverEndpoint: string;

  public static readonly EMULATOR_INTERVAL_MS: number = 1000; // 1초
  public static readonly SERVER_SEND_INTERVAL_MS: number = 60000; // 60초

  constructor() {
    const serverEndpoint = process.env.SERVER_ENDPOINT;

    if (!serverEndpoint) {
      console.error("SERVER_ENDPOINT 환경 변수가 모두 설정되어야 합니다.");
      process.exit(1);
    }

    this.serverEndpoint = serverEndpoint;
  }
}
