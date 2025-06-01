import { GpsInformation } from "../domain/vo/GpsInformation";

export interface IServerApiClient {
  sendOnRequest(
    initialGpsInfo: GpsInformation,
    onTime: Date | null
  ): Promise<number | null>;
  sendOffRequest(
    finalGpsInfo: GpsInformation,
    onTime: Date | null,
    offTime: Date | null
  ): Promise<void>;
  sendCycleData(dataToSend: GpsInformation[]): Promise<void>;
}
