"""
Generates a placeholder bearing-ring STL (ASCII) so the native CAD viewer in
the dashboard has real geometry to render. Replace smartbearing.stl with your
actual Onshape export (File -> Export -> STL / GLB) — the viewer loads it
automatically, no code changes needed.

Usage:  python generate-placeholder.py
"""
import math

R = 1.0   # major radius (ring centre line)
r = 0.42  # tube radius (ring thickness)
N = 40    # grid resolution

triangles = []

def emit_quad(p1, p2, p3, p4):
    # two triangles per quad, outward winding
    triangles.append((p1, p2, p3))
    triangles.append((p1, p3, p4))

for i in range(N):
    u0 = 2 * math.pi * i / N
    u1 = 2 * math.pi * (i + 1) / N
    for j in range(N):
        v0 = 2 * math.pi * j / N
        v1 = 2 * math.pi * (j + 1) / N

        def pt(u, v):
            x = (R + r * math.cos(v)) * math.cos(u)
            y = (R + r * math.cos(v)) * math.sin(u)
            z = r * math.sin(v)
            return (x, y, z)

        p00 = pt(u0, v0)
        p10 = pt(u1, v0)
        p11 = pt(u1, v1)
        p01 = pt(u0, v1)
        emit_quad(p00, p10, p11, p01)

def tri_normal(a, b, c):
    ux, uy, uz = b[0]-a[0], b[1]-a[1], b[2]-a[2]
    vx, vy, vz = c[0]-a[0], c[1]-a[1], c[2]-a[2]
    nx, ny, nz = uy*vz-uz*vy, uz*vx-ux*vz, ux*vy-uy*vx
    ln = math.sqrt(nx*nx + ny*ny + nz*nz) or 1.0
    return nx/ln, ny/ln, nz/ln

with open("smartbearing.stl", "w") as f:
    f.write("solid smartbearing_placeholder\n")
    for a, b, c in triangles:
        nx, ny, nz = tri_normal(a, b, c)
        f.write(f"  facet normal {nx:.6f} {ny:.6f} {nz:.6f}\n")
        f.write("    outer loop\n")
        for p in (a, b, c):
            f.write(f"      vertex {p[0]:.6f} {p[1]:.6f} {p[2]:.6f}\n")
        f.write("    endloop\n")
        f.write("  endfacet\n")
    f.write("endsolid smartbearing_placeholder\n")

print("Wrote smartbearing.stl — bearing-ring placeholder")
