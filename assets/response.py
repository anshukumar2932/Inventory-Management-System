# Helper utilities for sending consistent API responses
# Every endpoint uses these so the frontend always knows what to expect
from rest_framework.response import Response
from rest_framework import status


def success_response(data=None, message="Success", http_status=status.HTTP_200_OK):
    # Wrap successful results in a predictable envelope
    # Frontend checks "success: true" before reading "data"
    body = {"success": True, "message": message}
    if data is not None:
        body["data"] = data
    return Response(body, status=http_status)


def error_response(message="Error", errors=None, http_status=status.HTTP_400_BAD_REQUEST):
    # Wrap errors so the frontend can show meaningful messages
    # Frontend checks "success: false" and displays the "message"
    body = {"success": False, "message": message}
    if errors is not None:
        body["errors"] = errors
    return Response(body, status=http_status)
