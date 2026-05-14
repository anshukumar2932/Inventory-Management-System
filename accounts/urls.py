from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CustomTokenObtainPairView, UserDetailView, LogoutView, DepartmentViewSet, UserViewSet

router = DefaultRouter()
router.register("departments", DepartmentViewSet)
router.register("users", UserViewSet)

urlpatterns = [
    path("login/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", UserDetailView.as_view(), name="user_detail"),
    path("", include(router.urls)),
]