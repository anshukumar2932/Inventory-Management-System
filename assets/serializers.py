# Serializers control how model data is converted to JSON (and back)
# Different serializers for different use cases = faster APIs
from rest_framework import serializers
from .models import Asset, Category, Location, Vendor


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = "__all__"


class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = "__all__"


class VendorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vendor
        fields = "__all__"


# Lightweight serializer for the asset list view
# Only returns the fields the table needs — no unnecessary data over the wire
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
