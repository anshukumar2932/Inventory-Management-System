from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User, Department


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = "__all__"


class UserSerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(source="role.role_name", read_only=True)
    department_name = serializers.CharField(source="department.department_name", read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "role", "role_name", "department", "department_name", "status"]


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        token["role"] = user.role.role_name if user.role else None
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data
