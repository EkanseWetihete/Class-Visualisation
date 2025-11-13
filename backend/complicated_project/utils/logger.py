"""
Logging utility for the system.
"""

import logging
import os
from datetime import datetime
from typing import Dict, Any
from utils.formatters import DataFormatter

class Logger:
    """Centralized logging utility."""

    def __init__(self, name: str = "ComplexSystem"):
        self.logger = logging.getLogger(name)
        self.formatter = DataFormatter()

        if not self.logger.handlers:
            self._setup_logger()

    def _setup_logger(self):
        """Setup logger configuration."""
        self.logger.setLevel(logging.INFO)

        # Console handler
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        console_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        console_handler.setFormatter(console_formatter)
        self.logger.addHandler(console_handler)

        # File handler
        log_dir = "logs"
        if not os.path.exists(log_dir):
            os.makedirs(log_dir)

        file_handler = logging.FileHandler(
            f"{log_dir}/system_{datetime.now().strftime('%Y%m%d')}.log"
        )
        file_handler.setLevel(logging.DEBUG)
        file_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s'
        )
        file_handler.setFormatter(file_formatter)
        self.logger.addHandler(file_handler)

    def info(self, message: str, extra: Dict[str, Any] = None):
        """Log info message."""
        self.logger.info(message, extra=extra)

    def error(self, message: str, extra: Dict[str, Any] = None):
        """Log error message."""
        self.logger.error(message, extra=extra)

    def warning(self, message: str, extra: Dict[str, Any] = None):
        """Log warning message."""
        self.logger.warning(message, extra=extra)

    def debug(self, message: str, extra: Dict[str, Any] = None):
        """Log debug message."""
        self.logger.debug(message, extra=extra)

    def log_performance(self, operation: str, duration: float):
        """Log performance metrics."""
        self.info(f"Performance: {operation} took {duration:.2f}s")

    def log_user_action(self, user_id: int, action: str, details: Dict = None):
        """Log user actions."""
        message = f"User {user_id} performed: {action}"
        if details:
            message += f" - {self.formatter.to_json(details)}"
        self.info(message)

class AuditLogger(Logger):
    """Specialized logger for audit trails."""

    def __init__(self):
        super().__init__("AuditLogger")
        self.audit_file = f"logs/audit_{datetime.now().strftime('%Y%m%d')}.log"

    def log_security_event(self, event: str, user_id: int = None, details: Dict = None):
        """Log security-related events."""
        message = f"SECURITY: {event}"
        if user_id:
            message += f" - User: {user_id}"
        if details:
            message += f" - {self.formatter.to_json(details)}"

        # Write to audit log
        with open(self.audit_file, 'a') as f:
            timestamp = datetime.now().isoformat()
            f.write(f"{timestamp} - {message}\n")

        self.logger.warning(message)

    def log_data_access(self, user_id: int, resource: str, action: str):
        """Log data access events."""
        self.log_security_event(
            f"Data access: {action} on {resource}",
            user_id=user_id
        )