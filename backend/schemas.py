from datetime import date
from typing import Optional

from pydantic import BaseModel


class ChatRequest(BaseModel):
  message: str
  thread_id: Optional[str] = None


class ChatResponse(BaseModel):
  reply: str
  thread_id: str


class GRRequest(BaseModel):
  material_code: str
  material_name: Optional[str] = None
  quantity: float
  unit: Optional[str] = None
  supplier: Optional[str] = None
  date: date
  qc: str = "pass"
  notes: Optional[str] = None


class GIRequest(BaseModel):
  production_order_code: Optional[str] = None
  material_code: str
  quantity: float
  issued_by: Optional[str] = None
  date: date
  notes: Optional[str] = None


class PurchaseRequestCreate(BaseModel):
  material_code: Optional[str] = None
  material: Optional[str] = None
  quantity: float
  supplier: Optional[str] = None
