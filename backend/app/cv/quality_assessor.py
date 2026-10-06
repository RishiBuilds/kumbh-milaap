import cv2
import numpy as np
from .config import get_cv_config
from .schemas import ExposureLabel, ImageQualityAssessment


class ImageQualityAssessor:
    def __init__(self, blur_threshold: float | None = None):
        cfg = get_cv_config()
        self.blur_threshold = blur_threshold or cfg.blur_threshold
        self.min_brightness = cfg.min_brightness
        self.max_brightness = cfg.max_brightness
        self.min_face_size_px = cfg.min_face_size_px

    def assess(
        self,
        image: np.ndarray,
        min_width: int | None = None,
        min_height: int | None = None,
    ) -> ImageQualityAssessment:
        warnings: list[str] = []

        if image is None or image.size == 0:
            return ImageQualityAssessment(
                blur_score=0.0,
                is_blurry=True,
                brightness_mean=0.0,
                exposure_label=ExposureLabel.under_exposed,
                resolution=(0, 0),
                is_usable=False,
                warnings=["Empty or invalid image data"],
            )

        h, w = image.shape[:2]
        res = (w, h)

        req_w = min_width or self.min_face_size_px
        req_h = min_height or self.min_face_size_px
        if w < req_w or h < req_h:
            warnings.append(f"Resolution ({w}x{h}) is below minimum threshold ({req_w}x{req_h})")

        if len(image.shape) == 3 and image.shape[2] == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        elif len(image.shape) == 3 and image.shape[2] == 4:
            gray = cv2.cvtColor(image, cv2.COLOR_BGRA2GRAY)
        else:
            gray = image

        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        blur_score = float(laplacian.var())
        is_blurry = blur_score < self.blur_threshold
        if is_blurry:
            warnings.append(
                f"Image is blurred (Laplacian variance {blur_score:.1f} < {self.blur_threshold:.1f})"
            )

        brightness_mean = float(np.mean(gray))
        if brightness_mean < self.min_brightness:
            exposure_label = ExposureLabel.under_exposed
            warnings.append(
                f"Image is underexposed/dark (mean intensity {brightness_mean:.1f} < {self.min_brightness:.1f})"
            )
        elif brightness_mean > self.max_brightness:
            exposure_label = ExposureLabel.over_exposed
            warnings.append(
                f"Image is overexposed/washed out (mean intensity {brightness_mean:.1f} > {self.max_brightness:.1f})"
            )
        else:
            exposure_label = ExposureLabel.well_exposed

        is_usable = (not is_blurry) and (exposure_label == ExposureLabel.well_exposed) and (w >= req_w and h >= req_h)

        return ImageQualityAssessment(
            blur_score=round(blur_score, 2),
            is_blurry=is_blurry,
            brightness_mean=round(brightness_mean, 2),
            exposure_label=exposure_label,
            resolution=res,
            is_usable=is_usable,
            warnings=warnings,
        )
