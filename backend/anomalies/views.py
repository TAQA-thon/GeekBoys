from django.shortcuts import render
from rest_framework import status, generics, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count, Q, Avg, F, ExpressionWrapper, DurationField
from datetime import datetime
from .models import Section, Anomaly
from .serializers import (
    SectionSerializer, AnomalySerializer, AnomalyListSerializer,
    AnomalyRescheduleSerializer, AnomalyImportSerializer
)
from .services import AnomalySchedulingService, AnomalyImportService
from users.permissions import IsAdmin, IsAdminOrManager
import tempfile
import os
from django.utils import timezone
from datetime import timedelta
from django.http import JsonResponse
import logging
from rest_framework.parsers import MultiPartParser
import pandas as pd
from django.core.files.base import ContentFile
from django.utils.timezone import now
from anomalies.mongodb_service import get_mongodb_service

logger = logging.getLogger(__name__)


class SectionListView(generics.ListCreateAPIView):
    """
    List and create sections (admin only for creation).
    """
    queryset = Section.objects.all()
    serializer_class = SectionSerializer
    permission_classes = [IsAdminOrManager]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'description']


class SectionDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update, and delete sections (admin only for modification).
    """
    queryset = Section.objects.all()
    serializer_class = SectionSerializer
    permission_classes = [IsAdminOrManager]


class AnomalyListView(generics.ListCreateAPIView):
    """
    List and create anomalies.
    """
    queryset = Anomaly.objects.all()
    serializer_class = AnomalyListSerializer
    permission_classes = [IsAdminOrManager]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'condition', 'section', 'is_emergency']
    search_fields = ['description', 'notes']
    ordering_fields = ['date_detected', 'priority_score', 'criticality']
    ordering = ['-date_detected']

    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by priority
        priority = self.request.query_params.get('priority', None)
        if priority == 'high':
            queryset = queryset.filter(priority_score__gte=15)
        elif priority == 'low':
            queryset = queryset.filter(priority_score__lt=15)
        
        # Filter by overdue
        overdue = self.request.query_params.get('overdue', None)
        if overdue == 'true':
            queryset = queryset.filter(date_detected__lt=timezone.now() - timedelta(days=30))
        
        return queryset


class AnomalyDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update, and delete anomalies.
    """
    queryset = Anomaly.objects.all()
    serializer_class = AnomalySerializer
    permission_classes = [IsAdminOrManager]

    def perform_update(self, serializer):
        anomaly = serializer.save()
        # Auto-schedule if not already scheduled
        if not anomaly.scheduled_slot:
            AnomalySchedulingService.auto_schedule_anomaly(anomaly)


class AnomalyRescheduleView(generics.UpdateAPIView):
    """
    Reschedule an anomaly to a new slot.
    """
    queryset = Anomaly.objects.all()
    serializer_class = AnomalyRescheduleSerializer
    permission_classes = [IsAdminOrManager]

    def update(self, request, *args, **kwargs):
        anomaly = self.get_object()
        serializer = self.get_serializer(anomaly, data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            updated_anomaly = serializer.save()
            return Response({
                'message': 'Anomaly rescheduled successfully',
                'anomaly': AnomalySerializer(updated_anomaly).data
            })
        except Exception as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAdminOrManager])
def unassigned_anomalies_view(request):
    """
    Get all anomalies that haven't been scheduled yet.
    """
    anomalies = AnomalySchedulingService.get_unassigned_anomalies()
    serializer = AnomalyListSerializer(anomalies, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAdminOrManager])
def overdue_anomalies_view(request):
    """
    Get anomalies that are overdue (30+ days since detection).
    """
    anomalies = AnomalySchedulingService.get_overdue_anomalies()
    serializer = AnomalyListSerializer(anomalies, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAdminOrManager])
def high_priority_anomalies_view(request):
    """
    Get anomalies with high priority scores.
    """
    anomalies = AnomalySchedulingService.get_high_priority_anomalies()
    serializer = AnomalyListSerializer(anomalies, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAdminOrManager])
def scheduled_anomalies_view(request):
    """
    Get all anomalies that have been scheduled.
    """
    anomalies = Anomaly.objects.filter(scheduled_slot__isnull=False)
    serializer = AnomalyListSerializer(anomalies, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAdminOrManager])
