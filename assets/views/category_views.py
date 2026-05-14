from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.response import Response

from assets.models import Category
from assets.serializers import CategorySerializer

from .permissions import IsAuth, IsSuperAdmin


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
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
        category, created = Category.objects.get_or_create(name=name)
        serializer = self.get_serializer(category)
        return Response(
            {"created": created, "data": serializer.data},
            status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=['PATCH'], permission_classes=[IsSuperAdmin])
    def update_category(self, request):
        name = request.data.get("name")
        if not name:
            return Response(
                {"error": "Name is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            category = Category.objects.get(name=name)
        except Category.DoesNotExist:
            return Response(
                {"error": "Category not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = self.get_serializer(category, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"data": serializer.data})

    @action(detail=False, methods=['DELETE'], permission_classes=[IsSuperAdmin])
    def remove_category(self, request):
        name = request.data.get("name")
        if not name:
            return Response(
                {"error": "Name is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            category = Category.objects.get(name=name)
        except Category.DoesNotExist:
            return Response(
                {"error": "Category not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        category.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
