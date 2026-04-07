from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from models import GoodsReceipt, Inventory, Material
from schemas import GRRequest

router = APIRouter(tags=["gr"])


@router.post("/gr")
def create_gr(payload: GRRequest, db: Session = Depends(get_db)):
  gr = GoodsReceipt(**payload.model_dump())
  db.add(gr)

  material = db.execute(select(Material).where(Material.code == payload.material_code)).scalar_one_or_none()
  if not material:
    db.rollback()
    raise HTTPException(status_code=404, detail="Material not found")
  inv = db.execute(select(Inventory).where(Inventory.material_id == material.id)).scalar_one_or_none()
  if not inv:
    inv = Inventory(material_id=material.id, on_hand=0, on_order=0)
    db.add(inv)

  if payload.qc.lower() == "pass":
    inv.on_hand = float(inv.on_hand or 0) + payload.quantity
    inv.on_order = max(0.0, float(inv.on_order or 0) - payload.quantity)

  db.commit()
  db.refresh(gr)
  return {"success": True, "id": gr.id}
