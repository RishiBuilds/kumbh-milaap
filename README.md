<div align="center">

<img src="https://api.iconify.design/mdi/flag-variant.svg?color=%23FF9933" width="80" height="80" alt="Kumbh Milaap logo">

# Kumbh Milaap

### Reuniting families at the Nashik Simhastha Kumbh Mela 2027

Kiosk-based missing-person intake, geospatial search triage, and advisory computer vision.<br/>
**A human officer is in charge of every decision.**

<br/>

[![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-38BDF8?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![ONNX Runtime](https://img.shields.io/badge/ONNX_Runtime-005CED?style=flat-square&logo=onnx&logoColor=white)](https://onnxruntime.ai/)
[![Docker](https://img.shields.io/badge/Docker_Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)

<br/>

**[Quick Start](#-quick-start)** &nbsp;·&nbsp; **[How It Works](#-how-it-works)** &nbsp;·&nbsp; **[Features](#-features)** &nbsp;·&nbsp; **[Configuration](#-configuration)** &nbsp;·&nbsp; **[Privacy](#-privacy-and-responsible-ai)** &nbsp;·&nbsp; **[Roadmap](#-roadmap)**

</div>

<br/>

<p align="center">
  <img src="docs/img/hero-preview.png" width="850" alt="Kumbh Milaap - Hero Landing & Kiosk Portal">
</p>

> [!IMPORTANT]
> **Every match is a flag, never a decision.** Kumbh Milaap never auto-identifies or auto-resolves a case. All candidate matches require verification by a human officer.

---

## <img src="https://api.iconify.design/mdi/compass-outline.svg?color=%23FF9933" width="26" height="26" align="absmiddle" alt=""> At a Glance

The Nashik Simhastha Kumbh Mela 2027 is expected to draw tens of millions of pilgrims to the Godavari riverbanks. In dense crowds, with loud surroundings and patchy mobile networks, people get separated from their families every day, most often children and the elderly. Paper registers and loudspeaker announcements burn the first, most important hours.

**Kumbh Milaap replaces ad-hoc searching with a four-stage pipeline:**

|                                                                                                                                       | Stage      | What happens                                                                                                                                       |
| :-----------------------------------------------------------------------------------------------------------------------------------: | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| <img src="https://api.iconify.design/mdi/clipboard-text-outline.svg?color=%23FF9933" width="20" height="20" align="absmiddle" alt=""> | **Intake** | A guided kiosk wizard with live webcam capture issues a printable tracking pass with a Case ID and QR code.                                        |
|   <img src="https://api.iconify.design/mdi/map-search-outline.svg?color=%23FF9933" width="20" height="20" align="absmiddle" alt="">   | **Triage** | A rule-based engine ranks zones, gates, and CCTV checkpoints so search teams know where to go first.                                               |
|      <img src="https://api.iconify.design/mdi/eye-outline.svg?color=%23FF9933" width="20" height="20" align="absmiddle" alt="">       | **Vision** | Quality-gated image analysis extracts clothing colors, detects people and faces, and can compute advisory face embeddings. All of it runs locally. |
| <img src="https://api.iconify.design/mdi/account-check-outline.svg?color=%23FF9933" width="20" height="20" align="absmiddle" alt="">  | **Review** | A human officer verifies every candidate match before any action is taken.                                                                         |

| <img src="https://api.iconify.design/mdi/account-group-outline.svg?color=%23FF9933" width="20" height="20" align="absmiddle" alt=""> Families & volunteers | <img src="https://api.iconify.design/mdi/magnify.svg?color=%23FF9933" width="20" height="20" align="absmiddle" alt=""> Search teams | <img src="https://api.iconify.design/mdi/monitor-dashboard.svg?color=%23FF9933" width="20" height="20" align="absmiddle" alt=""> Control-room officers |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| File reports at kiosks                                                                                                                                     | Receive dispatch directives                                                                                                         | Review and verify cases                                                                                                                                |

---

## <img src="https://api.iconify.design/mdi/rocket-launch-outline.svg?color=%23FF9933" width="26" height="26" align="absmiddle" alt=""> Quick Start

### Choose your path

|                                                                                                                                                                           | Best for                         | Time   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------ |
| **[<img src="https://api.iconify.design/mdi/docker.svg?color=%23FF9933" width="20" height="20" align="absmiddle" alt=""> Docker Compose](#-option-1-docker-compose)**     | Trying it out, one-command setup | ~2 min |
| **[<img src="https://api.iconify.design/mdi/wrench-outline.svg?color=%23FF9933" width="20" height="20" align="absmiddle" alt=""> Manual setup](#-option-2-manual-setup)** | Development and debugging        | ~5 min |

<details>
<summary><b><img src="https://api.iconify.design/mdi/clipboard-list-outline.svg?color=%23FF9933" width="20" height="20" align="absmiddle" alt=""> Prerequisites</b></summary>

<br/>

| Tool               | Version                                                                   |
| ------------------ | ------------------------------------------------------------------------- |
| Python             | 3.11+                                                                     |
| Node.js            | Any version supported by Next.js 16                                       |
| Docker and Compose | Optional, for the one-command path                                        |
| ONNX model weights | Only for person, face, and embedding features ([details](#model-weights)) |

</details>

### <img src="https://api.iconify.design/mdi/docker.svg?color=%23FF9933" width="26" height="26" align="absmiddle" alt=""> Option 1: Docker Compose

```bash
docker compose up --build
```

Then open:

| Service                                                                                                                                           | URL                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| <img src="https://api.iconify.design/mdi/monitor.svg?color=%23FF9933" width="20" height="20" align="absmiddle" alt=""> Frontend (kiosk)           | http://localhost:3000       |
| <img src="https://api.iconify.design/mdi/api.svg?color=%23FF9933" width="20" height="20" align="absmiddle" alt=""> API docs (Swagger)             | http://localhost:8000/docs  |
| <img src="https://api.iconify.design/mdi/book-open-variant.svg?color=%23FF9933" width="20" height="20" align="absmiddle" alt=""> API docs (ReDoc) | http://localhost:8000/redoc |

### <img src="https://api.iconify.design/mdi/wrench-outline.svg?color=%23FF9933" width="26" height="26" align="absmiddle" alt=""> Option 2: Manual setup

**1. Backend**

```bash
cd backend
python -m venv venv

# Windows
.\venv\Scripts\activate
# Linux / macOS
source venv/bin/activate

pip install -r requirements.txt
python run.py
```

**2. Frontend** _(in a new terminal)_

```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
```

> [!TIP]
> Quality gating and clothing color analysis work **without any model weights**. You only need `.onnx` files for person detection, face detection, and embeddings.

### Model weights

The vision pipeline loads `.onnx` files from `KUMBH_CV_MODELS_DIR` (default `runtime/models`). Place the YOLOv8-Small, SCRFD-10G, and ArcFace weights there before enabling person detection, face detection, or embeddings.

> [!WARNING]
> Upstream checkpoints carry license restrictions. **Read [Model Licensing](#model-licensing) before downloading.**

<details>
<summary><b><img src="https://api.iconify.design/mdi/lifebuoy.svg?color=%23FF9933" width="20" height="20" align="absmiddle" alt=""> Troubleshooting</b></summary>

<br/>

| Problem                          | Fix                                                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Camera does not start            | Browsers only allow webcam access on `localhost` or HTTPS. Grant permission and verify no other app holds the camera. |
| CORS errors in the browser       | Add the frontend origin to `KUMBH_CORS_ORIGINS`.                                                                      |
| Vision endpoints fail on startup | Confirm the `.onnx` files exist in `KUMBH_CV_MODELS_DIR` with the expected filenames.                                 |
| `cuda` or `dml` device not used  | Install the matching ONNX Runtime build for your hardware, or set `KUMBH_CV_DEVICE=cpu`.                              |

</details>

---

## <img src="https://api.iconify.design/mdi/star-four-points-outline.svg?color=%23FF9933" width="26" height="26" align="absmiddle" alt=""> Features

### <img src="https://api.iconify.design/mdi/monitor.svg?color=%23FF9933" width="26" height="26" align="absmiddle" alt=""> Public kiosk and report wizard

- **Built for stress:** large touch targets and clear step progression.
- **Collects:** name, age, gender, last seen location, time elapsed, clothing description, and emergency contact.
- **Live webcam capture** with client-side compression and quality checks, plus a file upload fallback.
- **Instant printable search card** with Case ID and scannable tracking QR code.

### <img src="https://api.iconify.design/mdi/map-search-outline.svg?color=%23FF9933" width="26" height="26" align="absmiddle" alt=""> Geospatial triage and priority engine

- Scores search zones using **elapsed time**, **chokepoint proximity**, and **camera density**.
- Produces concrete dispatch directives instead of generic alerts:

  > <img src="https://api.iconify.design/mdi/alarm-light-outline.svg?color=%23FF9933" width="20" height="20" align="absmiddle" alt=""> Deploy Search Team to **Ramkund Ghat**, then **Gate 4**, then **CCTV Post 12** &nbsp;`Priority Score: 94/100`

- Interactive Leaflet map with toggleable GeoJSON layers: Mela sectors, police stations, medical camps, ghats, and CCTV posts.

### <img src="https://api.iconify.design/mdi/eye-outline.svg?color=%23FF9933" width="26" height="26" align="absmiddle" alt=""> Modular computer vision (`app.cv`)

| Module                    | What it does                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Quality gate**          | Laplacian-variance blur check, brightness check, and resolution validation                                                |
| **Clothing colors**       | HSV-based upper and lower garment classifier tuned for pilgrimage attire (saffron, white, red, blue, green, yellow, dark) |
| **Detection**             | YOLOv8-Small for people and SCRFD-10G for faces, via ONNX Runtime on CPU, CUDA, or DirectML                               |
| **Advisory verification** | ArcFace 512-d normalized embeddings for candidate similarity                                                              |

### <img src="https://api.iconify.design/mdi/monitor-dashboard.svg?color=%23FF9933" width="26" height="26" align="absmiddle" alt=""> Command center and admin dashboard

- **Live metrics:** total reports, active searches, verified matches, reunited cases.
- **Fuzzy lookup** by name, Case ID, status, or zone using `rapidfuzz`.
- **Case lifecycle** with audit timestamps on every transition:

  `ACTIVE` → `INVESTIGATING` → `FOUND` → `CLOSED`

---

## <img src="https://api.iconify.design/mdi/cog-outline.svg?color=%23FF9933" width="26" height="26" align="absmiddle" alt=""> How It Works

### System architecture

```mermaid
flowchart TB
    subgraph FE["Frontend: Next.js 16 + React 19"]
        K["Public kiosk wizard<br/>/"]
        A["Admin and command center<br/>/admin"]
    end

    subgraph BE["Backend: FastAPI, Python 3.11+"]
        CS["Case service<br/>SQLite"]
        GE["Geo engine<br/>GeoJSON layers"]
        RA["Recommendation engine<br/>proximity and chokepoints"]
        subgraph CV["app.cv: ONNX Runtime"]
            Q["Image quality assessor"]
            C["HSV clothing extractor"]
            Y["YOLOv8-S person detector"]
            S["SCRFD-10G face detector"]
            R["ArcFace embedder"]
        end
    end

    K -- REST --> CS
    A -- REST --> CS
    CS --> GE --> RA
    CS --> CV
```

### Intake flow

```mermaid
sequenceDiagram
    autonumber
    participant F as Family at kiosk
    participant UI as Next.js wizard
    participant API as FastAPI
    participant CV as app.cv
    participant DB as SQLite

    F->>UI: Enter details and capture photo
    UI->>API: Submit report
    API->>CV: Quality gate and analysis
    CV-->>API: Quality verdict, clothing colors, detections
    API->>DB: Persist case
    API->>API: Compute zone priority
    API-->>UI: Case ID, QR payload, dispatch recommendation
    UI-->>F: Printable tracking pass
```

### Vision pipeline

```mermaid
flowchart LR
    IMG["Captured image"] --> QG{"Quality gate<br/>blur, brightness, resolution"}
    QG -- fail --> RETAKE["Reject and prompt retake"]
    QG -- pass --> CLR["HSV garment colors<br/>upper and lower"]
    QG -- pass --> PD["YOLOv8-S<br/>person localization"]
    QG -- pass --> FD["SCRFD-10G<br/>face localization"]
    FD --> EMB["ArcFace<br/>512-d normalized embedding"]
    EMB --> SIM{"Cosine similarity<br/>at or above threshold?"}
    SIM -- yes --> FLAG["Advisory flag<br/>requires_human_verification = true"]
    SIM -- no --> NONE["No flag"]
```

Normalized vectors make cosine similarity a plain dot product.

### Design decisions

| Decision                                                                                                                                                         | Why                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| <img src="https://api.iconify.design/mdi/home-outline.svg?color=%23FF9933" width="20" height="20" align="absmiddle" alt=""> **Local-first inference**            | Models run through ONNX Runtime on the host, so no image or embedding leaves the deployment and kiosks keep working on poor connectivity. |
| <img src="https://api.iconify.design/mdi/power-plug-outline.svg?color=%23FF9933" width="20" height="20" align="absmiddle" alt=""> **Hardware-agnostic**          | One setting (`KUMBH_CV_DEVICE`) switches between a CPU-only kiosk and a GPU command server.                                               |
| <img src="https://api.iconify.design/mdi/text-search.svg?color=%23FF9933" width="20" height="20" align="absmiddle" alt=""> **Rules over black boxes for triage** | Zone ranking is explainable, so officers can see why a zone scored high and retune it.                                                    |
| <img src="https://api.iconify.design/mdi/scale-balance.svg?color=%23FF9933" width="20" height="20" align="absmiddle" alt=""> **Advisory-only matching**          | Similarity produces flags that need human verification, never automatic identification.                                                   |

---

## <img src="https://api.iconify.design/mdi/tune.svg?color=%23FF9933" width="26" height="26" align="absmiddle" alt=""> Configuration

### Backend

Set in `backend/.env` or as environment variables.

| Variable                             | Default                     | Description                                              |
| ------------------------------------ | --------------------------- | -------------------------------------------------------- |
| `KUMBH_API_VERSION`                  | `1.0.0`                     | API version tag                                          |
| `KUMBH_LOG_LEVEL`                    | `INFO`                      | `DEBUG`, `INFO`, `WARNING`, or `ERROR`                   |
| `KUMBH_CORS_ORIGINS`                 | `http://localhost:3000,...` | Comma-separated allowed origins                          |
| `KUMBH_CV_DEVICE`                    | `cpu`                       | Inference provider: `cpu`, `cuda`, or `dml`              |
| `KUMBH_CV_MODELS_DIR`                | `runtime/models`            | Directory containing `.onnx` weights                     |
| `KUMBH_CV_BLUR_THRESHOLD`            | `50.0`                      | Minimum Laplacian variance for a frame to count as sharp |
| `KUMBH_CV_YOLO_CONF`                 | `0.35`                      | Minimum confidence for person detections                 |
| `KUMBH_CV_SCRFD_CONF`                | `0.50`                      | Minimum confidence for face detections                   |
| `KUMBH_CV_MATCH_CANDIDATE_THRESHOLD` | `0.65`                      | Cosine similarity needed to raise a candidate-match flag |

### Frontend

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

<details>
<summary><b><img src="https://api.iconify.design/mdi/tune-vertical.svg?color=%23FF9933" width="20" height="20" align="absmiddle" alt=""> Tuning guide</b></summary>

<br/>

| Symptom                               | Adjust                                              |
| ------------------------------------- | --------------------------------------------------- |
| Good photos rejected as blurry        | Lower `KUMBH_CV_BLUR_THRESHOLD`                     |
| Blurry frames getting through         | Raise `KUMBH_CV_BLUR_THRESHOLD`                     |
| Missed people or faces in crowds      | Lower `KUMBH_CV_YOLO_CONF` or `KUMBH_CV_SCRFD_CONF` |
| Spurious detections                   | Raise the same two values                           |
| Too many candidate flags for officers | Raise `KUMBH_CV_MATCH_CANDIDATE_THRESHOLD`          |
| True candidates missed                | Lower `KUMBH_CV_MATCH_CANDIDATE_THRESHOLD`          |

</details>

> [!NOTE]
> Lowering the match threshold trades officer workload for recall. Calibrate it on representative data before field deployment.

---

## <img src="https://api.iconify.design/mdi/shield-lock-outline.svg?color=%23FF9933" width="26" height="26" align="absmiddle" alt=""> Privacy and Responsible AI

Kumbh Milaap is built around privacy-by-design principles, with India's Digital Personal Data Protection (DPDP) Act in mind.

| Principle                                                                                                                                                   | Implementation                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| <img src="https://api.iconify.design/mdi/dna.svg?color=%23FF9933" width="20" height="20" align="absmiddle" alt=""> **Biometric isolation**                  | Face embeddings are treated as sensitive identifiers and excluded from public listings, unauthenticated endpoints, and printed cards. |
| <img src="https://api.iconify.design/mdi/account-check-outline.svg?color=%23FF9933" width="20" height="20" align="absmiddle" alt=""> **Human in the loop**  | Matches are advisory flags (`requires_human_verification = true`). The system never auto-resolves or auto-identifies a case.          |
| <img src="https://api.iconify.design/mdi/cloud-off-outline.svg?color=%23FF9933" width="20" height="20" align="absmiddle" alt=""> **No third-party cloud**   | Inference runs on-premise or on the edge kiosk. Biometric data is not sent to external commercial APIs.                               |
| <img src="https://api.iconify.design/mdi/file-document-check-outline.svg?color=%23FF9933" width="20" height="20" align="absmiddle" alt=""> **Auditability** | Status transitions carry timestamps so every case change can be audited and traced.                                                   |

### Model Licensing

> [!WARNING]
> Pretrained face and detection models often have restrictive licenses. Verify the current terms of each checkpoint before operational use.

| Component                           | Things to check                                                                                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **YOLOv8** (Ultralytics)            | Distributed under AGPL-3.0, with a separate enterprise license. AGPL obligations can apply when served over a network. |
| **SCRFD and ArcFace** (InsightFace) | Code is open source, but published pretrained weights have historically been limited to non-commercial research use.   |

For operational deployment, replace restricted checkpoints with permissively licensed (e.g., Apache-2.0 Glint360k) or self-trained weights.

---

## <img src="https://api.iconify.design/mdi/alert-outline.svg?color=%23FF9933" width="26" height="26" align="absmiddle" alt=""> Known Limitations

<details>
<summary><b>Read before field deployment</b></summary>

<br/>

- **Face matching in crowds is advisory.** Crowds, harsh sun glare, shawls, and low-resolution sensors impact accuracy. Children present additional challenges due to rapid facial changes.
- **HSV clothing colors are lighting-sensitive.** Direct sunlight and deep shadow can shift measured hues, and heavily patterned attire reduces classifier confidence.
- **Triage is heuristic.** Zone priority scores use deterministic domain rules rather than learned crowd movement models.
- **Single-node SQLite by default.** Designed for standalone edge kiosks; multi-site coordination requires database replication.
- **Human verification is mandatory.** The system outputs candidate flags to assist officers, never automated reunions.

</details>

---

## <img src="https://api.iconify.design/mdi/map-marker-path.svg?color=%23FF9933" width="26" height="26" align="absmiddle" alt=""> Roadmap

- [ ] <img src="https://api.iconify.design/mdi/microphone-outline.svg?color=%23FF9933" width="20" height="20" align="absmiddle" alt=""> **Voice-assisted intake:** multilingual audio prompts and voice transcription in Hindi, Marathi, and Gujarati for low-literacy pilgrims
- [ ] <img src="https://api.iconify.design/mdi/access-point-network.svg?color=%23FF9933" width="20" height="20" align="absmiddle" alt=""> **Offline mesh sync:** peer-to-peer queue synchronization between disconnected help desks over local Wi-Fi or LoRa
- [ ] <img src="https://api.iconify.design/mdi/bullhorn-outline.svg?color=%23FF9933" width="20" height="20" align="absmiddle" alt=""> **Broadcast integration:** automated export format for Mela Authority Public Address (PA) and LED information displays
- [ ] <img src="https://api.iconify.design/mdi/nfc-variant.svg?color=%23FF9933" width="20" height="20" align="absmiddle" alt=""> **Wristband / tag scanning:** barcode and NFC quick-intake for pre-registered elderly pilgrims and children
- [ ] <img src="https://api.iconify.design/mdi/lock-check-outline.svg?color=%23FF9933" width="20" height="20" align="absmiddle" alt=""> **Zero-knowledge proof of reunion:** cryptographic verification token generated on verified reunion for automatic audit log closure and biometric purging

---

## <img src="https://api.iconify.design/mdi/handshake-outline.svg?color=%23FF9933" width="26" height="26" align="absmiddle" alt=""> Contributing

1. **Fork** the repository and create a feature branch.
2. **Keep changes focused** and include tests for new functionality.
3. **Run checks** before opening a pull request:
   ```bash
   pytest
   npm run build
   npm run test:unit
   ```
4. **Never commit** model weights, API secrets, or real personally identifiable information (PII).

---

## <img src="https://api.iconify.design/mdi/heart-outline.svg?color=%23FF9933" width="26" height="26" align="absmiddle" alt=""> Acknowledgements

[Next.js](https://nextjs.org/) · [FastAPI](https://fastapi.tiangolo.com/) · [ONNX Runtime](https://onnxruntime.ai/) · [Leaflet](https://leafletjs.com/) · [OpenStreetMap](https://www.openstreetmap.org/) contributors · [rapidfuzz](https://github.com/rapidfuzz/RapidFuzz) · and the open-source computer vision community.

<div align="center">

<br/>

_Built so that no family spends their first hours searching alone._

</div>
