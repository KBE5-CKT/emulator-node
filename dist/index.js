"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const timers_1 = require("timers");
const Gps_1 = require("./domain/vo/Gps");
const GpsInformation_1 = require("./domain/vo/GpsInformation");
const MotionCalculator_1 = require("./utils/MotionCalculator");
// 환경 변수 읽기
const VEHICLE_IDS_STR = process.env.VEHICLE_IDS;
const SERVER_ENDPOINT = process.env.SERVER_ENDPOINT;
if (!VEHICLE_IDS_STR || !SERVER_ENDPOINT) {
    console.error('Error: VEHICLE_IDS and SERVER_ENDPOINT environment variables must be set.');
    process.exit(1);
}
const VEHICLE_IDS = VEHICLE_IDS_STR.split(',').map(id => id.trim());
const EMULATOR_INTERVAL_MS = 1000; // 1초마다 GPS 생성
const SERVER_SEND_INTERVAL_MS = 60 * 1000; // 60초마다 서버 전송
// 기존 Gps 클래스는 변경 없습니다.
// class Gps { ... }
class EmulatorInstance {
    vehicleId;
    startGps;
    endGps;
    serverEndpoint;
    generatedGpsDataBuffer; // GpsData -> GpsInformation
    random;
    currentLatitude;
    currentLongitude;
    previousGpsInfo = null; // 이전 GPS 정보 저장용
    step;
    totalSteps;
    gpsGeneratorInterval;
    serverSenderInterval;
    constructor(vehicleId, startGps, endGps, serverEndpoint) {
        this.vehicleId = vehicleId;
        this.startGps = startGps;
        this.endGps = endGps;
        this.serverEndpoint = serverEndpoint;
        this.generatedGpsDataBuffer = [];
        this.random = Math.random;
        this.currentLatitude = startGps.getLatitude();
        this.currentLongitude = startGps.getLongitude();
        this.step = 0;
        this.totalSteps = 60; // 60초 안에 한 바퀴 돈다고 가정 (MotionCalculator와 연동)
        console.log(`Emulator Instance for Vehicle ID: ${vehicleId} created. From ${startGps} to ${endGps}`);
    }
    start() {
        console.log(`Vehicle ID '${this.vehicleId}' emulation started...`);
        this.gpsGeneratorInterval = (0, timers_1.setInterval)(() => {
            this.generateGpsData();
        }, EMULATOR_INTERVAL_MS);
        this.serverSenderInterval = (0, timers_1.setInterval)(() => {
            this.sendBufferedGpsData();
        }, SERVER_SEND_INTERVAL_MS);
    }
    generateGpsData() {
        // 기존 위치 시뮬레이션 로직
        const latStep = (this.endGps.getLatitude() - this.startGps.getLatitude()) / this.totalSteps;
        const lonStep = (this.endGps.getLongitude() - this.startGps.getLongitude()) / this.totalSteps;
        this.currentLatitude = this.startGps.getLatitude() + (latStep * this.step);
        this.currentLongitude = this.startGps.getLongitude() + (lonStep * this.step);
        // 약간의 노이즈 추가
        this.currentLatitude += (this.random() - 0.5) * 0.0001;
        this.currentLongitude += (this.random() - 0.5) * 0.0001;
        const altitude = 100.0 + (this.random() * 10.0);
        const timestamp = new Date();
        // 현재 GPS 정보 객체 생성 (GpsInformation)
        const currentGpsInfo = new GpsInformation_1.GpsInformation(this.vehicleId, this.currentLatitude, this.currentLongitude, altitude, 0, // 초기 speed
        0, // 초기 direction
        0, // 초기 distance
        timestamp);
        // 이전 GPS 정보가 있다면, MotionCalculator를 사용하여 속도, 방향, 거리를 계산합니다.
        if (this.previousGpsInfo) {
            currentGpsInfo.distance = MotionCalculator_1.MotionCalculator.calculateDistance(this.previousGpsInfo, currentGpsInfo);
            currentGpsInfo.speed = MotionCalculator_1.MotionCalculator.calculateSpeed(this.previousGpsInfo, currentGpsInfo);
            currentGpsInfo.direction = MotionCalculator_1.MotionCalculator.calculateDirection(this.previousGpsInfo, currentGpsInfo);
        }
        this.generatedGpsDataBuffer.push(currentGpsInfo);
        console.log(`Vehicle ID ${this.vehicleId}: 1s generated GPS data: ${currentGpsInfo.toString()}`);
        // 현재 정보를 다음 스텝의 '이전 정보'로 설정
        this.previousGpsInfo = currentGpsInfo;
        this.step = (this.step + 1) % this.totalSteps;
        if (this.step === 0) {
            console.log(`Vehicle ID ${this.vehicleId}: Simulation path restarted.`);
            this.previousGpsInfo = null; // 경로 재시작 시 이전 정보 초기화 (선택 사항)
        }
    }
    async sendBufferedGpsData() {
        const dataToSend = [...this.generatedGpsDataBuffer];
        this.generatedGpsDataBuffer = [];
        if (dataToSend.length > 0) {
            console.log(`\n--- Vehicle ID ${this.vehicleId}: Sending ${dataToSend.length} GPS data points to server (${this.serverEndpoint}) ---`);
            try {
                // 실제 서버 전송 로직 (GpsInformation 배열을 보냅니다)
                // const response = await axios.post<any>(this.serverEndpoint, dataToSend);
                // console.log(`  Server response: ${response.status}`);
                dataToSend.forEach(data => console.log(`  Sent: ${data.toString()}`)); // Mocking
            }
            catch (error) {
                console.error(`  Error sending data for ${this.vehicleId}: ${error.message}`);
            }
            console.log('------------------------------------------------------------------\n');
        }
        else {
            console.log(`Vehicle ID ${this.vehicleId}: No GPS data generated in 60s, skipping send.`);
        }
    }
    stop() {
        console.log(`Vehicle ID '${this.vehicleId}' emulation stopping...`);
        if (this.gpsGeneratorInterval) {
            clearInterval(this.gpsGeneratorInterval);
        }
        if (this.serverSenderInterval) {
            clearInterval(this.serverSenderInterval);
        }
        console.log(`Vehicle ID '${this.vehicleId}' emulation stopped.`);
    }
}
// 메인 로직 (기존과 동일)
const emulators = [];
const random = () => Math.random();
VEHICLE_IDS.forEach((vehicleId) => {
    let start = new Gps_1.Gps(37.5 + (random() * 0.1), 127.0 + (random() * 0.1));
    let end = new Gps_1.Gps(37.5 + (random() * 0.1), 127.0 + (random() * 0.1));
    if (start.equals(end)) {
        end = new Gps_1.Gps(end.getLatitude() + 0.005, end.getLongitude() + 0.005);
    }
    const emulator = new EmulatorInstance(vehicleId, start, end, SERVER_ENDPOINT);
    emulators.push(emulator);
    emulator.start();
});
console.log('All emulator instances started. Running until container stops.');
process.on('SIGTERM', () => {
    console.log('SIGTERM received: Stopping all emulators.');
    emulators.forEach((emulator) => emulator.stop());
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('SIGINT received: Stopping all emulators.');
    emulators.forEach((emulator) => emulator.stop());
    process.exit(0);
});
//# sourceMappingURL=index.js.map