"""
Notification service for sending alerts and messages.
"""

from typing import Dict, List, Any, Optional
from datetime import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import requests
import json
from models.user import User
from utils.logger import Logger
from utils.config_manager import ConfigManager
from utils.formatters import DataFormatter

class NotificationService:
    """Service for handling various types of notifications."""

    def __init__(self):
        self.logger = Logger("NotificationService")
        self.config = ConfigManager()
        self.formatter = DataFormatter()
        self.notification_history = []

    def send_notification(self, user: User, message: str, notification_type: str = "info") -> bool:
        """Send a notification to a user."""
        try:
            self.logger.info(f"Sending {notification_type} notification to user {user.id}")

            # Determine notification channels based on user preferences and config
            channels = self._get_notification_channels(user, notification_type)

            success = False

            # Send via configured channels
            if 'email' in channels and self.config.get('notifications.email_enabled', True):
                if self._send_email_notification(user, message, notification_type):
                    success = True

            if 'sms' in channels and self.config.get('notifications.sms_enabled', False):
                if self._send_sms_notification(user, message):
                    success = True

            if 'webhook' in channels:
                webhook_url = self.config.get('notifications.webhook_url')
                if webhook_url and self._send_webhook_notification(user, message, notification_type):
                    success = True

            # Log notification
            self._log_notification(user, message, notification_type, success)

            if success:
                self.logger.info(f"Notification sent successfully to user {user.id}")
            else:
                self.logger.warning(f"Failed to send notification to user {user.id}")

            return success

        except Exception as e:
            self.logger.error(f"Notification sending failed: {str(e)}")
            return False

    def send_bulk_notification(self, users: List[User], message: str, notification_type: str = "info") -> Dict[str, int]:
        """Send notification to multiple users."""
        results = {'successful': 0, 'failed': 0}

        for user in users:
            if self.send_notification(user, message, notification_type):
                results['successful'] += 1
            else:
                results['failed'] += 1

        self.logger.info(f"Bulk notification completed: {results['successful']} successful, {results['failed']} failed")
        return results

    def send_system_alert(self, alert_message: str, severity: str = "warning"):
        """Send system-wide alert to administrators."""
        # In a real system, this would get admin users and send alerts
        self.logger.warning(f"SYSTEM ALERT ({severity}): {alert_message}")

        # For now, just log it - in production this would notify admins
        return True

    def _get_notification_channels(self, user: User, notification_type: str) -> List[str]:
        """Determine which notification channels to use for a user."""
        channels = []

        # Check user preferences
        preferences = user.preferences.get('notifications', {})

        # Default channels based on type
        if notification_type in ['error', 'alert']:
            channels.extend(['email'])  # Critical notifications always go to email
        elif notification_type == 'report':
            channels.extend(['email'])
        else:
            channels.extend(['email'])  # Default to email

        # Override with user preferences
        if preferences.get('email_enabled', True):
            if 'email' not in channels:
                channels.append('email')

        if preferences.get('sms_enabled', False):
            channels.append('sms')

        return channels

    def _send_email_notification(self, user: User, message: str, notification_type: str) -> bool:
        """Send email notification."""
        try:
            # Email configuration
            smtp_server = self.config.get('email.smtp_server', 'smtp.gmail.com')
            smtp_port = self.config.get('email.smtp_port', 587)
            sender_email = self.config.get('email.sender', 'system@complexsystem.com')
            sender_password = self.config.get('email.password', '')

            # Create message
            msg = MIMEMultipart()
            msg['From'] = sender_email
            msg['To'] = user.email
            msg['Subject'] = f"Complex System - {notification_type.title()} Notification"

            # Email body
            body = self._format_email_body(user, message, notification_type)
            msg.attach(MIMEText(body, 'html'))

            # Send email (commented out for demo - would need real SMTP setup)
            # server = smtplib.SMTP(smtp_server, smtp_port)
            # server.starttls()
            # server.login(sender_email, sender_password)
            # server.send_message(msg)
            # server.quit()

            self.logger.debug(f"Email notification sent to {user.email}")
            return True

        except Exception as e:
            self.logger.error(f"Email sending failed: {str(e)}")
            return False

    def _send_sms_notification(self, user: User, message: str) -> bool:
        """Send SMS notification."""
        try:
            # SMS configuration
            sms_api_url = self.config.get('sms.api_url')
            sms_api_key = self.config.get('sms.api_key')

            if not sms_api_url or not sms_api_key:
                self.logger.warning("SMS not configured")
                return False

            # Get user's phone number (assuming it's stored in preferences)
            phone_number = user.preferences.get('phone_number')
            if not phone_number:
                return False

            # Send SMS (mock implementation)
            payload = {
                'to': phone_number,
                'message': message,
                'api_key': sms_api_key
            }

            # response = requests.post(sms_api_url, json=payload)
            # return response.status_code == 200

            self.logger.debug(f"SMS notification sent to {phone_number}")
            return True

        except Exception as e:
            self.logger.error(f"SMS sending failed: {str(e)}")
            return False

    def _send_webhook_notification(self, user: User, message: str, notification_type: str) -> bool:
        """Send webhook notification."""
        try:
            webhook_url = self.config.get('notifications.webhook_url')
            if not webhook_url:
                return False

            payload = {
                'user_id': user.id,
                'user_name': user.name,
                'message': message,
                'type': notification_type,
                'timestamp': datetime.now().isoformat()
            }

            # response = requests.post(webhook_url, json=payload)
            # return response.status_code == 200

            self.logger.debug(f"Webhook notification sent to {webhook_url}")
            return True

        except Exception as e:
            self.logger.error(f"Webhook sending failed: {str(e)}")
            return False

    def _format_email_body(self, user: User, message: str, notification_type: str) -> str:
        """Format email body as HTML."""
        colors = {
            'info': '#2196F3',
            'warning': '#FF9800',
            'error': '#F44336',
            'success': '#4CAF50',
            'report': '#9C27B0'
        }

        color = colors.get(notification_type, '#2196F3')

        return f"""
        <html>
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h2 style="color: {color}; margin-top: 0;">Complex System Notification</h2>
                <p><strong>Hello {user.get_display_name()},</strong></p>
                <div style="background: #f8f9fa; padding: 15px; border-left: 4px solid {color}; margin: 20px 0;">
                    {message}
                </div>
                <p style="color: #666; font-size: 12px;">
                    This is an automated message from Complex Data Processing System.<br>
                    Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
                </p>
            </div>
        </body>
        </html>
        """

    def _log_notification(self, user: User, message: str, notification_type: str, success: bool):
        """Log notification for audit purposes."""
        notification_record = {
            'user_id': user.id,
            'user_email': user.email,
            'message': message,
            'type': notification_type,
            'success': success,
            'timestamp': datetime.now().isoformat()
        }

        self.notification_history.append(notification_record)

        # Keep only last 1000 notifications
        if len(self.notification_history) > 1000:
            self.notification_history = self.notification_history[-1000:]

    def get_notification_history(self, user_id: Optional[int] = None, limit: int = 50) -> List[Dict]:
        """Get notification history."""
        history = self.notification_history

        if user_id:
            history = [n for n in history if n['user_id'] == user_id]

        return history[-limit:]

    def get_notification_stats(self) -> Dict[str, Any]:
        """Get notification statistics."""
        total = len(self.notification_history)
        successful = sum(1 for n in self.notification_history if n['success'])
        failed = total - successful

        # Group by type
        type_counts = {}
        for notification in self.notification_history:
            n_type = notification['type']
            type_counts[n_type] = type_counts.get(n_type, 0) + 1

        return {
            'total_notifications': total,
            'successful': successful,
            'failed': failed,
            'success_rate': successful / total if total > 0 else 0,
            'by_type': type_counts
        }