from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import Base, engine
from routers import chat, dashboard, gi, gr, inventory, purchase

app = FastAPI(title="WarehouseAI Backend")

_FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_methods=["*"],
  allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

app.include_router(chat.router, prefix="/api")
app.include_router(inventory.router, prefix="/api")
app.include_router(gr.router, prefix="/api")
app.include_router(gi.router, prefix="/api")
app.include_router(purchase.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")


@app.get("/health")
def health():
  return {"ok": True}


# Phục vụ giao diện web trên cùng cổng với API (tránh hai tiến trình / hai cổng trên Windows).
if _FRONTEND_DIR.is_dir():
  app.mount("/", StaticFiles(directory=str(_FRONTEND_DIR), html=True), name="frontend")
