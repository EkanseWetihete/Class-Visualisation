"""
Core data processing functionality.
"""

from typing import Dict, List, Any, Optional
from datetime import datetime
import time
from models.data_models import DataPoint, Dataset
from utils.logger import Logger
from utils.validators import DataValidator
from utils.config_manager import ConfigManager

class DataProcessor:
    """Main data processing engine."""

    def __init__(self):
        self.logger = Logger("DataProcessor")
        self.validator = DataValidator()
        self.config = ConfigManager()
        self.processing_stats = {
            'total_processed': 0,
            'successful': 0,
            'failed': 0,
            'average_time': 0.0
        }

    def initialize(self):
        """Initialize the data processor."""
        self.logger.info("Initializing Data Processor")
        self.config.load_config()

    def process(self, raw_data: Dict) -> Dict[str, Any]:
        """Process raw user data."""
        start_time = time.time()

        try:
            self.logger.info("Starting data processing")

            # Validate input
            if not self._validate_input(raw_data):
                raise ValueError("Invalid input data")

            # Create dataset from raw data
            dataset = self._create_dataset(raw_data)

            # Apply processing pipeline
            processed_dataset = self._apply_processing_pipeline(dataset)

            # Generate statistics
            statistics = processed_dataset.get_statistics()

            # Calculate processing time
            processing_time = time.time() - start_time

            # Update stats
            self._update_processing_stats(True, processing_time)

            result = {
                'dataset': processed_dataset,
                'statistics': statistics,
                'processing_time': processing_time,
                'status': 'success'
            }

            self.logger.info(f"Data processing completed in {processing_time:.2f}s")
            return result

        except Exception as e:
            processing_time = time.time() - start_time
            self._update_processing_stats(False, processing_time)
            self.logger.error(f"Data processing failed: {str(e)}")
            return {
                'error': str(e),
                'processing_time': processing_time,
                'status': 'failed'
            }

    def _validate_input(self, data: Dict) -> bool:
        """Validate input data structure."""
        if not isinstance(data, dict):
            return False

        required_fields = ['user_id', 'data_points']
        for field in required_fields:
            if field not in data:
                return False

        if not isinstance(data['data_points'], list):
            return False

        return True

    def _create_dataset(self, raw_data: Dict) -> Dataset:
        """Create dataset from raw data."""
        dataset = Dataset(name=f"User_{raw_data['user_id']}_data")

        for point_data in raw_data['data_points']:
            if self.validator.validate_data_point(point_data.get('value')):
                point = DataPoint(
                    value=point_data['value'],
                    timestamp=point_data.get('timestamp'),
                    source=point_data.get('source', 'user_input')
                )
                point.normalize()
                dataset.add_point(point)

        return dataset

    def _apply_processing_pipeline(self, dataset: Dataset) -> Dataset:
        """Apply the complete processing pipeline."""
        # Step 1: Filter low quality data
        min_quality = self.config.get('processing.min_quality', 0.5)
        high_quality_points = dataset.filter_by_quality(min_quality)

        # Step 2: Create filtered dataset
        processed_dataset = Dataset(
            name=f"{dataset.name}_processed",
            points=high_quality_points
        )

        # Step 3: Apply transformations
        self._apply_transformations(processed_dataset)

        # Step 4: Calculate derived metrics
        self._calculate_derived_metrics(processed_dataset)

        return processed_dataset

    def _apply_transformations(self, dataset: Dataset):
        """Apply data transformations."""
        for point in dataset.points:
            # Apply normalization
            point.normalize()

            # Apply scaling if configured
            scale_factor = self.config.get('processing.scale_factor', 1.0)
            if isinstance(point.value, (int, float)):
                point.value *= scale_factor

    def _calculate_derived_metrics(self, dataset: Dataset):
        """Calculate derived metrics for the dataset."""
        if not dataset.points:
            return

        # Calculate moving averages, trends, etc.
        values = [p.value for p in dataset.points if isinstance(p.value, (int, float))]

        if values:
            dataset.metadata = {
                'mean': sum(values) / len(values),
                'min': min(values),
                'max': max(values),
                'count': len(values)
            }

    def _update_processing_stats(self, success: bool, processing_time: float):
        """Update processing statistics."""
        self.processing_stats['total_processed'] += 1

        if success:
            self.processing_stats['successful'] += 1
        else:
            self.processing_stats['failed'] += 1

        # Update rolling average
        total_time = self.processing_stats['average_time'] * (self.processing_stats['total_processed'] - 1)
        self.processing_stats['average_time'] = (total_time + processing_time) / self.processing_stats['total_processed']

    def get_processing_stats(self) -> Dict[str, Any]:
        """Get current processing statistics."""
        return self.processing_stats.copy()

    def reset_stats(self):
        """Reset processing statistics."""
        self.processing_stats = {
            'total_processed': 0,
            'successful': 0,
            'failed': 0,
            'average_time': 0.0
        }
        self.logger.info("Processing statistics reset")