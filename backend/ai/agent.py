import math
import os
import uuid
import re
import unicodedata
from pathlib import Path
from typing import Dict, List, Optional

from dotenv import load_dotenv
from openai import OpenAI
from sqlalchemy import select
from sqlalchemy.orm import Session

from ai.forecasting import get_forecast, get_forecast_bundle
from models import Material

ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")
load_dotenv(ROOT_DIR / ".env.local", override=True)
load_dotenv()

THREADS: Dict[str, List[dict]] = {}

MAX_LOW_STOCK_WARNING_LIST = 10

NUMBER_WORDS = {
  "mot": 1,
  "một": 1,
  "hai": 2,
  "ba": 3,
  "bon": 4,
  "bốn": 4,
  "tu": 4,
  "tư": 4,
  "nam": 5,
  "năm": 5,
  "sau": 6,
  "sáu": 6,
  "bay": 7,
  "bảy": 7,
  "tam": 8,
  "tám": 8,
  "chin": 9,
  "chín": 9,
  "muoi": 10,
  "mười": 10,
}

LOW_ON_HAND_KEYWORDS = (
  "thấp nhất",
  "thap nhat",
  "ít nhất",
  "it nhat",
  "tồn thấp",
  "ton thap",
  "tồn kho thấp",
  "ton kho thap",
  "ít tồn",
  "it ton",
  "số lượng thấp",
  "so luong thap",
)
REPLENISH_KEYWORDS = ("bổ sung", "bo sung", "cần mua", "can mua", "replenish", "cần bổ sung", "can bo sung")
WAREHOUSE_KEYWORDS = (
  "kho",
  "ton kho",
  "ton",
  "vat tu",
  "nguyen vat lieu",
  "hang hoa",
  "mat hang",
  "san pham",
  "nhap kho",
  "xuat kho",
  "mua hang",
  "thu mua",
  "nha cung cap",
  "rop",
  "abc",
  "xyz",
  "du bao",
  "nhu cau",
  "goods receipt",
  "goods issue",
  "inventory",
  "stock",
  "warehouse",
)
GREETING_KEYWORDS = (
  "xin chao",
  "chao",
  "hello",
  "hi",
  "alo",
)
LOW_STOCK_WARNING_KEYWORDS = (
  "sap het",
  "canh bao ton",
  "ton thap",
  "ton kho thap",
  "duoi rop",
  "canh bao ton kho",
)
SALES_ADVISORY_KEYWORDS = (
  "tu van khach",
  "tư vấn khách",
  "ban hang",
  "bán hàng",
  "con ton nhieu",
  "còn tồn nhiều",
  "ton nhieu",
  "tồn nhiều",
  "con san",
  "còn sẵn",
  "co san",
  "có sẵn",
)
INVENTORY_SUMMARY_KEYWORDS = (
  "tom tat tinh trang ton kho hien tai",
  "tóm tắt tình trạng tồn kho hiện tại",
  "tom tat ton kho",
  "tóm tắt tồn kho",
  "tong quan ton kho",
  "tổng quan tồn kho",
)
ITEM_NOUN_PATTERN = r"(m[oó]n|mat\s*hang|v[aậ]t\s*t[uư]|hang|san\s*pham|loai)"
ABC_XYZ_GROUPS = ("AX", "AY", "AZ", "BX", "BY", "BZ", "CX", "CY", "CZ")
ABC_XYZ_POLICIES = {
  "AX": "Kiểm soát chặt, ưu tiên duy trì mức tồn ổn định và lên đơn định kỳ.",
  "AY": "Theo dõi sát và điều chỉnh theo biến động nhu cầu ở mức vừa phải.",
  "AZ": "Hạn chế tồn dư, chỉ nên đặt theo nhu cầu thực tế và kiểm soát rủi ro.",
  "BX": "Cân bằng giữa chi phí tồn kho và mức dự phòng, theo dõi theo tuần.",
  "BY": "Linh hoạt theo kế hoạch sản xuất và tín hiệu tiêu thụ.",
  "BZ": "Ưu tiên nhập theo nhu cầu cụ thể, tránh giữ tồn cao kéo dài.",
  "CX": "Có thể quản lý theo min-max đơn giản và kiểm kê định kỳ.",
  "CY": "Nhập lô nhỏ, theo dõi bám sát nhu cầu phát sinh thực tế.",
  "CZ": "Chỉ nhập khi cần, tránh tích trữ vì nhu cầu khó dự báo hoặc giá trị thấp.",
}


def _normalize_text(text: str) -> str:
  raw = str(text or "").strip().lower()
  decomp = unicodedata.normalize("NFKD", raw)
  no_accents = "".join(ch for ch in decomp if not unicodedata.combining(ch))
  return no_accents.replace("đ", "d")


def _suggest_order_qty(stock: float, rop: float) -> int:
  """Khớp logic frontend dashboard.js qtyToClearRopAlert — SL gợi ý để đưa tồn về mức an toàn ~150% ROP."""
  s = float(stock) if stock is not None else 0.0
  r = float(rop) if rop is not None else 0.0
  if r <= 0:
    return max(1, int(math.ceil(s * 0.5)) or 1)
  target = r * 1.5
  gap = target - s
  if gap <= 0:
    return max(1, int(math.ceil(r * 0.25)) or 1)
  return max(1, int(math.ceil(gap)))


