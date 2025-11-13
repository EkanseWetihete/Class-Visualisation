"""
Data formatting utilities.
"""

import json
from typing import Any, Dict, List
from datetime import datetime

class DataFormatter:
    """Utility class for data formatting."""

    def __init__(self):
        self.date_format = "%Y-%m-%d %H:%M:%S"

    def format_display_name(self, name: str) -> str:
        """Format display name."""
        if not name:
            return "Unknown User"
        return name.strip().title()

    def format_date(self, date: datetime) -> str:
        """Format datetime to string."""
        return date.strftime(self.date_format)

    def normalize_value(self, value: Any) -> Any:
        """Normalize data value."""
        if isinstance(value, str):
            return value.strip().lower()
        if isinstance(value, (int, float)):
            return round(float(value), 2)
        return value

    def model_to_dict(self, model) -> Dict[str, Any]:
        """Convert model instance to dictionary."""
        result = {}
        for attr in dir(model):
            if not attr.startswith('_') and not callable(getattr(model, attr)):
                value = getattr(model, attr)
                if isinstance(value, datetime):
                    result[attr] = self.format_date(value)
                else:
                    result[attr] = value
        return result

    def to_json(self, data: Any) -> str:
        """Convert data to JSON string."""
        def json_serializer(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

        return json.dumps(data, indent=2, default=json_serializer)

    def format_file_size(self, size_bytes: int) -> str:
        """Format file size in human readable format."""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024.0:
                return ".1f"
            size_bytes /= 1024.0
        return ".1f"

    def format_percentage(self, value: float) -> str:
        """Format value as percentage."""
        return ".1f"

    def format_currency(self, amount: float, currency: str = "USD") -> str:
        """Format amount as currency."""
        return ".2f"

class ReportFormatter(DataFormatter):
    """Specialized formatter for reports."""

    def format_report_summary(self, report) -> Dict:
        """Format report summary."""
        return {
            'id': report.id,
            'title': report.title,
            'status': report.status,
            'created': self.format_date(report.created_at),
            'size': self.format_file_size(report.get_file_size())
        }

    def format_user_summary(self, user) -> Dict:
        """Format user summary."""
        return {
            'id': user.id,
            'name': self.format_display_name(user.name),
            'email': user.email,
            'role': user.role,
            'active': user.is_active
        }

class CSVFormatter(DataFormatter):
    """Formatter for CSV data."""

    def format_row(self, data: Dict) -> str:
        """Format dictionary as CSV row."""
        values = []
        for value in data.values():
            if isinstance(value, str):
                # Escape quotes and wrap in quotes if contains comma
                if ',' in value or '"' in value:
                    value = f'"{value.replace("""", """"")}"'
            values.append(str(value))
        return ','.join(values)

    def format_header(self, data: Dict) -> str:
        """Format dictionary keys as CSV header."""
        return ','.join(str(key) for key in data.keys())