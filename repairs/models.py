# Tracks repair tickets for assets that need fixing
# Each ticket links to an asset and tracks its repair journey
from django.db import models
from assets.models import Asset


class RepairTicket(models.Model):

    # Which asset needs repair
    asset = models.ForeignKey(Asset, on_delete=models.CASCADE)

    # What's wrong — detailed description from the reporter
    issue_description = models.TextField()

    # How much the repair cost (filled in when repair is done)
    repair_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0
    )

    # Current stage: OPEN → IN_PROGRESS → COMPLETED → CLOSED
    status = models.CharField(max_length=50)

    # When the ticket was created (auto-set)
    start_date = models.DateTimeField(auto_now_add=True)

    # When the repair was actually finished (manually set)
    completion_date = models.DateTimeField(
        null=True,
        blank=True
    )

    class Meta:
        ordering = ["-start_date"]  # Most recent tickets first

    def __str__(self):
        return f"#{self.id} - {self.asset.asset_code} ({self.status})"
