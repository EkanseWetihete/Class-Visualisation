"""
Data models for the system.
"""

from datetime import datetime
from typing import Dict, List, Optional, Any
from utils.validators import DataValidator
from utils.formatters import DataFormatter

class BaseModel:
    """Base class for all data models."""

    def __init__(self, id: int = None):
        self.id = id
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
        self.validator = DataValidator()
        self.formatter = DataFormatter()

    def validate(self) -> bool:
        """Validate the model data."""
        return self.validator.validate_model(self)

    def to_dict(self) -> Dict[str, Any]:
        """Convert model to dictionary."""
        return self.formatter.model_to_dict(self)

    def update_timestamp(self):
        """Update the updated_at timestamp."""
        self.updated_at = datetime.now()

class User(BaseModel):
    """User model representing system users."""

    def __init__(self, id: int = None, name: str = "", email: str = "", raw_data: Dict = None):
        super().__init__(id)
        self.name = name
        self.email = email
        self.raw_data = raw_data or {}
        self.is_active = True
        self.role = "user"
        self.preferences = {}
        self.last_login = None

    def authenticate(self, password: str) -> bool:
        """Authenticate user with password."""
        # This would normally hash and compare passwords
        return self.validator.validate_password(password)

    def update_profile(self, data: Dict):
        """Update user profile information."""
        self.name = data.get('name', self.name)
        self.email = data.get('email', self.email)
        self.preferences.update(data.get('preferences', {}))
        self.update_timestamp()

    def get_display_name(self) -> str:
        """Get display name for the user."""
        return self.formatter.format_display_name(self.name)

    def is_admin(self) -> bool:
        """Check if user is an administrator."""
        return self.role == "admin"

class Report(BaseModel):
    """Report model for generated reports."""

    def __init__(self, id: int = None, title: str = "", user: User = None, data: Dict = None):
        super().__init__(id)
        self.title = title
        self.user = user
        self.data = data or {}
        self.status = "pending"
        self.generated_at = None
        self.file_path = None
        self.metadata = {}

    def generate(self):
        """Generate the report."""
        self.generated_at = datetime.now()
        self.status = "completed"
        self.file_path = f"reports/{self.id}.pdf"
        self.update_timestamp()

    def mark_as_failed(self, error: str):
        """Mark report as failed."""
        self.status = "failed"
        self.metadata['error'] = error
        self.update_timestamp()

    def get_summary(self) -> Dict:
        """Get report summary."""
        return {
            'id': self.id,
            'title': self.title,
            'status': self.status,
            'user': self.user.name if self.user else None,
            'generated_at': self.generated_at.isoformat() if self.generated_at else None
        }

class DataPoint(BaseModel):
    """Individual data point model."""

    def __init__(self, id: int = None, value: Any = None, timestamp: datetime = None):
        super().__init__(id)
        self.value = value
        self.timestamp = timestamp or datetime.now()
        self.quality_score = 1.0
        self.source = "unknown"

    def calculate_quality(self) -> float:
        """Calculate data quality score."""
        # Complex quality calculation logic
        if self.value is None:
            return 0.0
        if isinstance(self.value, (int, float)):
            return min(1.0, abs(self.value) / 100.0)
        if isinstance(self.value, str):
            return min(1.0, len(self.value) / 100.0)
        return 0.5

    def normalize(self):
        """Normalize the data point."""
        self.quality_score = self.calculate_quality()
        self.value = self.formatter.normalize_value(self.value)

class Dataset(BaseModel):
    """Dataset model containing multiple data points."""

    def __init__(self, id: int = None, name: str = "", points: List[DataPoint] = None):
        super().__init__(id)
        self.name = name
        self.points = points or []
        self.total_points = len(self.points)
        self.average_quality = 0.0

    def add_point(self, point: DataPoint):
        """Add a data point to the dataset."""
        self.points.append(point)
        self.total_points = len(self.points)
        self.calculate_average_quality()
        self.update_timestamp()

    def calculate_average_quality(self):
        """Calculate average quality of all points."""
        if not self.points:
            self.average_quality = 0.0
            return

        total_quality = sum(point.quality_score for point in self.points)
        self.average_quality = total_quality / len(self.points)

    def filter_by_quality(self, min_quality: float) -> List[DataPoint]:
        """Filter points by minimum quality score."""
        return [point for point in self.points if point.quality_score >= min_quality]

    def get_statistics(self) -> Dict:
        """Get dataset statistics."""
        if not self.points:
            return {'count': 0, 'average_quality': 0.0}

        qualities = [p.quality_score for p in self.points]
        return {
            'count': len(self.points),
            'average_quality': sum(qualities) / len(qualities),
            'min_quality': min(qualities),
            'max_quality': max(qualities)
        }