# URL routing for the assets app
# The DefaultRouter auto-generates list/create/detail/update/delete endpoints
from rest_framework.routers import DefaultRouter
from .views.asset_views import AssetViewSet
from .views.category_views import CategoryViewSet
from .views.location_views import LocationViewSet
from .views.document_views import DocumentViewSet
from .views.service_views import ServiceTypeViewSet, AssetServiceViewSet, AvailabilityViewSet

router = DefaultRouter()
router.register("assets", AssetViewSet)
router.register("categories", CategoryViewSet)
router.register("locations", LocationViewSet)
router.register("documents", DocumentViewSet)
router.register("service-types", ServiceTypeViewSet)
router.register("availabilities", AvailabilityViewSet)
router.register("asset-services", AssetServiceViewSet)

# These get mounted under /api/v1/assets/ in the root URL conf
# So the full path is /api/v1/assets/assets/, /api/v1/assets/categories/, etc.
urlpatterns = router.urls
