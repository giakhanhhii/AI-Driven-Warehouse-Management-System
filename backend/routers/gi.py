from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from models import GoodsIssue, Inventory, Material, PurchaseRequest
from schemas import GIRequest
from services.purchasing import infer_default_supplier

router = APIRouter(tags=["gi"])


@router.post("/gi")
def create_gi(payload: GIRequest, db: Session = Depends(get_db)):
  material = db.execute(select(Material).where(Material.code == payload.material_code)).scalar_one_or_none()
  if not material:
    raise HTTPException(status_code=404, detail="Material not found")
  inv = db.execute(select(Inventory).where(Inventory.material_id == material.id)).scalar_one_or_none()
  if not inv:
    raise HTTPException(status_code=400, detail="Inventory not initialized")
  if float(inv.on_hand or 0) < payload.quantity:
    raise HTTPException(status_code=400, detail="Insufficient stock")

  gi = GoodsIssue(**payload.model_dump())
  db.add(gi)
  inv.on_hand = float(inv.on_hand or 0) - payload.quantity

  auto_pr_created = False
  if float(inv.on_hand or 0) <= float(material.rop or 0):
    today = date.today()
    running = db.query(PurchaseRequest).count() + 1
    pr = PurchaseRequest(
      pr_code=f"PR-{today.year}-{running:03d}",
      material=material.name,
      quantity=max(float(material.rop or 0) * 2 - float(inv.on_hand or 0), payload.quantity),
      supplier=infer_default_supplier(material.name),
      status="pending",
    )
    db.add(pr)
    auto_pr_created = True

  db.commit()
  db.refresh(gi)
  return {"success": True, "id": gi.id, "auto_pr_created": auto_pr_created}
