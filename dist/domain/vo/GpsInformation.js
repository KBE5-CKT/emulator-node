"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GpsInformation = void 0;
class GpsInformation {
    vehicleId;
    latitude;
    longitude;
    altitude;
    speed;
    direction;
    distance;
    intervalAt;
    constructor(vehicleId, latitude, longitude, altitude, speed, direction, distance, intervalAt) {
        this.vehicleId = vehicleId;
        this.latitude = latitude;
        this.longitude = longitude;
        this.altitude = altitude;
        this.speed = speed;
        this.direction = direction;
        this.distance = distance;
        this.intervalAt = intervalAt;
    }
    toString() {
        return `GpsInformation{vehicleId='${this.vehicleId}', lat=${this.latitude}, lon=${this.longitude}, alt=${this.altitude}, speed=${this.speed}, direction=${this.direction}, distance=${this.distance}, timestamp=${this.intervalAt.toISOString()}}`;
    }
}
exports.GpsInformation = GpsInformation;
//# sourceMappingURL=GpsInformation.js.map