def _is_forecast_request(text: str) -> bool:
  t = _normalize_text(text)
  forecast_keywords = (
    "du bao",
    "forecast",
    "nhu cau ky toi",
    "nhu cau thang toi",
    "san luong du kien",
    "so luong du bao",
    "so sanh 3 mo hinh",
    "so sanh mo hinh",
    "3 mo hinh",
    "random forest",
    "forest",
    "svr",
    "svm",
    "svn",
  )
  return any(keyword in t for keyword in forecast_keywords)


def _forecast_model_from_text(text: str) -> str:
  t = _normalize_text(text)
  if any(keyword in t for keyword in ("random forest", "forest", "rf", "rung ngau nhien")):
    return "random_forest"
  if any(keyword in t for keyword in ("svr", "svm", "svn")):
    return "svr"
  return "linear_regression"


def _has_explicit_forecast_model_request(text: str) -> bool:
  t = _normalize_text(text)
  return any(
    keyword in t
    for keyword in (
      "random forest",
      "forest",
      "rf",
      "rung ngau nhien",
      "svr",
      "svm",
      "svn",
      "linear regression",
      "linear",
      "lr",
      "hoi quy tuyen tinh",
    )
  )


def _wants_forecast_comparison(text: str) -> bool:
  t = _normalize_text(text)
  return any(keyword in t for keyword in ("so sanh", "ca 3", "tat ca", "3 mo hinh", "nhieu mo hinh"))


def _extract_abc_xyz_group(text: str) -> Optional[str]:
  t = _normalize_text(text).upper()
  matched = re.search(r"\b(A|B|C)\s*(X|Y|Z)\b", t)
  if not matched:
    return None
  group = f"{matched.group(1)}{matched.group(2)}"
  return group if group in ABC_XYZ_GROUPS else None


def _wants_abc_xyz_group_lookup(text: str) -> bool:
  t = _normalize_text(text)
  return _extract_abc_xyz_group(t) is not None and any(
    keyword in t
    for keyword in ("nhom", "gồm", "gom", "vat tu", "giai thich", "quan ly", "phan loai", "abc", "xyz")
  )


def _format_abc_xyz_group_reply(db: Session, group: str) -> str:
  abc, xyz = group[0], group[1]
  rows = db.execute(
    select(Material)
    .where(Material.abc_class == abc, Material.xyz_class == xyz)
    .order_by(Material.code)
  ).scalars().all()

  if not rows:
    return f"Hiện chưa có vật tư nào thuộc nhóm {group} trong dữ liệu hệ thống."

  items = "".join(
    f"- {m.name} ({m.code})<br>"
    for m in rows
  )
  policy = ABC_XYZ_POLICIES.get(group, "Theo dõi và điều chỉnh tồn kho theo đặc điểm nhóm vật tư.")
  return (
    f"<strong>Nhóm {group} gồm {len(rows)} vật tư</strong><br>"
    f"{items}<br>"
    f"<strong>Gợi ý quản trị:</strong> {policy}"
  )


