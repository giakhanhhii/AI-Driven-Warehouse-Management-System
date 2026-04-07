def infer_default_supplier(material_name: str) -> str:
  name = (material_name or "").strip().lower()
  if not name:
    return ""

  rules = (
    (("pp", "abs", "hạt nhựa"), "Công ty TNHH Nhựa Việt Thắng"),
    (("dầu nhớt", "hóa dầu", "iso 46"), "Công ty TNHH Hóa dầu Toàn Cầu"),
    (("keo", "hóa chất"), "Công ty CP Hóa chất Sài Gòn"),
    (("thép",), "Nhà máy Thép Việt Nhật"),
    (("mực in", "nhôm"), "Công ty TNHH Vật tư Công nghiệp Miền Nam"),
    (("giấy kraft", "túi pe", "pe", "băng keo"), "Công ty CP Bao bì Tiến Phát"),
  )

  for keywords, supplier in rules:
    if any(keyword in name for keyword in keywords):
      return supplier
  return "Công ty TNHH Vật tư Công nghiệp Miền Nam"
