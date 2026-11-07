"""
Fotoğraftan 3D model denemesi — Hugging Face Space (Hunyuan3D-2.1), ücretsiz.
Kullanım: .venv/bin/python -I scripts/gen3d_hf.py <foto.jpg> [çıktı_klasörü]
.env içinden HF_TOKEN okur. Çıktı: <klasör>/<foto>_shape.glb ve _textured.glb
"""
import os, sys, shutil, time
from pathlib import Path
from gradio_client import Client, handle_file

def load_env(path=".env"):
    for line in Path(path).read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

load_env()
photo = Path(sys.argv[1])
out_dir = Path(sys.argv[2] if len(sys.argv) > 2 else "scratch/models3d")
out_dir.mkdir(parents=True, exist_ok=True)

client = Client("tencent/Hunyuan3D-2.1", token=os.environ.get("HF_TOKEN"), verbose=False)
t0 = time.time()
print(f"Gönderiliyor: {photo} (kuyrukta bekleyebilir)", flush=True)
shape, textured, _html, stats, seed = client.predict(
    image=handle_file(str(photo)),
    steps=30,
    guidance_scale=5.0,
    seed=1234,
    octree_resolution=256,
    check_box_rembg=True,
    num_chunks=8000,
    randomize_seed=False,
    api_name="/generation_all",
)
for src, tag in [(shape, "shape"), (textured, "textured")]:
    if isinstance(src, dict):  # gradio bazen {"value": yol} şeklinde döndürür
        src = src.get("value") or src.get("path")
    dst = out_dir / f"{photo.stem}_{tag}{Path(src).suffix}"
    shutil.copy(src, dst)
    print("Kaydedildi:", dst, f"({dst.stat().st_size // 1024} KB)")
print("İstatistik:", stats)
print(f"Süre: {time.time() - t0:.0f} sn")