def _format_forecast_comparison_summary(material: Optional[Material], forecasts: List[dict], unit_part: str) -> str:
  if not forecasts:
    return ""

  values = [float(item["predicted_qty"]) for item in forecasts]
  max_pred = max(values)
  min_pred = min(values)
  spread = max_pred - min_pred
  avg_pred = sum(values) / len(values) if values else 0
  spread_ratio = (spread / avg_pred) if avg_pred > 0 else 0
  highest_model = max(forecasts, key=lambda item: float(item["predicted_qty"]))
  lowest_model = min(forecasts, key=lambda item: float(item["predicted_qty"]))

  if spread_ratio <= 0.1:
    conclusion = (
      "Ba mô hình cho kết quả khá gần nhau, nên có thể xem nhu cầu kỳ tới tương đối ổn định."
    )
  elif spread_ratio <= 0.25:
    conclusion = (
      "Ba mô hình có chênh lệch vừa phải, cho thấy nhu cầu có biến động nhưng vẫn đang trong vùng kiểm soát."
    )
  else:
    conclusion = (
      "Ba mô hình chênh lệch khá lớn, nên xem nhu cầu kỳ tới còn biến động và cần thận trọng khi ra quyết định mua."
    )

  meaning = (
    "Việc so sánh 3 mô hình giúp kho không phụ thuộc vào một kết quả đơn lẻ: "
    "Linear Regression dễ đọc xu hướng, Random Forest phù hợp khi dữ liệu có quan hệ phi tuyến, "
    "còn SVR hữu ích khi cần bám sát mẫu biến động ngắn hạn."
  )

  warehouse_action = "Nên tiếp tục theo dõi thêm trong dashboard tồn kho."
  caution = (
    f"Không nên chốt số lượng mua chỉ theo một mô hình đơn lẻ, nhất là khi {lowest_model['model_label']} "
    f"đang cho {lowest_model['predicted_qty']:,.2f}{unit_part} và {highest_model['model_label']} "
    f"đang cho {highest_model['predicted_qty']:,.2f}{unit_part}."
  )

  if material and material.inventory:
    on_hand = float(material.inventory.on_hand or 0)
    on_order = float(material.inventory.on_order or 0)
    rop = float(material.rop or 0)
    unit = material.unit or ""
    projected_after_demand = on_hand + on_order - avg_pred
    suggest_qty = _suggest_order_qty(projected_after_demand, rop) if rop > 0 else max(1, int(math.ceil(avg_pred)))

    if on_hand <= rop:
      warehouse_action = (
        f"Nên ưu tiên rà soát và tạo kế hoạch mua cho {material.name} ngay, vì tồn hiện tại chỉ còn "
        f"{on_hand:,.0f} {unit} trong khi ROP là {rop:,.0f} {unit}. Nếu muốn kéo tồn về vùng an toàn sau kỳ tới, "
        f"có thể cân nhắc bổ sung khoảng {suggest_qty:,.0f} {unit}."
      )
    elif rop > 0 and projected_after_demand <= rop:
      warehouse_action = (
        f"Chưa bắt buộc mua gấp, nhưng nên chuẩn bị trước đề nghị mua cho {material.name} vì sau một kỳ nhu cầu dự báo, "
        f"tồn khả dụng ước còn khoảng {projected_after_demand:,.2f} {unit}, sát hoặc thấp hơn ROP {rop:,.0f} {unit}. "
        f"Mức bổ sung tham khảo là khoảng {suggest_qty:,.0f} {unit}."
      )
    else:
      warehouse_action = (
        f"Hiện {material.name} chưa cần mua gấp: tồn hiện tại {on_hand:,.0f} {unit}"
        + (f", đang đặt {on_order:,.0f} {unit}" if on_order > 0 else "")
        + f", sau khi trừ nhu cầu dự báo trung bình vẫn còn khoảng {projected_after_demand:,.2f} {unit}, cao hơn ROP {rop:,.0f} {unit}."
      )

    caution = (
      f"Cần cẩn trọng khi chốt số lượng mua cho {material.name}: không nên lấy riêng kết quả {lowest_model['model_label']} "
      f"({lowest_model['predicted_qty']:,.2f}{unit_part}) hoặc {highest_model['model_label']} "
      f"({highest_model['predicted_qty']:,.2f}{unit_part}) để quyết định ngay. "
      f"Nên đối chiếu thêm tồn hiện tại, lượng đang đặt {on_order:,.0f} {unit}, và kế hoạch sản xuất / xuất dùng kỳ tới."
    )

  return (
    f"<br><strong>Kết luận:</strong> {conclusion} "
    f"Biên độ giữa mô hình thấp nhất và cao nhất là <strong>{spread:,.2f}{unit_part}</strong>.<br>"
    f"<strong>Tính hữu dụng:</strong> {meaning}<br>"
    f"<strong>Nên làm gì:</strong> {warehouse_action}<br>"
    f"<strong>Cần cẩn trọng:</strong> {caution}"
  )


def _format_forecast_reply(db: Session, message: str) -> Optional[str]:
  forecast_target = _resolve_material_from_text(db, message)
  if not (
    _is_forecast_request(message)
    or _wants_forecast_comparison(message)
    or _has_explicit_forecast_model_request(message)
  ):
    return None

  target_name = forecast_target.name if forecast_target else message

  explicit_model_request = _has_explicit_forecast_model_request(message)
  if _wants_forecast_comparison(message) or not explicit_model_request:
    bundle = get_forecast_bundle(db, target_name)
    if not bundle.get("forecasts"):
      if forecast_target:
        return (
          f"Hiện chưa đủ dữ liệu lịch sử tiêu thụ để dự báo cho {forecast_target.name}. "
          "Cần tối thiểu 2 kỳ tiêu thụ hợp lệ trong bảng consumption_history."
        )
      return None

    material = forecast_target
    unit = material.unit if material and material.unit else ""
    unit_part = f" {unit}" if unit else ""
    rows = "".join(
      f"- {item['model_label']}: <strong>{item['predicted_qty']:,.2f}{unit_part}</strong><br>"
      for item in bundle["forecasts"]
    )
    comparison_summary = _format_forecast_comparison_summary(material, bundle["forecasts"], unit_part)
    return (
      "<strong>Kết quả so sánh dự báo vật tư</strong><br>"
      f"- Vật tư: <strong>{bundle['material']}</strong><br>"
      f"- Kỳ dự báo: <strong>{bundle['period']}</strong><br>"
      f"- Số kỳ lịch sử: <strong>{bundle['history_points']}</strong><br><br>"
      f"{rows}"
      "Các mô hình được huấn luyện trên cùng chuỗi lịch sử tiêu thụ để hỗ trợ đối chiếu kết quả."
      f"{comparison_summary}"
    )

  model_key = _forecast_model_from_text(message)
  fc = get_forecast(db, target_name, model_key)
  if fc.get("predicted_qty", 0) <= 0:
    if forecast_target:
      return (
        f"Hiện chưa đủ dữ liệu lịch sử tiêu thụ để dự báo cho {forecast_target.name}. "
        "Cần tối thiểu 2 kỳ tiêu thụ hợp lệ trong bảng consumption_history."
      )
    return None

  material = forecast_target
  unit = material.unit if material and material.unit else ""
  unit_part = f" {unit}" if unit else ""
  return (
    "<strong>Kết quả dự báo nhu cầu vật tư</strong><br>"
    f"- Vật tư: <strong>{fc['material']}</strong><br>"
    f"- Mô hình: <strong>{fc['model_label']}</strong><br>"
    f"- Kỳ dự báo: <strong>{fc['period']}</strong><br>"
    f"- Số lượng dự báo: <strong>{fc['predicted_qty']:,.2f}{unit_part}</strong><br><br>"
    f"{fc['note']}"
  )


