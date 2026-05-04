(function () {
  const MOCK_DATA = window.MOCK;  // dùng chung từ mock_data.js
  const panel = document.getElementById("dashboardPanel");
  const toggleBtn = document.getElementById("dashboardToggleBtn");
  const kpiGrid = document.getElementById("kpiGrid");
  const inventoryChart = document.getElementById("inventoryChart");
  const abcMatrix = document.getElementById("abcMatrix");
  const ropAlerts = document.getElementById("ropAlerts");

  function mockRopItemsFromMaterials() {
    return MOCK_DATA.materials
      .filter((m) => Number(m.stock ?? m.on_hand ?? 0) <= Number(m.rop ?? 0))
      .map((m) => ({
        name: m.name,
        stock: Number(m.stock ?? m.on_hand ?? 0),
        code: m.code,
        rop: Number(m.rop ?? 0),
      }));
  }

  const matrixColors = {
    AX: { bg: "#d4edda", fg: "#155724" },
    AY: { bg: "#fff3cd", fg: "#856404" },
    AZ: { bg: "#f8d7da", fg: "#721c24" },
    BX: { bg: "#fff3cd", fg: "#856404" },
    BY: { bg: "#fff3cd", fg: "#856404" },
    BZ: { bg: "#f8d7da", fg: "#721c24" },
    CX: { bg: "#fde8d0", fg: "#7a4000" },
    CY: { bg: "#f8d7da", fg: "#721c24" },
    CZ: { bg: "#f8d7da", fg: "#721c24" }
  };

  const CELL_POLICIES = {
    AX: "Cần lên đơn định kỳ — nhu cầu ổn định, nên duy trì chu kỳ đặt hàng cố định.",
    AY: "Kết hợp đơn định kỳ và điều chỉnh theo mùa vụ / biến động vừa phải.",
    AZ: "Ưu tiên kiểm soát rủi ro: đặt hàng theo nhu cầu thực tế, tránh tồn quá mức.",
    BX: "Theo dõi tồn theo tuần; cân bằng giữa chi phí và mức dự phòng vừa phải.",
    BY: "Linh hoạt lịch đặt hàng theo kế hoạch sản xuất và tín hiệu tiêu thụ.",
    BZ: "Hạn chế tồn kho: ưu tiên nhập theo lệnh / đơn hàng cụ thể.",
    CX: "Có thể dùng min-max đơn giản; tập trung kiểm kê định kỳ.",
    CY: "Nhập lô nhỏ, theo dõi tồn gắn với đơn hàng thực tế.",
    CZ: "Chỉ nhập khi có đơn — tránh tồn chậm luân chuyển, nhu cầu khó dự báo."
  };

  /** Số lượng nhập gợi ý để sau nhập đạt mức an toàn khoảng 150% ROP. */
  function qtyToClearRopAlert(stock, rop) {
    const s = Number(stock) || 0;
    const r = Number(rop) || 0;
    if (r <= 0) return Math.max(1, Math.ceil(s * 0.5) || 1);
    const target = r * 1.5;
    const gap = target - s;
    if (gap <= 0) return Math.max(1, Math.ceil(r * 0.25) || 1);
    return Math.max(1, Math.ceil(gap));
  }

  /** Đặt mua dự phòng khi tồn còn trên ngưỡng nguy hiểm. */
  function suggestProactiveOrderQty(rop) {
    const r = Number(rop) || 0;
    if (r <= 0) return 1;
    return Math.max(1, Math.ceil(r * 0.25));
  }

  function cellManagementPolicy(cell) {
    return CELL_POLICIES[cell] || "Theo dõi tồn và điều chỉnh đặt hàng theo tín hiệu vận hành.";
  }

  function materialCellKey(m) {
    const a0 = String(m.abc_class || m.abc || "C").toUpperCase().charAt(0);
    const x0 = String(m.xyz_class || m.xyz || "Z").toUpperCase().charAt(0);
    const a = "ABC".includes(a0) ? a0 : "C";
    const x = "XYZ".includes(x0) ? x0 : "Z";
    return `${a}${x}`;
  }

  function aiSafetyStockFromRop(rop, xyzChar) {
    const f = { X: 0.38, Y: 0.48, Z: 0.58 }[xyzChar] || 0.5;
    const r = Math.max(0, Number(rop) || 0);
    if (r <= 0) return 0;
    return Math.round(r * f * 100) / 100;
  }

  function buildMockAbcXyzCell(cell) {
    const xyz = cell.charAt(1);
    const materials = MOCK_DATA.materials.filter((m) => materialCellKey(m) === cell);
    const items = materials.map((m) => {
      const stock = Number(m.stock ?? m.on_hand ?? 0);
      const rop = Number(m.rop ?? 0);
      const safety_stock = aiSafetyStockFromRop(rop, xyz);
      const low = rop > 0 && stock <= rop;
      const warn = rop > 0 && !low && stock <= rop + Math.max(safety_stock * 0.25, rop * 0.05);
      const danger = low || warn;
      return {
        code: m.code,
        name: m.name,
        unit: m.unit,
        stock,
        rop,
        safety_stock,
        cta_variant: danger ? "danger" : "safe",
        cta_label: "Đặt mua ngay",
        suggest_qty: danger ? qtyToClearRopAlert(stock, rop) : suggestProactiveOrderQty(rop)
      };
    });
    return { cell, management_policy: cellManagementPolicy(cell), items };
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;");
  }

  async function renderKpis() {
    let data;
    try {
      data = await window.WarehouseAPI.getDashboardKpis();
    } catch {
      const rop_alerts = MOCK_DATA.materials.filter(
        (m) => Number(m.stock ?? m.on_hand ?? 0) <= Number(m.rop ?? 0)
      ).length;
      data = { ...MOCK_DATA.kpis, rop_alerts };
    }
    const cards = [
      { icon: "📦", label: "Tổng số loại mặt hàng", value: data.total_skus ?? "-" },
      { icon: "💰", label: "Giá trị kho", value: data.total_value ?? "-" },
      { icon: "⚠️", label: "Cảnh báo điểm đặt hàng lại", value: data.rop_alerts ?? 0 },
      { icon: "📈", label: "Độ chính xác dự báo", value: data.forecast_accuracy ?? "-" }
    ];
    kpiGrid.innerHTML = cards
      .map((c) => {
        const warningBadge =
          c.label === "Cảnh báo điểm đặt hàng lại" && Number(c.value) > 0
            ? '<span class="badge pulse" style="background:#f8d7da;color:#721c24;margin-left:6px;">!</span>'
            : "";
        return `<div class="kpi-card"><div>${c.icon} ${c.label}${warningBadge}</div><div class="kpi-value">${c.value}</div></div>`;
      })
      .join("");
  }

  async function renderInventoryChart() {
    let items;
    try {
      const raw = await window.WarehouseAPI.getDashboardInventoryChart();
      items = Array.isArray(raw) ? raw : raw.items || [];
      if (!items.length) throw new Error("empty");
    } catch {
      items = MOCK_DATA.materials
        .map((m) => ({ ...m, _q: Number(m.stock ?? m.on_hand ?? 0) + Number(m.on_order ?? 0) }))
        .map((m) => ({ name: m.name, qty: m._q, rop: Number(m.rop || 0) }));
    }
    items = [...items].sort(
      (a, b) => {
        const qtyA = Number(a.value || a.qty || 0);
        const qtyB = Number(b.value || b.qty || 0);
        const ropA = Number(a.rop || 0);
        const ropB = Number(b.rop || 0);
        const targetA = ropA > 0 ? ropA * 2 : Math.max(qtyA, 1);
        const targetB = ropB > 0 ? ropB * 2 : Math.max(qtyB, 1);
        const ratioA = qtyA / targetA;
        const ratioB = qtyB / targetB;
        return ratioB - ratioA || qtyB - qtyA;
      }
    );
    inventoryChart.innerHTML = items
      .slice(0, 10)
      .map((item, idx) => {
        const qty = Number(item.value || item.qty || 0);
        const rop = Number(item.rop || 0);
        const target = rop > 0 ? rop * 2 : Math.max(qty, 1);
        const width = Math.max(0, Math.min(100, Math.round((qty / target) * 100)));
        return `<div class="bar-row"><div class="bar-name">${item.name || item.material || "-"}</div><div class="bar-track"><div class="bar-fill" data-width="${width}" style="transition-delay:${idx * 80}ms;"></div></div><div>${item.value || item.qty || 0}</div></div>`;
      })
      .join("");

    requestAnimationFrame(() => {
      inventoryChart.querySelectorAll(".bar-fill").forEach((bar) => {
        bar.style.width = `${bar.dataset.width}%`;
      });
    });
  }

  async function renderAbcMatrix() {
    if (!abcMatrix) return;
    let data;
    try { data = await window.WarehouseAPI.getDashboardAbcXyz(); }
    catch { data = MOCK_DATA.abcXyz; }
    const keys = ["AX", "AY", "AZ", "BX", "BY", "BZ", "CX", "CY", "CZ"];
    abcMatrix.innerHTML = keys
      .map((key) => {
        const value = data[key] ?? data[key.toLowerCase()] ?? 0;
        const color = matrixColors[key];
        return `<div class="matrix-cell matrix-cell--interactive" tabindex="0" role="button" data-matrix-cell="${key}" aria-label="Ô ${key}, ${value} vật tư, xem chi tiết" style="background:${color.bg};color:${color.fg};"><div><strong>${key}</strong></div><div>${value} vật tư</div></div>`;
      })
      .join("");

    abcMatrix.querySelectorAll("[data-matrix-cell]").forEach((cellEl) => {
      const key = cellEl.getAttribute("data-matrix-cell");
      cellEl.addEventListener("click", () => {
        void openMatrixCellForKey(key);
      });
      cellEl.addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        ev.preventDefault();
        void openMatrixCellForKey(key);
      });
    });
  }

  async function renderRopAlerts() {
    let items;
    try {
      const raw = await window.WarehouseAPI.getDashboardRopAlerts();
      items = Array.isArray(raw) ? raw : raw.items || [];
    } catch {
      items = mockRopItemsFromMaterials();
    }
    ropAlerts.innerHTML = items
      .map((item) => {
        const stock = Number(item.stock || item.qty || 0);
        const rop = Number(item.rop || 0);
        const suggest = qtyToClearRopAlert(stock, rop);
        return `
          <div class="rop-row">
            <div>${item.name || item.material || "-"}</div>
            <div class="muted">Tồn: ${stock} đơn vị</div>
            <button class="danger-btn" 
                    data-material="${item.code || item.material_code || ""}" 
                    data-suggest="${suggest}">
              🔴 Đặt mua ngay
            </button>
          </div>`;
      })
      .join("");

    ropAlerts.querySelectorAll(".danger-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.dispatchEvent(
          new CustomEvent("warehouse:navigate", {
            detail: { 
              view: "gr", 
              material: btn.dataset.material || "",
              quantity: btn.dataset.suggest || ""
            }
          })
        );
      });
    });
  }

  async function refreshDashboard() {
    // KHÔNG wrap bằng try/catch toàn cục — mỗi widget tự xử lý fallback
    await Promise.all([renderKpis(), renderInventoryChart(), renderAbcMatrix(), renderRopAlerts()]);
  }

  toggleBtn.addEventListener("click", () => {
    panel.classList.toggle("closed");
  });

  const matrixModal = document.getElementById("matrixCellModal");
  const matrixModalClose = document.getElementById("matrixCellModalClose");

  function hideMatrixCellModal() {
    if (!matrixModal) return;
    matrixModal.classList.add("is-hidden");
    matrixModal.setAttribute("aria-hidden", "true");
  }

  function showMatrixCellModal() {
    if (!matrixModal) return;
    matrixModal.classList.remove("is-hidden");
    matrixModal.setAttribute("aria-hidden", "false");
  }

  function renderMatrixCellModalContent(data) {
    const titleEl = document.getElementById("matrixCellModalTitle");
    const policyEl = document.getElementById("matrixCellModalPolicy");
    const bodyEl = document.getElementById("matrixCellModalBody");
    if (!titleEl || !policyEl || !bodyEl) return;

    const cell = data.cell || "";
    const items = Array.isArray(data.items) ? data.items : [];
    const policy = data.management_policy || cellManagementPolicy(cell);

    titleEl.textContent = `Chi tiết ô ${cell} (${items.length} vật tư)`;
    policyEl.innerHTML = `<div class="info-card"><strong>Gợi ý quản trị — nhóm ${escapeHtml(cell)}</strong><div class="muted" style="margin-top:6px;line-height:1.45;">${escapeHtml(policy)}</div></div>`;

    if (!items.length) {
      bodyEl.innerHTML =
        '<p class="muted" style="margin:12px 0 0;">Không có vật tư trong ô này (hoặc chưa có dữ liệu tồn kho).</p>';
      return;
    }

    const rows = items
      .map((row) => {
        const name = escapeHtml(row.name || "");
        const code = escapeHtml(row.code || "");
        const unit = escapeHtml(row.unit || "");
        const stock = Number(row.stock ?? 0);
        const rop = Number(row.rop ?? 0);
        const ss = Number(row.safety_stock ?? 0);
        const variant =
          row.cta_variant === "safe" || row.cta_variant === "danger"
            ? row.cta_variant
            : row.cta_type === "order_now" || row.cta_type === "watch"
              ? "danger"
              : "safe";
        const btnClass =
          variant === "danger" ? "danger-btn matrix-modal-cta" : "safe-order-btn matrix-modal-cta";
        const label = escapeHtml(row.cta_label || "Đặt mua ngay");
        const suggest =
          row.suggest_qty != null
            ? String(row.suggest_qty)
            : variant === "danger"
              ? String(qtyToClearRopAlert(stock, rop))
              : String(suggestProactiveOrderQty(rop));
        const actionHtml = `<button type="button" class="${btnClass}" data-material="${escapeAttr(row.code || "")}" data-suggest="${escapeAttr(suggest)}">${label}</button>`;
        return `<tr>
          <td><div class="matrix-modal-name">${name}</div><div class="muted matrix-modal-sub">${code} · ${unit}</div></td>
          <td class="num">${stock}</td>
          <td class="num">${rop}</td>
          <td class="num">${ss}</td>
          <td class="matrix-modal-action">${actionHtml}</td>
        </tr>`;
      })
      .join("");

    bodyEl.innerHTML = `<table class="matrix-modal-table" aria-label="Danh sách vật tư ô ${escapeHtml(cell)}">
      <thead><tr>
        <th>Vật tư</th>
        <th>Tồn thực tế</th>
        <th>ROP</th>
        <th>Tồn an toàn <span class="muted" style="font-weight:400;">(AI)</span></th>
        <th>Hành động</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

    bodyEl.querySelectorAll(".matrix-modal-cta").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.dispatchEvent(
          new CustomEvent("warehouse:navigate", {
            detail: {
              view: "gr",
              material: btn.dataset.material || "",
              quantity: btn.dataset.suggest || ""
            }
          })
        );
        hideMatrixCellModal();
      });
    });
  }

  async function openMatrixCellForKey(cellKey) {
    const key = String(cellKey || "")
      .trim()
      .toUpperCase();
    if (!/^[ABC][XYZ]$/.test(key)) return;
    let data;
    try {
      data = await window.WarehouseAPI.getDashboardAbcXyzCell(key);
    } catch {
      data = buildMockAbcXyzCell(key);
    }
    renderMatrixCellModalContent(data);
    showMatrixCellModal();
  }

  matrixModalClose?.addEventListener("click", hideMatrixCellModal);
  matrixModal?.addEventListener("click", (e) => {
    if (e.target === matrixModal) hideMatrixCellModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && matrixModal && !matrixModal.classList.contains("is-hidden")) {
      hideMatrixCellModal();
    }
  });

  window.WarehouseDashboard = {
    refreshDashboard
  };

  function readDashboardRefreshMs() {
    const fallbackSec = window.MOCK.settingsDefaults?.dashboard_refresh_sec ?? 60;
    try {
      const saved = JSON.parse(localStorage.getItem("warehouseai_settings") || "{}");
      const sec = Math.min(600, Math.max(15, Number(saved.dashboard_refresh_sec) || fallbackSec));
      return sec * 1000;
    } catch {
      return fallbackSec * 1000;
    }
  }

  function updateRefreshHint() {
    const el = document.getElementById("dashboardRefreshHint");
    if (!el) return;
    const sec = readDashboardRefreshMs() / 1000;
    el.textContent = `↻ tự làm mới sau ${Math.round(sec)} giây`;
  }

  refreshDashboard();
  updateRefreshHint();
  let dashboardInterval = setInterval(refreshDashboard, readDashboardRefreshMs());
  document.addEventListener("warehouse:settings-saved", () => {
    clearInterval(dashboardInterval);
    dashboardInterval = setInterval(refreshDashboard, readDashboardRefreshMs());
    updateRefreshHint();
  });
})();
