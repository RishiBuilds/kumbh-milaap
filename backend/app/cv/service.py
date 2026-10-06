import logging
import time
import uuid
from datetime import datetime, timezone
import cv2
import numpy as np

from .config import CVConfig, get_cv_config
from .detector import YOLOPersonDetector
from .face_detector import SCRFDFaceDetector
from .face_embedder import ArcFaceEmbedder
from .metadata_extractor import ClothingMetadataExtractor
from .quality_assessor import ImageQualityAssessor
from .schemas import (
    BiometricEmbedding,
    CandidateMatch,
    FaceDetection,
    FrameAnalysisResult,
    ModelStatus,
    PersonDetection,
)

logger = logging.getLogger("kumbh_milaap.cv.service")


class ComputerVisionService:
    def __init__(self, config: CVConfig | None = None):
        self.config = config or get_cv_config()
        self.quality_assessor = ImageQualityAssessor()
        self.metadata_extractor = ClothingMetadataExtractor()
        self.yolo_detector = YOLOPersonDetector(device=self.config.device)
        self.scrfd_detector = SCRFDFaceDetector(device=self.config.device)
        self.arcface_embedder = ArcFaceEmbedder(device=self.config.device)

    def get_system_status(self) -> list[ModelStatus]:
        return [
            self.yolo_detector.get_status(),
            self.scrfd_detector.get_status(),
            self.arcface_embedder.get_status(),
        ]

    @staticmethod
    def decode_image(image_bytes: bytes) -> np.ndarray:
        if not image_bytes:
            raise ValueError("Empty image byte payload received.")
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Failed to decode image. Unsupported or corrupted image format.")
        return img

    def _associate_face_with_person(
        self, face: FaceDetection, persons: list[PersonDetection]
    ) -> str | None:
        fx = (face.bbox.x1 + face.bbox.x2) / 2
        fy = (face.bbox.y1 + face.bbox.y2) / 2
        for person in persons:
            pb = person.bbox
            if pb.x1 <= fx <= pb.x2 and pb.y1 <= fy <= pb.y2:
                return person.person_id
        return None

    def analyze_frame(
        self,
        image_bytes: bytes,
        camera_id: str = "CAM-UNSPECIFIED",
        zone: str = "Zone Unknown",
        reference_embeddings: dict[str, list[float]] | None = None,
    ) -> FrameAnalysisResult:
        start_time = time.perf_counter()
        image = self.decode_image(image_bytes)
        now = datetime.now(timezone.utc)
        frame_id = f"FRM-{uuid.uuid4().hex[:10]}"

        frame_quality = self.quality_assessor.assess(image)
        persons = self.yolo_detector.detect(image)
        faces = self.scrfd_detector.detect(image)

        for face in faces:
            face.associated_person_id = self._associate_face_with_person(face, persons)

        candidate_matches: list[CandidateMatch] = []
        if reference_embeddings and self.arcface_embedder.is_loaded:
            for face in faces:
                if face.quality.is_blurry or face.bbox.width < self.config.min_face_size_px:
                    continue

                emb = self.arcface_embedder.extract_embedding(image, face.landmarks)
                if emb is None:
                    continue

                for ref_case_id, ref_vec in reference_embeddings.items():
                    sim = self.arcface_embedder.compute_similarity(emb.vector, ref_vec)
                    if sim >= self.config.match_candidate_threshold:
                        candidate_matches.append(
                            CandidateMatch(
                                candidate_id=f"MATCH-{uuid.uuid4().hex[:8]}",
                                reference_case_id=ref_case_id,
                                similarity_score=sim,
                                camera_id=camera_id,
                                zone=zone,
                                timestamp=now,
                                requires_human_verification=True,
                                verification_status="PENDING_REVIEW",
                            )
                        )

        elapsed_ms = (time.perf_counter() - start_time) * 1000

        return FrameAnalysisResult(
            frame_id=frame_id,
            camera_id=camera_id,
            zone=zone,
            timestamp=now,
            persons=persons,
            faces=faces,
            candidate_matches=candidate_matches,
            frame_quality=frame_quality,
            processing_time_ms=round(elapsed_ms, 2),
        )

    def extract_face_embedding(
        self,
        image_bytes: bytes,
    ) -> tuple[BiometricEmbedding | None, FaceDetection | None]:
        image = self.decode_image(image_bytes)
        faces = self.scrfd_detector.detect(image)

        if not faces:
            logger.info("No face detected in reference intake photo.")
            return None, None

        largest_face = max(faces, key=lambda f: f.bbox.area)
        embedding = self.arcface_embedder.extract_embedding(image, largest_face.landmarks)

        return embedding, largest_face


_service_instance: ComputerVisionService | None = None


def get_cv_service() -> ComputerVisionService:
    global _service_instance
    if _service_instance is None:
        _service_instance = ComputerVisionService()
    return _service_instance
