"""Affiche (ou mesure) la pose sur une webcam ou un fichier vidéo, avec les règles de chute en option.

Exemples (depuis le dossier ai/) :
  python -m vigilis_ai.view --source 0                    # webcam, touche q pour quitter
  python -m vigilis_ai.view --source 0 --fall --confirm-s 5   # avec détection de chute (alerte après 5 s d'immobilité)
  python -m vigilis_ai.view --source 0 --fall --send          # et envoi des chutes au backend (ai/.env requis)
  python -m vigilis_ai.view --source 0 --fall --violence --send   # chute + violence, envoi des deux
  python -m vigilis_ai.view --source video.mp4 --no-window --max-frames 60   # mesure sans fenêtre
Rien n'est enregistré ni envoyé : les images restent en mémoire.
"""
import argparse
import logging
import time

import cv2

from vigilis_ai.client import Sender, build_fall_body, build_violence_body
from vigilis_ai.clock import FrameClock
from vigilis_ai.config import ConfigError, load_config
from vigilis_ai.location import apply_auto_location
from vigilis_ai.fall import FallDetector, FallParams, extract_sample, tuned_params
from vigilis_ai.pose import PoseEstimator, draw
from vigilis_ai.violence import ViolenceMonitor, ViolenceParams, make_predictor


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default="0", help="numéro de webcam (0) ou chemin d'un fichier vidéo")
    ap.add_argument("--model", default="models/yolo26n-pose.pt")
    ap.add_argument("--max-frames", type=int, default=0, help="0 = jusqu'à la fin ou à 'q'")
    ap.add_argument("--no-window", action="store_true", help="pas de fenêtre : affiche seulement les mesures")
    ap.add_argument("--fall", action="store_true", help="active les règles de chute (affiche CHUTE et l'état du corps)")
    ap.add_argument("--confirm-s", type=float, default=10.0, help="immobilité exigée avant l'alerte (secondes)")
    ap.add_argument("--tuned", action="store_true", help="réglages figés sur GMDCSA24 (fall.TUNED), non validés sur vos vidéos")
    ap.add_argument("--violence", action="store_true", help="active la détection de violence (VideoMAE, ~7 s par fenêtre sur CPU)")
    ap.add_argument("--violence-model", default="models/videomae_best.pt")
    ap.add_argument("--violence-window-s", type=float, default=5.0, help="durée de scène analysée à chaque fenêtre")
    ap.add_argument("--violence-windows", type=int, default=2, help="fenêtres consécutives au-dessus du seuil avant l'alerte")
    ap.add_argument("--send", action="store_true", help="envoie les alertes au backend (POST /incidents) ; exige --fall ou --violence et ai/.env")
    args = ap.parse_args()
    if args.send and not (args.fall or args.violence):
        raise SystemExit("--send exige --fall ou --violence : sans détection, rien à envoyer.")

    sender = cfg = None
    if args.send:
        logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
        try:
            cfg = load_config()
        except ConfigError as e:
            raise SystemExit(str(e)) from None
        cfg, note = apply_auto_location(cfg)
        if note:
            print(note)
        sender = Sender(cfg)
        print(f"Envoi activé vers {cfg.api_url} (caméra {cfg.camera_id}).")

    cap = cv2.VideoCapture(int(args.source) if args.source.isdigit() else args.source)
    if not cap.isOpened():
        raise SystemExit(f"Impossible d'ouvrir la source : {args.source}")
    est = PoseEstimator(args.model)
    make = tuned_params if args.tuned else FallParams
    detector = FallDetector(make(confirm_s=args.confirm_s)) if args.fall else None
    monitor = None
    if args.violence:
        print("Chargement du modèle de violence (quelques secondes)...")
        prm = ViolenceParams(window_s=args.violence_window_s, consecutive=args.violence_windows)
        monitor = ViolenceMonitor(make_predictor(args.violence_model), prm)
    banner_until = violence_banner_until = 0.0
    clock = FrameClock(cap, is_file=not args.source.isdigit())  # fichier : temps de la vidéo ; webcam : temps réel
    if sender is not None and clock.is_file:
        print("Attention : la source est un fichier, les chutes qu'il contient seront envoyées comme de vraies alertes.")

    times, counts, n = [], [], 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        now = clock.tick()
        t0 = time.perf_counter()
        persons = est.infer(frame)
        times.append((time.perf_counter() - t0) * 1000)
        counts.append(len(persons))
        n += 1

        img = None if args.no_window else draw(frame, persons)
        if detector is not None:
            h, w = frame.shape[:2]
            for e in detector.update(persons, now, (w, h)):
                print(f"CHUTE détectée : personne {e.track_id}, score {e.score}, immobile {e.immobile_s:.0f} s")
                banner_until = now + 6
                if sender is not None:
                    sender.submit(build_fall_body(e, cfg))
            if img is not None:
                seen = bool(persons) and extract_sample(persons[0], now, (w, h), detector.prm) is not None
                cv2.putText(img, "corps visible" if seen else "corps incomplet : pas de jugement", (10, h - 12),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 200, 0) if seen else (0, 165, 255), 2)
                if now < banner_until:
                    cv2.putText(img, "CHUTE DETECTEE", (10, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 255), 3)
        if monitor is not None:
            monitor.push(frame, now)
            for ev in monitor.poll(now):
                print(f"VIOLENCE détectée : score {ev.score}, {ev.windows_confirmed} fenêtres consécutives")
                violence_banner_until = now + 6
                if sender is not None:
                    sender.submit(build_violence_body(ev, cfg))
            if img is not None:
                p = monitor.last_prob
                cv2.putText(img, "violence : analyse..." if p is None else f"violence : {p:.2f} (seuil {prm.threshold})",
                            (10, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)
                if now < violence_banner_until:
                    cv2.putText(img, "VIOLENCE DETECTEE", (10, 110), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 255), 3)
        if img is not None:
            cv2.imshow("Vigilis - pose (q pour quitter)", img)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
        if args.max_frames and n >= args.max_frames:
            break
    cap.release()
    cv2.destroyAllWindows()
    if monitor is not None:
        monitor.close()
        print(f"Violence : {monitor.windows_done} fenêtre(s) analysée(s).")
    if sender is not None:
        sender.close()
        print(f"Envois : {sender.sent} réussi(s), {sender.failed} échoué(s).")
    if times:
        steady = times[1:] or times  # la 1re image inclut le chargement du modèle
        print(f"{n} images | pose : {sum(steady) / len(steady):.0f} ms/image en moyenne "
              f"(max {max(steady):.0f}) | personnes par image : min {min(counts)}, max {max(counts)}")


if __name__ == "__main__":
    main()
