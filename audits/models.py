from django.db import models
from django.conf import settings
from accounts.models import Department
from assets.models import Asset, Location
class AuditSession(models.Model):

    STATUS_CHOICES = (
        ('OPEN', 'Open'),
        ('COMPLETED', 'Completed'),
    )

    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True
    )

    started_at = models.DateTimeField(
        auto_now_add=True
    )

    completed_at = models.DateTimeField(
        null=True,
        blank=True
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='OPEN'
    )

class AuditEntry(models.Model):

    audit_session = models.ForeignKey(
        AuditSession,
        on_delete=models.CASCADE,
        related_name='entries'
    )

    asset = models.ForeignKey(
        Asset,
        on_delete=models.CASCADE
    )

    scanned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True
    )

    scanned_at = models.DateTimeField(
        auto_now_add=True
    )

    expected_location = models.ForeignKey(
        Location,
        on_delete=models.SET_NULL,
        null=True,
        related_name='+'
    )

    actual_location = models.ForeignKey(
        Location,
        on_delete=models.SET_NULL,
        null=True,
        related_name='+'
    )

    remarks = models.TextField(
        blank=True,
        null=True
    )

    is_mismatch = models.BooleanField(
        default=False
    )