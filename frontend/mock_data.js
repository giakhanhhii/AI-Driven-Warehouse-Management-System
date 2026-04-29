window.MOCK = {

  // ─── 10 vật tư hoàn chỉnh ───────────────────────────────────────────────
  materials: [
    { code:"HN-PP",  name:"Hạt nhựa PP",           unit:"kg",   unit_price:25000,  rop:500,  abc:"C", xyz:"X", stock:70,   on_hand:70,   on_order:0 },
    { code:"HN-ABS", name:"Hạt nhựa ABS",           unit:"kg",   unit_price:35000,  rop:200,  abc:"C", xyz:"X", stock:280,  on_hand:280,  on_order:0 },
    { code:"DH-046", name:"Dầu nhớt ISO 46",        unit:"lít",  unit_price:45000,  rop:200,  abc:"B", xyz:"X", stock:260,  on_hand:260,  on_order:0 },
    { code:"KD-CN",  name:"Keo dán công nghiệp",    unit:"kg",   unit_price:180000, rop:50,   abc:"A", xyz:"X", stock:8,    on_hand:8,    on_order:0 },
    { code:"TT-3MM", name:"Thép tấm 3mm",           unit:"tấm",  unit_price:650000, rop:100,  abc:"A", xyz:"X", stock:220,  on_hand:220,  on_order:0 },
    { code:"NH-DH",  name:"Nhôm định hình",         unit:"mét",  unit_price:120000, rop:80,   abc:"C", xyz:"X", stock:52,   on_hand:52,   on_order:0 },
    { code:"MI-CN",  name:"Mực in công nghiệp",     unit:"hộp",  unit_price:220000, rop:200,  abc:"B", xyz:"X", stock:115,  on_hand:115,  on_order:0 },
    { code:"GK-100", name:"Giấy kraft 100gsm",      unit:"cuộn", unit_price:85000,  rop:100,  abc:"B", xyz:"X", stock:35,   on_hand:35,   on_order:0 },
    { code:"BK-OPP", name:"Băng keo OPP",           unit:"cuộn", unit_price:15000,  rop:100,  abc:"C", xyz:"X", stock:68,   on_hand:68,   on_order:0 },
    { code:"PE-HN",  name:"Túi PE hàn nhiệt",       unit:"kg",   unit_price:42000,  rop:150,  abc:"C", xyz:"X", stock:120,  on_hand:120,  on_order:0 },
  ],

  // ─── Nhà cung cấp (tên — dùng cho datalist nhập kho) ─────────────────────
  suppliers: [
    "Công ty TNHH Nhựa Việt Thắng",
    "Công ty CP Hóa chất Sài Gòn",
    "Nhà máy Thép Việt Nhật",
    "Công ty TNHH Vật tư Công nghiệp Miền Nam",
    "Công ty CP Bao bì Tiến Phát",
    "Công ty TNHH Hóa dầu Toàn Cầu",
  ],

  // ─── Danh sách NCC chi tiết (màn Nhà cung cấp) ───────────────────────────
  supplierRecords: [
    { name: "Công ty TNHH Nhựa Việt Thắng", tax_id: "0312345678", phone: "028 3822 1100", address: "KCN Tân Bình, TP.HCM", lead_days: 5, note: "Ưu tiên hạt PP/ABS" },
    { name: "Công ty CP Hóa chất Sài Gòn", tax_id: "0309988776", phone: "028 3912 4455", address: "Quận 12, TP.HCM", lead_days: 7, note: "Dầu, hóa chất công nghiệp" },
    { name: "Nhà máy Thép Việt Nhật", tax_id: "3700778899", phone: "0254 3855 900", address: "Bà Rịa — Vũng Tàu", lead_days: 10, note: "Thép tấm, cuộn" },
    { name: "Công ty TNHH Vật tư Công nghiệp Miền Nam", tax_id: "0311223344", phone: "028 3777 8899", address: "Thủ Đức, TP.HCM", lead_days: 4, note: "Mực in, phụ kiện" },
    { name: "Công ty CP Bao bì Tiến Phát", tax_id: "0315566778", phone: "0274 3612 300", address: "Bình Dương", lead_days: 6, note: "Giấy kraft, PE" },
    { name: "Công ty TNHH Hóa dầu Toàn Cầu", tax_id: "0308877665", phone: "028 3844 5566", address: "Quận 7, TP.HCM", lead_days: 8, note: "Dầu nhớt ISO" },
  ],

  // ─── Người xuất kho ──────────────────────────────────────────────────────
  staff: [
    "Nguyễn Văn An",
    "Trần Thị Bình",
    "Lê Hoàng Cường",
    "Phạm Minh Đức",
    "Hoàng Thị Lan",
  ],

  // ─── Mã lệnh sản xuất (datalist xuất kho) ─────────────────────────────────
  productionOrders: [
    "LSX-2026-001", "LSX-2026-002", "LSX-2026-003",
    "LSX-2026-004", "LSX-2026-005",
  ],

  // ─── Lệnh / tiến độ sản xuất (màn Sản xuất) ───────────────────────────────
  productionWorkOrders: [
    { code: "LSX-2026-001", product: "Thùng nhựa PP 20L", qty_planned: 2400, qty_done: 1850, line: "Chuyền ép phun A", status: "running", due_date: "2026-04-18" },
    { code: "LSX-2026-002", product: "Khay ABS chống tĩnh điện", qty_planned: 800, qty_done: 800, line: "Chuyền ép phun B", status: "done", due_date: "2026-04-10" },
    { code: "LSX-2026-003", product: "Vỏ máy thép 3mm", qty_planned: 120, qty_done: 45, line: "Tổ gia công cơ khí", status: "running", due_date: "2026-04-22" },
    { code: "LSX-2026-004", product: "Bộ kit đóng gói PE", qty_planned: 5000, qty_done: 0, line: "Chuyền đóng gói 2", status: "planned", due_date: "2026-04-25" },
    { code: "LSX-2026-005", product: "Nhãn in công nghiệp (cuộn)", qty_planned: 200, qty_done: 60, line: "In flexo", status: "running", due_date: "2026-04-14" },
  ],

  // ─── Purchase requests ───────────────────────────────────────────────────
  purchaseRequests: [
    { id:1, pr_code:"PR-2026-001", material:"Hạt nhựa ABS",       quantity:500,  supplier:"Công ty TNHH Nhựa Việt Thắng",           created_at:"2026-04-07", status:"pending"  },
    { id:2, pr_code:"PR-2026-002", material:"Dầu nhớt ISO 46",     quantity:200,  supplier:"Công ty TNHH Hóa dầu Toàn Cầu",          created_at:"2026-04-07", status:"pending"  },
    { id:3, pr_code:"PR-2026-003", material:"Mực in công nghiệp",  quantity:300,  supplier:"Công ty TNHH Vật tư Công nghiệp Miền Nam",created_at:"2026-04-06", status:"approved" },
    { id:4, pr_code:"PR-2026-004", material:"Hạt nhựa PP",         quantity:1000, supplier:"Công ty TNHH Nhựa Việt Thắng",           created_at:"2026-04-05", status:"approved" },
    { id:5, pr_code:"PR-2026-005", material:"Dầu nhớt ISO 46",     quantity:150,  supplier:"Công ty TNHH Hóa dầu Toàn Cầu",          created_at:"2026-04-04", status:"rejected" },
  ],

  // ─── Dashboard KPIs ──────────────────────────────────────────────────────
  kpis: {
    total_skus: 10,
    total_value: "259.2 triệu VNĐ",
    rop_alerts: 7,
    forecast_accuracy: "91%"
  },

  // ─── ABC/XYZ matrix counts ───────────────────────────────────────────────
  abcXyz: { AX:3, AY:1, AZ:0, BX:1, BY:2, BZ:1, CX:1, CY:1, CZ:0 },

  // ─── ROP alerts (materials where stock ≤ rop) ───────────────────────────
  ropAlerts: [
    { name:"Hạt nhựa PP",        stock:70,  code:"HN-PP"  },
    { name:"Keo dán công nghiệp",stock:8,   code:"KD-CN"  },
    { name:"Nhôm định hình",     stock:52,  code:"NH-DH"  },
    { name:"Mực in công nghiệp", stock:115, code:"MI-CN"  },
    { name:"Giấy kraft 100gsm",  stock:35,  code:"GK-100" },
    { name:"Băng keo OPP",       stock:68,  code:"BK-OPP" },
    { name:"Túi PE hàn nhiệt",   stock:120, code:"PE-HN"  },
  ],

  // ─── Giá trị mặc định Cài đặt (localStorage ghi đè sau khi lưu) ───────────
  settingsDefaults: {
    company_name: "Công ty CP WarehouseAI Demo",
    language: "vi",
    dashboard_refresh_sec: 60,
    low_stock_notify: true,
    purchase_notify: true,
    currency: "VND",
    theme: "light",
    notification_sound: true,
    decimal_places: 0,
  },
};
