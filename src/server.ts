import express, { Request, Response } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";

import { App } from "./application/App";
import { EmulatorState } from "./application/emulator/type";

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "../public")));

// 전역 App 인스턴스 및 에뮬레이터 상태 관리
let emulatorApp: App;

/**
 * 서버 시작 시 에뮬레이터 앱을 초기화하는 함수.
 * GPX 파일 파싱 및 에뮬레이터 인스턴스 생성을 담당합니다.
 */
async function initializeServer(): Promise<void> {
  try {
    emulatorApp = new App();
    await emulatorApp.initializeEmulators();
  } catch (error) {
    console.error("[Emulator Server ERROR] 서버 초기화 중 오류 발생:", error);
  }
}

app.get("/api/vehicle/list", (req, res) => {
  const emulators = [
    { id: "151", name: "차량 151" },
    { id: "20", name: "차량 20" },
    { id: "19", name: "차량 19" },
    { id: "18", name: "차량 18" },
    { id: "17", name: "차량 17" },
    { id: "16", name: "차량 16" },
    { id: "15", name: "차량 15" },
    { id: "14", name: "차량 14" },
    { id: "13", name: "차량 13" },
    { id: "12", name: "차량 12" },
    { id: "11", name: "차량 11" },
    { id: "10", name: "차량 10" },
    { id: "9", name: "차량 9" },
    { id: "8", name: "차량 8" },
    { id: "7", name: "차량 7" },
    { id: "6", name: "차량 6" },
    { id: "5", name: "차량 5" },
    { id: "4", name: "차량 4" },
    { id: "3", name: "차량 3" },
    { id: "2", name: "차량 2" },
    { id: "1", name: "차량 1" },
  ];
  res.json(emulators);
});

app.get("/api/route/list", (req, res) => {
  const emulators = [
    { id: "namsan_loop", name: "남산 주변" },
    { id: "miwong-to-suwon", name: "미왕빌딩 - 수원역" },
    { id: "gwangju-to-muju_formatted", name: "광주 - 무주" },
    { id: "gyeongju-to-seoul_no_ns", name: "경주 - 서울" },
    { id: "seoul-to-gyeongju_formatted", name: "서울 - 경주" },
    { id: "suwon-daejon-gumi-optimized", name: "수원 - 대전 - 구미" },
    { id: "yangyang-to-daegu_formatted", name: "양주 - 대구" },
    { id: "yeosu-to-cheonan_formatted", name: "여수 - 천안" },
  ];
  res.json(emulators);
});

/**
 * 시동 ON 요청을 처리하는 API 핸들러.
 * 에뮬레이터의 시동을 켜고, GPS 데이터 전송을 시작합니다.
 */
app.post("/api/start/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { route } = req.body;

  try {
    console.debug(`[Emulator API] 시동 ON 요청 처리 시작`);
    await emulatorApp.start(id, route);

    return res.status(200).json({ message: `에뮬레이터 시동 ON` });
  } catch (error: any) {
    console.error("[Emulator API ERROR] 시동 ON 중 치명적인 오류 발생:", {
      message: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      message: "에뮬레이터 시동 ON에 실패했습니다.",
    });
  }
});

/**
 * 시동 OFF 요청을 처리하는 API 핸들러.
 * 에뮬레이터의 시동을 끄고, GPS 데이터 전송을 중지합니다.
 * 운행은 종료되지 않으며, 다음 시동 ON 시 이어갈 수 있습니다.
 */
app.post("/api/stop/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    console.debug(`[Emulator API] 시동 OFF 요청 처리 시작`);
    await emulatorApp.stop(id);

    return res.status(200).json({ message: `에뮬레이터 시동 OFF` });
  } catch (error: any) {
    console.error("[Emulator API ERROR] 시동 OFF 중 치명적인 오류 발생:", {
      message: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      message: "에뮬레이터 시동 OFF에 실패했습니다.",
    });
  }
});

/**
 * 에뮬레이터 현재 상태를 반환하는 API 핸들러.
 */
app.get("/api/status/:id", (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    console.debug(`[Emulator API] 시동 상태 요청 처리 시작`);
    const currentStatus = emulatorApp.currentStatus(id);

    return res.status(200).json({ status: currentStatus });
  } catch (error: any) {
    console.error(
      "[Emulator API ERROR] 시동 상태 요청 처리 중 치명적인 오류 발생:",
      {
        message: error.message,
        stack: error.stack,
      }
    );
    return res.status(500).json({
      message: "에뮬레이터 시동 상태 요청 조회에 실패했습니다.",
    });
  }
});

// 서버 시작 및 초기화 로직
app.listen(Number(PORT), "0.0.0.0", async () => {
  await initializeServer();
});

// 프로세스 종료 시그널 처리 (Graceful Shutdown)
process.on("SIGTERM", () => {
  if (emulatorApp) {
    emulatorApp.resetApp();
  }
  process.exit(0);
});

process.on("SIGINT", () => {
  if (emulatorApp) {
    emulatorApp.resetApp();
  }
  process.exit(0);
});
