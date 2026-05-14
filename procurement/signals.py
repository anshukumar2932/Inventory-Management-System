from django.db.models.signals import pre_save
from django.dispatch import receiver

from procurement.models import ProcurementRequest


@receiver(pre_save, sender=ProcurementRequest)
def procurement_status_changed(sender, instance, **kwargs):
    if not instance.pk:
        return

    try:
        old = ProcurementRequest.objects.get(pk=instance.pk)
    except ProcurementRequest.DoesNotExist:
        return

    if old.approval_status == instance.approval_status:
        return

    if instance.approval_status == "APPROVED":
        instance.assets.all().update(approval_status="APPROVED", status="ACTIVE")
        from notifications.tasks import create_notification_task
        create_notification_task.delay(
            user_id=instance.requested_by.id,
            title="Procurement Approved",
            message=f"Your procurement request {instance.request_number} has been approved.",
        )

    elif instance.approval_status == "REJECTED":
        instance.assets.all().update(approval_status="REJECTED", status="BLOCKED")
        from notifications.tasks import create_notification_task
        msg = f"Your procurement request {instance.request_number} has been rejected."
        if instance.remarks:
            msg += f" Remarks: {instance.remarks}"
        create_notification_task.delay(
            user_id=instance.requested_by.id,
            title="Procurement Rejected",
            message=msg,
        )
