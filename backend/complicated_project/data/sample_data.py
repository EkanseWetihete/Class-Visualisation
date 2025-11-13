"""
Test data for the complex system.
"""

# Sample user data
SAMPLE_USERS = [
    {
        "id": 1,
        "name": "Alice Johnson",
        "email": "alice.johnson@example.com",
        "raw_data": {
            "data_points": [
                {"value": 85.5, "timestamp": "2024-01-01T10:00:00", "source": "sensor_a"},
                {"value": 92.3, "timestamp": "2024-01-01T11:00:00", "source": "sensor_a"},
                {"value": 78.9, "timestamp": "2024-01-01T12:00:00", "source": "sensor_a"},
                {"value": 88.1, "timestamp": "2024-01-01T13:00:00", "source": "sensor_a"},
                {"value": 95.7, "timestamp": "2024-01-01T14:00:00", "source": "sensor_a"}
            ]
        },
        "is_active": True,
        "role": "user"
    },
    {
        "id": 2,
        "name": "Bob Smith",
        "email": "bob.smith@example.com",
        "raw_data": {
            "data_points": [
                {"value": 45.2, "timestamp": "2024-01-02T09:00:00", "source": "sensor_b"},
                {"value": 52.8, "timestamp": "2024-01-02T10:00:00", "source": "sensor_b"},
                {"value": 48.9, "timestamp": "2024-01-02T11:00:00", "source": "sensor_b"},
                {"value": 61.3, "timestamp": "2024-01-02T12:00:00", "source": "sensor_b"}
            ]
        },
        "is_active": True,
        "role": "admin"
    },
    {
        "id": 3,
        "name": "Charlie Brown",
        "email": "charlie.brown@example.com",
        "raw_data": {
            "data_points": [
                {"value": 120.5, "timestamp": "2024-01-03T08:00:00", "source": "sensor_c"},
                {"value": 115.8, "timestamp": "2024-01-03T09:00:00", "source": "sensor_c"},
                {"value": 118.2, "timestamp": "2024-01-03T10:00:00", "source": "sensor_c"},
                {"value": 122.1, "timestamp": "2024-01-03T11:00:00", "source": "sensor_c"},
                {"value": 119.7, "timestamp": "2024-01-03T12:00:00", "source": "sensor_c"},
                {"value": 121.3, "timestamp": "2024-01-03T13:00:00", "source": "sensor_c"}
            ]
        },
        "is_active": False,
        "role": "user"
    }
]

# Sample configuration
DEFAULT_CONFIG = {
    "database": {
        "host": "localhost",
        "port": 5432,
        "name": "complex_system_db",
        "user": "system_user",
        "password": "secure_password"
    },
    "logging": {
        "level": "INFO",
        "max_file_size": 10485760,
        "backup_count": 5,
        "log_to_console": True
    },
    "processing": {
        "batch_size": 100,
        "timeout": 300,
        "max_retries": 3,
        "min_quality": 0.3,
        "scale_factor": 1.0
    },
    "notifications": {
        "email_enabled": True,
        "sms_enabled": False,
        "webhook_url": "https://api.example.com/webhooks/notifications",
        "email_sender": "system@complexsystem.com"
    },
    "security": {
        "session_timeout": 3600,
        "password_min_length": 8,
        "max_login_attempts": 5,
        "require_2fa": False
    },
    "reports": {
        "auto_generate": True,
        "retention_days": 90,
        "max_reports_per_user": 100
    }
}

# Sample report templates
REPORT_TEMPLATES = {
    "user_summary": {
        "title": "User Data Summary Report",
        "sections": ["user_info", "data_summary", "statistics", "recommendations"],
        "format": "pdf"
    },
    "system_health": {
        "title": "System Health Report",
        "sections": ["performance", "errors", "usage", "recommendations"],
        "format": "html"
    },
    "batch_processing": {
        "title": "Batch Processing Summary",
        "sections": ["summary", "performance", "errors", "trends"],
        "format": "json"
    }
}

# Error messages
ERROR_MESSAGES = {
    "user_not_found": "The specified user could not be found in the system.",
    "invalid_data": "The provided data does not meet validation requirements.",
    "processing_failed": "Data processing failed due to an internal error.",
    "report_generation_failed": "Unable to generate the requested report.",
    "notification_failed": "Failed to send notification to the user.",
    "authentication_failed": "Invalid credentials provided.",
    "authorization_failed": "You do not have permission to perform this action.",
    "system_overload": "The system is currently experiencing high load. Please try again later."
}

# Performance benchmarks
PERFORMANCE_THRESHOLDS = {
    "max_processing_time": 60.0,  # seconds
    "min_success_rate": 0.95,     # 95%
    "max_error_rate": 0.05,       # 5%
    "target_response_time": 2.0   # seconds
}