from django.db import models
from django.core.exceptions import ValidationError
import uuid


class FactoryCalendar(models.Model):
    """
    Factory maintenance calendar slots for scheduling anomalies.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    date = models.DateField(unique=True)
    available_hours = models.PositiveIntegerField(default=8, help_text="Available maintenance hours for this day")
    is_available = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['date']
        verbose_name = 'Factory Calendar Day'
        verbose_name_plural = 'Factory Calendar Days'

    def __str__(self):
        return f"{self.date} - {self.available_hours}h available"

    def clean(self):
        """Validate that available_hours is reasonable."""
        if self.available_hours > 24:
            raise ValidationError("Available hours cannot exceed 24 hours per day.")
        if self.available_hours < 0:
            raise ValidationError("Available hours cannot be negative.")

    def get_used_hours(self):
        """Calculate total hours used by scheduled anomalies."""
        from anomalies.models import Anomaly
        return sum(
            anomaly.estimated_duration 
            for anomaly in Anomaly.objects.filter(scheduled_slot=self)
        )

    def get_remaining_hours(self):
        """Calculate remaining available hours."""
        return max(0, self.available_hours - self.get_used_hours())

    @property
    def is_full(self):
        """Check if the slot is fully booked."""
        return self.get_remaining_hours() == 0

    @property
    def utilization_percentage(self):
        """Calculate slot utilization percentage."""
        if self.available_hours == 0:
            return 0
        used_hours = self.get_used_hours()
        return min(100, (used_hours / self.available_hours) * 100)

    def can_accommodate(self, duration):
        """Check if this slot can accommodate an anomaly with given duration."""
        return self.is_available and self.get_remaining_hours() >= duration

    def schedule_anomaly(self, anomaly):
        """Schedule an anomaly to this slot if possible."""
        if not self.can_accommodate(anomaly.estimated_duration):
            raise ValidationError(
                f"Cannot schedule anomaly requiring {anomaly.estimated_duration}h "
                f"to slot with {self.get_remaining_hours()}h remaining"
            )
        
        anomaly.scheduled_slot = self
        anomaly.save()
        return True
