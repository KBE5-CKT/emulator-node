document.addEventListener("DOMContentLoaded", () => {
  const startButton = document.getElementById("startButton");
  const stopButton = document.getElementById("stopButton");
  const statusDisplay = document.getElementById("statusDisplay");
  const vehicleListContainer = document.getElementById("vehicleList");
  const emulatorControlContainer = document.getElementById("emulatorControl");
  const selectedVehicleNameDisplay = document.getElementById(
    "selectedVehicleName"
  );
  const routeSelect = document.getElementById("routeSelect"); // New: 경로 선택 드롭다운 요소 추가

  const API_BASE_URL = "http://192.168.1.75:3000/api";

  let selectedEmulatorId = null;
  let selectedRouteId = null; // New: 선택된 경로 ID를 저장할 변수

  /**
   * 에뮬레이터 목록을 가져와 UI에 표시합니다.
   */
  async function loadEmulatorList() {
    try {
      const response = await fetch(`${API_BASE_URL}/vehicle/list`); // <-- 서버 API 엔드포인트에 맞춰 수정
      const emulators = await response.json();

      vehicleListContainer.innerHTML = "";
      emulators.forEach((vehicle) => {
        const listItem = document.createElement("li");
        listItem.textContent = vehicle.name;
        listItem.dataset.vehicleId = vehicle.id;
        listItem.addEventListener("click", () =>
          selectVehicle(vehicle.id, vehicle.name)
        );
        vehicleListContainer.appendChild(listItem);
      });
    } catch (error) {
      console.error("에뮬레이터 목록 로드 실패:", error);
      alert("차량 목록을 불러오는 데 실패했습니다.");
    }
  }

  /**
   * New: 경로 목록을 가져와 드롭다운을 채웁니다.
   */
  async function loadRouteList() {
    try {
      const response = await fetch(`${API_BASE_URL}/route/list`);
      const routes = await response.json();

      routeSelect.innerHTML = ""; // 기존 옵션 초기화
      if (routes.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "경로 없음";
        routeSelect.appendChild(option);
        selectedRouteId = null;
        routeSelect.disabled = true; // 경로가 없으면 드롭다운 비활성화
      } else {
        routes.forEach((route) => {
          const option = document.createElement("option");
          option.value = route.id;
          option.textContent = route.name;
          routeSelect.appendChild(option);
        });
        // 기본 경로 선택: 첫 번째 경로를 기본으로 선택하거나, 이전에 선택된 경로가 있으면 유지
        if (selectedRouteId && routes.some((r) => r.id === selectedRouteId)) {
          routeSelect.value = selectedRouteId;
        } else {
          selectedRouteId = routes[0].id; // 첫 번째 경로를 기본으로 설정
          routeSelect.value = selectedRouteId;
        }
        routeSelect.disabled = false; // 경로가 있으니 드롭다운 활성화
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
   * 차량을 선택하고 해당 차량의 제어 UI를 표시합니다.
   * @param {string} vehicleId - 선택된 차량의 ID
   * @param {string} vehicleName - 선택된 차량의 이름
   */
  function selectVehicle(vehicleId, vehicleName) {
    const prevSelected = document.querySelector(".vehicle-list li.selected");
    if (prevSelected) {
      prevSelected.classList.remove("selected");
    }

    const currentSelected = document.querySelector(
      `[data-vehicle-id="${vehicleId}"]`
    );
    if (currentSelected) {
      currentSelected.classList.add("selected");
    }

    selectedEmulatorId = vehicleId;
    selectedVehicleNameDisplay.textContent = vehicleName;
    emulatorControlContainer.style.display = "block";
    updateStatus();
  }

  /**
   * 에뮬레이터의 현재 상태를 백엔드로부터 가져와 UI를 업데이트합니다.
   */
  async function updateStatus() {
    if (!selectedEmulatorId) {
      statusDisplay.textContent = "상태: 차량을 선택해주세요.";
      statusDisplay.className = "status-display";
      startButton.disabled = true;
      stopButton.disabled = true;
      routeSelect.disabled = true; // New: 차량 미선택 시 경로 드롭다운 비활성화
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
        routeSelect.disabled = true; // New: 운행 중일 때 경로 변경 불가
      } else if (status === "stopped") {
        statusDisplay.textContent = "상태: 시동 OFF";
        statusDisplay.className = "status-display status-stopped";

        startButton.disabled = false;
        stopButton.disabled = true;
        routeSelect.disabled = true;
      } else {
        statusDisplay.textContent = "상태: 대기 중";
        statusDisplay.className = "status-display status-stopped";
        startButton.disabled = false;
        stopButton.disabled = true;
        routeSelect.disabled = false;
      }
    } catch (error) {
      statusDisplay.textContent = "상태: 서버 연결 오류";
      statusDisplay.className = "status-display";
      startButton.disabled = true;
      stopButton.disabled = true;
      routeSelect.disabled = true; // New: 오류 시 경로 드롭다운 비활성화
    }
  }

  /**
   * "시동 ON / 운행 시작" 버튼 클릭 시 호출됩니다.
   */
  startButton.addEventListener("click", async () => {
    if (!selectedEmulatorId) {
      alert("차량을 먼저 선택해주세요.");
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
      updateStatus(); // 상태 업데이트하여 UI 반영 (버튼 및 드롭다운 활성화/비활성화)
    } catch (error) {
      console.error("시작 요청 실패:", error);
      alert(`시작 요청 중 오류가 발생했습니다: ${error.message}`);
    }
  });

  /**
   * "시동 OFF / 운행 중지" 버튼 클릭 시 호출됩니다.
   */
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
      updateStatus(); // 상태 업데이트하여 UI 반영 (버튼 및 드롭다운 활성화/비활성화)
    } catch (error) {
      console.error("중지 요청 실패:", error);
      alert(`중지 요청 중 오류가 발생했습니다: ${error.message}`);
    }
  });

  // New: 경로 드롭다운 값 변경 시 selectedRouteId 업데이트
  routeSelect.addEventListener("change", (event) => {
    selectedRouteId = event.target.value;
    // 경로 선택 후 UI 상태 (특히 시작 버튼 활성화 여부)를 업데이트합니다.
    updateStatus();
  });

  // 페이지 로드 시 에뮬레이터 목록 및 경로 목록 로드
  // 경로 목록을 먼저 로드해야, 차량 선택 시 드롭다운이 올바르게 채워질 수 있습니다.
  loadRouteList().then(() => {
    // 경로 목록 로드가 완료되면
    loadEmulatorList(); // 에뮬레이터 목록 로드 시작
  });

  emulatorControlContainer.style.display = "none"; // 초기에는 제어판 숨김
});
