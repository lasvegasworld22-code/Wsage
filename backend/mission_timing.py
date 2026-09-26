"""Persist each request's research scope and random 1–5 minute work window."""
import re
import secrets
from datetime import datetime, timedelta

DEPTHS = {
    'quick': {'minimum': 60, 'maximum': 120, 'queries': 1, 'pages': 2, 'evidence': 4},
    'standard': {'minimum': 120, 'maximum': 210, 'queries': 3, 'pages': 5, 'evidence': 10},
    'deep': {'minimum': 210, 'maximum': 295, 'queries': 5, 'pages': 8, 'evidence': 15},
}

def resolve_depth(agent, objective):
    configured = agent.get('researchDepth', 'auto')
    if configured in DEPTHS:
        return configured
    text = (objective + ' ' + agent.get('strategy', '')).lower()
    if re.search(r'\b(deep|comprehensive|exhaustive|in.depth|mendalam|menyeluruh)\b', text):
        return 'deep'
    if agent.get('behavior') == 'Concise & direct' and len(objective) < 240:
        return 'quick'
    if len(objective) > 700:
        return 'deep'
    return 'standard'

def execution_window(agent, objective, started_at):
    depth = resolve_depth(agent, objective)
    scope = DEPTHS[depth]
    duration = scope['minimum'] + secrets.randbelow(scope['maximum'] - scope['minimum'] + 1)
    started = datetime.fromisoformat(started_at)
    return {
        'researchDepth': depth,
        'targetDurationSeconds': duration,
        'expectedCompletionAt': (started + timedelta(seconds=duration)).isoformat(),
        'deadlineAt': (started + timedelta(seconds=300)).isoformat(),
    }