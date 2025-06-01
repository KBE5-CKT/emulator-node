"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Location = void 0;
class Location {
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
exports.Location = Location;
//# sourceMappingURL=Location.js.map