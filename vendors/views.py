from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.response import Response

from assets.models import Category
from assets.views.permissions import IsAuth
from .models import Vendor, VendorCategory, Service, ClientCompany
from .serializers import VendorSerializer


class VendorViewSet(viewsets.ModelViewSet):
    serializer_class = VendorSerializer
    permission_classes = [IsAuth]
    filter_backends = [SearchFilter, OrderingFilter]

    search_fields = [
        'vendor_name', 'vendor_code', 'contact_person',
        'email', 'phone', 'gst_number',
    ]

    ordering_fields = [
        'vendor_name', 'vendor_code', 'created_at', 'updated_at', 'rating',
    ]

    ordering = ['vendor_name']

    def get_queryset(self):
        qs = Vendor.objects.filter(is_deleted=False).select_related(
            'vendor_category',
        ).prefetch_related(
            'services', 'supported_categories', 'served_companies',
            'bank_accounts', 'contacts',
        )
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(vendor_category__id=category)
        return qs

    @staticmethod
    def _generate_vendor_code():
        last = Vendor.objects.order_by('-id').first()
        if not last:
            return "VEND0001"
        try:
            num = int(last.vendor_code.replace('VEND', ''))
        except Exception:
            num = last.id
        return f"VEND{num + 1:04d}"

    @action(detail=False, methods=['POST'], permission_classes=[IsAuth])
    def add(self, request):
        vendor_name = request.data.get("vendor_name")
        if not vendor_name:
            return Response({"error": "vendor_name is required"}, status=status.HTTP_400_BAD_REQUEST)

        vendor_category = None
        category_id = request.data.get("vendor_category")
        if category_id:
            try:
                vendor_category = VendorCategory.objects.get(id=category_id)
            except VendorCategory.DoesNotExist:
                return Response({"error": "Invalid vendor category"}, status=status.HTTP_400_BAD_REQUEST)

        defaults = {
            "vendor_code": self._generate_vendor_code(),
            "contact_person": request.data.get("contact_person", ""),
            "email": request.data.get("email", f"{vendor_name.replace(' ', '_').lower()}@vendor.com"),
            "phone": request.data.get("phone", ""),
            "alternate_phone": request.data.get("alternate_phone", ""),
            "address": request.data.get("address", ""),
            "gst_number": request.data.get("gst_number", ""),
            "pan_number": request.data.get("pan_number", ""),
            "remarks": request.data.get("remarks", ""),
            "status": request.data.get("status", "PENDING"),
            "rating": request.data.get("rating", 0.0),
            "vendor_category": vendor_category,
        }

        vendor, created = Vendor.objects.get_or_create(vendor_name=vendor_name, defaults=defaults)

        if created:
            for s in request.data.get("services", "").split(","):
                s = s.strip()
                if s:
                    svc, _ = Service.objects.get_or_create(service_name=s)
                    vendor.services.add(svc)

            for c in request.data.get("supported_categories", "").split(","):
                c = c.strip()
                if c:
                    cat, _ = Category.objects.get_or_create(name=c)
                    vendor.supported_categories.add(cat)

            for co in request.data.get("served_companies", "").split(","):
                co = co.strip()
                if co:
                    company, _ = ClientCompany.objects.get_or_create(company_name=co)
                    vendor.served_companies.add(company)

        serializer = self.get_serializer(vendor)
        return Response({"created": created, "data": serializer.data}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['DELETE'], permission_classes=[IsAuth])
    def soft_delete(self, request, pk=None):
        vendor = self.get_object()
        vendor.is_deleted = True
        vendor.save()
        return Response({"message": "Vendor deleted successfully"}, status=status.HTTP_200_OK)
