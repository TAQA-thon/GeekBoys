# Makefile for Taqa project

.PHONY: backend frontend mongodb start

start:
	python3 -m venv venv
	venv/bin/pip install -r backend/requirements.txt
	$(MAKE) -j 3 backend frontend mongodb 

backend:
	cd backend && ../venv/bin/python3 -m daphne -b 0.0.0.0 -p 8000 anomaly_scheduler.asgi:application

frontend:
	cd frontend && npm install
	cd frontend && npm run dev

mongodb:
	docker run -d --name mongo -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=admin -p 27017:27017 mongo

clean:
	rm -rf frontend/node_modules
	rm -rf venv
	rm -rf backend/venv
	rm -rf frontend/.next
