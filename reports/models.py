import uuid
from django.db import models
from django.conf import settings


class Report(models.Model):

    REPORT_TYPES = (
        ('WEEKLY', 'Weekly Executive Report'),
        ('ASSET', 'Asset Report'),
        ('PROCUREMENT', 'Procurement Report'),
        ('REPAIR', 'Repair Report'),
        ('AUDIT', 'Audit Report'),
    )

    STATUS_CHOICES = (
        ('GENERATING', 'Generating'),
        ('READY', 'Ready'),
        ('FAILED', 'Failed'),
    )

    title = models.CharField(max_length=255)
    report_type = models.CharField(max_length=50, choices=REPORT_TYPES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='READY')
    version = models.CharField(max_length=10, default='1.0')
    download_token = models.UUIDField(default=uuid.uuid4, editable=False, db_index=True)
    department = models.ForeignKey(
        'accounts.Department', on_delete=models.SET_NULL,
        null=True, blank=True,
    )
    pdf_data = models.BinaryField(blank=True, null=True, editable=False)
    excel_data = models.BinaryField(blank=True, null=True, editable=False)
    chart_data = models.BinaryField(blank=True, null=True, editable=False)
    chart_cleared = models.BooleanField(default=False)
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    summary_data = models.JSONField(default=dict, blank=True)
    is_scheduled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def clear_chart(self):
        self.chart_data = None
        self.chart_cleared = True
        self.save(update_fields=['chart_data', 'chart_cleared'])

    @property
    def chart_expired(self):
        from django.conf import settings
        from django.utils import timezone
        from datetime import timedelta
        if self.chart_cleared:
            return True
        expiry = timedelta(hours=settings.CHART_EXPIRY_HOURS)
        return timezone.now() - self.created_at > expiry

    def __str__(self):
        return f"{self.get_report_type_display()} - {self.created_at.date()}"
