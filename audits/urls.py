from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AuditSessionViewSet

router = DefaultRouter()
router.register('sessions', AuditSessionViewSet, basename='audit-sessions')

urlpatterns = [
    path('', include(router.urls)),
]