def _all_materials(db: Session):
  return db.execute(select(Material)).scalars().all()


def _resolve_material_from_text(db: Session, text: str) -> Optional[Material]:
  normalized = _normalize_text(text)
  best_match = None
  best_score = 0

  for material in _all_materials(db):
    code = _normalize_text(material.code or "")
    name = _normalize_text(material.name or "")
    score = 0

    if code and code in normalized:
      score = max(score, 100 + len(code))
    if name and name in normalized:
      score = max(score, 80 + len(name))

    name_tokens = [token for token in re.split(r"[^a-z0-9]+", name) if len(token) >= 2]
    overlap = sum(1 for token in name_tokens if token and token in normalized)
    if overlap:
      score = max(score, overlap * 10 + len(name))

    if score > best_score:
      best_score = score
      best_match = material

  return best_match if best_score > 0 else None


def _is_warehouse_related(db: Session, text: str) -> bool:
  normalized = _normalize_text(text)
  if not normalized:
    return True
  if any(token == normalized for token in GREETING_KEYWORDS):
    return True
  if any(keyword in normalized for keyword in REPLENISH_KEYWORDS):
    return True
  if _wants_low_on_hand_list(normalized) or _wants_low_stock_warning_list(normalized):
    return True
  if any(keyword in normalized for keyword in WAREHOUSE_KEYWORDS):
    return True
  return _resolve_material_from_text(db, text) is not None


def query_inventory(db: Session, material_name: str):
  material = _resolve_material_from_text(db, material_name)
  if not material:
    material = db.execute(
      select(Material).where(Material.name.ilike(f"%{material_name}%") | Material.code.ilike(f"%{material_name}%"))
    ).scalar_one_or_none()
  if not material or not material.inventory:
    return {"error": "Không tìm thấy vật tư"}
  on_hand = float(material.inventory.on_hand or 0)
  rop = float(material.rop or 0)
  status = "✅ An toàn" if on_hand > rop else ("⚠️ Sắp hết" if on_hand > rop * 0.5 else "🔴 Nguy hiểm")
  out = {
    "name": material.name,
    "code": material.code,
    "on_hand": on_hand,
    "on_order": float(material.inventory.on_order or 0),
    "rop": rop,
    "unit_price": float(material.unit_price or 0),
    "unit": material.unit,
    "status": status,
  }
  if on_hand <= rop:
    out["warning"] = True
  return out


def _get_low_stock_warning_materials(db: Session, limit: int):
  """Vật tư có cảnh báo tồn thấp: tồn ≤ ROP (khớp dashboard), tối đa `limit` (≤10)."""
  cap = max(1, min(MAX_LOW_STOCK_WARNING_LIST, int(limit)))
  rows = _all_materials(db)
  warned = []
  for m in rows:
    if not m.inventory:
      continue
    oh = float(m.inventory.on_hand or 0)
    rop = float(m.rop or 0)
    if rop <= 0:
      continue
    if oh > rop:
      continue
    ratio = oh / rop
    warned.append((ratio, oh, (m.code or "").lower(), m))
  warned.sort(key=lambda x: (x[0], x[1], x[2]))
  return [x[3] for x in warned[:cap]]


def _get_lowest_on_hand_materials(db: Session, limit: int):
  """Vật tư có tồn thực tế thấp nhất, không phụ thuộc ROP."""
  cap = max(1, min(MAX_LOW_STOCK_WARNING_LIST, int(limit)))
  rows = _all_materials(db)
  items = []
  for m in rows:
    if not m.inventory:
      continue
    on_hand = float(m.inventory.on_hand or 0)
    items.append((on_hand, (m.code or "").lower(), m))
  items.sort(key=lambda x: (x[0], x[1]))
  return [x[2] for x in items[:cap]]


