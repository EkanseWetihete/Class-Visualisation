"""
Base model and user model classes.
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