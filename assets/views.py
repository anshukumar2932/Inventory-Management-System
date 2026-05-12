# API views that power the inventory management system
# Each ViewSet maps to a model and provides CRUD + search/filter endpoints
from collections import Counter
from datetime import timedelta
from django.db.models import Count, Sum
from django.utils import timezone
from helper.barcode_generator import barcode_generator, generate_barcode_image
import io
import pandas as pd
from django.http import HttpResponse
from openpyxl import Workbook
from openpyxl.drawing.image import Image as XlImage
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from accounts.models import Department
from repairs.models import RepairTicket
from .models import Asset, Category, Location, Vendor
from .serializers import (
    AssetSerializer,
    AssetListSerializer,
    AssetDetailSerializer,
    CategorySerializer,
    LocationSerializer,
    VendorSerializer,
)
from rest_framework import viewsets
from rest_framework.filters import SearchFilter
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter
from .response import success_response, error_response

# ── Role-based permissions ──────────────────────────────────
# These gate which users can do what.
# ADMIN can do everything. MANAGER has limited write access.

class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role.role_name == "ADMIN"


class IsAuth(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated

class IsManager(BasePermission):
     def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role
            and request.user.role.role_name == "MANAGER")
     

# ── Dashboard Stats ──────────────────────────────────────────
# Aggregated numbers shown on the main dashboard page.
# Hits the database with efficient COUNT queries.

@api_view(["GET"])
@permission_classes([IsAuth])
def dashboard_stats(request):
    total = Asset.objects.count()
    active = Asset.objects.filter(status="ACTIVE").count()
    repair = Asset.objects.filter(status="REPAIR").count()
    missing = Asset.objects.filter(status="MISSING").count()
    retired = Asset.objects.filter(status="RETIRED").count()
    blocked = Asset.objects.filter(status="BLOCKED").count()

    from procurement.models import ProcurementRequest
    pending_procurements = ProcurementRequest.objects.filter(approval_status="PENDING").count()

    cats = (
        Asset.objects.values("category__name")
        .annotate(count=Count("id"))
        .order_by("-count")
    )
    assets_by_category = [{"name": c["category__name"], "count": c["count"]} for c in cats]

    depts = (
        Asset.objects.values("department__department_name")
        .annotate(count=Count("id"))
        .order_by("-count")
    )
    assets_by_department = [{"name": d["department__department_name"], "count": d["count"]} for d in depts]

    months = []
    now = timezone.now()
    for i in range(11, -1, -1):
        dt = now - timedelta(days=30 * i)
        ym = dt.strftime("%Y-%m")
        months.append(ym)
    monthly_raw = (
        Asset.objects.extra(select={"ym": "to_char(created_at, 'YYYY-MM')"})
        .values("ym")
        .annotate(count=Count("id"))
        .order_by("ym")
    )
    monthly_map = {m["ym"]: m["count"] for m in monthly_raw}
    monthly_additions = [{"month": m, "count": monthly_map.get(m, 0)} for m in months]

    repair_total = RepairTicket.objects.aggregate(s=Sum("repair_cost"))["s"] or 0
    repair_analytics = {
        "open_tickets": RepairTicket.objects.exclude(status__iexact="closed").count(),
        "closed_tickets": RepairTicket.objects.filter(status__iexact="closed").count(),
        "total_cost": float(repair_total),
    }

    audit_trends = []

    return Response({
        "total_assets": total,
        "active_assets": active,
        "repair_assets": repair,
        "missing_assets": missing,
        "retired_assets": retired,
        "blocked_assets": blocked,
        "pending_procurements": pending_procurements,
        "assets_by_category": assets_by_category,
        "assets_by_department": assets_by_department,
        "monthly_additions": monthly_additions,
        "repair_analytics": repair_analytics,
        "audit_trends": audit_trends,
    })


# ── Category CRUD ────────────────────────────────────────────
# Categories are simple name-only resources.
# SearchFilter lets the frontend do ?search=electronics.

