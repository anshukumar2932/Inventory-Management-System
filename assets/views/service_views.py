from rest_framework import viewsets
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from assets.models import ServiceType, AssetService, Availability
from assets.serializers import ServiceTypeSerializer, AssetServiceSerializer, AvailabilitySerializer

from .permissions import IsAuth, IsSuperAdmin, IsManagerOrAbove


class ServiceTypeViewSet(viewsets.ModelViewSet):
    queryset = ServiceType.objects.all()
    serializer_class = ServiceTypeSerializer
    permission_classes = [IsAuth]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['department']

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsSuperAdmin()]
        return [IsAuth()]


class AvailabilityViewSet(viewsets.ModelViewSet):
    queryset = Availability.objects.all()
    serializer_class = AvailabilitySerializer
    permission_classes = [IsAuth]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['name']


class AssetServiceViewSet(viewsets.ModelViewSet):
    queryset = AssetService.objects.none()
    serializer_class = AssetServiceSerializer
    permission_classes = [IsAuth]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['asset', 'service_type', 'status', 'provider']

    def get_queryset(self):
        qs = AssetService.objects.select_related('service_type', 'provider', 'asset')
        user = self.request.user
        if user.role == "SUPER_ADMIN":
            return qs.all()
        if user.department:
            return qs.filter(asset__department=user.department)
        return qs.none()

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsManagerOrAbove()]
        return [IsAuth()]
