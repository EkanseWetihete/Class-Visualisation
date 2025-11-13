"""
Performance monitoring utility.
"""

import time
import psutil
import threading
from typing import Dict, List, Any, Callable, Optional
from collections import deque
from datetime import datetime, timedelta
from utils.logger import Logger
from utils.config_manager import ConfigManager

class PerformanceMonitor:
    """Monitor system and application performance."""

    def __init__(self):
        self.logger = Logger("PerformanceMonitor")
        self.config = ConfigManager()
        self.metrics = {}
        self.alerts = []
        self.is_monitoring = False
        self.monitor_thread = None

    def start_monitoring(self):
        """Start performance monitoring."""
        if self.is_monitoring:
            return

        self.is_monitoring = True
        self.monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.monitor_thread.start()
        self.logger.info("Performance monitoring started")

    def stop_monitoring(self):
        """Stop performance monitoring."""
        self.is_monitoring = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=5)
        self.logger.info("Performance monitoring stopped")

    def time_function(self, func_name: str) -> Callable:
        """Decorator to time function execution."""
        def decorator(func):
            def wrapper(*args, **kwargs):
                start_time = time.time()
                try:
                    result = func(*args, **kwargs)
                    execution_time = time.time() - start_time
                    self.record_metric(f"function.{func_name}.execution_time", execution_time)
                    self.record_metric(f"function.{func_name}.calls", 1, metric_type="counter")
                    return result
                except Exception as e:
                    execution_time = time.time() - start_time
                    self.record_metric(f"function.{func_name}.errors", 1, metric_type="counter")
                    self.record_metric(f"function.{func_name}.error_time", execution_time)
                    raise e
            return wrapper
        return decorator

    def record_metric(self, name: str, value: float, metric_type: str = "gauge", tags: Dict[str, str] = None):
        """Record a performance metric."""
        if name not in self.metrics:
            self.metrics[name] = {
                'type': metric_type,
                'values': deque(maxlen=1000),  # Keep last 1000 values
                'tags': tags or {},
                'last_updated': None
            }

        metric = self.metrics[name]
        metric['values'].append({
            'value': value,
            'timestamp': datetime.now()
        })
        metric['last_updated'] = datetime.now()

        # Check thresholds and generate alerts
        self._check_thresholds(name, value)

    def get_metric(self, name: str, time_range: timedelta = None) -> Dict[str, Any]:
        """Get metric data."""
        if name not in self.metrics:
            return None

        metric = self.metrics[name]
        values = list(metric['values'])

        if time_range:
            cutoff = datetime.now() - time_range
            values = [v for v in values if v['timestamp'] > cutoff]

        if not values:
            return None

        numeric_values = [v['value'] for v in values]

        return {
            'name': name,
            'type': metric['type'],
            'count': len(values),
            'current': values[-1]['value'] if values else None,
            'min': min(numeric_values) if numeric_values else None,
            'max': max(numeric_values) if numeric_values else None,
            'avg': sum(numeric_values) / len(numeric_values) if numeric_values else None,
            'tags': metric['tags'],
            'last_updated': metric['last_updated']
        }

    def get_all_metrics(self) -> Dict[str, Dict[str, Any]]:
        """Get all metrics."""
        return {name: self.get_metric(name) for name in self.metrics.keys()}

    def set_threshold(self, metric_name: str, threshold_type: str, value: float, alert_level: str = "warning"):
        """Set performance threshold for alerting."""
        if metric_name not in self.metrics:
            self.metrics[metric_name] = {
                'type': 'gauge',
                'values': deque(maxlen=1000),
                'tags': {},
                'last_updated': None
            }

        metric = self.metrics[metric_name]
        if 'thresholds' not in metric:
            metric['thresholds'] = []

        metric['thresholds'].append({
            'type': threshold_type,  # 'min', 'max', 'avg'
            'value': value,
            'alert_level': alert_level
        })

    def get_alerts(self, since: datetime = None) -> List[Dict[str, Any]]:
        """Get performance alerts."""
        if since:
            return [alert for alert in self.alerts if alert['timestamp'] > since]
        return self.alerts[-100:]  # Last 100 alerts

    def _monitor_loop(self):
        """Main monitoring loop."""
        while self.is_monitoring:
            try:
                # Collect system metrics
                self._collect_system_metrics()

                # Sleep for monitoring interval
                time.sleep(30)  # Monitor every 30 seconds

            except Exception as e:
                self.logger.error(f"Error in monitoring loop: {str(e)}")
                time.sleep(60)  # Wait longer on error

    def _collect_system_metrics(self):
        """Collect system performance metrics."""
        try:
            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)
            self.record_metric("system.cpu.percent", cpu_percent)

            # Memory usage
            memory = psutil.virtual_memory()
            self.record_metric("system.memory.percent", memory.percent)
            self.record_metric("system.memory.used_mb", memory.used / 1024 / 1024)

            # Disk usage
            disk = psutil.disk_usage('/')
            self.record_metric("system.disk.percent", disk.percent)
            self.record_metric("system.disk.free_gb", disk.free / 1024 / 1024 / 1024)

            # Network I/O
            net_io = psutil.net_io_counters()
            self.record_metric("system.network.bytes_sent_mb", net_io.bytes_sent / 1024 / 1024)
            self.record_metric("system.network.bytes_recv_mb", net_io.bytes_recv / 1024 / 1024)

        except Exception as e:
            self.logger.error(f"Failed to collect system metrics: {str(e)}")

    def _check_thresholds(self, metric_name: str, value: float):
        """Check if metric value violates any thresholds."""
        if metric_name not in self.metrics:
            return

        metric = self.metrics[metric_name]
        thresholds = metric.get('thresholds', [])

        for threshold in thresholds:
            violated = False

            if threshold['type'] == 'max' and value > threshold['value']:
                violated = True
            elif threshold['type'] == 'min' and value < threshold['value']:
                violated = True

            if violated:
                alert = {
                    'metric': metric_name,
                    'value': value,
                    'threshold': threshold,
                    'timestamp': datetime.now(),
                    'message': f"Threshold violation: {metric_name} {threshold['type']} {threshold['value']} (current: {value})"
                }

                self.alerts.append(alert)

                # Keep only last 1000 alerts
                if len(self.alerts) > 1000:
                    self.alerts = self.alerts[-1000:]

                # Log alert
                log_level = 'warning' if threshold['alert_level'] == 'warning' else 'error'
                if log_level == 'warning':
                    self.logger.warning(alert['message'])
                else:
                    self.logger.error(alert['message'])