def _get_sales_advisory_materials(db: Session, limit: int):
  """Vật tư phù hợp tư vấn khách: tồn thực tế đang cao hơn ROP."""
  cap = max(1, min(MAX_LOW_STOCK_WARNING_LIST, int(limit)))
  rows = _all_materials(db)
  ready = []
  for m in rows:
    if not m.inventory:
      continue
    on_hand = float(m.inventory.on_hand or 0)
    rop = float(m.rop or 0)
    if on_hand <= 0:
      continue
    if rop > 0 and on_hand <= rop:
      continue
    coverage = (on_hand / rop) if rop > 0 else float("inf")
    ready.append((coverage, on_hand, (m.code or "").lower(), m))
  ready.sort(key=lambda x: (-x[0], -x[1], x[2]))
  return [x[3] for x in ready[:cap]]


def _extract_top_n(message: str, default: int = 5):
  low = _normalize_text(message)
  patterns = (
    rf"\btop\s*(\d+)\b",
    rf"(\d+)\s*{ITEM_NOUN_PATTERN}",
    rf"{ITEM_NOUN_PATTERN}\s*(\d+)",
    r"(\d+)\s*ton\s*kho",
  )
  for pattern in patterns:
    matched = re.search(pattern, low, re.I)
    if matched:
      for group in matched.groups():
        if group and str(group).isdigit():
          return max(1, min(MAX_LOW_STOCK_WARNING_LIST, int(group)))
  word_patterns = (
    rf"\btop\s+({'|'.join(NUMBER_WORDS.keys())})\b",
    rf"({'|'.join(NUMBER_WORDS.keys())})\s*{ITEM_NOUN_PATTERN}",
  )
  for pattern in word_patterns:
    matched = re.search(pattern, low, re.I)
    if matched:
      for group in matched.groups():
        if group in NUMBER_WORDS:
          return max(1, min(MAX_LOW_STOCK_WARNING_LIST, NUMBER_WORDS[group]))
  return default


def _wants_low_on_hand_list(text: str) -> bool:
  t = _normalize_text(text)
  return any(k in t for k in LOW_ON_HAND_KEYWORDS)


def _wants_low_stock_warning_list(text: str) -> bool:
  t = _normalize_text(text)
  if _wants_lowest_ranking(t):
    return False
  return any(k in t for k in LOW_STOCK_WARNING_KEYWORDS)


def _wants_sales_advisory(text: str) -> bool:
  t = _normalize_text(text)
  if not any(k in t for k in SALES_ADVISORY_KEYWORDS):
    return False
  return any(k in t for k in ("tu van", "khach", "ban hang", "ton nhieu", "con san", "co san"))


def _wants_inventory_summary(text: str) -> bool:
  t = _normalize_text(text)
  return any(k in t for k in INVENTORY_SUMMARY_KEYWORDS)


def _wants_lowest_ranking(text: str) -> bool:
  t = _normalize_text(text)
  return any(k in t for k in ("thap nhat", "it nhat", "nho nhat", "bottom"))


def _wants_plural_low_list(t: str) -> bool:
  """Hỏi dạng liệt kê (những/các/nào/...) → danh sách cảnh báo tồn ≤ ROP."""
  t = _normalize_text(t)
  if re.search(
    r"nhung|cac\s+ton|\bcac\s+mat|\bcac\s+mon|\bcac\s+san\s*pham|"
    r"\bton\s+kho\s+nao\b|\bkho\s+nao\b|"
    r"nao\s+(dang\s+)?(co\s+)?(ton|thap)|nao\s+thap|"
    r"liet\s*ke|danh\s*sach|bao\s*nhieu|may\s+(loai|vat|mat)",
    t,
    re.I,
  ):
    return True
  if re.search(rf"\b\d+\s*{ITEM_NOUN_PATTERN}\b", t, re.I):
    return True
  if any(h in t for h in ("liet ke", "danh sach", "bao nhieu", "may loai", "may vat", "ton kho nao", "kho nao")):
    return True
  return False


def _wants_single_lowest(text: str) -> bool:
  """
  Hỏi dạng số ít "món nào thấp nhất" -> chỉ trả về 1 vật tư thấp nhất.
  Không áp dụng khi user hỏi rõ ràng theo dạng số nhiều (những/các/bao nhiêu/mấy...).
  """
  t = _normalize_text(text)
  if re.search(r"\b(nhung|cac|bao\s*nhieu|may|liet ke|danh sach)\b", t, re.I):
    return False
  return re.search(
    r"(mon|mat hang|vat tu|hang)\s+nao\s+.*(thap nhat|it nhat)|"
    r"(thap nhat|it nhat)\s+la\s+(mon|mat hang|vat tu|gi)",
    t,
    re.I,
  ) is not None


def _get_replenishment_candidates(db: Session, top_n: int = 5):
  rows = _all_materials(db)
  needs = []
  for m in rows:
    if not m.inventory:
      continue
    on_hand = float(m.inventory.on_hand or 0)
    rop = float(m.rop or 0)
    if on_hand < rop:
      shortage = rop - on_hand
      abc = (m.abc_class or "C").upper()
      priority = {"A": 0, "B": 1, "C": 2}.get(abc, 3)
      needs.append((priority, -shortage, m))
  needs.sort(key=lambda item: (item[0], item[1]))
  return [item[2] for item in needs[:top_n]]


