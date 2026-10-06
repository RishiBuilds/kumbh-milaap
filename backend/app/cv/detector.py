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
from .metadata_extractor import ClothingMetadataExtractor
from .schemas import BoundingBox, ModelStatus, PersonDetection

logger = logging.getLogger("kumbh_milaap.cv.yolo")


class YOLOPersonDetector:
    def __init__(self, model_path: Path | str | None = None, device: str | None = None):
        cfg = get_cv_config()
        self.model_path = Path(model_path) if model_path else cfg.resolve_yolo_path()
        self.device = (device or cfg.device).lower()
        self.conf_threshold = cfg.yolo_conf_threshold
        self.iou_threshold = cfg.yolo_iou_threshold
        self.input_size = cfg.yolo_input_size
        self.metadata_extractor = ClothingMetadataExtractor()

        self.session: ort.InferenceSession | None = None
        self.input_name: str | None = None
        self.output_names: list[str] = []
        self._load_error: str | None = None

        self._init_session()

    def _init_session(self) -> None:
        if ort is None:
            self._load_error = "onnxruntime is not installed"
            logger.warning("ONNX Runtime not found. YOLO detector disabled.")
            return

        if not self.model_path.exists():
            self._load_error = f"Model checkpoint not found at: {self.model_path}"
            logger.info("YOLOv8 model checkpoint not found at %s. Graceful fallback active.", self.model_path)
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
                "YOLOv8-Small session initialized successfully from %s on providers %s",
                self.model_path.name,
                self.session.get_providers(),
            )
        except Exception as exc:
            self._load_error = f"Failed to load ONNX model: {exc}"
            logger.exception("Failed to initialize YOLOv8 ONNX session from %s", self.model_path)

    @property
    def is_loaded(self) -> bool:
        return self.session is not None

    def get_status(self) -> ModelStatus:
        return ModelStatus(
            model_name="YOLOv8-Small (Person Detection)",
            loaded=self.is_loaded,
            path=str(self.model_path) if self.model_path else None,
            device=self.device,
            error=self._load_error,
            license_info="Ultralytics YOLOv8 is licensed under AGPL-3.0 / Commercial. Check terms before deployment.",
        )

    def _letterbox(
        self, img: np.ndarray, new_shape: int = 640
    ) -> tuple[np.ndarray, float, tuple[float, float]]:
        shape = img.shape[:2]
        r = min(new_shape / shape[0], new_shape / shape[1])
        new_unpad = (int(round(shape[1] * r)), int(round(shape[0] * r)))
        dw, dh = new_shape - new_unpad[0], new_shape - new_unpad[1]
        dw /= 2.0
        dh /= 2.0

        if shape[::-1] != new_unpad:
            img = cv2.resize(img, new_unpad, interpolation=cv2.INTER_LINEAR)
        top, bottom = int(round(dh - 0.1)), int(round(dh + 0.1))
        left, right = int(round(dw - 0.1)), int(round(dw + 0.1))
        img = cv2.copyMakeBorder(
            img, top, bottom, left, right, cv2.BORDER_CONSTANT, value=(114, 114, 114)
        )
        return img, r, (dw, dh)

    def detect(self, image_bgr: np.ndarray) -> list[PersonDetection]:
        if not self.is_loaded:
            logger.debug("YOLO detector not loaded; returning empty detections.")
            return []

        if image_bgr is None or image_bgr.size == 0:
            return []

        orig_h, orig_w = image_bgr.shape[:2]

        input_img, ratio, (pad_w, pad_h) = self._letterbox(image_bgr, self.input_size)
        blob = cv2.cvtColor(input_img, cv2.COLOR_BGR2RGB)
        blob = blob.astype(np.float32) / 255.0
        blob = np.transpose(blob, (2, 0, 1))
        blob = np.expand_dims(blob, axis=0)

        outputs = self.session.run(self.output_names, {self.input_name: blob})
        preds = outputs[0]
        if preds.ndim == 3:
            preds = preds[0]
        preds = np.transpose(preds, (1, 0))

        boxes = []
        confidences = []

        for row in preds:
            person_score = float(row[4])
            if person_score >= self.conf_threshold:
                cx, cy, w, h = row[0:4]
                x1 = (cx - w / 2 - pad_w) / ratio
                y1 = (cy - h / 2 - pad_h) / ratio
                x2 = (cx + w / 2 - pad_w) / ratio
                y2 = (cy + h / 2 - pad_h) / ratio

                x1 = max(0, min(orig_w - 1, int(x1)))
                y1 = max(0, min(orig_h - 1, int(y1)))
                x2 = max(0, min(orig_w, int(x2)))
                y2 = max(0, min(orig_h, int(y2)))

                if (x2 - x1) > 10 and (y2 - y1) > 15:
                    boxes.append([x1, y1, x2 - x1, y2 - y1])
                    confidences.append(person_score)

        if not boxes:
            return []

        indices = cv2.dnn.NMSBoxes(boxes, confidences, self.conf_threshold, self.iou_threshold)
        if len(indices) == 0:
            return []

        results: list[PersonDetection] = []
        for i in indices.flatten():
            bx, by, bw, bh = boxes[i]
            score = confidences[i]
            bbox = BoundingBox(x1=bx, y1=by, x2=bx + bw, y2=by + bh)

            clothing = self.metadata_extractor.extract(image_bgr, bbox)

            results.append(
                PersonDetection(
                    person_id=f"P-{uuid.uuid4().hex[:8]}",
                    bbox=bbox,
                    confidence=round(score, 3),
                    clothing=clothing,
                )
            )

        return results
