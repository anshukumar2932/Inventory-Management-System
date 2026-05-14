from django.db import models
from django.conf import settings
from accounts.models import Department
from helper.barcode_generator import barcode_generator


class Document(models.Model):
    file_name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100)
    file_size = models.IntegerField()
    file_data = models.BinaryField()
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return self.file_name


class Category(models.Model):
    name = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "categories"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Location(models.Model):
    name = models.CharField(max_length=255)
    building = models.CharField(max_length=100)
    floor = models.CharField(max_length=100)
    room = models.CharField(max_length=100)
    sub_location = models.CharField(max_length=100, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Asset(models.Model):
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
    barcode = models.CharField(max_length=255, unique=True, null=True, blank=True, default=None)
    asset_name = models.CharField(max_length=255, db_index=True)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="assets")
    brand = models.CharField(max_length=100)
    model_name = models.CharField(max_length=100)
    location = models.ForeignKey(Location, on_delete=models.PROTECT, related_name="assets")
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="assets")
    serial_number = models.CharField(max_length=255, db_index=True)
    model_detail = models.CharField(max_length=255, blank=True)
    manufacturer = models.CharField(max_length=255)
    invoice_number = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='BLOCKED', db_index=True)
    approval_status = models.CharField(max_length=20, choices=APPROVAL_CHOICES, default='PENDING')
    procurement_request = models.ForeignKey(
        'procurement.ProcurementRequest',
        on_delete=models.SET_NULL, null=True, blank=True, related_name='assets',
    )
    vendor = models.ForeignKey('vendors.Vendor', on_delete=models.PROTECT, related_name="assets", null=True, blank=True)
    documents = models.ManyToManyField(Document, blank=True)
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.barcode:
            raw = f"{self.asset_code}{self.asset_name}{__import__('time').time()}"
            self.barcode = barcode_generator(raw)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.asset_code


class AssetAssignment(models.Model):
    asset_id = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name="assignments")
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="assignments")
    assigned_date = models.DateTimeField(auto_now_add=True)
    return_date = models.DateTimeField(null=True, blank=True)
    remark = models.CharField(max_length=255, blank=True, default='')

    class Meta:
        ordering = ["-assigned_date"]

    def __str__(self):
        return f"{self.asset_id} -> {self.department}"


class ServiceType(models.Model):
    name = models.CharField(max_length=255)
    department = models.ForeignKey(
        Department, on_delete=models.CASCADE, null=True, blank=True,
        help_text="Leave blank for global services usable by all departments",
    )
    description = models.TextField(blank=True, null=True)
    is_global = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(fields=['name', 'department'], name='unique_service_type_per_department'),
        ]

    def __str__(self):
        return self.name


class Availability(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        verbose_name_plural = "availabilities"
        ordering = ['name']

    def __str__(self):
        return self.name


class AssetService(models.Model):
    STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('EXPIRED', 'Expired'),
        ('PENDING', 'Pending'),
    )

    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name='asset_services')
    service_type = models.ForeignKey(ServiceType, on_delete=models.PROTECT)
    provider = models.ForeignKey('vendors.Vendor', on_delete=models.SET_NULL, null=True, blank=True)
    availability = models.ForeignKey(Availability, on_delete=models.SET_NULL, null=True, blank=True)
    start_date = models.DateField()
    end_date = models.DateField()
    renewal_reminder_days = models.IntegerField(default=30)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    document = models.ForeignKey(Document, on_delete=models.SET_NULL, null=True, blank=True)
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-end_date']

    def __str__(self):
        return f"{self.asset.asset_code} - {self.service_type.name}"


class AsyncBarcodeJob(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('PROCESSING', 'Processing'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
    )

    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    task_id = models.CharField(max_length=255, blank=True, null=True)
    asset_count = models.IntegerField(default=0)
    result_data = models.BinaryField(blank=True, null=True, editable=False)
    error_message = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['-created_at']
