"""Fine-tuning de VideoMAE (base, Kinetics-400) pour violence / pas de violence.

À exécuter dans le notebook Kaggle (GPU + Internet activés). Ce script n'utilise QUE les
ensembles train et val : le test reste intact (voir evaluate_test.py, à lancer une seule fois).
Copier clips.py dans le notebook (ou coller son contenu avant ce script).
"""
import csv
import glob
import os
import cv2
import numpy as np
import torch
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
from torch.utils.data import DataLoader, Dataset
from transformers import VideoMAEForVideoClassification

from clips import sample_indices

MODEL = "MCG-NJU/videomae-base-finetuned-kinetics"
EPOCHS, BATCH, ACCUM, LR, SEED = 3, 4, 4, 5e-5, 2026
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)
INPUT_ROOT = "/kaggle/input/"
SPLIT = glob.glob("/kaggle/input/**/split.csv", recursive=True)[0]


def read_clip(path, train):
    cap = cv2.VideoCapture(path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frames = []
    for i in sample_indices(total, 16, train):
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(i))
        ok, f = cap.read()
        if not ok:  # image illisible : on répète la précédente
            f = frames[-1] if frames else np.zeros((224, 224, 3), np.uint8)
        else:
            f = cv2.cvtColor(cv2.resize(f, (224, 224)), cv2.COLOR_BGR2RGB)
        frames.append(f)
    cap.release()
    x = (np.stack(frames).astype(np.float32) / 255.0 - MEAN) / STD
    return torch.from_numpy(x).permute(0, 3, 1, 2)  # (16, 3, 224, 224)


class Clips(Dataset):
    def __init__(self, split, train):
        rows = list(csv.DictReader(open(SPLIT, encoding="utf-8")))
        self.rows = [r for r in rows if r["split"] == split]
        self.train = train

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, i):
        r = self.rows[i]
        x = read_clip(INPUT_ROOT + r["path"], self.train)
        if self.train and np.random.rand() < 0.5:  # miroir horizontal
            x = torch.flip(x, dims=[-1])
        return x, int(r["label"])


@torch.no_grad()
def evaluate(model, loader, device):
    model.eval()
    y_true, y_pred = [], []
    for x, y in loader:
        with torch.autocast("cuda", dtype=torch.float16):
            logits = model(pixel_values=x.to(device)).logits
        y_pred += logits.argmax(1).cpu().tolist()
        y_true += y.tolist()
    p, r, f1, _ = precision_recall_fscore_support(y_true, y_pred, average="binary", zero_division=0)
    return {"acc": accuracy_score(y_true, y_pred), "precision": p, "recall": r, "f1": f1}


def main():
    torch.manual_seed(SEED)
    np.random.seed(SEED)
    device = "cuda"
    model = VideoMAEForVideoClassification.from_pretrained(
        MODEL, num_labels=2, id2label={0: "normal", 1: "violence"},
        label2id={"normal": 0, "violence": 1}, ignore_mismatched_sizes=True,
    ).to(device)
    train = DataLoader(Clips("train", True), batch_size=BATCH, shuffle=True, num_workers=2, drop_last=True)
    val = DataLoader(Clips("val", False), batch_size=BATCH, num_workers=2)
    opt = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=0.05)
    scaler = torch.cuda.amp.GradScaler()
    best = -1.0
    for epoch in range(EPOCHS):
        model.train()
        for step, (x, y) in enumerate(train):
            with torch.autocast("cuda", dtype=torch.float16):
                loss = model(pixel_values=x.to(device), labels=y.to(device)).loss / ACCUM
            scaler.scale(loss).backward()
            if (step + 1) % ACCUM == 0:
                scaler.step(opt); scaler.update(); opt.zero_grad()
            if step % 50 == 0:
                print(f"epoch {epoch} step {step}/{len(train)} loss {loss.item() * ACCUM:.4f}", flush=True)
        m = evaluate(model, val, device)
        print(f"epoch {epoch} VAL:", {k: round(v, 4) for k, v in m.items()}, flush=True)
        if m["f1"] > best:  # on garde le meilleur modèle sur la validation
            best = m["f1"]
            torch.save(model.state_dict(), "/kaggle/working/videomae_best.pt")
            size = os.path.getsize("/kaggle/working/videomae_best.pt") / 1e6
            print(f"modèle enregistré (epoch {epoch}, {size:.0f} Mo)", flush=True)
    print("meilleur F1 validation:", round(best, 4))


if __name__ == "__main__":
    main()
