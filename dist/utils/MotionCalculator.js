"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MotionCalculator = void 0;
class MotionCalculator {
    // --- 공통 상수 정의 ---
    static EARTH_RADIUS = 6_371_000.0; // TypeScript에서는 숫자 리터럴에 언더스코어 사용 가능
    // --- 속도 계산 관련 상수 ---
    static MPS_TO_KMH_SCALE = 3.6;
    static EXPECTED_MAX_SPEED_KMH = 200.0;
    // --- 클램핑 및 스케일링 범위 상수 ---
    static DISTANCE_MIN = 0;
    static DISTANCE_MAX = 9_999_999;
    static SPEED_MIN = 0;
    static SPEED_MAX = 255;
    static DIRECTION_MIN = 0;
    static DIRECTION_MAX = 360;
    /**
     * Haversine 공식을 사용하여 지구 표면상 두 GPS 지점 간의 최단 거리를 계산합니다.
     *
     * @param previous 이전 GPS 지점 (위도, 경도)
     * @param current 현재 GPS 지점 (위도, 경도)
     * @return 두 지점 간의 이동 거리 (미터 단위, 0 ~ 9,999,999 범위로 제한)
     */
    static calculateDistance(previous, current) {
        // 부동 소수점 비교는 주의해야 하지만, 여기서는 0인지 확인하는 단순 비교이므로 유지
        if (previous.longitude === current.longitude && previous.latitude === current.latitude) {
            return MotionCalculator.DISTANCE_MIN;
        }
        const lat1 = previous.latitude;
        const lon1 = previous.longitude;
        const lat2 = current.latitude;
        const lon2 = current.longitude;
        const toRadians = (deg) => deg * (Math.PI / 180);
        const latDistance = toRadians(lat2 - lat1);
        const lonDistance = toRadians(lon2 - lon1);
        const a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
            + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2))
                * Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = MotionCalculator.EARTH_RADIUS * c;
        // 결과 클램핑
        return Math.max(MotionCalculator.DISTANCE_MIN, Math.min(Math.floor(distance), MotionCalculator.DISTANCE_MAX));
    }
    /**
     * 이동 거리와 시간 차이를 기반으로 속도를 계산하고, 이를 0 ~ 255 범위로 스케일링합니다.
     * 결과는 km/h 단위로 해석됩니다.
     *
     * @param previous 이전 GPS 정보 (위치 및 시간)
     * @param current 현재 GPS 정보 (위치 및 시간)
     * @return 스케일된 속도 (정수형, 0 ~ 255 범위)
     */
    static calculateSpeed(previous, current) {
        const distanceMeters = MotionCalculator.calculateDistance(previous, current);
        // 시간 차이 계산 (밀리초)
        const timeMillis = current.intervalAt.getTime() - previous.intervalAt.getTime();
        if (timeMillis <= 0) {
            return MotionCalculator.SPEED_MIN;
        }
        const speedMps = distanceMeters / (timeMillis / 1000.0);
        const speedKmh = speedMps * MotionCalculator.MPS_TO_KMH_SCALE;
        // 속도 스케일링
        const scaledSpeed = (speedKmh / MotionCalculator.EXPECTED_MAX_SPEED_KMH) * MotionCalculator.SPEED_MAX;
        // 결과 클램핑
        return Math.max(MotionCalculator.SPEED_MIN, Math.min(Math.floor(scaledSpeed), MotionCalculator.SPEED_MAX));
    }
    /**
     * 방위각(북쪽을 기준으로 시계 방향으로 측정된 각도) 계산 공식을 사용하여 두 지점 간의 방향을 계산합니다.
     *
     * @param previous 이전 GPS 지점 (위도, 경도)
     * @param current 현재 GPS 지점 (위도, 경도)
     * @return 방위각 (도, 0 ~ 360 범위)
     */
    static calculateDirection(previous, current) {
        const lat1 = previous.latitude;
        const lon1 = previous.longitude;
        const lat2 = current.latitude;
        const lon2 = current.longitude;
        if (lat1 === lat2 && lon1 === lon2) {
            return MotionCalculator.DIRECTION_MIN;
        }
        const toRadians = (deg) => deg * (Math.PI / 180);
        const toDegrees = (rad) => rad * (180 / Math.PI);
        const radLat1 = toRadians(lat1);
        const radLat2 = toRadians(lat2);
        const deltaLon = toRadians(lon2 - lon1);
        const y = Math.sin(deltaLon) * Math.cos(radLat2);
        const x = Math.cos(radLat1) * Math.sin(radLat2) - Math.sin(radLat1) * Math.cos(radLat2) * Math.cos(deltaLon);
        let bearing = toDegrees(Math.atan2(y, x));
        // 방위각을 0-360 범위로 정규화
        bearing = (bearing + MotionCalculator.DIRECTION_MAX) % MotionCalculator.DIRECTION_MAX;
        // 결과 클램핑
        return Math.max(MotionCalculator.DIRECTION_MIN, Math.min(Math.floor(bearing), MotionCalculator.DIRECTION_MAX));
    }
}
exports.MotionCalculator = MotionCalculator;
//# sourceMappingURL=MotionCalculator.js.map