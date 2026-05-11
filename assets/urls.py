from rest_framework.routers import DefaultRouter
from .views import AssetViewSet, CategoryViewSet, LocationViewSet, VendorViewSet

router = DefaultRouter()
router.register("assets", AssetViewSet)
router.register("categories", CategoryViewSet)
router.register("locations", LocationViewSet)
router.register("vendors", VendorViewSet)

urlpatterns = router.urls
