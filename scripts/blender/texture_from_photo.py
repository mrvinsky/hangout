"""
Fotoğrafı rig'li modelin üzerine yandan yansıtarak doku üretir (ücretsiz, model servisi gerekmez).

Model şablon uzayında: baş -Y yönünde, yukarı +Z. Fotoğraftaki kedi sağa bakıyor, yani
fotoğraf modelin -X tarafından görünüşü: foto_x ↔ -Y, foto_y ↔ -Z. Diğer yan aynı
görüntünün aynası olur (düzlemsel izdüşüm). Fotoğraftaki kedi dışı alanlar, en yakın
kedi pikseli rengiyle doldurulur ki kenarlarda kanepe görünmesin.

Kullanım:
  blender -b <rigged.blend> -P scripts/blender/texture_from_photo.py -- \\
      <foto.jpg> <çıktı.glb> --nose X,Y --top Y --ground Y [--overlay kontrol.png]
    --nose : burun ucunun piksel konumu, --top : kulak ucu y, --ground : en alt pati y
"""
import bpy, sys, os
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:]
photo_path, out_path = argv[0], argv[1]
opt = {argv[i]: argv[i + 1] for i in range(2, len(argv) - 1, 2)}
nose_x, nose_y = map(float, opt["--nose"].split(","))
top_y, ground_y = float(opt["--top"]), float(opt["--ground"])

mesh = next(o for o in bpy.data.objects if o.type == "MESH" and o.name.startswith("GeneratedCat"))
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
co = np.array([mesh.matrix_world @ v.co for v in mesh.data.vertices])

# Model → foto eşlemesi: yükseklikten tek tip ölçek, burun ucuna sabitle
z_lo, z_hi = co[:, 2].min(), co[:, 2].max()
y_nose = co[:, 1].min()
k = (ground_y - top_y) / (z_hi - z_lo)          # piksel / birim
def to_photo(p):
    return np.stack([nose_x - (p[..., 1] - y_nose) * k, ground_y - (p[..., 2] - z_lo) * k], -1)

img = bpy.data.images.load(os.path.abspath(photo_path))
W, H = img.size
px = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)[::-1]  # üst satır başta

# Kedi maskesi: model köşelerini fotoğrafa nokta olarak bas, boşlukları kapat, kenardan içeri çek
uv_px = to_photo(co)


def morph(m, r, grow):
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dy * dy + dx * dx <= r * r:
                sh = np.roll(m, (dy, dx), (0, 1))
                out = (out | sh) if grow else (out & sh)
    return out


mask = np.zeros((H, W), bool)
ix = np.clip(uv_px.round().astype(int), 0, [W - 1, H - 1])
mask[ix[:, 1], ix[:, 0]] = True
mask = morph(mask, 10, True)           # nokta bulutunu doldur
mask = morph(mask, 13, False)          # kenar şeridini at
# Kahverengi kanepe/halı pikselleri kedi değil: gri-mavi kürk için B >= R - eşik
r, g, b = px[..., 0], px[..., 1], px[..., 2]
mask &= (b >= r - 0.03) & ((r + g + b) / 3 > 0.18)

# Maske dışını en yakın kedi rengiyle doldur (tekrarlı genişletme)
rgb = px[..., :3].copy()
filled = mask.copy()
for _ in range(200):
    if filled.all():
        break
    acc = np.zeros_like(rgb); cnt = np.zeros((H, W, 1), np.float32)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        sh_f = np.roll(filled, (dy, dx), (0, 1))
        sh_c = np.roll(rgb, (dy, dx), (0, 1))
        acc += sh_c * sh_f[..., None]; cnt += sh_f[..., None]
    grow = (~filled) & (cnt[..., 0] > 0)
    rgb[grow] = acc[grow] / cnt[grow]
    filled |= grow

if "--overlay" in opt:
    ov = px.copy()
    edge = mask & ~morph(mask, 2, False)
    ov[edge] = (1, 0.15, 0.15, 1)
    oimg = bpy.data.images.new("overlay", W, H)
    oimg.pixels = ov[::-1].ravel().tolist()
    oimg.filepath_raw = os.path.abspath(opt["--overlay"]); oimg.file_format = "PNG"; oimg.save()
    print("OVERLAY", opt["--overlay"])

tex = bpy.data.images.new("BobanFur", W, H)
out = np.concatenate([rgb, np.ones((H, W, 1), np.float32)], -1)[::-1]
tex.pixels = out.ravel().tolist()
tex.file_format = "PNG"
tex.pack()

# UV: her köşe kendi foto konumunu alır
me = mesh.data
uv_layer = me.uv_layers.new(name="PhotoUV") if not me.uv_layers else me.uv_layers[0]
for loop in me.loops:
    x, y = uv_px[loop.vertex_index]
    uv_layer.data[loop.index].uv = (x / W, 1.0 - y / H)

if not me.materials:
    m = bpy.data.materials.new("Fur"); m.use_nodes = True; me.materials.append(m)
mat = me.materials[0]
nt = mat.node_tree
bsdf = nt.nodes["Principled BSDF"]
node = nt.nodes.new("ShaderNodeTexImage"); node.image = tex
nt.links.new(node.outputs["Color"], bsdf.inputs["Base Color"])
bsdf.inputs["Roughness"].default_value = 0.8

bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True); arm.select_set(True)
bpy.ops.export_scene.gltf(filepath=out_path, export_format="GLB", use_selection=True, export_animations=False,
                          export_image_format="JPEG", export_jpeg_quality=88)
print("EXPORTED", out_path, os.path.getsize(out_path) // 1024, "KB")
