function normalizeBackendUrl(raw) {
  let s = String(raw || "").trim().replace(/\/+$/, "");
  if (!s) return "http://127.0.0.1:8001";
  if (/^\d+$/.test(s)) s = `http://127.0.0.1:${s}`;
  else if (/^(127\.0\.0\.1|localhost):\d+$/i.test(s)) s = `http://${s}`;
  else if (!/^https?:\/\//i.test(s)) {
    if (s.startsWith("//")) s = `http:${s}`;
    else if (s.startsWith(":")) s = `http://127.0.0.1${s}`;
  }
  return s.replace(/\/+$/, "");
}

function getBackendBaseUrl() {
  const fromQuery = new URLSearchParams(window.location.search).get("backend");
  const fromWindow = window.WAREHOUSE_BACKEND_URL;
  let fromStorage = null;
  try {
    fromStorage = localStorage.getItem("warehouseai_backend_url");
  } catch (_) {
    /* private mode / disabled storage */
  }

  if (fromQuery && String(fromQuery).trim()) {
    const normalized = normalizeBackendUrl(fromQuery);
    try {
      localStorage.setItem("warehouseai_backend_url", normalized);
    } catch (_) {}
    return normalized;
  }
  if (fromWindow) return normalizeBackendUrl(fromWindow);
  if (fromStorage) return normalizeBackendUrl(fromStorage);
  return normalizeBackendUrl("http://127.0.0.1:8001");
}

function apiUrl(path) {
  const base = getBackendBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  try {
    if (typeof window !== "undefined" && window.location && /^https?:$/i.test(window.location.protocol)) {
      const here = normalizeBackendUrl(window.location.origin);
      if (normalizeBackendUrl(base) === here) return p;
    }
  } catch (_) {
    /* ignore */
  }
  return `${normalizeBackendUrl(base)}${p}`;
}

async function apiRequest(url, options = {}) {
  const backend = getBackendBaseUrl();
  let res;
  try {
    res = await fetch(url, { ...options, mode: "cors" });
  } catch (e) {
    const isNetwork =
      e instanceof TypeError ||
      (e && e.name === "TypeError") ||
      (typeof e?.message === "string" && e.message.includes("fetch"));
    if (isNetwork) {
      throw new Error(
        `Không kết nối được tới backend (${backend}). ` +
          "Hãy chạy API (vd: uvicorn trong thư mục backend), đúng cổng, và thử thêm ?backend=http://127.0.0.1:<cổng> vào URL trang."
      );
    }
    throw e;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.detail;
    const msg =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => d.msg || JSON.stringify(d)).join("; ")
          : "Lỗi API";
    throw new Error(msg || "Lỗi API");
  }
  return data;
}

window.WarehouseAPI = {
  chat(payload) {
    return apiRequest(apiUrl("/api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },
  getInventory() {
    return apiRequest(apiUrl("/api/inventory"));
  },
  createGR(payload) {
    return apiRequest(apiUrl("/api/gr"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },
  createGI(payload) {
    return apiRequest(apiUrl("/api/gi"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },
  getPurchaseRequests() {
    return apiRequest(apiUrl("/api/purchase-requests"));
  },
  createPurchaseRequest(payload) {
    return apiRequest(apiUrl("/api/purchase-requests"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },
  approvePurchaseRequest(id) {
    return apiRequest(apiUrl(`/api/purchase-requests/${encodeURIComponent(id)}/approve`), {
      method: "POST"
    });
  },
  rejectPurchaseRequest(id) {
    return apiRequest(apiUrl(`/api/purchase-requests/${encodeURIComponent(id)}/reject`), {
      method: "POST"
    });
  },
  getDashboardKpis() {
    return apiRequest(apiUrl("/api/dashboard/kpis"));
  },
  getDashboardInventoryChart() {
    return apiRequest(apiUrl("/api/dashboard/inventory-chart"));
  },
  getDashboardAbcXyz() {
    return apiRequest(apiUrl("/api/dashboard/abc-xyz"));
  },
  getDashboardAbcXyzCell(cell) {
    const key = String(cell || "")
      .trim()
      .toUpperCase();
    return apiRequest(apiUrl(`/api/dashboard/abc-xyz/${encodeURIComponent(key)}`));
  },
  getDashboardRopAlerts() {
    return apiRequest(apiUrl("/api/dashboard/rop-alerts"));
  }
};
