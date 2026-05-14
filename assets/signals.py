from django.db.models.signals import post_save
from django.dispatch import receiver

from assets.models import Asset


@receiver(post_save, sender=Asset)
def asset_created_notification(sender, instance, created, **kwargs):
    if not created:
        return
    if instance.procurement_request_id:
        return
    from notifications.tasks import create_notification_task
    department = instance.department
    if department:
        create_notification_task.delay(
            title="Asset Approval Required",
            message=f"Asset '{instance.asset_name}' ({instance.asset_code}) requires your approval.",
            notification_type="ASSET_CREATED",
            target_role="DEPARTMENT_ADMIN",
            department_id=department.id,
            related_object_id=instance.id,
            related_object_type="asset",
        )
