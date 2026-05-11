from django.contrib import admin
from .models import Asset, AssetAssignment, Category, Vendor, Location


admin.site.register(Asset)
admin.site.register(AssetAssignment)
admin.site.register(Category)
admin.site.register(Vendor)
admin.site.register(Location)