class MetricsExporter:
    """Export metrics to external monitoring systems."""

    def __init__(self, monitor: PerformanceMonitor):
        self.monitor = monitor
        self.logger = Logger("MetricsExporter")

    def export_to_prometheus(self) -> str:
        """Export metrics in Prometheus format."""
        lines = []

        for name, metric_data in self.monitor.get_all_metrics().items():
            if not metric_data:
                continue

            # Convert metric name to Prometheus format
            prom_name = name.replace('.', '_').replace('-', '_')

            # Add metric type
            metric_type = metric_data['type']
            if metric_type == 'counter':
                lines.append(f"# TYPE {prom_name} counter")
            else:
                lines.append(f"# TYPE {prom_name} gauge")

            # Add metric value
            value = metric_data['current']
            if value is not None:
                lines.append(f"{prom_name} {value}")

        return '\n'.join(lines)

    def export_to_json(self) -> str:
        """Export metrics as JSON."""
        return self.monitor.config.get('formatter').to_json(self.monitor.get_all_metrics())

    def export_to_csv(self) -> str:
        """Export metrics as CSV."""
        metrics = self.monitor.get_all_metrics()
        if not metrics:
            return "No metrics available"

        # Header
        header = "metric_name,type,count,current,min,max,avg,last_updated"

        # Data rows
        rows = []
        for name, data in metrics.items():
            if data:
                row = [
                    name,
                    data['type'],
                    str(data['count']),
                    str(data['current'] or ''),
                    str(data['min'] or ''),
                    str(data['max'] or ''),
                    str(data['avg'] or ''),
                    data['last_updated'].isoformat() if data['last_updated'] else ''
                ]
                rows.append(','.join(row))

        return '\n'.join([header] + rows)