from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from procurement.models import ProcurementRequest


@receiver(post_save, sender=ProcurementRequest)
def procurement_created_notification(sender, instance, created, **kwargs):
    if not created:
        return
    from notifications.tasks import create_notification_task
    department = instance.department
    if department:
        create_notification_task.delay(
            title="New Procurement Request",
            message=f"Procurement request {instance.request_number} requires your review.",
            notification_type="PROCUREMENT_CREATED",
            target_role="DEPARTMENT_ADMIN",
            department_id=department.id,
            related_object_id=instance.id,
            related_object_type="procurement",
        )


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

    from notifications.tasks import create_notification_task

    if instance.approval_status == "APPROVED":
        instance.assets.all().update(approval_status="APPROVED", status="ACTIVE")
        create_notification_task.delay(
            user_id=instance.requested_by.id,
            title="Procurement Approved",
            message=f"Your procurement request {instance.request_number} has been approved.",
            notification_type="PROCUREMENT_APPROVED",
            related_object_id=instance.id,
            related_object_type="procurement",
        )

    elif instance.approval_status == "REJECTED":
        instance.assets.all().update(approval_status="REJECTED", status="BLOCKED")
        msg = f"Your procurement request {instance.request_number} has been rejected."
        if instance.remarks:
            msg += f" Remarks: {instance.remarks}"
        create_notification_task.delay(
            user_id=instance.requested_by.id,
            title="Procurement Rejected",
            message=msg,
            notification_type="PROCUREMENT_REJECTED",
            related_object_id=instance.id,
            related_object_type="procurement",
        )
