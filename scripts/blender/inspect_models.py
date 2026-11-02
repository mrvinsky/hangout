"""
Blender'da şablon kediyi (Cat.glb) ve üretilen mesh'i yan yana yükleyip
kemik konumlarını ve sınır kutularını yazdırır, üç ortografik görünüm render eder.
Kullanım: blender -b -P scripts/blender/inspect_models.py -- <yeni.glb> <çıktı_klasörü>
"""
import bpy, sys, os
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
new_path, out_dir = argv[0], argv[1]
os.makedirs(out_dir, exist_ok=True)
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

bpy.ops.wm.read_factory_settings(use_empty=True)

def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]

def world_bbox(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs if o.type == "MESH" for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi

cat = import_glb(os.path.join(root, "public/models/cat/source/Cat.glb"))
arm = next(o for o in cat if o.type == "ARMATURE")
print("CAT bbox", world_bbox(cat))
for b in arm.data.bones:
    print("BONE", b.name, tuple(round(v, 4) for v in arm.matrix_world @ b.head_local), tuple(round(v, 4) for v in arm.matrix_world @ b.tail_local))

new = import_glb(new_path)
lo, hi = world_bbox(new)
print("NEW bbox", lo, hi, "faces", sum(len(o.data.polygons) for o in new if o.type == "MESH"))

# Yeni mesh'i kedinin yanına taşı ki ikisi de görünsün
clo, chi = world_bbox(cat)
size_cat = (chi - clo).length
size_new = (hi - lo).length
for o in new:
    if o.parent is None:
        o.scale *= size_cat / size_new
        o.location.x += (chi.x - clo.x) * 1.3

scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.render.resolution_x, scene.render.resolution_y = 1000, 500
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "SINGLE"
cam_data = bpy.data.cameras.new("cam"); cam_data.type = "ORTHO"
cam = bpy.data.objects.new("cam", cam_data); scene.collection.objects.link(cam); scene.camera = cam
alo, ahi = world_bbox(cat + new)
center = (alo + ahi) / 2
span = max((ahi - alo).x, (ahi - alo).y, (ahi - alo).z) * 1.15
cam_data.ortho_scale = span
views = {"front_negY": ((0, -1, 0), (1.5708, 0, 0)), "top": ((0, 0, 1), (0, 0, 0)), "side_posX": ((1, 0, 0), (1.5708, 0, 1.5708))}
for name, (d, rot) in views.items():
    cam.location = center + Vector(d) * span * 2
    cam.rotation_euler = rot
    scene.render.filepath = os.path.join(out_dir, f"{name}.png")
    bpy.ops.render.render(write_still=True)
print("DONE")
