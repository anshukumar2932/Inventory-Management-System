from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q

from .models import Notification, NotificationPreference
from .serializers import NotificationSerializer, NotificationPreferenceSerializer
from domains.notification_management.services import (
    NotificationQueryService,
    NotificationActionService,
    NotificationPreferenceService,
)


class IsAuthNotification(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated


class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthNotification]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = {
        'notification_type': ['exact', 'in'],
        'is_read': ['exact'],
    }
    ordering = ['-created_at']

    def get_queryset(self):
        return NotificationQueryService.for_user(self.request.user)

    def list(self, request, *args, **kwargs):
        try:
            return super().list(request, *args, **kwargs)
        except Exception as e:
            return Response(
                {"detail": "Failed to fetch notifications", "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def perform_destroy(self, instance):
        if not NotificationActionService.can_delete(instance, self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You can only delete your own notifications.")
        instance.delete()

    @action(detail=False, methods=["GET"])
    def count(self, request):
        count = NotificationQueryService.unread_count(request.user)
        return Response({"count": count})

    @action(detail=False, methods=["POST"])
    def mark_all_read(self, request):
        updated = NotificationActionService.mark_all_read(request.user)
        return Response({"message": f"{updated} notifications marked as read"})

    @action(detail=True, methods=["POST"])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        NotificationActionService.mark_read(notification, request.user)
        return Response({"message": "Notification marked as read"})

    @action(detail=False, methods=["POST"])
    def bulk_mark_read(self, request):
        ids = request.data.get("ids", [])
        if not ids:
            return Response({"error": "No ids provided"}, status=status.HTTP_400_BAD_REQUEST)
        updated = NotificationActionService.bulk_mark_read(ids, request.user)
        return Response({"message": f"{updated} notifications marked as read"})

    @action(detail=False, methods=["POST"])
    def bulk_delete(self, request):
        ids = request.data.get("ids", [])
        if not ids:
            return Response({"error": "No ids provided"}, status=status.HTTP_400_BAD_REQUEST)
        count = NotificationActionService.bulk_delete(ids, request.user)
        return Response({"message": f"{count} notifications deleted"})


class NotificationPreferenceViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationPreferenceSerializer
    permission_classes = [IsAuthNotification]

    def get_queryset(self):
        return NotificationPreferenceService.get_preferences(self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=["POST"])
    def bulk_update(self, request):
        prefs = request.data.get("preferences", [])
        user = request.user
        updated = []
        for p in prefs:
            obj = NotificationPreferenceService.update_preference(
                user,
                p["notification_type"],
                email=p.get("email", False),
                in_app=p.get("in_app", True),
            )
            updated.append(NotificationPreferenceSerializer(obj).data)
        return Response(updated)
