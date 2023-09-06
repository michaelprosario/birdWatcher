import cv2
import time
import pika
import json
import os
from azure.storage.blob import BlobServiceClient, BlobClient, ContainerClient

# Setup blob storage in Azure
container_name = "picturesblobstorage"
def setup_blob_storage():
    connect_str = "DefaultEndpointsProtocol=https;AccountName=birdsblobstorage;AccountKey=b3fOxvj6fclOlzqK9VsOpcWIDQc4d0R9ila+DVs306OgzhJq/1JSRH7/VklLrh9Go5NY9J/Zxxrx+ASt9V+VDA==;EndpointSuffix=core.windows.net"
    
    blob_service_client = BlobServiceClient.from_connection_string(connect_str)
    container_client = blob_service_client.get_container_client(container_name)
    return container_client


def setup_rabbit_message_queue():
    # RabbitMQ connection parameters
    rabbitmq_host = 'localhost'
    rabbitmq_port = 5672
    rabbitmq_username = 'guest'
    rabbitmq_password = 'guest'
    queue_name = 'review-picture-queue'

    # Initialize RabbitMQ connection and channel with authentication
    credentials = pika.PlainCredentials(rabbitmq_username, rabbitmq_password)
    connection = pika.BlockingConnection(
        pika.ConnectionParameters(host=rabbitmq_host, port=rabbitmq_port, credentials=credentials)
    )
    channel = connection.channel()

    # Declare a queue for sending messages
    channel.queue_declare(queue=queue_name)
    return queue_name,connection,channel

def store_picture_on_disk(frame):
    timestamp = time.strftime("%Y%m%d%H%M%S")
    filename = f"image_{timestamp}.jpg"
    cv2.imwrite(filename, frame)
    return timestamp,filename

container_client = setup_blob_storage()

# Set the time interval in seconds
interval = 60  # every min

# Initialize the webcam
cap = cv2.VideoCapture(0)  # 0 represents the default camera (you can change it to a specific camera index if you have multiple cameras)

# Check if the webcam is opened successfully
if not cap.isOpened():
    print("Error: Could not open the webcam.")
    exit()

queue_name, connection, channel = setup_rabbit_message_queue()

while True:
    # Capture a frame from the webcam
    ret, frame = cap.read()

    if not ret:
        print("Error: Could not read frame from the webcam.")
        break

    # Save the captured frame as an image
    timestamp, filename = store_picture_on_disk(frame)
    print(f"Image captured and saved as {filename}")


    local_file_path = filename
    blob_name = filename

    with open(local_file_path, "rb") as data:
        container_client.upload_blob(name=blob_name, data=data)

    # Prepare a JSON message
    message = {
        'fileName': filename,
        'timestamp': timestamp,
    }
    message_json = json.dumps(message)

    # Send the JSON message to RabbitMQ
    channel.basic_publish(exchange='', routing_key=queue_name, body=message_json)

    print(f"Message sent to RabbitMQ: {message_json}")

    os.remove(filename)

    # Wait for the specified interval
    time.sleep(interval)

# Release the webcam, close RabbitMQ connection, and close any open windows
cap.release()
connection.close()
cv2.destroyAllWindows()
