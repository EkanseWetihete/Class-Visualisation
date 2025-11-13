"""
Report model for generated reports.
"""

from datetime import datetime
from typing import Dict, List, Optional, Any
from .user import User
from utils.formatters import DataFormatter

class Report:
    """Report model for generated reports."""

    def __init__(self, id: int = None, title: str = "", user: User = None, data: Dict = None):
        self.id = id
        self.title = title
        self.user = user
        self.data = data or {}
        self.status = "pending"
        self.created_at = datetime.now()
        self.generated_at = None
        self.file_path = None
        self.metadata = {}
        self.formatter = DataFormatter()

    def generate(self):
        """Generate the report."""
        self.generated_at = datetime.now()
        self.status = "completed"
        self.file_path = f"reports/{self.id}.pdf"

    def mark_as_failed(self, error: str):
        """Mark report as failed."""
        self.status = "failed"
        self.metadata['error'] = error

    def get_summary(self) -> Dict:
        """Get report summary."""
        return {
            'id': self.id,
            'title': self.title,
            'status': self.status,
            'user': self.user.name if self.user else None,
            'generated_at': self.generated_at.isoformat() if self.generated_at else None
        }

    def export_to_json(self) -> str:
        """Export report data to JSON."""
        return self.formatter.to_json(self.data)

    def get_file_size(self) -> int:
        """Get the file size of the report."""
        # This would normally check actual file size
        return len(str(self.data)) * 1024  # Mock calculation