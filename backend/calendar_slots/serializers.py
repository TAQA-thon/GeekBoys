from rest_framework import serializers
from .models import FactoryCalendar
from anomalies.models import Anomaly


class FactoryCalendarSerializer(serializers.ModelSerializer):
    used_hours = serializers.SerializerMethodField()
    remaining_hours = serializers.SerializerMethodField()
    utilization_percentage = serializers.FloatField(read_only=True)
    is_full = serializers.BooleanField(read_only=True)
    scheduled_anomalies_count = serializers.SerializerMethodField()

    class Meta:
        model = FactoryCalendar
        fields = [
            'id', 'date', 'available_hours', 'is_available', 'notes',
            'used_hours', 'remaining_hours', 'utilization_percentage',
            'is_full', 'scheduled_anomalies_count', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'used_hours', 'remaining_hours', 'utilization_percentage',
            'is_full', 'scheduled_anomalies_count', 'created_at', 'updated_at'
        ]

    def get_used_hours(self, obj):
        return obj.get_used_hours()

    def get_remaining_hours(self, obj):
        return obj.get_remaining_hours()

    def get_scheduled_anomalies_count(self, obj):
        return Anomaly.objects.filter(scheduled_slot=obj).count()

    def validate_available_hours(self, value):
        if value > 24:
            raise serializers.ValidationError("Available hours cannot exceed 24 hours per day")
        if value < 0:
            raise serializers.ValidationError("Available hours cannot be negative")
        return value


class FactoryCalendarListSerializer(serializers.ModelSerializer):
    used_hours = serializers.SerializerMethodField()
    remaining_hours = serializers.SerializerMethodField()
    utilization_percentage = serializers.FloatField(read_only=True)

    class Meta:
        model = FactoryCalendar
        fields = [
            'id', 'date', 'available_hours', 'is_available', 'used_hours',
            'remaining_hours', 'utilization_percentage'
        ]

    def get_used_hours(self, obj):
        return obj.get_used_hours()

    def get_remaining_hours(self, obj):
        return obj.get_remaining_hours()


class FactoryCalendarDetailSerializer(FactoryCalendarSerializer):
    scheduled_anomalies = serializers.SerializerMethodField()

    class Meta(FactoryCalendarSerializer.Meta):
        fields = FactoryCalendarSerializer.Meta.fields + ['scheduled_anomalies']

    def get_scheduled_anomalies(self, obj):
        from anomalies.serializers import AnomalyListSerializer
        anomalies = Anomaly.objects.filter(scheduled_slot=obj)
        return AnomalyListSerializer(anomalies, many=True).data 