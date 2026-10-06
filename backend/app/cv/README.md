# Kumbh Milaap Computer Vision Module (`app.cv`)

This module provides a decoupled, modular computer vision pipeline designed for crowd-scale triage and missing person search during **Nashik Simhastha Kumbh Mela 2027**.

---

## 1. Architectural Components

```
backend/app/cv/
├── __init__.py             # Module exports
├── config.py               # Configurable thresholds, paths, devices (KUMBH_CV_*)
├── schemas.py              # Pydantic v2 schemas with biometric isolation
├── quality_assessor.py     # OpenCV blur (Laplacian variance), exposure & resolution
├── metadata_extractor.py   # HSV upper/lower clothing color classifier (Saffron, White, etc.)
├── detector.py             # YOLOv8-Small person localization (ONNX Runtime)
├── face_detector.py        # SCRFD-10G crowd face detection & 5-point landmarks (ONNX Runtime)
├── face_embedder.py        # ArcFace 512-d normalized embeddings & cosine similarity (ONNX Runtime)
├── service.py              # Unified pipeline coordinator & safety guardrails
└── README.md               # Documentation and licensing guide
```

---

## 2. Models, Formats & Placement

The service uses **ONNX Runtime** (`CPUExecutionProvider` by default, with optional `CUDAExecutionProvider` or `DmlExecutionProvider` for DirectML/NVIDIA GPUs).

Place your exported `.onnx` model checkpoints into:
```
backend/runtime/models/
├── yolov8s.onnx               # YOLOv8-Small person detector (640x640)
├── scrfd_10g_bnkps.onnx       # SCRFD-10G face & 5-point landmark detector (640x640)
└── arcface_w600k_r50.onnx     # ArcFace ResNet50 / MobileFaceNet 512-d embedder (112x112)
```

You can customize paths and inference thresholds via environment variables:
```bash
# Model Paths
export KUMBH_CV_MODELS_DIR="runtime/models"
export KUMBH_CV_YOLO_MODEL_PATH="runtime/models/yolov8s.onnx"
export KUMBH_CV_SCRFD_MODEL_PATH="runtime/models/scrfd_10g_bnkps.onnx"
export KUMBH_CV_ARCFACE_MODEL_PATH="runtime/models/arcface_w600k_r50.onnx"

# Device Execution: "cpu", "cuda", or "dml"
export KUMBH_CV_DEVICE="cpu"

# Thresholds
export KUMBH_CV_YOLO_CONF=0.35
export KUMBH_CV_SCRFD_CONF=0.50
export KUMBH_CV_BLUR_THRESHOLD=50.0
export KUMBH_CV_MATCH_CANDIDATE_THRESHOLD=0.65
```

---

## 3. Important Licensing Notices & Model Verification

> [!WARNING]
> **Never download unverified model weights automatically.** Pretrained weights have legal and licensing obligations that must be verified before production use.

1. **YOLOv8 (Ultralytics)**:
   - Licensed under **AGPL-3.0** or commercial license from Ultralytics.
   - If deploying in proprietary enterprise environments, ensure you hold an appropriate commercial license or use permissively licensed equivalents (such as YOLOv6/YOLOX Apache 2.0).

2. **SCRFD & ArcFace (InsightFace)**:
   - Commonly distributed pretrained checkpoints from the InsightFace repository are for **non-commercial academic research only**.
   - For real-world operational deployment in public security or governmental kiosks, train or acquire checkpoints on **permissively licensed datasets** (e.g., models trained on Glint360k-Apache2, or UniFace Apache-2.0 models).

---

## 4. Responsible AI & Biometric Data Isolation

Under India's **Digital Personal Data Protection (DPDP) Act** and responsible AI principles:

1. **Strict Isolation**: Raw 512-dimensional biometric embeddings (`BiometricEmbedding`) are isolated from standard public case summaries and map endpoints.
2. **Advisory Triage Only**: Candidate matches are flagged with `requires_human_verification = True`.
3. **No Automated Case Action**: The system **strictly forbids** automatic missing-person identification or automatic case closure. Any candidate match must be verified by an authorized officer side-by-side with intake reference material.
4. **Quality Gating**: Blurry (Laplacian $< 50.0$) or tiny faces ($< 20\text{px}$) are blocked from biometric embedding to avoid polluting vector indexes with false positives.

---

## 5. API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/cv/status` | Diagnostic health, device, and licensing notices for all 3 models |
| `POST` | `/cv/assess-quality` | Checks image blur (Laplacian), exposure, and resolution |
| `POST` | `/cv/extract-clothing` | Analyzes upper & lower garment colors using HSV classification |
| `POST` | `/cv/analyze-frame` | Complete frame analysis (persons + clothing + faces + quality) |
| `POST` | `/cv/register-photo` | Ingests intake photo, verifies quality, extracts isolated embedding |

---

## 6. Running Unit Tests

Run the test suite using `pytest`:
```bash
python -m pytest tests/test_cv.py -v
```
The test suite utilizes synthetic test images (two-tone color swatches, synthetic high-frequency patterns, and vector math verifications) to run completely offline without external network dependencies.
