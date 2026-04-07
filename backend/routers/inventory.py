from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from models import Inventory, Material

router = APIRouter(tags=["inventory"])


@router.get("/inventory")
def get_inventory(db: Session = Depends(get_db)):
  rows = db.execute(select(Material, Inventory).join(Inventory, Inventory.material_id == Material.id)).all()
  return [
    {
      "code": m.code,
      "name": m.name,
      "unit": m.unit,
      "stock": float(i.on_hand or 0),
      "on_hand": float(i.on_hand or 0),
      "on_order": float(i.on_order or 0),
      "rop": float(m.rop or 0),
      "abc": m.abc_class,
    }
    for m, i in rows
  ]
