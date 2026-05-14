export function getNotificationTarget(notification) {
  const objectType = notification?.related_object_type
  const objectId = notification?.related_object_id

  if (objectType === "procurement" && objectId) {
    return `/procurements/${objectId}`
  }

  if (objectType === "asset") {
    return "/assets"
  }

  if (objectType === "report") {
    return "/reports"
  }

  switch (notification?.notification_type) {
    case "ASSET_CREATED":
    case "ASSET_APPROVED":
    case "ASSET_REJECTED":
      return "/assets"
    case "PROCUREMENT_CREATED":
    case "PROCUREMENT_APPROVED":
    case "PROCUREMENT_REJECTED":
      return objectId ? `/procurements/${objectId}` : "/procurements"
    case "REPORT_GENERATED":
      return "/reports"
    default:
      return "/notifications"
  }
}
