"""Bir .blend/.glb dosyasındaki görünür mesh'leri 4 ortografik açıdan render edip tek görsele birleştirir.
Kullanım: blender -b <dosya.blend> -P scripts/blender/render_views.py -- <çıktı.png>"""
import bpy, sys, math
from mathutils import Vector
out = sys.argv[sys.argv.index("--") + 1]
sc = bpy.context.scene
sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.light = "STUDIO"
sc.display.shading.color_type = "OBJECT"
sc.render.resolution_x = sc.render.resolution_y = 400
sc.render.film_transparent = False
meshes = [o for o in sc.objects if o.type == "MESH" and o.visible_get()]
pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
lo = Vector([min(p[i] for p in pts) for i in range(3)]); hi = Vector([max(p[i] for p in pts) for i in range(3)])
c = (lo + hi) / 2; span = max(hi - lo) * 1.2
cd = bpy.data.cameras.new("c"); cd.type = "ORTHO"; cd.ortho_scale = span
cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
views = [("side+X", (1, 0, 0)), ("front-Y", (0, -1, 0)), ("top", (0, 0, 1)), ("side-X", (-1, 0, 0))]
import os
files = []
for name, d in views:
    d = Vector(d); cam.location = c + d * span * 3
    cam.rotation_euler = (d * -1).to_track_quat("-Z", "Y" if name == "top" else "Z").to_euler()
    f = out.replace(".png", f"_{name}.png"); sc.render.filepath = f; bpy.ops.render.render(write_still=True); files.append(f)
print("RENDERED", files)
