from django.db.models.signals import post_save
from django.dispatch import receiver

from assets.models import Asset


@receiver(post_save, sender=Asset)
def asset_created_notification(sender, instance, created, **kwargs):
    if not created:
        return
    from notifications.tasks import create_notification_task
    department = instance.department
    if department:
        from accounts.models import User
        admins = User.objects.filter(department=department, role="DEPARTMENT_ADMIN")
        for admin in admins:
            create_notification_task.delay(
                user_id=admin.id,
                title="New Asset Added",
                message=f"Asset '{instance.asset_name}' ({instance.asset_code}) was added to your department.",
            )
