from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from database import get_db
from models import Inventory, Material, PurchaseRequest
from schemas import PurchaseRequestCreate
from services.purchasing import infer_default_supplier

router = APIRouter(tags=["purchase"])


def _find_material_by_purchase_name(db: Session, material_name: str):
  if not (material_name or "").strip():
    return None
  return db.execute(select(Material).where(Material.name == material_name)).scalar_one_or_none()


def _find_material_from_payload(db: Session, payload: PurchaseRequestCreate):
  code = (payload.material_code or "").strip()
  name = (payload.material or "").strip()
  if code:
    by_code = db.execute(select(Material).where(Material.code == code)).scalar_one_or_none()
    if by_code:
      return by_code
  if name:
    exact = db.execute(select(Material).where(Material.name == name)).scalar_one_or_none()
    if exact:
      return exact
    fuzzy = db.execute(select(Material).where(Material.name.ilike(f"%{name}%"))).scalars().first()
    if fuzzy:
      return fuzzy
  return None


def _next_pr_code(db: Session):
  today = date.today()
  running = db.query(PurchaseRequest).count() + 1
  return f"PR-{today.year}-{running:03d}"


@router.get("/purchase-requests")
def get_purchase_requests(db: Session = Depends(get_db)):
  rows = db.execute(select(PurchaseRequest).order_by(desc(PurchaseRequest.id))).scalars().all()
  return [
    {
      "id": r.id,
      "pr_code": r.pr_code,
      "material": r.material,
      "quantity": float(r.quantity or 0),
      "supplier": r.supplier or infer_default_supplier(r.material),
      "created_at": str(r.created_at),
      "status": r.status,
    }
    for r in rows
  ]


@router.post("/purchase-requests")
def create_purchase_request(payload: PurchaseRequestCreate, db: Session = Depends(get_db)):
  if float(payload.quantity or 0) <= 0:
    raise HTTPException(status_code=400, detail="Số lượng yêu cầu phải lớn hơn 0")

  material = _find_material_from_payload(db, payload)
  material_name = (
    material.name
    if material
    else (payload.material or payload.material_code or "").strip()
  )
  if not material_name:
    raise HTTPException(status_code=400, detail="Thiếu thông tin vật tư để tạo yêu cầu")

  supplier = (payload.supplier or "").strip() or infer_default_supplier(material_name)
  pr = PurchaseRequest(
    pr_code=_next_pr_code(db),
    material=material_name,
    quantity=float(payload.quantity or 0),
    supplier=supplier,
    status="pending",
  )
  db.add(pr)
  db.commit()
  db.refresh(pr)
  return {
    "success": True,
    "id": pr.id,
    "pr_code": pr.pr_code,
    "material": pr.material,
    "quantity": float(pr.quantity or 0),
    "supplier": pr.supplier,
    "created_at": str(pr.created_at),
    "status": pr.status,
  }


@router.post("/purchase-requests/{request_id}/approve")
def approve_purchase_request(request_id: int, db: Session = Depends(get_db)):
  pr = db.execute(select(PurchaseRequest).where(PurchaseRequest.id == request_id)).scalar_one_or_none()
  if not pr:
    raise HTTPException(status_code=404, detail="Purchase request not found")
  if pr.status != "pending":
    raise HTTPException(status_code=400, detail="Chỉ có thể duyệt yêu cầu đang chờ duyệt")

  pr.status = "approved"
  if not (pr.supplier or "").strip():
    pr.supplier = infer_default_supplier(pr.material)

  material = _find_material_by_purchase_name(db, pr.material)
  if material:
    inv = db.execute(select(Inventory).where(Inventory.material_id == material.id)).scalar_one_or_none()
    if not inv:
      inv = Inventory(material_id=material.id, on_hand=0, on_order=0)
      db.add(inv)
    inv.on_order = float(inv.on_order or 0) + float(pr.quantity or 0)

  db.commit()
  return {
    "success": True,
    "id": pr.id,
    "status": pr.status,
    "supplier": pr.supplier,
    "quantity": float(pr.quantity or 0),
  }


@router.post("/purchase-requests/{request_id}/reject")
def reject_purchase_request(request_id: int, db: Session = Depends(get_db)):
  pr = db.execute(select(PurchaseRequest).where(PurchaseRequest.id == request_id)).scalar_one_or_none()
  if not pr:
    raise HTTPException(status_code=404, detail="Purchase request not found")
  if pr.status != "pending":
    raise HTTPException(status_code=400, detail="Chỉ có thể từ chối yêu cầu đang chờ duyệt")

  pr.status = "rejected"
  if not (pr.supplier or "").strip():
    pr.supplier = infer_default_supplier(pr.material)

  db.commit()
  return {
    "success": True,
    "id": pr.id,
    "status": pr.status,
    "supplier": pr.supplier,
    "quantity": float(pr.quantity or 0),
  }
