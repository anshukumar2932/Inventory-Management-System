from django.contrib import admin
from .models import Asset, AssetAssignment, Category, Location, AsyncBarcodeJob

admin.site.register(Asset)
admin.site.register(AssetAssignment)
admin.site.register(Category)
admin.site.register(Location)
admin.site.register(AsyncBarcodeJob)