class CategoryViewSet(viewsets.ModelViewSet):

    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAuth]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['name']

    @action(detail=False, methods=['POST'], permission_classes=[IsAdmin])
    def add(self, request):
        name = request.data.get("name")
        if not name:
            return Response(
                {"error": "Name is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        category, created = Category.objects.get_or_create(name=name)
        serializer = self.get_serializer(category)
        return Response(
            {"created": created, "data": serializer.data},
            status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=['PATCH'], permission_classes=[IsAdmin])
    def update_category(self, request):
        name = request.data.get("name")
        if not name:
            return Response(
                {"error": "Name is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            category = Category.objects.get(name=name)
        except Category.DoesNotExist:
            return Response(
                {"error": "Category not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = self.get_serializer(category, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"data": serializer.data})

    @action(detail=False, methods=['DELETE'], permission_classes=[IsAdmin])
    def remove_category(self, request):
        name = request.data.get("name")
        if not name:
            return Response(
                {"error": "Name is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            category = Category.objects.get(name=name)
        except Category.DoesNotExist:
            return Response(
                {"error": "Category not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        category.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Location CRUD ────────────────────────────────────────────
# Physical locations where assets are kept.

class LocationViewSet(viewsets.ModelViewSet):
    queryset = Location.objects.all()
    serializer_class = LocationSerializer
    permission_classes = [IsAuth]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['name']

    @action(
        detail=False,
        methods=['POST'],
        permission_classes=[IsAdmin]
    )
    def add(self, request):
        name = request.data.get("name")
        if not name:
            return Response(
                {"error": "Name is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        location, created = Location.objects.get_or_create(name=name)
        serializer = self.get_serializer(location)
        return Response(
            {"created": created, "data": serializer.data},
            status=status.HTTP_201_CREATED
        )

    @action(
        detail=False,
        methods=['PATCH'],
        permission_classes=[IsAdmin]
    )
    def update_location(self, request):
        name = request.data.get("name")
        if not name:
            return Response(
                {"error": "Name is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            location = Location.objects.get(name=name)
        except Location.DoesNotExist:
            return Response(
                {"error": "Location not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = self.get_serializer(location, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"data": serializer.data})


# ── Vendor CRUD ──────────────────────────────────────────────
# Vendors supply the assets. Searchable by vendor_name.

class VendorViewSet(viewsets.ModelViewSet):
    queryset = Vendor.objects.all()
    serializer_class = VendorSerializer
    permission_classes = [IsAuth]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['vendor_name']
    
    @action(detail=False,methods=['POST'],permission_classes=[IsAuth])
    def add(self, request):
        vendor_name=request.data.get("vendor_name")

        if not vendor_name:
            return Response(
                {"error": "vendor_name is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        vendor, created = Vendor.objects.get_or_create(vendor_name=vendor_name)
        serializer = self.get_serializer(vendor)
        return Response(
            {"created": created, "data": serializer.data},
            status=status.HTTP_201_CREATED
        )


# ── Asset CRUD ───────────────────────────────────────────────
# The main resource. Everything else supports this.
# Uses select_related to avoid N+1 queries on FK fields.
# Uses different serializers for list vs detail for performance.

class AssetViewSet(viewsets.ModelViewSet):
    queryset = Asset.objects.select_related(
        "category", "location", "department", "vendor"
    ).all()
    serializer_class = AssetSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['asset_code', 'asset_name', 'brand', 'model_name', 'serial_number']
    permission_classes = [IsAuth]
    filterset_fields = ["procurement_request", "status", "approval_status", "category", "department", "location", "service_type"]

    def get_serializer_class(self):
        if self.action == "list":
            return AssetListSerializer  # Lightweight — only table columns
        if self.action == "retrieve":
            return AssetDetailSerializer  # Full detail with resolved names
        return AssetSerializer  # Full fields for writes

    @action(
        detail=False,
        methods=['POST'],
        permission_classes=[IsAdmin,IsManager]
    )
    def add(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return success_response(
            message="Asset created successfully",
            http_status=status.HTTP_201_CREATED
        )

    @action(
        detail=False,
        methods=['PATCH'],
        permission_classes=[IsAdmin]
    )
    def update_asset(self, request):
        asset_name = request.data.get("asset_name")
        if not asset_name:
            return error_response("asset_name is required")
        try:
            asset = Asset.objects.get(asset_name=asset_name)
        except Asset.DoesNotExist:
            return error_response(
                "Asset not found",
                http_status=status.HTTP_404_NOT_FOUND
            )
        serializer = self.get_serializer(asset, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return success_response(message="Asset updated successfully")
    
    @action(
        detail=False,
        methods=['POST','GET'],
        permission_classes=[IsAdmin,IsManager]
    )
    def bulk_upload(self, request):
        # GET returns a template Excel file for download
        if request.method == "GET":
            wb = Workbook()
            ws = wb.active
            ws.title = "Template"
            headers_row = [
                "asset_code", "asset_name", "category", "brand", "model_name",
                "location", "department", "serial_number", "manufacturer",
                "barcode", "model_detail", "invoice_number", "status",
                "service_type", "vendor"
            ]
            ws.append(headers_row)
            ws.append(["AST001", "Laptop Dell XPS", "Electronics", "Dell", "XPS 15",
                        "Main Office", "IT", "SN123456", "Dell Inc.",
                        "", "", "", "ACTIVE", "WARRANTY", "TechVendor"])
            for col_idx in range(1, len(headers_row) + 1):
                ws.column_dimensions[chr(64 + col_idx) if col_idx <= 26 else "A"].width = 18
            output = io.BytesIO()
            wb.save(output)
            output.seek(0)
            response = HttpResponse(
                output.read(),
                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )
            response["Content-Disposition"] = 'attachment; filename="bulk_upload_template.xlsx"'
            return response

        # POST processes an uploaded file — CSV or Excel
        file = request.FILES.get("file")
        if not file:
            return Response({"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)

        ext = file.name.rsplit(".", 1)[-1].lower()
        if ext == "csv":
            df = pd.read_csv(file)
        elif ext in ("xlsx", "xls"):
            df = pd.read_excel(file, engine="openpyxl" if ext == "xlsx" else "xlrd")
        else:
            return Response({"error": "Unsupported file format"}, status=status.HTTP_400_BAD_REQUEST)

        # Normalize column names — strip whitespace, lowercase, replace spaces
        df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]
        df = df.where(pd.notna(df), None)

        errors = []
        created_assets = []

        def val(v, default=""):
            if v is None or (isinstance(v, float) and __import__('math').isnan(v)):
                return default
            return v

        for idx, row in df.iterrows():
            row_errors = []

            try:
                category_name = row.get("category")
                location_name = row.get("location")
                department_name = row.get("department")
                vendor_name = row.get("vendor")

                category_name = str(category_name).strip() if category_name else None
                location_name = str(location_name).strip() if location_name else None
                department_name = str(department_name).strip() if department_name else None
                vendor_name = str(vendor_name).strip() if vendor_name else None

                if not category_name:
                    row_errors.append("category is required")
                if not location_name:
                    row_errors.append("location is required")
                if not department_name:
                    row_errors.append("department is required")

                if row_errors:
                    errors.append({"row": idx + 2, "message": "; ".join(row_errors)})
                    continue

                # Find or create the related objects by name
                category = Category.objects.filter(name__iexact=category_name).first()
                if not category:
                    category = Category.objects.create(name=category_name)

                location = Location.objects.filter(name__iexact=location_name).first()
                if not location:
                    location = Location.objects.create(name=location_name, building="", floor="", room="")

                department = Department.objects.filter(department_name__iexact=department_name).first()
                if not department:
                    department = Department.objects.create(department_name=department_name)

                vendor = None
                if vendor_name:
                    vendor = Vendor.objects.filter(vendor_name__iexact=vendor_name).first()
                    if not vendor:
                        vendor = Vendor.objects.create(
                            vendor_name=vendor_name,
                            contact_person="",
                            email=f"vendor_{vendor_name.replace(' ', '_')}@temp.com",
                            phone="",
                            address="",
                            service_type=""
                        )

                barcode_val = val(row.get("barcode"))
                if not barcode_val:
                    raw = f"{val(row.get('asset_code'))}{val(row.get('asset_name'))}{idx}{__import__('time').time()}"
                    barcode_val = barcode_generator(raw)

                data = {
                    "asset_code": val(row.get("asset_code")),
                    "barcode": barcode_val,
                    "asset_name": val(row.get("asset_name")),
                    "category": category.id,
                    "brand": val(row.get("brand")),
                    "model_name": val(row.get("model_name")),
                    "location": location.id,
                    "department": department.id,
                    "serial_number": str(val(row.get("serial_number", ""))),
                    "model_detail": val(row.get("model_detail")),
                    "manufacturer": val(row.get("manufacturer")),
                    "invoice_number": val(row.get("invoice_number")),
                    "status": val(row.get("status"), "ACTIVE"),
                    "service_type": val(row.get("service_type"), "NONE"),
                    "vendor": vendor.id if vendor else None,
                }

                serializer = AssetSerializer(data=data)
                if serializer.is_valid():
                    asset = serializer.save()
                    created_assets.append(asset)
                else:
                    msg = "; ".join(f"{k}: {', '.join(v)}" for k, v in serializer.errors.items())
                    errors.append({"row": idx + 2, "message": msg})

            except Exception as e:
                errors.append({"row": idx + 2, "message": str(e)})

        if not created_assets and errors:
            return Response({"error": "No assets created", "details": errors}, status=status.HTTP_400_BAD_REQUEST)

        # Generate a barcode-spreadsheet for the newly created assets
        wb = Workbook()
        ws = wb.active
        ws.title = "Barcodes"
        ws.append(["Asset Code", "Barcode", "Barcode Image"])
        ws.column_dimensions["A"].width = 20
        ws.column_dimensions["B"].width = 30
        ws.column_dimensions["C"].width = 25

        for i, asset in enumerate(created_assets, start=2):
            ws.cell(row=i, column=1, value=asset.asset_code)
            ws.cell(row=i, column=2, value=asset.barcode)
            buf = generate_barcode_image(asset.barcode)
            if buf:
                img = XlImage(buf)
                img.width = 120
                img.height = 40
                ws.add_image(img, f"C{i}")
                ws.row_dimensions[i].height = 45

        if errors:
            ws2 = wb.create_sheet("Errors")
            ws2.append(["Row", "Error"])
            ws2.column_dimensions["A"].width = 10
            ws2.column_dimensions["B"].width = 60
            for err in errors:
                ws2.append([err["row"], err["message"]])

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)

        response = HttpResponse(
            output.read(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response["Content-Disposition"] = 'attachment; filename="barcodes.xlsx"'
        return response
