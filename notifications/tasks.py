from celery import shared_task
from django.contrib.auth import get_user_model
from django.conf import settings
from django.utils import timezone
from datetime import timedelta

from domains.notification_management.services import (
    NotificationCreateService,
    NotificationPreferenceService,
)

User = get_user_model()


@shared_task
def create_notification_task(
    title,
    message,
    notification_type="ASSET_CREATED",
    user_id=None,
    target_role=None,
    department_id=None,
    related_object_id=None,
    related_object_type=None,
):
    from accounts.models import Department
    from notifications.models import Notification

    user = None
    if user_id:
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return f"User {user_id} not found"

    department = None
    if department_id:
        try:
            department = Department.objects.get(id=department_id)
        except Department.DoesNotExist:
            return f"Department {department_id} not found"

    notif = NotificationCreateService.create_notification(
        title=title,
        message=message,
        notification_type=notification_type,
        user=user,
        target_role=target_role,
        department=department,
        related_object_id=related_object_id,
        related_object_type=related_object_type,
    )

    target = user.username if user else f"role:{target_role}"

    if user and notification_type in Notification.CRITICAL_TYPES:
        if NotificationPreferenceService.should_send_email(user, notification_type):
            send_notification_email.delay(
                notification_id=notif.id,
                user_id=user.id,
                title=title,
                message=message,
            )

    return f"Notification '{notif.id}' created for {target}"


@shared_task
def send_notification_email(notification_id, user_id, title, message):
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return

    if not user.email or not settings.EMAIL_HOST_USER:
        return

    import smtplib
    from email.mime.text import MIMEText

    msg = MIMEText(
        f"Notification: {title}\n\n{message}\n\n---\nInventory Management System",
    )
    msg["Subject"] = f"[Inventory] {title}"
    msg["From"] = settings.EMAIL_HOST_USER
    msg["To"] = user.email

    try:
        with smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.EMAIL_HOST_USER, settings.EMAIL_HOST_PASSWORD)
            server.send_message(msg)
        from notifications.models import Notification
        Notification.objects.filter(id=notification_id).update(email_sent=True)
    except Exception:
        import logging
        logger = logging.getLogger(__name__)
        logger.exception(f"Failed to send notification email to {user.email}")


@shared_task
def clean_old_notifications(days=90):
    cutoff = timezone.now() - timedelta(days=days)
    from notifications.models import Notification
    qs = Notification.objects.filter(created_at__lt=cutoff)
    count = qs.count()
    qs.delete()
    return f"Deleted {count} notifications older than {days} days"
