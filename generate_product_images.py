#!/usr/bin/env python3
import json
import os
import boto3
import base64
from io import BytesIO
from PIL import Image

# Please install the following packages in a virtual environment locally:
# pip install boto3
# pip install Pillow

def read_jsonl_file(file_path):
    """Read a JSONL file and return the parsed data."""
    with open(file_path, 'r') as file:
        content = file.read()
        # The file appears to be a JSON array rather than JSONL
        return json.loads(content)

def generate_image_with_bedrock(prompt, model_id="amazon.nova-canvas-v1:0"):
    """Generate an image using Amazon Bedrock's Nova Canvas model."""
    bedrock_runtime = boto3.client(
        service_name='bedrock-runtime',
        region_name='us-east-1'  # Change to your preferred region
    )
    
    # Prepare the request body for image generation
# Format the request payload using the model's native structure.
    request_body = {
        "taskType": "TEXT_IMAGE",
        "textToImageParams": {"text": prompt},
        "imageGenerationConfig": {
            "seed": 12,
            "quality": "standard",
            "height": 640,
            "width": 640,
            "numberOfImages": 1,
        },
    }
    
    # Call the Bedrock API
    response = bedrock_runtime.invoke_model(
        modelId=model_id,
        body=json.dumps(request_body)
    )
    
    # Parse the response
    response_body = json.loads(response['body'].read().decode('utf-8'))
    
    # Extract the base64-encoded image
    image_data = response_body['images'][0]
    
    # Convert base64 to image
    image_bytes = base64.b64decode(image_data)
    image = Image.open(BytesIO(image_bytes))
    
    return image

def save_image(image, file_path):
    """Save the PIL Image to the specified file path."""
    # Ensure the directory exists
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    
    # Save the image
    image.save(file_path, format='PNG')
    print(f"Image saved to {file_path}")

def main():
    # Path to the products_content.jsonl file
    products_file = "artifacts/index_lambda/products_content.jsonl"
    
    # Path to the data folder for saving images
    data_folder = "artifacts/data"
    
    # Read the products data
    products = read_jsonl_file(products_file)
    
    # Process each product
    for product in products:
        title = product.get("title", "")
        color = product.get("color", "")
        file_name = product.get("file_name", "")
        
        if title and color and file_name:
            # Create a prompt for image generation
            prompt = f"A professional product photograph of {title}. The product is {color} in color. High-quality studio lighting, clean background, detailed product shot."
            
            print(f"Generating image for: {title}")
            print(f"Prompt: {prompt}")
            
            try:
                # Generate the image
                image = generate_image_with_bedrock(prompt)
                # resize the image to 320x320
                image = image.resize((320, 320))
                # Save the image
                image_path = os.path.join(data_folder, file_name)
                save_image(image, image_path)
                print(f"Successfully generated and saved image for {title}")
                
            except Exception as e:
                print(f"Error generating image for {title}: {str(e)}")
        else:
            print(f"Skipping product due to missing data: {product}")

if __name__ == "__main__":
    main()