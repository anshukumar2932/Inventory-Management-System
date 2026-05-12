from django.contrib.auth.models import AbstractUser
from django.db import models


class Role(models.Model):

    ROLE_CHOICES = (
        ('ADMIN', 'Admin'),
        ('MANAGER', 'Inventory Manager'),
        ('USER', 'User'),
    )

    role_name = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='USER',
        unique=True
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.role_name


class Department(models.Model):

    department_name = models.CharField(
        max_length=100,
        unique=True
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["department_name"]

    def __str__(self):
        return self.department_name


class User(AbstractUser):

    STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('INACTIVE', 'Inactive'),
    )

    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE
    )

    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    status = models.CharField(
        max_length=50,
        choices=STATUS_CHOICES,
        default='ACTIVE'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["username"]

    def __str__(self):
        return self.username