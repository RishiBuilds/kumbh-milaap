import cv2
import numpy as np
from .schemas import BoundingBox, ClothingColorMetadata


COLOR_RANGES_HSV: dict[str, list[tuple[np.ndarray, np.ndarray]]] = {
    "White": [
        (np.array([0, 0, 180], dtype=np.uint8), np.array([179, 45, 255], dtype=np.uint8)),
    ],
    "Black": [
        (np.array([0, 0, 0], dtype=np.uint8), np.array([179, 255, 45], dtype=np.uint8)),
    ],
    "Grey": [
        (np.array([0, 0, 46], dtype=np.uint8), np.array([179, 50, 179], dtype=np.uint8)),
    ],
    "Saffron / Orange": [
        (np.array([7, 100, 100], dtype=np.uint8), np.array([24, 255, 255], dtype=np.uint8)),
    ],
    "Yellow": [
        (np.array([25, 70, 100], dtype=np.uint8), np.array([35, 255, 255], dtype=np.uint8)),
    ],
    "Red": [
        (np.array([0, 70, 70], dtype=np.uint8), np.array([6, 255, 255], dtype=np.uint8)),
        (np.array([170, 70, 70], dtype=np.uint8), np.array([179, 255, 255], dtype=np.uint8)),
    ],
    "Green": [
        (np.array([36, 50, 50], dtype=np.uint8), np.array([85, 255, 255], dtype=np.uint8)),
    ],
    "Blue": [
        (np.array([86, 50, 50], dtype=np.uint8), np.array([130, 255, 255], dtype=np.uint8)),
    ],
    "Purple / Violet": [
        (np.array([131, 50, 50], dtype=np.uint8), np.array([160, 255, 255], dtype=np.uint8)),
    ],
    "Brown": [
        (np.array([10, 80, 20], dtype=np.uint8), np.array([20, 255, 120], dtype=np.uint8)),
    ],
}


class ClothingMetadataExtractor:
    def __init__(self, crop_margin_ratio: float = 0.1):
        self.crop_margin_ratio = crop_margin_ratio

    def _classify_dominant_color(self, crop_bgr: np.ndarray) -> tuple[str, float]:
        if crop_bgr is None or crop_bgr.size == 0:
            return "Unknown", 0.0

        h, w = crop_bgr.shape[:2]
        mx = int(w * self.crop_margin_ratio)
        my = int(h * self.crop_margin_ratio)
        if w > 2 * mx and h > 2 * my:
            crop_bgr = crop_bgr[my : h - my, mx : w - mx]

        hsv = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2HSV)
        total_pixels = hsv.shape[0] * hsv.shape[1]
        if total_pixels == 0:
            return "Unknown", 0.0

        color_scores: dict[str, int] = {}
        for color_name, ranges in COLOR_RANGES_HSV.items():
            mask_total = np.zeros(hsv.shape[:2], dtype=np.uint8)
            for lower, upper in ranges:
                mask = cv2.inRange(hsv, lower, upper)
                mask_total = cv2.bitwise_or(mask_total, mask)
            color_scores[color_name] = int(cv2.countNonZero(mask_total))

        sorted_colors = sorted(color_scores.items(), key=lambda item: item[1], reverse=True)
        top_color, top_count = sorted_colors[0]

        confidence = top_count / total_pixels if total_pixels > 0 else 0.0
        if confidence < 0.15:
            return "Mixed / Unclassified", round(confidence, 2)

        return top_color, round(min(1.0, confidence * 1.3), 2)

    def extract(self, full_image: np.ndarray, person_bbox: BoundingBox) -> ClothingColorMetadata:
        img_h, img_w = full_image.shape[:2]
        x1 = max(0, person_bbox.x1)
        y1 = max(0, person_bbox.y1)
        x2 = min(img_w, person_bbox.x2)
        y2 = min(img_h, person_bbox.y2)

        box_h = y2 - y1
        if box_h < 10 or (x2 - x1) < 10:
            return ClothingColorMetadata(
                upper_color="Unknown",
                lower_color="Unknown",
                dominant_hsv_label="Unknown",
                confidence=0.0,
            )

        upper_start = y1 + int(box_h * 0.15)
        upper_end = y1 + int(box_h * 0.50)
        lower_start = y1 + int(box_h * 0.50)
        lower_end = y1 + int(box_h * 0.90)

        upper_crop = full_image[upper_start:upper_end, x1:x2]
        lower_crop = full_image[lower_start:lower_end, x1:x2]

        upper_color, upper_conf = self._classify_dominant_color(upper_crop)
        lower_color, lower_conf = self._classify_dominant_color(lower_crop)

        combined_conf = round((upper_conf + lower_conf) / 2.0, 2)
        dominant_label = f"Upper: {upper_color}, Lower: {lower_color}"

        return ClothingColorMetadata(
            upper_color=upper_color,
            lower_color=lower_color,
            dominant_hsv_label=dominant_label,
            confidence=combined_conf,
        )
