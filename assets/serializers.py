# Serializers control how model data is converted to JSON (and back)
# Different serializers for different use cases = faster APIs
from rest_framework import serializers
from .models import Asset, Category, Location, Document, ServiceType, AssetService
from vendors.models import Vendor


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


class VendorSerializer(serializers.ModelSerializer):
    vendor_category_name = serializers.CharField(source="vendor_category.name", read_only=True, allow_null=True)
    service_names = serializers.SerializerMethodField()
    category_names = serializers.SerializerMethodField()
    company_names = serializers.SerializerMethodField()

    class Meta:
        model = Vendor
        fields = "__all__"

    def get_service_names(self, obj):
        return [s.service_name for s in obj.services.all()]

    def get_category_names(self, obj):
        return [c.name for c in obj.supported_categories.all()]

    def get_company_names(self, obj):
        return [c.company_name for c in obj.served_companies.all()]


# Lightweight serializer for the asset list view
# Only returns the fields the table needs — no unnecessary data over the wire
class ServiceTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceType
        fields = '__all__'


class AssetServiceSerializer(serializers.ModelSerializer):
    service_type_name = serializers.CharField(source="service_type.name", read_only=True)
    provider_name = serializers.CharField(source="provider.vendor_name", read_only=True, allow_null=True)

    class Meta:
        model = AssetService
        fields = '__all__'


class AssetListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Asset
        fields = [
            "id",
            "asset_code",
            "asset_name",
            "brand",
            "status",
            "category",
            "location",
            "department",
            "documents",
            "remarks",
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
