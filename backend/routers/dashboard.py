import math

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from database import get_db
from models import Inventory, Material

router = APIRouter(tags=["dashboard"])

_VALID_ABC_XYZ = frozenset(["AX", "AY", "AZ", "BX", "BY", "BZ", "CX", "CY", "CZ"])


def _cell_management_policy(cell: str) -> str:
  """Gợi ý quản trị theo tổ hợp ABC/XYZ (ô ma trận)."""
  hints = {
    "AX": "Cần lên đơn định kỳ — nhu cầu ổn định, nên duy trì chu kỳ đặt hàng cố định.",
    "AY": "Kết hợp đơn định kỳ và điều chỉnh theo mùa vụ / biến động vừa phải.",
    "AZ": "Ưu tiên kiểm soát rủi ro: đặt hàng theo nhu cầu thực tế, tránh tồn quá mức.",
    "BX": "Theo dõi tồn theo tuần; cân bằng giữa chi phí và mức dự phòng vừa phải.",
    "BY": "Linh hoạt lịch đặt hàng theo kế hoạch sản xuất và tín hiệu tiêu thụ.",
    "BZ": "Hạn chế tồn kho: ưu tiên nhập theo lệnh / đơn hàng cụ thể.",
    "CX": "Có thể dùng min-max đơn giản; tập trung kiểm kê định kỳ.",
    "CY": "Nhập lô nhỏ, theo dõi tồn gắn với đơn hàng thực tế.",
    "CZ": "Chỉ nhập khi có đơn — tránh tồn chậm luân chuyển, nhu cầu khó dự báo.",
  }
  return hints.get(cell, "Theo dõi tồn và điều chỉnh đặt hàng theo tín hiệu vận hành.")


def _xyz_safety_factor(xyz: str) -> float:
  return {"X": 0.38, "Y": 0.48, "Z": 0.58}.get((xyz or "Z").upper(), 0.5)


def _ai_safety_stock(rop: float, xyz: str) -> float:
  """Ước tính tồn kho an toàn (demo) từ ROP và độ biến động XYZ khi chưa có cột SS riêng."""
  r = max(0.0, float(rop or 0))
  if r <= 0:
    return 0.0
  return round(r * _xyz_safety_factor(xyz), 2)


def _suggest_reorder_qty(stock: float, rop: float) -> int:
  s = float(stock or 0)
  r = float(rop or 0)
  if r <= 0:
    return max(1, int(math.ceil(s * 0.5)) if s else 1)
  target = r * 1.5
  gap = target - s
  if gap <= 0:
    return max(1, int(math.ceil(r * 0.25)))
  return max(1, int(math.ceil(gap)))


def _suggest_proactive_order_qty(rop: float) -> int:
  """Gợi ý số lượng đặt thêm khi tồn còn an toàn (bổ sung định kỳ)."""
  r = max(0.0, float(rop or 0))
  if r <= 0:
    return 1
  return max(1, int(math.ceil(r * 0.25)))


def _format_value_vnd(total: float) -> str:
  if total >= 1_000_000_000:
    return f"{total / 1_000_000_000:.1f} tỷ VNĐ"
  if total >= 1_000_000:
    return f"{total / 1_000_000:.1f} triệu VNĐ"
  return f"{total:,.0f} VNĐ"


@router.get("/dashboard/kpis")
def kpis(db: Session = Depends(get_db)):
  total_skus = db.query(Material).count()
  rows = db.execute(
    select(Inventory.on_hand, Inventory.on_order, Material.unit_price, Material.rop)
    .join(Material, Inventory.material_id == Material.id)
  ).all()
  total_value = sum((float(on_hand or 0) + float(on_order or 0)) * float(unit_price or 0) for on_hand, on_order, unit_price, _ in rows)
  rop_alerts = sum(1 for on_hand, _, _, rop in rows if float(on_hand or 0) <= float(rop or 0))
  return {
    "total_skus": total_skus,
    "total_value": _format_value_vnd(total_value),
    "rop_alerts": rop_alerts,
    "forecast_accuracy": "91%",
  }


@router.get("/dashboard/inventory-chart")
def inventory_chart(db: Session = Depends(get_db)):
  rows = db.execute(
    select(Material.name, Inventory.on_hand, Inventory.on_order, Material.rop)
    .join(Inventory, Inventory.material_id == Material.id)
    .order_by(Material.rop.desc(), (Inventory.on_hand + Inventory.on_order).desc())
    .limit(10)
  ).all()
  return [
    {
      "name": name,
      "qty": float(on_hand or 0) + float(on_order or 0),
      "rop": float(rop or 0),
    }
    for name, on_hand, on_order, rop in rows
  ]


@router.get("/dashboard/abc-xyz")
def abc_xyz(db: Session = Depends(get_db)):
  rows = db.execute(
    select(Material.abc_class, Material.xyz_class, func.count(Material.id))
    .group_by(Material.abc_class, Material.xyz_class)
  ).all()
  out = {k: 0 for k in ["AX", "AY", "AZ", "BX", "BY", "BZ", "CX", "CY", "CZ"]}
  for abc, xyz, count in rows:
    key = f"{abc}{xyz}"
    if key in out:
      out[key] = int(count)
  return out


@router.get("/dashboard/abc-xyz/{cell}")
def abc_xyz_cell_detail(cell: str, db: Session = Depends(get_db)):
  key = (cell or "").strip().upper()
  if key not in _VALID_ABC_XYZ:
    raise HTTPException(status_code=400, detail="Ô ma trận không hợp lệ (ví dụ: AX, CZ).")
  abc, xyz = key[0], key[1]
  rows = db.execute(
    select(Material, Inventory)
    .outerjoin(Inventory, Inventory.material_id == Material.id)
    .where(Material.abc_class == abc, Material.xyz_class == xyz)
    .order_by(Material.code)
  ).all()

  items = []
  for m, inv in rows:
    stock = float(inv.on_hand if inv else 0)
    rop = float(m.rop or 0)
    safety = _ai_safety_stock(rop, xyz)
    low = rop > 0 and stock <= rop
    warn = rop > 0 and not low and stock <= rop + max(safety * 0.25, rop * 0.05)
    danger = low or warn
    cta_variant = "danger" if danger else "safe"
    suggest_qty = _suggest_reorder_qty(stock, rop) if danger else _suggest_proactive_order_qty(rop)
    items.append(
      {
        "code": m.code,
        "name": m.name,
        "unit": m.unit,
        "stock": stock,
        "rop": rop,
        "safety_stock": safety,
        "cta_variant": cta_variant,
        "cta_label": "Đặt mua ngay",
        "suggest_qty": suggest_qty,
      }
    )

  return {
    "cell": key,
    "management_policy": _cell_management_policy(key),
    "items": items,
  }


@router.get("/dashboard/rop-alerts")
def rop_alerts(db: Session = Depends(get_db)):
  rows = db.execute(
    select(Material.name, Inventory.on_hand, Material.code, Material.rop)
    .join(Inventory, Inventory.material_id == Material.id)
    .where(Inventory.on_hand <= Material.rop)
    .order_by((Inventory.on_hand / func.nullif(Material.rop, 0)).asc())
  ).all()
  return [
    {"name": name, "stock": float(stock or 0), "code": code, "rop": float(rop or 0)}
    for name, stock, code, rop in rows
  ]
