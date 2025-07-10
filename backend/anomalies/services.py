from django.utils import timezone
from datetime import timedelta
from .models import Anomaly
from calendar_slots.models import FactoryCalendar
import logging

logger = logging.getLogger(__name__)


class AnomalySchedulingService:
    """
    Service class for handling anomaly scheduling logic.
    """
    
    @staticmethod
    def auto_schedule_anomaly(anomaly):
        """
        Automatically schedule an anomaly to the nearest available slot.
        """
        try:
            # Find the nearest available slot that can accommodate this anomaly
            slot = AnomalySchedulingService._find_available_slot(anomaly)
            
            if slot:
                # Schedule the anomaly
                slot.schedule_anomaly(anomaly)
                anomaly.status = 'scheduled'
                anomaly.save()
                
                logger.info(f"Anomaly {anomaly.id} auto-scheduled to {slot.date}")
                return True
            else:
                logger.warning(f"No available slot found for anomaly {anomaly.id}")
                return False
                
        except Exception as e:
            logger.error(f"Error auto-scheduling anomaly {anomaly.id}: {str(e)}")
            return False
    
    @staticmethod
    def _find_available_slot(anomaly):
        """
        Find the nearest available slot that can accommodate the anomaly.
        """
        # Start from today and look forward
        start_date = timezone.now().date()
        
        # Look for slots in the next 30 days
        for i in range(30):
            target_date = start_date + timedelta(days=i)
            
            try:
                slot = FactoryCalendar.objects.get(date=target_date)
                
                # Check if slot can accommodate this anomaly
                if slot.can_accommodate(anomaly.estimated_duration):
                    return slot
                    
            except FactoryCalendar.DoesNotExist:
                # Create a new slot for this date if it doesn't exist
                slot = FactoryCalendar.objects.create(
                    date=target_date,
                    available_hours=8,  # Default 8 hours
                    is_available=True
                )
                return slot
        
        return None
    
    @staticmethod
    def reschedule_anomaly(anomaly, new_slot):
        """
        Reschedule an anomaly to a new slot.
        """
        try:
            # Check if the new slot can accommodate this anomaly
            if not new_slot.can_accommodate(anomaly.estimated_duration):
                raise ValueError(f"Slot cannot accommodate {anomaly.estimated_duration}h")
            
            # Update the anomaly
            anomaly.scheduled_slot = new_slot
            anomaly.status = 'rescheduled'
            anomaly.save()
            
            logger.info(f"Anomaly {anomaly.id} rescheduled to {new_slot.date}")
            return True
            
        except Exception as e:
            logger.error(f"Error rescheduling anomaly {anomaly.id}: {str(e)}")
            return False
    
    @staticmethod
    def get_unassigned_anomalies():
        """
        Get all anomalies that haven't been scheduled yet.
        """
        return Anomaly.objects.filter(scheduled_slot__isnull=True)
    
    @staticmethod
    def get_overdue_anomalies():
        """
        Get anomalies that are overdue (30+ days since detection).
        """
        return Anomaly.objects.filter(
            date_detected__lt=timezone.now() - timedelta(days=30)
        )
    
    @staticmethod
    def get_high_priority_anomalies():
        """
        Get anomalies with high priority scores.
        """
        return Anomaly.objects.filter(priority_score__gte=15)


