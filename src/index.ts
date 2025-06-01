import axios from 'axios';
import { setInterval, clearInterval } from 'timers';

// VO (Value Objects)
import { GpsInformation } from './domain/vo/GpsInformation';

// Utilities
import { MotionCalculator } from './utils/MotionCalculator';
import { GpxParser, GpxTrackPoint } from './utils/GpxParser';

// --- 환경 변수 설정 ---
const VEHICLE_IDS_STR: string | undefined = process.env.VEHICLE_IDS;
const SERVER_ENDPOINT: string | undefined = process.env.SERVER_ENDPOINT;
const GPX_FILE_PATH: string = './src/assets/namsan_loop.gpx';

// 환경 변수 유효성 검사
if (!VEHICLE_IDS_STR || !SERVER_ENDPOINT || !GPX_FILE_PATH) {
    console.error('오류: VEHICLE_IDS, SERVER_ENDPOINT, GPX_FILE_PATH 환경 변수가 모두 설정되어야 합니다.');
    process.exit(1);
}

// --- 상수 정의 ---
const VEHICLE_IDS: string[] = VEHICLE_IDS_STR.split(',').map(id => id.trim());
const EMULATOR_INTERVAL_MS: number = 1000; // 1초마다 GPS 데이터 생성
const SERVER_SEND_INTERVAL_MS: number = 10 * 1000; // 10초마다 서버로 데이터 전송

// --- 공통 유틸리티 함수 ---
class CommonUtils {
    /**
     * Date 객체를 'YYMMDDHHmmss' 형식의 문자열로 포맷팅합니다.
     * @param date 포맷팅할 Date 객체
     * @returns 포맷팅된 날짜/시간 문자열
     */
    static formatDateTime(date: Date): string {
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        return `${year}${month}${day}${hours}${minutes}${seconds}`;
    }
}

// --- 에뮬레이터 인스턴스 클래스 정의 ---
class EmulatorInstance {
    private vehicleId: string;
    private serverEndpoint: string;
    private generatedGpsDataBuffer: GpsInformation[];
    private random: () => number;

    private gpxTrackPoints: GpxTrackPoint[];
    private currentTrackPointIndex: number; // 현재 GPX 경로 포인트 인덱스
    private nextTrackPointIndex: number;     // 다음 GPX 경로 포인트 인덱스
    private step: number;                    // 현재 두 포인트 사이의 보간 단계
    private totalStepsBetweenPoints: number; // 두 포인트 사이의 총 보간 단계 수

    private currentLatitude: number;
    private currentLongitude: number;
    private previousGpsInfo: GpsInformation | null = null;
    private currentOdometer: number; // 주행 거리계 (시작 시 0으로 가정)

    private gpsGeneratorInterval: NodeJS.Timeout | undefined;
    private serverSenderInterval: NodeJS.Timeout | undefined;

    private drivingLogId: number | null = null; // 'on' 요청 후 서버에서 받은 drivingLogId 저장

    constructor(vehicleId: string, gpxTrackPoints: GpxTrackPoint[], serverEndpoint: string) {
        this.vehicleId = vehicleId;
        this.gpxTrackPoints = gpxTrackPoints;
        this.serverEndpoint = serverEndpoint;
        this.generatedGpsDataBuffer = [];
        this.random = Math.random;

        this.currentTrackPointIndex = 0;
        this.nextTrackPointIndex = 1;
        this.step = 0;
        this.totalStepsBetweenPoints = 0;
        this.currentOdometer = 0; // 초기 주행 거리계 0으로 설정

        if (gpxTrackPoints.length < 2) {
            throw new Error(`[${vehicleId}] GPX 트랙 포인트 배열은 최소 2개 이상이어야 합니다.`);
        }
        this.currentLatitude = gpxTrackPoints[0].lat;
        this.currentLongitude = gpxTrackPoints[0].lon;

        this.calculateStepsBetweenPoints();

        console.log(`[${this.vehicleId}] 에뮬레이터 인스턴스가 생성되었습니다. ${gpxTrackPoints.length}개의 포인트로 GPX 경로를 따릅니다.`);
    }

