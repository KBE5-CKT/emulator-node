document.addEventListener("DOMContentLoaded", () => {
  const API_BASE_URL = window.location.origin + "/api";

  const startButton = document.getElementById("startButton");
  const stopButton = document.getElementById("stopButton");
  const statusDisplay = document.getElementById("statusDisplay");
  const emulatorControlContainer = document.getElementById("emulatorControl");
  const selectedVehicleNameDisplay = document.getElementById(
    "selectedVehicleName"
  );
  const routeSelect = document.getElementById("routeSelect");

  let selectedEmulatorId = null;
  let selectedRouteId = null;

  // --- URL에서 차량 ID 추출 로직 추가 ---
  const pathParts = window.location.pathname.split("/");
  const urlVehicleId = pathParts[2];

  if (urlVehicleId) {
    selectedEmulatorId = urlVehicleId;
    initializeVehicleControl();
  } else {
    statusDisplay.textContent = "오류: URL에 유효한 애뮬레이터가 없습니다.";
    statusDisplay.className = "status-display status-stopped";
    startButton.disabled = true;
    stopButton.disabled = true;
    routeSelect.disabled = true;
    emulatorControlContainer.style.display = "block";
    return;
  }
  // --- URL에서 차량 ID 추출 로직 끝 ---

  /**
   * 경로 목록을 가져와 드롭다운을 채웁니다.
   */
  async function loadRouteList() {
    try {
      const response = await fetch(`${API_BASE_URL}/route/list`);
      const routes = await response.json();

      routeSelect.innerHTML = "";
      if (routes.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "경로 없음";
        routeSelect.appendChild(option);
        selectedRouteId = null;
        routeSelect.disabled = true;
      } else {
        routes.forEach((route) => {
          const option = document.createElement("option");
          option.value = route.id;
          option.textContent = route.name;
          routeSelect.appendChild(option);
        });
        selectedRouteId = routes[0].id;
        routeSelect.value = selectedRouteId;
        routeSelect.disabled = false;
      }
    } catch (error) {
      console.error("경로 목록 로드 실패:", error);
      alert("경로 목록을 불러오는 데 실패했습니다.");
      routeSelect.innerHTML = '<option value="">경로 로드 실패</option>';
      routeSelect.disabled = true;
      selectedRouteId = null;
    }
  }

  /**
   * 차량 제어 UI를 초기화하고 데이터를 로드합니다.
   */
  async function initializeVehicleControl() {
    if (!selectedEmulatorId) return;

    const vehicleName = selectedEmulatorId;
    selectedVehicleNameDisplay.textContent = vehicleName;
    emulatorControlContainer.style.display = "block";

    loadRouteList().then(() => {
      updateStatus();
    });
  }

  /**
   * 에뮬레이터의 현재 상태를 백엔드로부터 가져와 UI를 업데이트합니다.
   */
  async function updateStatus() {
    if (!selectedEmulatorId) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/status/${selectedEmulatorId}`
      );
      const data = await response.json();
      const status = data.status;

      if (status === "running") {
        statusDisplay.textContent = "상태: 시동 ON";
        statusDisplay.className = "status-display status-running";
        startButton.disabled = true;
        stopButton.disabled = false;
        routeSelect.disabled = true;
      } else if (status === "stopped") {
        statusDisplay.textContent = "상태: 시동 OFF";
        statusDisplay.className = "status-display status-stopped";
        startButton.disabled = false;
        stopButton.disabled = true;
        routeSelect.disabled = false;
      } else {
        statusDisplay.textContent = "상태: 대기 중";
        statusDisplay.className = "status-display status-stopped";
        startButton.disabled = false;
        stopButton.disabled = true;
        routeSelect.disabled = false;
      }
    } catch (error) {
      statusDisplay.textContent = `상태: 서버 연결 오류 (${error.message})`;
      statusDisplay.className = "status-display";
      startButton.disabled = true;
      stopButton.disabled = true;
      routeSelect.disabled = true;
    }
  }

  // --- 기존 버튼 이벤트 리스너들은 변경 없음 ---
  startButton.addEventListener("click", async () => {
    if (!selectedEmulatorId) {
      alert("차량 ID가 지정되지 않았습니다.");
      return;
    }
    try {
      const response = await fetch(
        `${API_BASE_URL}/start/${selectedEmulatorId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            route: selectedRouteId,
          }),
        }
      );
      const result = await response.json();
      alert(result.message);
      updateStatus();
    } catch (error) {
      console.error("시작 요청 실패:", error);
      alert(`시작 요청 중 오류가 발생했습니다: ${error.message}`);
    }
  });

  stopButton.addEventListener("click", async () => {
    if (!selectedEmulatorId) {
      return;
    }
    try {
      const response = await fetch(
        `${API_BASE_URL}/stop/${selectedEmulatorId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );
      const result = await response.json();
      alert(result.message);
      updateStatus();
    } catch (error) {
      console.error("중지 요청 실패:", error);
      alert(`중지 요청 중 오류가 발생했습니다: ${error.message}`);
    }
  });

  routeSelect.addEventListener("change", (event) => {
    selectedRouteId = event.target.value;
    updateStatus();
  });
});
