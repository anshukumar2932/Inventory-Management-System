from django.contrib import admin
from .models import Asset, AssetAssignment, Category, Location
from vendors.models import Vendor


admin.site.register(Asset)
admin.site.register(AssetAssignment)
admin.site.register(Category)
admin.site.register(Vendor)
admin.site.register(Location)
