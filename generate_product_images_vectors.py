#!/usr/bin/env python3
import json
import os
import boto3
import base64
from io import BytesIO
from PIL import Image
from os import getenv
import logging
# Please install the following packages in a virtual environment locally:
# pip install boto3
# pip install Pillow

MODEL_ID = getenv("MODEL_ID", "cohere.embed-english-v3")
LOG = logging.getLogger(__name__)
bedrock_client = boto3.client(
    service_name='bedrock-runtime',
    region_name='us-east-1'  # Change to your preferred region
)


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
            "height": 320,
            "width": 320,
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


def get_embedding(text):
    """
    Gets embedding for text using Cohere model via Bedrock.
    """
    try:
        body = json.dumps({
            "texts": [text],
            "input_type": "search_document",
            "truncate": "END",
            "embedding_types": ["float"]
        })
        LOG.info(f"method=get_embedding, body={body}")
        response = bedrock_client.invoke_model(
            modelId=MODEL_ID,
            accept='application/json',
            contentType='application/json',
            body=body
        )
        LOG.info(f"method=get_embedding, response={response}")
        response_body = json.loads(response.get('body').read())
        return response_body['embeddings']['float'][0]
    except Exception as e:
        LOG.error(f"Error getting embedding: {str(e)}")
        raise e

def generate_cohere_embeddings():
    # Path to the products_content_vectors.jsonl file
    products_file = "artifacts/index_lambda/products_content.jsonl"
    products_file_temp = "artifacts/index_lambda/products_content_temp.jsonl"
    # Read the products data
    product_list = read_jsonl_file(products_file)

    # Process products in batches
    batch_size = 30  # Smaller batch size due to embedding API calls
    for i in range(0, len(product_list), batch_size):
        batch = product_list[i:i + batch_size]
            
        for product in batch:
            # Combine relevant fields
            combined_text = f"{product.get('title', '')}, Category: {product.get('category', '')}, Description: {product.get('description', '')}"
            # Get embedding
            vector_embedding = get_embedding(combined_text)
            product['vector_embedding'] = vector_embedding
            print(f"Generated embedding for {product.get('title', '')}")
        
        # save the product to the products_content_vectors.jsonl file
            # create the temp file if it doesn't exist
        if not os.path.exists(products_file_temp):
            with open(products_file_temp, "w") as json_file:
                json.dump(product_list, json_file)
        else:
            with open(products_file_temp, "a") as json_file:
                json.dump(product, json_file)

            
    


def generate_images_for_products():
    # Path to the products_content_vectors.jsonl file
    products_file = "artifacts/index_lambda/products_content.jsonl"
    
    # Path to the data folder for saving images
    data_folder = "artifacts/data_vectors"
    
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
    #generate_images_for_products()
    generate_cohere_embeddings()