class AnomalyImportService:
    """
    Service for importing anomalies from Excel files and storing in MongoDB.
    """
    
    @staticmethod
    def import_from_excel(file_path):
        """
        Import anomalies from an Excel file, convert to JSON, and store in MongoDB.
        Dynamically reads column headers from the Excel file.
        """
        import pandas as pd
        from .mongodb_service import get_mongodb_service
        
        try:
            # Read the Excel file
            df = pd.read_excel(file_path)
            
            # Get column names from the Excel file
            column_names = df.columns.tolist()
            logger.info(f"Excel columns detected: {column_names}")
            
            # Convert DataFrame to list of dictionaries (JSON-like format)
            anomalies_data = []
            errors = []
            system_ids = {}
            
            for index, row in df.iterrows():
                try:
                    # Convert row to dictionary and handle data types with null handling
                    def safe_str(value, default=''):
                        """Safely convert value to string, handling null/NaN values"""
                        if pd.isna(value) or value is None or str(value).strip() == '':
                            return default
                        return str(value).strip()
                    
                    def safe_int(value, default=3):
                        """Safely convert value to int, handling null/NaN values"""
                        if pd.isna(value) or value is None or str(value).strip() == '':
                            return default
                        try:
                            return int(float(value))
                        except (ValueError, TypeError):
                            return default
                    
                    def safe_float(value, default=4.0):
                        """Safely convert value to float, handling null/NaN values"""
                        if pd.isna(value) or value is None or str(value).strip() == '':
                            return default
                        try:
                            return float(value)
                        except (ValueError, TypeError):
                            return default
                    
                    def safe_bool(value, default=False):
                        """Safely convert value to boolean, handling null/NaN values"""
                        if pd.isna(value) or value is None or str(value).strip() == '':
                            return default
                        try:
                            return bool(value)
                        except (ValueError, TypeError):
                            return default
                    
                    def safe_date(value, default=None):
                        """Safely convert value to date string, handling null/NaN values"""
                        if pd.isna(value) or value is None or str(value).strip() == '':
                            return default.isoformat() if default else timezone.now().isoformat()
                        try:
                            # If it's already a string, try to parse it
                            if isinstance(value, str):
                                # Try to parse the string as a date
                                from datetime import datetime
                                try:
                                    parsed_date = pd.to_datetime(value)
                                    return parsed_date.isoformat()
                                except:
                                    return timezone.now().isoformat()
                            # If it's a datetime object
                            elif hasattr(value, 'isoformat'):
                                return value.isoformat()
                            else:
                                return timezone.now().isoformat()
                        except (ValueError, TypeError):
                            return timezone.now().isoformat()
                    
                    # Start with all Excel columns as-is
                    anomaly_dict = {}
                    
                    # Add all columns from Excel file dynamically
                    for column in column_names:
                        column_value = row[column]
                        
                        # Handle different column types based on column name patterns
                        # if 'criticality' in column.lower() or 'priority' in column.lower():
                        #     anomaly_dict[column] = safe_int(column_value, 3)
                        # elif 'duration' in column.lower() or 'time' in column.lower() or 'hours' in column.lower():
                        #     anomaly_dict[column] = safe_float(column_value, 4.0)
                        # elif 'date' in column.lower() or 'detected' in column.lower():
                        #     anomaly_dict[column] = safe_date(column_value, timezone.now())
                        # elif 'emergency' in column.lower() or 'urgent' in column.lower():
                        #     anomaly_dict[column] = safe_bool(column_value, False)
                        # else:
                        # Default to string for other columns
                        anomaly_dict[column] = safe_str(column_value, '')
                    
                    # Add system fields
                    anomaly_dict['status'] = 'pending'
                    anomaly_dict['row_number'] = index + 1  # Track original row number
                    anomaly_dict['imported_at'] = timezone.now().isoformat()
                    anomaly_dict['criticality'] = anomaly_dict.get('Criticité', -1)
                    anomaly_dict['Solution'] = 'Not Available'
                    anomaly_dict['unit'] = 'default'
                    anomaly_dict['time_span'] = -1
                    anomaly_dict['unit_outage'] = False
                    anomaly_dict['Approved'] = False

                    # check if system_id is already in the system_ids dictionary
                    if 'Systeme' in anomaly_dict:
                        system_id = anomaly_dict['Systeme']
                        if system_id in system_ids:
                            system_ids[system_id].append(anomaly_dict)
                        else:
                            system_ids[system_id] = [anomaly_dict]
                    
                    # Calculate priority score if criticality exists
                    # criticality_value = None
                    # for key in anomaly_dict:
                    #     if 'criticality' in key.lower():
                    #         criticality_value = anomaly_dict[key]
                    #         break
                    
                    # if criticality_value is not None:
                    #     anomaly_dict['priority_score'] = criticality_value * 3
                    # else:
                    #     anomaly_dict['priority_score'] = 9  # Default priority score
                    
                    # # Validate criticality if it exists
                    # criticality_valid = True
                    # for key, value in anomaly_dict.items():
                    #     if 'criticality' in key.lower() and isinstance(value, int):
                    #         if value not in [1, 2, 3]:
                    #             errors.append(f"Row {index + 1}: {key} must be 1, 2, or 3 (got {value})")
                    #             criticality_valid = False
                    #             break
                    
                    # if not criticality_valid:
                    #     continue
                    
                    anomalies_data.append(anomaly_dict)
                    
                except Exception as e:
                    errors.append(f"Row {index + 1}: {str(e)}")
            
            # Store in MongoDB
            mongodb_service = get_mongodb_service()
            #run the ai on the anomalies_data
            mongo_result = mongodb_service.insert_anomalies(anomalies_data, system_ids)
            
            if mongo_result['success']:
                logger.info(f"Successfully imported {mongo_result['inserted_count']} anomalies to MongoDB")
                
                return {
                    'imported_count': mongo_result['inserted_count'],
                    'errors': errors,
                    'success': len(errors) == 0,
                    'mongodb_ids': mongo_result.get('inserted_ids', []),
                    'message': f"Successfully imported {mongo_result['inserted_count']} anomalies to MongoDB"
                }
            else:
                logger.error(f"Failed to import to MongoDB: {mongo_result['message']}")
                return {
                    'imported_count': 0,
                    'errors': errors + [mongo_result['message']],
                    'success': False,
                    'message': f"Failed to import to MongoDB: {mongo_result['message']}"
                }
            
        except Exception as e:
            logger.error(f"Error importing anomalies from Excel: {str(e)}")
            return {
                'imported_count': 0,
                'errors': [str(e)],
                'success': False,
                'message': f"Error processing Excel file: {str(e)}"
            } 