    /**
     * 에뮬레이션 프로세스를 시작합니다.
     * 'on' 요청을 보내고 GPS 데이터 생성 및 전송 인터벌을 설정합니다.
     */
    async start(): Promise<void> {
        console.log(`[${this.vehicleId}] 에뮬레이션 시작 중...`);

        // 1. 'on' 요청 보내기
        await this.sendOnRequest();

        if (this.drivingLogId === null) {
            console.error(`[${this.vehicleId}] '/on' 요청에서 drivingLogId를 가져오지 못했습니다. 에뮬레이션을 중단합니다.`);
            return; // 'on' 요청 실패 시 에뮬레이션 중단
        }

        console.log(`[${this.vehicleId}] DrivingLog ID ${this.drivingLogId}로 에뮬레이션이 시작되었습니다.`);

        // 2. 주기적인 cycle 데이터 생성 및 전송
        this.gpsGeneratorInterval = setInterval(() => {
            this.generateGpsData();
        }, EMULATOR_INTERVAL_MS);

        this.serverSenderInterval = setInterval(() => {
            this.sendBufferedGpsData();
        }, SERVER_SEND_INTERVAL_MS);
    }

    /**
     * 서버에 'on' 요청을 보냅니다.
     */
    private async sendOnRequest(): Promise<void> {
        const onEndpoint = `${this.serverEndpoint}/on`;
        const initialPoint = this.gpxTrackPoints[0];
        const now = new Date();

        const onTimeStr = CommonUtils.formatDateTime(now);
        // offTime은 현재는 onTime과 동일하게 보내지만, 실제 구현에서는 onTime보다 미래 시간이 될 수 있습니다.
        const offTimeStr = CommonUtils.formatDateTime(now);

        // lat, lon에 1,000,000을 곱한 후 정수로 변환하여 문자열로 전송
        const latTransformed = Math.round(initialPoint.lat * 1000000).toString();
        const lonTransformed = Math.round(initialPoint.lon * 1000000).toString();

        const onRequestBody = {
            mdn: `${this.vehicleId}`,
            tid: `TID-${this.vehicleId}`,
            mid: `MID-${this.vehicleId}`,
            pv: '1.0',
            did: `DID-${this.vehicleId}`,
            onTime: onTimeStr,
            offTime: offTimeStr,
            gcd: 'A', // GPS 수신 상태 (A: 정상)
            lat: latTransformed,
            lon: lonTransformed,
            ang: '0', // 초기 각도
            spd: '0', // 초기 속도
            sum: this.currentOdometer.toString() // 초기 주행 거리
        };

        console.log(`[${this.vehicleId}] ON 요청을 ${onEndpoint}로 전송합니다:`, onRequestBody);
        try {
            const response = await axios.post<{ drivingLogId: number }>(onEndpoint, onRequestBody);
            console.log(`[${this.vehicleId}] ON 요청 성공. 상태: ${response.status}`);
            this.drivingLogId = response.data.drivingLogId;
            console.log(`[${this.vehicleId}] DrivingLogId 수신: ${this.drivingLogId}`);
        } catch (error: any) {
            console.error(`[${this.vehicleId}] ON 요청 오류: ${error.message}`);
            if (error.response) {
                console.error('  응답 데이터:', error.response.data);
                console.error('  응답 상태:', error.response.status);
            }
            this.drivingLogId = null;
        }
    }

