"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Gps = void 0;
class Gps {
    latitude;
    longitude;
    constructor(latitude, longitude) {
        this.latitude = latitude;
        this.longitude = longitude;
    }
    toString() {
        return `(${this.latitude}, ${this.longitude})`;
    }
    equals(other) {
        return this.latitude === other.latitude && this.longitude === other.longitude;
    }
    getLatitude() {
        return this.latitude;
    }
    getLongitude() {
        return this.longitude;
    }
}
exports.Gps = Gps;
//# sourceMappingURL=Gps.js.map