import * as dotenv from "dotenv";

dotenv.config();

export class Config {
  public readonly vehicleIds: string[];
  public readonly serverEndpoint: string;
  public readonly gpxFilePath: string;

  public static readonly EMULATOR_INTERVAL_MS: number = 1000; // 1초
  public static readonly SERVER_SEND_INTERVAL_MS: number = 10000; // 10초

  constructor() {
    const vehicleIdsStr = process.env.VEHICLE_IDS;
    const serverEndpoint = process.env.SERVER_ENDPOINT;
    const gpxFilePath = process.env.GPX_FILE_PATH;

    if (!vehicleIdsStr || !serverEndpoint || !gpxFilePath) {
      console.error(
        "VEHICLE_IDS, SERVER_ENDPOINT, GPX_FILE_PATH 환경 변수가 모두 설정되어야 합니다."
      );
      process.exit(1);
    }

    this.vehicleIds = vehicleIdsStr.split(",").map((id) => id.trim());
    this.serverEndpoint = serverEndpoint;
    this.gpxFilePath = gpxFilePath;
  }
}
