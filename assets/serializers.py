# Serializers control how model data is converted to JSON (and back)
# Different serializers for different use cases = faster APIs
from rest_framework import serializers
from .models import Asset, Category, Location, Document, ServiceType, AssetService, Availability


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = "__all__"


class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = "__all__"


class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = "__all__"


# Lightweight serializer for the asset list view
# Only returns the fields the table needs — no unnecessary data over the wire
class ServiceTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceType
        fields = '__all__'


class AvailabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Availability
        fields = '__all__'


class AssetServiceSerializer(serializers.ModelSerializer):
    service_type_name = serializers.CharField(source="service_type.name", read_only=True)
    provider_name = serializers.CharField(source="provider.vendor_name", read_only=True, allow_null=True)
    availability_name = serializers.CharField(source="availability.name", read_only=True, allow_null=True)

    class Meta:
        model = AssetService
        fields = '__all__'


class AssetListSerializer(serializers.ModelSerializer):
    active_services = serializers.SerializerMethodField()

    def get_active_services(self, obj):
        services = getattr(obj, "asset_services", None)
        if services is None:
            queryset = obj.asset_services.select_related("service_type")
        else:
            queryset = services.all()

        return [
            service.service_type.name
            for service in queryset
            if service.status == "ACTIVE" and service.service_type_id
        ]

    class Meta:
        model = Asset
        fields = [
            "id",
            "asset_code",
            "barcode",
            "asset_name",
            "brand",
            "model_name",
            "serial_number",
            "model_detail",
            "manufacturer",
            "invoice_number",
            "status",
            "category",
            "location",
            "department",
            "vendor",
            "documents",
            "remarks",
            "active_services",
        ]


# Full-detail serializer for the single-asset view
# Includes resolved names (e.g. "category_name" instead of just ID)
class AssetDetailSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    location_name = serializers.CharField(source="location.name", read_only=True)
    department_name = serializers.CharField(source="department.department_name", read_only=True)

    class Meta:
        model = Asset
        fields = "__all__"


# Full serializer used when creating or updating assets
# We need all fields during writes so validation catches everything
class AssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Asset
        fields = "__all__"
