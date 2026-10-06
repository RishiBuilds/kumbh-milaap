import logging
import uuid
from pathlib import Path
import cv2
import numpy as np

try:
    import onnxruntime as ort
except ImportError:
    ort = None

from .config import get_cv_config
from .schemas import BiometricEmbedding, FacialLandmarks, ModelStatus

logger = logging.getLogger("kumbh_milaap.cv.arcface")

ARCFACE_REFERENCE_LANDMARKS = np.array(
    [
        [38.2946, 51.6963],
        [73.5318, 51.5014],
        [56.0252, 71.7366],
        [41.5493, 92.3655],
        [70.7299, 92.2041],
    ],
    dtype=np.float32,
)


def estimate_similarity_transform(src_pts: np.ndarray, dst_pts: np.ndarray) -> np.ndarray:
    src_mean = src_pts.mean(axis=0)
    dst_mean = dst_pts.mean(axis=0)

    src_centered = src_pts - src_mean
    dst_centered = dst_pts - dst_mean

    var_src = np.var(src_pts, axis=0).sum()
    cov = dst_centered.T @ src_centered / src_pts.shape[0]

    u, d, vt = np.linalg.svd(cov)
    s = np.eye(2)
    if np.linalg.det(u) * np.linalg.det(vt) < 0:
        s[1, 1] = -1

    r = u @ s @ vt
    scale = (d @ np.diag(s)).sum() / var_src
    trans = dst_mean - scale * (r @ src_mean)

    m = np.zeros((2, 3), dtype=np.float32)
    m[:2, :2] = scale * r
    m[:2, 2] = trans
    return m


class ArcFaceEmbedder:
    def __init__(self, model_path: Path | str | None = None, device: str | None = None):
        cfg = get_cv_config()
        self.model_path = Path(model_path) if model_path else cfg.resolve_arcface_path()
        self.device = (device or cfg.device).lower()
        self.input_size = cfg.arcface_input_size
        self.embedding_dim = cfg.arcface_embedding_dim

        self.session: ort.InferenceSession | None = None
        self.input_name: str | None = None
        self.output_names: list[str] = []
        self._load_error: str | None = None

        self._init_session()

    def _init_session(self) -> None:
        if ort is None:
            self._load_error = "onnxruntime is not installed"
            logger.warning("ONNX Runtime not found. ArcFace embedder disabled.")
            return

        if not self.model_path.exists():
            self._load_error = f"Model checkpoint not found at: {self.model_path}"
            logger.info("ArcFace model checkpoint not found at %s. Graceful fallback active.", self.model_path)
            return

        providers = ["CPUExecutionProvider"]
        if self.device in ("cuda", "gpu") and "CUDAExecutionProvider" in ort.get_available_providers():
            providers.insert(0, "CUDAExecutionProvider")
        elif self.device == "dml" and "DmlExecutionProvider" in ort.get_available_providers():
            providers.insert(0, "DmlExecutionProvider")

        try:
            sess_options = ort.SessionOptions()
            sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            self.session = ort.InferenceSession(str(self.model_path), sess_options, providers=providers)
            self.input_name = self.session.get_inputs()[0].name
            self.output_names = [o.name for o in self.session.get_outputs()]
            self._load_error = None
            logger.info(
                "ArcFace session initialized from %s on %s",
                self.model_path.name,
                self.session.get_providers(),
            )
        except Exception as exc:
            self._load_error = f"Failed to initialize ArcFace: {exc}"
            logger.exception("Failed to initialize ArcFace ONNX session from %s", self.model_path)

    @property
    def is_loaded(self) -> bool:
        return self.session is not None

    def get_status(self) -> ModelStatus:
        return ModelStatus(
            model_name="ArcFace (512-d Face Embedding)",
            loaded=self.is_loaded,
            path=str(self.model_path) if self.model_path else None,
            device=self.device,
            error=self._load_error,
            license_info=(
                "Pretrained ArcFace models from InsightFace are restricted to non-commercial research. "
                "For production deployment, verify checkpoint license or use models trained on "
                "permissively licensed datasets (e.g., Glint360k Apache 2.0 checkpoints)."
            ),
        )

    def align_face(self, image_bgr: np.ndarray, landmarks: FacialLandmarks) -> np.ndarray:
        src_pts = np.array(landmarks.as_list(), dtype=np.float32)
        transform_mat = estimate_similarity_transform(src_pts, ARCFACE_REFERENCE_LANDMARKS)
        aligned = cv2.warpAffine(
            image_bgr,
            transform_mat,
            (self.input_size[0], self.input_size[1]),
            flags=cv2.INTER_LINEAR,
            borderMode=cv2.BORDER_REFLECT,
        )
        return aligned

    def extract_embedding(
        self, image_bgr: np.ndarray, landmarks: FacialLandmarks | None = None
    ) -> BiometricEmbedding | None:
        if not self.is_loaded:
            logger.debug("ArcFace embedder not loaded; cannot extract embedding.")
            return None

        if image_bgr is None or image_bgr.size == 0:
            return None

        if landmarks is not None:
            face_img = self.align_face(image_bgr, landmarks)
        else:
            face_img = cv2.resize(image_bgr, self.input_size)

        face_rgb = cv2.cvtColor(face_img, cv2.COLOR_BGR2RGB)
        input_blob = (face_rgb.astype(np.float32) - 127.5) / 128.0
        input_blob = np.transpose(input_blob, (2, 0, 1))
        input_blob = np.expand_dims(input_blob, axis=0)

        outputs = self.session.run(self.output_names, {self.input_name: input_blob})
        embedding_raw = outputs[0][0].astype(np.float32)

        norm = np.linalg.norm(embedding_raw)
        if norm > 0:
            embedding_norm = (embedding_raw / norm).tolist()
        else:
            embedding_norm = embedding_raw.tolist()

        return BiometricEmbedding(
            embedding_id=f"BIO-{uuid.uuid4().hex[:12]}",
            dimension=len(embedding_norm),
            l2_normalized=True,
            vector=embedding_norm,
        )

    @staticmethod
    def compute_similarity(embedding_a: list[float], embedding_b: list[float]) -> float:
        va = np.array(embedding_a, dtype=np.float32)
        vb = np.array(embedding_b, dtype=np.float32)
        norm_a = np.linalg.norm(va)
        norm_b = np.linalg.norm(vb)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        similarity = float(np.dot(va, vb) / (norm_a * norm_b))
        return round(float(np.clip(similarity, -1.0, 1.0)), 4)
