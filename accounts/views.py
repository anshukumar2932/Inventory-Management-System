from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from django.conf import settings

from .models import Department, User
from .serializers import (
    CustomTokenObtainPairSerializer,
    DepartmentSerializer,
    UserSerializer,
)


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        refresh_token = data.pop('refresh', None)

        response = Response(data, status=status.HTTP_200_OK)

        if refresh_token:
            max_age = int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds())
            response.set_cookie(
                'refresh_token',
                refresh_token,
                httponly=True,
                secure=False,
                samesite='Lax',
                max_age=max_age,
                path='/api/',
            )

        return response


class CookieTokenRefreshView(APIView):
    permission_classes = []

    def post(self, request):
        refresh_token = request.COOKIES.get('refresh_token')
        if not refresh_token:
            return Response(
                {"detail": "No refresh token provided"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            token = RefreshToken(refresh_token)
            access = str(token.access_token)

            max_age = int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds())
            response = Response({"access": access})
            response.set_cookie(
                'refresh_token',
                refresh_token,
                httponly=True,
                secure=False,
                samesite='Lax',
                max_age=max_age,
                path='/api/',
            )
            return response
        except Exception:
            response = Response(
                {"detail": "Invalid or expired refresh token"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            response.delete_cookie('refresh_token', path='/api/')
            return response


class UserDetailView(generics.RetrieveUpdateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class IsDeptAdminOrSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ("DEPARTMENT_ADMIN", "SUPER_ADMIN")


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

    def get_permissions(self):
        if self.action == 'create':
            permission_classes = [IsDeptAdminOrSuperAdmin]
        elif self.action in ['update', 'partial_update']:
            permission_classes = [IsDeptAdminOrSuperAdmin]
        elif self.action == 'destroy':
            permission_classes = [IsSuperAdmin]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == "DEPARTMENT_ADMIN":
            return qs.filter(department=user.department)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        if request.user.role == "DEPARTMENT_ADMIN":
            user.department = request.user.department
            user.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        user = serializer.save()
        password = self.request.data.get("password")
        if password:
            user.set_password(password)
            user.save()


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "SUPER_ADMIN"


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsSuperAdmin]
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
            depts = Department.objects.all()
        else:
            depts = Department.objects.filter(department_name__icontains=name)
        serializer = self.get_serializer(depts, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['GET'], permission_classes=[IsAuthenticated])
    def tree(self, request):
        def build(node):
            children = node.children.all()
            return {
                'id': node.id,
                'name': node.department_name,
                'code': node.code,
                'children': [build(c) for c in children] if children else [],
            }
        roots = Department.objects.filter(parent__isnull=True)
        return Response([build(r) for r in roots])


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.COOKIES.get('refresh_token') or request.data.get('refresh')
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass

        response = Response({"detail": "Logged Out"})
        response.delete_cookie('refresh_token', path='/api/')
        return response
