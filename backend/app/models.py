import re
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator

TIME_PATTERN = r"^([01]\d|2[0-3]):[0-5]\d$"
PHONE_PATTERN = r"^\+?[0-9\-\s]{7,15}$"


class APIModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, populate_by_name=True)


class Gender(str, Enum):
    male = "male"
    female = "female"
    other = "other"


class PriorityLevel(str, Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"


class CaseStatus(str, Enum):
    active = "active"
    found = "found"
    closed = "closed"


class PersonDetails(APIModel):
    name: str = Field(..., min_length=1, max_length=200, description="Full name of the missing person.")
    age: int = Field(..., ge=0, le=120, description="Age in years. An estimate is fine.")
    gender: Gender
    height: str | None = Field(default=None, max_length=50, description="For example 5 ft 4 in or 162 cm.")
    clothing_description: str = Field(
        ...,
        min_length=5,
        max_length=500,
        description="Clothing colours and patterns at the time they were last seen.",
    )
    distinguishing_features: str | None = Field(
        default=None,
        max_length=500,
        description="Marks, glasses, walking aids or anything else that helps identify them.",
    )

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = re.sub(r"\s+", " ", value)
        if not any(ch.isalpha() for ch in value):
            raise ValueError("Name must contain at least one letter.")
        return value

    @field_validator("height", "distinguishing_features")
    @classmethod
    def empty_to_none(cls, value: str | None) -> str | None:
        return value or None


class LastSeenInfo(APIModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    landmark: str | None = Field(default=None, max_length=200, description="Zone or landmark name.")
    time: str = Field(..., pattern=TIME_PATTERN, description="24 hour time in HH:MM format.")
    minutes_since: int = Field(
        ...,
        ge=0,
        le=10080,
        description="Minutes since the person was last seen, up to one week.",
    )


class ContactInfo(APIModel):
    name: str = Field(..., min_length=1, max_length=200)
    phone: str = Field(..., pattern=PHONE_PATTERN, description="7 to 15 digits. Spaces and dashes are removed.")
    relation: str = Field(..., min_length=1, max_length=100)

    @field_validator("phone")
    @classmethod
    def normalise_phone(cls, value: str) -> str:
        return re.sub(r"[\s\-]", "", value)


class MissingPersonReport(APIModel):
    person: PersonDetails
    last_seen: LastSeenInfo
    contact: ContactInfo

    model_config = ConfigDict(
        str_strip_whitespace=True,
        populate_by_name=True,
        json_schema_extra={
            "examples": [
                {
                    "person": {
                        "name": "Ramesh Kumar",
                        "age": 68,
                        "gender": "male",
                        "height": "5 ft 6 in",
                        "clothing_description": "Blue kurta, white pyjama",
                        "distinguishing_features": "Wears round glasses and walks with a stick",
                    },
                    "last_seen": {
                        "latitude": 20.003,
                        "longitude": 73.792,
                        "landmark": "Zone A - Ramkund & Ghats",
                        "time": "14:30",
                        "minutes_since": 30,
                    },
                    "contact": {"name": "Suresh Kumar", "phone": "9876543210", "relation": "Son"},
                }
            ]
        },
    )


class NearbyFeature(APIModel):
    id: str
    name: str
    distance_m: float = Field(..., ge=0)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    properties: dict = Field(default_factory=dict)


class ZonePriority(APIModel):
    zone_id: str
    zone_name: str
    score: float = Field(..., ge=0)
    reason: str


class SearchRecommendation(APIModel):
    current_zone: dict | None = None
    nearest_police: NearbyFeature
    nearby_cctv: list[NearbyFeature] = Field(default_factory=list)
    nearby_chokepoints: list[NearbyFeature] = Field(default_factory=list)
    priority_zones: list[ZonePriority] = Field(default_factory=list)
    search_radius_m: int = Field(..., ge=0)
    confidence: str
    priority_level: PriorityLevel
    ai_summary: str


class CaseResponse(APIModel):
    case_id: str
    created_at: datetime
    updated_at: datetime | None = None
    status: CaseStatus = CaseStatus.active
    report: MissingPersonReport
    recommendation: SearchRecommendation
    qr_code_base64: str


class CaseSummary(APIModel):
    case_id: str
    status: CaseStatus
    created_at: datetime
    person: PersonDetails
    last_seen: LastSeenInfo
    priority_level: PriorityLevel | None = None


class CaseListResponse(APIModel):
    count: int = Field(..., ge=0)
    results: list[CaseSummary] = Field(default_factory=list)


class CaseStatusUpdate(APIModel):
    status: CaseStatus


class StatsResponse(APIModel):
    total_cases: int = Field(..., ge=0)
    active_cases: int = Field(..., ge=0)
    found_cases: int = Field(..., ge=0)
    closed_cases: int = Field(..., ge=0)
    cases_by_zone: dict[str, int] = Field(default_factory=dict)
    avg_response_time_min: float = Field(..., ge=0)
    cctv_count: int = Field(default=0, ge=0)
    chokepoint_count: int = Field(default=0, ge=0)
    police_count: int = Field(default=0, ge=0)


class ErrorDetail(APIModel):
    code: str
    message: str
    request_id: str | None = None
    details: list[dict] | None = None


class ErrorResponse(APIModel):
    error: ErrorDetail