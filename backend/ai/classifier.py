import math

from sqlalchemy import select
from sqlalchemy.orm import Session

from models import ConsumptionHistory, Material


def run_classification(db: Session):
  materials = db.execute(select(Material)).scalars().all()
  if not materials:
    return

  values = []
  for m in materials:
    inv = m.inventory.on_hand if m.inventory else 0
    values.append((m, float(inv) * float(m.unit_price or 0)))
  values.sort(key=lambda x: x[1], reverse=True)
  total = sum(v for _, v in values) or 1

  running = 0.0
  for m, val in values:
    running += val
    pct = running / total
    m.abc_class = "A" if pct <= 0.7 else ("B" if pct <= 0.9 else "C")

  for m in materials:
    hist = db.execute(
      select(ConsumptionHistory).where(ConsumptionHistory.material_id == m.id)
    ).scalars().all()
    data = [float(x.qty_used) for x in hist]
    if len(data) < 2:
      m.xyz_class = "Z"
      continue
    mean = sum(data) / len(data)
    if mean <= 0:
      m.xyz_class = "Z"
      continue
    var = sum((x - mean) ** 2 for x in data) / len(data)
    cv = math.sqrt(var) / mean
    m.xyz_class = "X" if cv < 0.5 else ("Y" if cv <= 1.0 else "Z")

  db.commit()
