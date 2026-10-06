from datetime import datetime
from enum import Enum
from pydantic import BaseModel, ConfigDict, Field


class CVModel(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True,
        populate_by_name=True,
        protected_namespaces=(),
    )


class ExposureLabel(str, Enum):
    under_exposed = "under_exposed"
    well_exposed = "well_exposed"
    over_exposed = "over_exposed"


class Point2D(CVModel):
    x: float
    y: float


class FacialLandmarks(CVModel):
    left_eye: Point2D
    right_eye: Point2D
    nose: Point2D
    mouth_left: Point2D
    mouth_right: Point2D

    def as_list(self) -> list[tuple[float, float]]:
        return [
            (self.left_eye.x, self.left_eye.y),
            (self.right_eye.x, self.right_eye.y),
            (self.nose.x, self.nose.y),
            (self.mouth_left.x, self.mouth_left.y),
            (self.mouth_right.x, self.mouth_right.y),
        ]


class BoundingBox(CVModel):
    x1: int
    y1: int
    x2: int
    y2: int

    @property
    def width(self) -> int:
        return max(0, self.x2 - self.x1)

    @property
    def height(self) -> int:
        return max(0, self.y2 - self.y1)

    @property
    def area(self) -> int:
        return self.width * self.height


class ImageQualityAssessment(CVModel):
    blur_score: float = Field(..., description="Laplacian variance. Higher is sharper.")
    is_blurry: bool
    brightness_mean: float = Field(..., description="Mean pixel intensity in [0, 255].")
    exposure_label: ExposureLabel
    resolution: tuple[int, int] = Field(..., description="(width, height) in pixels.")
    is_usable: bool = Field(..., description="Whether frame/crop meets minimum quality standards.")
    warnings: list[str] = Field(default_factory=list)


class ClothingColorMetadata(CVModel):
    upper_color: str = Field(..., description="Detected upper garment color (e.g., Saffron, White, Red).")
    lower_color: str = Field(..., description="Detected lower garment color (e.g., White, Blue, Black).")
    dominant_hsv_label: str = Field(default="Unknown")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class PersonDetection(CVModel):
    person_id: str
    bbox: BoundingBox
    confidence: float = Field(..., ge=0.0, le=1.0)
    clothing: ClothingColorMetadata
    quality: ImageQualityAssessment | None = None


class FaceDetection(CVModel):
    face_id: str
    bbox: BoundingBox
    confidence: float = Field(..., ge=0.0, le=1.0)
    landmarks: FacialLandmarks | None = None
    quality: ImageQualityAssessment
    associated_person_id: str | None = None


class BiometricEmbedding(CVModel):
    embedding_id: str
    dimension: int = 512
    l2_normalized: bool = True
    vector: list[float] = Field(..., description="512-dimensional float32 vector.")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class CandidateMatch(CVModel):
    candidate_id: str
    reference_case_id: str
    similarity_score: float = Field(..., ge=0.0, le=1.0)
    camera_id: str
    zone: str
    timestamp: datetime
    clothing_match_status: str = Field(
        default="unverified",
        description="Comparison with intake report clothing ('consistent', 'divergent', 'unverified')",
    )
    requires_human_verification: bool = Field(
        default=True,
        description="Mandatory flag enforcing authorized human operator verification.",
    )
    verified_by_officer: str | None = None
    verification_status: str = Field(
        default="PENDING_REVIEW",
        description="Status: PENDING_REVIEW, CONFIRMED_MATCH, FALSE_POSITIVE, REJECTED",
    )


class FrameAnalysisResult(CVModel):
    frame_id: str
    camera_id: str
    zone: str
    timestamp: datetime
    persons: list[PersonDetection] = Field(default_factory=list)
    faces: list[FaceDetection] = Field(default_factory=list)
    candidate_matches: list[CandidateMatch] = Field(default_factory=list)
    frame_quality: ImageQualityAssessment
    processing_time_ms: float


class ModelStatus(CVModel):
    model_name: str
    loaded: bool
    path: str | None = None
    device: str
    error: str | None = None
    license_info: str
