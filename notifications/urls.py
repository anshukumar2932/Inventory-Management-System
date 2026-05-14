from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import NotificationViewSet, NotificationPreferenceViewSet

router = DefaultRouter()
router.register("", NotificationViewSet, basename="notifications")
router.register("preferences", NotificationPreferenceViewSet, basename="notification-preferences")

urlpatterns = router.urls
