document.addEventListener("DOMContentLoaded", () => {
  const startButton = document.getElementById("startButton");
  const stopButton = document.getElementById("stopButton");
  const statusDisplay = document.getElementById("statusDisplay");

  const API_BASE_URL = "http://localhost:3000/api"; // Express 서버 주소

  /**
   * 에뮬레이터의 현재 상태를 백엔드로부터 가져와 UI를 업데이트합니다.
   */
  async function updateStatus() {
    try {
      const response = await fetch(`${API_BASE_URL}/status`);
      const data = await response.json();
      const status = data.status; // 백엔드에서 'status' 필드로 상태를 반환

      if (status === "running") {
        statusDisplay.textContent = "상태: 시동 ON (운행 중)";
        statusDisplay.className = "status-display status-running";
        startButton.disabled = true;
        stopButton.disabled = false;
      } else if (status === "stopped") {
        statusDisplay.textContent = "상태: 시동 OFF (대기 중)";
        statusDisplay.className = "status-display status-stopped";
        startButton.disabled = false;
        stopButton.disabled = true;
      } else {
        // uninitialized, error 등
        statusDisplay.textContent = `상태: ${status}`;
        statusDisplay.className = "status-display";
        startButton.disabled = true;
        stopButton.disabled = true;
      }
    } catch (error) {
      console.error("상태 업데이트 실패:", error);
      statusDisplay.textContent = "상태: 서버 연결 오류";
      statusDisplay.className = "status-display";
      startButton.disabled = true;
      stopButton.disabled = true;
    }
  }

  /**
   * "시동 ON / 운행 시작" 버튼 클릭 시 호출됩니다.
   * 항상 이전 중단 지점부터 이어서 시작하도록 요청을 보냅니다.
   */
  startButton.addEventListener("click", async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const result = await response.json();
      alert(result.message);
      updateStatus(); // 상태 업데이트
    } catch (error) {
      console.error("시작 요청 실패:", error);
      alert("에뮬레이터 시작 요청 중 오류가 발생했습니다.");
    }
  });

  /**
   * "시동 OFF / 운행 중지" 버튼 클릭 시 호출됩니다.
   * 백엔드에 중지 요청을 보냅니다.
   */
  stopButton.addEventListener("click", async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/stop`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const result = await response.json();
      alert(result.message);
      updateStatus(); // 상태 업데이트
    } catch (error) {
      console.error("중지 요청 실패:", error);
      alert("에뮬레이터 중지 요청 중 오류가 발생했습니다.");
    }
  });

  // 페이지 로드 시 초기 상태 업데이트
  updateStatus();
  // 주기적으로 상태 업데이트 (선택 사항)
  // setInterval(updateStatus, 5000); // 5초마다 상태 업데이트
});
