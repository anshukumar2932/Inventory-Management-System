from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CustomTokenObtainPairView, RegisterView, UserDetailView, LogoutView, DepartmentViewSet

router = DefaultRouter()
router.register("departments", DepartmentViewSet)

urlpatterns = [
    path("login/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("register/", RegisterView.as_view(), name="register"),
    path("me/", UserDetailView.as_view(), name="user_detail"),
    path("", include(router.urls)),
]
