from django.db.models import Q, QuerySet
from django.contrib.auth import get_user_model
from accounts.models import Department
from notifications.models import Notification, NotificationPreference

User = get_user_model()


class NotificationQueryService:
    @staticmethod
    def for_user(user) -> QuerySet[Notification]:
        if user.role == "SUPER_ADMIN":
            return Notification.objects.all()
        return Notification.objects.filter(
            Q(user=user) |
            (
                Q(user__isnull=True) &
                Q(target_role=user.role) &
                (Q(department=user.department) | Q(department__isnull=True))
            )
        )

    @staticmethod
    def unread_count(user) -> int:
        return NotificationQueryService.for_user(user).filter(is_read=False).count()

    @staticmethod
    def unread_for_user(user) -> QuerySet[Notification]:
        return NotificationQueryService.for_user(user).filter(is_read=False)


class NotificationActionService:
    @staticmethod
    def mark_read(notification: Notification, user) -> Notification:
        if notification.user and notification.user != user and user.role != "SUPER_ADMIN":
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You can only mark your own notifications as read.")
        notification.is_read = True
        notification.save(update_fields=["is_read"])
        return notification

    @staticmethod
    def mark_all_read(user):
        updated = NotificationQueryService.for_user(user).filter(is_read=False).update(is_read=True)
        return updated

    @staticmethod
    def bulk_mark_read(ids: list[int], user) -> int:
        qs = NotificationQueryService.for_user(user).filter(id__in=ids, is_read=False)
        return qs.update(is_read=True)

    @staticmethod
    def bulk_delete(ids: list[int], user) -> int:
        qs = NotificationQueryService.for_user(user).filter(id__in=ids)
        if user.role != "SUPER_ADMIN":
            qs = qs.filter(Q(user=user) | Q(user__isnull=True))
        count = qs.count()
        qs.delete()
        return count

    @staticmethod
    def can_delete(notification: Notification, user) -> bool:
        if user.role == "SUPER_ADMIN":
            return True
        if notification.user and notification.user != user:
            return False
        return True


class NotificationCreateService:
    @staticmethod
    def create_notification(
        title: str,
        message: str,
        notification_type: str = "ASSET_CREATED",
        user=None,
        target_role: str = None,
        department=None,
        related_object_id: int = None,
        related_object_type: str = None,
    ):
        notif = Notification.objects.create(
            user=user,
            title=title,
            message=message,
            notification_type=notification_type,
            target_role=target_role,
            department=department,
            related_object_id=related_object_id,
            related_object_type=related_object_type,
        )
        return notif


class NotificationPreferenceService:
    @staticmethod
    def get_preferences(user) -> QuerySet[NotificationPreference]:
        return NotificationPreference.objects.filter(user=user)

    @staticmethod
    def update_preference(user, notification_type: str, email: bool = False, in_app: bool = True):
        obj, created = NotificationPreference.objects.update_or_create(
            user=user,
            notification_type=notification_type,
            defaults={"email": email, "in_app": in_app},
        )
        return obj

    @staticmethod
    def should_send_email(user, notification_type: str) -> bool:
        try:
            pref = NotificationPreference.objects.get(user=user, notification_type=notification_type)
            return pref.email
        except NotificationPreference.DoesNotExist:
            return notification_type in Notification.CRITICAL_TYPES
