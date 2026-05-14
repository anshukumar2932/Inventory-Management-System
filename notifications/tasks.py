from celery import shared_task
from django.contrib.auth import get_user_model


@shared_task
def create_notification_task(user_id, title, message):
    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return f"User {user_id} not found"

    from .models import Notification
    Notification.objects.create(
        user=user,
        title=title,
        message=message,
    )
    return f"Notification created for user {user_id}"
