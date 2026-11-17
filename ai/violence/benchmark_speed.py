"""Vitesse d'inférence de VideoMAE sur CE PC (images aléatoires : aucune vidéo nécessaire).

Usage : python violence/benchmark_speed.py models/videomae_best.pt [--runs 10]
Mesure : temps d'un clip de 16 images (après 2 passes de chauffe), CPU, en secondes.
"""
import argparse
import statistics
import time

import torch

from infer import load_model

p = argparse.ArgumentParser()
p.add_argument("weights")
p.add_argument("--runs", type=int, default=10)
args = p.parse_args()

print(f"torch {torch.__version__}, threads CPU : {torch.get_num_threads()}")
t0 = time.perf_counter()
model = load_model(args.weights)
print(f"chargement du modèle : {time.perf_counter() - t0:.1f} s")
x = torch.randn(1, 16, 3, 224, 224)
with torch.no_grad():
    for _ in range(2):
        model(pixel_values=x)
    times = []
    for _ in range(args.runs):
        t = time.perf_counter()
        model(pixel_values=x)
        times.append(time.perf_counter() - t)
print(f"inférence 1 clip : médiane {statistics.median(times):.2f} s, min {min(times):.2f} s, max {max(times):.2f} s ({args.runs} mesures)")
