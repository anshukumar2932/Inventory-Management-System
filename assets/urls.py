# URL routing for the assets app
# The DefaultRouter auto-generates list/create/detail/update/delete endpoints
from rest_framework.routers import DefaultRouter
from .views import AssetViewSet, CategoryViewSet, LocationViewSet, VendorViewSet

router = DefaultRouter()
router.register("assets", AssetViewSet)
router.register("categories", CategoryViewSet)
router.register("locations", LocationViewSet)
router.register("vendors", VendorViewSet)

# These get mounted under /api/v1/assets/ in the root URL conf
# So the full path is /api/v1/assets/assets/, /api/v1/assets/categories/, etc.
urlpatterns = router.urls
