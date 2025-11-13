"""
Main entry point for the Complex Data Processing System.
This system processes user data, generates reports, and manages notifications.
"""

import sys
import os
from datetime import datetime
from core.data_processor import DataProcessor
from core.user_manager import UserManager
from services.report_generator import ReportGenerator
from services.notification_service import NotificationService
from utils.logger import Logger
from utils.config_manager import ConfigManager
from models.user import User
from models.report import Report

class Application:
    """Main application class that orchestrates all components."""

    def __init__(self):
        self.logger = Logger()
        self.config = ConfigManager()
        self.data_processor = DataProcessor()
        self.user_manager = UserManager()
        self.report_generator = ReportGenerator()
        self.notification_service = NotificationService()

    def initialize(self):
        """Initialize all system components."""
        self.logger.info("Initializing Complex Data Processing System")
        self.config.load_config()
        self.data_processor.initialize()
        self.user_manager.initialize()
        self.logger.info("System initialization complete")

    def process_user_data(self, user_id: int):
        """Process data for a specific user."""
        try:
            user = self.user_manager.get_user(user_id)
            if not user:
                self.logger.error(f"User {user_id} not found")
                return None

            processed_data = self.data_processor.process(user.raw_data)
            report = self.report_generator.generate_report(user, processed_data)

            self.notification_service.send_notification(
                user,
                f"Your report is ready: {report.title}"
            )

            self.logger.info(f"Successfully processed data for user {user_id}")
            return report

        except Exception as e:
            self.logger.error(f"Error processing user data: {str(e)}")
            return None

    def run_batch_processing(self):
        """Run batch processing for all active users."""
        active_users = self.user_manager.get_active_users()
        results = []

        for user in active_users:
            result = self.process_user_data(user.id)
            if result:
                results.append(result)

        summary_report = self.report_generator.generate_summary_report(results)
        self.logger.info(f"Batch processing complete. Processed {len(results)} users")
        return summary_report

def main():
    """Main entry point."""
    app = Application()
    app.initialize()

    if len(sys.argv) > 1:
        if sys.argv[1] == "batch":
            app.run_batch_processing()
        elif sys.argv[1].isdigit():
            user_id = int(sys.argv[1])
            app.process_user_data(user_id)
    else:
        print("Usage: python start.py [user_id|batch]")

if __name__ == "__main__":
    main()
