"""
Configuration management utility.
"""

import json
import os
from typing import Dict, Any, Optional, List
from utils.logger import Logger

class ConfigManager:
    """Configuration manager for the system."""

    def __init__(self, config_file: str = "config.json"):
        self.config_file = config_file
        self.config = {}
        self.logger = Logger("ConfigManager")
        self.defaults = {
            "database": {
                "host": "localhost",
                "port": 5432,
                "name": "complex_system_db"
            },
            "logging": {
                "level": "INFO",
                "max_file_size": 10485760,  # 10MB
                "backup_count": 5
            },
            "processing": {
                "batch_size": 100,
                "timeout": 300,
                "max_retries": 3
            },
            "notifications": {
                "email_enabled": True,
                "sms_enabled": False,
                "webhook_url": None
            },
            "security": {
                "session_timeout": 3600,
                "password_min_length": 8,
                "max_login_attempts": 5
            }
        }

    def load_config(self) -> bool:
        """Load configuration from file."""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r') as f:
                    loaded_config = json.load(f)
                    self.config = self._merge_configs(self.defaults, loaded_config)
                self.logger.info(f"Configuration loaded from {self.config_file}")
            else:
                self.config = self.defaults.copy()
                self.save_config()
                self.logger.info("Default configuration created")
            return True
        except Exception as e:
            self.logger.error(f"Failed to load configuration: {str(e)}")
            self.config = self.defaults.copy()
            return False

    def save_config(self) -> bool:
        """Save current configuration to file."""
        try:
            with open(self.config_file, 'w') as f:
                json.dump(self.config, f, indent=2)
            self.logger.info(f"Configuration saved to {self.config_file}")
            return True
        except Exception as e:
            self.logger.error(f"Failed to save configuration: {str(e)}")
            return False

    def get(self, key: str, default: Any = None) -> Any:
        """Get configuration value by key."""
        keys = key.split('.')
        value = self.config

        for k in keys:
            if isinstance(value, dict) and k in value:
                value = value[k]
            else:
                return default
        return value

    def set(self, key: str, value: Any) -> bool:
        """Set configuration value."""
        keys = key.split('.')
        config = self.config

        # Navigate to the parent of the target key
        for k in keys[:-1]:
            if k not in config:
                config[k] = {}
            config = config[k]

        config[keys[-1]] = value
        return self.save_config()

    def get_section(self, section: str) -> Dict[str, Any]:
        """Get entire configuration section."""
        return self.config.get(section, {})

    def update_section(self, section: str, values: Dict[str, Any]) -> bool:
        """Update entire configuration section."""
        if section not in self.config:
            self.config[section] = {}

        self.config[section].update(values)
        return self.save_config()

    def reset_to_defaults(self) -> bool:
        """Reset configuration to defaults."""
        self.config = self.defaults.copy()
        return self.save_config()

    def validate_config(self) -> List[str]:
        """Validate current configuration."""
        errors = []

        # Validate database settings
        db_config = self.get_section('database')
        if not db_config.get('host'):
            errors.append("Database host is required")
        if not isinstance(db_config.get('port'), int):
            errors.append("Database port must be an integer")

        # Validate processing settings
        proc_config = self.get_section('processing')
        if proc_config.get('batch_size', 0) <= 0:
            errors.append("Batch size must be positive")
        if proc_config.get('timeout', 0) <= 0:
            errors.append("Timeout must be positive")

        return errors

    def _merge_configs(self, base: Dict, override: Dict) -> Dict:
        """Recursively merge configuration dictionaries."""
        result = base.copy()

        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._merge_configs(result[key], value)
            else:
                result[key] = value

        return result

class EnvironmentConfigManager(ConfigManager):
    """Configuration manager that reads from environment variables."""

    def __init__(self):
        super().__init__()
        self.env_prefix = "COMPLEX_SYSTEM_"

    def load_from_env(self):
        """Load configuration from environment variables."""
        for key in os.environ:
            if key.startswith(self.env_prefix):
                config_key = key[len(self.env_prefix):].lower().replace('_', '.')
                value = os.environ[key]

                # Try to parse as JSON, otherwise keep as string
                try:
                    parsed_value = json.loads(value)
                except (json.JSONDecodeError, ValueError):
                    parsed_value = value

                self.set(config_key, parsed_value)

        self.logger.info("Configuration loaded from environment variables")