    /**
     * 서버에 'off' 요청을 보냅니다.
     */
    private async sendOffRequest(): Promise<void> {
        if (this.drivingLogId === null) {
            console.error(`[${this.vehicleId}] OFF 요청을 보낼 수 없습니다: 유효한 DrivingLogId를 찾을 수 없습니다.`);
            return;
        }

        const offEndpoint = `${this.serverEndpoint}/off`;
        const finalPoint = this.gpxTrackPoints[this.currentTrackPointIndex];
        const now = new Date();

        const offTimeStr = CommonUtils.formatDateTime(now);

        // lat, lon에 1,000,000을 곱한 후 정수로 변환하여 문자열로 전송
        const finalLatTransformed = Math.round(finalPoint.lat * 1000000).toString();
        const finalLonTransformed = Math.round(finalPoint.lon * 1000000).toString();

        const offRequestBody = {
            drivingLogId: this.drivingLogId,
            vehicleId: this.vehicleId,
            finalLat: finalLatTransformed,
            finalLon: finalLonTransformed,
            finalOdometer: this.currentOdometer.toFixed(2), // 소수점 두 자리까지 유지
            offTime: offTimeStr
        };

        console.log(`[${this.vehicleId}] OFF 요청을 ${offEndpoint}로 전송합니다:`, offRequestBody);
        try {
            const response = await axios.post(offEndpoint, offRequestBody);
            console.log(`[${this.vehicleId}] OFF 요청 성공. 상태: ${response.status}`);
        } catch (error: any) {
            console.error(`[${this.vehicleId}] OFF 요청 오류: ${error.message}`);
            if (error.response) {
                console.error('  응답 데이터:', error.response.data);
                console.error('  응답 상태:', error.response.status);
                console.error('  응답 헤더:', error.response.headers);
            }
        }
    }

    /**
     * 현재 포인트와 다음 포인트 사이의 보간 단계를 계산합니다.
     * GPX 포인트에 시간 정보가 있으면 이를 활용하고, 없으면 거리 기반으로 계산합니다.
     */
    private calculateStepsBetweenPoints(): void {
        if (this.currentTrackPointIndex >= this.gpxTrackPoints.length - 1) {
            this.totalStepsBetweenPoints = 1; // 마지막 포인트인 경우 최소 1단계
            return;
        }

        const currentPoint = this.gpxTrackPoints[this.currentTrackPointIndex];
        const nextPoint = this.gpxTrackPoints[this.nextTrackPointIndex];

        if (currentPoint.time && nextPoint.time) {
            // GPX 포인트에 시간 정보가 있는 경우
            const timeDiffMs = nextPoint.time.getTime() - currentPoint.time.getTime();
            this.totalStepsBetweenPoints = Math.max(1, Math.floor(timeDiffMs / EMULATOR_INTERVAL_MS));
        } else {
            // GPX 포인트에 시간 정보가 없는 경우, 거리 기반으로 단계 계산
            // MotionCalculator를 사용하여 두 지점 간의 거리(미터)를 계산
            const mockGpsInfo1 = new GpsInformation(
                this.vehicleId, currentPoint.lat, currentPoint.lon, currentPoint.ele || 0, 0, 0, 0, 0, new Date()
            );
            const mockGpsInfo2 = new GpsInformation(
                this.vehicleId, nextPoint.lat, nextPoint.lon, nextPoint.ele || 0, 0, 0, 0, 0, new Date()
            );
            const distance = MotionCalculator.calculateDistance(mockGpsInfo1, mockGpsInfo2);
            // 10미터당 1단계로 가정 (이 값은 조절 가능)
            this.totalStepsBetweenPoints = Math.max(1, Math.floor(distance / 10));
        }
        this.step = 0; // 새 구간 시작 시 단계 초기화
    }

