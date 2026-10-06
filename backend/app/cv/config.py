import os
from functools import lru_cache
from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class CVConfig(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="KUMBH_CV_",
        env_file=".env",
        extra="ignore",
    )

    models_dir: Path = Field(
        default=Path(__file__).resolve().parent.parent.parent / "runtime" / "models"
    )

    yolo_model_path: Path | None = None
    scrfd_model_path: Path | None = None
    arcface_model_path: Path | None = None

    device: str = Field(default="cpu")

    yolo_conf_threshold: float = Field(default=0.35, ge=0.0, le=1.0)
    yolo_iou_threshold: float = Field(default=0.45, ge=0.0, le=1.0)
    yolo_input_size: int = Field(default=640)

    scrfd_conf_threshold: float = Field(default=0.50, ge=0.0, le=1.0)
    scrfd_nms_threshold: float = Field(default=0.40, ge=0.0, le=1.0)
    scrfd_input_size: tuple[int, int] = Field(default=(640, 640))

    arcface_input_size: tuple[int, int] = Field(default=(112, 112))
    arcface_embedding_dim: int = Field(default=512)

    blur_threshold: float = Field(default=50.0, ge=0.0)
    min_face_size_px: int = Field(default=20, ge=8)
    min_brightness: float = Field(default=40.0, ge=0.0)
    max_brightness: float = Field(default=220.0, le=255.0)

    match_candidate_threshold: float = Field(default=0.65, ge=0.0, le=1.0)
    match_high_confidence_threshold: float = Field(default=0.75, ge=0.0, le=1.0)

    def resolve_yolo_path(self) -> Path:
        if self.yolo_model_path:
            return Path(self.yolo_model_path)
        return self.models_dir / "yolov8s.onnx"

    def resolve_scrfd_path(self) -> Path:
        if self.scrfd_model_path:
            return Path(self.scrfd_model_path)
        return self.models_dir / "scrfd_10g_bnkps.onnx"

    def resolve_arcface_path(self) -> Path:
        if self.arcface_model_path:
            return Path(self.arcface_model_path)
        return self.models_dir / "arcface_w600k_r50.onnx"


@lru_cache(maxsize=1)
def get_cv_config() -> CVConfig:
    return CVConfig()
