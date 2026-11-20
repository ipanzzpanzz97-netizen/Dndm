#!/usr/bin/env python3
"""
Pembina Pek Aset PBR 4K & Audio Ruang HD (>100MB) untuk Rumah 3D Walkthrough.
Menjana peta Albedo, Normal, Roughness, dan AO (2048px - 4096px) serta fail audio WAV 48kHz stereo
ke dalam app/src/main/assets/hd_pack/.
"""

import json
import math
import os
import struct
import time
import wave
from pathlib import Path

import numpy as np
from PIL import Image

ROOT_DIR = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT_DIR / "app" / "src" / "main" / "assets" / "hd_pack"


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def value_noise_2d(h: int, w: int, grid_size: int, seed: int) -> np.ndarray:
    """Menjana hingar licin 2D boleh-ulang (tileable) menggunakan interpolasi dwilinear."""
    rng = np.random.default_rng(seed)
    grid = rng.random((grid_size, grid_size), dtype=np.float32)

    y = np.linspace(0, grid_size, h, endpoint=False, dtype=np.float32)
    x = np.linspace(0, grid_size, w, endpoint=False, dtype=np.float32)

    y0 = np.floor(y).astype(np.int32) % grid_size
    x0 = np.floor(x).astype(np.int32) % grid_size
    y1 = (y0 + 1) % grid_size
    x1 = (x0 + 1) % grid_size

    wy = (y - np.floor(y))[:, None]
    wx = (x - np.floor(x))[None, :]
    # Smoothstep
    wy = wy * wy * (3.0 - 2.0 * wy)
    wx = wx * wx * (3.0 - 2.0 * wx)

    c00 = grid[np.ix_(y0, x0)]
    c10 = grid[np.ix_(y0, x1)]
    c01 = grid[np.ix_(y1, x0)]
    c11 = grid[np.ix_(y1, x1)]

    top = c00 * (1.0 - wx) + c10 * wx
    bot = c01 * (1.0 - wx) + c11 * wx
    return top * (1.0 - wy) + bot * wy


