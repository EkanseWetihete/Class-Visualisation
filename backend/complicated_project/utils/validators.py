"""
Data validation utilities.
"""

import re
from typing import Any, Dict, List
from datetime import datetime

class DataValidator:
    """Utility class for data validation."""

    def __init__(self):
        self.email_pattern = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')

    def validate_email(self, email: str) -> bool:
        """Validate email format."""
        return bool(self.email_pattern.match(email))

    def validate_password(self, password: str) -> bool:
        """Validate password strength."""
        if len(password) < 8:
            return False
        if not re.search(r'[A-Z]', password):
            return False
        if not re.search(r'[a-z]', password):
            return False
        if not re.search(r'[0-9]', password):
            return False
        return True

    def validate_model(self, model) -> bool:
        """Validate a model instance."""
        if hasattr(model, 'id') and model.id is not None:
            if not isinstance(model.id, int) or model.id <= 0:
                return False
        return True

    def validate_data_point(self, value: Any) -> bool:
        """Validate data point value."""
        if value is None:
            return False
        if isinstance(value, (int, float, str)):
            return True
        return False

    def validate_dataset_name(self, name: str) -> bool:
        """Validate dataset name."""
        if not name or len(name.strip()) == 0:
            return False
        if len(name) > 100:
            return False
        return True

    def sanitize_string(self, text: str) -> str:
        """Sanitize string input."""
        if not text:
            return ""
        # Remove potentially dangerous characters
        return re.sub(r'[<>]', '', text.strip())

class InputValidator(DataValidator):
    """Extended validator for user inputs."""

    def validate_user_input(self, data: Dict) -> List[str]:
        """Validate user input data and return list of errors."""
        errors = []

        if 'name' in data:
            if not data['name'] or len(data['name'].strip()) < 2:
                errors.append("Name must be at least 2 characters long")

        if 'email' in data:
            if not self.validate_email(data['email']):
                errors.append("Invalid email format")

        if 'age' in data:
            try:
                age = int(data['age'])
                if age < 0 or age > 150:
                    errors.append("Age must be between 0 and 150")
            except ValueError:
                errors.append("Age must be a number")

        return errors

    def validate_report_data(self, data: Dict) -> bool:
        """Validate report data structure."""
        required_fields = ['title', 'user_id']
        for field in required_fields:
            if field not in data:
                return False
        return True