from celery import shared_task
from django.conf import settings
from django.utils import timezone
from datetime import timedelta

from .models import Report
from .services import generate_weekly_report


@shared_task
def generate_scheduled_weekly_report():
    report = generate_weekly_report(user=None)
    from .email_service import send_report_email
    emailed = send_report_email(report)
    return f"Weekly report #{report.id} generated: {report.title} | Emailed: {emailed}"


@shared_task
def clear_expired_charts():
    from datetime import timedelta
    cutoff = timezone.now() - timedelta(hours=settings.CHART_EXPIRY_HOURS)
    qs = Report.objects.filter(
        created_at__lt=cutoff,
        chart_cleared=False,
        chart_data__isnull=False,
    )
    count = qs.count()
    for report in qs:
        report.clear_chart()
    return f"Cleared charts for {count} reports"


@shared_task
def delete_old_reports():
    cutoff = timezone.now() - timedelta(days=30 * settings.REPORT_RETENTION_MONTHS)
    qs = Report.objects.filter(created_at__lt=cutoff)
    count = qs.count()
    qs.delete()
    return f"Deleted {count} reports older than {settings.REPORT_RETENTION_MONTHS} months"