    /**
     * GPX 경로를 따라 GPS 데이터를 생성합니다.
     * 현재 위치와 다음 위치를 보간하고 노이즈를 추가합니다.
     */
    private generateGpsData(): void {
        // 경로의 끝에 도달했으면 더 이상 생성하지 않음
        if (this.currentTrackPointIndex >= this.gpxTrackPoints.length - 1 && this.step >= this.totalStepsBetweenPoints) {
            return;
        }

        const currentPoint = this.gpxTrackPoints[this.currentTrackPointIndex];
        const nextPoint = this.gpxTrackPoints[this.nextTrackPointIndex];

        // 현재 두 포인트 사이의 진행률 계산
        const progress = this.totalStepsBetweenPoints > 0 ? this.step / this.totalStepsBetweenPoints : 1;

        this.currentLatitude = currentPoint.lat + (nextPoint.lat - currentPoint.lat) * progress;
        this.currentLongitude = currentPoint.lon + (nextPoint.lon - currentPoint.lon) * progress;

        // 약간의 노이즈 추가 (실제 GPS와 유사하게)
        this.currentLatitude += (this.random() - 0.5) * 0.0001;
        this.currentLongitude += (this.random() - 0.5) * 0.0001;

        // 고도 정보는 GPX에서 가져오거나 기본값을 사용하고 노이즈 추가
        const altitude = currentPoint.ele !== undefined ? currentPoint.ele + (this.random() * 5.0) : 100.0 + (this.random() * 10.0);
        const timestamp = new Date();

        const currentGpsInfo: GpsInformation = new GpsInformation(
            this.vehicleId,
            this.currentLatitude,
            this.currentLongitude,
            altitude,
            0, // 초기 속도 (이후 계산)
            0, // 초기 방향 (이후 계산)
            0, // 초기 거리 (이후 계산)
            0, // 초기 총 주행 거리계 (이후 계산)
            timestamp
        );

        if (this.previousGpsInfo) {
            // 이전 GPS 정보가 있으면 속도, 방향, 이동 거리 계산
            currentGpsInfo.distance = MotionCalculator.calculateDistance(this.previousGpsInfo, currentGpsInfo);
            currentGpsInfo.speed = MotionCalculator.calculateSpeed(this.previousGpsInfo, currentGpsInfo);
            currentGpsInfo.direction = MotionCalculator.calculateDirection(this.previousGpsInfo, currentGpsInfo);
            this.currentOdometer += currentGpsInfo.distance; // 총 주행 거리계 업데이트
        } else {
            this.currentOdometer = 0; // 첫 데이터인 경우 0으로 시작
        }

        currentGpsInfo.totalOdometer = this.currentOdometer;

        this.generatedGpsDataBuffer.push(currentGpsInfo);
        this.previousGpsInfo = currentGpsInfo; // 현재 GPS 정보를 이전 정보로 저장

        this.step++; // 다음 보간 단계로 이동
        if (this.step >= this.totalStepsBetweenPoints) {
            // 현재 구간의 끝에 도달하면 다음 포인트로 이동
            this.currentTrackPointIndex = this.nextTrackPointIndex;
            this.nextTrackPointIndex++;
            this.step = 0; // 새 구간의 단계 초기화

            // GPX 경로의 끝에 도달했는지 확인
            if (this.currentTrackPointIndex >= this.gpxTrackPoints.length - 1) {
                console.log(`[${this.vehicleId}] GPX 경로의 끝에 도달했습니다. 남은 데이터를 전송하고 OFF 요청을 시도합니다.`);
                this.sendBufferedGpsData(true); // 남은 데이터 전송 및 최종 OFF 요청
                this.stop(); // 에뮬레이터 중지
                return;
            }
            this.calculateStepsBetweenPoints(); // 다음 구간의 보간 단계 계산
        }
    }

