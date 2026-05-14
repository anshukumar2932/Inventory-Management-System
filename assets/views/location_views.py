from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.response import Response

from assets.models import Location
from assets.serializers import LocationSerializer

from .permissions import IsAuth, IsSuperAdmin


class LocationViewSet(viewsets.ModelViewSet):
    queryset = Location.objects.all()
    serializer_class = LocationSerializer
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['name']

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsSuperAdmin()]
        return [IsAuth()]

    @action(detail=False, methods=['POST'], permission_classes=[IsSuperAdmin])
    def add(self, request):
        name = request.data.get("name")
        if not name:
            return Response(
                {"error": "Name is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        location, created = Location.objects.get_or_create(name=name)
        serializer = self.get_serializer(location)
        return Response(
            {"created": created, "data": serializer.data},
            status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=['PATCH'], permission_classes=[IsSuperAdmin])
    def update_location(self, request):
        name = request.data.get("name")
        if not name:
            return Response(
                {"error": "Name is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            location = Location.objects.get(name=name)
        except Location.DoesNotExist:
            return Response(
                {"error": "Location not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = self.get_serializer(location, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"data": serializer.data})
