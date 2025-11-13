"""
User management functionality.
"""

from typing import Dict, List, Optional, Any
from models.user import User
from utils.logger import Logger, AuditLogger
from utils.validators import InputValidator
from utils.config_manager import ConfigManager
import json
import os

class UserManager:
    """Manages user operations and data."""

    def __init__(self):
        self.logger = Logger("UserManager")
        self.audit_logger = AuditLogger()
        self.validator = InputValidator()
        self.config = ConfigManager()
        self.users = {}  # In production, this would be a database
        self.user_data_file = "data/users.json"

    def initialize(self):
        """Initialize the user manager."""
        self.logger.info("Initializing User Manager")
        self.config.load_config()
        self._load_users()

    def get_user(self, user_id: int) -> Optional[User]:
        """Get user by ID."""
        user_data = self.users.get(user_id)
        if user_data:
            user = User(**user_data)
            self.audit_logger.log_data_access(user_id, "user_profile", "read")
            return user
        return None

    def create_user(self, user_data: Dict[str, Any]) -> Optional[User]:
        """Create a new user."""
        # Validate input
        errors = self.validator.validate_user_input(user_data)
        if errors:
            self.logger.error(f"User creation failed: {', '.join(errors)}")
            return None

        # Generate user ID
        user_id = max(self.users.keys()) + 1 if self.users else 1

        # Create user object
        user = User(
            id=user_id,
            name=user_data['name'],
            email=user_data['email'],
            raw_data=user_data.get('raw_data', {})
        )

        # Save user
        self.users[user_id] = user.to_dict()
        self._save_users()

        self.audit_logger.log_security_event("user_created", user_id, {"email": user.email})
        self.logger.info(f"User created: {user_id} - {user.name}")

        return user

    def update_user(self, user_id: int, updates: Dict[str, Any]) -> bool:
        """Update user information."""
        if user_id not in self.users:
            self.logger.error(f"User not found: {user_id}")
            return False

        # Validate updates
        errors = self.validator.validate_user_input(updates)
        if errors:
            self.logger.error(f"User update failed: {', '.join(errors)}")
            return False

        # Apply updates
        user_data = self.users[user_id]
        user_data.update(updates)
        user_data['updated_at'] = user_data['updated_at']  # This would be handled by the model

        self._save_users()

        self.audit_logger.log_security_event("user_updated", user_id, {"fields": list(updates.keys())})
        self.logger.info(f"User updated: {user_id}")

        return True

    def delete_user(self, user_id: int) -> bool:
        """Delete a user."""
        if user_id not in self.users:
            self.logger.error(f"User not found: {user_id}")
            return False

        user_data = self.users[user_id]
        del self.users[user_id]
        self._save_users()

        self.audit_logger.log_security_event("user_deleted", user_id, {"email": user_data.get('email')})
        self.logger.info(f"User deleted: {user_id}")

        return True

    def get_active_users(self) -> List[User]:
        """Get all active users."""
        active_users = []
        for user_data in self.users.values():
            if user_data.get('is_active', True):
                user = User(**user_data)
                active_users.append(user)

        self.logger.info(f"Retrieved {len(active_users)} active users")
        return active_users

    def authenticate_user(self, email: str, password: str) -> Optional[User]:
        """Authenticate user credentials."""
        for user_data in self.users.values():
            if user_data['email'] == email:
                user = User(**user_data)
                if user.authenticate(password):
                    user.last_login = user.last_login  # This would be updated
                    self.audit_logger.log_security_event("user_login", user.id, {"email": email})
                    self.logger.info(f"User authenticated: {user.id}")
                    return user
                else:
                    self.audit_logger.log_security_event("login_failed", user.id, {"email": email})
                    break

        self.logger.warning(f"Authentication failed for email: {email}")
        return None

    def search_users(self, query: str) -> List[User]:
        """Search users by name or email."""
        results = []
        query_lower = query.lower()

        for user_data in self.users.values():
            if (query_lower in user_data['name'].lower() or
                query_lower in user_data['email'].lower()):
                user = User(**user_data)
                results.append(user)

        self.logger.info(f"User search for '{query}' returned {len(results)} results")
        return results

    def get_user_count(self) -> int:
        """Get total number of users."""
        return len(self.users)

    def get_user_stats(self) -> Dict[str, Any]:
        """Get user statistics."""
        total_users = len(self.users)
        active_users = sum(1 for u in self.users.values() if u.get('is_active', True))
        admin_users = sum(1 for u in self.users.values() if u.get('role') == 'admin')

        return {
            'total_users': total_users,
            'active_users': active_users,
            'inactive_users': total_users - active_users,
            'admin_users': admin_users,
            'regular_users': total_users - admin_users
        }

    def _load_users(self):
        """Load users from storage."""
        try:
            if os.path.exists(self.user_data_file):
                with open(self.user_data_file, 'r') as f:
                    self.users = json.load(f)
                self.logger.info(f"Loaded {len(self.users)} users from storage")
            else:
                self.users = {}
                self.logger.info("No user data file found, starting with empty user list")
        except Exception as e:
            self.logger.error(f"Failed to load users: {str(e)}")
            self.users = {}

    def _save_users(self):
        """Save users to storage."""
        try:
            os.makedirs(os.path.dirname(self.user_data_file), exist_ok=True)
            with open(self.user_data_file, 'w') as f:
                json.dump(self.users, f, indent=2)
            self.logger.debug("Users saved to storage")
        except Exception as e:
            self.logger.error(f"Failed to save users: {str(e)}")