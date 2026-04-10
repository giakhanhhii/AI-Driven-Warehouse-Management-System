import random
from datetime import date

from ai.classifier import run_classification
from database import Base, SessionLocal, engine
from models import ConsumptionHistory, Inventory, Material

SEED_MATERIALS = [
  {"code": "HN-PP", "name": "Hạt nhựa PP", "unit": "kg", "unit_price": 25000, "rop": 500, "abc": "A", "xyz": "X", "on_hand": 70, "on_order": 0},
  {"code": "HN-ABS", "name": "Hạt nhựa ABS", "unit": "kg", "unit_price": 35000, "rop": 200, "abc": "A", "xyz": "X", "on_hand": 280, "on_order": 0},
  {"code": "DH-046", "name": "Dầu nhớt ISO 46", "unit": "lít", "unit_price": 45000, "rop": 200, "abc": "B", "xyz": "Y", "on_hand": 260, "on_order": 0},
  {"code": "KD-CN", "name": "Keo dán công nghiệp", "unit": "kg", "unit_price": 180000, "rop": 50, "abc": "B", "xyz": "Z", "on_hand": 8, "on_order": 0},
  {"code": "TT-3MM", "name": "Thép tấm 3mm", "unit": "tấm", "unit_price": 650000, "rop": 100, "abc": "A", "xyz": "X", "on_hand": 220, "on_order": 0},
  {"code": "NH-DH", "name": "Nhôm định hình", "unit": "mét", "unit_price": 120000, "rop": 80, "abc": "B", "xyz": "Y", "on_hand": 52, "on_order": 0},
  {"code": "MI-CN", "name": "Mực in công nghiệp", "unit": "hộp", "unit_price": 220000, "rop": 200, "abc": "C", "xyz": "Z", "on_hand": 115, "on_order": 0},
  {"code": "GK-100", "name": "Giấy kraft 100gsm", "unit": "cuộn", "unit_price": 85000, "rop": 100, "abc": "C", "xyz": "Y", "on_hand": 35, "on_order": 0},
  {"code": "BK-OPP", "name": "Băng keo OPP", "unit": "cuộn", "unit_price": 15000, "rop": 100, "abc": "C", "xyz": "X", "on_hand": 68, "on_order": 0},
  {"code": "PE-HN", "name": "Túi PE hàn nhiệt", "unit": "kg", "unit_price": 42000, "rop": 150, "abc": "B", "xyz": "Y", "on_hand": 120, "on_order": 0},
]


def month_start(year: int, month: int):
  return date(year, month, 1)


def last_12_months():
  today = date.today()
  y, m = today.year, today.month
  out = []
  for _ in range(12):
    out.append(month_start(y, m))
    m -= 1
    if m == 0:
      m = 12
      y -= 1
  return list(reversed(out))


def seed():
  Base.metadata.create_all(bind=engine)
  db = SessionLocal()
  try:
    periods = last_12_months()
    for item in SEED_MATERIALS:
      material = db.query(Material).filter(Material.code == item["code"]).first()
      if not material:
        material = Material(
          code=item["code"],
          name=item["name"],
          unit=item["unit"],
          unit_price=item["unit_price"],
          rop=item["rop"],
          abc_class=item["abc"],
          xyz_class=item["xyz"],
        )
        db.add(material)
        db.flush()
      else:
        material.name = item["name"]
        material.unit = item["unit"]
        material.unit_price = item["unit_price"]
        material.rop = item["rop"]
        material.abc_class = item["abc"]
        material.xyz_class = item["xyz"]

      inv = db.query(Inventory).filter(Inventory.material_id == material.id).first()
      if not inv:
        inv = Inventory(material_id=material.id, on_hand=item["on_hand"], on_order=item["on_order"])
        db.add(inv)
      else:
        inv.on_hand = item["on_hand"]
        inv.on_order = item["on_order"]

      existing_count = db.query(ConsumptionHistory).filter(ConsumptionHistory.material_id == material.id).count()
      if existing_count == 0:
        base = max(item["on_hand"] * 0.55, 20)
        sigma = max(base * 0.22, 5)
        for p in periods:
          qty = max(1, random.gauss(base, sigma))
          db.add(ConsumptionHistory(material_id=material.id, period=p, qty_used=round(qty, 2)))

    db.commit()
    run_classification(db)
    print("Seed completed.")
  finally:
    db.close()


if __name__ == "__main__":
  seed()
