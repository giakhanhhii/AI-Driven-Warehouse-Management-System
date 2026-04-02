from sqlalchemy import CHAR, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import relationship

from database import Base


class Material(Base):
  __tablename__ = "materials"
  id = Column(Integer, primary_key=True, index=True)
  code = Column(String(20), unique=True, nullable=False, index=True)
  name = Column(String(200), nullable=False, index=True)
  unit = Column(String(20), nullable=False)
  unit_price = Column(Numeric(15, 2), default=0)
  rop = Column(Numeric(10, 2), default=0)
  abc_class = Column(CHAR(1), default="C")
  xyz_class = Column(CHAR(1), default="Z")
  created_at = Column(DateTime, server_default=func.now())
  inventory = relationship("Inventory", back_populates="material", uselist=False, cascade="all, delete-orphan")


class Inventory(Base):
  __tablename__ = "inventory"
  id = Column(Integer, primary_key=True, index=True)
  material_id = Column(Integer, ForeignKey("materials.id"))
  on_hand = Column(Numeric(10, 2), default=0)
  on_order = Column(Numeric(10, 2), default=0)
  updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
  material = relationship("Material", back_populates="inventory")


class GoodsReceipt(Base):
  __tablename__ = "goods_receipts"
  id = Column(Integer, primary_key=True, index=True)
  material_code = Column(String(20), nullable=False, index=True)
  material_name = Column(String(200))
  quantity = Column(Numeric(10, 2), nullable=False)
  unit = Column(String(20))
  supplier = Column(String(200))
  date = Column(Date, nullable=False)
  qc = Column(String(10), default="pass")
  notes = Column(Text)
  created_at = Column(DateTime, server_default=func.now())


class GoodsIssue(Base):
  __tablename__ = "goods_issues"
  id = Column(Integer, primary_key=True, index=True)
  production_order_code = Column(String(50))
  material_code = Column(String(20), nullable=False, index=True)
  quantity = Column(Numeric(10, 2), nullable=False)
  issued_by = Column(String(100))
  date = Column(Date, nullable=False)
  notes = Column(Text)
  created_at = Column(DateTime, server_default=func.now())


class PurchaseRequest(Base):
  __tablename__ = "purchase_requests"
  id = Column(Integer, primary_key=True, index=True)
  pr_code = Column(String(30), unique=True, index=True)
  material = Column(String(200), nullable=False)
  quantity = Column(Numeric(10, 2), nullable=False)
  supplier = Column(String(200))
  created_at = Column(Date, server_default=func.current_date())
  status = Column(String(20), default="pending")


class ConsumptionHistory(Base):
  __tablename__ = "consumption_history"
  id = Column(Integer, primary_key=True, index=True)
  material_id = Column(Integer, ForeignKey("materials.id"))
  period = Column(Date, nullable=False)
  qty_used = Column(Numeric(10, 2), nullable=False)
