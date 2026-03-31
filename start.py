import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from urllib.parse import quote

ROOT = os.path.dirname(os.path.abspath(__file__))


def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) == 0


def find_free_port(start_port):
    port = start_port
    while is_port_in_use(port):
        port += 1
    return port


def read_env_file(path):
    """Đọc .env thành dict (chỉ dòng KEY=...)."""
    out = {}
    if not os.path.exists(path):
        return out
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            k, v = k.strip(), v.strip().strip('"').strip("'")
            if k:
                out[k] = v
    return out


def ensure_env_file(env_path):
    """Tự tạo .env từ .env.example nếu người dùng chưa có file cấu hình local."""
    if os.path.exists(env_path):
        return
    example_path = os.path.join(ROOT, ".env.example")
    if not os.path.exists(example_path):
        return
    with open(example_path, "r", encoding="utf-8") as src:
        content = src.read()
    with open(env_path, "w", encoding="utf-8") as dst:
        dst.write(content)
    print("[*] Đã tạo .env từ .env.example. Bạn chỉ cần điền OPENAI_API_KEY nếu muốn bật AI chat OpenAI.")


def parse_port(val, default):
    try:
        p = int(str(val).strip())
        return p if 1 <= p <= 65535 else default
    except (TypeError, ValueError):
        return default


def write_backend_url(env_path, new_backend_url):
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        with open(env_path, "w", encoding="utf-8") as f:
            found = False
            for line in lines:
                if line.startswith("BACKEND_URL="):
                    f.write(f"BACKEND_URL={new_backend_url}\n")
                    found = True
                else:
                    f.write(line)
            if not found:
                f.write(f"\nBACKEND_URL={new_backend_url}\n")
    else:
        with open(env_path, "w", encoding="utf-8") as f:
            f.write(f"BACKEND_URL={new_backend_url}\n")


def terminate_process(proc):
    if proc is None or proc.poll() is not None:
        return
    proc.terminate()
    try:
        proc.wait(timeout=8)
    except subprocess.TimeoutExpired:
        proc.kill()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            pass


def wait_for_server_ready(base_url, timeout=20):
    deadline = time.time() + timeout
    health_url = f"{base_url}/health"
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(health_url, timeout=1.5) as resp:
                if resp.status == 200:
                    return True
        except (urllib.error.URLError, TimeoutError, OSError):
            time.sleep(0.5)
    return False


def main():
    env_path = os.path.join(ROOT, ".env")
    env_local_path = os.path.join(ROOT, ".env.local")
    ensure_env_file(env_path)
    file_env = read_env_file(env_path)
    local_env = read_env_file(env_local_path)
    merged_env = {**file_env, **local_env}

    # Một cổng cho cả API + giao diện (FastAPI StaticFiles).
    default_port = 8001
    app_port = parse_port(
        os.environ.get("APP_PORT")
        or os.environ.get("BACKEND_PORT")
        or merged_env.get("APP_PORT")
        or merged_env.get("BACKEND_PORT"),
        default_port,
    )

    port_mode = (os.environ.get("START_PORT_MODE") or merged_env.get("START_PORT_MODE") or "fixed").strip().lower()
    if port_mode == "auto":
        app_port = find_free_port(app_port)
    elif is_port_in_use(app_port):
        print(
            f"[!] Cổng {app_port} đang được dùng (thường do tiến trình uvicorn/python cũ chưa tắt).\n"
            "    Đóng terminal cũ hoặc Task Manager → kết thúc python đang giữ cổng đó.\n"
            f"    (Windows: netstat -ano | findstr :{app_port})\n"
            "    Hoặc đặt APP_PORT / BACKEND_PORT khác trong .env; hoặc START_PORT_MODE=auto.\n"
            "    Lưu ý: không dùng shell=True nữa — Ctrl+C trong terminal chạy start.py sẽ dừng server gọn hơn."
        )
        sys.exit(1)

    new_backend_url = f"http://127.0.0.1:{app_port}"
    print(f"[*] Ứng dụng (API + web): {new_backend_url}")
    write_backend_url(env_path, new_backend_url)

    backend_dir = os.path.join(ROOT, "backend")
    # Không dùng shell=True: trên Windows terminate() mới dừng đúng tiến trình uvicorn, tránh cổng bị kẹt.
    cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "main:app",
        "--host",
        "127.0.0.1",
        "--port",
        str(app_port),
        "--reload",
        "--reload-dir",
        backend_dir,
    ]
    print("[*] Đang khởi động uvicorn (reload khi sửa code trong backend/)...")
    proc = subprocess.Popen(
        cmd,
        cwd=backend_dir,
        shell=False,
        stdin=subprocess.DEVNULL,
    )

    open_url = f"{new_backend_url}/?backend={quote(new_backend_url, safe='')}"
    print("\n[SUCCESS] URL ứng dụng:")
    print(f"  {open_url}")
    print("  - Sửa Python trong backend/: tự reload.")
    print("  - Sửa frontend/*.html|js|css: F5 (Ctrl+F5 nếu cache).")
    print("\nNhấn Ctrl+C để dừng server.\n")

    server_ready = wait_for_server_ready(new_backend_url)
    if server_ready:
        print("[*] Server đã sẵn sàng.")
    else:
        print("[!] Server chưa phản hồi /health trong thời gian chờ. Kiểm tra log uvicorn bên dưới nếu web không vào được.")

    auto_open = (os.environ.get("AUTO_OPEN_BROWSER") or merged_env.get("AUTO_OPEN_BROWSER") or "0").strip().lower()
    if auto_open in {"1", "true", "yes", "on"} and server_ready:
        try:
            webbrowser.open(open_url)
        except OSError:
            print("[!] Không thể tự mở trình duyệt. Hãy copy URL ở trên để mở thủ công.")
    else:
        print("[*] Mở trình duyệt thủ công bằng URL ở trên để tránh lỗi tự khởi động Chrome.")

    try:
        proc.wait()
    except KeyboardInterrupt:
        print("\n[*] Đang dừng server...")
        terminate_process(proc)
        sys.exit(0)


if __name__ == "__main__":
    main()