def _format_inventory_rows(materials: List[Material], show_rop: bool = True):
  rows = []
  for idx, m in enumerate(materials, 1):
    on_hand = float(m.inventory.on_hand or 0)
    rop = float(m.rop or 0)
    unit = m.unit or ""
    suggest = _suggest_order_qty(on_hand, rop)
    rop_part = f", ROP {rop:,.0f} {unit}" if show_rop else ""
    rows.append(
      '<div class="chat-stock-row">'
      f'<span class="chat-stock-meta">{idx}. {m.name} ({m.code}) — '
      f"tồn {on_hand:,.0f} {unit}{rop_part}</span>"
      f'<button type="button" class="chat-action" data-action="order" data-code="{m.code}" '
      f'data-suggest="{suggest}">Đặt hàng</button>'
      "</div>"
    )
  return "".join(rows)


def _format_sales_inventory_rows(materials: List[Material]):
  rows = []
  for idx, m in enumerate(materials, 1):
    on_hand = float(m.inventory.on_hand or 0)
    rop = float(m.rop or 0)
    unit = m.unit or ""
    if rop > 0:
      coverage_pct = (on_hand / rop) * 100
      stock_note = f"tồn {on_hand:,.0f} {unit}, ROP {rop:,.0f} {unit}, đạt {coverage_pct:,.0f}% ROP"
    else:
      stock_note = f"tồn {on_hand:,.0f} {unit}, chưa có ROP"
    rows.append(
      '<div class="chat-stock-row">'
      f'<span class="chat-stock-meta">{idx}. {m.name} ({m.code}) — {stock_note}</span>'
      "</div>"
    )
  return "".join(rows)


def _select_representative_low_stock_materials(low_materials):
  """Chọn danh sách vật tư thiếu tiêu biểu = 50% tổng số, làm tròn lên, tối đa 10."""
  if not low_materials:
    return []
  limit = min(10, max(1, int(math.ceil(len(low_materials) * 0.5))))
  return [m for _, _, m in low_materials[:limit]]


def _select_representative_safe_materials(safe_materials):
  """Chọn danh sách vật tư đủ tiêu biểu = 50% tổng số, làm tròn lên, tối đa 10."""
  if not safe_materials:
    return []
  limit = min(10, max(1, int(math.ceil(len(safe_materials) * 0.5))))
  return safe_materials[:limit]


def _format_inventory_summary_reply(db: Session) -> str:
  rows = [m for m in _all_materials(db) if m.inventory]
  if not rows:
    return "Hiện chưa có dữ liệu tồn kho để tóm tắt."

  low_materials = []
  safe_materials = []
  for m in rows:
    on_hand = float(m.inventory.on_hand or 0)
    rop = float(m.rop or 0)
    if rop > 0 and on_hand <= rop:
      abc = (m.abc_class or "C").upper()
      priority = {"A": 0, "B": 1, "C": 2}.get(abc, 3)
      shortage = rop - on_hand
      low_materials.append((priority, -shortage, m))
    else:
      safe_materials.append(m)

  low_materials.sort(key=lambda item: (item[0], item[1], (item[2].code or "").lower()))
  safe_materials.sort(key=lambda item: (item.code or "").lower())

  representative_low_materials = _select_representative_low_stock_materials(low_materials)
  representative_safe_materials = _select_representative_safe_materials(safe_materials)
  low_names = ", ".join(f"{m.name} ({m.code})" for m in representative_low_materials) if representative_low_materials else ""
  safe_names = ", ".join(f"{m.name} ({m.code})" for m in representative_safe_materials) if representative_safe_materials else ""

  low_part = (
    f"- Thiếu / dưới ROP: <strong>{len(low_materials)} vật tư</strong>"
    + (f" tiêu biểu: {low_names}" if low_names else "")
    + ".<br>"
  )
  safe_part = (
    f"- Đủ / trên ROP: <strong>{len(safe_materials)} vật tư</strong>"
    + (f" tiêu biểu: {safe_names}" if safe_names else "")
    + ".<br>"
  )

  if low_materials:
    _, critical_gap_sort, critical_material = low_materials[0]
    critical_gap = abs(critical_gap_sort)
    conclusion = (
      f"<strong>Kết luận:</strong> Nên ưu tiên lập kế hoạch mua cho nhóm dưới ROP, "
      f"đặc biệt là {critical_material.name} ({critical_material.code}) đang thiếu khoảng {critical_gap:,.0f} {critical_material.unit or ''} so với ROP. "
      "Nhóm còn đủ tồn có thể tiếp tục cấp phát và theo dõi định kỳ."
    )
  else:
    conclusion = (
      "<strong>Kết luận:</strong> Hiện chưa có vật tư nào dưới ROP, "
      "có thể duy trì theo dõi định kỳ và chưa cần bổ sung gấp."
    )

  return (
    "<strong>Tóm tắt tình trạng tồn kho hiện tại</strong><br>"
    f"{low_part}{safe_part}"
    f"{conclusion}"
  )


