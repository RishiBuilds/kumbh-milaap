import logging
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel

from ..cv import get_cv_service
from ..cv.schemas import (
    ClothingColorMetadata,
    ExposureLabel,
    FrameAnalysisResult,
    ImageQualityAssessment,
    ModelStatus,
)

logger = logging.getLogger("kumbh_milaap.routes.cv")

router = APIRouter(prefix="/cv", tags=["computer-vision"])


class PhotoRegistrationResponse(BaseModel):
    face_detected: bool
    face_quality: ImageQualityAssessment | None = None
    embedding_generated: bool
    embedding_id: str | None = None
    warnings: list[str] = []
    message: str


@router.get("/status", response_model=list[ModelStatus], summary="Diagnostic status of CV models")
async def cv_status() -> list[ModelStatus]:
    service = get_cv_service()
    return service.get_system_status()


@router.post(
    "/assess-quality",
    response_model=ImageQualityAssessment,
    summary="Assess image sharpness and illumination",
)
async def assess_image_quality(file: UploadFile = File(...)) -> ImageQualityAssessment:
    service = get_cv_service()
    try:
        content = await file.read()
        image = service.decode_image(content)
        return service.quality_assessor.assess(image)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        logger.exception("Error assessing image quality: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to assess image quality.",
        )


@router.post(
    "/extract-clothing",
    response_model=ClothingColorMetadata,
    summary="Extract clothing colors from an image",
)
async def extract_clothing(file: UploadFile = File(...)) -> ClothingColorMetadata:
    service = get_cv_service()
    try:
        content = await file.read()
        image = service.decode_image(content)
        h, w = image.shape[:2]
        from ..cv.schemas import BoundingBox

        bbox = BoundingBox(x1=0, y1=0, x2=w, y2=h)
        return service.metadata_extractor.extract(image, bbox)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        logger.exception("Error extracting clothing colors: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to extract clothing metadata.",
        )


@router.post(
    "/analyze-frame",
    response_model=FrameAnalysisResult,
    summary="Analyze CCTV frame for people, clothing, and faces",
)
async def analyze_frame(
    file: UploadFile = File(...),
    camera_id: str = Form(default="CAM-CCTV-01"),
    zone: str = Form(default="Ramkund & Ghats"),
) -> FrameAnalysisResult:
    service = get_cv_service()
    try:
        content = await file.read()
        return service.analyze_frame(image_bytes=content, camera_id=camera_id, zone=zone)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        logger.exception("Error analyzing frame: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process frame.",
        )


@router.post(
    "/register-photo",
    response_model=PhotoRegistrationResponse,
    summary="Process missing person intake photo",
)
async def register_photo(file: UploadFile = File(...)) -> PhotoRegistrationResponse:
    service = get_cv_service()
    try:
        content = await file.read()
        embedding, face = service.extract_face_embedding(content)

        if face is None:
            return PhotoRegistrationResponse(
                face_detected=False,
                face_quality=None,
                embedding_generated=False,
                embedding_id=None,
                warnings=["No human face detected. Please provide a clear forward-facing photo."],
                message="No face detected in reference photo.",
            )

        warnings = list(face.quality.warnings)
        if not face.quality.is_usable:
            warnings.append("Photo quality is suboptimal for automated search matching.")

        return PhotoRegistrationResponse(
            face_detected=True,
            face_quality=face.quality,
            embedding_generated=embedding is not None,
            embedding_id=embedding.embedding_id if embedding else None,
            warnings=warnings,
            message="Reference photo processed successfully.",
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        logger.exception("Error registering photo: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process photo registration.",
        )