def fbm_2d(h: int, w: int, base_grid: int = 8, octaves: int = 4, seed: int = 42) -> np.ndarray:
    """Fraktal Brownian Motion 2D untuk urat marmar, kayu, simen, dan tenunan."""
    acc = np.zeros((h, w), dtype=np.float32)
    amp = 0.5
    norm = 0.0
    freq = base_grid
    for i in range(octaves):
        acc += amp * value_noise_2d(h, w, min(freq, h // 2), seed + i * 31)
        norm += amp
        amp *= 0.5
        freq *= 2
    return acc / max(norm, 1e-6)


def micro_grain(h: int, w: int, seed: int, scale: float = 1.0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    return (rng.standard_normal((h, w)).astype(np.float32) * 0.5 + 0.5) * scale


def height_to_normal(height: np.ndarray, strength: float = 3.2) -> np.ndarray:
    """Tukar peta ketinggian [0..1] kepada Tangent-Space Normal Map RGB uint8."""
    dx = np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)
    dy = np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)
    nx = -dx * strength
    ny = -dy * strength
    nz = np.ones_like(height, dtype=np.float32)
    length = np.sqrt(nx * nx + ny * ny + nz * nz) + 1e-6
    nx /= length
    ny /= length
    nz /= length
    rgb = np.stack([
        np.clip((nx * 0.5 + 0.5) * 255.0, 0, 255),
        np.clip((ny * 0.5 + 0.5) * 255.0, 0, 255),
        np.clip((nz * 0.5 + 0.5) * 255.0, 0, 255),
    ], axis=-1).astype(np.uint8)
    return rgb


def save_png(arr: np.ndarray, path: Path, compress_level: int = 3) -> int:
    img = Image.fromarray(arr)
    img.save(path, format="PNG", compress_level=compress_level)
    return path.stat().st_size


def save_pbr_set(
    name: str,
    albedo: np.ndarray,
    height: np.ndarray,
    roughness: np.ndarray,
    ao: np.ndarray,
    normal_strength: float = 3.0,
    compress_level: int = 3,
) -> dict:
    normal = height_to_normal(height, strength=normal_strength)
    rough_u8 = np.clip(roughness * 255.0, 0, 255).astype(np.uint8)
    ao_u8 = np.clip(ao * 255.0, 0, 255).astype(np.uint8)
    albedo_u8 = np.clip(albedo, 0, 255).astype(np.uint8)

    files = {}
    for suffix, data in [
        ("albedo", albedo_u8),
        ("normal", normal),
        ("roughness", rough_u8),
        ("ao", ao_u8),
    ]:
        fname = f"{name}_{suffix}.png"
        fpath = OUT_DIR / fname
        size = save_png(data, fpath, compress_level=compress_level)
        files[suffix] = {"file": fname, "bytes": size}
    return files


def bake_white_tile(size: int = 4096) -> dict:
    """Jubin putih berkilat bergarisan simen lekuk (Dapur & Ruang Tamu)."""
    fbm = fbm_2d(size, size, base_grid=12, octaves=4, seed=101)
    grain = micro_grain(size, size, seed=102, scale=0.04)
    yy, xx = np.mgrid[0:size, 0:size]
    step = size // 2
    grout_w = max(8, size // 256)
    gx = (xx % step < grout_w) | (xx % step > step - grout_w)
    gy = (yy % step < grout_w) | (yy % step > step - grout_w)
    grout = gx | gy

    base = 200.0 + (fbm - 0.5) * 14.0 + (grain - 0.02) * 140.0
    albedo = np.stack([base, base + 4.0, base - 2.0], axis=-1)
    grout_col = np.array([112.0, 117.0, 111.0], dtype=np.float32) + grain[..., None] * 500.0
    albedo[grout] = grout_col[grout]

    height = np.where(grout, 0.15 + grain * 2.0, 0.92 + fbm * 0.05 + grain * 0.4)
    roughness = np.where(grout, 0.90, 0.28 + fbm * 0.10 + grain * 0.5)
    ao = np.where(grout, 0.45, 0.96 - (1.0 - fbm) * 0.05)

    return save_pbr_set("white_tile", albedo, height, roughness, ao, normal_strength=4.5, compress_level=2)


def bake_orange_terracotta(size: int = 4096) -> dict:
    """Lantai geometri oren-terracotta timbul (Ruang Tengah)."""
    fbm = fbm_2d(size, size, base_grid=10, octaves=4, seed=201)
    grain = micro_grain(size, size, seed=202, scale=0.06)
    yy, xx = np.mgrid[0:size, 0:size]
    cell = size // 2
    lx = (xx % cell) / float(cell) - 0.5
    ly = (yy % cell) / float(cell) - 0.5
    rad = np.sqrt(lx * lx + ly * ly)
    ang = np.arctan2(ly, lx)
    oct_r = 0.30 / (np.cos((ang % (math.pi / 4.0)) - math.pi / 8.0) + 1e-6)
    in_star = rad < oct_r
    border = (np.abs(lx) > 0.46) | (np.abs(ly) > 0.46)
    ring = np.abs(rad - oct_r) < 0.022

    r = np.full((size, size), 194.0, dtype=np.float32)
    g = np.full((size, size), 116.0, dtype=np.float32)
    b = np.full((size, size), 86.0, dtype=np.float32)

    r[in_star], g[in_star], b[in_star] = 212.0, 141.0, 111.0
    r[ring | border], g[ring | border], b[ring | border] = 141.0, 67.0, 43.0

    noise_shift = (fbm - 0.5) * 26.0 + (grain - 0.03) * 220.0
    albedo = np.stack([r + noise_shift, g + noise_shift * 0.8, b + noise_shift * 0.7], axis=-1)
    height = np.where(border | ring, 0.28, np.where(in_star, 0.88, 0.72)) + fbm * 0.08 + grain * 0.5
    roughness = np.where(border | ring, 0.78, 0.32 + fbm * 0.14)
    ao = np.where(border | ring, 0.52, 0.94)

    return save_pbr_set("orange_terracotta", albedo, height, roughness, ao, normal_strength=4.0, compress_level=2)


def bake_subway_tile(size: int = 2048) -> dict:
    """Backsplash jubin bata putih timbul dapur."""
    fbm = fbm_2d(size, size, base_grid=12, octaves=3, seed=301)
    grain = micro_grain(size, size, seed=302, scale=0.05)
    yy, xx = np.mgrid[0:size, 0:size]
    rh = size // 8
    cw = size // 4
    row = yy // rh
    x_shift = (xx + (row % 2) * (cw // 2)) % cw
    y_in = yy % rh
    gw = max(6, size // 220)
    grout = (x_shift < gw) | (x_shift > cw - gw) | (y_in < gw) | (y_in > rh - gw)

    # Bevel cushion on brick edges
    dx_edge = np.minimum(x_shift, cw - x_shift) / float(cw * 0.12)
    dy_edge = np.minimum(y_in, rh - y_in) / float(rh * 0.18)
    bevel = np.clip(np.minimum(dx_edge, dy_edge), 0.0, 1.0)

    base = 198.0 + (fbm - 0.5) * 14.0 + (grain - 0.025) * 130.0 + bevel * 10.0
    albedo = np.stack([base, base + 4.0, base - 2.0], axis=-1)
    albedo[grout] = np.array([112.0, 117.0, 111.0], dtype=np.float32)

    height = np.where(grout, 0.12, 0.45 + bevel * 0.5 + grain * 0.3)
    roughness = np.where(grout, 0.90, 0.28 + fbm * 0.10)
    ao = np.where(grout, 0.42, 0.78 + bevel * 0.22)

    return save_pbr_set("subway_tile", albedo, height, roughness, ao, normal_strength=4.5, compress_level=2)


def bake_marble_vein(size: int = 4096) -> dict:
    """Marmar putih-kelabu berkilat dengan urat berlapis (Dinding TV & Meja Lipat)."""
    fbm1 = fbm_2d(size, size, base_grid=6, octaves=5, seed=401)
    fbm2 = fbm_2d(size, size, base_grid=12, octaves=4, seed=402)
    grain = micro_grain(size, size, seed=403, scale=0.03)
    yy, xx = np.mgrid[0:size, 0:size]
    u = xx / float(size)
    v = yy / float(size)

    vein_wave = np.abs(np.sin((u * 3.5 + v * 2.2 + fbm1 * 4.2) * math.pi))
    vein_fine = np.abs(np.sin((u * 8.0 - v * 5.0 + fbm2 * 5.5) * math.pi))
    vein_mask = np.clip(1.0 - np.power(vein_wave, 0.22), 0.0, 1.0) * 0.75 + \
                np.clip(1.0 - np.power(vein_fine, 0.15), 0.0, 1.0) * 0.35

    base_r = 216.0 - vein_mask * 90.0 + (grain - 0.015) * 120.0
    base_g = 218.0 - vein_mask * 84.0 + (grain - 0.015) * 120.0
    base_b = 214.0 - vein_mask * 78.0 + (grain - 0.015) * 120.0
    albedo = np.stack([base_r, base_g, base_b], axis=-1)

    height = 0.85 - vein_mask * 0.15 + grain * 0.25
    roughness = 0.22 + vein_mask * 0.16 + fbm2 * 0.06
    ao = 0.98 - vein_mask * 0.18

    return save_pbr_set("marble_vein", albedo, height, roughness, ao, normal_strength=1.8, compress_level=2)


def bake_leaf_wallpaper(size: int = 2048) -> dict:
    """Wallpaper corak daun pelepah bertekstur tenun (Ruang Tamu)."""
    fbm = fbm_2d(size, size, base_grid=16, octaves=4, seed=501)
    grain = micro_grain(size, size, seed=502, scale=0.05)
    yy, xx = np.mgrid[0:size, 0:size]
    # Woven fabric cross-hatch
    weave = (np.sin(xx * (math.pi / 4.0)) * 0.5 + 0.5) * 0.5 + (np.sin(yy * (math.pi / 4.0)) * 0.5 + 0.5) * 0.5

    # Palm frond procedural pattern tiled 4x4
    cell = size // 4
    lx = ((xx % cell) / float(cell)) - 0.5
    ly = ((yy % cell) / float(cell)) - 0.5
    row_id = (yy // cell) % 2
    col_id = (xx // cell) % 2
    rot = np.where((row_id ^ col_id) == 0, 0.52, -0.48)
    rx = lx * np.cos(rot) - ly * np.sin(rot)
    ry = lx * np.sin(rot) + ly * np.cos(rot)

    stem = (np.abs(rx) < 0.014) & (np.abs(ry) < 0.36)
    fronds = (np.abs(np.sin((ry - np.abs(rx) * 1.1) * 44.0)) < 0.22) & (np.abs(rx) < 0.26 * (1.0 - np.abs(ry) * 1.8)) & (np.abs(ry) < 0.34)
    leaf = stem | fronds

    base_r = 229.0 + (weave - 0.5) * 10.0 + (fbm - 0.5) * 12.0 + grain * 120.0
    base_g = 231.0 + (weave - 0.5) * 10.0 + (fbm - 0.5) * 12.0 + grain * 120.0
    base_b = 220.0 + (weave - 0.5) * 10.0 + (fbm - 0.5) * 12.0 + grain * 120.0

    base_r[leaf] = 92.0 + weave[leaf] * 18.0
    base_g[leaf] = 104.0 + weave[leaf] * 18.0
    base_b[leaf] = 88.0 + weave[leaf] * 16.0

    albedo = np.stack([base_r, base_g, base_b], axis=-1)
    height = 0.55 + weave * 0.22 + np.where(leaf, 0.14, 0.0) + grain * 0.4
    roughness = np.where(leaf, 0.58, 0.72) + weave * 0.08
    ao = 0.90 - np.where(leaf, 0.08, 0.0) - (1.0 - weave) * 0.08

    return save_pbr_set("leaf_wallpaper", albedo, height, roughness, ao, normal_strength=2.2, compress_level=2)


def bake_wood(name: str, base_rgb: tuple[int, int, int], dark_rgb: tuple[int, int, int], size: int = 2048, seed: int = 600, plank_grooves: bool = False) -> dict:
    """Urat kayu berlapis (Kayu Gelap, Kayu Sederhana, Vinyl Kayu Kelabu Koridor)."""
    fbm_long = fbm_2d(size, size, base_grid=6, octaves=4, seed=seed)
    fbm_fine = fbm_2d(size, size, base_grid=32, octaves=3, seed=seed + 1)
    grain = micro_grain(size, size, seed=seed + 2, scale=0.05)

    yy, xx = np.mgrid[0:size, 0:size]
    rings = np.sin((yy / float(size) * 24.0 + fbm_long * 7.5 + fbm_fine * 1.4) * math.pi) * 0.5 + 0.5

    if plank_grooves:
        plank_h = size // 6
        groove = (yy % plank_h < 6) | ((xx + (yy // plank_h) * (size // 3)) % (size // 2) < 5)
    else:
        groove = np.zeros((size, size), dtype=bool)

    mix = np.clip(rings * 0.7 + fbm_fine * 0.3, 0.0, 1.0)
    r = base_rgb[0] * mix + dark_rgb[0] * (1.0 - mix) + (grain - 0.025) * 180.0
    g = base_rgb[1] * mix + dark_rgb[1] * (1.0 - mix) + (grain - 0.025) * 170.0
    b = base_rgb[2] * mix + dark_rgb[2] * (1.0 - mix) + (grain - 0.025) * 160.0

    r[groove] *= 0.45
    g[groove] *= 0.45
    b[groove] *= 0.45

    albedo = np.stack([r, g, b], axis=-1)
    height = np.where(groove, 0.15, 0.65 + mix * 0.25 + grain * 0.4)
    roughness = np.where(groove, 0.85, 0.36 + (1.0 - mix) * 0.18)
    ao = np.where(groove, 0.40, 0.86 + mix * 0.12)

    return save_pbr_set(name, albedo, height, roughness, ao, normal_strength=3.0, compress_level=2)


def bake_plaster(name: str, rgb: tuple[int, int, int], rough_base: float, size: int = 2048, seed: int = 700, aged: bool = False) -> dict:
    """Cat plaster halus (Kuning-Limau, Krim, atau Simen Kasar)."""
    fbm = fbm_2d(size, size, base_grid=10, octaves=5, seed=seed)
    fbm2 = fbm_2d(size, size, base_grid=32, octaves=3, seed=seed + 3)
    grain = micro_grain(size, size, seed=seed + 5, scale=0.07 if aged else 0.04)

    delta = (fbm - 0.5) * (42.0 if aged else 18.0) + (fbm2 - 0.5) * 16.0 + (grain - 0.03) * 190.0
    albedo = np.stack([
        rgb[0] + delta,
        rgb[1] + delta * 0.96,
        rgb[2] + delta * 0.92,
    ], axis=-1)

    height = 0.5 + fbm * 0.25 + fbm2 * 0.15 + grain * (0.9 if aged else 0.4)
    roughness = np.clip(rough_base + (fbm - 0.5) * 0.18 + grain * 0.3, 0.1, 0.98)
    ao = np.clip(0.92 - (1.0 - fbm) * (0.25 if aged else 0.08), 0.4, 1.0)

    return save_pbr_set(name, albedo, height, roughness, ao, normal_strength=3.4 if aged else 1.6, compress_level=2)


def bake_woven_fabric(size: int = 2048) -> dict:
    """Tenunan fabrik kusyen sofa & kerusi."""
    fbm = fbm_2d(size, size, base_grid=14, octaves=3, seed=801)
    grain = micro_grain(size, size, seed=802, scale=0.05)
    yy, xx = np.mgrid[0:size, 0:size]
    thread_x = np.sin(xx * (math.pi / 3.0)) * 0.5 + 0.5
    thread_y = np.sin(yy * (math.pi / 3.0)) * 0.5 + 0.5
    weave = (thread_x * 0.55 + thread_y * 0.45)

    albedo = np.stack([
        172.0 + weave * 28.0 + (fbm - 0.5) * 20.0 + grain * 150.0,
        142.0 + weave * 24.0 + (fbm - 0.5) * 18.0 + grain * 130.0,
        104.0 + weave * 20.0 + (fbm - 0.5) * 14.0 + grain * 110.0,
    ], axis=-1)
    height = 0.4 + weave * 0.45 + grain * 0.3
    roughness = 0.78 + (1.0 - weave) * 0.14
    ao = 0.75 + weave * 0.22

    return save_pbr_set("woven_fabric", albedo, height, roughness, ao, normal_strength=2.8, compress_level=2)


def write_wav_stereo(path: Path, samples: np.ndarray, sample_rate: int = 48000) -> int:
    """Tulis audio 48kHz 16-bit PCM Stereo WAV."""
    clipped = np.clip(samples, -1.0, 1.0)
    pcm = (clipped * 32767.0).astype(np.int16)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm.tobytes())
    return path.stat().st_size


def bake_audio_pack() -> dict:
    sr = 48000
    audio_info = {}

    def make_footstep(fname: str, freq_body: float, decay_ms: float, click_gain: float, seed: int):
        rng = np.random.default_rng(seed)
        dur = 0.28
        n = int(sr * dur)
        t = np.arange(n, dtype=np.float32) / sr
        env_thud = np.exp(-t / (decay_ms / 1000.0))
        thud = np.sin(2.0 * math.pi * freq_body * t * np.exp(-t * 8.0)) * env_thud * 0.65
        noise = rng.standard_normal(n).astype(np.float32)
        click = noise * np.exp(-t / 0.018) * click_gain
        mono = thud + click
        stereo = np.stack([mono, mono * 0.96], axis=-1)
        sz = write_wav_stereo(OUT_DIR / fname, stereo, sr)
        audio_info[fname] = sz

    make_footstep("footstep_tile.wav", 185.0, 32.0, 0.35, 901)
    make_footstep("footstep_terracotta.wav", 155.0, 38.0, 0.28, 902)
    make_footstep("footstep_wood.wav", 110.0, 58.0, 0.18, 903)
    make_footstep("footstep_cement.wav", 140.0, 44.0, 0.32, 904)

    # Seamless 45-second 48kHz stereo room tone + gentle indoor air/fan warmth
    dur_amb = 45.0
    n_amb = int(sr * dur_amb)
    t_amb = np.arange(n_amb, dtype=np.float32) / sr
    rng = np.random.default_rng(910)
    white = rng.standard_normal((n_amb, 2)).astype(np.float32)
    # Simple low-pass running average for soft room air tone
    kernel = np.ones(24, dtype=np.float32) / 24.0
    left = np.convolve(white[:, 0], kernel, mode="same") * 0.045
    right = np.convolve(white[:, 1], kernel, mode="same") * 0.045
    hum = np.sin(2.0 * math.pi * 50.0 * t_amb) * 0.008 + np.sin(2.0 * math.pi * 100.0 * t_amb) * 0.004
    amb = np.stack([left + hum, right + hum], axis=-1)
    audio_info["ambient_room.wav"] = write_wav_stereo(OUT_DIR / "ambient_room.wav", amb, sr)

    # Crisp UI click WAV
    n_ui = int(sr * 0.08)
    t_ui = np.arange(n_ui, dtype=np.float32) / sr
    ui_sig = np.sin(2.0 * math.pi * 880.0 * t_ui) * np.exp(-t_ui / 0.015) * 0.35
    audio_info["ui_click.wav"] = write_wav_stereo(OUT_DIR / "ui_click.wav", np.stack([ui_sig, ui_sig], axis=-1), sr)

    return audio_info


def main() -> None:
    t0 = time.time()
    ensure_dir(OUT_DIR)
    print(f"[BakeHD] Menjana pek aset PBR 4K & Audio HD ke: {OUT_DIR}")

    materials = {}
    materials["white_tile"] = bake_white_tile(4096)
    materials["orange_terracotta"] = bake_orange_terracotta(4096)
    materials["subway_tile"] = bake_subway_tile(2048)
    materials["marble_vein"] = bake_marble_vein(4096)
    materials["leaf_wallpaper"] = bake_leaf_wallpaper(2048)
    materials["fluted_wood"] = bake_wood("fluted_wood", (110, 102, 92), (56, 52, 46), size=2048, seed=601)
    materials["dark_wood"] = bake_wood("dark_wood", (105, 62, 34), (58, 32, 16), size=2048, seed=602)
    materials["grey_vinyl_wood"] = bake_wood("grey_vinyl_wood", (82, 86, 90), (36, 39, 42), size=2048, seed=603, plank_grooves=True)
    materials["lime_plaster"] = bake_plaster("lime_plaster", (181, 198, 66), 0.78, size=2048, seed=701)
    materials["cream_plaster"] = bake_plaster("cream_plaster", (210, 208, 200), 0.84, size=2048, seed=702)
    materials["rough_cement"] = bake_plaster("rough_cement", (138, 131, 117), 0.92, size=2048, seed=703, aged=True)
    materials["woven_fabric"] = bake_woven_fabric(2048)

    audio = bake_audio_pack()

    total_bytes = sum(f.stat().st_size for f in OUT_DIR.glob("*") if f.is_file() and f.name != "manifest.json")
    total_mb = total_bytes / (1024.0 * 1024.0)

    # Ensure >= 110MB target if aggressive PNG compression reduced size unexpectedly
    if total_mb < 110.0:
        print(f"[BakeHD] Saiz semasa {total_mb:.2f} MB < 110 MB, menambah resolusi 4K tambahan...")
        materials["rough_cement"] = bake_plaster("rough_cement", (138, 131, 117), 0.92, size=4096, seed=703, aged=True)
        materials["grey_vinyl_wood"] = bake_wood("grey_vinyl_wood", (82, 86, 90), (36, 39, 42), size=4096, seed=603, plank_grooves=True)
        total_bytes = sum(f.stat().st_size for f in OUT_DIR.glob("*") if f.is_file() and f.name != "manifest.json")
        total_mb = total_bytes / (1024.0 * 1024.0)

    manifest = {
        "version": 1,
        "totalBytes": total_bytes,
        "totalMB": round(total_mb, 2),
        "materials": materials,
        "audio": audio,
    }
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    elapsed = time.time() - t0
    print(f"[BakeHD] Siap dalam {elapsed:.1f}s! Jumlah saiz pek aset HD: {total_mb:.2f} MB ({total_bytes:,} bait)")


if __name__ == "__main__":
    main()
