import uuid
from django.db import models
from django.conf import settings


class ProcurementRequest(models.Model):

    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    )

    request_number = models.CharField(max_length=50, unique=True)
    department = models.ForeignKey(
        'accounts.Department',
        on_delete=models.CASCADE
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='procurement_requests'
    )
    approval_status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING'
    )
    remarks = models.TextField(blank=True, null=True)
    approval_token = models.UUIDField(
        default=uuid.uuid4,
        editable=False,
        unique=True
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='approved_requests'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.request_number

    def save(self, *args, **kwargs):
        if not self.request_number:
            last = ProcurementRequest.objects.order_by("-id").first()
            num = (last.id + 1) if last else 1
            self.request_number = f"PR-{num:04d}"
        super().save(*args, **kwargs)
