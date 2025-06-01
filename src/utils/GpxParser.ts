import * as fs from "fs";
import { parseStringPromise } from "xml2js";

export interface GpxTrackPoint {
  lat: number;
  lon: number;
  ele?: number; // 고도 (선택 사항)
  time?: Date; // 시간 (선택 사항)
}

export class GpxParser {
  public static async parseGpxFile(filePath: string): Promise<GpxTrackPoint[]> {
    try {
      const xml = await fs.promises.readFile(filePath, "utf8");
      const result = await parseStringPromise(xml);

      const trackPoints: GpxTrackPoint[] = [];

      if (result.gpx && result.gpx.trk) {
        for (const trk of result.gpx.trk) {
          if (trk.trkseg) {
            for (const trkseg of trk.trkseg) {
              if (trkseg.trkpt) {
                for (const trkpt of trkseg.trkpt) {
                  const lat = parseFloat(trkpt.$.lat);
                  const lon = parseFloat(trkpt.$.lon);
                  const ele = trkpt.ele ? parseFloat(trkpt.ele[0]) : undefined;
                  const time = trkpt.time ? new Date(trkpt.time[0]) : undefined;

                  trackPoints.push({ lat, lon, ele, time });
                }
              }
            }
          }
        }
      } else {
        console.warn("No track points found in GPX file.");
      }

      return trackPoints;
    } catch (error) {
      console.error(`Error parsing GPX file ${filePath}:`, error);
      throw error;
    }
  }
}
