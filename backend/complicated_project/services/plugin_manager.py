"""
Plugin management service.

This module demonstrates:
1. Instance attribute aliases: self.attr = SomeClass() where self.attr.method() should be tracked
2. Import aliases: import X as Y or from X import Y as Z
"""

# Import alias examples
from utils.logger import Logger as LogService
from utils.validators import InputValidator as Validator
from utils.config_manager import ConfigManager as CM
import json as json_lib

from models.user import User
from core.data_processor import DataProcessor as DP


class PluginRegistry:
    """Registry that stores class references in instance attributes."""
    
    def __init__(self):
        # These are instance attribute assignments that should be tracked
        self.log_handler = LogService("PluginRegistry")
        self.validator = Validator()
        self.config_handler = CM()
        self.processor = DP()
    
    def register_plugin(self, plugin_name: str, plugin_data: dict):
        """Register a new plugin using aliased services."""
        # Using self.log_handler which is actually Logger
        self.log_handler.info(f"Registering plugin: {plugin_name}")
        
        # Using self.validator which is actually InputValidator
        errors = self.validator.validate_user_input(plugin_data)
        if errors:
            self.log_handler.error(f"Validation failed: {errors}")
            return False
        
        # Using self.config_handler which is actually ConfigManager
        self.config_handler.set_config(f"plugins.{plugin_name}", plugin_data)
        
        return True
    
    def process_plugin_data(self, data: dict):
        """Process plugin data using aliased processor."""
        # Using self.processor which is actually DataProcessor
        result = self.processor.process_data(data)
        self.log_handler.info(f"Processed plugin data: {result}")
        return result


class PluginLoader:
    """Loader that uses import aliases directly."""
    
    def __init__(self):
        # Direct use of import aliases
        self.logger = LogService("PluginLoader")
    
    def load_plugins(self, plugin_path: str):
        """Load plugins from path."""
        self.logger.info(f"Loading plugins from: {plugin_path}")
        
        # Using json_lib which is aliased from json
        config_data = json_lib.dumps({"path": plugin_path})
        
        # Create a user for tracking
        user = User(id=1, name="PluginAdmin")
        self.logger.info(f"Plugin admin: {user.get_display_name()}")
        
        return config_data


class PluginExecutor:
    """Executor that chains multiple aliased services."""
    
    def __init__(self):
        # Multiple instance attribute class assignments
        self.log = LogService("PluginExecutor")
        self.validation_service = Validator()
        self.data_processor = DP()
    
    def execute(self, plugin_name: str, input_data: dict):
        """Execute a plugin with full tracking."""
        self.log.debug(f"Executing plugin: {plugin_name}")
        
        # Using validation service
        if not self.validation_service.validate_email(input_data.get('email', '')):
            self.log.warning("Invalid email in input data")
        
        # Using data processor
        processed = self.data_processor.transform_data(input_data)
        self.log.info(f"Execution complete: {processed}")
        
        return processed
