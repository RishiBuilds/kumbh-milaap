from __future__ import annotations

from bisect import bisect_left
from typing import Any, Iterable

URGENCY_BREAKPOINTS = (15, 30, 60, 120)
URGENCY_LABELS = ("IMMEDIATE", "URGENT", "HIGH", "ELEVATED", "STANDARD")

AGE_BREAKPOINTS = (5, 12, 18, 60, 75)
AGE_PROFILES = ("toddler", "child", "adolescent", "adult", "senior citizen", "elderly individual")

MAX_ZONES_LISTED = 5
ESCALATION_WINDOW_MIN = 30


def _plural(count: int, noun: str) -> str:
    return f"{count} {noun}{'' if count == 1 else 's'}"


def _is_vulnerable(age: int) -> bool:
    return age < 12 or age > 60


def _urgency_label(minutes_since: int) -> str:
    return URGENCY_LABELS[bisect_left(URGENCY_BREAKPOINTS, minutes_since)]


def _age_profile(age: int) -> str:
    return AGE_PROFILES[bisect_left(AGE_BREAKPOINTS, age + 1)]


def _time_description(minutes_since: int) -> str:
    if minutes_since < 60:
        return f"approximately {_plural(minutes_since, 'minute')} ago"
    hours, remaining = divmod(minutes_since, 60)
    text = f"approximately {_plural(hours, 'hour')}"
    if remaining:
        text += f" and {_plural(remaining, 'minute')}"
    return f"{text} ago"


def _special_notes(age: int, gender: str, minutes_since: int) -> list[str]:
    notes: list[str] = []

    if age > 60:
        notes.append(
            "For elderly subjects, prioritize medical aid points and rest areas. "
            "Coordinate with medical volunteers stationed along the ghats."
        )
    if age < 12:
        notes.append(
            "For child subjects, immediately activate the Child Safety Protocol. "
            "Alert all volunteer checkpoints and Lost & Found centers."
        )
    if _is_vulnerable(age):
        notes.append(
            "Subject falls in a vulnerable demographic. Escalate to the zone commander "
            f"if not located within {ESCALATION_WINDOW_MIN} minutes."
        )

    if minutes_since > 120:
        notes.append(
            "Extended elapsed time detected. Consider expanding the search radius and "
            "coordinating with adjacent zone patrol teams."
        )
    elif minutes_since > 60:
        notes.append(
            "Elapsed time exceeds 1 hour. Recommend broadening the search perimeter "
            "and reviewing CCTV footage from neighboring zones."
        )

    if gender.strip().lower() == "female":
        notes.append(
            "Deploy female volunteer escorts for sensitive outreach. "
            "Check women's rest areas and family waiting zones."
        )

    return notes


def _format_score(value: Any) -> str:
    try:
        return f"{float(value):.0f}"
    except (TypeError, ValueError):
        return "n/a"


def _zone_lines(zones: Iterable[dict]) -> list[str]:
    lines = []
    for idx, zone in enumerate(list(zones)[:MAX_ZONES_LISTED], start=1):
        name = zone.get("zone_name") or f"Zone {idx}"
        score = _format_score(zone.get("score"))
        reason = zone.get("reason") or "Proximity-based scoring"
        lines.append(f"  {idx}. {name} (Score: {score}) — {reason}")
    return lines


def _action_lines(
    nearest_police: str,
    police_distance: str,
    cctv_count: int,
    chokepoint_count: int,
    radius_m: int,
) -> list[str]:
    cctv_line = (
        f"Review feeds from {_plural(cctv_count, 'CCTV camera')} within the {radius_m}m search radius"
        if cctv_count > 0
        else f"No CCTV cameras within {radius_m}m — deploy visual patrol teams immediately"
    )
    choke_line = (
        f"Deploy search teams to {_plural(chokepoint_count, 'nearby crowd chokepoint')}"
        if chokepoint_count > 0
        else "No major chokepoints nearby — focus on main pedestrian corridors and entry/exit points"
    )
    steps = [
        f"Alert {nearest_police} ({police_distance} from last known location)",
        cctv_line,
        choke_line,
        "Broadcast descriptive alert to all zone volunteer coordinators via radio",
    ]
    return [f"{i}. {step}" for i, step in enumerate(steps, start=1)]


def generate_ai_summary(
    person_name: str,
    age: int,
    gender: str,
    clothing: str,
    zone_name: str | None,
    nearest_police: str,
    police_distance_m: float,
    nearby_cctv_count: int,
    nearby_chokepoint_count: int,
    priority_zones: list[dict],
    search_radius_m: int,
    confidence: str,
    minutes_since: int,
) -> str:
    minutes_since = max(0, int(minutes_since))
    police_distance = f"{police_distance_m:.0f}m"
    zone_display = zone_name or "an unidentified zone"
    clothing_display = clothing.strip() if clothing and clothing.strip() else "unreported clothing"

    analysis = (
        f"Based on the report analysis, {person_name} ({gender}, {age} years old, "
        f"{_age_profile(age)}, wearing {clothing_display}) was last seen "
        f"{_time_description(minutes_since)} in {zone_display}. Given the elapsed time "
        f"and the subject's age profile, this case has been classified as "
        f"{_urgency_label(minutes_since)} PRIORITY."
    )

    actions = "IMMEDIATE ACTIONS RECOMMENDED:\n" + "\n".join(
        _action_lines(
            nearest_police,
            police_distance,
            nearby_cctv_count,
            nearby_chokepoint_count,
            search_radius_m,
        )
    )

    zone_lines = _zone_lines(priority_zones)
    if zone_lines:
        zones = "PRIORITY SEARCH ZONES (ranked by probability):\n" + "\n".join(zone_lines)
    else:
        zones = (
            "PRIORITY SEARCH ZONES:\n"
            "  Insufficient zone data available. Recommend manual assessment by zone commander."
        )

    confidence_line = (
        f"Search confidence: {confidence} | Recommended search radius: {search_radius_m}m"
    )

    resources = "\n".join(
        [
            "RESOURCE SUMMARY:",
            f"• Nearest police station: {nearest_police} ({police_distance})",
            f"• CCTV cameras in range: {nearby_cctv_count}",
            f"• Crowd chokepoints monitored: {nearby_chokepoint_count}",
            f"• Active search radius: {search_radius_m}m",
        ]
    )

    sections = [analysis, actions, zones, confidence_line, resources]

    notes = _special_notes(age, gender, minutes_since)
    if notes:
        sections.append("ADVISORY NOTES:\n" + "\n".join(f"• {note}" for note in notes))

    return "\n\n".join(sections)