"""
Üretilmiş (iskeletsiz) kedi mesh'ini temizler ve Cat.glb iskeletine bağlar.

Adımlar:
 1. Şablonu ve yeni mesh'i içe aktar
 2. İnce çıkıntıları (Patronus dumanı, bıyık) hacimsel "opening" ile ayıkla, en büyük parçayı tut
 3. Yönünü bul (baş → -Y), şablonun boyuna ölçekle
 4. Voxel remesh + decimate (mobil için ~25k yüz)
 5. Bacak kemiklerini yeni pati konumlarına kaydır, otomatik ağırlıkla iskelete bağla
 6. GLB olarak dışa aktar (kemik adları CatRig ile aynı)

Kullanım:
  blender -b -P scripts/blender/rig_generated_cat.py -- <girdi.glb> <çıktı.glb>
"""
import bpy, bmesh, sys, os, math
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--") + 1:]
in_path, out_path = argv[0], argv[1]
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEMPLATE = os.path.join(root, "public/models/cat/source/Cat.glb")
VOX = 160            # ızgara çözünürlüğü (uzun eksen)
OPEN_RADIUS = 3      # bu kalınlıktan (voxel) ince yapılar silinir
TARGET_FACES = 25000

bpy.ops.wm.read_factory_settings(use_empty=True)


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def activate(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


# --- 1. Şablon ve yeni mesh ---
template = import_glb(TEMPLATE)
arm = next(o for o in template if o.type == "ARMATURE")
for o in template:
    if o.type == "MESH":
        o.hide_render = True
        o.hide_set(True)
bones = {b.name: (arm.matrix_world @ b.head_local, arm.matrix_world @ b.tail_local) for b in arm.data.bones}

new_objs = import_glb(in_path)
meshes = [o for o in new_objs if o.type == "MESH"]
activate(meshes[0])
for o in meshes:
    o.select_set(True)
bpy.ops.object.join()
mesh = bpy.context.view_layer.objects.active
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
for o in new_objs:
    if o != mesh and o.name in bpy.data.objects:
        bpy.data.objects.remove(o)
mesh.name = "GeneratedCat"

activate(mesh)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


# --- 2. İnce çıkıntıları ayıkla ---
def occupancy(obj, res):
    """Z ekseni boyunca ışın paritesiyle içi dolu voxel ızgarası"""
    bm = bmesh.new(); bm.from_mesh(obj.data)
    bvh = BVHTree.FromBMesh(bm)
    co = np.array([v.co for v in bm.verts])
    bm.free()
    lo, hi = co.min(0), co.max(0)
    step = (hi - lo).max() / res
    lo -= step * 2
    dims = np.ceil((hi - lo) / step).astype(int) + 3
    grid = np.zeros(dims, dtype=bool)
    top = lo[2] + dims[2] * step + step
    for i in range(dims[0]):
        for j in range(dims[1]):
            x, y = lo[0] + (i + 0.5) * step, lo[1] + (j + 0.5) * step
            hits, origin = [], Vector((x, y, top))
            while True:
                loc, _n, _idx, _d = bvh.ray_cast(origin, Vector((0, 0, -1)))
                if loc is None:
                    break
                hits.append(loc.z)
                origin = Vector((x, y, loc.z - 1e-5))
                if len(hits) > 64:
                    break
            for a in range(0, len(hits) - 1, 2):
                k0 = int((hits[a + 1] - lo[2]) / step)
                k1 = int((hits[a] - lo[2]) / step)
                grid[i, j, max(k0, 0):k1 + 1] = True
    return grid, lo, step


def shift_and(g, r):
    out = g.copy()
    for ax in range(3):
        for d in range(1, r + 1):
            out &= np.roll(g, d, ax) & np.roll(g, -d, ax)
    return out


def shift_or(g, r):
    out = g.copy()
    for ax in range(3):
        for d in range(1, r + 1):
            out |= np.roll(g, d, ax) | np.roll(g, -d, ax)
    return out


grid, glo, gstep = occupancy(mesh, VOX)
opened = shift_or(shift_and(grid, OPEN_RADIUS), OPEN_RADIUS + 1)
print("VOXELS", grid.sum(), "after opening", opened.sum())

solid = opened & grid
print("VOXELS", grid.sum(), "solid", solid.sum())


def grid_to_mesh(g, origin, step, name):
    """Dolu voxellerin dış yüzlerinden kapalı (manifold) bir blok mesh üretir"""
    verts, faces, vidx = [], [], {}
    def vi(i, j, k):
        key = (i, j, k)
        if key not in vidx:
            vidx[key] = len(verts)
            verts.append((origin[0] + i * step, origin[1] + j * step, origin[2] + k * step))
        return vidx[key]
    pad = np.pad(g, 1)
    quads = {
        0: [(1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1)],
        1: [(0, 1, 0), (0, 1, 1), (1, 1, 1), (1, 1, 0)],
        2: [(0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)],
    }
    for ax in range(3):
        for d in (1, -1):
            nb = np.roll(pad, -d, ax)
            ii, jj, kk = np.nonzero(pad & ~nb)
            for i, j, k in zip(ii - 1, jj - 1, kk - 1):
                base = [i, j, k]
                if d == -1:
                    base[ax] -= 1
                q = [vi(base[0] + a, base[1] + b, base[2] + c) for a, b, c in quads[ax]]
                faces.append(q if d == 1 else q[::-1])
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return obj


old = mesh
mesh = grid_to_mesh(solid, glo, gstep, "GeneratedCat")
bpy.data.objects.remove(old)
activate(mesh)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.remove_doubles(threshold=gstep * 0.01)
bpy.ops.object.mode_set(mode="OBJECT")

# En büyük bağlı parçayı tut
activate(mesh)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.separate(type="LOOSE")
bpy.ops.object.mode_set(mode="OBJECT")
parts = sorted([o for o in bpy.data.objects if o.type == "MESH" and not o.hide_get()], key=lambda o: len(o.data.vertices), reverse=True)
mesh = parts[0]
for p in parts[1:]:
    bpy.data.objects.remove(p)
mesh.name = "GeneratedCat"


# --- 3. Şablon ölçülerine oturt ---
def bbox(o):
    co = np.array([o.matrix_world @ v.co for v in o.data.vertices])
    return co.min(0), co.max(0)


# Yön: yatay düzlemde ana bileşen (PCA) gövde boyu; en yüksek nokta (kulaklar) baş tarafı. Baş → -Y
co = np.array([mesh.matrix_world @ v.co for v in mesh.data.vertices])
body = co[co[:, 2] > np.percentile(co[:, 2], 40)]   # bacak ve kuyruk ucu yerine gövde ağırlıklı
xy = body[:, :2] - body[:, :2].mean(0)
_, _, vt = np.linalg.svd(xy, full_matrices=False)
axis = vt[0]
top = co[co[:, 2].argmax(), :2] - body[:, :2].mean(0)
if top @ axis < 0:
    axis = -axis
angle = Vector((axis[0], axis[1])).angle_signed(Vector((0, -1)))
mesh.matrix_world = Matrix.Rotation(-angle, 4, "Z") @ mesh.matrix_world
activate(mesh)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
print("ORIENT head axis", axis.round(3), "rot_deg", round(math.degrees(-angle)))

lo, hi = bbox(mesh)
# Şablon: burun ucu ~ Jaw tail, zemin ~ ayak uçları, tepe ~ kulak uçları. Tek tip ölçek (kuyruk boyu farklı olabilir)
t_front = bones["Jaw"][1].y - 0.02
t_ground = min(bones[f"Foot_{s}"][1].z for s in ("FR", "FL", "BR", "BL"))
t_top = max(bones["Ear_R2"][1].z, bones["Ear_L2"][1].z)
k = (t_top - t_ground) / (hi[2] - lo[2])
cx = (lo[0] + hi[0]) / 2
mesh.matrix_world = (
    Matrix.Translation((0.003, t_front, t_ground))
    @ Matrix.Diagonal((k, k, k, 1))
    @ Matrix.Translation((-cx, -lo[1], -lo[2]))
)
activate(mesh)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
print("FIT scale", k)

# --- 4. Remesh + sadeleştir ---
rm = mesh.modifiers.new("Remesh", "REMESH")
rm.mode = "VOXEL"
rm.voxel_size = 0.005
bpy.ops.object.modifier_apply(modifier="Remesh")
sm = mesh.modifiers.new("Smooth", "LAPLACIANSMOOTH")
sm.iterations = 12
sm.lambda_factor = 0.8
bpy.ops.object.modifier_apply(modifier="Smooth")
dec = mesh.modifiers.new("Decimate", "DECIMATE")
dec.ratio = min(1.0, TARGET_FACES / max(len(mesh.data.polygons), 1))
bpy.ops.object.modifier_apply(modifier="Decimate")
bpy.ops.object.shade_smooth()
print("FACES", len(mesh.data.polygons))
bpy.ops.wm.save_as_mainfile(filepath=out_path.replace(".glb", ".blend"))

mat = bpy.data.materials.new("Fur")
mat.use_nodes = True
mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.42, 0.45, 0.5, 1)
mesh.data.materials.clear()
mesh.data.materials.append(mat)

