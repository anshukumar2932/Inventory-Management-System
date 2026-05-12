from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Department, Role, User
from .serializers import (
    CustomTokenObtainPairSerializer,
    DepartmentSerializer,
    UserSerializer,
)

class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role
            and request.user.role.role_name == "ADMIN"
        )

class IsManager(BasePermission):
     def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role
            and request.user.role.role_name == "MANAGER")

class IsAuth(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.AllowAny]

    def perform_create(self, serializer):
        password = self.request.data.get("password")
        user = serializer.save()
        user.set_password(password)
        user.save()


class UserDetailView(generics.RetrieveUpdateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user
    
class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

    def get_permissions(self):

        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsAdmin]

        else:
            permission_classes = [IsAuthenticated]

        return [permission() for permission in permission_classes]

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        role_name = data.get("role")
        if role_name and not str(role_name).isdigit():
            role = Role.objects.filter(role_name__iexact=role_name).first()
            if role:
                data["role"] = role.id
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        password = data.get("password")
        user = serializer.save()
        if password:
            user.set_password(password)
            user.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def perform_create(self, serializer):

        password = self.request.data.get("password")

        user = serializer.save()

        user.set_password(password)

        user.save()
    
class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer

    def get_permissions(self):

        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsAdmin,IsManager]

        else:
            permission_classes = [IsAuthenticated]

        return [permission() for permission in permission_classes]

    @action(
        detail=False,
        methods=['GET'],
        url_path=r'detail/(?P<name>[^/.]+)',
        permission_classes=[IsAuthenticated]
    )
    def detail(self, request, name=None):

        if name == 'all':
            department = Department.objects.all()

        else:
            department = Department.objects.filter(
                department_name__icontains=name
            )

        serializer = self.get_serializer(
            department,
            many=True
        )

        return Response(serializer.data)

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            token= RefreshToken(refresh_token)
            token.blacklist()
            return Response({"detail": "Logged Out" })
        except Exception:
            return Response({"detail": "Invalid Token" },status=400)