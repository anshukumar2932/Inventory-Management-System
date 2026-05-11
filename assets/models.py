from django.db import models
from django.conf import settings
from accounts.models import Department


class Category(models.Model):
    name = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "categories"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Vendor(models.Model):
    vendor_name = models.CharField(max_length=100, unique=True)
    contact_person = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20)
    address = models.TextField()
    service_type = models.CharField(max_length=100)
    sla_terms = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["vendor_name"]

    def __str__(self):
        return self.vendor_name


class Location(models.Model):
    name = models.CharField(max_length=255, unique=True)
    building = models.CharField(max_length=100)
    floor = models.CharField(max_length=100)
    room = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Asset(models.Model):

    SERVICE_CHOICES = (
        ('NONE', 'None'),
        ('WARRANTY', 'Warranty'),
        ('AMC', 'AMC'),
    )

    STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('REPAIR', 'Under Repair'),
        ('MISSING', 'Missing'),
        ('RETIRED', 'Retired'),
    )

    asset_code = models.CharField(max_length=100, unique=True, db_index=True)
    barcode = models.CharField(max_length=255, unique=True, blank=True)
    asset_name = models.CharField(max_length=255, db_index=True)
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="assets",
    )
    
    brand = models.CharField(max_length=100)
    model_name = models.CharField(max_length=100)

    location = models.ForeignKey(
        Location,
        on_delete=models.PROTECT,
        related_name="assets",
    )

    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        related_name="assets",
    )

    serial_number = models.CharField(max_length=255, db_index=True)
    model_number = models.CharField(max_length=255, blank=True)

    manufacturer = models.CharField(max_length=255)
    invoice_number = models.CharField(max_length=255, blank=True)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='ACTIVE',
        db_index=True,
    )

    service_type = models.CharField(
        max_length=20,
        choices=SERVICE_CHOICES,
        default='NONE',
    )

    service_start = models.DateField(
        null=True,
        blank=True,
    )

    service_end = models.DateField(
        null=True,
        blank=True,
    )

    vendor = models.ForeignKey(
        Vendor,
        on_delete=models.PROTECT,
        related_name="assets",
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.asset_code


class AssetAssignment(models.Model):

    asset_id = models.ForeignKey(
        Asset,
        on_delete=models.CASCADE,
        related_name="assignments",
    )

    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        related_name="assignments",
    )
    assigned_date = models.DateTimeField(auto_now_add=True)
    return_date = models.DateTimeField(null=True, blank=True)
    remark = models.CharField()

    class Meta:
        ordering = ["-assigned_date"]

    def __str__(self):
        return f"{self.asset} -> {self.assigned_user or 'Unassigned'}"
