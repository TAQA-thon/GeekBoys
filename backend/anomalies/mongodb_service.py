from pymongo import MongoClient
import json
import logging
from datetime import datetime, timedelta
from django.conf import settings
from collections import defaultdict
import requests

logger = logging.getLogger(__name__)


class MongoDBService:
    """
    Service class for handling MongoDB operations for anomaly data.
    """
    
    def __init__(self):
        """Initialize MongoDB connection."""
        try:
            # Connect to MongoDB
            self.client = MongoClient('mongodb://admin:admin@localhost:27017/?authSource=admin')
            self.db = self.client['Taqa']  # Use exact case as existing database
            self.collection = self.db['taza']
            
            # Test connection
            self.client.admin.command('ping')
            logger.info("Successfully connected to MongoDB")
            
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {str(e)}")
            raise
    
    def insert_anomalies(self, anomalies_data, system_ids=None):
        """
        Insert anomaly data into MongoDB.
        
        Args:
            anomalies_data (list): List of anomaly dictionaries
            system_ids (dict, optional): Dictionary of system_id to anomalies for separate collections
            
        Returns:
            dict: Result with success status and inserted count
        """
        try:
            logger.info(f"Inserting {len(anomalies_data)} anomalies into MongoDB")
            if not anomalies_data:
                return {
                    'success': False,
                    'message': 'No data to insert',
                    'inserted_count': 0
                }
            
            # Add timestamp for tracking and handle null values
            for anomaly in anomalies_data:
                anomaly['imported_at'] = datetime.utcnow()
                anomaly['source'] = 'excel_import'
                
                # Convert empty strings to None for MongoDB
                for key, value in anomaly.items():
                    if isinstance(value, str) and value.strip() == '':
                        anomaly[key] = None

                print ("inserting data")
            
            # --- AI criticality integration ---
            import time
            index = 0
            for anomaly in anomalies_data:
                fiab, dispo, proc = self.get_ai_criticality(anomaly)
                if all(x is not None for x in [fiab, dispo, proc]):
                    anomaly['Fiabilité Intégrité'] = fiab
                    anomaly['Disponibilté'] = dispo
                    anomaly['Process Safety'] = proc
                    anomaly['criticite'] = fiab + dispo + proc
                    anomaly['criticality'] = fiab + dispo + proc
                else:
                    import time
                    time.sleep (60)
                    fiab, dispo, proc = self.get_ai_criticality(anomaly)
                    if all(x is not None for x in [fiab, dispo, proc]):
                        anomaly['Fiabilité Intégrité'] = fiab
                        anomaly['Disponibilté'] = dispo
                        anomaly['Process Safety'] = proc
                        anomaly['criticite'] = fiab + dispo + proc
                        anomaly['criticality'] = fiab + dispo + proc
                    else:
                        anomaly['Fiabilité Intégrité'] = 2
                        anomaly['Disponibilté'] = 2
                        anomaly['Process Safety'] = 2
                        anomaly['criticite'] = 6
                        anomaly['criticality'] = 6
                # index += 1
                # if index % 20 == 0:
                #     print ("WAiting for processing data by the AI")
                # time.sleep(0.5)

            
            # Insert data into MongoDB (taza)
            result = self.collection.insert_many(anomalies_data)
            
            logger.info(f"Successfully inserted {len(result.inserted_ids)} anomalies into MongoDB")

            # Assign the generated _id to each anomaly dict
            for anomaly, oid in zip(anomalies_data, result.inserted_ids):
                anomaly['_id'] = oid
            
            # Create a collection for each system_id if provided
            if system_ids:
                index = 0
                for system_id, anomalies in system_ids.items():
                    index += 1
                    # Ensure system_id is a string for collection name
                    system_id_str = str(index).strip()
                    if not system_id_str:  # Skip empty system_ids
                        logger.warning(f"Skipping empty system_id: {system_id}")
                        continue
                    
                    # Create a safe collection name (replace invalid characters)
                    collection_name = f"unit_{system_id_str.replace(' ', '_').replace('-', '_').replace('.', '_')}"
                    
                    try:
                        self.db[collection_name].insert_one({"created": True}) # create a collection if it doesn't exist
                        collection = self.db[collection_name]
                        # For each anomaly, find the matching one in anomalies_data by a unique field (row_number)
                        # and store only the reference (ID) to the taza collection
                        unit_anomaly_refs = []
                        for anomaly in anomalies:
                            match = next((a for a in anomalies_data if a.get('row_number') == anomaly.get('row_number')), None)
                            if match:
                                # Store only the reference to the anomaly in taza collection
                                unit_anomaly_refs.append({
                                    'anomaly_id': str(match['_id']),
                                    'system_id': system_id_str,
                                    'created_at': datetime.utcnow()
                                })
                                # Update the unit field in the taza collection
                                from bson import ObjectId
                                self.collection.update_one(
                                    {'_id': match['_id']},
                                    {'$set': {'unit': f"UNIT {system_id_str}"}}
                                )
                                # Also update the local variable for consistency
                                # match['unit'] = f"unit_{system_id_str}"
                        if unit_anomaly_refs:
                            collection.insert_many(unit_anomaly_refs)
                        logger.info(f"Successfully inserted {len(unit_anomaly_refs)} anomaly references into collection {collection_name}")
                    except Exception as e:
                        logger.error(f"Error inserting into collection {collection_name}: {str(e)}")
                        # Continue with other collections even if one fails
            
            # After insert, if any anomaly has scheduled_slot, update it in all collections
            for anomaly in anomalies_data:
                if 'scheduled_slot' in anomaly and anomaly['scheduled_slot']:
                    self.update_anomaly_scheduled_slot_all_collections(anomaly['_id'], anomaly['scheduled_slot'])
            
            return {
                'success': True,
                'message': f'Successfully inserted {len(result.inserted_ids)} anomalies',
                'inserted_count': len(result.inserted_ids)
            }
            
        except Exception as e:
            logger.error(f"Error inserting anomalies into MongoDB: {str(e)}")
            return {
                'success': False,
                'message': str(e),
                'inserted_count': 0
            }
    
    def get_anomalies(self, limit=100, skip=0, approved=None, status=None):
        """
        Retrieve anomalies from MongoDB.
        
        Args:
            limit (int): Number of documents to return (default: 100, can be higher for statistics)
            skip (int): Number of documents to skip
            approved (bool, optional): Filter by approval status (True for approved, False for unapproved, None for all)
            status (str, optional): Filter by status field (open, in_progress, resolved, etc.)
            
        Returns:
            list: List of anomaly documents
        """
        try:
            # Build query filter
            query_filter = {}
            if approved is not None:
                query_filter['Approved'] = approved
            
            # Add status filter if provided
            if status is not None:
                query_filter['status'] = status
            
            # For statistics purposes, allow higher limits
            if limit > 10000:
                limit = 10000  # Cap at 10000 for safety
            
            # cursor = self.collection.find(query_filter).sort("criticality", -1).skip(skip).limit(limit)
            pipeline = [
                {"$match": query_filter},
                {"$addFields": {"criticality_num": {"$toInt": "$criticality"}}},
                {"$sort": {"criticality_num": -1}},
                {"$skip": skip},
                {"$limit": limit}
            ]
            cursor = self.collection.aggregate(pipeline)
            anomalies = list(cursor)
            
            # Convert ObjectId to string for JSON serialization
            for anomaly in anomalies:
                if '_id' in anomaly:
                    anomaly['_id'] = str(anomaly['_id'])
            
            return anomalies
            
        except Exception as e:
            logger.error(f"Error retrieving anomalies from MongoDB: {str(e)}")
            return []
    
    def get_anomaly_by_id(self, anomaly_id):
        """
        Get a specific anomaly by ID.
        
        Args:
            anomaly_id (str): The anomaly ID
            
        Returns:
            dict: Anomaly document or None
        """
        try:
            from bson import ObjectId
            anomaly = self.collection.find_one({'_id': ObjectId(anomaly_id)})
            
            if anomaly and '_id' in anomaly:
                anomaly['_id'] = str(anomaly['_id'])
            
            return anomaly
            
        except Exception as e:
            logger.error(f"Error retrieving anomaly {anomaly_id} from MongoDB: {str(e)}")
            return None
    
    def update_anomaly(self, anomaly_id, update_data):
        """
        Update an anomaly in MongoDB.
        
        Args:
            anomaly_id (str): The anomaly ID
            update_data (dict): Data to update
            
        Returns:
            bool: Success status
        """
        try:
            from bson import ObjectId
            update_data['updated_at'] = datetime.utcnow()
            
            result = self.collection.update_one(
                {'_id': ObjectId(anomaly_id)},
                {'$set': update_data}
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            logger.error(f"Error updating anomaly {anomaly_id} in MongoDB: {str(e)}")
            return False
    
    def delete_anomaly(self, anomaly_id):
        """
        Delete an anomaly from MongoDB.
        
        Args:
            anomaly_id (str): The anomaly ID
            
        Returns:
            bool: Success status
        """
        try:
            from bson import ObjectId
            result = self.collection.delete_one({'_id': ObjectId(anomaly_id)})
            
            return result.deleted_count > 0
            
        except Exception as e:
            logger.error(f"Error deleting anomaly {anomaly_id} from MongoDB: {str(e)}")
            return False
    
    def get_statistics(self):
        """
        Get statistics about the anomalies collection.
        
        Returns:
            dict: Statistics about the collection
        """
        try:
            total_count = self.collection.count_documents({})
            
            # Get count by status
            status_counts = {}
            pipeline = [
                {'$group': {'_id': '$status', 'count': {'$sum': 1}}}
            ]
            status_results = list(self.collection.aggregate(pipeline))
            
            for result in status_results:
                status_counts[result['_id']] = result['count']
            
            # Get count by criticality
            criticality_counts = {}
            pipeline = [
                {'$group': {'_id': '$criticality', 'count': {'$sum': 1}}}
            ]
            criticality_results = list(self.collection.aggregate(pipeline))
            
            for result in criticality_results:
                criticality_counts[result['_id']] = result['count']
            
            return {
                'total_anomalies': total_count,
                'status_distribution': status_counts,
                'criticality_distribution': criticality_counts
            }
            
        except Exception as e:
            logger.error(f"Error getting statistics from MongoDB: {str(e)}")
            return {
                'total_anomalies': 0,
                'status_distribution': {},
                'criticality_distribution': {}
            }
    
    def get_total_anomaly_count(self, status=None, approved=None):
        """
        Get total count of anomalies in the collection with optional filtering.
        
        Args:
            status (str, optional): Filter by status field (open, in_progress, resolved, etc.)
            approved (bool, optional): Filter by approval status (True/False)
        
        Returns:
            int: Total number of anomalies matching the filter criteria
        """
        try:
            # Build query filter
            query_filter = {}
            
            # Add status filter if provided
            if status is not None:
                query_filter['status'] = status
                
            # Add approved filter if provided
            if approved is not None:
                query_filter['Approved'] = approved
                
            count = self.collection.count_documents(query_filter)
            logger.info(f"Anomalies count with filters {query_filter}: {count}")
            return count
        except Exception as e:
            logger.error(f"Error getting filtered anomaly count from MongoDB: {str(e)}")
            return 0
    
    def get_anomaly_count_by_criticality(self, criticality, status=None, approved=None):
        """
        Get count of anomalies filtered by criticality level and optional status and approval.
        
        Args:
            criticality (int): Criticality level to filter by (-1, 1, 2, or 3)
            status (str, optional): Filter by status field (open, in_progress, resolved, etc.)
            approved (bool, optional): Filter by approval status (True/False)
            
        Returns:
            int: Number of anomalies with the specified criticality and other filters
        """
        try:
            logger.info(f"Getting anomalies with criticality={criticality}, status={status}, approved={approved}")
            
            # Build base query for criticality (accept both int and string representations)
            query_filter = {
                '$or': [
                    {'criticality': criticality},
                    {'criticality': str(criticality)}
                ]
            }
            
            # Add status filter if provided
            if status is not None:
                query_filter['status'] = status
                
            # Add approved filter if provided
            if approved is not None:
                query_filter['Approved'] = approved
                
            count = self.collection.count_documents(query_filter)
            logger.info(f"Found {count} anomalies with criticality {criticality} and filters")

            # Also check for any field that contains 'criticality' in its name
            pipeline = [
                {
                    '$match': {
                        '$or': [
                            {'criticality': criticality},
                            {'criticality': str(criticality)},
                            {'Priority_Level': criticality},
                            {'Priority_Level': str(criticality)},
                            {'مستوى_الأولوية': criticality},
                            {'مستوى_الأولوية': str(criticality)},
                            {'priority': criticality},
                            {'priority': str(criticality)},
                            {'Priority': criticality},
                            {'Priority': str(criticality)}
                        ]
                    }
                },
                {'$count': 'total'}
            ]
            result = list(self.collection.aggregate(pipeline))
            if result:
                count = result[0]['total']
            logger.info(f"Anomalies count with criticality {criticality}: {count}")
            return count
        except Exception as e:
            logger.error(f"Error getting anomaly count by criticality {criticality} from MongoDB: {str(e)}")
            return 0
    
    def get_anomalies_by_system(self, unit_id, limit=100, skip=0):
        """
        Retrieve anomalies for a specific system/unit from MongoDB.
        
        Args:
            unit_id (str): The system/unit ID
            limit (int): Number of documents to return (default: 100, can be higher for statistics)
            skip (int): Number of documents to skip
            
        Returns:
            list: List of anomaly documents for the specified system
        """
        try:
            # For statistics purposes, allow higher limits
            if limit > 10000:
                limit = 10000  # Cap at 10000 for safety

            # print 
            
            cursor = self.collection.find({'unit': f"UNIT {unit_id}"}).skip(skip).limit(limit)
            anomalies = list(cursor)
            
            # Convert ObjectId to string for JSON serialization
            for anomaly in anomalies:
                if '_id' in anomaly:
                    anomaly['_id'] = str(anomaly['_id'])
            
            return anomalies
            
        except Exception as e:
            logger.error(f"Error retrieving anomalies for system {unit_id} from MongoDB: {str(e)}")
            return []
    
    def get_anomaly_count_by_system(self, unit_id):
        """
        Get count of anomalies in a specific system collection.
        Since unit_* collections now only store references, we count the references.
        
        Args:
            unit_id (str): The system/unit ID
            
        Returns:
            int: Count of anomalies in the system collection
        """
        try:
            # Create collection name for the system
            collection_name = f"unit_{str(unit_id).replace(' ', '_').replace('-', '_').replace('.', '_')}"
            collection = self.db[collection_name]
            
            # Count references in the system collection
            count = collection.count_documents({})
            
            logger.info(f"Found {count} anomaly references in system {unit_id}")
            return count
            
        except Exception as e:
            logger.error(f"Error getting anomaly count for system {unit_id}: {str(e)}")
            return 0
    
    def close_connection(self):
        """Close MongoDB connection."""
        try:
            self.client.close()
            logger.info("MongoDB connection closed")
        except Exception as e:
            logger.error(f"Error closing MongoDB connection: {str(e)}")

    def update_anomaly_all_collections(self, anomaly_id, update_data):
        """
        Update an anomaly by _id in taza and all unit_* collections that reference it.
        Since unit_* collections now only store references, we only update the taza collection.
        Args:
            anomaly_id (str): The anomaly ID
            update_data (dict): Data to update
        Returns:
            int: Number of collections updated
        """
        from bson import ObjectId
        update_data['updated_at'] = datetime.utcnow()
        updated_count = 0
        # Update in taza
        result = self.collection.update_one({'_id': ObjectId(anomaly_id)}, {'$set': update_data})
        if result.modified_count > 0:
            updated_count += 1
        # For unit_* collections, we only need to check if they reference this anomaly
        # The actual data is stored in taza, so no update needed in unit collections
        referenced_units = []
        for name in self.db.list_collection_names():
            if name.startswith('unit_'):
                collection = self.db[name]
                ref = collection.find_one({'anomaly_id': str(anomaly_id)})
                if ref:
                    referenced_units.append(name)
        logger.info(f"Anomaly {anomaly_id} is referenced in {len(referenced_units)} unit collections: {referenced_units}")
        return updated_count

    def insert_time_slots(self, slots_data):
        """
        Insert new time slots into the 'time_slots' collection, skipping those that overlap with existing slots.
        After insertion, checks for approved anomalies that can be scheduled to the new slots.
        Args:
            slots_data (list): List of slot dicts with start_date, end_date, etc.
        Returns:
            dict: Result with counts of inserted and skipped slots, plus scheduling info
        """
        inserted = 0
        skipped = 0
        collection = self.db['time_slots']
        inserted_slot_ids = []
        
        for slot in slots_data:
            # Parse dates for comparison
            try:
                start = datetime.strptime(slot['start_date'], '%Y-%m-%d')
                end = datetime.strptime(slot['end_date'], '%Y-%m-%d')
            except Exception as e:
                skipped += 1
                continue
            # Check for overlap with any existing slot
            overlap = collection.find_one({
                '$or': [
                    {
                        'start_date': {'$lte': slot['end_date']},
                        'end_date': {'$gte': slot['start_date']}
                    }
                ]
            })
            if overlap:
                skipped += 1
                continue
            # Insert if no overlap
            result = collection.insert_one(slot)
            inserted += 1
            inserted_slot_ids.append(str(result.inserted_id))
        
        # After inserting all slots, check for approved anomalies that can be scheduled
        scheduled_from_queue = 0
        rescheduled_from_later = 0
        
        for slot_id in inserted_slot_ids:
            # Check if any approved anomalies can be scheduled to this slot
            schedule_result = self.check_and_schedule_approved_anomalies(slot_id)
            scheduled_from_queue += schedule_result.get('scheduled', 0)
            
            # Check if any existing scheduled anomalies can be moved to this earlier slot
            reschedule_result = self.check_and_reschedule_to_earlier_slot(slot_id)
            rescheduled_from_later += reschedule_result.get('rescheduled', 0)
        
        return {
            'inserted': inserted, 
            'skipped': skipped,
            'scheduled_from_queue': scheduled_from_queue,
            'rescheduled_from_later': rescheduled_from_later
        }

    def get_time_slots(self):
        """
        Retrieve all time slots from the 'time_slots' collection.
        Returns:
            list: List of slot dicts
        """
        collection = self.db['time_slots']
        slots = list(collection.find())
        for slot in slots:
            slot['_id'] = str(slot['_id'])
        return slots

    def _normalize_date(self, date_str):
        if not date_str:
            return date_str
        try:
            # Accept both zero-padded and non-padded
            return datetime.strptime(str(date_str), '%Y-%m-%d').strftime('%Y-%m-%d')
        except Exception:
            # Try to parse with single-digit day/month
            try:
                return datetime.strptime(str(date_str), '%Y-%m-%d').strftime('%Y-%m-%d')
            except Exception:
                return date_str  # fallback, but should not happen

    def update_time_slot(self, slot_id, update_data):
        from bson import ObjectId
        collection = self.db['time_slots']
        try:
            if 'start_date' in update_data:
                update_data['start_date'] = self._normalize_date(update_data['start_date'])
            if 'end_date' in update_data:
                update_data['end_date'] = self._normalize_date(update_data['end_date'])
            new_start = update_data.get('start_date')
            new_end = update_data.get('end_date')
            merged_anomalies = set()
            
            # Only check for overlaps if we have both start and end dates
            if new_start and new_end:
                # Check for actual overlaps (not just adjacent slots)
                overlaps = list(collection.find({
                    '_id': {'$ne': ObjectId(slot_id)},
                    '$or': [
                        {
                            'start_date': {'$lte': new_end},
                            'end_date': {'$gte': new_start}
                        }
                    ]
                }))
                
                # Normalize dates for overlap checking
                for s in overlaps:
                    s['start_date'] = self._normalize_date(s.get('start_date'))
                    s['end_date'] = self._normalize_date(s.get('end_date'))
                
                # Collect anomalies from overlapping slots
                for s in overlaps:
                    if 'scheduled_anomalies' in s and s['scheduled_anomalies']:
                        merged_anomalies.update(s['scheduled_anomalies'])
                
                # Get current slot for comparison
                current_slot = collection.find_one({'_id': ObjectId(slot_id)})
                if current_slot:
                    current_slot['start_date'] = self._normalize_date(current_slot.get('start_date'))
                    current_slot['end_date'] = self._normalize_date(current_slot.get('end_date'))
                    if 'scheduled_anomalies' in current_slot and current_slot['scheduled_anomalies']:
                        merged_anomalies.update(current_slot['scheduled_anomalies'])
                
                # Only merge if there are actual overlaps (not just adjacent slots)
                if overlaps:
                    logger.info(f"Found {len(overlaps)} overlapping slots for slot {slot_id}")
                    all_slots = overlaps + ([current_slot] if current_slot else [])
                    merged_start = min([s['start_date'] for s in all_slots] + [new_start])
                    merged_end = max([s['end_date'] for s in all_slots] + [new_end])
                    update_data['start_date'] = merged_start
                    update_data['end_date'] = merged_end
                    
                    # Delete the overlapping slots
                    for s in overlaps:
                        collection.delete_one({'_id': s['_id']})
                        logger.info(f"Deleted overlapping slot {s['_id']}")
                else:
                    logger.info(f"No overlaps found for slot {slot_id}, keeping original dates")
                    # Keep the dates as provided by the user
                    if 'start_date' in update_data:
                        update_data['start_date'] = new_start
                    if 'end_date' in update_data:
                        update_data['end_date'] = new_end
            
            # Calculate duration if start_date or end_date was updated
            if 'start_date' in update_data or 'end_date' in update_data:
                final_start = update_data.get('start_date')
                final_end = update_data.get('end_date')
                
                # If we don't have both dates in update_data, get them from the current slot
                if not final_start or not final_end:
                    current_slot = collection.find_one({'_id': ObjectId(slot_id)})
                    if current_slot:
                        final_start = final_start or self._normalize_date(current_slot.get('start_date'))
                        final_end = final_end or self._normalize_date(current_slot.get('end_date'))
                
                if final_start and final_end:
                    # Calculate duration in milliseconds
                    from datetime import datetime
                    start_dt = datetime.fromisoformat(final_start.replace('Z', '+00:00'))
                    end_dt = datetime.fromisoformat(final_end.replace('Z', '+00:00'))
                    duration_ms = (end_dt - start_dt).total_seconds() * 1000
                    
                    # Calculate duration_days and duration_hours (inclusive of both start and end dates)
                    duration_days = int(duration_ms / (1000 * 60 * 60 * 24)) + 1
                    duration_hours = duration_days * 24
                    
                    logger.info(f"Recalculated duration for slot {slot_id}: {duration_days} days, {duration_hours} hours")
                    
                    update_data['duration_days'] = duration_days
                    update_data['duration_hours'] = duration_hours
            
            update_data['scheduled_anomalies'] = list(merged_anomalies)
            update_data['updated_at'] = datetime.utcnow()
            result = collection.update_one({'_id': ObjectId(slot_id)}, {'$set': update_data})
            if result.modified_count == 0:
                return {'success': False, 'error': 'Time slot not found or not updated.'}
            
            # After updating the slot, handle anomalies like when creating a new slot
            logger.info(f"Slot {slot_id} updated, now handling anomalies...")
            
            # First check if any existing scheduled anomalies can be moved to this earlier slot
            reschedule_result = self.check_and_reschedule_to_earlier_slot(slot_id)
            logger.info(f"Rescheduling result: {reschedule_result.get('rescheduled', 0)} anomalies moved to this slot")
            
            # Then check if any approved anomalies can be scheduled to this slot
            schedule_result = self.check_and_schedule_approved_anomalies(slot_id)
            logger.info(f"Scheduling result: {schedule_result.get('scheduled', 0)} anomalies scheduled from queue")
            
            # Also try to schedule any approved anomalies that aren't in the queue but could fit
            additional_scheduled = self._schedule_approved_anomalies_to_slot(slot_id)
            logger.info(f"Additional scheduling: {additional_scheduled} approved anomalies scheduled directly")
            
            total_scheduled = reschedule_result.get('rescheduled', 0) + schedule_result.get('scheduled', 0) + additional_scheduled
            
            logger.info(f"Slot {slot_id} updated: {total_scheduled} total anomalies handled")
            
            # Debug: Check what's in the queue and what the updated slot looks like
            queue = self.get_approved_anomalies_queue()
            updated_slot = self.db['time_slots'].find_one({'_id': ObjectId(slot_id)})
            logger.info(f"DEBUG: Queue has {len(queue)} entries, updated slot duration: {updated_slot.get('duration_hours', 0)}h, scheduled: {len(updated_slot.get('scheduled_anomalies', []))}")
            
            if queue:
                for entry in queue:
                    logger.info(f"DEBUG: Queue entry - anomaly_id: {entry['anomaly_id']}, time_span: {entry['time_span']}, status: {entry['status']}")
            
            # After updating the slot, remove anomalies that no longer fit
            updated_slot = collection.find_one({'_id': ObjectId(slot_id)})
            slot_duration = float(updated_slot.get('duration_hours', 0))
            scheduled_anomalies = list(updated_slot.get('scheduled_anomalies', []))
            anomalies_to_remove = []
            for aid in scheduled_anomalies:
                anomaly = self.collection.find_one({'_id': ObjectId(aid)})
                if anomaly:
                    time_span = float(anomaly.get('time_span', 0))
                    if time_span > slot_duration:
                        anomalies_to_remove.append(aid)
                        logger.info(f"Anomaly {aid} (time_span={time_span}) no longer fits in slot {slot_id} (duration={slot_duration}), will remove and reschedule/queue.")
            if anomalies_to_remove:
                # Remove from slot
                new_scheduled = [aid for aid in scheduled_anomalies if aid not in anomalies_to_remove]
                collection.update_one({'_id': ObjectId(slot_id)}, {'$set': {'scheduled_anomalies': new_scheduled}})
                for aid in anomalies_to_remove:
                    self.update_anomaly_scheduled_slot_all_collections(aid, None)
                    # Try to reschedule
                    sched_result = self._find_earliest_fit_slot(aid, slot_id_to_exclude=slot_id)
                    if not sched_result['success']:
                        self.add_approved_anomaly_to_queue(aid)
                        logger.info(f"Anomaly {aid} could not be rescheduled after slot shrink, added back to approved queue.")
                    else:
                        logger.info(f"Anomaly {aid} rescheduled to slot {sched_result.get('slot_id')} after slot shrink.")
            
            return {'success': True, 'error': None}
        except Exception as e:
            logger.error(f"Error updating/merging time slot {slot_id}: {str(e)}")
            return {'success': False, 'error': str(e)}

    def create_time_slot(self, slot_data):
        collection = self.db['time_slots']
        from bson import ObjectId
        try:
            slot_data['start_date'] = self._normalize_date(slot_data.get('start_date'))
            slot_data['end_date'] = self._normalize_date(slot_data.get('end_date'))
            new_start = slot_data['start_date']
            new_end = slot_data['end_date']
            if not new_start or not new_end:
                return {'success': False, 'error': 'start_date and end_date are required.', 'slot_id': None}
            overlaps = list(collection.find({
                '$or': [
                    {
                        'start_date': {'$lte': new_end},
                        'end_date': {'$gte': new_start}
                    }
                ]
            }))
            for s in overlaps:
                s['start_date'] = self._normalize_date(s.get('start_date'))
                s['end_date'] = self._normalize_date(s.get('end_date'))
            merged_anomalies = set()
            for s in overlaps:
                if 'scheduled_anomalies' in s and s['scheduled_anomalies']:
                    merged_anomalies.update(s['scheduled_anomalies'])
            if 'scheduled_anomalies' in slot_data and slot_data['scheduled_anomalies']:
                merged_anomalies.update(slot_data['scheduled_anomalies'])
            if overlaps:
                all_slots = overlaps + [slot_data]
                merged_start = min([s['start_date'] for s in all_slots])
                merged_end = max([s['end_date'] for s in all_slots])
                slot_data['start_date'] = merged_start
                slot_data['end_date'] = merged_end
                for s in overlaps:
                    collection.delete_one({'_id': s['_id']})
            
            # Calculate duration for the slot
            final_start = slot_data['start_date']
            final_end = slot_data['end_date']
            if final_start and final_end:
                # Calculate duration in milliseconds
                from datetime import datetime
                start_dt = datetime.fromisoformat(final_start.replace('Z', '+00:00'))
                end_dt = datetime.fromisoformat(final_end.replace('Z', '+00:00'))
                duration_ms = (end_dt - start_dt).total_seconds() * 1000
                
                # Calculate duration_days and duration_hours (inclusive of both start and end dates)
                duration_days = int(duration_ms / (1000 * 60 * 60 * 24)) + 1
                duration_hours = duration_days * 24
                
                logger.info(f"Calculated duration for new slot: {duration_days} days, {duration_hours} hours")
                
                slot_data['duration_days'] = duration_days
                slot_data['duration_hours'] = duration_hours
            
            slot_data['scheduled_anomalies'] = list(merged_anomalies)
            slot_data['created_at'] = datetime.utcnow()
            slot_data['updated_at'] = datetime.utcnow()
            result = collection.insert_one(slot_data)
            slot_id = str(result.inserted_id)
            
            # First check if any existing scheduled anomalies can be moved to this earlier slot
            reschedule_result = self.check_and_reschedule_to_earlier_slot(slot_id)
            
            # Then check if any approved anomalies can be scheduled to this slot
            schedule_result = self.check_and_schedule_approved_anomalies(slot_id)
            
            return {
                'success': True, 
                'error': None, 
                'slot_id': slot_id,
                'scheduled_from_queue': schedule_result['scheduled'],
                'rescheduled_from_later': reschedule_result['rescheduled']
            }
        except Exception as e:
            logger.error(f"Error creating/merging time slot: {str(e)}")
            return {'success': False, 'error': str(e), 'slot_id': None}

    def delete_time_slot(self, slot_id):
        """
        Delete a time slot and reschedule all anomalies that were scheduled to it.
        If anomalies can't be rescheduled, they are added back to the approved queue.
        
        Args:
            slot_id (str): The ID of the time slot to delete
            
        Returns:
            dict: Result with success status, rescheduled count, and queued count
        """
        print(f"DEBUG: delete_time_slot called with slot_id: {slot_id}")
        from bson import ObjectId
        collection = self.db['time_slots']
        
        try:
            # Find the slot to delete
            print(f"DEBUG: Looking for slot {slot_id} in database")
            slot = collection.find_one({'_id': ObjectId(slot_id)})
            if not slot:
                print(f"DEBUG: Slot {slot_id} not found in database")
                return {
                    'success': False, 
                    'error': 'Time slot not found.',
                    'rescheduled': 0,
                    'queued': 0
                }
            print(f"DEBUG: Found slot {slot_id}, scheduled_anomalies: {slot.get('scheduled_anomalies', [])}")
            
            # Get anomalies that were scheduled to this slot
            scheduled_anomalies = slot.get('scheduled_anomalies', [])
            rescheduled_count = 0
            queued_count = 0
            
            # Try to reschedule each anomaly to the earliest fit slot
            for anomaly_id in scheduled_anomalies:
                logger.info(f"Attempting to reschedule anomaly {anomaly_id} from deleted slot {slot_id}")
                
                # Get the anomaly details first to debug
                anomaly = self.collection.find_one({'_id': ObjectId(anomaly_id)})
                if anomaly:
                    logger.info(f"Anomaly {anomaly_id} details: Approved={anomaly.get('Approved')}, time_span={anomaly.get('time_span')}, criticality={anomaly.get('criticality')}")
                else:
                    logger.error(f"Anomaly {anomaly_id} not found in database")
                
                # Remove scheduled_slot from anomaly in all collections
                self.update_anomaly_scheduled_slot_all_collections(anomaly_id, None)
                
                # Try to reschedule to the earliest available slot
                schedule_result = self._find_earliest_fit_slot(anomaly_id, slot_id)
                
                if schedule_result['success']:
                    rescheduled_count += 1
                    logger.info(f"Anomaly {anomaly_id} rescheduled to slot {schedule_result.get('slot_id')}")
                    
                    # Verify the rescheduling actually worked
                    verification_anomaly = self.collection.find_one({'_id': ObjectId(anomaly_id)})
                    if verification_anomaly and verification_anomaly.get('scheduled_slot'):
                        logger.info(f"✓ Verification: Anomaly {anomaly_id} successfully assigned to slot {verification_anomaly.get('scheduled_slot')}")
                    else:
                        logger.error(f"✗ Verification failed: Anomaly {anomaly_id} not properly assigned to a slot")
                        rescheduled_count -= 1  # Decrement since it didn't actually work
                        # Try to add to queue instead
                        queue_result = self.add_approved_anomaly_to_queue(anomaly_id)
                        if queue_result.get('success'):
                            queued_count += 1
                            logger.info(f"Anomaly {anomaly_id} added to approved queue after failed rescheduling")
                        else:
                            logger.error(f"Failed to add anomaly {anomaly_id} to queue after failed rescheduling")
                else:
                    # If rescheduling failed, add back to approved queue
                    logger.warning(f"Anomaly {anomaly_id} could not be rescheduled: {schedule_result.get('error')}")
                    queue_result = self.add_approved_anomaly_to_queue(anomaly_id)
                    if queue_result.get('success'):
                        queued_count += 1
                        logger.info(f"Anomaly {anomaly_id} added back to approved queue: {queue_result.get('message')}")
                    else:
                        logger.error(f"Failed to add anomaly {anomaly_id} to approved queue: {queue_result.get('error')}")
            
            # Delete the slot
            result = collection.delete_one({'_id': ObjectId(slot_id)})
            
            if result.deleted_count > 0:
                # Final verification: check what happened to the anomalies
                logger.info(f"=== FINAL VERIFICATION ===")
                for anomaly_id in scheduled_anomalies:
                    final_anomaly = self.collection.find_one({'_id': ObjectId(anomaly_id)})
                    if final_anomaly:
                        if final_anomaly.get('scheduled_slot'):
                            logger.info(f"✓ Anomaly {anomaly_id} is scheduled to slot: {final_anomaly.get('scheduled_slot')}")
                        else:
                            logger.warning(f"⚠ Anomaly {anomaly_id} is NOT scheduled to any slot")
                            # Check if it's in the queue
                            queue_check = self.db['approved_anomalies_queue'].find_one({'anomaly_id': str(anomaly_id)})
                            if queue_check:
                                logger.info(f"✓ Anomaly {anomaly_id} is in the approved queue")
                            else:
                                logger.error(f"✗ Anomaly {anomaly_id} is LOST - not scheduled and not in queue!")
                    else:
                        logger.error(f"✗ Anomaly {anomaly_id} not found in database")
                logger.info(f"=== END VERIFICATION ===")
                
                message = f"Time slot {slot_id} deleted successfully."
                if rescheduled_count > 0:
                    message += f" {rescheduled_count} anomalies were rescheduled to other slots."
                if queued_count > 0:
                    message += f" {queued_count} anomalies were added back to the approved queue."
                
                return {
                    'success': True,
                    'message': message,
                    'rescheduled': rescheduled_count,
                    'queued': queued_count
                }
            else:
                return {
                    'success': False,
                    'error': 'Failed to delete time slot.',
                    'rescheduled': rescheduled_count,
                    'queued': queued_count
                }
                
        except Exception as e:
            logger.error(f"Error deleting time slot {slot_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'rescheduled': 0,
                'queued': 0
            }

    def _find_earliest_fit_slot(self, anomaly_id, slot_id_to_exclude=None):
        """
        Find the earliest available time slot that can fit the given anomaly.
        This method prioritizes the earliest slot that has enough capacity.
        
        Args:
            anomaly_id (str): The ID of the anomaly to schedule
            slot_id_to_exclude (str, optional): Slot ID to exclude from search (e.g., slot being deleted)
            
        Returns:
            dict: Result with success status and slot_id if successful
        """
        from bson import ObjectId
        
        # Get the anomaly details
        anomaly = self.collection.find_one({'_id': ObjectId(anomaly_id)})
        if not anomaly:
            logger.error(f"Anomaly {anomaly_id} not found in database")
            return {'success': False, 'error': 'Anomaly not found.'}
        
        # Check if anomaly is approved (handle different possible field names)
        is_approved = (
            anomaly.get('Approved') == True or 
            anomaly.get('approved') == True or 
            anomaly.get('status') == 'Approved' or
            anomaly.get('status') == 'approved'
        )
        
        if not is_approved:
            logger.warning(f"Anomaly {anomaly_id} is not approved. Approval status: {anomaly.get('Approved')}, {anomaly.get('approved')}, {anomaly.get('status')}")
            return {'success': False, 'error': 'Anomaly not approved.'}
        
        time_span = anomaly.get('time_span')
        if not time_span:
            logger.warning(f"Anomaly {anomaly_id} missing time_span field")
            return {'success': False, 'error': 'Anomaly missing time_span.'}
        
        try:
            time_span = float(time_span)
        except Exception as e:
            logger.error(f"Invalid time_span for anomaly {anomaly_id}: {time_span}, error: {str(e)}")
            return {'success': False, 'error': 'Invalid time_span.'}
        
        # Build query to exclude the slot being deleted if specified
        query = {}
        if slot_id_to_exclude:
            query['_id'] = {'$ne': ObjectId(slot_id_to_exclude)}
            logger.info(f"Excluding slot {slot_id_to_exclude} from search")
        
        # Get all slots sorted by start_date (earliest first)
        slots = list(self.db['time_slots'].find(query).sort('start_date', 1))
        logger.info(f"Found {len(slots)} available slots for anomaly {anomaly_id}")
        
        if not slots:
            logger.warning(f"No time slots found in database")
            return {'success': False, 'error': 'No time slots available.'}
        
        for slot in slots:
            # Ensure scheduled_anomalies exists
            if 'scheduled_anomalies' not in slot:
                slot['scheduled_anomalies'] = []
            
            # Calculate used hours in this slot
            used_hours = 0
            for aid in slot['scheduled_anomalies']:
                scheduled_anomaly = self.collection.find_one({'_id': ObjectId(aid)})
                if scheduled_anomaly:
                    try:
                        used_hours += float(scheduled_anomaly.get('time_span', 0)) * 0
                    except (ValueError, TypeError):
                        continue
            
            # Calculate available hours
            slot_duration = float(slot.get('duration_hours', 0))
            available_hours = slot_duration - used_hours * 0
            
            logger.info(f"Slot {slot['_id']}: duration={slot_duration}, used={used_hours}, available={available_hours}, anomaly_needs={time_span}")
            
            # Check if this slot can fit the anomaly
            if available_hours >= time_span:
                # Add anomaly to this slot
                slot['scheduled_anomalies'].append(str(anomaly_id))
                self.db['time_slots'].update_one(
                    {'_id': slot['_id']}, 
                    {'$set': {'scheduled_anomalies': slot['scheduled_anomalies']}}
                )
                
                # Update scheduled_slot in all collections
                self.update_anomaly_scheduled_slot_all_collections(anomaly_id, slot['_id'])
                
                # Remove from approved queue if it was there
                self.remove_anomaly_from_queue(anomaly_id)
                
                logger.info(f"Successfully scheduled anomaly {anomaly_id} to slot {slot['_id']}")
                return {'success': True, 'slot_id': str(slot['_id'])}
            else:
                logger.info(f"Slot {slot['_id']} cannot fit anomaly {anomaly_id}: needs {time_span} hours but only {available_hours} available")
        
        # No available slot found
        logger.warning(f"No available slot found for anomaly {anomaly_id} (needs {time_span} hours)")
        return {'success': False, 'error': 'No available slot found.'}

    def _force_add_to_queue(self, anomaly_id):
        """
        Force add an anomaly to the approved queue without checking approval status.
        This is used as a fallback when an anomaly was already scheduled but can't be rescheduled.
        """
        from bson import ObjectId
        try:
            # Get the anomaly details
            anomaly = self.collection.find_one({'_id': ObjectId(anomaly_id)})
            if not anomaly:
                logger.error(f"Anomaly {anomaly_id} not found when trying to force add to queue")
                return {'success': False, 'error': 'Anomaly not found.'}
            
            # Check if already in queue
            queue_collection = self.db['approved_anomalies_queue']
            existing = queue_collection.find_one({'anomaly_id': str(anomaly_id)})
            if existing:
                logger.info(f"Anomaly {anomaly_id} already in queue")
                return {'success': True, 'message': 'Anomaly already in queue.'}
            
            # Add to queue with priority based on criticality and detection date
            queue_entry = {
                'anomaly_id': str(anomaly_id),
                'time_span': anomaly.get('time_span', 0),
                'criticality': anomaly.get('criticality', 1),
                'date_detected': anomaly.get('date_detected'),
                'added_to_queue_at': datetime.utcnow(),
                'status': 'pending',
                'force_added': True  # Flag to indicate this was force-added
            }
            queue_collection.insert_one(queue_entry)
            logger.info(f"Successfully force-added anomaly {anomaly_id} to approved queue")
            return {'success': True, 'message': 'Anomaly force-added to scheduling queue.'}
        except Exception as e:
            logger.error(f"Error force-adding anomaly {anomaly_id} to queue: {str(e)}")
            return {'success': False, 'error': str(e)}

    def update_anomaly_scheduled_slot_all_collections(self, anomaly_id, slot_id):
        """
        Update the scheduled_slot field for an anomaly in taza and all unit_* collections.
        If slot_id is None, unset the field.
        For unit_* collections, we only update if the anomaly_id exists as a reference.
        """
        from bson import ObjectId
        update_data = {'updated_at': datetime.utcnow()}
        if slot_id is not None:
            update_data['scheduled_slot'] = str(slot_id)
            update = {'$set': update_data}
        else:
            update = {'$unset': {'scheduled_slot': ''}, '$set': {'updated_at': datetime.utcnow()}}
        # Update in taza
        self.collection.update_one({'_id': ObjectId(anomaly_id)}, update)
        # Update in all unit_* collections that reference this anomaly
        for name in self.db.list_collection_names():
            if name.startswith('unit_'):
                collection = self.db[name]
                # Check if this anomaly is referenced in this unit collection
                ref = collection.find_one({'anomaly_id': str(anomaly_id)})
                if ref:
                    # Update the scheduled_slot in the taza collection (since unit collections only store references)
                    # The actual anomaly data is in taza, so we don't need to update unit collections
                    # Just log that this unit has this anomaly
                    logger.debug(f"Anomaly {anomaly_id} is referenced in {name}, scheduled_slot updated in taza")

    def schedule_anomaly_to_slot(self, anomaly_id):
        """
        Assign an approved anomaly to the nearest available time slot with enough hours.
        Updates both the anomaly and the slot's scheduled_anomalies.
        """
        from bson import ObjectId
        anomaly = self.collection.find_one({'_id': ObjectId(anomaly_id)})
        if not anomaly or not anomaly.get('Approved'):
            return {'success': False, 'error': 'Anomaly not found or not approved.'}
        time_span = anomaly.get('time_span')
        if not time_span:
            return {'success': False, 'error': 'Anomaly missing time_span.'}
        try:
            time_span = float(time_span)
        except Exception:
            return {'success': False, 'error': 'Invalid time_span.'}
        # Find all slots, sorted by start_date
        slots = list(self.db['time_slots'].find().sort('start_date', 1))
        for slot in slots:
            # Ensure scheduled_anomalies exists
            if 'scheduled_anomalies' not in slot:
                slot['scheduled_anomalies'] = []
            # Calculate used hours
            used = sum([self.collection.find_one({'_id': ObjectId(aid)}).get('time_span', 0) for aid in slot['scheduled_anomalies']])
            try:
                used = float(used)
            except Exception:
                used = 0
            available = float(slot.get('duration_hours', 0)) - used
            if available >= time_span:
                # Assign anomaly to this slot
                slot['scheduled_anomalies'].append(str(anomaly_id))
                self.db['time_slots'].update_one({'_id': slot['_id']}, {'$set': {'scheduled_anomalies': slot['scheduled_anomalies']}})
                # Update scheduled_slot in all collections with the new slot id
                self.update_anomaly_scheduled_slot_all_collections(anomaly_id, slot['_id'])
                # Remove from approved queue if it was there
                self.remove_anomaly_from_queue(anomaly_id)
                return {'success': True, 'slot_id': str(slot['_id'])}
        return {'success': False, 'error': 'No available slot found.'}

    def remove_anomaly_from_slot(self, anomaly_id, slot_id):
        """
        Remove an anomaly from a slot's scheduled_anomalies.
        """
        from bson import ObjectId
        slot = self.db['time_slots'].find_one({'_id': ObjectId(slot_id)})
        if not slot or 'scheduled_anomalies' not in slot:
            return
        slot['scheduled_anomalies'] = [aid for aid in slot['scheduled_anomalies'] if aid != str(anomaly_id)]
        self.db['time_slots'].update_one({'_id': ObjectId(slot_id)}, {'$set': {'scheduled_anomalies': slot['scheduled_anomalies']}})

    def reschedule_anomalies_for_slot(self, slot_id):
        """
        For a given slot, reschedule all its anomalies (used after update or delete).
        If an anomaly can't be rescheduled, add it back to the approved queue.
        """
        from bson import ObjectId
        slot = self.db['time_slots'].find_one({'_id': ObjectId(slot_id)})
        if not slot or 'scheduled_anomalies' not in slot:
            return
        
        for aid in slot['scheduled_anomalies']:
            # Remove scheduled_slot from anomaly in all collections
            self.update_anomaly_scheduled_slot_all_collections(aid, None)
            # Try to reschedule
            sched_result = self.schedule_anomaly_to_slot(aid)
            # If rescheduling failed, add back to approved queue
            if not sched_result['success']:
                self.add_approved_anomaly_to_queue(aid)
                logger.info(f"Anomaly {aid} could not be rescheduled, added back to approved queue")
        
        # Clear scheduled_anomalies
        self.db['time_slots'].update_one({'_id': ObjectId(slot_id)}, {'$set': {'scheduled_anomalies': []}})

    def check_and_reschedule_to_earlier_slot(self, new_slot_id):
        """
        Check if any anomalies scheduled for later slots can be moved to this earlier slot.
        This is called when a new slot is created.
        """
        from bson import ObjectId
        try:
            new_slot = self.db['time_slots'].find_one({'_id': ObjectId(new_slot_id)})
            if not new_slot:
                logger.warning(f"New slot {new_slot_id} not found for rescheduling")
                return {'rescheduled': 0, 'message': 'New slot not found.'}
            
            new_slot_start = new_slot.get('start_date')
            if not new_slot_start:
                logger.warning(f"New slot {new_slot_id} has no start date")
                return {'rescheduled': 0, 'message': 'New slot has no start date.'}
            
            logger.info(f"Checking for rescheduling to earlier slot {new_slot_id} (start_date: {new_slot_start})")
            
            # Get all other slots that start after this new slot
            later_slots = list(self.db['time_slots'].find({
                '_id': {'$ne': ObjectId(new_slot_id)},
                'start_date': {'$gt': new_slot_start}
            }).sort('start_date', 1))
            
            logger.info(f"Found {len(later_slots)} later slots to check for rescheduling")
            
            rescheduled_count = 0
            
            for later_slot in later_slots:
                if 'scheduled_anomalies' not in later_slot or not later_slot['scheduled_anomalies']:
                    logger.debug(f"Slot {later_slot['_id']} has no scheduled anomalies to move")
                    continue
                
                logger.info(f"Checking slot {later_slot['_id']} (start_date: {later_slot.get('start_date')}) with {len(later_slot['scheduled_anomalies'])} scheduled anomalies")
                
                # Move all anomalies that fit the new slot duration
                anomalies_to_move = []
                for aid in list(later_slot['scheduled_anomalies']):
                    anomaly = self.collection.find_one({'_id': ObjectId(aid)})
                    if not anomaly:
                        logger.warning(f"Anomaly {aid} not found in database")
                        continue
                    time_span = float(anomaly.get('time_span', 0))
                    if time_span <= float(new_slot.get('duration_hours', 0)):
                        anomalies_to_move.append(aid)
                        logger.info(f"Anomaly {aid} can be moved to earlier slot (needs {time_span}h, slot duration: {new_slot.get('duration_hours', 0)}h)")
                    else:
                        logger.debug(f"Anomaly {aid} cannot fit in earlier slot (needs {time_span}h, slot duration: {new_slot.get('duration_hours', 0)}h)")
                
                logger.info(f"Moving {len(anomalies_to_move)} anomalies from slot {later_slot['_id']} to earlier slot {new_slot_id}")
                
                # Move the anomalies
                for aid in anomalies_to_move:
                    # Remove from later slot
                    later_slot['scheduled_anomalies'].remove(aid)
                    self.db['time_slots'].update_one(
                        {'_id': later_slot['_id']}, 
                        {'$set': {'scheduled_anomalies': later_slot['scheduled_anomalies']}}
                    )
                    # Add to new slot
                    if 'scheduled_anomalies' not in new_slot:
                        new_slot['scheduled_anomalies'] = []
                    new_slot['scheduled_anomalies'].append(aid)
                    self.db['time_slots'].update_one(
                        {'_id': new_slot['_id']}, 
                        {'$set': {'scheduled_anomalies': new_slot['scheduled_anomalies']}}
                    )
                    # Update anomaly's scheduled_slot in all collections
                    self.update_anomaly_scheduled_slot_all_collections(aid, new_slot['_id'])
                    rescheduled_count += 1
                    logger.info(f"Rescheduled anomaly {aid} from slot {later_slot['_id']} to earlier slot {new_slot['_id']}")
            
            logger.info(f"Rescheduling complete: {rescheduled_count} anomalies moved to earlier slot")
            return {
                'rescheduled': rescheduled_count,
                'message': f'Rescheduled {rescheduled_count} anomalies to earlier slot.'
            }
            
        except Exception as e:
            logger.error(f"Error checking and rescheduling to earlier slot: {str(e)}")
            return {'rescheduled': 0, 'error': str(e)}

    def add_approved_anomaly_to_queue(self, anomaly_id):
        """
        Add an approved anomaly to the approved anomalies queue for scheduling.
        """
        from bson import ObjectId
        try:
            # Check if anomaly exists
            anomaly = self.collection.find_one({'_id': ObjectId(anomaly_id)})
            if not anomaly:
                logger.error(f"Anomaly {anomaly_id} not found when trying to add to queue")
                return {'success': False, 'error': 'Anomaly not found.'}
            
            # Check if anomaly is approved (handle different possible field names)
            is_approved = (
                anomaly.get('Approved') == True or 
                anomaly.get('approved') == True or 
                anomaly.get('status') == 'Approved' or
                anomaly.get('status') == 'approved'
            )
            
            if not is_approved:
                logger.warning(f"Anomaly {anomaly_id} is not approved when trying to add to queue. Approval status: {anomaly.get('Approved')}, {anomaly.get('approved')}, {anomaly.get('status')}")
                return {'success': False, 'error': 'Anomaly not approved.'}
            
            # Check if already in queue
            queue_collection = self.db['approved_anomalies_queue']
            existing = queue_collection.find_one({'anomaly_id': str(anomaly_id)})
            if existing:
                logger.info(f"Anomaly {anomaly_id} already in queue")
                return {'success': True, 'message': 'Anomaly already in queue.'}
            
            # Add to queue with priority based on criticality and detection date
            queue_entry = {
                'anomaly_id': str(anomaly_id),
                'time_span': anomaly.get('time_span', 0),
                'criticality': anomaly.get('criticality', 1),
                'date_detected': anomaly.get('date_detected'),
                'added_to_queue_at': datetime.utcnow(),
                'status': 'pending'
            }
            queue_collection.insert_one(queue_entry)
            logger.info(f"Successfully added anomaly {anomaly_id} to approved queue")
            return {'success': True, 'message': 'Anomaly added to scheduling queue.'}
        except Exception as e:
            logger.error(f"Error adding anomaly {anomaly_id} to queue: {str(e)}")
            return {'success': False, 'error': str(e)}

    def remove_anomaly_from_queue(self, anomaly_id):
        """
        Remove an anomaly from the approved anomalies queue.
        """
        from bson import ObjectId
        try:
            queue_collection = self.db['approved_anomalies_queue']
            result = queue_collection.delete_one({'anomaly_id': str(anomaly_id)})
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"Error removing anomaly {anomaly_id} from queue: {str(e)}")
            return False

    def get_approved_anomalies_queue(self):
        """
        Get all approved anomalies in the queue, sorted by priority.
        """
        try:
            queue_collection = self.db['approved_anomalies_queue']
            # Sort by criticality (desc), then by date_detected (asc - older first)
            queue = list(queue_collection.find().sort([
                ('criticality', -1),
                ('date_detected', 1)
            ]))
            return queue
        except Exception as e:
            logger.error(f"Error getting approved anomalies queue: {str(e)}")
            return []

    def check_and_schedule_approved_anomalies(self, slot_id=None):
        """
        Check the approved anomalies queue and schedule any that can fit in available slots.
        If slot_id is provided, only check that specific slot.
        """
        from bson import ObjectId
        try:
            queue_collection = self.db['approved_anomalies_queue']
            slots_collection = self.db['time_slots']
            
            # Get all approved anomalies in queue
            queue = self.get_approved_anomalies_queue()
            logger.info(f"Found {len(queue)} approved anomalies in queue")
            if not queue:
                return {'scheduled': 0, 'message': 'No approved anomalies in queue.'}
            
            scheduled_count = 0
            
            if slot_id:
                # Check specific slot
                slot = slots_collection.find_one({'_id': ObjectId(slot_id)})
                if not slot:
                    return {'scheduled': 0, 'error': 'Slot not found.'}
                slots_to_check = [slot]
                logger.info(f"Checking specific slot {slot_id} for scheduling")
            else:
                # Check all slots, sorted by start_date
                slots_to_check = list(slots_collection.find().sort('start_date', 1))
                logger.info(f"Checking {len(slots_to_check)} slots for scheduling")
            
            for slot in slots_to_check:
                # Ensure scheduled_anomalies exists
                if 'scheduled_anomalies' not in slot:
                    slot['scheduled_anomalies'] = []
                
                slot_duration = float(slot.get('duration_hours', 0))
                logger.info(f"Slot {slot['_id']}: duration={slot_duration}")
                
                # Try to schedule approved anomalies that can fit
                for queue_entry in queue:
                    if queue_entry['status'] != 'pending':
                        logger.debug(f"Skipping queue entry {queue_entry['anomaly_id']} - status is {queue_entry['status']}")
                        continue
                    
                    anomaly_id = queue_entry['anomaly_id']
                    time_span = float(queue_entry['time_span'])
                    
                    # Check if this anomaly can fit in this slot (time_span <= slot_duration)
                    if time_span <= slot_duration:
                        # Check if anomaly is still approved and not already scheduled
                        anomaly = self.collection.find_one({'_id': ObjectId(anomaly_id)})
                        if anomaly:
                            is_approved = (
                                anomaly.get('Approved') == True or 
                                anomaly.get('approved') == True or 
                                anomaly.get('status') == 'Approved' or
                                anomaly.get('status') == 'approved'
                            )
                            has_scheduled_slot = anomaly.get('scheduled_slot')
                            
                            logger.info(f"DEBUG: Anomaly {anomaly_id} - approved: {is_approved}, scheduled_slot: {has_scheduled_slot}, time_span: {time_span}, slot_duration: {slot_duration}")
                            
                            if is_approved and not has_scheduled_slot:
                                logger.info(f"Scheduling anomaly {anomaly_id} to slot {slot['_id']} (needs {time_span}h, slot duration: {slot_duration}h)")
                                # Schedule the anomaly
                                slot['scheduled_anomalies'].append(anomaly_id)
                                self.update_anomaly_scheduled_slot_all_collections(anomaly_id, slot['_id'])
                                
                                # Update slot's scheduled_anomalies
                                slots_collection.update_one(
                                    {'_id': slot['_id']}, 
                                    {'$set': {'scheduled_anomalies': slot['scheduled_anomalies']}}
                                )
                                
                                # Remove from queue
                                queue_collection.delete_one({'anomaly_id': anomaly_id})
                                
                                scheduled_count += 1
                                
                                logger.info(f"Scheduled approved anomaly {anomaly_id} to slot {slot['_id']}")
                            else:
                                logger.warning(f"Cannot schedule anomaly {anomaly_id}: approved={is_approved}, scheduled_slot={has_scheduled_slot}")
                        else:
                            logger.error(f"Anomaly {anomaly_id} not found in database")
                    else:
                        logger.debug(f"Anomaly {anomaly_id} cannot fit in slot {slot['_id']}: needs {time_span}h but slot duration is {slot_duration}h")
            
            logger.info(f"Scheduling complete: {scheduled_count} anomalies scheduled")
            return {
                'scheduled': scheduled_count, 
                'message': f'Scheduled {scheduled_count} approved anomalies.'
            }
            
        except Exception as e:
            logger.error(f"Error checking and scheduling approved anomalies: {str(e)}")
            return {'scheduled': 0, 'error': str(e)}

    def get_analytics_data(self, period='10year', start_date=None, end_date=None):
        """
        Get analytics data for visualizations.
        Args:
            period (str): Time period for trend data ('7months', '1year')
            start_date (str): Optional start date in 'YYYY-MM-DD' format
            end_date (str): Optional end date in 'YYYY-MM-DD' format
        Returns:
            dict: Analytics data for charts
        """
        try:
            print(f"get_analytics_data called with period={period}, start_date={start_date}, end_date={end_date}")
            from datetime import datetime
            
            # First, let's check what data we have in the collection
            total_docs = self.collection.count_documents({})
            print(f"Total documents in collection: {total_docs}")
            
            # Get a sample document to see what date fields exist
            sample_doc = self.collection.find_one({})
            if sample_doc:
                print(f"Sample document keys: {list(sample_doc.keys())}")
                date_fields = [k for k, v in sample_doc.items() if isinstance(v, (str, datetime)) and any(date_word in k.lower() for date_word in ['date', 'created', 'updated', 'détéction'])]
                print(f"Date fields found: {date_fields}")
            
            # If start_date and end_date are provided, ALWAYS use them for filtering
            if start_date and end_date:
                start_date_str = start_date
                end_date_str = end_date
                start_dt = datetime.strptime(start_date_str, '%Y-%m-%d')
                end_dt = datetime.strptime(end_date_str, '%Y-%m-%d')
                print(f"Using provided date range: {start_date_str} to {end_date_str}")
            else:
                # Fallback to period logic ONLY if no dates are provided
                # Use a very broad date range to include all data
                start_date_str = "2019-01-01"  # Start from 2019 to include all data
                end_date_str = "2030-12-31"    # End far in the future
                print(f"Using broad date range: {start_date_str} to {end_date_str}")
            
            # Get anomalies within date range
            # The date field is stored as string "2019-01-01 10:09:10"
            # Always match the full string date range for the day
            def expand_date(date_str, is_start=True):
                if len(date_str) == 10:
                    return date_str + (" 00:00:00" if is_start else " 23:59:59")
                return date_str
            start_date_full = expand_date(start_date_str, is_start=True)
            end_date_full = expand_date(end_date_str, is_start=False)
            date_filter = {
                '$or': [
                    {'Date de détéction de l\'anomalie': {'$gte': start_date_full, '$lte': end_date_full}},
                    {'date_detected': {'$gte': start_date_str, '$lte': end_date_str}},
                    {'created_at': {'$gte': start_dt, '$lte': end_dt}}
                ]
            }
            
            print(f"Date filter: {date_filter}")
            anomalies = list(self.collection.find(date_filter))
            print(f"Found {len(anomalies)} anomalies with date filter")
            
            # If no anomalies found with date filter, try without date filter
            if len(anomalies) == 0:
                print("No anomalies found with date filter, trying without date filter...")
                anomalies = list(self.collection.find({}))
                print(f"Found {len(anomalies)} anomalies without date filter")
            
            # Process data for charts
            analytics_data = {
                'severity_data': self._get_severity_data(anomalies),
                'status_data': self._get_status_data(anomalies),
                'trend_data': self._get_trend_data(anomalies, period),
                'unit_data': self._get_unit_data(anomalies)
            }
            
            print(f"Analytics data generated:")
            print(f"  severity_data: {len(analytics_data['severity_data'])} items")
            print(f"  status_data: {len(analytics_data['status_data'])} items")
            print(f"  trend_data: {len(analytics_data['trend_data'])} items")
            print(f"  unit_data: {len(analytics_data['unit_data'])} items")
            
            return analytics_data
        except Exception as e:
            logger.error(f"Error getting analytics data: {str(e)}")
            print(f"Exception in get_analytics_data: {str(e)}")
            return {
                'severity_data': [],
                'status_data': [],
                'trend_data': [],
                'unit_data': []
            }
    
    def _get_severity_data(self, anomalies):
        """Get severity distribution data."""
        print(f"_get_severity_data called with {len(anomalies)} anomalies")
        severity_counts = {}
        severity_colors = {
            1: '#6b7280',  # Too Low - Gris (Gray)
            2: '#22c55e',  # Low - Vert (Green)
            3: '#eab308',  # Lower Medium - Jaune (Yellow)
            4: '#eab308',  # Lower Medium - Jaune (Yellow)
            5: '#f97316',  # Medium High - Orange
            6: '#f97316',  # Medium High - Orange
            7: '#ef4444',  # High - Rouge (Red)
            8: '#ef4444',  # High - Rouge (Red)
            9: '#dc2626',  # Critical - Dark Red
            10: '#dc2626', # Critical - Dark Red
            11: '#dc2626', # Critical - Dark Red
            12: '#dc2626'  # Critical - Dark Red
        }
        
        severity_names = {
            1: 'Too Low',
            2: 'Low', 
            3: 'Lower Medium',
            4: 'Lower Medium',
            5: 'Medium High',
            6: 'Medium High',
            7: 'High',
            8: 'High',
            9: 'Critical',
            10: 'Critical',
            11: 'Critical',
            12: 'Critical'
        }
        
        def get_severity_level(criticality):
            """Map criticality value to severity level."""
            try:
                crit_value = float(criticality)
                if crit_value <= 1:
                    return 1
                elif crit_value <= 2:
                    return 2
                elif crit_value <= 4:
                    return 3  # Group 3-4 together
                elif crit_value <= 6:
                    return 5  # Group 5-6 together
                elif crit_value <= 8:
                    return 7  # Group 7-8 together
                else:
                    return 9  # Group 9+ together
            except (ValueError, TypeError):
                return 2  # Default to Low if parsing fails
        
        # Group anomalies by severity level
        for anomaly in anomalies:
            criticality = anomaly.get('criticality', 2)
            severity_level = get_severity_level(criticality)
            severity_counts[severity_level] = severity_counts.get(severity_level, 0) + 1
        
        print(f"Severity counts: {severity_counts}")
        
        result = [
            {
                'name': severity_names.get(level, "Critical"),
                'value': count,
                'color': severity_colors.get(level, '#dc2626')
            }
            for level, count in severity_counts.items()
        ]
        
        print(f"_get_severity_data returning {len(result)} items: {result}")
        return result
    
    def _get_status_data(self, anomalies):
        """Get status distribution data."""
        print(f"_get_status_data called with {len(anomalies)} anomalies")
        status_counts = {}
        status_colors = {
            'Pending': '#ef4444',
            'open': '#ef4444',      # Red
            'in_progress': '#f97316', # Orange
            'resolved': '#22c55e',   # Green
            'closed': '#6b7280'      # Gray
        }
        
        for anomaly in anomalies:
            status = anomaly.get('status', 'open').lower()
            status_counts[status] = status_counts.get(status, 0) + 1
        
        print(f"Status counts: {status_counts}")
        
        status_names = {
            'Pending': 'Pending',
            'open': 'Open',
            'in_progress': 'In Progress',
            'resolved': 'Resolved',
            'closed': 'Closed'
        }
        
        result = [
            {
                'name': status_names.get(status, status.title()),
                'value': count,
                'color': status_colors.get(status, '#6b7280')
            }
            for status, count in status_counts.items()
        ]
        
        print(f"_get_status_data returning {len(result)} items: {result}")
        return result
    
    def _get_trend_data(self, anomalies, period):
        """Get trend data by month."""
        print(f"_get_trend_data called with {len(anomalies)} anomalies, period={period}")
        from collections import defaultdict
        
        # Group anomalies by month
        monthly_counts = defaultdict(int)
        
        for anomaly in anomalies:
            # Try different date fields
            date_str = (
                anomaly.get('Date de détéction de l\'anomalie') or
                anomaly.get('date_detected') or
                anomaly.get('created_at')
            )
            
            if date_str:
                try:
                    if isinstance(date_str, str):
                        # Try different date formats
                        try:
                            # Try datetime format first (with time)
                            date_obj = datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S')
                        except ValueError:
                            try:
                                # Try date-only format
                                date_obj = datetime.strptime(date_str, '%Y-%m-%d')
                            except ValueError:
                                # Try other common formats
                                date_obj = datetime.strptime(date_str, '%Y-%m-%d %H:%M')
                    else:
                        date_obj = date_str
                    
                    month_key = date_obj.strftime('%Y-%m')
                    monthly_counts[month_key] += 1
                except Exception as e:
                    logger.warning(f"Could not parse date '{date_str}': {str(e)}")
                    continue
        
        print(f"Monthly counts: {dict(monthly_counts)}")
        
        # Generate trend data
        trend_data = []
        months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        
        if period == '7months':
            # Last 7 months
            for i in range(7):
                date = datetime.utcnow() - timedelta(days=30 * (6 - i))
                month_key = date.strftime('%Y-%m')
                month_name = months[date.month - 1]
                trend_data.append({
                    'month': month_name,
                    'value': monthly_counts.get(month_key, 0)
                })
        else:
            # Last 12 months
            for i in range(12):
                date = datetime.utcnow() - timedelta(days=30 * (11 - i))
                month_key = date.strftime('%Y-%m')
                month_name = months[date.month - 1]
                trend_data.append({
                    'month': month_name,
                    'value': monthly_counts.get(month_key, 0)
                })
        
        print(f"_get_trend_data returning {len(trend_data)} items: {trend_data}")
        return trend_data
    
    def _get_unit_data(self, anomalies):
        """Get unit distribution data."""
        print(f"_get_unit_data called with {len(anomalies)} anomalies")
        unit_counts = {}
        
        for anomaly in anomalies:
            unit = anomaly.get('unit', 'Unknown')
            unit_counts[unit] = unit_counts.get(unit, 0) + 1
        
        print(f"Unit counts: {unit_counts}")
        
        result = [
            {
                'name': unit,
                'value': count
            }
            for unit, count in unit_counts.items()
        ]
        
        print(f"_get_unit_data returning {len(result)} items: {result}")
        return result

    def _schedule_approved_anomalies_to_slot(self, slot_id):
        """
        Schedule approved anomalies directly from the approved collection to a specific slot.
        This handles anomalies that are approved but not in the queue.
        """
        from bson import ObjectId
        try:
            slots_collection = self.db['time_slots']
            
            # Get the slot
            slot = slots_collection.find_one({'_id': ObjectId(slot_id)})
            if not slot:
                logger.error(f"Slot {slot_id} not found for additional scheduling")
                return 0
            
            # Ensure scheduled_anomalies exists
            if 'scheduled_anomalies' not in slot:
                slot['scheduled_anomalies'] = []
            
            slot_duration = float(slot.get('duration_hours', 0))
            logger.info(f"Additional scheduling for slot {slot_id}: duration={slot_duration}h")
            
            if slot_duration <= 0:
                logger.info(f"No duration in slot {slot_id} for additional scheduling")
                return 0
            
            # Find approved anomalies that aren't scheduled and aren't in the queue
            queue_collection = self.db['approved_anomalies_queue']
            queue_anomaly_ids = set()
            for entry in queue_collection.find():
                queue_anomaly_ids.add(entry['anomaly_id'])
            
            # Get approved anomalies that aren't in queue and aren't scheduled
            approved_anomalies = list(self.collection.find({
                '$and': [
                    {
                        '$or': [
                            {'Approved': True},
                            {'approved': True}
                        ]
                    },
                    {
                        '$or': [
                            {'scheduled_slot': {'$exists': False}},
                            {'scheduled_slot': None},
                            {'scheduled_slot': ''}
                        ]
                    },
                    {'_id': {'$nin': [ObjectId(aid) for aid in queue_anomaly_ids]}}
                ]
            }).sort([('criticality', -1), ('date_detected', 1)]))
            
            logger.info(f"Found {len(approved_anomalies)} approved anomalies not in queue for additional scheduling")
            
            # Debug: Log some details about found anomalies
            for i, anomaly in enumerate(approved_anomalies[:5]):  # Log first 5 for debugging
                logger.info(f"DEBUG: Approved anomaly {i+1} - ID: {anomaly['_id']}, time_span: {anomaly.get('time_span', 0)}, criticality: {anomaly.get('criticality', 0)}")
                logger.info(f"DEBUG: Approval fields - Approved: {anomaly.get('Approved')}, approved: {anomaly.get('approved')}, status: {anomaly.get('status')}")
            
            # Also check what's in the queue for comparison
            queue_entries = list(queue_collection.find())
            logger.info(f"DEBUG: Queue has {len(queue_entries)} entries")
            for i, entry in enumerate(queue_entries[:3]):  # Log first 3 queue entries
                logger.info(f"DEBUG: Queue entry {i+1} - anomaly_id: {entry['anomaly_id']}, time_span: {entry['time_span']}, status: {entry['status']}")
            
            # Debug: Show all anomalies sorted by time_span
            sorted_anomalies = sorted(approved_anomalies, key=lambda x: float(x.get('time_span', 0)))
            logger.info(f"DEBUG: All approved anomalies sorted by time_span:")
            for i, anomaly in enumerate(sorted_anomalies):
                time_span = float(anomaly.get('time_span', 0))
                logger.info(f"DEBUG: Anomaly {i+1} - ID: {anomaly['_id']}, time_span: {time_span}, can_fit: {time_span <= slot_duration}")
            
            scheduled_count = 0
            
            # Sort anomalies by time_span (smallest first) to maximize slot utilization
            sorted_anomalies = sorted(approved_anomalies, key=lambda x: float(x.get('time_span', 0)))
            
            for anomaly in sorted_anomalies:
                anomaly_id = str(anomaly['_id'])
                time_span = float(anomaly.get('time_span', 0))
                
                logger.info(f"DEBUG: Checking anomaly {anomaly_id} - time_span: {time_span}, slot_duration: {slot_duration}")
                
                # Check if this anomaly can fit in this slot (time_span <= slot_duration)
                if time_span <= slot_duration:
                    logger.info(f"Additional scheduling: anomaly {anomaly_id} to slot {slot_id} (needs {time_span}h, slot duration: {slot_duration}h)")
                    
                    # Schedule the anomaly
                    slot['scheduled_anomalies'].append(anomaly_id)
                    self.update_anomaly_scheduled_slot_all_collections(anomaly_id, slot_id)
                    
                    # Update slot's scheduled_anomalies
                    slots_collection.update_one(
                        {'_id': slot['_id']}, 
                        {'$set': {'scheduled_anomalies': slot['scheduled_anomalies']}}
                    )
                    
                    scheduled_count += 1
                    
                    logger.info(f"Additional scheduling: approved anomaly {anomaly_id} scheduled to slot {slot_id}")
                else:
                    logger.info(f"Additional scheduling: anomaly {anomaly_id} cannot fit in slot {slot_id}: needs {time_span}h but slot duration is {slot_duration}h")
            
            logger.info(f"Additional scheduling complete: {scheduled_count} anomalies scheduled directly to slot {slot_id}")
            return scheduled_count
            
        except Exception as e:
            logger.error(f"Error in additional scheduling for slot {slot_id}: {str(e)}")
            return 0

    def get_yearly_trend_data(self, year):
        """
        Get anomaly trend data for a specific year, grouped by month.
        Args:
            year (int): Year to get data for
        Returns:
            list: Monthly trend data for the specified year
        """
        try:
            from datetime import datetime
            from collections import defaultdict
            
            # Create date range for the entire year
            start_date = f"{year}-01-01"
            end_date = f"{year}-12-31"
            
            # Get anomalies within the year
            # Handle string date format "2019-01-01 10:09:10"
            date_filter = {
                '$or': [
                    {'Date de détéction de l\'anomalie': {'$gte': start_date, '$lte': end_date + ' 23:59:59'}},
                    {'date_detected': {'$gte': start_date, '$lte': end_date}},
                    {'created_at': {'$gte': datetime(year, 1, 1), '$lte': datetime(year, 12, 31, 23, 59, 59)}}
                ]
            }
            
            anomalies = list(self.collection.find(date_filter))
            
            # Group anomalies by month
            monthly_counts = defaultdict(int)
            month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            
            for anomaly in anomalies:
                # Try different date fields
                date_str = (
                    anomaly.get('Date de détéction de l\'anomalie') or
                    anomaly.get('date_detected') or
                    anomaly.get('created_at')
                )
                
                if date_str:
                    try:
                        if isinstance(date_str, str):
                            # Try different date formats
                            try:
                                date_obj = datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S')
                            except ValueError:
                                try:
                                    date_obj = datetime.strptime(date_str, '%Y-%m-%d')
                                except ValueError:
                                    date_obj = datetime.strptime(date_str, '%Y-%m-%d %H:%M')
                        else:
                            date_obj = date_str
                        
                        # Only count if it's in the specified year
                        if date_obj.year == year:
                            month = date_obj.month - 1  # 0-based index
                            monthly_counts[month] += 1
                    except Exception as e:
                        logger.warning(f"Could not parse date '{date_str}': {str(e)}")
                        continue
            
            # Generate trend data for all months of the year
            trend_data = []
            for month_idx in range(12):
                trend_data.append({
                    'month': month_names[month_idx],
                    'value': monthly_counts[month_idx]
                })
            
            return trend_data
            
        except Exception as e:
            logger.error(f"Error getting yearly trend data for {year}: {str(e)}")
            return []

    def get_ai_criticality(self, anomaly):
        """
        Use the new AI endpoint to predict criticality scores for the anomaly.
        """
        url = "https://4c36f9e83e3d.ngrok-free.app/analyze"
        headers = {
            'Content-Type': 'application/json',
        }
        description = anomaly.get('Description') or anomaly.get('description') or ''
        payload = {"description": description}
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=30)
            response.raise_for_status()
            data = response.json()
            if data.get('success') and 'predicted_scores' in data:
                scores = data['predicted_scores']
                fiab = scores.get('integrite')
                dispo = scores.get('disponibilite') or scores.get('disponibilite') or scores.get('disponibilité') or scores.get('disponibilite')
                if dispo is None:
                    dispo = scores.get('disponibilite')
                proc = scores.get('process_safe')
                return fiab, dispo, proc
            else:
                logger.error(f"AI endpoint did not return predicted_scores: {data}")
                return None, None, None
        except Exception as e:
            logger.error(f"AI criticality request failed: {e}")
            return None, None, None


# Global MongoDB service instance
mongodb_service = None


def get_mongodb_service():
    """
    Get or create MongoDB service instance.
    
    Returns:
        MongoDBService: MongoDB service instance
    """
    global mongodb_service
    if mongodb_service is None:
        mongodb_service = MongoDBService()
    return mongodb_service 