"""
Report generation service.
"""

from typing import Dict, List, Any, Optional
from datetime import datetime
import os
from models.report import Report
from models.user import User
from models.data_models import Dataset
from utils.logger import Logger
from utils.formatters import ReportFormatter, CSVFormatter
from utils.config_manager import ConfigManager

class ReportGenerator:
    """Service for generating various types of reports."""

    def __init__(self):
        self.logger = Logger("ReportGenerator")
        self.formatter = ReportFormatter()
        self.csv_formatter = CSVFormatter()
        self.config = ConfigManager()
        self.reports_dir = "reports"

    def generate_report(self, user: User, processed_data: Dict) -> Report:
        """Generate a user-specific report."""
        try:
            self.logger.info(f"Generating report for user {user.id}")

            # Create report data
            report_data = self._compile_report_data(user, processed_data)

            # Create report object
            report = Report(
                title=f"Data Analysis Report - {user.get_display_name()}",
                user=user,
                data=report_data
            )

            # Generate the report
            report.generate()

            # Save report file
            self._save_report_file(report)

            self.logger.info(f"Report generated successfully: {report.id}")
            return report

        except Exception as e:
            self.logger.error(f"Report generation failed: {str(e)}")
            report = Report(
                title=f"Failed Report - {user.get_display_name()}",
                user=user,
                data={'error': str(e)}
            )
            report.mark_as_failed(str(e))
            return report

    def generate_summary_report(self, reports: List[Report]) -> Report:
        """Generate a summary report from multiple reports."""
        try:
            self.logger.info(f"Generating summary report for {len(reports)} reports")

            # Compile summary data
            summary_data = self._compile_summary_data(reports)

            # Create summary report
            summary_report = Report(
                title=f"Summary Report - {datetime.now().strftime('%Y-%m-%d')}",
                data=summary_data
            )

            summary_report.generate()
            self._save_report_file(summary_report)

            self.logger.info("Summary report generated successfully")
            return summary_report

        except Exception as e:
            self.logger.error(f"Summary report generation failed: {str(e)}")
            return None

    def _compile_report_data(self, user: User, processed_data: Dict) -> Dict[str, Any]:
        """Compile comprehensive report data."""
        dataset = processed_data.get('dataset')
        statistics = processed_data.get('statistics', {})

        report_data = {
            'user_info': self.formatter.format_user_summary(user),
            'generation_date': datetime.now().isoformat(),
            'data_summary': {
                'total_points': dataset.total_points if dataset else 0,
                'average_quality': dataset.average_quality if dataset else 0.0,
                'processing_time': processed_data.get('processing_time', 0),
                'status': processed_data.get('status', 'unknown')
            },
            'statistics': statistics,
            'recommendations': self._generate_recommendations(statistics),
            'charts_data': self._prepare_chart_data(dataset) if dataset else {}
        }

        return report_data

    def _compile_summary_data(self, reports: List[Report]) -> Dict[str, Any]:
        """Compile summary data from multiple reports."""
        total_reports = len(reports)
        successful_reports = sum(1 for r in reports if r.status == 'completed')
        failed_reports = total_reports - successful_reports

        # Calculate aggregate statistics
        all_processing_times = []
        all_qualities = []

        for report in reports:
            if report.data and 'data_summary' in report.data:
                summary = report.data['data_summary']
                if 'processing_time' in summary:
                    all_processing_times.append(summary['processing_time'])
                if 'average_quality' in summary:
                    all_qualities.append(summary['average_quality'])

        avg_processing_time = sum(all_processing_times) / len(all_processing_times) if all_processing_times else 0
        avg_quality = sum(all_qualities) / len(all_qualities) if all_qualities else 0

        return {
            'summary': {
                'total_reports': total_reports,
                'successful_reports': successful_reports,
                'failed_reports': failed_reports,
                'success_rate': successful_reports / total_reports if total_reports > 0 else 0
            },
            'performance': {
                'average_processing_time': avg_processing_time,
                'average_data_quality': avg_quality,
                'total_processing_time': sum(all_processing_times)
            },
            'reports': [self.formatter.format_report_summary(r) for r in reports],
            'generated_at': datetime.now().isoformat()
        }

    def _generate_recommendations(self, statistics: Dict) -> List[str]:
        """Generate recommendations based on statistics."""
        recommendations = []

        avg_quality = statistics.get('average_quality', 0)
        if avg_quality < 0.5:
            recommendations.append("Consider improving data quality - current average is below 50%")
        elif avg_quality > 0.9:
            recommendations.append("Excellent data quality maintained")

        count = statistics.get('count', 0)
        if count < 10:
            recommendations.append("Limited data points - consider collecting more data")
        elif count > 1000:
            recommendations.append("Large dataset detected - consider optimizing processing")

        return recommendations

    def _prepare_chart_data(self, dataset: Dataset) -> Dict[str, Any]:
        """Prepare data for charts and visualizations."""
        if not dataset or not dataset.points:
            return {}

        # Prepare time series data
        time_series = []
        quality_over_time = []

        for point in dataset.points[:50]:  # Limit to first 50 points for performance
            time_series.append({
                'timestamp': point.timestamp.isoformat(),
                'value': point.value
            })
            quality_over_time.append({
                'timestamp': point.timestamp.isoformat(),
                'quality': point.quality_score
            })

        return {
            'time_series': time_series,
            'quality_trend': quality_over_time,
            'distribution': self._calculate_distribution(dataset)
        }

    def _calculate_distribution(self, dataset: Dataset) -> Dict[str, int]:
        """Calculate value distribution for histogram."""
        distribution = {}
        for point in dataset.points:
            if isinstance(point.value, (int, float)):
                # Create bins
                bin_value = round(point.value, 1)
                distribution[str(bin_value)] = distribution.get(str(bin_value), 0) + 1

        return distribution

    def _save_report_file(self, report: Report):
        """Save report to file system."""
        try:
            os.makedirs(self.reports_dir, exist_ok=True)

            # Save as JSON
            json_file = os.path.join(self.reports_dir, f"{report.id}.json")
            with open(json_file, 'w') as f:
                f.write(report.export_to_json())

            # Save as CSV if applicable
            if report.data and 'charts_data' in report.data:
                csv_file = os.path.join(self.reports_dir, f"{report.id}.csv")
                self._save_csv_report(report, csv_file)

            self.logger.debug(f"Report files saved for report {report.id}")

        except Exception as e:
            self.logger.error(f"Failed to save report files: {str(e)}")

    def _save_csv_report(self, report: Report, filename: str):
        """Save report data as CSV."""
        try:
            charts_data = report.data.get('charts_data', {})

            if 'time_series' in charts_data:
                with open(filename, 'w') as f:
                    # Write header
                    f.write("timestamp,value,quality\n")

                    # Write data
                    for point in charts_data['time_series']:
                        f.write(f"{point['timestamp']},{point['value']},\n")

        except Exception as e:
            self.logger.error(f"Failed to save CSV report: {str(e)}")

    def get_report(self, report_id: int) -> Optional[Report]:
        """Retrieve a report by ID."""
        try:
            json_file = os.path.join(self.reports_dir, f"{report_id}.json")
            if os.path.exists(json_file):
                with open(json_file, 'r') as f:
                    data = json.load(f)
                    # Reconstruct report object
                    report = Report(
                        id=report_id,
                        title=data.get('title'),
                        data=data
                    )
                    return report
        except Exception as e:
            self.logger.error(f"Failed to load report {report_id}: {str(e)}")

        return None