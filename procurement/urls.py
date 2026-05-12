from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProcurementViewSet, approve_email, reject_email

router = DefaultRouter()
router.register("", ProcurementViewSet)

urlpatterns = [
    path("", include(router.urls)),
    path("approve-email/<uuid:token>/", approve_email, name="approve-email"),
    path("reject-email/<uuid:token>/", reject_email, name="reject-email"),
]
