from django.http import HttpResponse
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from assets.models import Document
from assets.serializers import DocumentSerializer

from .permissions import IsAuth


class DocumentViewSet(viewsets.ModelViewSet):
    queryset = Document.objects.all()
    serializer_class = DocumentSerializer
    permission_classes = [IsAuth]

    def create(self, request, *args, **kwargs):
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        doc = Document.objects.create(
            file_name=file.name,
            content_type=file.content_type,
            file_size=file.size,
            file_data=file.read(),
        )
        serializer = self.get_serializer(doc)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['GET'])
    def download(self, request, pk=None):
        doc = self.get_object()
        return HttpResponse(doc.file_data, content_type=doc.content_type)
