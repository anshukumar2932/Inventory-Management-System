from django.db import models


class Service(models.Model):

    service_name = models.CharField(
        max_length=100,
        unique=True
    )

    description = models.TextField(
        blank=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        ordering = ["service_name"]
        indexes = [
            models.Index(fields=["service_name"]),
        ]

    def __str__(self):
        return self.service_name


class ClientCompany(models.Model):

    company_name = models.CharField(
        max_length=255,
        unique=True
    )

    contact_person = models.CharField(
        max_length=100,
        blank=True
    )

    email = models.EmailField(
        blank=True
    )

    phone = models.CharField(
        max_length=20,
        blank=True
    )

    address = models.TextField(
        blank=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        ordering = ["company_name"]
        indexes = [
            models.Index(fields=["company_name"]),
        ]

    def __str__(self):
        return self.company_name


class VendorCategory(models.Model):

    name = models.CharField(
        max_length=100,
        unique=True
    )

    description = models.TextField(
        blank=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Vendor(models.Model):

    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('ACTIVE', 'Active'),
        ('INACTIVE', 'Inactive'),
        ('BLACKLISTED', 'Blacklisted'),
    )

    vendor_code = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        null=True
    )

    vendor_name = models.CharField(
        max_length=100,
        unique=True
    )

    vendor_category = models.ForeignKey(
        VendorCategory,
        on_delete=models.PROTECT,
        related_name='vendors',
        blank=True,
        null=True
    )

    contact_person = models.CharField(
        max_length=100
    )

    email = models.EmailField(
        unique=True
    )

    phone = models.CharField(
        max_length=20
    )

    alternate_phone = models.CharField(
        max_length=20,
        blank=True,
        null=True
    )

    address = models.TextField()

    gst_number = models.CharField(
        max_length=50,
        blank=True,
        null=True
    )

    pan_number = models.CharField(
        max_length=20,
        blank=True,
        null=True
    )

    services = models.ManyToManyField(
        Service,
        related_name='vendors',
        blank=True
    )

    supported_categories = models.ManyToManyField(
        'assets.Category',
        related_name='vendors',
        blank=True
    )

    served_companies = models.ManyToManyField(
        ClientCompany,
        related_name='vendors',
        blank=True
    )

    remarks = models.TextField(
        blank=True,
        null=True
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING'
    )

    rating = models.DecimalField(
        max_digits=3,
        decimal_places=1,
        default=0.0
    )

    is_deleted = models.BooleanField(
        default=False
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        ordering = ["vendor_name"]

        indexes = [
            models.Index(fields=["vendor_name"]),
            models.Index(fields=["vendor_code"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.vendor_code} - {self.vendor_name}"


class VendorContact(models.Model):

    vendor = models.ForeignKey(
        Vendor,
        on_delete=models.CASCADE,
        related_name='contacts'
    )

    name = models.CharField(
        max_length=100
    )

    designation = models.CharField(
        max_length=100,
        blank=True
    )

    email = models.EmailField(
        blank=True
    )

    phone = models.CharField(
        max_length=20
    )

    is_primary = models.BooleanField(
        default=False
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        ordering = ["vendor__vendor_name", "name"]

    def __str__(self):
        return f"{self.vendor.vendor_name} - {self.name}"


class VendorBankAccount(models.Model):

    vendor = models.ForeignKey(
        Vendor,
        on_delete=models.CASCADE,
        related_name='bank_accounts'
    )

    bank_name = models.CharField(
        max_length=100
    )

    account_holder_name = models.CharField(
        max_length=100
    )

    account_number = models.CharField(
        max_length=50
    )

    ifsc_code = models.CharField(
        max_length=20
    )

    branch_name = models.CharField(
        max_length=100,
        blank=True
    )

    is_primary = models.BooleanField(
        default=False
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        ordering = ["vendor__vendor_name"]

    def __str__(self):
        return f"{self.vendor.vendor_name} - {self.bank_name}"


