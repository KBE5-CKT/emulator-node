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
let currentEmulatorState: EmulatorState = "uninitialized";

/**
 * 에뮬레이터의 현재 상태를 확인하는 헬퍼 함수들
 */
const isEmulatorRunning = (state: EmulatorState) => state === "running";
const isEmulatorStopped = (state: EmulatorState) => state === "stopped";
const isEmulatorUninitialized = (state: EmulatorState) =>
  state === "uninitialized";
const isEmulatorError = (state: EmulatorState) => state === "error";

// 시동 ON/OFF가 불가능한 상태들을 묶는 헬퍼 함수
const isEmulatorUnavailable = (state: EmulatorState) =>
  isEmulatorUninitialized(state) || isEmulatorError(state);

/**
 * 서버 시작 시 에뮬레이터 앱을 초기화하는 함수.
 * GPX 파일 파싱 및 에뮬레이터 인스턴스 생성을 담당합니다.
 */
async function initializeServer(): Promise<void> {
  try {
    emulatorApp = new App();
    await emulatorApp.initializeEmulators();
    currentEmulatorState = "stopped";

    console.log("[Emulator Server] 애플리케이션 초기화 완료. 시동 대기 중.");
  } catch (error) {
    console.error("[Emulator Server ERROR] 서버 초기화 중 오류 발생:", error);
    currentEmulatorState = "error";
  }
}

/**
 * 시동 ON 요청을 처리하는 API 핸들러.
 * 에뮬레이터의 시동을 켜고, GPS 데이터 전송을 시작합니다.
 */
app.post("/api/start", async (req: Request, res: Response) => {
  if (isEmulatorRunning(currentEmulatorState)) {
    console.warn("[Emulator API] 시동 ON 요청: 이미 운행 중입니다.");
    return res.status(400).json({ message: "이미 운행 중입니다." });
  }
  if (isEmulatorUnavailable(currentEmulatorState)) {
    console.warn(
      `[Emulator API] 시동 ON 요청: 에뮬레이터 상태가 '${currentEmulatorState}'이라 거부됨.`
    );
    return res.status(400).json({
      message: "에뮬레이터가 아직 초기화되지 않았거나 오류 상태입니다.",
    });
  }

  try {
    console.log(`[Emulator API] 시동 ON 요청 처리 시작`);
    await emulatorApp.startAllEmulators();

    currentEmulatorState = "running";
    console.log(
      `[Emulator API] 에뮬레이터 시동 ON 완료. 현재 상태: ${currentEmulatorState}`
    );
    return res.status(200).json({
      message: `에뮬레이터 시동 ON`,
    });
  } catch (error: any) {
    console.error("[Emulator API ERROR] 시동 ON 중 치명적인 오류 발생:", {
      message: error.message,
      stack: error.stack,
    });
    currentEmulatorState = "error";
    return res.status(500).json({
      message: "에뮬레이터 시동 ON에 실패했습니다.",
      developerMessage: error.message,
    });
  }
});

/**
 * 시동 OFF 요청을 처리하는 API 핸들러.
 * 에뮬레이터의 시동을 끄고, GPS 데이터 전송을 중지합니다.
 * 운행은 종료되지 않으며, 다음 시동 ON 시 이어갈 수 있습니다.
 */
app.post("/api/stop", async (_req: Request, res: Response) => {
  if (
    isEmulatorStopped(currentEmulatorState) ||
    isEmulatorUnavailable(currentEmulatorState)
  ) {
    console.warn(
      `[Emulator API] 시동 OFF 요청: 이미 시동이 꺼져 있거나 상태가 '${currentEmulatorState}'입니다.`
    );
    return res
      .status(400)
      .json({ message: "에뮬레이터 시동이 이미 꺼져 있습니다." });
  }

  try {
    console.log("[Emulator API] 시동 OFF 요청 처리 시작");
    await emulatorApp.stopAllEmulators();

    currentEmulatorState = "stopped";
    console.log(
      `[Emulator API] 에뮬레이터 시동 OFF 완료. 현재 상태: ${currentEmulatorState}`
    );
    return res.status(200).json({ message: "에뮬레이터 시동 OFF 성공." });
  } catch (error: any) {
    console.error("[Emulator API ERROR] 시동 OFF 중 치명적인 오류 발생:", {
      message: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      message:
        "에뮬레이터 시동 끄기에 실패했습니다. 다시 시도하거나 관리자에게 문의하세요.",
      developerMessage: error.message,
    });
  }
});

/**
 * 에뮬레이터 현재 상태를 반환하는 API 핸들러.
 */
app.get("/api/status", (_req: Request, res: Response) => {
  console.log(
    `[Emulator API] 상태 요청: 현재 상태는 '${currentEmulatorState}' 입니다.`
  );
  return res.status(200).json({ status: currentEmulatorState });
});

// 서버 시작 및 초기화 로직
app.listen(PORT, async () => {
  console.log(
    `[Emulator Server] Express 서버가 http://localhost:${PORT} 에서 실행 중입니다.`
  );
  console.log(
    `[Emulator Server] 에뮬레이터 제어를 위해 브라우저에서 http://localhost:${PORT} 에 접속하세요.`
  );
  await initializeServer();
});

// 프로세스 종료 시그널 처리 (Graceful Shutdown)
// process.on("SIGTERM", () => {
//   console.log(
//     "[Emulator Server] SIGTERM 신호 수신: 서버 종료 및 에뮬레이터 정리 시작."
//   );
//   if (emulatorApp) {
//     emulatorApp.resetApp();
//   }
//   console.log("[Emulator Server] 모든 에뮬레이터 리소스 정리 완료. 서버 종료.");
//   process.exit(0);
// });

// process.on("SIGINT", () => {
//   console.log(
//     "[Emulator Server] SIGINT 신호 수신: 서버 종료 및 에뮬레이터 정리 시작."
//   );
//   if (emulatorApp) {
//     emulatorApp.resetApp();
//   }
//   console.log("[Emulator Server] 모든 에뮬레이터 리소스 정리 완료. 서버 종료.");
//   process.exit(0);
// });
