(function () {
  const mainContent = document.getElementById("mainContent");
  const topTitle = document.getElementById("topTitle");
  const navList = document.getElementById("navList");
  const chatList = document.getElementById("chatList");
  const newChatBtn = document.getElementById("newChatBtn");
  const threadLabel = document.getElementById("threadLabel");

  let currentView = "chat";
  let sessions = JSON.parse(localStorage.getItem("warehouseai_sessions") || "[]");
  let activeSession = Number(localStorage.getItem("warehouseai_active_session") || "0");
  let inventoryData = [];

  const ROLE_CONFIG = {
    warehouse_staff: {
      label: "Nhân viên kho",
      intro:
        "<strong>Đã chọn vai trò: Nhân viên kho</strong><br>" +
        "Tôi có thể hỗ trợ bạn kiểm tra tồn kho nhanh, gợi ý vật tư cần báo kế hoạch nhập mua và tìm các mặt hàng còn sẵn để tư vấn cho khách hoặc bộ phận bán hàng.<br><br>" +
        "<strong>Gợi ý thao tác nhanh</strong><br>",
      prompts: [
        "Tư vấn khách về vật tư tiêu biểu",
        "Những vật tư nào đang dưới ROP cần báo kế hoạch mua?",
        "Dự báo nhu cầu Dầu nhớt ISO 46 kỳ tới",
        "Những mặt hàng nào còn tồn nhiều để tư vấn khách?",
        "Liệt kê các vật tư tồn thấp cần bổ sung sớm",
      ],
    },
    warehouse_manager: {
      label: "Quản lý kho",
      intro:
        "<strong>Đã chọn vai trò: Quản lý kho</strong><br>" +
        "Tôi có thể hỗ trợ bạn theo dõi tồn kho tổng quan, so sánh dự báo nhu cầu, kiểm tra cảnh báo ROP và tra cứu phân loại ABC/XYZ để phục vụ điều hành kho.<br><br>" +
        "<strong>Gợi ý câu hỏi nên dùng</strong><br>",
      prompts: [
        "Dự báo nhu cầu Dầu nhớt ISO 46 kỳ tới",
        "Những vật tư nào đang dưới ROP?",
        "Nhóm BX gồm những vật tư nào?",
        "Tóm tắt tình trạng tồn kho hiện tại",
      ],
    },
  };

  const SALES_ADVISORY_ITEMS = [
    {
      code: "HN-PP",
      name: "Hạt nhựa PP",
      summary: "Nhựa PP có độ bền cơ học khá, nhẹ, chịu ẩm tốt và phù hợp cho nhiều sản phẩm nhựa thông dụng.",
      applications: [
        "thùng nhựa, khay nhựa, nắp nhựa, hộp đựng công nghiệp",
        "chi tiết ép phun cho ngành gia dụng và bao bì",
      ],
      pitch:
        "Nếu khách cần vật liệu phổ thông, giá tốt, dễ gia công và ứng dụng rộng, bạn có thể nhấn mạnh PP là lựa chọn dễ triển khai cho nhiều dòng sản phẩm nhựa tiêu chuẩn.",
    },
    {
      code: "HN-ABS",
      name: "Hạt nhựa ABS",
      summary: "Nhựa ABS cứng hơn, bề mặt đẹp, chống va đập tốt và thường dùng cho sản phẩm cần độ hoàn thiện cao.",
      applications: [
        "vỏ thiết bị, khay kỹ thuật, linh kiện nhựa cứng",
        "chi tiết yêu cầu hình thức đẹp và độ bền va đập tốt",
      ],
      pitch:
        "Nếu khách quan tâm độ cứng, độ bóng bề mặt và cảm giác sản phẩm cao cấp hơn PP, bạn có thể tư vấn ABS như lựa chọn phù hợp cho nhóm sản phẩm kỹ thuật hoặc vỏ ngoài.",
    },
    {
      code: "PE-HN",
      name: "Túi PE hàn nhiệt",
      summary: "Túi PE hàn nhiệt phù hợp cho nhu cầu đóng gói, bảo quản và hàn miệng túi nhanh trong vận hành thực tế.",
      applications: [
        "đóng gói linh kiện, phụ kiện, thực phẩm khô hoặc bán thành phẩm",
        "bao bì nội bộ cho kho, xưởng và các đơn hàng đóng gói số lượng lớn",
      ],
      pitch:
        "Khi khách cần giải pháp đóng gói nhanh, gọn và chi phí hợp lý, bạn có thể nhấn mạnh loại túi này dễ sử dụng, tiện hàn miệng và phù hợp cho nhiều quy cách đóng gói.",
    },
    {
      code: "GK-100",
      name: "Giấy kraft 100gsm",
      summary: "Giấy kraft có độ dai khá, màu sắc tự nhiên và phù hợp cho nhóm bao bì cần cảm giác thân thiện, chắc chắn.",
      applications: [
        "bao gói, lót hàng, làm túi giấy hoặc cuộn đóng gói",
        "đơn vị cần bao bì mang tính mộc, bền và dễ in ấn cơ bản",
      ],
      pitch:
        "Nếu khách cần vật liệu bao bì nhìn thân thiện, dễ dùng và đủ chắc cho vận chuyển hoặc gói hàng, bạn có thể gợi ý giấy kraft như phương án cân bằng giữa hình thức và chi phí.",
    },
    {
      code: "BK-OPP",
      name: "Băng keo OPP",
      summary: "Băng keo OPP là vật tư đóng gói thông dụng, bám dính ổn định và phù hợp cho nhiều môi trường kho vận.",
      applications: [
        "dán thùng carton, niêm phong kiện hàng, đóng gói đơn bán lẻ",
        "vận hành kho thương mại điện tử hoặc kho thành phẩm",
      ],
      pitch:
        "Với khách đang cần vật tư tiêu hao dùng hằng ngày cho đóng gói, bạn có thể tư vấn OPP là lựa chọn dễ dùng, xoay vòng nhanh và luôn cần duy trì tồn ổn định.",
    },
    {
      code: "TT-3MM",
      name: "Thép tấm 3mm",
      summary: "Thép tấm 3mm phù hợp cho gia công cơ khí, làm khung, vỏ hoặc chi tiết cần độ cứng và độ ổn định tốt.",
      applications: [
        "vỏ máy, khung đỡ, chi tiết gia công cắt chấn hàn",
        "các hạng mục cơ khí dân dụng và công nghiệp nhẹ",
      ],
      pitch:
        "Nếu khách cần vật liệu nền cho gia công cơ khí, bạn có thể trao đổi theo hướng độ cứng, dễ cắt chấn hàn và phù hợp cho nhiều kết cấu phổ biến.",
    },
  ];

  const SALES_ADVISORY_KEYWORDS = [
    {
      keys: ["pp", "hat nhua pp"],
      summary: "Nhựa PP có độ bền cơ học khá, nhẹ, chịu ẩm tốt và phù hợp cho nhiều sản phẩm nhựa thông dụng.",
      applications: [
        "thùng nhựa, khay nhựa, nắp nhựa, hộp đựng công nghiệp",
        "chi tiết ép phun cho ngành gia dụng và bao bì",
      ],
      pitch:
        "Nếu khách cần vật liệu phổ thông, giá tốt, dễ gia công và ứng dụng rộng, bạn có thể nhấn mạnh đây là lựa chọn dễ triển khai cho nhiều dòng sản phẩm nhựa tiêu chuẩn.",
    },
    {
      keys: ["abs", "hat nhua abs"],
      summary: "Nhựa ABS cứng hơn, bề mặt đẹp, chống va đập tốt và thường dùng cho sản phẩm cần độ hoàn thiện cao.",
      applications: [
        "vỏ thiết bị, khay kỹ thuật, linh kiện nhựa cứng",
        "chi tiết yêu cầu hình thức đẹp và độ bền va đập tốt",
      ],
      pitch:
        "Nếu khách quan tâm độ cứng, độ bóng bề mặt và cảm giác sản phẩm cao cấp hơn, bạn có thể tư vấn đây là lựa chọn phù hợp cho nhóm sản phẩm kỹ thuật hoặc vỏ ngoài.",
    },
    {
      keys: ["pe", "tui pe", "han nhiet"],
      summary: "Vật tư PE phù hợp cho nhu cầu đóng gói, bảo quản và hàn miệng túi nhanh trong vận hành thực tế.",
      applications: [
        "đóng gói linh kiện, phụ kiện, thực phẩm khô hoặc bán thành phẩm",
        "bao bì nội bộ cho kho, xưởng và các đơn hàng đóng gói số lượng lớn",
      ],
      pitch:
        "Khi khách cần giải pháp đóng gói nhanh, gọn và chi phí hợp lý, bạn có thể nhấn mạnh loại này dễ sử dụng và phù hợp cho nhiều quy cách đóng gói.",
    },
    {
      keys: ["kraft", "giay kraft", "100gsm"],
      summary: "Giấy kraft có độ dai khá, màu sắc tự nhiên và phù hợp cho nhóm bao bì cần cảm giác thân thiện, chắc chắn.",
      applications: [
        "bao gói, lót hàng, làm túi giấy hoặc cuộn đóng gói",
        "đơn vị cần bao bì mang tính mộc, bền và dễ in ấn cơ bản",
      ],
      pitch:
        "Nếu khách cần vật liệu bao bì nhìn thân thiện, dễ dùng và đủ chắc cho vận chuyển hoặc gói hàng, bạn có thể gợi ý đây là phương án cân bằng giữa hình thức và chi phí.",
    },
    {
      keys: ["opp", "bang keo"],
      summary: "Đây là vật tư đóng gói thông dụng, bám dính ổn định và phù hợp cho nhiều môi trường kho vận.",
      applications: [
        "dán thùng carton, niêm phong kiện hàng, đóng gói đơn bán lẻ",
        "vận hành kho thương mại điện tử hoặc kho thành phẩm",
      ],
      pitch:
        "Với khách đang cần vật tư tiêu hao dùng hằng ngày cho đóng gói, bạn có thể tư vấn đây là lựa chọn dễ dùng, xoay vòng nhanh và luôn cần duy trì tồn ổn định.",
    },
    {
      keys: ["thep tam", "3mm", "thep"],
      summary: "Thép tấm phù hợp cho gia công cơ khí, làm khung, vỏ hoặc chi tiết cần độ cứng và độ ổn định tốt.",
      applications: [
        "vỏ máy, khung đỡ, chi tiết gia công cắt chấn hàn",
        "các hạng mục cơ khí dân dụng và công nghiệp nhẹ",
      ],
      pitch:
        "Nếu khách cần vật liệu nền cho gia công cơ khí, bạn có thể trao đổi theo hướng độ cứng, dễ cắt chấn hàn và phù hợp cho nhiều kết cấu phổ biến.",
    },
    {
      keys: ["dau nhot", "iso 46"],
      summary: "Đây là nhóm dầu bôi trơn công nghiệp dùng để giảm ma sát, làm mát và duy trì độ ổn định cho máy móc trong vận hành.",
      applications: [
        "bôi trơn thiết bị, hệ thống thủy lực hoặc máy công nghiệp phù hợp cấp dầu",
        "bảo trì định kỳ để giảm hao mòn và tăng tuổi thọ thiết bị",
      ],
      pitch:
        "Nếu khách đang quan tâm tính ổn định vận hành và bảo trì máy móc, bạn có thể nhấn mạnh lợi ích giảm hao mòn, vận hành êm hơn và hỗ trợ kéo dài vòng đời thiết bị.",
    },
    {
      keys: ["keo", "keo dan"],
      summary: "Keo dán công nghiệp phù hợp cho nhu cầu liên kết vật liệu, lắp ráp và hoàn thiện sản phẩm trong môi trường sản xuất.",
      applications: [
        "dán chi tiết kỹ thuật, bao bì hoặc linh kiện trong lắp ráp",
        "hỗ trợ các công đoạn cần bám dính chắc và thao tác nhanh",
      ],
      pitch:
        "Nếu khách cần giải pháp liên kết vật liệu nhanh và ổn định, bạn có thể trao đổi theo hướng độ bám dính, tính tiện dụng và khả năng đáp ứng sản xuất liên tục.",
    },
    {
      keys: ["muc in", "in cong nghiep"],
      summary: "Mực in công nghiệp phục vụ in nhãn, in bao bì hoặc đánh dấu trong quy trình sản xuất và đóng gói.",
      applications: [
        "in tem nhãn, in thông tin sản phẩm và bao bì",
        "đánh dấu lô, mã hàng hoặc thông tin vận hành",
      ],
      pitch:
        "Với khách cần giải pháp in ấn trong sản xuất, bạn có thể nhấn mạnh tính đồng đều màu in, khả năng phục vụ sản lượng lớn và sự phù hợp với môi trường công nghiệp.",
    },
    {
      keys: ["nhom dinh hinh", "nhom"],
      summary: "Nhôm định hình nhẹ, bền và phù hợp cho các kết cấu cần thẩm mỹ, độ chính xác và khả năng lắp ghép linh hoạt.",
      applications: [
        "khung máy, khung giá, kết cấu lắp ghép và che chắn thiết bị",
        "các ứng dụng cơ khí yêu cầu trọng lượng nhẹ hơn thép",
      ],
      pitch:
        "Nếu khách cần vật liệu vừa bền vừa nhẹ, dễ lắp ghép và nhìn gọn đẹp, bạn có thể tư vấn đây là lựa chọn rất phù hợp cho khung và kết cấu kỹ thuật.",
    },
  ];

  async function refreshInventoryFromApi() {
    try {
      const data = await window.WarehouseAPI.getInventory();
      const rows = Array.isArray(data) ? data : data.items || [];
      if (rows.length) inventoryData = rows;
    } catch {
      /* giữ inventoryData (mock hoặc bản sao trước đó) */
    }
  }

  function findInventoryRowByCode(code) {
    const n = String(code || "").trim().toLowerCase();
    return inventoryData.find((m) => String(m.code || "").trim().toLowerCase() === n);
  }

  /** Cùng công thức dashboard.js qtyToClearRopAlert — gợi ý SL đặt để đưa tồn về mức an toàn ~150% ROP. */
  function suggestReorderQty(stock, rop) {
    const s = Number(stock) || 0;
    const r = Number(rop) || 0;
    if (r <= 0) return Math.max(1, Math.ceil(s * 0.5) || 1);
    const target = r * 1.5;
    const gap = target - s;
    if (gap <= 0) return Math.max(1, Math.ceil(r * 0.25) || 1);
    return Math.max(1, Math.ceil(gap));
  }

  /** Cập nhật tồn cục bộ khi không gọi được API (hoặc demo offline). */
  function applyLocalGrGi(code, qty, isGR, qc) {
    const match = findInventoryRowByCode(code);
    if (!match || !(Number(qty) > 0)) return;
    const current = Number(match.stock ?? match.on_hand ?? 0);
    let next;
    if (isGR) {
      if (String(qc || "pass").toLowerCase() === "fail") return;
      next = current + Number(qty);
    } else {
      next = Math.max(0, current - Number(qty));
    }
    match.stock = next;
    match.on_hand = next;
  }

  function ensureSessions() {
    if (!sessions.length) {
      sessions = [createSession(1)];
    }
    sessions = sessions.map((session, idx) => normalizeSession(session, idx));
    if (activeSession >= sessions.length) activeSession = 0;
  }

  function createSession(index) {
    return { title: `Đoạn chat ${index}`, thread_id: "", messages: [], role: "" };
  }

  function normalizeSession(session, idx) {
    const normalized = session && typeof session === "object" ? { ...session } : {};
    return {
      title: String(normalized.title || `Đoạn chat ${idx + 1}`),
      thread_id: String(normalized.thread_id || ""),
      messages: Array.isArray(normalized.messages) ? normalized.messages : [],
      role: String(normalized.role || ""),
    };
  }

  function saveSessions() {
    localStorage.setItem("warehouseai_sessions", JSON.stringify(sessions));
    localStorage.setItem("warehouseai_active_session", String(activeSession));
  }

  function toast(text) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  function setActiveNav(view) {
    currentView = view;
    navList.querySelectorAll(".nav-item").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === view);
    });
    syncRoleBasedNavAccess();
  }

  function getCurrentSession() {
    return sessions[activeSession];
  }

  function getCurrentRole() {
    return getCurrentSession()?.role || "";
  }

  function isWarehouseStaffRole() {
    return getCurrentRole() === "warehouse_staff";
  }

  function isWarehouseManagerRole() {
    return getCurrentRole() === "warehouse_manager";
  }

  function canAccessPurchase() {
    return isWarehouseManagerRole();
  }

  function syncRoleBasedNavAccess() {
    const purchaseBtn = navList.querySelector('[data-view="purchase"]');
    if (!purchaseBtn) return;
    const restricted = !canAccessPurchase();
    purchaseBtn.classList.toggle("nav-item-restricted", restricted);
    purchaseBtn.title = restricted
      ? "Chỉ phiên chat đang chọn với vai trò Quản lý kho mới được vào phần Thu mua."
      : "";
  }

  function renderQuickPromptButtons(prompts) {
    return (prompts || [])
      .map(
        (prompt) =>
          `<button class="chat-action secondary quick-prompt" type="button" data-action="quick-prompt" data-prompt="${prompt.replace(/"/g, "&quot;")}">${prompt}</button>`
      )
      .join("");
  }

  function normalizeLookupText(text) {
    return String(text || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d");
  }

  function sentenceCaseFirst(text) {
    const raw = String(text || "").trim();
    if (!raw) return "";
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  function inferDefaultSupplier(materialName) {
    const name = normalizeLookupText(materialName);
    if (!name) return "";

    const rules = [
      { keys: ["pp", "abs", "hat nhua"], supplier: "Công ty TNHH Nhựa Việt Thắng" },
      { keys: ["dau nhot", "hoa dau", "iso 46"], supplier: "Công ty TNHH Hóa dầu Toàn Cầu" },
      { keys: ["keo", "hoa chat"], supplier: "Công ty CP Hóa chất Sài Gòn" },
      { keys: ["thep"], supplier: "Nhà máy Thép Việt Nhật" },
      { keys: ["muc in", "nhom"], supplier: "Công ty TNHH Vật tư Công nghiệp Miền Nam" },
      { keys: ["giay kraft", "tui pe", "pe", "bang keo"], supplier: "Công ty CP Bao bì Tiến Phát" },
    ];

    const matched = rules.find((rule) => rule.keys.some((key) => name.includes(key)));
    return matched?.supplier || "Công ty TNHH Vật tư Công nghiệp Miền Nam";
  }

  function buildRoleSelectionHtml() {
    return (
      "<div class=\"chat-onboarding\">" +
      "<strong>Xin chào! Tôi là WarehouseAI.</strong><br>" +
      "Để tôi gợi ý câu hỏi phù hợp hơn, bạn đang sử dụng hệ thống với vai trò nào?<br>" +
      "<button class=\"chat-action\" type=\"button\" data-action=\"set-role\" data-role=\"warehouse_staff\">1. Nhân viên kho</button>" +
      "<button class=\"chat-action secondary\" type=\"button\" data-action=\"set-role\" data-role=\"warehouse_manager\">2. Quản lý kho</button>" +
      "</div>"
    );
  }

  function buildRoleIntroHtml(roleKey) {
    const cfg = ROLE_CONFIG[roleKey];
    if (!cfg) return "";
    const prompts = cfg.prompts.filter((prompt) => prompt !== "Tư vấn khách về vật tư tiêu biểu");
    const salesButton =
      roleKey === "warehouse_staff"
        ? '<button class="chat-action quick-prompt sales-highlight" type="button" data-action="show-sales-materials">Tư vấn khách về vật tư tiêu biểu</button>'
        : "";
    return `${cfg.intro}${salesButton}${renderQuickPromptButtons(prompts)}`;
  }

  function buildSalesMaterialPickerHtml() {
    const optionList = getSalesMaterialOptions()
      .map((item) => `<option value="${item.name}"></option>`)
      .join("");
    const buttons = SALES_ADVISORY_ITEMS.map(
      (item) =>
        `<button class="chat-action secondary quick-prompt" type="button" data-action="sales-material" data-code="${item.code}">${item.name}</button>`
    ).join("");
    return (
      "<strong>Tư vấn khách theo vật tư tiêu biểu</strong><br>" +
      "Bạn có thể chọn nhanh một vật tư dưới đây để tôi gợi ý cách giới thiệu với khách hàng:<br>" +
      buttons +
      "<br><div class=\"sales-custom-picker\">" +
      '<div class="sales-input-wrap">' +
      `<input class="chat-inline-input sales-datalist-input" list="salesMaterialList" placeholder="Nhập mã hoặc tên vật tư tự chọn..." />` +
      `<datalist id="salesMaterialList">${optionList}</datalist>` +
      "</div>" +
      '<button class="chat-action secondary quick-prompt" type="button" data-action="sales-custom-material">Tư vấn vật tư tự chọn</button>' +
      "</div>"
    );
  }

  function getSalesMaterialOptions() {
    const source = inventoryData.length ? inventoryData : (window.MOCK?.materials || []);
    const seen = new Set();
    return source
      .map((item) => ({
        code: String(item.code || "").trim(),
        name: String(item.name || "").trim(),
      }))
      .filter((item) => {
        const key = `${item.code}__${item.name}`;
        if (!item.name || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }

  function resolveSalesAdviceData(query) {
    const normalized = normalizeLookupText(query);
    const predefined = SALES_ADVISORY_ITEMS.find(
      (entry) => entry.code === query || normalizeLookupText(entry.name) === normalized
    );
    if (predefined) return predefined;

    const material = (inventoryData.length ? inventoryData : (window.MOCK?.materials || [])).find((entry) => {
      const name = normalizeLookupText(entry.name);
      const code = normalizeLookupText(entry.code);
      return name === normalized || code === normalized || name.includes(normalized) || normalized.includes(name);
    });

    if (!material) return null;

    const matchedKeyword = SALES_ADVISORY_KEYWORDS.find((item) =>
      item.keys.some((key) => normalized.includes(key) || normalizeLookupText(material.name).includes(key))
    );

    return {
      code: material.code,
      name: material.name,
      summary:
        matchedKeyword?.summary ||
        `Đây là vật tư đang có trong hệ thống kho và phù hợp để tư vấn theo nhu cầu sử dụng thực tế của khách hàng.`,
      applications:
        matchedKeyword?.applications || [
          "cung ứng cho nhu cầu sản xuất hoặc đóng gói theo đúng nhóm vật tư tương ứng",
          "hỗ trợ khách hàng cần vật tư có sẵn để triển khai nhanh đơn hàng",
        ],
      pitch:
        matchedKeyword?.pitch ||
        "Khi tư vấn khách, bạn có thể đi theo hướng vật tư đang có sẵn, dễ triển khai và phù hợp cho nhu cầu sử dụng thực tế để giúp khách ra quyết định nhanh hơn.",
    };
  }

  function buildSalesAdviceHtml(query) {
    const item = resolveSalesAdviceData(query);
    if (!item) return "";
    const applications = item.applications.map((line) => `- ${sentenceCaseFirst(line)}<br>`).join("");
    return (
      `<strong>Tư vấn khách: ${item.name}</strong><br>` +
      `<strong>Vật tư này là gì?</strong><br>${item.summary}<br><br>` +
      "<strong>Có thể dùng để làm gì?</strong><br>" +
      applications +
      "<br>" +
      "<strong>Gợi ý cách nói với khách</strong><br>" +
      `${item.pitch}`
    );
  }

  async function appendLocalBotReply(text, html) {
    const current = getCurrentSession();
    await streamBotReply(text || "", html || "");
    current.messages.push({ role: "bot", text: text || "", html: html || "" });
    saveSessions();
  }

  async function appendLocalUserMessage(text) {
    const current = getCurrentSession();
    addMessage("user", text);
    current.messages.push({ role: "user", text });
    saveSessions();
  }

  function ensureWelcomeMessages(session) {
    if (session.messages.length) return;
    session.messages.push({
      role: "bot",
      text: "",
      html: buildRoleSelectionHtml(),
    });
  }

  function selectSessionRole(roleKey) {
    const session = getCurrentSession();
    const cfg = ROLE_CONFIG[roleKey];
    if (!cfg) return;

    session.role = roleKey;
    session.thread_id = "";
    session.messages.push({ role: "user", text: cfg.label });
    session.messages.push({
      role: "bot",
      text: "",
      html: buildRoleIntroHtml(roleKey),
    });
    saveSessions();
    syncRoleBasedNavAccess();
    if (!canAccessPurchase() && currentView === "purchase") {
      toast("Phiên chat này không có quyền vào Thu mua. Hãy chọn vai trò Quản lý kho cho phiên này.");
      route("chat");
      return;
    }
    if (currentView === "chat") renderChatView();
  }

  function renderChatList() {
    chatList.innerHTML = "";
    sessions.forEach((session, idx) => {
      const btn = document.createElement("button");
      btn.className = `chat-item ${idx === activeSession ? "active" : ""}`;
        btn.textContent = session.title;
        btn.onclick = () => {
          activeSession = idx;
          saveSessions();
          syncRoleBasedNavAccess();
          renderChatList();
          if (!canAccessPurchase() && currentView === "purchase") {
            toast("Phiên chat đang chọn không có quyền vào Thu mua.");
            route("chat");
            return;
          }
          route(currentView);
        };
        chatList.appendChild(btn);
      });
  }

  function parseStructuredReply(reply) {
    const raw = String(reply || "");
    const jsonBlock = raw.match(/```json\s*([\s\S]*?)```/i);
    let work = raw;
    let infoHtml = "";

    if (jsonBlock) {
      try {
        const parsed = JSON.parse(jsonBlock[1].trim());
        const isWarning = Boolean(parsed.warning || parsed.alert || parsed.level === "warning");
        const rows = Object.entries(parsed)
          .map(([k, v]) => `<div><strong>${k}:</strong> ${typeof v === "object" ? JSON.stringify(v) : v}</div>`)
          .join("");
        infoHtml = `<div class="info-card ${isWarning ? "warning" : ""}">${rows}</div>`;
      } catch {
        /* ignore malformed json */
      }
      work = raw.replace(jsonBlock[0], "").trim();
    }

    const hasRichText = /<(strong|b|br)\b[^>]*>/i.test(work);
    const hasInlineActions = /<button[^>]*class="[^"]*chat-action/i.test(work);
    if (hasInlineActions) {
      return { text: "", html: (infoHtml || "") + work };
    }
    if (hasRichText) {
      return { text: "", html: (infoHtml || "") + work };
    }

    const actionButtons = work.match(/<button\s+class="chat-action"[\s\S]*?<\/button>/gi) || [];
    const text = work
      .replace(/<button\s+class="chat-action"[\s\S]*?<\/button>/gi, "")
      .replace(/\n\s*\n\s*\n/g, "\n\n")
      .trim();

    if (!jsonBlock) {
      return { text, html: actionButtons.join(" ") };
    }
    return {
      text,
      html: `${infoHtml}${actionButtons.length ? `<div style="margin-top:8px;">${actionButtons.join(" ")}</div>` : ""}`
    };
  }

  function attachDeclineActionButtons(container) {
    if (!container) return;
    const orderButtons = container.querySelectorAll('.chat-action[data-action="order"]');
    // Chỉ thêm nút "Không" nếu có DUY NHẤT 1 nút đặt hàng (hỏi về 1 mặt hàng)
    if (orderButtons.length !== 1) return;

    orderButtons.forEach((btn) => {
      const next = btn.nextElementSibling;
      if (next && next.matches('.chat-action[data-action="dismiss-order"]')) return;
      const denyBtn = document.createElement("button");
      denyBtn.className = "chat-action secondary";
      denyBtn.type = "button";
      denyBtn.dataset.action = "dismiss-order";
      denyBtn.textContent = "Không";
      btn.insertAdjacentElement("afterend", denyBtn);
    });
  }

  function addMessage(role, text, html) {
    const messages = document.getElementById("messages");
    const messagesInner = document.getElementById("messagesInner");
    const row = document.createElement("div");
    row.className = `msg-row ${role === "user" ? "user" : "bot"}`;
    const bubble = document.createElement("div");
    bubble.className = `bubble ${role === "user" ? "user" : "bot"}`;
    const t = String(text || "").trim();
    if (role === "bot" && !t && html) {
      bubble.innerHTML = html;
      attachDeclineActionButtons(bubble);
    } else {
      bubble.textContent = text || "";
      if (html) {
        bubble.innerHTML += `<div style="margin-top:8px;">${html}</div>`;
        attachDeclineActionButtons(bubble);
      }
    }
    if (role !== "user") {
      const avatar = document.createElement("div");
      avatar.className = "bot-avatar";
      avatar.textContent = "🏭";
      row.appendChild(avatar);
    }
    row.appendChild(bubble);
    messagesInner.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
  }

  function addThinkingBubble() {
    const messages = document.getElementById("messages");
    const messagesInner = document.getElementById("messagesInner");
    const row = document.createElement("div");
    row.className = "msg-row bot";
    const avatar = document.createElement("div");
    avatar.className = "bot-avatar";
    avatar.textContent = "🏭";
    const bubble = document.createElement("div");
    bubble.className = "bubble bot thinking-bubble";
    bubble.innerHTML = '<div class="thinking" aria-label="WarehouseAI đang suy nghĩ"><span></span><span></span><span></span></div>';
    row.appendChild(avatar);
    row.appendChild(bubble);
    messagesInner.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
    return { row };
  }

  async function streamBotReply(text, html) {
    const messages = document.getElementById("messages");
    const t = String(text || "").trim();
    if (!t && html) {
      addMessage("bot", "", html);
      messages.scrollTop = messages.scrollHeight;
      return;
    }
    const bubble = addMessage("bot", "");
    let i = 0;
    while (i <= text.length) {
      bubble.textContent = text.slice(0, i);
      i += Math.max(1, Math.floor(text.length / 120));
      messages.scrollTop = messages.scrollHeight;
      await new Promise((r) => setTimeout(r, 8));
    }
    bubble.textContent = text;
    if (html) {
      bubble.innerHTML = text ? `${bubble.textContent}<div style="margin-top:8px;">${html}</div>` : html;
      attachDeclineActionButtons(bubble);
    }
  }

  async function sendPrompt(prompt) {
    const current = getCurrentSession();
    addMessage("user", prompt);
    current.messages.push({ role: "user", text: prompt });
    const input = document.getElementById("input");
    const send = document.getElementById("send");
    input.value = "";
    input.disabled = true;
    send.disabled = true;
    const thinking = addThinkingBubble();
    try {
      const data = await window.WarehouseAPI.chat({ message: prompt, thread_id: current.thread_id || null });
      current.thread_id = data.thread_id;
      threadLabel.textContent = current.thread_id ? `Phiên hội thoại: ${current.thread_id}` : "";
      thinking.row.remove();
      const parsed = parseStructuredReply(data.reply || "");
      await streamBotReply(parsed.text, parsed.html);
      current.messages.push({ role: "bot", text: parsed.text, html: parsed.html });
      saveSessions();
    } catch (err) {
      thinking.row.remove();
      addMessage("bot", `Lỗi: ${err.message}`);
      current.messages.push({ role: "bot", text: `Lỗi: ${err.message}` });
      saveSessions();
    } finally {
      input.disabled = false;
      send.disabled = false;
      input.focus();
    }
  }

  function renderChatView() {
    topTitle.innerHTML = '<span class="dot"></span>WarehouseAI — Trợ lý Quản lý Kho';
    mainContent.innerHTML = `
      <div class="view-wrap">
        <div id="messages"><div class="messages-inner" id="messagesInner"></div></div>
        <div class="composer-wrap">
          <form class="composer" id="form">
            <input id="input" placeholder="Hỏi về tồn kho, dự báo, đặt mua..." />
            <button id="send" type="submit">Gửi</button>
          </form>
        </div>
      </div>
    `;
    const current = getCurrentSession();
    ensureWelcomeMessages(current);
    saveSessions();
    current.messages.forEach((m) => addMessage(m.role, m.text, m.html));
    threadLabel.textContent = current.thread_id ? `Phiên hội thoại: ${current.thread_id}` : "";
    document.getElementById("form").addEventListener("submit", (e) => {
      e.preventDefault();
      const prompt = document.getElementById("input").value.trim();
      if (!prompt) return;
      sendPrompt(prompt);
    });
  }

  function renderPurchaseRestrictedView() {
    topTitle.innerHTML = '<span class="dot"></span>WarehouseAI — Thu mua';
    mainContent.innerHTML = `
      <div class="table-wrap">
        <div class="role-restricted-card">
          <h3>Phần Thu mua chỉ mở cho phiên chat có vai trò Quản lý kho</h3>
          <p>Phiên chat hiện tại chưa có quyền Thu mua. Nếu đây là phiên của Nhân viên kho thì chỉ có thể gửi yêu cầu vật tư chờ duyệt; nếu cần xem và duyệt yêu cầu, hãy chọn vai trò Quản lý kho cho đúng phiên chat này.</p>
        </div>
      </div>`;
  }

  function renderInventoryTable() {
    topTitle.innerHTML = '<span class="dot"></span>WarehouseAI — Tồn kho';
    mainContent.innerHTML = `
      <div class="table-wrap">
        <div class="inventory-controls">
          <input class="search-input" id="inventorySearch" placeholder="Tìm mã vật tư hoặc tên vật tư..." />
          <button class="chip active" data-filter="all">Tất cả</button>
          <button class="chip" data-filter="alert">⚠️ Cảnh báo</button>
          <button class="chip" data-filter="A">Nhóm A</button>
          <button class="chip" data-filter="B">Nhóm B</button>
          <button class="chip" data-filter="C">Nhóm C</button>
        </div>
        <table>
          <thead>
            <tr><th>Mã vật tư</th><th>Tên vật tư</th><th>Đơn vị tính</th><th>Tồn kho</th><th>Đặt mua</th><th>Điểm đặt hàng lại</th><th>Trạng thái</th><th>Phân loại ABC</th></tr>
          </thead>
          <tbody id="inventoryTbody"></tbody>
        </table>
      </div>
    `;
    let activeFilter = "all";
    const searchEl = document.getElementById("inventorySearch");
    const tbody = document.getElementById("inventoryTbody");
    const chips = Array.from(mainContent.querySelectorAll(".chip"));

    const statusBadge = (stock, rop) => {
      if (Number(stock) <= Number(rop) * 0.5) return '<span class="badge" style="background:#f8d7da;color:#721c24;">🔴 Nguy hiểm</span>';
      if (Number(stock) <= Number(rop)) return '<span class="badge" style="background:#fff3cd;color:#856404;">🟠 Sắp hết</span>';
      return '<span class="badge" style="background:#d4edda;color:#155724;">🟢 An toàn</span>';
    };

    const renderRows = () => {
      const keyword = searchEl.value.trim().toLowerCase();
      const rows = inventoryData.filter((item) => {
        const txt = `${item.code || ""} ${item.name || ""}`.toLowerCase();
        const stock = Number(item.stock || item.on_hand || 0);
        const rop = Number(item.rop || 0);
        const level = String(item.abc || "").toUpperCase();
        if (keyword && !txt.includes(keyword)) return false;
        if (activeFilter === "alert" && !(stock <= rop)) return false;
        if (["A", "B", "C"].includes(activeFilter) && level !== activeFilter) return false;
        return true;
      });

      tbody.innerHTML = rows
        .map(
          (item) =>
            `<tr><td>${item.code || ""}</td><td>${item.name || ""}</td><td>${item.unit || ""}</td><td>${item.stock || item.on_hand || 0}</td><td>${item.on_order || 0}</td><td>${item.rop || 0}</td><td>${statusBadge(item.stock || item.on_hand || 0, item.rop || 0)}</td><td>${item.abc || "-"}</td></tr>`
        )
        .join("");
    };

    searchEl.addEventListener("input", renderRows);
    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        activeFilter = chip.dataset.filter;
        chips.forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        renderRows();
      });
    });
    renderRows();
  }

  function renderFormView(kind, prefill = {}) {
    const isGR = kind === "gr";
    const requestOnly = isWarehouseStaffRole();
    topTitle.innerHTML = `<span class="dot"></span>WarehouseAI — ${isGR ? "Nhập kho" : "Xuất kho"}`;
    mainContent.innerHTML = `
      <div class="form-wrap">
        <form class="form-card" id="${kind}Form">
          ${
            requestOnly
              ? `<div class="role-notice"><strong>Chế độ Nhân viên kho:</strong> thao tác này sẽ được gửi sang Thu mua để Quản lý kho duyệt, chưa cập nhật trực tiếp tồn kho.</div>`
              : ""
          }
          <div class="form-grid">
            ${
              isGR
                ? `<label class="field"><span>Mã vật tư</span><input name="material_code" list="materialList" value="${prefill.material || ""}" /></label>
                   <label class="field"><span>Tên vật tư</span><input name="material_name" /></label>
                   <label class="field"><span>Số lượng</span><input name="quantity" type="number" min="0" value="${prefill.quantity || ""}" /></label>
                   <label class="field"><span>Đơn vị tính</span><input name="unit" /></label>
                   <label class="field"><span>Nhà cung cấp</span><input name="supplier" /></label>
                   <label class="field"><span>Ngày nhập</span><input name="date" type="date" value="${new Date().toISOString().split('T')[0]}" /></label>
                   <label class="field full"><span>Kiểm tra chất lượng</span>
                     <select name="qc"><option value="pass">Đạt ✅</option><option value="fail">Không đạt ❌</option></select>
                   </label>
                   <label class="field full"><span>Ghi chú</span><textarea name="notes"></textarea></label>`
                : `<label class="field"><span>Mã lệnh sản xuất</span><input name="production_order_code" /></label>
                   <label class="field"><span>Mã vật tư</span><input name="material_code" list="materialList" value="${prefill.material || ""}" /></label>
                   <label class="field"><span>Số lượng</span><input name="quantity" type="number" min="0" /></label>
                   <label class="field"><span>Người xuất</span><input name="issued_by" /></label>
                   <label class="field"><span>Ngày xuất</span><input name="date" type="date" /></label>
                   <label class="field full"><span>Ghi chú</span><textarea name="notes"></textarea></label>`
            }
          </div>
          <datalist id="materialList">${inventoryData.map((m) => `<option value="${m.code || ""}">  ${m.name || ""}</option>`).join("")}</datalist>
          ${isGR ? '<button class="autofill-btn" id="grAutofillBtn" type="button">🪄 Tự động điền</button>' : ""}
          <button class="submit-btn" type="submit">${isGR ? (requestOnly ? "Gửi yêu cầu nhập vật tư" : "Xác nhận Nhập kho") : (requestOnly ? "Gửi yêu cầu xuất vật tư" : "Xác nhận Xuất kho")}</button>
        </form>
      </div>
    `;
    const form = document.getElementById(`${kind}Form`);

    // ── Autocomplete 2 chiều: Mã VT ↔ Tên vật tư ──────────────────────────
    const codeInput = form.querySelector('[name="material_code"]');
    const nameInput = form.querySelector('[name="material_name"]');
    const unitInput = form.querySelector('[name="unit"]');
    const supplierInput = form.querySelector('[name="supplier"]');

    function applyMaterialAutofill(found) {
      if (!found) return;
      if (nameInput) nameInput.value = found.name || "";
      if (codeInput) codeInput.value = found.code || "";
      if (unitInput) unitInput.value = found.unit || "";
      if (supplierInput) supplierInput.value = inferDefaultSupplier(found.name || "");
    }

    if (codeInput && nameInput) {
      // Khi code thay đổi → tìm và điền tên + ĐVT
      codeInput.addEventListener("input", () => {
        const found = window.MOCK.materials.find(
          m => m.code.toLowerCase() === codeInput.value.trim().toLowerCase()
        );
        if (found) {
          applyMaterialAutofill(found);
        }
      });

      // Khi tên thay đổi → tìm và điền mã + ĐVT
      nameInput.addEventListener("input", () => {
        const found = window.MOCK.materials.find(
          m => m.name.toLowerCase() === nameInput.value.trim().toLowerCase()
        );
        if (found) {
          applyMaterialAutofill(found);
        }
      });
    }

    // ── Thêm datalist cho Tên vật tư ────────────────────────────────────────
    const nameDL = document.createElement("datalist");
    nameDL.id = "materialNameList";
    nameDL.innerHTML = window.MOCK.materials
      .map(m => `<option value="${m.name}"></option>`)
      .join("");
    form.appendChild(nameDL);
    if (nameInput) nameInput.setAttribute("list", "materialNameList");

    // ── Dropdown nhà cung cấp (GR form only) ────────────────────────────────
    if (supplierInput) {
      const supplierDL = document.createElement("datalist");
      supplierDL.id = "supplierList";
      supplierDL.innerHTML = window.MOCK.suppliers
        .map(s => `<option value="${s}"></option>`)
        .join("");
      form.appendChild(supplierDL);
      supplierInput.setAttribute("list", "supplierList");
    }

    // ── Dropdown người xuất (GI form only) ──────────────────────────────────
    const issuedByInput = form.querySelector('[name="issued_by"]');
    if (issuedByInput) {
      const staffDL = document.createElement("datalist");
      staffDL.id = "staffList";
      staffDL.innerHTML = window.MOCK.staff
        .map(s => `<option value="${s}"></option>`)
        .join("");
      form.appendChild(staffDL);
      issuedByInput.setAttribute("list", "staffList");
    }

    // ── Dropdown mã lệnh sản xuất (GI form only) ────────────────────────────
    const poInput = form.querySelector('[name="production_order_code"]');
    if (poInput) {
      const poDL = document.createElement("datalist");
      poDL.id = "poList";
      poDL.innerHTML = window.MOCK.productionOrders
        .map(p => `<option value="${p}"></option>`)
        .join("");
      form.appendChild(poDL);
      poInput.setAttribute("list", "poList");
    }

    // ── Nếu prefill.material khớp 1 mã → auto điền tên + ĐVT ngay khi mở ──
    if (prefill.material) {
      const found = window.MOCK.materials.find(m => m.code === prefill.material);
      if (found) {
        applyMaterialAutofill(found);
      }
    }

    if (isGR) {
      const autoFillBtn = document.getElementById("grAutofillBtn");
      autoFillBtn?.addEventListener("click", () => {
        const code = String(codeInput?.value || "").trim().toLowerCase();
        if (!code) {
          toast("Nhập mã vật tư trước khi tự động điền");
          return;
        }
        const found = inventoryData.find((m) => String(m.code || "").trim().toLowerCase() === code);
        if (!found) {
          toast("Không tìm thấy mã vật tư trong dữ liệu tồn kho");
          return;
        }
        applyMaterialAutofill(found);
        const qtyInput = form.querySelector('[name="quantity"]');
        const suggestedQty = Math.max(0, Number(found.rop || 0) - Number(found.stock || found.on_hand || 0));
        if (qtyInput) qtyInput.value = String(suggestedQty);
        toast("Đã tự động điền thông tin vật tư");
      });
    }

    // ── GR/GI offline mock: nếu submit mà API lỗi → giả lập thành công ─────
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = Object.fromEntries(new FormData(form).entries());
      const code = String(payload.material_code || "");
      const qty = Number(payload.quantity) || 0;
      const inventoryMatch = inventoryData.find((m) => String(m.code || "").trim().toLowerCase() === code.trim().toLowerCase())
        || window.MOCK.materials.find((m) => String(m.code || "").trim().toLowerCase() === code.trim().toLowerCase());
      const materialName = String(payload.material_name || inventoryMatch?.name || payload.material_code || "").trim();

      if (requestOnly) {
        try {
          await window.WarehouseAPI.createPurchaseRequest({
            material_code: code || null,
            material: materialName || null,
            quantity: qty,
            supplier: isGR ? (payload.supplier || "") : "",
          });
          toast("Đã gửi yêu cầu vật tư sang Thu mua để Quản lý kho duyệt");
          form.reset();
          return;
        } catch (err) {
          toast(`Không gửi được yêu cầu: ${err.message}`);
          return;
        }
      }

      let apiOk = false;
      try {
        if (isGR) {
          await window.WarehouseAPI.createGR(payload);
        } else {
          await window.WarehouseAPI.createGI(payload);
        }
        apiOk = true;
      } catch {
        applyLocalGrGi(code, qty, isGR, payload.qc);
        await new Promise((r) => setTimeout(r, 400));
      }

      if (apiOk) {
        await refreshInventoryFromApi();
      }

      toast(isGR ? "✅ Nhập kho thành công" : "✅ Xuất kho thành công");
      form.reset();

      if (currentView === "inventory") {
        renderInventoryTable();
      }
      if (window.WarehouseDashboard) {
        await window.WarehouseDashboard.refreshDashboard();
      }
    });
  }

  async function renderPurchaseView() {
    if (!canAccessPurchase()) {
      renderPurchaseRestrictedView();
      return;
    }
    topTitle.innerHTML = '<span class="dot"></span>WarehouseAI — Thu mua';
    mainContent.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mã yêu cầu mua hàng</th>
              <th>Vật tư</th>
              <th style="text-align:center;">Số lượng</th>
              <th>Nhà cung cấp</th>
              <th>Ngày tạo</th>
              <th style="text-align:center;">Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody id="purchaseTbody"></tbody>
        </table>
      </div>`;
    const tbody = document.getElementById("purchaseTbody");
    let items;
    try {
      const data = await window.WarehouseAPI.getPurchaseRequests();
      items = Array.isArray(data) ? data : data.items || [];
      if (!items.length) throw new Error("empty");
    } catch {
      items = window.MOCK.purchaseRequests;  // fallback
    }
    const statusLabel = (s) => {
      const baseStyle = "display:inline-flex;align-items:center;justify-content:center;min-width:100px;padding:6px 12px;border-radius:999px;font-weight:600;font-size:12px;";
      if (s === "approved") return `<span class="badge" style="${baseStyle}background:#d4edda;color:#155724;">Đã duyệt</span>`;
      if (s === "rejected") return `<span class="badge" style="${baseStyle}background:#f8d7da;color:#721c24;">Từ chối</span>`;
      return `<span class="badge" style="${baseStyle}background:#fff3cd;color:#856404;">Chờ duyệt</span>`;
    };
    tbody.innerHTML = items
      .map(
        (it) => {
          const actionHtml = it.status === "pending"
            ? `<div style="display:flex; gap:8px; align-items:center;">
                <button class="chip purchase-action" data-action="approve" data-id="${it.id}" style="color:#155724;background:#d4edda;border-color:#d4edda;margin:0;min-width:70px;text-align:center;">Duyệt</button>
                <button class="chip purchase-action" data-action="reject" data-id="${it.id}" style="color:#721c24;background:#f8d7da;border-color:#f8d7da;margin:0;min-width:70px;text-align:center;">Từ chối</button>
              </div>`
            : '<span class="muted">Đã xử lý</span>';
          return (
          `<tr>
            <td>${it.pr_code || it.id || ""}</td>
            <td>${it.material || it.material_name || ""}</td>
            <td style="text-align:center;">${it.quantity || 0}</td>
            <td>${it.supplier || ""}</td>
            <td>${it.created_at || ""}</td>
            <td style="text-align:center;">${statusLabel(it.status)}</td>
            <td>${actionHtml}</td>
          </tr>`
          );
        }
      )
      .join("");

    tbody.querySelectorAll(".purchase-action").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        if (!id || !action) return;
        btn.disabled = true;
        try {
          if (action === "approve") {
            await window.WarehouseAPI.approvePurchaseRequest(id);
            toast("Đã duyệt yêu cầu mua hàng");
          } else {
            await window.WarehouseAPI.rejectPurchaseRequest(id);
            toast("Đã từ chối yêu cầu mua hàng");
          }
          await refreshInventoryFromApi();
          if (window.WarehouseDashboard) {
            await window.WarehouseDashboard.refreshDashboard();
          }
          await renderPurchaseView();
        } catch (err) {
          btn.disabled = false;
          toast(`Không cập nhật được trạng thái: ${err.message}`);
        }
      });
    });
  }

  function loadSettings() {
    const defaults = { ...window.MOCK.settingsDefaults };
    try {
      const saved = JSON.parse(localStorage.getItem("warehouseai_settings") || "{}");
      return { ...defaults, ...saved };
    } catch {
      return defaults;
    }
  }

  function saveSettings(obj) {
    localStorage.setItem("warehouseai_settings", JSON.stringify(obj));
  }

  function renderProductionView() {
    topTitle.innerHTML = '<span class="dot"></span>WarehouseAI — Sản xuất';
    const rows = window.MOCK.productionWorkOrders || [];
    const statusLabel = (s) => {
      if (s === "done") return '<span class="badge" style="background:#d4edda;color:#155724;">Hoàn thành</span>';
      if (s === "running") return '<span class="badge" style="background:#cfe8ff;color:#0b4f8c;">Đang chạy</span>';
      if (s === "planned") return '<span class="badge" style="background:#e8e8e8;color:#444;">Kế hoạch</span>';
      return `<span class="badge">${s || "-"}</span>`;
    };
    mainContent.innerHTML = `
      <div class="table-wrap">
        <p class="muted" style="margin:0 0 12px;">Tiến độ lệnh sản xuất (dữ liệu mẫu)</p>
        <table>
          <thead>
            <tr>
              <th>Mã LSX</th><th>Sản phẩm</th><th>Kế hoạch</th><th>Đã làm</th><th>Tiến độ</th>
              <th>Chuyền / tổ</th><th>Trạng thái</th><th>Hạn hoàn thành</th>
            </tr>
          </thead>
          <tbody id="productionTbody"></tbody>
        </table>
      </div>`;
    const tbody = document.getElementById("productionTbody");
    tbody.innerHTML = rows
      .map((w) => {
        const planned = Number(w.qty_planned) || 0;
        const done = Number(w.qty_done) || 0;
        const pct = planned ? Math.min(100, Math.round((done / planned) * 100)) : 0;
        return `<tr>
          <td>${w.code || ""}</td>
          <td>${w.product || ""}</td>
          <td>${planned}</td>
          <td>${done}</td>
          <td>${pct}%</td>
          <td>${w.line || ""}</td>
          <td>${statusLabel(w.status)}</td>
          <td>${w.due_date || ""}</td>
        </tr>`;
      })
      .join("");
  }

  function renderSuppliersView() {
    topTitle.innerHTML = '<span class="dot"></span>WarehouseAI — Nhà cung cấp';
    const rows = window.MOCK.supplierRecords || [];
    mainContent.innerHTML = `
      <div class="table-wrap">
        <p class="muted" style="margin:0 0 12px;">Danh mục nhà cung cấp (dữ liệu mẫu)</p>
        <table>
          <thead>
            <tr>
              <th>Tên</th><th>MST</th><th>Điện thoại</th><th>Địa chỉ</th><th>Lead time (ngày)</th><th>Ghi chú</th>
            </tr>
          </thead>
          <tbody id="suppliersTbody"></tbody>
        </table>
      </div>`;
    const tbody = document.getElementById("suppliersTbody");
    tbody.innerHTML = rows
      .map(
        (s) =>
          `<tr>
            <td>${s.name || ""}</td>
            <td>${s.tax_id || ""}</td>
            <td>${s.phone || ""}</td>
            <td>${s.address || ""}</td>
            <td>${s.lead_days != null ? s.lead_days : ""}</td>
            <td>${s.note || ""}</td>
          </tr>`
      )
      .join("");
  }

  function renderSettingsView() {
    topTitle.innerHTML = '<span class="dot"></span>WarehouseAI — Cài đặt';
    const s = loadSettings();
    mainContent.innerHTML = `
      <div class="form-wrap">
        <form class="form-card" id="settingsForm">
          <div style="display:flex; flex-direction:column; gap:32px;">
            
            <section>
              <h3 style="margin-top:0; font-size:16px; border-bottom:1px solid var(--line); padding-bottom:10px;">Giao diện & Hệ thống</h3>
              <div class="form-grid">
                <label class="field full"><span>Tên công ty hiển thị</span>
                  <input name="company_name" type="text" autocomplete="organization" />
                </label>
                <label class="field"><span>Ngôn ngữ giao diện</span>
                  <select name="language">
                    <option value="vi">Tiếng Việt</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <label class="field"><span>Tiền tệ hiển thị</span>
                  <select name="currency">
                    <option value="VND">VNĐ (đ)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </label>
                <label class="field"><span>Chủ đề (Theme)</span>
                  <select name="theme">
                    <option value="light">Sáng (Light)</option>
                    <option value="dark">Tối (Dark) - Sắp có</option>
                  </select>
                </label>
                <label class="field"><span>Số chữ số thập phân</span>
                  <input name="decimal_places" type="number" min="0" max="4" />
                </label>
              </div>
            </section>

            <section>
              <h3 style="font-size:16px; border-bottom:1px solid var(--line); padding-bottom:10px;">Hiệu suất & Thông báo</h3>
              <div class="field-row">
                <div class="field-info">
                  <span class="title">Tự làm mới (60 giây)</span>
                  <span class="desc">Tần suất cập nhật dữ liệu bảng tổng quan</span>
                </div>
                <input name="dashboard_refresh_sec" type="number" min="15" max="600" style="width:120px;" />
              </div>
              
              <div class="field-row">
                <div class="field-info">
                  <span class="title">Thông báo tồn kho thấp</span>
                  <span class="desc">Cảnh báo khi vật tư xuống dưới điểm đặt hàng lại (ROP)</span>
                </div>
                <label class="switch">
                  <input name="low_stock_notify" type="checkbox" />
                  <span class="slider"></span>
                </label>
              </div>

              <div class="field-row">
                <div class="field-info">
                  <span class="title">Thông báo yêu cầu mua hàng</span>
                  <span class="desc">Báo khi có yêu cầu mua hàng mới đang chờ duyệt</span>
                </div>
                <label class="switch">
                  <input name="purchase_notify" type="checkbox" />
                  <span class="slider"></span>
                </label>
              </div>

              <div class="field-row">
                <div class="field-info">
                  <span class="title">Âm thanh thông báo</span>
                  <span class="desc">Phát âm thanh khi có cảnh báo mới</span>
                </div>
                <label class="switch">
                  <input name="notification_sound" type="checkbox" />
                  <span class="slider"></span>
                </label>
              </div>
            </section>

          </div>
          
          <div style="margin-top:32px; text-align:right;">
            <button class="submit-btn" type="submit" style="min-width:160px;">Lưu toàn bộ cài đặt</button>
          </div>
        </form>
      </div>`;
    const form = document.getElementById("settingsForm");
    
    // Fill values
    form.company_name.value = s.company_name || "";
    form.language.value = s.language || "vi";
    form.currency.value = s.currency || "VND";
    form.theme.value = s.theme || "light";
    form.decimal_places.value = s.decimal_places != null ? s.decimal_places : 0;
    form.dashboard_refresh_sec.value = String(Math.min(600, Math.max(15, Number(s.dashboard_refresh_sec) || 60)));
    form.low_stock_notify.checked = Boolean(s.low_stock_notify);
    form.purchase_notify.checked = Boolean(s.purchase_notify);
    form.notification_sound.checked = Boolean(s.notification_sound);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const next = {
        company_name: String(fd.get("company_name") || "").trim() || window.MOCK.settingsDefaults.company_name,
        language: fd.get("language") || "vi",
        currency: fd.get("currency") || "VND",
        theme: fd.get("theme") || "light",
        decimal_places: Number(fd.get("decimal_places")) || 0,
        dashboard_refresh_sec: Math.min(600, Math.max(15, Number(fd.get("dashboard_refresh_sec")) || 60)),
        low_stock_notify: form.low_stock_notify.checked,
        purchase_notify: form.purchase_notify.checked,
        notification_sound: form.notification_sound.checked,
      };
      saveSettings(next);
      document.dispatchEvent(new CustomEvent("warehouse:settings-saved"));
      toast("Đã lưu cài đặt mới");
    });
  }

  function renderPlaceholder(title) {
    topTitle.innerHTML = `<span class="dot"></span>WarehouseAI — ${title}`;
    mainContent.innerHTML = '<div class="placeholder-view">🚧 Đang phát triển</div>';
  }

  async function route(view, payload = {}) {
    setActiveNav(view);
    if (view === "chat") return renderChatView();
    if (view === "inventory") return renderInventoryTable();
    if (view === "gr") return renderFormView("gr", payload);
    if (view === "gi") return renderFormView("gi", payload);
    if (view === "purchase" && !canAccessPurchase()) return renderPurchaseRestrictedView();
    if (view === "purchase") return renderPurchaseView();
    if (view === "production") return renderProductionView();
    if (view === "suppliers") return renderSuppliersView();
    if (view === "settings") return renderSettingsView();
    return renderPlaceholder("Không rõ");
  }

  navList.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item");
    if (!btn) return;
    if (btn.dataset.view === "purchase" && !canAccessPurchase()) {
      toast("Phiên chat này chưa có quyền vào Thu mua. Hãy dùng phiên có vai trò Quản lý kho.");
      return;
    }
    route(btn.dataset.view);
  });

  newChatBtn.addEventListener("click", () => {
    const nextSession = createSession(sessions.length + 1);
    sessions.push(nextSession);
    activeSession = sessions.length - 1;
    saveSessions();
    renderChatList();
    syncRoleBasedNavAccess();
    route("chat");
  });

  document.addEventListener("warehouse:navigate", (e) => {
    route(e.detail.view, { 
      material: e.detail.material || "",
      quantity: e.detail.quantity || ""
    });
  });

  async function init() {
    ensureSessions();
    renderChatList();
    syncRoleBasedNavAccess();
    try {
      const data = await window.WarehouseAPI.getInventory();
      inventoryData = Array.isArray(data) ? data : data.items || [];
      if (!inventoryData.length) throw new Error("empty");
    } catch {
      inventoryData = window.MOCK.materials;  // fallback to mock
    }
    route("chat");
    window.WarehouseDashboard.refreshDashboard();
  }

  document.addEventListener("click", async (e) => {
    const actionBtn = e.target.closest(".chat-action");
    if (!actionBtn) return;
    const action = actionBtn.dataset.action;
    if (action === "set-role") {
      selectSessionRole(actionBtn.dataset.role);
      return;
    }
    if (action === "show-sales-materials") {
      await appendLocalUserMessage("Tư vấn khách về vật tư tiêu biểu");
      await appendLocalBotReply("", buildSalesMaterialPickerHtml());
      return;
    }
    if (action === "sales-material") {
      const item = SALES_ADVISORY_ITEMS.find((entry) => entry.code === actionBtn.dataset.code);
      if (!item) return;
      await appendLocalUserMessage(item.name);
      await appendLocalBotReply("", buildSalesAdviceHtml(item.code));
      return;
    }
    if (action === "sales-custom-material") {
      const wrap = actionBtn.closest(".sales-custom-picker");
      const input = wrap?.querySelector(".chat-inline-input");
      const value = String(input?.value || "").trim();
      if (!value) {
        toast("Nhập mã hoặc tên vật tư trước khi tư vấn");
        return;
      }
      const adviceHtml = buildSalesAdviceHtml(value);
      if (!adviceHtml) {
        toast("Không tìm thấy vật tư phù hợp trong dữ liệu hiện tại");
        return;
      }
      await appendLocalUserMessage(value);
      await appendLocalBotReply("", adviceHtml);
      return;
    }
    if (action === "quick-prompt") {
      const prompt = String(actionBtn.dataset.prompt || "").trim();
      if (prompt) await sendPrompt(prompt);
      return;
    }
    if (action === "dismiss-order") {
      const row = actionBtn.closest(".msg-row");
      row?.remove();
      return;
    }
    if (action !== "order") return;
    const code = String(actionBtn.dataset.code || "").trim();
    let quantity = String(actionBtn.dataset.suggest || actionBtn.dataset.quantity || "").trim();
    await refreshInventoryFromApi();
    if (!quantity && code) {
      const row = findInventoryRowByCode(code);
      if (row) {
        quantity = String(
          suggestReorderQty(Number(row.stock ?? row.on_hand ?? 0), Number(row.rop ?? 0))
        );
      }
    }
    route("gr", { material: code, quantity });
  });

  init();
})();
