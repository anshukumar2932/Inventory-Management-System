from django.core.cache import cache
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from assets.services.asset_service import AssetService
from .permissions import IsAuth


@api_view(["GET"])
@permission_classes([IsAuth])
def dashboard_stats(request):
    user = request.user
    cache_key = f"dashboard:stats:{user.id}:{user.role}"
    cached_data = cache.get(cache_key)
    if cached_data is not None:
        return Response(cached_data)
    data = AssetService.get_dashboard_stats(user)
    cache.set(cache_key, data, 300)
    return Response(data)