# --- 5. Bacakları patilere hizala ve bağla ---
co = np.array([v.co for v in mesh.data.vertices])
ground = co[:, 2].min()
low = co[co[:, 2] < ground + 0.05][:, :2]   # pati bölgesi
# 4 pati kümesi (k-means), sonra ön/arka ve sol/sağ olarak etiketle
rng = np.random.default_rng(0)
cent = low[rng.choice(len(low), 4, replace=False)]
for _ in range(30):
    lab = np.argmin(((low[:, None] - cent[None]) ** 2).sum(-1), 1)
    cent = np.array([low[lab == i].mean(0) if (lab == i).any() else cent[i] for i in range(4)])
order = np.argsort(cent[:, 1])                 # küçük y = ön
front_c, back_c = cent[order[:2]], cent[order[2:]]
paws = {
    "FL": front_c[np.argmax(front_c[:, 0])], "FR": front_c[np.argmin(front_c[:, 0])],
    "BL": back_c[np.argmax(back_c[:, 0])], "BR": back_c[np.argmin(back_c[:, 0])],
}
print("PAWS", {k: tuple(v.round(3)) for k, v in paws.items()})
for side in ("FR", "FL", "BR", "BL"):
    foot_tip = bones[f"Foot_{side}"][1]
    target = paws[side]
    delta = Vector((target[0] - foot_tip.x, target[1] - foot_tip.y, 0))
    if delta.length > 0.25:
        print("FOOT shift too large, skipped", side, tuple(round(d, 3) for d in delta))
        continue
    activate(arm)
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm.data.edit_bones
    chain = [f"Thigh_{side}", f"Knee_{side}", f"Foot_{side}"]
    top_z, bottom_z = eb[chain[0]].head.z, eb[chain[-1]].tail.z
    def w(z):  # kalçada 0, patide 1 oranında kaydır
        return max(0.0, min(1.0, (top_z - z) / max(top_z - bottom_z, 1e-6)))
    for name in chain:
        b = eb[name]
        b.head = b.head + delta * w(b.head.z)
        b.tail = b.tail + delta * w(b.tail.z)
    bpy.ops.object.mode_set(mode="OBJECT")
    print("FOOT", side, "shift", tuple(round(d, 3) for d in delta))

# Eski şablon mesh'lerini sil, yenisini otomatik ağırlıkla bağla
for o in template:
    if o.type == "MESH" and o.name in bpy.data.objects:
        bpy.data.objects.remove(o)
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type="ARMATURE_AUTO")
weighted = {mesh.vertex_groups[g.group].name for v in mesh.data.vertices for g in v.groups if g.weight > 0.01}
print("WEIGHT bones with weights", len(weighted), "/", len(arm.data.bones))

# --- 6. Dışa aktar ---
bpy.ops.object.select_all(action="DESELECT")
arm.select_set(True)
mesh.select_set(True)
bpy.ops.export_scene.gltf(filepath=out_path, export_format="GLB", use_selection=True, export_animations=False)
print("EXPORTED", out_path)
