from django.contrib.auth.models import AbstractUser
from django.db import models


class Department(models.Model):

    department_name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=50, unique=True, blank=True, null=True)
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='children',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["department_name"]

    def __str__(self):
        return self.department_name


class User(AbstractUser):

    ROLE_CHOICES = (
        ('SUPER_ADMIN', 'Super Admin'),
        ('DEPARTMENT_ADMIN', 'Department Admin'),
        ('MANAGER', 'Inventory Manager'),
        ('USER', 'User'),
    )

    STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('INACTIVE', 'Inactive'),
    )

    role = models.CharField(
        max_length=50,
        choices=ROLE_CHOICES,
        default='USER',
    )

    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    status = models.CharField(
        max_length=50,
        choices=STATUS_CHOICES,
        default='ACTIVE',
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["username"]

    def __str__(self):
        return self.username
