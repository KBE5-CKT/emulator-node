import { GpsInformation } from "../domain/vo/GpsInformation";

export interface IGpsDataGenerator {
  getTotalDistance(): number;
  getCurrentGpsInfo(): GpsInformation;
  generateNextGpsData(): GpsInformation | null;
  isEndOfPath(): boolean;
}
