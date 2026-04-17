from datetime import date

import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVR
from sqlalchemy import select
from sqlalchemy.orm import Session

from models import ConsumptionHistory, Material

MODEL_LABELS = {
  "linear_regression": "Linear Regression",
  "random_forest": "Random Forest",
  "svr": "SVR",
}


def _next_period_from_history(last_period: date) -> str:
  next_month = last_period.month + 1
  year = last_period.year + (1 if next_month == 13 else 0)
  month = 1 if next_month == 13 else next_month
  return f"{year}-{month:02d}"


def _normalize_model_name(model_name: str | None) -> str:
  key = str(model_name or "").strip().lower()
  aliases = {
    "linear": "linear_regression",
    "linear_regression": "linear_regression",
    "linear regression": "linear_regression",
    "lr": "linear_regression",
    "random_forest": "random_forest",
    "random forest": "random_forest",
    "forest": "random_forest",
    "rf": "random_forest",
    "svr": "svr",
    "svm": "svr",
    "svn": "svr",
  }
  return aliases.get(key, "linear_regression")


def _resolve_material(db: Session, material_name: str):
  search = str(material_name or "").strip()
  if not search:
    return None

  exact = db.execute(select(Material).where(Material.name.ilike(search) | Material.code.ilike(search))).scalars().first()
  if exact:
    return exact

  return db.execute(
    select(Material)
    .where(Material.name.ilike(f"%{search}%") | Material.code.ilike(f"%{search}%"))
    .order_by(Material.name)
  ).scalars().first()


def _load_history(db: Session, material_id: int):
  rows = db.execute(
    select(ConsumptionHistory)
    .where(ConsumptionHistory.material_id == material_id)
    .order_by(ConsumptionHistory.period)
  ).scalars().all()
  values = [float(r.qty_used) for r in rows]
  return rows, values


def _select_lag_window(n_points: int) -> int | None:
  for window in (3, 2, 1):
    if n_points - window >= 2:
      return window
  return 1 if n_points >= 2 else None


def _build_lag_dataset(values: list[float], window: int):
  x, y = [], []
  for idx in range(window, len(values)):
    x.append(values[idx - window:idx])
    y.append(values[idx])
  return np.array(x, dtype=float), np.array(y, dtype=float)


def _forecast_by_time_trend(values: list[float]):
  x = np.arange(1, len(values) + 1, dtype=float).reshape(-1, 1)
  y = np.array(values, dtype=float)
  model = LinearRegression()
  model.fit(x, y)
  pred = float(model.predict(np.array([[len(values) + 1]], dtype=float))[0])
  return pred, "Hồi quy tuyến tính theo chỉ số thời gian do chuỗi lịch sử còn ngắn."


def _forecast_by_linear_regression(values: list[float]):
  window = _select_lag_window(len(values))
  if window is None:
    return 0.0, ""

  if len(values) < 4:
    return _forecast_by_time_trend(values)

  x, y = _build_lag_dataset(values, window)
  model = LinearRegression()
  model.fit(x, y)
  next_input = np.array([values[-window:]], dtype=float)
  pred = float(model.predict(next_input)[0])
  note = f"Linear Regression dùng đặc trưng trễ {window} kỳ gần nhất để dự báo kỳ tiếp theo."
  return pred, note


def _forecast_by_random_forest(values: list[float]):
  window = _select_lag_window(len(values))
  if window is None:
    return 0.0, "Chuỗi lịch sử chưa đủ để huấn luyện Random Forest."

  x, y = _build_lag_dataset(values, window)
  if len(y) < 2:
    pred, fallback_note = _forecast_by_linear_regression(values)
    return pred, f"Dữ liệu còn ít nên tạm dùng {fallback_note}"

  model = RandomForestRegressor(
    n_estimators=200,
    max_depth=4,
    min_samples_leaf=1,
    random_state=42,
  )
  model.fit(x, y)
  next_input = np.array([values[-window:]], dtype=float)
  pred = float(model.predict(next_input)[0])
  note = f"Random Forest dùng {len(y)} mẫu huấn luyện với cửa sổ trễ {window} kỳ."
  return pred, note


def _forecast_by_svr(values: list[float]):
  window = _select_lag_window(len(values))
  if window is None:
    return 0.0, "Chuỗi lịch sử chưa đủ để huấn luyện SVR."

  x, y = _build_lag_dataset(values, window)
  if len(y) < 2:
    pred, fallback_note = _forecast_by_linear_regression(values)
    return pred, f"Dữ liệu còn ít nên tạm dùng {fallback_note}"

  model = make_pipeline(
    StandardScaler(),
    SVR(kernel="rbf", C=50, epsilon=0.1, gamma="scale"),
  )
  model.fit(x, y)
  next_input = np.array([values[-window:]], dtype=float)
  pred = float(model.predict(next_input)[0])
  note = f"SVR dùng cửa sổ trễ {window} kỳ và chuẩn hóa dữ liệu đầu vào trước khi dự báo."
  return pred, note


def _run_model(values: list[float], model_name: str):
  model_key = _normalize_model_name(model_name)
  if model_key == "random_forest":
    pred, note = _forecast_by_random_forest(values)
  elif model_key == "svr":
    pred, note = _forecast_by_svr(values)
  else:
    pred, note = _forecast_by_linear_regression(values)
    model_key = "linear_regression"
  return model_key, pred, note


def get_forecast(db: Session, material_name: str, model_name: str = "linear_regression"):
  material = _resolve_material(db, material_name)
  model_key = _normalize_model_name(model_name)
  if not material:
    return {
      "material": material_name,
      "predicted_qty": 0.0,
      "period": "",
      "model_requested": model_key,
      "model_used": model_key,
      "model_label": MODEL_LABELS[model_key],
      "note": "",
    }

  rows, values = _load_history(db, material.id)
  if len(rows) < 2:
    return {
      "material": material.name,
      "predicted_qty": 0.0,
      "period": "",
      "model_requested": model_key,
      "model_used": model_key,
      "model_label": MODEL_LABELS[model_key],
      "note": "Cần tối thiểu 2 kỳ tiêu thụ để dự báo.",
    }

  model_used, pred, note = _run_model(values, model_key)
  return {
    "material": material.name,
    "predicted_qty": round(max(pred, 0), 2),
    "period": _next_period_from_history(rows[-1].period),
    "model_requested": model_key,
    "model_used": model_used,
    "model_label": MODEL_LABELS[model_used],
    "note": note,
    "history_points": len(values),
  }


def get_forecast_bundle(db: Session, material_name: str):
  material = _resolve_material(db, material_name)
  if not material:
    return {"material": material_name, "period": "", "forecasts": []}

  rows, values = _load_history(db, material.id)
  if len(rows) < 2:
    return {"material": material.name, "period": "", "forecasts": []}

  forecasts = []
  for key in ("linear_regression", "random_forest", "svr"):
    used, pred, note = _run_model(values, key)
    forecasts.append(
      {
        "model_key": key,
        "model_used": used,
        "model_label": MODEL_LABELS[used],
        "predicted_qty": round(max(pred, 0), 2),
        "note": note,
      }
    )

  return {
    "material": material.name,
    "period": _next_period_from_history(rows[-1].period),
    "history_points": len(values),
    "forecasts": forecasts,
  }
