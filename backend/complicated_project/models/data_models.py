"""
Data point and dataset models.
"""

from datetime import datetime
from typing import Dict, List, Optional, Any
from utils.formatters import DataFormatter

class DataPoint:
    """Individual data point model."""

    def __init__(self, id: int = None, value: Any = None, timestamp: datetime = None):
        self.id = id
        self.value = value
        self.timestamp = timestamp or datetime.now()
        self.quality_score = 1.0
        self.source = "unknown"
        self.formatter = DataFormatter()

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

    def to_csv_row(self) -> str:
        """Convert to CSV row format."""
        return f"{self.id},{self.timestamp.isoformat()},{self.value},{self.quality_score}"

class Dataset:
    """Dataset model containing multiple data points."""

    def __init__(self, id: int = None, name: str = "", points: List[DataPoint] = None):
        self.id = id
        self.name = name
        self.points = points or []
        self.total_points = len(self.points)
        self.average_quality = 0.0
        self.created_at = datetime.now()

    def add_point(self, point: DataPoint):
        """Add a data point to the dataset."""
        self.points.append(point)
        self.total_points = len(self.points)
        self.calculate_average_quality()

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

    def export_to_csv(self) -> str:
        """Export dataset to CSV format."""
        header = "id,timestamp,value,quality_score\n"
        rows = [point.to_csv_row() for point in self.points]
        return header + "\n".join(rows)