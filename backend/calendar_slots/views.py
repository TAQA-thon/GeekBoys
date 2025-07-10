from django.shortcuts import render
from rest_framework import status, generics, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import FactoryCalendar
from .serializers import (
    FactoryCalendarSerializer, FactoryCalendarListSerializer,
    FactoryCalendarDetailSerializer
)
from users.permissions import IsAdmin, IsAdminOrManager
from django.utils import timezone
from datetime import timedelta


class FactoryCalendarListView(generics.ListCreateAPIView):
    """
    List and create factory calendar slots.
    """
    queryset = FactoryCalendar.objects.all()
    serializer_class = FactoryCalendarListSerializer
    permission_classes = [IsAdminOrManager]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_available']
    ordering_fields = ['date', 'available_hours', 'utilization_percentage']
    ordering = ['date']

    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date', None)
        end_date = self.request.query_params.get('end_date', None)
        
        if start_date:
            queryset = queryset.filter(date__gte=start_date)
        if end_date:
            queryset = queryset.filter(date__lte=end_date)
        
        # Filter by availability
        available = self.request.query_params.get('available', None)
        if available == 'true':
            queryset = queryset.filter(is_available=True)
        elif available == 'false':
            queryset = queryset.filter(is_available=False)
        
        # Filter by utilization
        utilization = self.request.query_params.get('utilization', None)
        if utilization == 'full':
            from django.db import models
            queryset = queryset.filter(available_hours__lte=models.F('used_hours'))
        elif utilization == 'empty':
            queryset = queryset.filter(used_hours=0)
        
        return queryset


class FactoryCalendarDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update, and delete factory calendar slots.
    """
    queryset = FactoryCalendar.objects.all()
    serializer_class = FactoryCalendarDetailSerializer
    permission_classes = [IsAdminOrManager]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        
        # Check if slot has scheduled anomalies
        from anomalies.models import Anomaly
        scheduled_anomalies = Anomaly.objects.filter(scheduled_slot=instance)
        
        if scheduled_anomalies.exists():
            return Response({
                'error': f'Cannot delete calendar slot. It has {scheduled_anomalies.count()} scheduled anomalies.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        return super().destroy(request, *args, **kwargs)


@api_view(['GET'])
@permission_classes([IsAdminOrManager])
def calendar_overview_view(request):
    """
    Get calendar overview with statistics.
    """
    # Get date range from query params or default to next 30 days
    start_date = request.query_params.get('start_date', timezone.now().date())
    end_date = request.query_params.get('end_date', timezone.now().date() + timedelta(days=30))
    
    slots = FactoryCalendar.objects.filter(date__range=[start_date, end_date])
    
    total_slots = slots.count()
    available_slots = slots.filter(is_available=True).count()
    total_hours = sum(slot.available_hours for slot in slots)
    used_hours = sum(slot.get_used_hours() for slot in slots)
    utilization_rate = (used_hours / total_hours * 100) if total_hours > 0 else 0
    
    return Response({
        'date_range': {
            'start_date': start_date,
            'end_date': end_date
        },
        'statistics': {
            'total_slots': total_slots,
            'available_slots': available_slots,
            'total_hours': total_hours,
            'used_hours': used_hours,
            'utilization_rate': round(utilization_rate, 2)
        }
    })


@api_view(['POST'])
@permission_classes([IsAdmin])
def bulk_create_slots_view(request):
    """
    Bulk create calendar slots for a date range (admin only).
    """
    start_date = request.data.get('start_date')
    end_date = request.data.get('end_date')
    available_hours = request.data.get('available_hours', 8)
    
    if not start_date or not end_date:
        return Response({
            'error': 'start_date and end_date are required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        from datetime import datetime
        start = datetime.strptime(str(start_date), '%Y-%m-%d').date()
        end = datetime.strptime(str(end_date), '%Y-%m-%d').date()
        
        created_count = 0
        current_date = start
        
        while current_date <= end:
            # Skip weekends (optional)
            skip_weekends = request.data.get('skip_weekends', False)
            if skip_weekends and current_date.weekday() >= 5:  # Saturday = 5, Sunday = 6
                current_date += timedelta(days=1)
                continue
            
            # Create slot if it doesn't exist
            slot, created = FactoryCalendar.objects.get_or_create(
                date=current_date,
                defaults={
                    'available_hours': available_hours,
                    'is_available': True
                }
            )
            
            if created:
                created_count += 1
            
            current_date += timedelta(days=1)
        
        return Response({
            'message': f'Successfully created {created_count} calendar slots',
            'created_count': created_count
        })
        
    except ValueError:
        return Response({
            'error': 'Invalid date format. Use YYYY-MM-DD'
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAdminOrManager])
def slot_availability_view(request):
    """
    Get available slots for a specific duration.
    """
    duration = request.query_params.get('duration', 4)
    start_date = request.query_params.get('start_date', timezone.now().date())
    
    try:
        duration = int(duration)
        if duration <= 0:
            raise ValueError("Duration must be positive")
    except ValueError:
        return Response({
            'error': 'Invalid duration. Must be a positive integer.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Find slots that can accommodate the duration
    available_slots = []
    current_date = timezone.datetime.strptime(str(start_date), '%Y-%m-%d').date()
    
    for i in range(30):  # Look ahead 30 days
        target_date = current_date + timedelta(days=i)
        
        try:
            slot = FactoryCalendar.objects.get(date=target_date)
            if slot.can_accommodate(duration):
                available_slots.append({
                    'id': slot.id,
                    'date': slot.date,
                    'available_hours': slot.available_hours,
                    'remaining_hours': slot.get_remaining_hours(),
                    'utilization_percentage': slot.utilization_percentage
                })
        except FactoryCalendar.DoesNotExist:
            # Create a default slot
            slot = FactoryCalendar.objects.create(
                date=target_date,
                available_hours=8,
                is_available=True
            )
            available_slots.append({
                'id': slot.id,
                'date': slot.date,
                'available_hours': slot.available_hours,
                'remaining_hours': slot.get_remaining_hours(),
                'utilization_percentage': slot.utilization_percentage
            })
    
    return Response({
        'duration': duration,
        'available_slots': available_slots
    })
