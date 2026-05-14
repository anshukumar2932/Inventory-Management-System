from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User, Department
from assets.models import ServiceType


class DepartmentSerializer(serializers.ModelSerializer):
    services = serializers.ListField(
        child=serializers.CharField(max_length=255),
        write_only=True,
        required=True,
        min_length=1,
    )
    service_names = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = "__all__"  # id, department_name, code, parent, created_at, services, service_names

    def get_service_names(self, obj):
        return list(obj.servicetype_set.values_list('name', flat=True))

    def validate_services(self, value):
        existing = ServiceType.objects.filter(name__in=value).values_list('name', flat=True)
        if existing:
            raise serializers.ValidationError(
                f"Services already exist: {', '.join(existing)}"
            )
        return value

    def create(self, validated_data):
        services = validated_data.pop('services', [])
        department = super().create(validated_data)
        for name in services:
            ServiceType.objects.create(
                name=name,
                department=department,
                description='',
                is_global=False,
            )
        return department


class UserSerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(source="role", read_only=True)
    department_name = serializers.CharField(source="department.department_name", read_only=True)
    password = serializers.CharField(write_only=True, required=False, min_length=8)

    class Meta:
        model = User
        fields = ["id", "username", "email", "role", "role_name", "department", "department_name", "status", "password"]

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = super().create(validated_data)
        if password:
            user.set_password(password)
            user.save()
        return user


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        token["role"] = user.role
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data
