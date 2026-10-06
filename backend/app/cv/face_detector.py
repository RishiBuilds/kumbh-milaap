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
from .quality_assessor import ImageQualityAssessor
from .schemas import (
    BoundingBox,
    FaceDetection,
    FacialLandmarks,
    ModelStatus,
    Point2D,
)

logger = logging.getLogger("kumbh_milaap.cv.scrfd")


class SCRFDFaceDetector:
    def __init__(self, model_path: Path | str | None = None, device: str | None = None):
        cfg = get_cv_config()
        self.model_path = Path(model_path) if model_path else cfg.resolve_scrfd_path()
        self.device = (device or cfg.device).lower()
        self.conf_threshold = cfg.scrfd_conf_threshold
        self.nms_threshold = cfg.scrfd_nms_threshold
        self.input_size = cfg.scrfd_input_size
        self.quality_assessor = ImageQualityAssessor()

        self.session: ort.InferenceSession | None = None
        self.input_name: str | None = None
        self.output_names: list[str] = []
        self._load_error: str | None = None

        self.fmc = 3
        self._feat_stride_fpn = [8, 16, 32]
        self._num_anchors = 2
        self.use_kps = True

        self._init_session()

    def _init_session(self) -> None:
        if ort is None:
            self._load_error = "onnxruntime is not installed"
            logger.warning("ONNX Runtime not found. SCRFD face detector disabled.")
            return

        if not self.model_path.exists():
            self._load_error = f"Model checkpoint not found at: {self.model_path}"
            logger.info("SCRFD model checkpoint not found at %s. Graceful fallback active.", self.model_path)
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
                "SCRFD-10G session initialized from %s on %s",
                self.model_path.name,
                self.session.get_providers(),
            )
        except Exception as exc:
            self._load_error = f"Failed to initialize SCRFD: {exc}"
            logger.exception("Failed to initialize SCRFD ONNX session from %s", self.model_path)

    @property
    def is_loaded(self) -> bool:
        return self.session is not None

    def get_status(self) -> ModelStatus:
        return ModelStatus(
            model_name="SCRFD-10G (Crowd Face Detection & Landmarks)",
            loaded=self.is_loaded,
            path=str(self.model_path) if self.model_path else None,
            device=self.device,
            error=self._load_error,
            license_info=(
                "InsightFace / SCRFD pretrained weights are typically non-commercial research licensed. "
                "Ensure compliant checkpoint license before operational field deployment."
            ),
        )

    def _distance2bbox(self, points: np.ndarray, distance: np.ndarray) -> np.ndarray:
        x1 = points[:, 0] - distance[:, 0]
        y1 = points[:, 1] - distance[:, 1]
        x2 = points[:, 0] + distance[:, 2]
        y2 = points[:, 1] + distance[:, 3]
        return np.stack([x1, y1, x2, y2], axis=-1)

    def _distance2kps(self, points: np.ndarray, distance: np.ndarray) -> np.ndarray:
        preds = []
        for i in range(0, distance.shape[1], 2):
            px = points[:, 0] + distance[:, i]
            py = points[:, 1] + distance[:, i + 1]
            preds.append(px)
            preds.append(py)
        return np.stack(preds, axis=-1)

    def detect(self, image_bgr: np.ndarray) -> list[FaceDetection]:
        if not self.is_loaded:
            logger.debug("SCRFD detector not loaded; returning empty detections.")
            return []

        if image_bgr is None or image_bgr.size == 0:
            return []

        orig_h, orig_w = image_bgr.shape[:2]
        target_w, target_h = self.input_size

        im_ratio = float(orig_h) / orig_w
        model_ratio = float(target_h) / target_w
        if im_ratio > model_ratio:
            new_h = target_h
            new_w = int(new_h / im_ratio)
        else:
            new_w = target_w
            new_h = int(new_w * im_ratio)

        det_scale = float(new_h) / orig_h
        resized_img = cv2.resize(image_bgr, (new_w, new_h))
        det_img = np.zeros((target_h, target_w, 3), dtype=np.uint8)
        det_img[:new_h, :new_w, :] = resized_img

        blob = cv2.dnn.blobFromImage(
            det_img, 1.0 / 128.0, (target_w, target_h), (127.5, 127.5, 127.5), swapRB=True
        )

        net_outs = self.session.run(self.output_names, {self.input_name: blob})

        scores_list = []
        bboxes_list = []
        kpss_list = []

        fmc = self.fmc
        for idx, stride in enumerate(self._feat_stride_fpn):
            score = net_outs[idx]
            bbox = net_outs[idx + fmc] * stride
            if self.use_kps:
                kps = net_outs[idx + fmc * 2] * stride

            height = target_h // stride
            width = target_w // stride
            anchor_centers = np.stack(np.mgrid[:height, :width][::-1], axis=-1).astype(np.float32)
            anchor_centers = (anchor_centers * stride).reshape((-1, 2))
            if self._num_anchors > 1:
                anchor_centers = np.stack([anchor_centers] * self._num_anchors, axis=1).reshape((-1, 2))

            pos_inds = np.where(score >= self.conf_threshold)[0]
            bboxes = self._distance2bbox(anchor_centers, bbox)
            pos_scores = score[pos_inds]
            pos_bboxes = bboxes[pos_inds]
            scores_list.append(pos_scores)
            bboxes_list.append(pos_bboxes)

            if self.use_kps:
                kpss = self._distance2kps(anchor_centers, kps)
                kpss_list.append(kpss[pos_inds])

        if not scores_list:
            return []

        scores = np.vstack(scores_list)
        bboxes = np.vstack(bboxes_list)
        kpss = np.vstack(kpss_list) if self.use_kps else None

        bboxes /= det_scale
        if kpss is not None:
            kpss /= det_scale

        boxes_cv = []
        scores_cv = []
        for i in range(len(scores)):
            x1, y1, x2, y2 = bboxes[i]
            score_val = float(scores[i][0] if scores.ndim > 1 else scores[i])
            boxes_cv.append([int(x1), int(y1), int(x2 - x1), int(y2 - y1)])
            scores_cv.append(score_val)

        if not boxes_cv:
            return []

        indices = cv2.dnn.NMSBoxes(boxes_cv, scores_cv, self.conf_threshold, self.nms_threshold)
        if len(indices) == 0:
            return []

        results: list[FaceDetection] = []
        for i in indices.flatten():
            bx, by, bw, bh = boxes_cv[i]
            x1 = max(0, bx)
            y1 = max(0, by)
            x2 = min(orig_w, bx + bw)
            y2 = min(orig_h, by + bh)

            if (x2 - x1) < 8 or (y2 - y1) < 8:
                continue

            face_bbox = BoundingBox(x1=x1, y1=y1, x2=x2, y2=y2)
            face_crop = image_bgr[y1:y2, x1:x2]
            quality = self.quality_assessor.assess(face_crop)

            landmarks = None
            if kpss is not None and i < len(kpss):
                kp = kpss[i]
                landmarks = FacialLandmarks(
                    left_eye=Point2D(x=float(kp[0]), y=float(kp[1])),
                    right_eye=Point2D(x=float(kp[2]), y=float(kp[3])),
                    nose=Point2D(x=float(kp[4]), y=float(kp[5])),
                    mouth_left=Point2D(x=float(kp[6]), y=float(kp[7])),
                    mouth_right=Point2D(x=float(kp[8]), y=float(kp[9])),
                )

            results.append(
                FaceDetection(
                    face_id=f"F-{uuid.uuid4().hex[:8]}",
                    bbox=face_bbox,
                    confidence=round(scores_cv[i], 3),
                    landmarks=landmarks,
                    quality=quality,
                )
            )

        return results
