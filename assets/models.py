# These models define the core inventory data:
# Categories organize assets (Laptops, Monitors, etc.)
# Locations track where assets physically live
# Assets are the main entity — everything revolves around them
# AssetAssignment tracks which department has which asset
from django.db import models
from django.conf import settings
from accounts.models import Department
from vendors.models import Vendor


class Category(models.Model):
    # Simple name-based grouping — "Electronics", "Furniture", etc.
    name = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "categories"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Location(models.Model):
    # Physical location: which building, floor, and room
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
    # The heart of the system — every tracked piece of equipment

    SERVICE_CHOICES = (
        ('NONE', 'None'),
        ('WARRANTY', 'Warranty'),
        ('INSURANCE', 'Insurance'),
        ('AMC', 'AMC'),
    )

    STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('REPAIR', 'Under Repair'),
        ('MISSING', 'Missing'),
        ('RETIRED', 'Retired'),
        ('BLOCKED', 'Blocked'),
    )

    APPROVAL_CHOICES = (
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    )

    asset_code = models.CharField(max_length=100, unique=True, db_index=True)
    barcode = models.CharField(max_length=255, unique=True, blank=True)
    asset_name = models.CharField(max_length=255, db_index=True)
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,  # Can't delete a category that still has assets
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
    model_detail = models.CharField(max_length=255, blank=True)

    manufacturer = models.CharField(max_length=255)
    invoice_number = models.CharField(max_length=255, blank=True)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='BLOCKED',  # New assets start blocked until approved
        db_index=True,
    )

    approval_status = models.CharField(
        max_length=20,
        choices=APPROVAL_CHOICES,
        default='PENDING',
    )

    procurement_request = models.ForeignKey(
        'procurement.ProcurementRequest',
        on_delete=models.SET_NULL,  # Keep the asset even if the procurement is deleted
        null=True, blank=True,
        related_name='assets',
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
        ordering = ["-created_at"]  # Newest assets first

    def __str__(self):
        return self.asset_code


class AssetAssignment(models.Model):
    # Records when an asset is checked out to a department
    # Useful for tracking asset movement history

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
    remark = models.CharField(max_length=255, blank=True, default='')

    class Meta:
        ordering = ["-assigned_date"]

    def __str__(self):
        return f"{self.asset_id} -> {self.department}"