def anomalies_by_section_view(request, section_id):
    """
    Get anomalies filtered by section.
    """
    try:
        from .models import Section
        section = Section.objects.get(id=section_id)
        anomalies = Anomaly.objects.filter(section=section)
        serializer = AnomalyListSerializer(anomalies, many=True)
        return Response(serializer.data)
    except Section.DoesNotExist:
        return Response({'error': 'Section not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([IsAdminOrManager])
def import_anomalies_view(request):
    """
    Import anomalies from Excel file (admin only).
    Only accepts Excel files for security reasons.
    Supports both multipart/form-data and binary file uploads.
    """
    # Handle different upload methods
    uploaded_file = None
    
    # Method 1: Check for multipart/form-data upload
    if 'file' in request.FILES:
        uploaded_file = request.FILES['file']
    # Method 2: Check for binary upload (Excel MIME types)
    elif request.content_type in [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/octet-stream'
    ]:
        # Create a file-like object from the request body
        uploaded_file = ContentFile(request.body, name='uploaded_file.xlsx')
    else:
        return Response({
            'error': 'No file uploaded or unsupported content type. Use multipart/form-data or upload Excel file directly.',
            'success': False
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Security: Validate file type - only accept Excel files
    allowed_extensions = ['.xlsx', '.xls']
    file_extension = os.path.splitext(uploaded_file.name)[1].lower()
    
    if file_extension not in allowed_extensions:
        return Response({
            'error': 'Only Excel files (.xlsx, .xls) are allowed for security reasons.',
            'success': False
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Additional security: Check file signature (magic bytes)
    try:
        import magic
        file_content = uploaded_file.read(1024)  # Read first 1KB
        uploaded_file.seek(0)  # Reset file pointer
        
        # Check if it's actually an Excel file
        mime_type = magic.from_buffer(file_content, mime=True)
        if mime_type not in ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
                           'application/vnd.ms-excel']:
            return Response({
                'error': 'Invalid file type. Only Excel files are allowed.',
                'success': False
            }, status=status.HTTP_400_BAD_REQUEST)
    except ImportError:
        # If python-magic is not available, skip MIME type checking
        pass
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as temp_file:
        for chunk in uploaded_file.chunks():
            temp_file.write(chunk)
        temp_file_path = temp_file.name
    
    try:
        # Import anomalies to MongoDB
        result = AnomalyImportService.import_from_excel(temp_file_path)
        
        return Response({
            'message': result.get('message', f"Import completed. {result['imported_count']} anomalies imported to MongoDB."),
            'imported_count': result['imported_count'],
            'errors': result['errors'],
            'success': result['success'],
            'mongodb_ids': result.get('mongodb_ids', []),
            'upload_method': 'multipart/form-data' if 'file' in request.FILES else 'binary'
        })
        
    except Exception as e:
        return Response({
            'error': f"Import failed: {str(e)}"
        }, status=status.HTTP_400_BAD_REQUEST)
        
    finally:
        # Clean up temporary file
        if os.path.exists(temp_file_path):
            os.unlink(temp_file_path)


@api_view(['POST'])
@permission_classes([IsAdminOrManager])
def auto_schedule_all_view(request):
    """
    Auto-schedule all unassigned anomalies.
    """
    unassigned_anomalies = AnomalySchedulingService.get_unassigned_anomalies()
    scheduled_count = 0
    failed_count = 0
    
    for anomaly in unassigned_anomalies:
        if AnomalySchedulingService.auto_schedule_anomaly(anomaly):
            scheduled_count += 1
        else:
            failed_count += 1
    
    return Response({
        'message': f"Auto-scheduling completed. {scheduled_count} scheduled, {failed_count} failed.",
        'scheduled_count': scheduled_count,
        'failed_count': failed_count
    })


@api_view(['GET'])
@permission_classes([IsAdminOrManager])
def schedule_overview_view(request):
    """
    Get summary of scheduled vs. unscheduled anomalies, per section and per date.
    """
    # Get date range from query params or default to next 30 days
    start_date = request.query_params.get('start_date', timezone.now().date())
    end_date = request.query_params.get('end_date', timezone.now().date() + timedelta(days=30))
    
    # Overall statistics
    total_anomalies = Anomaly.objects.count()
    scheduled_anomalies = Anomaly.objects.filter(scheduled_slot__isnull=False).count()
    unscheduled_anomalies = Anomaly.objects.filter(scheduled_slot__isnull=True).count()
    overdue_anomalies = AnomalySchedulingService.get_overdue_anomalies().count()
    high_priority_anomalies = AnomalySchedulingService.get_high_priority_anomalies().count()
    
    # Statistics by section
    section_stats = []
    sections = Section.objects.all()
    for section in sections:
        section_anomalies = Anomaly.objects.filter(section=section)
        section_stats.append({
            'section_id': section.id,
            'section_name': section.name,
            'total': section_anomalies.count(),
            'scheduled': section_anomalies.filter(scheduled_slot__isnull=False).count(),
            'unscheduled': section_anomalies.filter(scheduled_slot__isnull=True).count(),
            'overdue': section_anomalies.filter(date_detected__lt=timezone.now() - timedelta(days=30)).count(),
        })
    
    # Statistics by date range
    date_range_stats = {
        'start_date': start_date,
        'end_date': end_date,
        'total_slots': 0,
        'utilized_slots': 0,
        'total_hours_available': 0,
        'total_hours_used': 0,
    }
    
    from calendar_slots.models import FactoryCalendar
    slots_in_range = FactoryCalendar.objects.filter(date__range=[start_date, end_date])
    date_range_stats['total_slots'] = slots_in_range.count()
    
    # Count slots that have anomalies scheduled
    utilized_slots = 0
    for slot in slots_in_range:
        if Anomaly.objects.filter(scheduled_slot=slot).exists():
            utilized_slots += 1
    date_range_stats['utilized_slots'] = utilized_slots
    
    date_range_stats['total_hours_available'] = sum(slot.available_hours for slot in slots_in_range)
    date_range_stats['total_hours_used'] = sum(slot.get_used_hours() for slot in slots_in_range)
    
    return Response({
        'overall_statistics': {
            'total_anomalies': total_anomalies,
            'scheduled_anomalies': scheduled_anomalies,
            'unscheduled_anomalies': unscheduled_anomalies,
            'overdue_anomalies': overdue_anomalies,
            'high_priority_anomalies': high_priority_anomalies,
            'scheduling_rate': round((scheduled_anomalies / total_anomalies * 100) if total_anomalies > 0 else 0, 2)
        },
        'section_statistics': section_stats,
        'date_range_statistics': date_range_stats
    })


@api_view(['GET'])
@permission_classes([IsAdminOrManager])
def calendar_view_view(request):
    """
    Get all anomalies grouped by calendar day for rendering calendar UI.
    """
    # Get date range from query params or default to next 30 days
    start_date = request.query_params.get('start_date', timezone.now().date())
    end_date = request.query_params.get('end_date', timezone.now().date() + timedelta(days=30))
    
    from calendar_slots.models import FactoryCalendar
    
    calendar_data = []
    current_date = timezone.datetime.strptime(str(start_date), '%Y-%m-%d').date()
    end = timezone.datetime.strptime(str(end_date), '%Y-%m-%d').date()
    
    while current_date <= end:
        try:
            slot = FactoryCalendar.objects.get(date=current_date)
            anomalies = Anomaly.objects.filter(scheduled_slot=slot)
            
            calendar_data.append({
                'date': current_date,
                'slot_id': slot.id,
                'available_hours': slot.available_hours,
                'remaining_hours': slot.get_remaining_hours(),
                'utilization_percentage': slot.utilization_percentage,
                'is_available': slot.is_available,
                'anomalies': AnomalyListSerializer(anomalies, many=True).data
            })
        except FactoryCalendar.DoesNotExist:
            # Create a default slot for this date
            slot = FactoryCalendar.objects.create(
                date=current_date,
                available_hours=8,
                is_available=True
            )
            calendar_data.append({
                'date': current_date,
                'slot_id': slot.id,
                'available_hours': slot.available_hours,
                'remaining_hours': slot.get_remaining_hours(),
                'utilization_percentage': slot.utilization_percentage,
                'is_available': slot.is_available,
                'anomalies': []
            })
        
        current_date += timedelta(days=1)
    
    return Response({
        'date_range': {
            'start_date': start_date,
            'end_date': end_date
        },
        'calendar_data': calendar_data
    })


# MongoDB-specific endpoints
@api_view(['GET'])
@permission_classes([IsAdminOrManager])
def mongodb_anomalies_view(request):
    """
    Get anomalies from MongoDB.
    
    Query Parameters:
    - start: starting index for pagination
    - end: ending index for pagination
    - approved: filter by approval status (true/false)
    - status: filter by anomaly status
    - get_all: whether to get all anomalies (limited to 10000)
    """
    try:
        from .mongodb_service import get_mongodb_service
        
        # Get query parameters
        start = int(request.query_params.get('start', 0))
        end = int(request.query_params.get('end', 10))
        approved_param = request.query_params.get('approved')
        status_param = request.query_params.get('status')
        get_all = request.query_params.get('get_all', 'false').lower() == 'true'
        
        # Calculate skip and limit for backend query
        skip = start
        limit = end - start
        
        # Validate parameters
        if get_all:
            # For statistics purposes, allow getting all anomalies
            limit = 10000  # Set a very high limit
        elif limit > 1000:
            limit = 1000  # Cap at 1000 for performance
        
        # Parse approved parameter
        approved = None
        if approved_param is not None:
            if approved_param.lower() in ['true', '1', 'yes']:
                approved = True
            elif approved_param.lower() in ['false', '0', 'no']:
                approved = False
        
        # Get status filter if provided
        status = status_param if status_param else None
        
        mongodb_service = get_mongodb_service()
        anomalies = mongodb_service.get_anomalies(limit=limit, skip=skip, approved=approved, status=status)
        
        # Get total count for this filter set
        total_count = mongodb_service.get_total_anomaly_count(approved=approved, status=status)
        
        return Response({
            'anomalies': anomalies,
            'count': len(anomalies),
            'total_count': total_count,
            'start': start,
            'end': end,
            'filtered_by_approved': approved,
            'filtered_by_status': status
        })
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAdminOrManager])
def mongodb_anomaly_detail_view(request, anomaly_id):
    """
    Get a specific anomaly from MongoDB by ID.
    """
    try:
        from .mongodb_service import get_mongodb_service
        
        mongodb_service = get_mongodb_service()
        anomaly = mongodb_service.get_anomaly_by_id(anomaly_id)
        
        if not anomaly:
            return Response({
                'error': 'Anomaly not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        return Response(anomaly)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAdminOrManager])
def mongodb_statistics_view(request):
    """
    Get statistics from MongoDB anomalies collection.
    """
    if request.method == 'GET':
        try:
            from .mongodb_service import get_mongodb_service
            
            mongodb_service = get_mongodb_service()
            statistics = mongodb_service.get_statistics()
            
            return JsonResponse({
                'success': True,
                'statistics': statistics
            })
        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': str(e)
            }, status=500)


@api_view(['GET'])
@permission_classes([IsAdminOrManager])
def mongodb_anomaly_count_view(request):
    """
    Get count of anomalies in MongoDB with optional filtering by criticality, status, and approval.
    
    Query Parameters:
    - criticality (int, optional): Filter by criticality level (1, 2, 3, or -1)
    - status (string, optional): Filter by status (pending, open, in_progress, resolved, etc.)
    - approved (bool, optional): Filter by approval status (true/false)
    """
    if request.method == 'GET':
        try:
            from .mongodb_service import get_mongodb_service
            
            mongodb_service = get_mongodb_service()
            
            # Get filter parameters from query string
            criticality_param = request.GET.get('criticality')
            status_param = request.GET.get('status')
            approved_param = request.GET.get('approved')
            
            # Parse approved parameter if provided
            approved = None
            if approved_param is not None:
                if approved_param.lower() in ['true', '1', 'yes']:
                    approved = True
                elif approved_param.lower() in ['false', '0', 'no']:
                    approved = False
            
            # Get status filter if provided
            status = status_param if status_param else None
            
            # If criticality parameter is provided, filter by that
            if criticality_param is not None:
                try:
                    criticality = int(criticality_param)
                    # Validate criticality value
                    if criticality not in [-1, 1, 2, 3, 4, 5, 6, 7, 8, 9]:
                        return JsonResponse({
                            'success': False,
                            'error': 'Criticality must be -1, 1, 2, 3, etc.'
                        }, status=400)
                    
                    # Get count filtered by criticality and any other filters
                    count = mongodb_service.get_anomaly_count_by_criticality(criticality, status=status, approved=approved)
                    
                    return JsonResponse({
                        'success': True,
                        'count': count,
                        'criticality': criticality,
                        'status': status,
                        'approved': approved,
                        'message': f'Found {count} anomalies matching the filters'
                    })
                    
                except ValueError:
                    return JsonResponse({
                        'success': False,
                        'error': 'Criticality parameter must be a valid integer'
                    }, status=400)
            else:
                # Get total count of all anomalies with filters
                count = mongodb_service.get_total_anomaly_count(status=status, approved=approved)
                
                return JsonResponse({
                    'success': True,
                    'count': count,
                    'status': status,
                    'approved': approved,
                    'message': f'Found {count} anomalies matching the filters'
                })
                
        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': str(e)
            }, status=500)


# get anomalies by system
@api_view(['GET'])
@permission_classes([IsAdminOrManager])
def anomalies_by_system_view(request, unit_id):
    """
    Get anomalies by system.
    
    Query Parameters:
    - limit (int, optional): Number of documents to return (default: 100, max: 1000)
    - skip (int, optional): Number of documents to skip (default: 0)
    """
    try:
        from .mongodb_service import get_mongodb_service
        
        # Get query parameters
        limit = int(request.query_params.get('limit', 100))
        skip = int(request.query_params.get('skip', 0))
        get_all = request.query_params.get('get_all', 'false').lower() == 'true'
        
        # Validate parameters
        if get_all:
            # For statistics purposes, allow getting all anomalies
            limit = 10000  # Set a very high limit
        elif limit > 1000:
            limit = 1000  # Cap at 1000 for performance
        
        mongodb_service = get_mongodb_service()
        anomalies = mongodb_service.get_anomalies_by_system(unit_id, limit=limit, skip=skip)
        
        return Response({
            'success': True,
            'unit_id': unit_id,
            'anomalies': anomalies,
            'count': len(anomalies),
            'limit': limit,
            'skip': skip,
            'message': f'Retrieved {len(anomalies)} anomalies from system {unit_id}'
        })
        
    except ValueError as e:
        return Response({
            'success': False,
            'error': 'Invalid query parameters. limit and skip must be integers.'
        }, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# get count of anomalies by system
@api_view(['GET'])
@permission_classes([IsAdminOrManager])
def anomalies_by_system_count_view(request, unit_id):
    """
    Get count of anomalies by system.
    """
    try:
        from .mongodb_service import get_mongodb_service
        
        mongodb_service = get_mongodb_service()
        count = mongodb_service.get_anomaly_count_by_system(unit_id)

        logger.info ("count = ", count)
        
        return Response({
            'success': True,
            'unit_id': unit_id,
            'count': count,
            'message': f'Found {count} anomalies in system {unit_id}'
        })
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['PATCH'])
@permission_classes([IsAdminOrManager])
def mongodb_approve_anomaly_view(request, anomaly_id):
    """
    Approve an anomaly in MongoDB (set 'Approved' to True) in all collections, then add to scheduling queue.
    """
    try:
        from .mongodb_service import get_mongodb_service
        mongodb_service = get_mongodb_service()
        updated_count = mongodb_service.update_anomaly_all_collections(anomaly_id, {'Approved': True})
        if updated_count == 0:
            return Response({'success': False, 'error': 'Anomaly not found or not updated'}, status=status.HTTP_404_NOT_FOUND)
        
        # Add to approved anomalies queue
        queue_result = mongodb_service.add_approved_anomaly_to_queue(anomaly_id)
        if not queue_result['success']:
            return Response({'success': False, 'error': f'Failed to add to queue: {queue_result["error"]}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Check if any approved anomalies can be scheduled now
        schedule_result = mongodb_service.check_and_schedule_approved_anomalies()
        
        msg = f'Anomaly {anomaly_id} approved in {updated_count} collections and added to scheduling queue.'
        if schedule_result['scheduled'] > 0:
            msg += f' {schedule_result["scheduled"]} approved anomalies were scheduled.'
        
        return Response({'success': True, 'message': msg, 'scheduled_count': schedule_result['scheduled']})
    except Exception as e:
        return Response({'success': False, 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['PATCH'])
@permission_classes([IsAdminOrManager])
def mongodb_edit_anomaly_view(request, anomaly_id):
    """
    Edit an anomaly in MongoDB. Allows admin/manager to update fields in all collections.
    If the anomaly is approved, it will be added to the approved queue for scheduling.
    """
    try:
        from .mongodb_service import get_mongodb_service
        mongodb_service = get_mongodb_service()
        update_data = request.data.copy()
        
        # Check if this update includes approval
        is_approved = (
            update_data.get('Approved') == True or 
            update_data.get('approved') == True or 
            update_data.get('status') == 'Approved' or
            update_data.get('status') == 'approved'
        )
        
        # Update the anomaly
        updated_count = mongodb_service.update_anomaly_all_collections(anomaly_id, update_data)
        if updated_count == 0:
            return Response({'success': False, 'error': 'Anomaly not found or not updated'}, status=status.HTTP_404_NOT_FOUND)
        
        # If the anomaly was approved, add it to the approved queue and try to schedule it
        queue_message = ""
        scheduled_message = ""
        if is_approved:
            queue_result = mongodb_service.add_approved_anomaly_to_queue(anomaly_id)
            if queue_result.get('success'):
                queue_message = f" Anomaly added to approved queue for scheduling."
                
                # Try to schedule the approved anomaly immediately
                schedule_result = mongodb_service.check_and_schedule_approved_anomalies()
                if schedule_result.get('scheduled', 0) > 0:
                    scheduled_message = f" {schedule_result['scheduled']} approved anomalies were scheduled to available slots."
                else:
                    scheduled_message = f" No available slots found for immediate scheduling."
            else:
                queue_message = f" Warning: Could not add to approved queue: {queue_result.get('error')}"
        
        return Response({
            'success': True, 
            'message': f'Anomaly {anomaly_id} updated in {updated_count} collections.{queue_message}{scheduled_message}'
        })
    except Exception as e:
        return Response({'success': False, 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAdminOrManager])
def mongodb_unit_count_view(request):
    """
    Get the count of all unit_* collections (number of unique units/systems).
    """
    try:
        from .mongodb_service import get_mongodb_service
        mongodb_service = get_mongodb_service()
        unit_collections = [name for name in mongodb_service.db.list_collection_names() if name.startswith('unit_')]
        return Response({'success': True, 'unit_count': len(unit_collections)})
    except Exception as e:
        return Response({'success': False, 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAdminOrManager])
def mongodb_time_slots_import_view(request):
    """
    Import time slots from an Excel file and append to MongoDB, skipping overlaps.
    After insertion, checks for approved anomalies that can be scheduled to the new slots.
    Supports both multipart/form-data and binary file uploads.
    """
    from .mongodb_service import get_mongodb_service
    
    # Handle different upload methods
    file = None
    
    # Method 1: Check for multipart/form-data upload
    if 'file' in request.FILES:
        file = request.FILES['file']
    # Method 2: Check for binary upload (Excel MIME types)
    elif request.content_type in [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/octet-stream'
    ]:
        # Create a file-like object from the request body
        file = ContentFile(request.body, name='uploaded_file.xlsx')
    else:
        return Response({
            'success': False, 
            'error': 'No file uploaded or unsupported content type. Use multipart/form-data or upload Excel file directly.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        df = pd.read_excel(file)
        # Map columns (French to English or keep as-is)
        col_map = {
            "Date début d'Arrét (Window)": 'start_date',
            "Date fin d'Arrét (Window)": 'end_date',
            'Durée en Jr': 'duration_days',
            'Durée en H': 'duration_hours',
        }
        df = df.rename(columns=col_map)
        # Convert dates to ISO format
        df['start_date'] = pd.to_datetime(df['start_date']).dt.strftime('%Y-%m-%d')
        df['end_date'] = pd.to_datetime(df['end_date']).dt.strftime('%Y-%m-%d')
        slots_data = df.to_dict(orient='records')
        mongodb_service = get_mongodb_service()
        result = mongodb_service.insert_time_slots(slots_data)
        
        # Build response message
        message = f"Time slots imported successfully. {result['inserted']} inserted, {result['skipped']} skipped."
        if result.get('scheduled_from_queue', 0) > 0:
            message += f" {result['scheduled_from_queue']} approved anomalies were scheduled from queue."
        if result.get('rescheduled_from_later', 0) > 0:
            message += f" {result['rescheduled_from_later']} existing anomalies were rescheduled to earlier slots."
        
        return Response({
            'success': True, 
            'message': message,
            'inserted': result['inserted'], 
            'skipped': result['skipped'],
            'scheduled_from_queue': result.get('scheduled_from_queue', 0),
            'rescheduled_from_later': result.get('rescheduled_from_later', 0),
            'upload_method': 'multipart/form-data' if 'file' in request.FILES else 'binary'
        })
    except Exception as e:
        return Response({
            'success': False, 
            'error': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAdminOrManager])
def mongodb_time_slots_list_view(request):
    """
    List all available time slots from MongoDB.
    """
    from .mongodb_service import get_mongodb_service
    mongodb_service = get_mongodb_service()
    slots = mongodb_service.get_time_slots()
    return Response({'success': True, 'time_slots': slots})


@api_view(['PATCH'])
@permission_classes([IsAdminOrManager])
def mongodb_time_slot_update_view(request, slot_id):
    """
    Update a time slot in MongoDB by _id. Ensures no overlap with other slots. Reschedules anomalies as needed.
    """
    from .mongodb_service import get_mongodb_service
    mongodb_service = get_mongodb_service()
    update_data = request.data.copy()
    result = mongodb_service.update_time_slot(slot_id, update_data)
    if result['success']:
        return Response({'success': True, 'message': f'Time slot {slot_id} updated successfully.'})
    else:
        return Response({'success': False, 'error': result['error']}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAdminOrManager])
def mongodb_time_slot_create_view(request):
    """
    Create a new time slot in MongoDB, merging with any overlapping slots.
    Automatically schedules approved anomalies and reschedules existing anomalies to earlier slots when possible.
    """
    from .mongodb_service import get_mongodb_service
    mongodb_service = get_mongodb_service()
    slot_data = request.data.copy()
    result = mongodb_service.create_time_slot(slot_data)
    if result['success']:
        message = 'Time slot created successfully.'
        if result.get('scheduled_from_queue', 0) > 0:
            message += f' {result["scheduled_from_queue"]} approved anomalies were scheduled.'
        if result.get('rescheduled_from_later', 0) > 0:
            message += f' {result["rescheduled_from_later"]} existing anomalies were rescheduled to this earlier slot.'
        
        return Response({
            'success': True, 
            'message': message, 
            'slot_id': result.get('slot_id'),
            'scheduled_from_queue': result.get('scheduled_from_queue', 0),
            'rescheduled_from_later': result.get('rescheduled_from_later', 0)
        })
    else:
        return Response({'success': False, 'error': result['error']}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAdminOrManager])
def mongodb_approved_queue_view(request):
    """
    Get all approved anomalies in the scheduling queue.
    """
    try:
        from .mongodb_service import get_mongodb_service
        mongodb_service = get_mongodb_service()
        queue = mongodb_service.get_approved_anomalies_queue()
        
        # Get full anomaly details for each queue entry
        queue_with_details = []
        for entry in queue:
            anomaly = mongodb_service.get_anomaly_by_id(entry['anomaly_id'])
            if anomaly:
                entry['anomaly_details'] = anomaly
            queue_with_details.append(entry)
        
        return Response({
            'success': True,
            'queue': queue_with_details,
            'count': len(queue_with_details)
        })
    except Exception as e:
        return Response({'success': False, 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAdminOrManager])
def mongodb_check_schedule_queue_view(request):
    """
    Manually check and schedule approved anomalies from the queue.
    This can be used to force scheduling when automatic scheduling doesn't work.
    """
    try:
        from .mongodb_service import get_mongodb_service
        mongodb_service = get_mongodb_service()
        
        # Check and schedule approved anomalies
        result = mongodb_service.check_and_schedule_approved_anomalies()
        
        return Response({
            'success': True,
            'message': result.get('message', 'Scheduling check completed'),
            'scheduled_count': result.get('scheduled', 0)
        })
    except Exception as e:
        return Response({'success': False, 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
@permission_classes([IsAdminOrManager])
def mongodb_remove_from_queue_view(request, anomaly_id):
    """
    Remove an anomaly from the approved anomalies queue.
    """
    try:
        from .mongodb_service import get_mongodb_service
        mongodb_service = get_mongodb_service()
        removed = mongodb_service.remove_anomaly_from_queue(anomaly_id)
        
        if removed:
            return Response({
                'success': True,
                'message': f'Anomaly {anomaly_id} removed from scheduling queue.'
            })
        else:
            return Response({
                'success': False,
                'error': 'Anomaly not found in queue or already removed.'
            }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'success': False, 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
@permission_classes([IsAdminOrManager])
def mongodb_time_slot_delete_view(request, slot_id):
    """
    Delete a time slot and reschedule all anomalies that were scheduled to it.
    If anomalies can't be rescheduled, they are added back to the approved queue.
    """
    try:
        print(f"DEBUG: Starting delete process for slot {slot_id}")
        from .mongodb_service import get_mongodb_service
        mongodb_service = get_mongodb_service()
        print(f"DEBUG: MongoDB service created, calling delete_time_slot")
        result = mongodb_service.delete_time_slot(slot_id)
        print(f"DEBUG: delete_time_slot returned: {result}")
        
        if result['success']:
            return Response({
                'success': True,
                'message': result['message'],
                'rescheduled': result['rescheduled'],
                'queued': result['queued']
            })
        else:
            return Response({
                'success': False,
                'error': result['error']
            }, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        print(f"DEBUG: Exception in delete endpoint: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response({'success': False, 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAdminOrManager])
def mongodb_analytics_view(request):
    """
    Get analytics data for visualizations.
    
    Query Parameters:
    - period (str, optional): Time period for trend data ('7months', '1year', default: '1year')
    - start_date (str, optional): Start date in 'YYYY-MM-DD' format
    - end_date (str, optional): End date in 'YYYY-MM-DD' format
    """
    print('=== MONGODB_ANALYTICS_VIEW CALLED ===')
    try:
        from .mongodb_service import get_mongodb_service
        
        mongodb_service = get_mongodb_service()
        period = request.query_params.get('period', '1year')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        # If both start_date and end_date are provided, use them
        if start_date and end_date:
            analytics_data = mongodb_service.get_analytics_data(period, start_date, end_date)
        else:
            analytics_data = mongodb_service.get_analytics_data(period)
        
        return Response({
            'success': True,
            'analytics': analytics_data
        })
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['PATCH'])
@permission_classes([IsAdminOrManager])
def mongodb_update_anomaly_status_view(request, anomaly_id):
    """
    Update anomaly status in MongoDB with REX (solution) handling.
    When status changes to 'resolved', requires REX (solution) to be provided.
    """
    try:
        from .mongodb_service import get_mongodb_service
        mongodb_service = get_mongodb_service()
        
        new_status = request.data.get('status')
        rex_solution = request.data.get('rex', '').strip()
        
        if not new_status:
            return Response({
                'success': False, 
                'error': 'Status is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate status values
        valid_statuses = ['open', 'in_progress', 'resolved', 'cancelled']
        if new_status.lower() not in valid_statuses:
            return Response({
                'success': False, 
                'error': f'Invalid status. Must be one of: {", ".join(valid_statuses)}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # If status is being changed to resolved, REX is required
        if new_status.lower() == 'resolved' and not rex_solution:
            return Response({
                'success': False, 
                'error': 'REX (solution) is required when marking anomaly as resolved'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Prepare update data
        update_data = {
            'status': new_status.lower(),
            'updated_at': datetime.utcnow()
        }
        
        # Add REX/solution if provided
        if rex_solution:
            update_data['Solution'] = rex_solution
            update_data['rex'] = rex_solution  # Also store in rex field for compatibility
        
        # Update the anomaly
        updated_count = mongodb_service.update_anomaly_all_collections(anomaly_id, update_data)
        if updated_count == 0:
            return Response({
                'success': False, 
                'error': 'Anomaly not found or not updated'
            }, status=status.HTTP_404_NOT_FOUND)
        
        response_message = f'Anomaly status updated to "{new_status}" in {updated_count} collections'
        if rex_solution:
            response_message += ' with REX solution'
        
        return Response({
            'success': True, 
            'message': response_message,
            'status': new_status,
            'rex': rex_solution if rex_solution else None
        })
        
    except Exception as e:
        logger.error(f"Error updating anomaly status {anomaly_id}: {str(e)}")
        return Response({
            'success': False, 
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['PATCH'])
@permission_classes([IsAdminOrManager])
def mongodb_time_slot_reschedule_view(request, slot_id):
    """
    Manually trigger rescheduling of anomalies to this slot from later slots.
    This can be used to force rescheduling when automatic rescheduling doesn't work.
    """
    try:
        from .mongodb_service import get_mongodb_service
        mongodb_service = get_mongodb_service()
        
        # Trigger rescheduling to this specific slot
        result = mongodb_service.check_and_reschedule_to_earlier_slot(slot_id)
        
        return Response({
            'success': True,
            'message': result.get('message', 'Rescheduling check completed'),
            'rescheduled_count': result.get('rescheduled', 0)
        })
    except Exception as e:
        return Response({'success': False, 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAdminOrManager])
def report_summary_view(request):
    try:
    mongo = get_mongodb_service()
    total = mongo.collection.count_documents({})
    open_count = mongo.collection.count_documents({'status': 'open'})
    resolved_count = mongo.collection.count_documents({'status': 'resolved'})
    in_progress_count = mongo.collection.count_documents({'status': 'in_progress'})
    critical_count = mongo.collection.count_documents({'criticality': {'$gt': 9}})
    # Average resolution time (in days)
    pipeline = [
        {"$match": {"status": "resolved", "Date de détéction de l'anomalie": {"$exists": True}, "updated_at": {"$exists": True}}},
        {"$project": {
            "created": {"$toDate": "$Date de détéction de l'anomalie"},
            "updated": {"$toDate": "$updated_at"}
        }},
        {"$project": {
            "diff": {"$divide": [{"$subtract": ["$updated", "$created"]}, 1000 * 60 * 60 * 24]}
        }},
        {"$group": {"_id": None, "avg": {"$avg": "$diff"}}}
    ]
    avg_res = list(mongo.collection.aggregate(pipeline))
    avg_days = round(avg_res[0]['avg'], 2) if avg_res else 0
    result = {
        'total_anomalies': total,
        'open_anomalies': open_count,
        'resolved_anomalies': resolved_count,
        'critical_anomalies': critical_count,
        'in_progress_anomalies': in_progress_count,
        'avg_resolution_time': avg_days,
    }
    print('Report summary output:', result)
    return Response(result)
    except Exception as e:
        print(f'Error in report_summary_view: {str(e)}')
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAdminOrManager])
def report_trends_view(request):
    mongo = get_mongodb_service()
    date_field = "Date de détéction de l'anomalie"
    start = request.query_params.get('start')
    end = request.query_params.get('end')
    status = request.query_params.get('status')
    period = request.query_params.get('period', 'auto')  # 'auto', 'monthly', 'daily'

    # 1. Build match filter
    match = {}
    if status:
        match['status'] = status
    if start and end:
        match[date_field] = {"$gte": start, "$lte": end}

    # 2. Fetch all matching docs
    docs = list(mongo.collection.find(match))
    # 3. Parse dates and group
    date_counts = {}
    date_format = "%Y-%m-%d"
    if start and end:
        try:
            start_dt = datetime.strptime(start, "%Y-%m-%d")
            end_dt = datetime.strptime(end, "%Y-%m-%d")
        except Exception:
            start_dt = datetime(2019, 1, 1)
            end_dt = datetime(2019, 12, 31)
    else:
        # fallback: use all data
        all_dates = [d.get(date_field) for d in docs if d.get(date_field)]
        if all_dates:
            start_dt = datetime.strptime(min(all_dates)[:10], "%Y-%m-%d")
            end_dt = datetime.strptime(max(all_dates)[:10], "%Y-%m-%d")
        else:
            start_dt = datetime(2019, 1, 1)
            end_dt = datetime(2019, 12, 31)

    days_diff = (end_dt - start_dt).days
    if period == 'monthly' or (period == 'auto' and days_diff > 31):
        group_by = 'month'
    else:
        group_by = 'day'

    # 4. Count occurrences
    for doc in docs:
        date_str = doc.get(date_field)
        if not date_str:
            continue
        # Accept both "YYYY-MM-DD" and "YYYY-MM-DD HH:MM:SS"
        key = None
        try:
            if len(date_str) >= 10:
                if group_by == 'month':
                    key = date_str[:7]
                else:
                    key = date_str[:10]
        except Exception:
            continue
        if key:
            date_counts[key] = date_counts.get(key, 0) + 1

    # 5. Fill missing dates with zero
    result = []
    if group_by == 'month':
        months = []
        cur = datetime(start_dt.year, start_dt.month, 1)
        while cur <= end_dt:
            months.append(cur.strftime("%Y-%m"))
            # next month
            if cur.month == 12:
                cur = datetime(cur.year + 1, 1, 1)
            else:
                cur = datetime(cur.year, cur.month + 1, 1)
        for m in months:
            result.append({"day": m, "count": date_counts.get(m, 0)})
    else:
        days = []
        cur = start_dt
        while cur <= end_dt:
            days.append(cur.strftime("%Y-%m-%d"))
            cur += timedelta(days=1)
        for d in days:
            result.append({"day": d, "count": date_counts.get(d, 0)})

    return Response(result)


@api_view(['GET'])
@permission_classes([IsAdminOrManager])
def report_by_status_view(request):
    try:
    mongo = get_mongodb_service()
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    data = list(mongo.collection.aggregate(pipeline))
    by_status = [{"status": d["_id"], "count": d["count"]} for d in data]
        print('Report by status output:', by_status)
    return Response(by_status)
    except Exception as e:
        print(f'Error in report_by_status_view: {str(e)}')
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAdminOrManager])
def report_by_criticality_view(request):
    try:
    mongo = get_mongodb_service()
    pipeline = [
        {"$group": {"_id": "$criticality", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    data = list(mongo.collection.aggregate(pipeline))
    by_crit = [{"condition": str(d["_id"]), "count": d["count"]} for d in data]
        print('Report by criticality output:', by_crit)
    return Response(by_crit)
    except Exception as e:
        print(f'Error in report_by_criticality_view: {str(e)}')
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAdminOrManager])
def report_by_section_view(request):
    try:
    mongo = get_mongodb_service()
    # Pipeline to group by section and calculate avg resolution time in MongoDB
    pipeline = [
        {"$match": {"status": "resolved", "Date de détéction de l'anomalie": {"$exists": True}, "updated_at": {"$exists": True}}},
        {"$project": {
            "section": "$Section propriétaire",
            "created": {"$toDate": "$Date de détéction de l'anomalie"},
            "updated": {"$toDate": "$updated_at"}
        }},
        {"$project": {
            "section": 1,
            "diff": {"$divide": [{"$subtract": ["$updated", "$created"]}, 1000 * 60 * 60 * 24]}
        }},
        {"$group": {
            "_id": "$section",
            "avg_resolution_time": {"$avg": "$diff"},
            "resolved": {"$sum": 1}
        }}
    ]
    avg_data = {d['_id']: d for d in mongo.collection.aggregate(pipeline)}
    # Now get total anomalies per section
    pipeline_total = [
        {"$group": {"_id": "$Section propriétaire", "total": {"$sum": 1}}},
        {"$sort": {"total": -1}}
    ]
    total_data = {d['_id']: d['total'] for d in mongo.collection.aggregate(pipeline_total)}
    # Merge results
    rows = []
    for section, total in total_data.items():
        avg_info = avg_data.get(section, {})
        rows.append({
            "section": section,
            "total": total,
            "resolved": avg_info.get('resolved', 0),
            "avg_resolution_time": round(avg_info.get('avg_resolution_time', 0), 2)
        })
        print('Report by section output:', rows)
    return Response(rows)
    except Exception as e:
        print(f'Error in report_by_section_view: {str(e)}')
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Additional imports for analytics views

@api_view(['GET'])
@permission_classes([IsAdminOrManager])
def analytics_view(request):
    print('=== ANALYTICS_VIEW CALLED ===')
    print('*** THIS IS THE ANALYTICS VIEW FUNCTION ***')
    print('*** IF YOU SEE THIS, THE FUNCTION IS BEING CALLED ***')
    try:
    # Parse year, month, day from query params
    year = request.GET.get('year')
    month = request.GET.get('month')
    day = request.GET.get('day')
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    period = request.GET.get('period', '1year')

    # If year/month/day are provided, build start_date and end_date
    from datetime import datetime
    if year and month and day:
        # Single day
        start_date = end_date = f"{year}-{int(month):02d}-{int(day):02d}"
    elif year and month:
        # Whole month
        start_date = f"{year}-{int(month):02d}-01"
        # Calculate last day of month
        import calendar
        last_day = calendar.monthrange(int(year), int(month))[1]
        end_date = f"{year}-{int(month):02d}-{last_day:02d}"
    elif year:
        # Whole year
        start_date = f"{year}-01-01"
        end_date = f"{year}-12-31"
    # If start_date and end_date are provided as query params, use them
    # (already set above if present)
        print(f'Analytics view params: year={year}, month={month}, day={day}, start_date={start_date}, end_date={end_date}, period={period}')

        print('Getting MongoDB service...')
    mongo = get_mongodb_service()
        print('MongoDB service obtained, calling get_analytics_data...')
    data = mongo.get_analytics_data(period=period, start_date=start_date, end_date=end_date)
        print('get_analytics_data returned:', data)
        print('Analytics view data:', data)
        print('Analytics view data keys:', list(data.keys()) if isinstance(data, dict) else 'Not a dict')
        print('Analytics view severity_data:', data.get('severity_data', []) if isinstance(data, dict) else 'No severity_data')
        print('Analytics view status_data:', data.get('status_data', []) if isinstance(data, dict) else 'No status_data')
        print('Analytics view unit_data:', data.get('unit_data', []) if isinstance(data, dict) else 'No unit_data')
        print('Analytics view trend_data:', data.get('trend_data', []) if isinstance(data, dict) else 'No trend_data')
        
        # Check if data is empty
        if isinstance(data, dict):
            for key, value in data.items():
                print(f'Analytics {key}: {len(value) if isinstance(value, list) else value}')

    return JsonResponse(data, safe=False)
    except Exception as e:
        print(f'Error in analytics_view: {str(e)}')
        return JsonResponse({'error': str(e)}, status=500)


@api_view(['GET'])
@permission_classes([IsAdminOrManager])
def debug_data_view(request):
    """Debug endpoint to check what data is in MongoDB"""
    try:
        mongo = get_mongodb_service()
        
        # Get total count
        total = mongo.collection.count_documents({})
        
        # Get a sample document
        sample = mongo.collection.find_one({})
        
        # Get all unique status values
        statuses = list(mongo.collection.distinct('status'))
        
        # Get all unique criticality values
        criticalities = list(mongo.collection.distinct('criticality'))
        
        # Get all unique date fields
        date_fields = []
        if sample:
            for key, value in sample.items():
                if isinstance(value, (str, datetime)) and any(date_word in key.lower() for date_word in ['date', 'created', 'updated', 'détéction']):
                    date_fields.append(key)
        
        debug_info = {
            'total_documents': total,
            'sample_document_keys': list(sample.keys()) if sample else [],
            'statuses': statuses,
            'criticalities': criticalities,
            'date_fields': date_fields,
            'sample_document': sample
        }
        
        print('Debug data:', debug_info)
        return Response(debug_info)
    except Exception as e:
        print(f'Error in debug_data_view: {str(e)}')
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAdminOrManager])
def earliest_anomaly_date_view(request):
    try:
    mongo = get_mongodb_service()
    doc = mongo.collection.find_one({}, sort=[('Date de détéction de l\'anomalie', 1)])
        print("earliest_anomaly_date_view doc = ", doc)
    earliest_date = None
    if doc and doc.get('Date de détéction de l\'anomalie'):
        from datetime import datetime
        dt = doc['Date de détéction de l\'anomalie']
            print("earliest_anomaly_date_view dt = ", dt)
        if isinstance(dt, datetime):
            earliest_date = dt.strftime('%Y-%m-%d')
                print("earliest_anomaly_date_view earliest_date = ", earliest_date)
        else:
            # Try to parse string
            try:
                earliest_date = str(dt)[:10]
            except Exception:
                earliest_date = str(dt)
        print("earliest_anomaly_date_view returning:", {"earliest_date": earliest_date})
    return Response({"earliest_date": earliest_date})
    except Exception as e:
        print(f'Error in earliest_anomaly_date_view: {str(e)}')
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAdminOrManager])
def yearly_anomaly_trends_view(request):
    """
    Get anomaly trends for a specific year.
    
    Query Parameters:
    - year (int, optional): Year to get trends for (default: current year)
    """
    try:
        from .mongodb_service import get_mongodb_service
        
        mongodb_service = get_mongodb_service()
        year = request.query_params.get('year')
        
        # If no year provided, use current year
        if not year:
            from datetime import datetime
            year = datetime.now().year
        else:
            year = int(year)
        
        print(f'yearly_anomaly_trends_view: getting trends for year {year}')
        
        # Get yearly trend data
        trend_data = mongodb_service.get_yearly_trend_data(year)
        
        print(f'yearly_anomaly_trends_view: trend_data = {trend_data}')
        print(f'yearly_anomaly_trends_view: trend_data length = {len(trend_data) if trend_data else 0}')
        if trend_data:
            print(f'yearly_anomaly_trends_view: first item = {trend_data[0] if trend_data else None}')
        
        return Response({
            'success': True,
            'year': year,
            'trend_data': trend_data
        })
        
    except Exception as e:
        print(f'Error in yearly_anomaly_trends_view: {str(e)}')
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAdminOrManager])
def slot_scheduled_anomalies_view(request, slot_id):
    """
    Get anomaly IDs that are scheduled in a specific time slot.
    
    Args:
        slot_id (str): The ID of the time slot
    """
    try:
        from .mongodb_service import get_mongodb_service
        from bson import ObjectId
        
        mongodb_service = get_mongodb_service()
        
        # Get the slot to find scheduled anomalies
        slots_collection = mongodb_service.db['time_slots']
        slot = slots_collection.find_one({'_id': ObjectId(slot_id)})
        
        if not slot:
            return Response({
                'success': False,
                'error': 'Slot not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get scheduled anomaly IDs from the slot
        scheduled_anomaly_ids = slot.get('scheduled_anomalies', [])
        
        return Response({
            'success': True,
            'slot_id': slot_id,
            'scheduled_anomaly_ids': scheduled_anomaly_ids
        })
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAdminOrManager])
def paginated_unapproved_anomalies_view(request):
    """
    List unapproved anomalies, paginated and sorted by criticality (highest first).
    Query params:
      - page: page number (default 1)
      - page_size: anomalies per page (default 10)
    """
    try:
        from .mongodb_service import get_mongodb_service
        mongodb_service = get_mongodb_service()
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 10))
        skip = (page - 1) * page_size
        # Query unapproved anomalies, sorted by criticality descending
        anomalies_cursor = mongodb_service.db['anomalies'].find({
            '$or': [
                {'approved': False},
                {'approved': {'$exists': False}}
            ]
        }).sort('criticality', -1).skip(skip).limit(page_size)
        anomalies = list(anomalies_cursor)
        total = mongodb_service.db['anomalies'].count_documents({
            '$or': [
                {'approved': False},
                {'approved': {'$exists': False}}
            ]
        })
        # Convert ObjectId to string
        for anomaly in anomalies:
            anomaly['id'] = str(anomaly['_id'])
            anomaly.pop('_id', None)
        return Response({
            'success': True,
            'anomalies': anomalies,
            'total': total,
            'page': page,
            'page_size': page_size,
            'total_pages': (total + page_size - 1) // page_size
        })
    except Exception as e:
        return Response({'success': False, 'error': str(e)}, status=500)

