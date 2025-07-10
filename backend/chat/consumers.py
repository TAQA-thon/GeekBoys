import json
from channels.generic.websocket import AsyncWebsocketConsumer
import httpx

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()

    async def disconnect(self, close_code):
        pass

    async def receive(self, text_data):
        data = json.loads(text_data)
        message = data.get('message', '')
        print (f"message = {message}")
        ai_response = await self.ask_ai(message)
        print (f"ai_response = {ai_response}")
        await self.send(text_data=json.dumps({
            'message': ai_response
        }))
    
    def build_prompt(self, user_message, conversation_history=None):
        system_instructions = (
            "You are Taqa's smart assistant. "
            "Use the Taqa knowledge base to answer user questions about anomaly management, scheduling, criticality, and related topics. "
            "If you do not know the answer, say so honestly. "
            "Be concise, accurate, and helpful. "
        )
        if conversation_history:
            history_str = "\n".join(
                f"User: {msg['user']}\nAssistant: {msg['assistant']}" for msg in conversation_history
            )
            prompt = (
                f"{system_instructions}\n"
                "Here is the conversation so far:\n"
                f"{history_str}\n"
                f"User: {user_message}\nAssistant:"
            )
        else:
            prompt = (
                f"{system_instructions}\n"
                f"User: {user_message}\nAssistant:"
            )
            print ("history_str", history_str)
        return prompt

    async def ask_ai(self, user_message, conversation_history=None, session_id=None):
        url = "https://f88d2cdbbf3a.ngrok-free.app/api/v1/agents/d13464f45b7111f0bf0a4a50e63bfe3f/completions"
        print (f"message = {user_message}")
        headers = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ragflow-cxNTg1YTIyNWNkOTExZjBiYzk1ZjY5NW',
        }
        prompt = self.build_prompt(user_message, conversation_history)
        print (f"prompt = {prompt}")

        payload = {
            "model": "model",
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
        }
        if session_id:
            payload["session_id"] = session_id
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()
                ai_text = None
                if isinstance(data, dict):
                    if 'choices' in data and data['choices']:
                        ai_text = data['choices'][0].get('message', {}).get('content', '')
                    elif 'data' in data and 'answer' in data['data']:
                        ai_text = data['data']['answer']
                    elif 'message' in data:
                        ai_text = data['message']
                return ai_text or "Sorry, I couldn't get a response from the AI."
        except Exception as e:
            return f"AI error: {e}"