def _intent_reply(db: Session, message: str):
  text = _normalize_text(message)

  if _wants_inventory_summary(text):
    return _format_inventory_summary_reply(db)

  if _wants_sales_advisory(text):
    top_n = _extract_top_n(message, default=5)
    materials = _get_sales_advisory_materials(db, top_n)
    if not materials:
      return (
        "Hiện chưa có vật tư nào có tồn thực tế cao hơn ROP để ưu tiên tư vấn khách. "
        "Bạn nên kiểm tra lại danh mục an toàn tồn kho trước khi chào bán."
      )
    actual_n = len(materials)
    intro = (
      f'<p class="chat-stock-intro"><strong>{actual_n} vật tư</strong> '
      "đang có tồn an toàn trên ROP và phù hợp để tư vấn khách:</p>"
    )
    if actual_n < top_n:
      intro = intro.replace("</p>", f" Hiện tại chỉ có {actual_n} vật tư đạt điều kiện này.</p>")
    return intro + _format_sales_inventory_rows(materials)

  if _wants_abc_xyz_group_lookup(text):
    group = _extract_abc_xyz_group(text)
    if group:
      return _format_abc_xyz_group_reply(db, group)

  if _wants_low_on_hand_list(text) or _wants_low_stock_warning_list(text):
    wants_top = "top" in text or re.search(rf"\d+\s*{ITEM_NOUN_PATTERN}", text, re.I) is not None
    wants_plural = _wants_plural_low_list(text)
    wants_single = _wants_single_lowest(text)
    wants_lowest_ranking = _wants_lowest_ranking(text)

    if wants_top:
      top_n = min(_extract_top_n(message, default=MAX_LOW_STOCK_WARNING_LIST), MAX_LOW_STOCK_WARNING_LIST)
    elif wants_single:
      top_n = 1
    elif wants_plural:
      top_n = min(_extract_top_n(message, default=MAX_LOW_STOCK_WARNING_LIST), MAX_LOW_STOCK_WARNING_LIST)
    else:
      top_n = min(_extract_top_n(message, default=1), MAX_LOW_STOCK_WARNING_LIST)

    use_lowest_on_hand = wants_lowest_ranking and not _wants_low_stock_warning_list(text)
    materials = _get_lowest_on_hand_materials(db, top_n) if use_lowest_on_hand else _get_low_stock_warning_materials(db, top_n)

    if not materials:
      if use_lowest_on_hand:
        return "Hiện chưa có dữ liệu tồn kho để xếp hạng các vật tư có tồn thấp nhất."
      return "Hiện không có vật tư nào đang cảnh báo tồn kho thấp (tồn ≤ điểm đặt hàng lại ROP)."

    if len(materials) == 1:
      m = materials[0]
      on_hand = float(m.inventory.on_hand or 0)
      rop = float(m.rop or 0)
      unit = m.unit or ""
      suggest = _suggest_order_qty(on_hand, rop)
      if wants_single:
        return (
          f"{m.name} ({m.code}) hiện đang có tồn kho thấp nhất: còn {on_hand:,.0f} {unit}"
          f"{f', ROP {rop:,.0f} {unit}' if rop > 0 else ''}.\n"
          "Bạn có muốn tôi đặt giúp bạn không?\n"
          f'<button class="chat-action" data-action="order" data-code="{m.code}" '
          f'data-suggest="{suggest}">Có</button>'
        )
      return (
        f"{m.name} ({m.code}) đang cảnh báo tồn thấp: tồn {on_hand:,.0f} {unit}, "
        f"ROP {rop:,.0f} {unit}.\n"
        "Bạn có muốn tôi đặt giúp bạn không?\n"
        f'<button class="chat-action" data-action="order" data-code="{m.code}" '
        f'data-suggest="{suggest}">Có</button>'
      )
    requested_n = top_n
    actual_n = len(materials)
    capped_tail = (
      f" Tôi đang giới hạn tối đa {MAX_LOW_STOCK_WARNING_LIST} vật tư trong một lần trả lời."
      if requested_n >= MAX_LOW_STOCK_WARNING_LIST
      else ""
    )
    if use_lowest_on_hand:
      shortage_note = ""
      if actual_n < requested_n:
        shortage_note = f" Hiện tại chỉ có {actual_n} vật tư để liệt kê thay vì {requested_n}."
      intro = (
        f'<p class="chat-stock-intro">Đây là <strong>{actual_n} vật tư có tồn kho thấp nhất</strong>'
        f"{shortage_note}{capped_tail}</p>"
      )
      return intro + _format_inventory_rows(materials, show_rop=True)

    shortage_note = ""
    if actual_n < requested_n:
      intro = (
        f'<p class="chat-stock-intro">Hiện tại chỉ có <strong>{actual_n} vật tư</strong> '
        f"đang cảnh báo tồn kho thấp (tồn ≤ ROP):{capped_tail}</p>"
      )
    else:
      intro = (
        f'<p class="chat-stock-intro"><strong>{actual_n} vật tư</strong> '
        f"đang cảnh báo tồn kho thấp (tồn ≤ ROP):{capped_tail}</p>"
      )
    return intro + _format_inventory_rows(materials, show_rop=True)

  if any(k in text for k in REPLENISH_KEYWORDS):
    top_n = _extract_top_n(message, default=5)
    candidates = _get_replenishment_candidates(db, top_n=top_n)
    if not candidates:
      return "Hiện chưa có vật tư nào thấp hơn ROP cần bổ sung."
    intro = (
      f'<p class="chat-stock-intro"><strong>{len(candidates)} vật tư</strong> '
      f"cần bổ sung ưu tiên (tồn dưới ROP):</p>"
    )
    if len(candidates) < top_n:
      intro = intro.replace("</p>", f" Hiện tại chỉ có {len(candidates)} vật tư dưới ROP.</p>")
    return intro + _format_inventory_rows(candidates, show_rop=True)

  return None


