import together
import warnings
import time

warnings.filterwarnings("ignore", category=DeprecationWarning)

model = "lucineucine_2e68/Llama-4-Scout-17B-16E-Instruct-taqa-criticality-v2-5acf3937"

def query_model(prompt):
    for attempt in range(5):
        try:
            response = together.Complete.create(
                prompt=prompt,
                model=model,
                max_tokens=150,
                temperature=0.7
            )
            return response['choices'][0]['text']
        except together.error.ServiceUnavailableError:
            print(f"Service unavailable, retrying... ({attempt+1}/5)")
            time.sleep(5)
    return "Failed to get response after multiple retries."

if __name__ == "__main__":
    while True:
        user_input = input("You: ")
        if user_input.lower() in ['exit', 'quit']:
            print("Goodbye!")
            break
        output = query_model(user_input)
        print("Model:", output)