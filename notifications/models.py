from django.db import models
from django.conf import settings


class Notification(models.Model):

    NOTIFICATION_TYPES = (
        ('ASSET_CREATED', 'Asset Created'),
        ('ASSET_APPROVED', 'Asset Approved'),
        ('ASSET_REJECTED', 'Asset Rejected'),
        ('PROCUREMENT_CREATED', 'Procurement Created'),
        ('PROCUREMENT_APPROVED', 'Procurement Approved'),
        ('PROCUREMENT_REJECTED', 'Procurement Rejected'),
        ('REPORT_GENERATED', 'Report Generated'),
    )

    CRITICAL_TYPES = frozenset({
        'ASSET_CREATED', 'PROCUREMENT_CREATED', 'REPORT_GENERATED',
    })

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(
        max_length=50,
        choices=NOTIFICATION_TYPES,
        default='ASSET_CREATED',
        db_index=True,
    )
    target_role = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        db_index=True,
    )
    department = models.ForeignKey(
        'accounts.Department',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    related_object_id = models.PositiveIntegerField(null=True, blank=True)
    related_object_type = models.CharField(max_length=50, null=True, blank=True)
    is_read = models.BooleanField(default=False, db_index=True)
    email_sent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=['target_role', 'department']),
            models.Index(fields=['user', 'is_read']),
            models.Index(fields=['notification_type', 'created_at']),
        ]

    def __str__(self):
        username = self.user.username if self.user else f"role:{self.target_role}"
        return f"{username} - {self.title}"


class NotificationPreference(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_preferences",
    )
    notification_type = models.CharField(
        max_length=50,
        choices=Notification.NOTIFICATION_TYPES,
        db_index=True,
    )
    email = models.BooleanField(default=False)
    in_app = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'notification_type']
        ordering = ['notification_type']

    def __str__(self):
        return f"{self.user.username} - {self.notification_type}"
