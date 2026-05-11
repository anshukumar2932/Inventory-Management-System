from django.db import models
from django.conf import settings

class Asset(models.Model):

    STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('REPAIR', 'Under Repair'),
        ('MISSING', 'Missing'),
        ('RETIRED', 'Retired'),
    )

    asset_code = models.CharField(max_length=100, unique=True)
    barcode = models.CharField(max_length=255, unique=True)
    serial_number = models.CharField(max_length=255)

    category = models.CharField(max_length=100)
    brand = models.CharField(max_length=100)
    model = models.CharField(max_length=100)

    purchase_cost = models.DecimalField(max_digits=12, decimal_places=2)

    location = models.CharField(max_length=255)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='ACTIVE'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.asset_code
    

class AssetAssignment(models.Model):

    asset = models.ForeignKey(Asset, on_delete=models.CASCADE)

    assigned_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True
    )

    department = models.CharField(max_length=100)

    assigned_date = models.DateTimeField(auto_now_add=True)