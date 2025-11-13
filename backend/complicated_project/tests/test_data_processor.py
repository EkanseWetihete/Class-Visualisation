"""
Unit tests for the data processor.
"""

import unittest
from unittest.mock import Mock, patch
from datetime import datetime
from core.data_processor import DataProcessor
from models.data_models import DataPoint, Dataset
from utils.validators import DataValidator

class TestDataProcessor(unittest.TestCase):
    """Test cases for DataProcessor class."""

    def setUp(self):
        """Set up test fixtures."""
        self.processor = DataProcessor()
        self.sample_data = {
            "user_id": 1,
            "data_points": [
                {"value": 85.5, "timestamp": "2024-01-01T10:00:00", "source": "sensor_a"},
                {"value": 92.3, "timestamp": "2024-01-01T11:00:00", "source": "sensor_a"},
                {"value": 78.9, "timestamp": "2024-01-01T12:00:00", "source": "sensor_a"}
            ]
        }

    def test_initialization(self):
        """Test processor initialization."""
        self.assertIsNotNone(self.processor.logger)
        self.assertIsNotNone(self.processor.validator)
        self.assertIsNotNone(self.processor.config)

    def test_validate_input_valid(self):
        """Test input validation with valid data."""
        result = self.processor._validate_input(self.sample_data)
        self.assertTrue(result)

    def test_validate_input_invalid(self):
        """Test input validation with invalid data."""
        invalid_data = {"user_id": 1}  # Missing data_points
        result = self.processor._validate_input(invalid_data)
        self.assertFalse(result)

    def test_create_dataset(self):
        """Test dataset creation from raw data."""
        dataset = self.processor._create_dataset(self.sample_data)

        self.assertEqual(dataset.name, "User_1_data")
        self.assertEqual(len(dataset.points), 3)
        self.assertIsInstance(dataset.points[0], DataPoint)

    @patch('core.data_processor.time.time')
    def test_process_success(self, mock_time):
        """Test successful data processing."""
        mock_time.return_value = 1000.0

        result = self.processor.process(self.sample_data)

        self.assertEqual(result['status'], 'success')
        self.assertIn('dataset', result)
        self.assertIn('statistics', result)
        self.assertIn('processing_time', result)

    def test_process_invalid_input(self):
        """Test processing with invalid input."""
        invalid_data = {"invalid": "data"}

        result = self.processor.process(invalid_data)

        self.assertEqual(result['status'], 'failed')
        self.assertIn('error', result)

    def test_processing_stats_update(self):
        """Test processing statistics update."""
        initial_stats = self.processor.processing_stats.copy()

        # Process valid data
        self.processor.process(self.sample_data)

        # Check stats were updated
        self.assertEqual(self.processor.processing_stats['total_processed'], initial_stats['total_processed'] + 1)
        self.assertEqual(self.processor.processing_stats['successful'], initial_stats['successful'] + 1)

    def test_get_processing_stats(self):
        """Test retrieving processing statistics."""
        stats = self.processor.get_processing_stats()

        required_keys = ['total_processed', 'successful', 'failed', 'average_time']
        for key in required_keys:
            self.assertIn(key, stats)

    def test_reset_stats(self):
        """Test statistics reset."""
        # Process some data first
        self.processor.process(self.sample_data)

        # Reset stats
        self.processor.reset_stats()

        # Check stats are reset
        self.assertEqual(self.processor.processing_stats['total_processed'], 0)
        self.assertEqual(self.processor.processing_stats['successful'], 0)
        self.assertEqual(self.processor.processing_stats['failed'], 0)
        self.assertEqual(self.processor.processing_stats['average_time'], 0.0)

class TestDataPoint(unittest.TestCase):
    """Test cases for DataPoint model."""

    def test_initialization(self):
        """Test DataPoint initialization."""
        point = DataPoint(value=42.5, source="test_sensor")

        self.assertEqual(point.value, 42.5)
        self.assertEqual(point.source, "test_sensor")
        self.assertIsNotNone(point.timestamp)

    def test_quality_calculation_numeric(self):
        """Test quality calculation for numeric values."""
        point = DataPoint(value=75.0)
        quality = point.calculate_quality()

        self.assertGreaterEqual(quality, 0.0)
        self.assertLessEqual(quality, 1.0)

    def test_quality_calculation_string(self):
        """Test quality calculation for string values."""
        point = DataPoint(value="test data")
        quality = point.calculate_quality()

        self.assertGreaterEqual(quality, 0.0)
        self.assertLessEqual(quality, 1.0)

    def test_normalization(self):
        """Test data point normalization."""
        point = DataPoint(value="  TEST DATA  ")
        point.normalize()

        self.assertEqual(point.value, "test data")
        self.assertIsInstance(point.quality_score, float)

if __name__ == '__main__':
    unittest.main()