    /**
     * 버퍼링된 GPS 데이터를 서버로 전송합니다.
     * 백엔드의 VehicleCollectorCycleRequest DTO 형식에 맞춰 변경되었습니다.
     * @param isLastSend 마지막 전송인지 여부 (경로 종료 시 OFF 요청 트리거)
     */
    private async sendBufferedGpsData(isLastSend: boolean = false): Promise<void> {
        const dataToSend: GpsInformation[] = [...this.generatedGpsDataBuffer];
        this.generatedGpsDataBuffer = []; // 버퍼 비우기

        if (dataToSend.length > 0) {
            console.log(`\n--- [${this.vehicleId}] 서버(${this.serverEndpoint}/cycle)로 ${dataToSend.length}개의 GPS 데이터를 전송합니다. ---`);

            // CycleInformation 리스트 생성
            const cList = dataToSend.map(gpsInfo => {
                // lat, lon에 1,000,000을 곱한 후 정수로 변환하여 문자열로 전송
                const latTransformed = Math.round(gpsInfo.latitude * 1000000).toString();
                const lonTransformed = Math.round(gpsInfo.longitude * 1000000).toString();
                
                // bat, sec 필드 추가 (임의 값 또는 실제 구현에 따라)
                const bat = '12.5'; // 예시 배터리 값 (문자열)
                const sec = gpsInfo.intervalAt.getSeconds().toString(); // 초 정보 (문자열)

                return {
                    gcd: 'A', // GPS 수신 상태
                    lat: latTransformed,
                    lon: lonTransformed,
                    ang: gpsInfo.direction.toFixed(0), // 정수로 반올림
                    spd: gpsInfo.speed.toFixed(0),     // 정수로 반올림
                    sum: gpsInfo.totalOdometer.toFixed(2), // 소수점 두 자리까지 유지
                    bat: bat,
                    sec: sec
                };
            });

            // VehicleCollectorCycleRequest 형식에 맞는 요청 본문 생성
            const cycleRequestBody = {
                mdn: `${this.vehicleId}`,
                tid: `TID-${this.vehicleId}`,
                mid: `MID-${this.vehicleId}`,
                pv: '1.0',
                did: `DID-${this.vehicleId}`,
                // oTime은 첫 번째 데이터의 시간 또는 에뮬레이션 시작 시간
                oTime: CommonUtils.formatDateTime(dataToSend[0].intervalAt), 
                cCnt: cList.length.toString(), // cList의 개수
                cList: cList
            };

            try {
                const response = await axios.post<any>(`${this.serverEndpoint}/cycle`, cycleRequestBody);
                console.log(`  [${this.vehicleId}] 서버 응답 (cycle): ${response.status}`);
            } catch (error: any) {
                console.error(`  [${this.vehicleId}] cycle 데이터 전송 오류: ${error.message}`);
                if (error.response) {
                    console.error('  응답 데이터:', error.response.data);
                    console.error('  응답 상태:', error.response.status);
                    console.error('  응답 헤더:', error.response.headers);
                }
            }
            console.log('------------------------------------------------------------------\n');
        } else {
            console.log(`[${this.vehicleId}] 10초 동안 생성된 GPS 데이터가 없습니다. cycle 전송을 건너뜜.`);
        }

        // 마지막 전송인 경우 OFF 요청 트리거
        if (isLastSend) {
            await this.sendOffRequest();
        }
    }

    /**
     * 에뮬레이터의 모든 인터벌을 중지합니다.
     */
    stop(): void {
        console.log(`[${this.vehicleId}] 에뮬레이션 중지 중...`);
        if (this.gpsGeneratorInterval) {
            clearInterval(this.gpsGeneratorInterval);
            this.gpsGeneratorInterval = undefined;
        }
        if (this.serverSenderInterval) {
            clearInterval(this.serverSenderInterval);
            this.serverSenderInterval = undefined;
        }
        console.log(`[${this.vehicleId}] 에뮬레이션이 중지되었습니다.`);
    }
}

// --- 메인 애플리케이션 시작 로직 ---
const emulators: EmulatorInstance[] = [];

async function startAllEmulators(): Promise<void> {
    try {
        const gpxTrackPoints = await GpxParser.parseGpxFile(GPX_FILE_PATH);

        if (gpxTrackPoints.length < 2) {
            console.error(`오류: GPX 파일 '${GPX_FILE_PATH}'은 시뮬레이션을 위해 최소 2개 이상의 트랙 포인트를 포함해야 합니다.`);
            process.exit(1);
        }

        for (const vehicleId of VEHICLE_IDS) {
            const emulator: EmulatorInstance = new EmulatorInstance(vehicleId, gpxTrackPoints, SERVER_ENDPOINT!);
            emulators.push(emulator);
            await emulator.start(); // 각 에뮬레이터를 비동기적으로 시작
        }

        console.log('모든 에뮬레이터 인스턴스가 시작되었습니다. 컨테이너가 중지되거나 GPX 경로가 완료될 때까지 실행됩니다.');

    } catch (error) {
        console.error('GPX 파싱 오류 또는 초기 ON 요청 오류로 인해 에뮬레이터 시작에 실패했습니다:', error);
        process.exit(1);
    }
}

// 애플리케이션 시작
startAllEmulators();

// --- 컨테이너 종료 시그널 처리 ---
process.on('SIGTERM', () => {
    console.log('SIGTERM 신호 수신: 모든 에뮬레이터를 중지합니다.');
    emulators.forEach((emulator: EmulatorInstance) => emulator.stop());
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT 신호 수신: 모든 에뮬레이터를 중지합니다.');
    emulators.forEach((emulator: EmulatorInstance) => emulator.stop());
    process.exit(0);
});