def _fallback_reply(db: Session, message: str):
  if not _is_warehouse_related(db, message):
    return (
      "Mình chỉ hỗ trợ các câu hỏi liên quan đến quản lý kho, vật tư, tồn kho, nhập xuất, thu mua "
      "và dự báo nhu cầu. Bạn hãy hỏi lại đúng phạm vi kho nhé."
    )

  if _normalize_text(message) in GREETING_KEYWORDS:
    return (
      "Mình là WarehouseAI. Bạn có thể hỏi về tồn kho, vật tư sắp hết, danh sách cần bổ sung, "
      "nhập kho, xuất kho hoặc dự báo nhu cầu."
    )

  intent_reply = _intent_reply(db, message)
  if intent_reply:
    return intent_reply

  forecast_reply = _format_forecast_reply(db, message)
  if forecast_reply:
    return forecast_reply

  inv = query_inventory(db, message)
  if "error" not in inv:
    reply = (
      f"{inv['name']} hiện còn {inv['on_hand']:,.0f} {inv['unit']}, ngưỡng ROP là {inv['rop']:,.0f} {inv['unit']} — {inv['status']}.\n"
      "```json\n"
      f'{{"Tồn kho":"{inv["on_hand"]:,.0f} {inv["unit"]}","Đang đặt":"{inv["on_order"]:,.0f} {inv["unit"]}",'
      f'"ROP":"{inv["rop"]:,.0f} {inv["unit"]}","Trạng thái":"{inv["status"]}"}}\n'
      "```"
    )
    return reply

  return "Mình chưa hiểu rõ yêu cầu. Bạn có thể hỏi theo mã hoặc tên vật tư."




def chat_with_agent(db: Session, message: str, thread_id: str | None):
  tid = thread_id or f"thread_{uuid.uuid4().hex[:8]}"
  THREADS.setdefault(tid, [])
  THREADS[tid].append({"role": "user", "content": message})

  api_key = os.getenv("OPENAI_API_KEY", "").strip()

  rule_reply = _intent_reply(db, message)
  if not _is_warehouse_related(db, message):
    reply = (
      "Mình chỉ trả lời các câu hỏi liên quan đến kho và vật tư. "
      "Bạn có thể hỏi về tồn kho, mặt hàng sắp hết, nhu cầu mua thêm, nhập xuất kho hoặc dự báo."
    )
  elif rule_reply is not None:
    reply = rule_reply
  elif _is_forecast_request(message) or _wants_forecast_comparison(message):
    reply = _format_forecast_reply(db, message) or _fallback_reply(db, message)
  elif not api_key:
    reply = _fallback_reply(db, message)
  else:
    try:
      client = OpenAI(api_key=api_key)
      inv = query_inventory(db, message)
      context = ""
      if "error" not in inv:
        context = (
          f"\n[Context from database: {inv['name']} ({inv['code']}) "
          f"on_hand={inv['on_hand']} {inv['unit']}, ROP={inv['rop']}. "
          "Use these exact names and numbers; do not invent placeholder items.]"
        )

      response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
          {
            "role": "system",
            "content": (
            "You are WarehouseAI, a warehouse assistant. Reply in Vietnamese. "
            "Refuse any question that is not related to warehouse operations, inventory, materials, purchasing, "
            "goods receipt, goods issue, suppliers, reorder point, or demand forecasting. "
            "Never invent materials like 'Mặt hàng A/B'; only use names from user message or context. "
            "For order actions use HTML with optional suggested quantity (integer): "
              "<button class=\"chat-action\" data-action=\"order\" data-code=\"CODE\" data-suggest=\"QTY\">"
              "Đặt hàng</button>. When on_hand and ROP are known, set data-suggest to max(1, floor(ROP-on_hand)+1) "
              "if ROP>0, else a sensible minimum order quantity. "
              "Prefer short prose; avoid fake JSON inventories unless user explicitly asks for raw JSON."
            ),
          },
          *THREADS[tid],
          {"role": "system", "content": f"Relevant context: {context}" if context else ""},
        ],
      )
      reply = response.choices[0].message.content or _fallback_reply(db, message)
    except Exception as e:
      print(f"OpenAI Error: {e}")
      reply = _fallback_reply(db, message)

  THREADS[tid].append({"role": "assistant", "content": reply})
  return {"reply": reply, "thread_id": tid}
