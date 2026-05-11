from rest_framework import generics, permissions, viewsets
from rest_framework_simplejwt.views import TokenObtainPairView
from .models import User, Department
from .serializers import CustomTokenObtainPairSerializer, UserSerializer, DepartmentSerializer
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

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
    
class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [permissions.IsAuthenticated]


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