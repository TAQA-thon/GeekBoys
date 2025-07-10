from rest_framework import serializers
from .models import Section, Anomaly
from calendar_slots.models import FactoryCalendar
from calendar_slots.serializers import FactoryCalendarSerializer


class SectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Section
        fields = ['id', 'name', 'description', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class AnomalySerializer(serializers.ModelSerializer):
    section_name = serializers.CharField(source='section.name', read_only=True)
    scheduled_slot_details = FactoryCalendarSerializer(source='scheduled_slot', read_only=True)
    scheduled_by_name = serializers.CharField(source='scheduled_by.get_full_name', read_only=True)
    is_high_priority = serializers.BooleanField(read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    remaining_hours = serializers.SerializerMethodField()

    class Meta:
        model = Anomaly
        fields = [
            'id', 'description', 'equipment_id', 'system_id', 'section', 'section_name',
            'criticality', 'estimated_duration', 'date_detected', 'condition',
            'scheduled_slot', 'scheduled_slot_details', 'status', 'scheduled_by',
            'scheduled_by_name', 'priority_score', 'notes', 'is_emergency',
            'is_high_priority', 'is_overdue', 'remaining_hours', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'priority_score', 'created_at', 'updated_at', 'section_name',
            'scheduled_slot_details', 'scheduled_by_name', 'is_high_priority', 'is_overdue'
        ]

    def get_remaining_hours(self, obj):
        if obj.scheduled_slot:
            return obj.scheduled_slot.get_remaining_hours()
        return None

    def validate_criticality(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError("Criticality must be between 1 and 5")
        return value

    def validate_estimated_duration(self, value):
        if value < 1:
            raise serializers.ValidationError("Estimated duration must be at least 1 hour")
        if value > 24:
            raise serializers.ValidationError("Estimated duration cannot exceed 24 hours")
        return value


class AnomalyListSerializer(serializers.ModelSerializer):
    section_name = serializers.CharField(source='section.name', read_only=True)
    scheduled_date = serializers.DateField(source='scheduled_slot.date', read_only=True)
    is_high_priority = serializers.BooleanField(read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = Anomaly
        fields = [
            'id', 'description', 'section_name', 'criticality', 'estimated_duration',
            'condition', 'status', 'scheduled_date', 'priority_score', 'is_high_priority',
            'is_overdue', 'date_detected'
        ]


class AnomalyRescheduleSerializer(serializers.ModelSerializer):
    new_slot_id = serializers.UUIDField(write_only=True)

    class Meta:
        model = Anomaly
        fields = ['new_slot_id']

    def validate_new_slot_id(self, value):
        try:
            slot = FactoryCalendar.objects.get(id=value)
            if not slot.is_available:
                raise serializers.ValidationError("Selected slot is not available")
            return value
        except FactoryCalendar.DoesNotExist:
            raise serializers.ValidationError("Invalid slot ID")

    def update(self, instance, validated_data):
        new_slot_id = validated_data.pop('new_slot_id')
        new_slot = FactoryCalendar.objects.get(id=new_slot_id)
        
        # Check if the new slot can accommodate this anomaly
        if not new_slot.can_accommodate(instance.estimated_duration):
            raise serializers.ValidationError(
                f"Selected slot cannot accommodate this anomaly (requires {instance.estimated_duration}h)"
            )
        
        # Update the anomaly
        instance.scheduled_slot = new_slot
        instance.status = 'rescheduled'
        instance.scheduled_by = self.context['request'].user
        instance.save()
        
        return instance


class AnomalyImportSerializer(serializers.Serializer):
    file = serializers.FileField()

    def validate_file(self, value):
        if not value.name.endswith(('.xlsx', '.xls')):
            raise serializers.ValidationError("Only Excel files are supported")
        return value 