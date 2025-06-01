export class Gps {
    private latitude: number;
    private longitude: number;

    constructor(latitude: number, longitude: number) {
        this.latitude = latitude;
        this.longitude = longitude;
    }

    toString(): string {
        return `(${this.latitude}, ${this.longitude})`;
    }

    equals(other: Gps): boolean {
        return this.latitude === other.latitude && this.longitude === other.longitude;
    }

    getLatitude(): number {
        return this.latitude;
    }

    getLongitude(): number {
        return this.longitude;
    }
}