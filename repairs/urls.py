# Repair tickets live under their own API namespace
from rest_framework.routers import DefaultRouter
from .views import RepairViewSet

router = DefaultRouter()
router.register("repairs", RepairViewSet)

urlpatterns = router.urls
