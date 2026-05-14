from django.contrib import admin
from .models import Vendor, VendorCategory, VendorContact, VendorBankAccount, Service, ClientCompany

admin.site.register(Vendor)
admin.site.register(VendorCategory)
admin.site.register(VendorContact)
admin.site.register(VendorBankAccount)
admin.site.register(Service)
admin.site.register(ClientCompany)
